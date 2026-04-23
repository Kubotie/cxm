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
