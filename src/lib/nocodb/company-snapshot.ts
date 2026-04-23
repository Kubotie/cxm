// ─── company_daily_snapshot read / write helpers ──────────────────────────────
//
// 日次スナップショットテーブルへのアクセスを担う。
//
// ── NocoDB テーブル構造 ────────────────────────────────────────────────────────
//   company_uid        : Single line text
//   snapshot_date      : Single line text  "YYYY-MM-DD"
//   m_phase            : Single line text
//   overall_health     : Single line text  "critical" | "at_risk" | "healthy" | "expanding"
//   mrr                : Number
//   open_support_count : Number
//   renewal_bucket     : Single line text  "0-30" | "31-90" | "91-180" | "180+" | "expired"
//   renewal_date       : Single line text  "YYYY-MM-DD"
//
// ── 利用パターン ──────────────────────────────────────────────────────────────
//   書き込み: /api/batch/company-snapshot が日次で upsert
//   読み取り: /api/company-summary-list が前日スナップショットを取得して diff を計算

import { nocoFetch, nocoFetchByUids, TABLE_IDS } from '@/lib/nocodb/client';
import { nocoCreate, nocoUpdate } from '@/lib/nocodb/write';

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

  // 既存レコードを探す
  const existing = await nocoFetch<CompanyDailySnapshot>(tableId, {
    where: `(company_uid,eq,${snapshot.company_uid})~and(snapshot_date,eq,${snapshot.snapshot_date})`,
    limit: '1',
  }).catch(() => [] as CompanyDailySnapshot[]);

  const payload: Omit<CompanyDailySnapshot, 'Id'> = {
    company_uid:        snapshot.company_uid,
    snapshot_date:      snapshot.snapshot_date,
    m_phase:            snapshot.m_phase,
    overall_health:     snapshot.overall_health,
    mrr:                snapshot.mrr,
    open_support_count: snapshot.open_support_count,
    renewal_bucket:     snapshot.renewal_bucket,
    renewal_date:       snapshot.renewal_date,
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
    sort:  '-snapshot_date',
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
  const rawMap = await nocoFetchByUids<CompanyDailySnapshot>(tableId, companyUids, {
    sort:  '-snapshot_date',
    limit: String(Math.min(companyUids.length * 3, 1000)), // 最大3世代分
  }).catch(() => new Map<string, CompanyDailySnapshot[]>());

  const result = new Map<string, CompanyDailySnapshot>();
  for (const [uid, rows] of rawMap) {
    if (rows.length > 0) result.set(uid, rows[0]); // sort 済みなので rows[0] が最新
  }
  return result;
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
  const tableId = TABLE_IDS.company_daily_snapshot;
  if (!tableId || companyUids.length === 0) return new Map();

  // targetDate 以前で最新のスナップショットを uid ごとに1件取得
  const where = `(company_uid,in,${companyUids.join(',')})~and(snapshot_date,lte,${targetDate})`;
  const limit = String(Math.min(companyUids.length * 2, 1000));

  const rows = await nocoFetch<CompanyDailySnapshot>(tableId, {
    where,
    sort:  '-snapshot_date',
    limit,
  }).catch(() => [] as CompanyDailySnapshot[]);

  const result = new Map<string, CompanyDailySnapshot>();
  for (const row of rows) {
    const uid = row.company_uid;
    if (!uid) continue;
    if (!result.has(uid)) result.set(uid, row); // sort 済みで先着1件 = 最新
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
  const tableId = TABLE_IDS.company_daily_snapshot;
  if (!tableId || companyUids.length === 0) return new Map();

  const today = todayDateStr();
  // NocoDB フィルタ: company_uid が対象リストに含まれ、かつ snapshot_date < today
  const where = `(company_uid,in,${companyUids.join(',')})~and(snapshot_date,lt,${today})`;
  // 1社あたり最大2件取得して最新を選ぶ（同日に複数行がある場合の保険）
  const limit = String(Math.min(companyUids.length * 2, 1000));

  const rows = await nocoFetch<CompanyDailySnapshot>(tableId, {
    where,
    sort:  '-snapshot_date',
    limit,
  }).catch(() => [] as CompanyDailySnapshot[]);

  const result = new Map<string, CompanyDailySnapshot>();
  for (const row of rows) {
    const uid = row.company_uid;
    if (!uid) continue;
    // sort 済みで先着1件 = 最新の前日スナップ
    if (!result.has(uid)) result.set(uid, row);
  }
  return result;
}
