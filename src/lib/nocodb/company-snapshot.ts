// ─── company_daily_snapshot read / write helpers ──────────────────────────────
//
// 日次スナップショットテーブルへのアクセスを担う。
//
// ── NocoDB テーブル構造 ────────────────────────────────────────────────────────
//   company_uid              : Single line text
//   snapshot_date            : Single line text  "YYYY-MM-DD"
//   m_phase                  : Single line text
//   overall_health           : Single line text  "critical" | "at_risk" | "healthy" | "expanding"
//   mrr                      : Number
//   open_support_count       : Number
//   renewal_bucket           : Single line text  "0-30" | "31-90" | "91-180" | "180+" | "expired"
//   renewal_date             : Single line text  "YYYY-MM-DD"
//   active_project_count     : Number  有料アクティブPJ数
//   stalled_project_count    : Number  停滞PJ数（paid かつ stalled/unused）
//   total_l30_active         : Number  全PJのl30Active合計
//   running_campaign_total   : Number  Running Campaign合計（Metabase取得後）
//   pv_ceiling_alert_count   : Number  PV上限90%超PJ数（Metabase取得後）
//
// ── 利用パターン ──────────────────────────────────────────────────────────────
//   書き込み: /api/batch/company-snapshot が日次で upsert
//   読み取り: /api/company-summary-list が前日スナップショットを取得して diff を計算

import { nocoFetch, nocoFetchByUids, TABLE_IDS } from '@/lib/nocodb/client';
import { nocoCreate, nocoUpdate } from '@/lib/nocodb/write';

// ── プロセスメモリキャッシュ ──────────────────────────────────────────────────
// スナップショットは7.9MB/クエリ × 3クエリで Next.js 2MB 上限を超えるため
// プロセスキャッシュ（5分 TTL）で毎回フェッチを防ぐ。
// キャッシュキー: "prev" / "YYYY-MM-DD"（targetDate）

const SNAPSHOT_TTL_MS = 5 * 60 * 1000; // 5分

interface SnapshotCacheEntry {
  data:      Map<string, CompanyDailySnapshot>;
  /**
   * この日付について**問い合わせ済みの company_uid**。
   *
   * ⚠️ ヒットした uid だけを持つと、少ない uid で呼ばれた結果が
   * その日のキャッシュとして居座り、後から多い uid で呼んでも
   * 取得済み分しか返らなくなる（実測: 10社で呼んだ後に102社で呼ぶと7社しか返らない）。
   * 「引いたが該当が無かった uid」も含めて記録する。
   */
  asked:     Set<string>;
  cachedAt:  number;
}
const _snapshotCache = new Map<string, SnapshotCacheEntry>();

function getSnapshotCache(key: string): SnapshotCacheEntry | null {
  const entry = _snapshotCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > SNAPSHOT_TTL_MS) {
    _snapshotCache.delete(key);
    return null;
  }
  return entry;
}

/** 既存エントリに追記する。問い合わせ済み uid を積み上げる */
function mergeSnapshotCache(
  key: string,
  data: Map<string, CompanyDailySnapshot>,
  asked: string[],
): void {
  const cur = _snapshotCache.get(key);
  const fresh = cur && Date.now() - cur.cachedAt <= SNAPSHOT_TTL_MS;
  const merged = fresh ? cur.data : new Map<string, CompanyDailySnapshot>();
  for (const [k, v] of data) merged.set(k, v);
  const askedSet = fresh ? cur.asked : new Set<string>();
  for (const u of asked) askedSet.add(u);
  _snapshotCache.set(key, { data: merged, asked: askedSet, cachedAt: fresh ? cur.cachedAt : Date.now() });
}

/**
 * 1回のクエリで扱う uid 数。
 *
 * `snapshot_date` 降順で引くため、uid をまとめすぎると
 * **新しい日付の行だけで limit を使い切って、一部の企業に到達しない**。
 * 実測（2026-08-22）: 102社を limit 204 で引くと5日分で打ち切られ、49社しか返らなかった。
 * 1社あたり十分な行数の余裕を持たせるため、チャンクを小さくする。
 */
const SNAPSHOT_UID_CHUNK = 20;
/** 1チャンクあたりの取得上限（1社あたり約50行分の余裕） */
const SNAPSHOT_CHUNK_LIMIT = 1000;

// ── 型定義 ───────────────────────────────────────────────────────────────────

export interface CompanyDailySnapshot {
  Id?:                number;   // NocoDB row ID（update 時に必要）
  company_uid:        string;
  snapshot_date:      string;   // "YYYY-MM-DD"
  m_phase:            string | null;
  overall_health:     string | null;
  mrr:                number | null;
  open_support_count: number | null;
  renewal_bucket:     string | null;
  renewal_date:       string | null;

  // ── プロジェクト集計（NocoDB に同名カラムを追加すること）──────────────────
  /** 有料アクティブPJ数（PTI-PAID / PTX-PAID かつ active） */
  active_project_count:    number | null;
  /** 停滞PJ数（paid かつ stalled または unused） */
  stalled_project_count:   number | null;
  /** 全PJのl30Active合計 */
  total_l30_active:        number | null;
  /** Running Campaign合計（Metabase取得後。未設定時 null） */
  running_campaign_total:  number | null;
  /** PV上限90%超PJ数（Metabase取得後。未設定時 null） */
  pv_ceiling_alert_count:  number | null;
}

// ── 書き込み ─────────────────────────────────────────────────────────────────

/**
 * 指定日のスナップショットを upsert する。
 * 同一 company_uid + snapshot_date のレコードが存在すれば更新、なければ作成。
 *
 * @returns 作成 or 更新されたレコードの NocoDB Id
 */
export async function upsertCompanySnapshot(
  snapshot: Omit<CompanyDailySnapshot, 'Id'>,
): Promise<number | null> {
  const tableId = TABLE_IDS.company_daily_snapshot;
  if (!tableId) return null;

  // 既存レコードを探す。
  // ⚠️ **ttl=false 必須。** nocoFetch の既定は5分キャッシュで、しかも
  //    next.revalidate は stale-while-revalidate なので、行を作る前に引いた
  //    「空」の結果をあとから掴むことがある。すると存在するのに create して
  //    同じ (company_uid, snapshot_date) の行が二重にできる。
  //    実際 2026-09-01 に同日再実行で重複が発生した。
  const existing = await nocoFetch<CompanyDailySnapshot>(tableId, {
    where: `(company_uid,eq,${snapshot.company_uid})~and(snapshot_date,eq,${snapshot.snapshot_date})`,
    limit: '1',
  }, false).catch(() => [] as CompanyDailySnapshot[]);

  const payload: Omit<CompanyDailySnapshot, 'Id'> = {
    company_uid:             snapshot.company_uid,
    snapshot_date:           snapshot.snapshot_date,
    m_phase:                 snapshot.m_phase,
    overall_health:          snapshot.overall_health,
    mrr:                     snapshot.mrr,
    open_support_count:      snapshot.open_support_count,
    renewal_bucket:          snapshot.renewal_bucket,
    renewal_date:            snapshot.renewal_date,
    active_project_count:    snapshot.active_project_count    ?? null,
    stalled_project_count:   snapshot.stalled_project_count   ?? null,
    total_l30_active:        snapshot.total_l30_active        ?? null,
    running_campaign_total:  snapshot.running_campaign_total  ?? null,
    pv_ceiling_alert_count:  snapshot.pv_ceiling_alert_count  ?? null,
  };

  if (existing.length > 0 && existing[0].Id != null) {
    await nocoUpdate(tableId, existing[0].Id, payload as Record<string, unknown>);
    return existing[0].Id;
  } else {
    const created = await nocoCreate<CompanyDailySnapshot>(tableId, payload as Record<string, unknown>);
    return (created as CompanyDailySnapshot).Id ?? null;
  }
}

// ── 読み取り ─────────────────────────────────────────────────────────────────

/**
 * 指定企業の直近スナップショット（最新日付）を取得する。
 * company-detail や home で「前回値」を取得するのに使う。
 */
export async function fetchLatestSnapshot(
  companyUid: string,
): Promise<CompanyDailySnapshot | null> {
  const tableId = TABLE_IDS.company_daily_snapshot;
  if (!tableId) return null;
  const list = await nocoFetch<CompanyDailySnapshot>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-snapshot_date,-Id',   // 同日重複時は後から書いた方を採用する
    limit: '1',
  }).catch(() => []);
  return list[0] ?? null;
}

/**
 * 複数企業の直近スナップショットを一括取得する。
 * /api/company-summary-list での差分計算に使用。
 *
 * @returns Map<company_uid, CompanyDailySnapshot>
 */
export async function fetchLatestSnapshotsByUids(
  companyUids: string[],
): Promise<Map<string, CompanyDailySnapshot>> {
  const tableId = TABLE_IDS.company_daily_snapshot;
  if (!tableId || companyUids.length === 0) return new Map();

  // 全社分を一括取得し、company_uid ごとに最新日を選ぶ
  // 同じ snapshot_date の行が複数あった場合に備えて Id 降順を第二キーにする。
  // これが無いと「どちらが返るか」が不定で、古い方を掴むことがある。
  const rawMap = await nocoFetchByUids<CompanyDailySnapshot>(tableId, companyUids, {
    sort:  '-snapshot_date,-Id',
    limit: String(Math.min(companyUids.length * 3, 1000)), // 最大3世代分
  }).catch(() => new Map<string, CompanyDailySnapshot[]>());

  const result = new Map<string, CompanyDailySnapshot>();
  for (const [uid, rows] of rawMap) {
    if (rows.length > 0) result.set(uid, rows[0]); // sort 済みなので rows[0] が最新
  }
  return result;
}

/**
 * 指定企業の「sinceDate 以降」の全スナップショットを日付昇順で返す。
 * CXM v2 会社詳細の時系列（/api/company/[companyUid]/timeseries）で使用。
 */
export async function fetchCompanySnapshotHistory(
  companyUid: string,
  sinceDate: string,
): Promise<CompanyDailySnapshot[]> {
  const tableId = TABLE_IDS.company_daily_snapshot;
  if (!tableId) return [];
  const rows = await nocoFetch<CompanyDailySnapshot>(tableId, {
    where: `(company_uid,eq,${companyUid})~and(snapshot_date,gte,${sinceDate})`,
    sort:  'snapshot_date',
    limit: '400',
  }).catch(() => [] as CompanyDailySnapshot[]);
  return rows;
}

/**
 * 前日のスナップショット日付文字列を返す。
 * バッチで「昨日のスナップが存在するか」確認するのに使う。
 */
export function yesterdayDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * 今日のスナップショット日付文字列を返す。
 */
export function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * n 日前の日付文字列を返す。
 * 週次/月次傾向計算で「7日前」「30日前」のスナップショットを取得するのに使う。
 */
export function nDaysAgoDateStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * 複数企業の「targetDate 以前の最新スナップショット」を一括取得する。
 * 週次/月次トレンド計算で「7日前時点の状態」「30日前時点の状態」を得るのに使用。
 *
 * @returns Map<company_uid, CompanyDailySnapshot>
 */
export async function fetchSnapshotsByDate(
  companyUids: string[],
  targetDate: string,
): Promise<Map<string, CompanyDailySnapshot>> {
  return fetchSnapshotsUpTo(companyUids, targetDate, 'lte', `date:${targetDate}`);
}

/**
 * 「指定日以前（または未満）で最新のスナップショット」を企業ごとに1件取る共通実装。
 *
 * ⚠️ 2つの落とし穴を踏んだので、両方ここで塞いでいる:
 *   1. **limit 不足** — `snapshot_date` 降順で引くため、uid をまとめすぎると
 *      新しい日付の行で limit を使い切り、一部の企業に到達しない。
 *      実測（2026-08-22）: 102社を limit 204 で引くと5日分で打ち切られ49社しか返らず、
 *      提案準備ボードの「実行体制」が102社中53社で未評価になっていた。
 *   2. **キャッシュ汚染** — 取得済み uid を記録しないと、少ない uid で呼ばれた結果が
 *      その日のキャッシュとして居座り、後から多い uid で呼んでも増えない。
 */
async function fetchSnapshotsUpTo(
  companyUids: string[],
  boundaryDate: string,
  op: 'lte' | 'lt',
  cacheKey: string,
): Promise<Map<string, CompanyDailySnapshot>> {
  const tableId = TABLE_IDS.company_daily_snapshot;
  if (!tableId || companyUids.length === 0) return new Map();

  const targetDate = boundaryDate;
  const cached = getSnapshotCache(cacheKey);

  // まだ引いていない uid だけを対象にする。
  // 取得済み uid 集合を見ずにキャッシュを返すと、少ない uid で呼ばれた結果が
  // その日のキャッシュとして固定され、後から多い uid で呼んでも増えない。
  const missing = cached
    ? companyUids.filter(u => !cached.asked.has(u))
    : companyUids;

  if (missing.length > 0) {
    const fetched = new Map<string, CompanyDailySnapshot>();

    // uid をまとめすぎると、新しい日付の行だけで limit を使い切って
    // 一部の企業に到達しない。チャンクに割って1社あたりの行数を確保する。
    for (let i = 0; i < missing.length; i += SNAPSHOT_UID_CHUNK) {
      const chunk = missing.slice(i, i + SNAPSHOT_UID_CHUNK);
      const where = `(company_uid,in,${chunk.join(',')})~and(snapshot_date,${op},${targetDate})`;

      const rows = await nocoFetch<CompanyDailySnapshot>(tableId, {
        where,
        sort:  '-snapshot_date,-Id',   // 同日重複時は後から書いた方を採用する
        limit: String(SNAPSHOT_CHUNK_LIMIT),
      }).catch(() => [] as CompanyDailySnapshot[]);

      for (const row of rows) {
        const uid = row.company_uid;
        if (!uid) continue;
        if (!fetched.has(uid)) fetched.set(uid, row);   // 降順なので最初が最新
      }
    }
    // 該当が無かった uid も「引いた」として記録する（再取得のループを防ぐ）
    mergeSnapshotCache(cacheKey, fetched, missing);
  }

  const store = getSnapshotCache(cacheKey)?.data ?? new Map<string, CompanyDailySnapshot>();
  const result = new Map<string, CompanyDailySnapshot>();
  for (const uid of companyUids) {
    const v = store.get(uid);
    if (v) result.set(uid, v);
  }
  return result;
}

/**
 * 複数企業の「前日スナップショット」を一括取得する。
 * 今日より前（snapshot_date < today）の最新1件を返す。
 * 差分計算（前日比）用。
 *
 * @returns Map<company_uid, CompanyDailySnapshot>
 */
export async function fetchPreviousSnapshotsByUids(
  companyUids: string[],
): Promise<Map<string, CompanyDailySnapshot>> {
  // fetchSnapshotsByDate と同じ落とし穴（limit 不足・キャッシュ汚染）があるため
  // 実装を共有する。境界だけ違う（前日 = 今日より前）。
  return fetchSnapshotsUpTo(companyUids, todayDateStr(), 'lt', `prev:${todayDateStr()}`);
}
