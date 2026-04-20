import { nocoFetch, nocoFetchByUids, TABLE_IDS } from './client';
import { RawPerson, AppPerson, toAppPerson, type RawCompanyPerson } from './types';

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
export async function fetchStaleDmSignalsByUids(
  uids: string[],
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (uids.length === 0 || !TABLE_IDS.company_people) return result;

  // today - STALE_DAYS のしきい値日付
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - STALE_DAYS);
  const thresholdStr = threshold.toISOString().slice(0, 10); // YYYY-MM-DD

  // company_people: decision_influence=high AND last_touchpoint notblank
  //   → last_touchpoint < threshold は JS 側でフィルタ（NocoDB の lt は文字列比較が不安定）
  const where = [
    `(company_uid,in,${uids.join(',')})`,
    `(decision_influence,eq,high)`,
    `(last_touchpoint,notblank)`,
  ].join('~and');

  try {
    const rows = await nocoFetch<RawCompanyPerson>(TABLE_IDS.company_people, {
      where,
      fields: 'company_uid,last_touchpoint',
      limit:  String(Math.min(uids.length * 20, 2000)),
    });

    for (const row of rows) {
      const uid = row.company_uid?.trim();
      if (!uid) continue;
      // すでに true 確定ならスキップ
      if (result.get(uid) === true) continue;

      const date = parseTouchpointDate(row.last_touchpoint as string | null);
      if (date && date < threshold) {
        result.set(uid, true);
      }
    }
  } catch {
    // エラー時は空 Map → hasStaleDm = false（近似値 fallback）
  }
  return result;
}

/**
 * 複数企業の People シグナルサマリーを一括取得する。
 * List API で priority score に people signal を注入するための軽量クエリ。
 *
 * is_decision_maker が "TRUE" の件数を company_uid ごとに集計して返す。
 * テーブル未設定の場合は空 Map を返す（graceful degradation）。
 */
export async function fetchPeopleSignalsByUids(
  uids: string[],
): Promise<Map<string, PeopleSignalSummary>> {
  const tableId = TABLE_IDS.people;
  if (!tableId || uids.length === 0) return new Map();

  const rowMap = await nocoFetchByUids<RawPerson>(tableId, uids, {
    fields: 'company_uid,is_decision_maker',
    limit:  String(Math.min(uids.length * 30, 3000)),
  });

  const result = new Map<string, PeopleSignalSummary>();
  for (const uid of uids) {
    const rows = rowMap.get(uid) ?? [];
    const dmCount = rows.filter(r => {
      const v = String(r.is_decision_maker ?? '').toUpperCase();
      return v === 'TRUE' || v === '1';
    }).length;
    result.set(uid, { companyUid: uid, dmCount, totalCount: rows.length });
  }
  return result;
}
