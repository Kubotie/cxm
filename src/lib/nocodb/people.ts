import { nocoFetch, nocoFetchByUids, TABLE_IDS } from './client';
import { RawPerson, AppPerson, toAppPerson, type RawCompanyPerson } from './types';

// ── Mail 送信用コンタクト取得 ──────────────────────────────────────────────────

export interface MailContact {
  name:  string;
  email: string;
  role:  string | null;
}

/**
 * 複数企業のメール連絡先を一括取得する（Outbound Mail 送信用）。
 * company_people テーブルから email が設定されているコンタクトを返す。
 * 優先度: decision_influence=high → contact_status=active → 名前順
 */
export async function fetchContactsByCompanyUids(
  uids: string[],
): Promise<Map<string, MailContact[]>> {
  const result = new Map<string, MailContact[]>();
  for (const uid of uids) result.set(uid, []);

  const tableId = TABLE_IDS.company_people;
  if (!tableId || uids.length === 0) return result;

  const rawMap = await nocoFetchByUids<RawCompanyPerson>(tableId, uids, {
    fields: 'company_uid,name,email,role,decision_influence,contact_status',
    limit:  String(uids.length * 20),
  }).catch(() => new Map<string, RawCompanyPerson[]>());

  const INFLUENCE_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2, unknown: 3 };

  for (const [uid, rows] of rawMap) {
    const contacts: MailContact[] = rows
      .filter(r => r.email && String(r.email).includes('@'))
      .map(r => ({
        name:  r.name ? String(r.name) : '（名前なし）',
        email: String(r.email),
        role:  r.role ? String(r.role) : null,
        _influence: INFLUENCE_ORDER[String(r.decision_influence ?? 'unknown').toLowerCase()] ?? 3,
        _active: String(r.contact_status ?? '').toLowerCase() === 'active' ? 0 : 1,
        _name: r.name ? String(r.name) : '',
      }))
      .sort((a, b) => a._influence - b._influence || a._active - b._active || a._name.localeCompare(b._name))
      .map(({ name, email, role }) => ({ name, email, role }));
    result.set(uid, contacts);
  }
  return result;
}

// ── プロセスメモリキャッシュ（Next.js fetch cache の2MB上限回避）──────────────
// People / StaleDm の結果は全企業まとめて5分間キャッシュする。
// リクエストごとに uid セットが変わるため、全件キャッシュして呼び出し側でフィルタする。

const CACHE_TTL_MS = 5 * 60 * 1000; // 5分

let _peopleSignalCache:    Map<string, PeopleSignalSummary> | null = null;
let _peopleSignalCacheAt = 0;

let _staleDmCache:    Map<string, boolean> | null = null;
let _staleDmCacheAt = 0;

/** People 一覧（Company Detail 用） */
export async function fetchPeople(companyUid: string): Promise<AppPerson[]> {
  const raw = await nocoFetch<RawPerson>(TABLE_IDS.people, {
    where: `(company_uid,eq,${companyUid})`,
    limit: '200',
  });
  return raw.map(r => toAppPerson(r, companyUid));
}

// ── Bulk people signal fetch（Company List 優先度計算用）──────────────────────

export interface PeopleSignalSummary {
  companyUid:       string;
  /** high influence (is_decision_maker=TRUE) のコンタクト数 */
  dmCount:          number;
  /** 全コンタクト数 */
  totalCount:       number;
}

// ── stale DM signal（List API: hasStaleDm 実測化）────────────────────────────

/** lastTouchpoint の YYYY-MM-DD 文字列を Date に変換する（フォーマット揺れ吸収）*/
function parseTouchpointDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  // YYYY-MM-DD / YYYY-MM-DDTHH:mm:ss など様々なフォーマットを受け付ける
  const s = String(raw).trim().slice(0, 10); // YYYY-MM-DD まで切り取る
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}

/** 90日以上前かどうか判定する（org-chart-vm.ts の getTouchpointAge と同じ閾値）*/
const STALE_DAYS = 90;

/**
 * 複数企業の DM（decision_influence = 'high'）に stale な lastTouchpoint が
 * 存在するかどうかを一括チェックする。
 *
 * stale の定義: lastTouchpoint < today - 90d（null は stale 判定から除外）
 * 対象テーブル: company_people（last_touchpoint カラムを持つ CXM マネージド連絡先）
 *
 * @returns Map<company_uid, true>（stale な DM がない UID はキー自体が含まれない）
 * @remarks NOCODB_COMPANY_PEOPLE_TABLE_ID 未設定 / エラー時は空 Map を返す
 */
/** 全企業の StaleDm シグナルを一括フェッチしてキャッシュする（内部用）*/
async function loadAllStaleDmSignals(): Promise<Map<string, boolean>> {
  if (_staleDmCache && Date.now() - _staleDmCacheAt < CACHE_TTL_MS) {
    return _staleDmCache;
  }
  if (!TABLE_IDS.company_people) return _staleDmCache ?? new Map();

  const threshold = new Date();
  threshold.setDate(threshold.getDate() - STALE_DAYS);

  const where = [
    `(decision_influence,eq,high)`,
    `(last_touchpoint,notblank)`,
  ].join('~and');

  try {
    const rows = await nocoFetch<RawCompanyPerson>(TABLE_IDS.company_people, {
      where,
      fields: 'company_uid,last_touchpoint',
      limit:  '2000',
    });
    const result = new Map<string, boolean>();
    for (const row of rows) {
      const uid = row.company_uid?.trim();
      if (!uid || result.get(uid) === true) continue;
      const date = parseTouchpointDate(row.last_touchpoint as string | null);
      if (date && date < threshold) result.set(uid, true);
    }
    _staleDmCache   = result;
    _staleDmCacheAt = Date.now();
    return result;
  } catch {
    return _staleDmCache ?? new Map();
  }
}

export async function fetchStaleDmSignalsByUids(
  uids: string[],
): Promise<Map<string, boolean>> {
  if (uids.length === 0 || !TABLE_IDS.company_people) return new Map();
  const all = await loadAllStaleDmSignals();
  const result = new Map<string, boolean>();
  for (const uid of uids) {
    if (all.has(uid)) result.set(uid, all.get(uid)!);
  }
  return result;
}

/**
 * 全企業の People シグナルを一括フェッチしてキャッシュに格納する（内部用）。
 * 結果は uid → PeopleSignalSummary の Map として5分間保持する。
 */
async function loadAllPeopleSignals(): Promise<Map<string, PeopleSignalSummary>> {
  if (_peopleSignalCache && Date.now() - _peopleSignalCacheAt < CACHE_TTL_MS) {
    return _peopleSignalCache;
  }
  const tableId = TABLE_IDS.people;
  if (!tableId) return _peopleSignalCache ?? new Map();

  try {
    // 全企業分を一括取得（上限3000件）
    const rows = await nocoFetch<RawPerson>(tableId, {
      fields: 'company_uid,is_decision_maker',
      limit:  '3000',
    });
    const result = new Map<string, PeopleSignalSummary>();
    for (const row of rows) {
      const uid = row.company_uid as string | undefined;
      if (!uid) continue;
      const entry = result.get(uid) ?? { companyUid: uid, dmCount: 0, totalCount: 0 };
      entry.totalCount++;
      const v = String(row.is_decision_maker ?? '').toUpperCase();
      if (v === 'TRUE' || v === '1') entry.dmCount++;
      result.set(uid, entry);
    }
    _peopleSignalCache   = result;
    _peopleSignalCacheAt = Date.now();
    return result;
  } catch {
    return _peopleSignalCache ?? new Map();
  }
}

/**
 * 複数企業の People シグナルサマリーを一括取得する。
 * List API で priority score に people signal を注入するための軽量クエリ。
 * プロセスキャッシュ（5分）で大量レスポンスの再フェッチを防ぐ。
 */
export async function fetchPeopleSignalsByUids(
  uids: string[],
): Promise<Map<string, PeopleSignalSummary>> {
  if (uids.length === 0) return new Map();
  const all = await loadAllPeopleSignals();
  const result = new Map<string, PeopleSignalSummary>();
  for (const uid of uids) {
    const v = all.get(uid);
    if (v) result.set(uid, v);
  }
  return result;
}
