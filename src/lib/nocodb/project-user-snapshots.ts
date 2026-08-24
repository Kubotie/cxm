// ─── project_user_snapshots read / write helpers ──────────────────────────────
//
// プロジェクト単位の日次スナップショット。
// 新規ユーザー追加・Campaign 急増の差分検出に使う。
//
// ── NocoDB テーブル構造 ────────────────────────────────────────────────────────
//   project_id             : Single line text  (PK 相当。company_uid と組み合わせで一意)
//   company_uid            : Single line text
//   snapshot_date          : Single line text  "YYYY-MM-DD"
//   total_users            : Number   プロジェクトの総メンバー数
//   l30_active_users       : Number   過去30日アクティブ数（ローリング）
//   l7_active_users        : Number   過去7日アクティブ数（ローリング）
//   running_campaign_count : Number   実行中 Campaign（目標付き）
//
// ── 利用パターン ──────────────────────────────────────────────────────────────
//   書き込み: /api/batch/company-snapshot が日次で upsert
//   読み取り: /api/home/project-signals が前回値と比較してシグナル検出

import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';
import { nocoCreate, nocoUpdate } from '@/lib/nocodb/write';

// ── 型定義 ────────────────────────────────────────────────────────────────────

export interface ProjectUserSnapshot {
  Id?:                    number;
  project_id:             string;
  company_uid:            string;
  snapshot_date:          string;   // "YYYY-MM-DD"
  total_users:            number | null;
  l30_active_users:       number | null;
  l7_active_users:        number | null;
  running_campaign_count: number | null;
  // ── 利用実績（CXM v2 個社ページの CSV 直読み廃止のため追加。Metabase signals 由来）──
  heatmap_count?:         number | null;   // Pti History Heatmap Count
  pv_ceiling?:            number | null;   // Pv Ceiling
  month_pv_count?:        number | null;   // Month Period Pv Count
  last_active_date?:      string | null;   // Last Active Date "YYYY-MM-DD"
  // ── 活用スコア（記録開始後のバッチで書き込み。未設定時 undefined）──────────
  healthy_score?:         number | null;
  depth_score?:           number | null;
  breadth_score?:         number | null;
}

// ── 書き込み ─────────────────────────────────────────────────────────────────

/**
 * 1プロジェクトのスナップショットを upsert する。
 * 同一 project_id + snapshot_date のレコードが存在すれば更新、なければ作成。
 */
export async function upsertProjectUserSnapshot(
  snapshot: Omit<ProjectUserSnapshot, 'Id'>,
): Promise<void> {
  const tableId = TABLE_IDS.project_user_snapshots;
  if (!tableId) return;

  const existing = await nocoFetch<ProjectUserSnapshot>(tableId, {
    where: `(project_id,eq,${snapshot.project_id})~and(snapshot_date,eq,${snapshot.snapshot_date})`,
    limit: '1',
  }).catch(() => [] as ProjectUserSnapshot[]);

  const payload: Omit<ProjectUserSnapshot, 'Id'> = {
    project_id:             snapshot.project_id,
    company_uid:            snapshot.company_uid,
    snapshot_date:          snapshot.snapshot_date,
    total_users:            snapshot.total_users,
    l30_active_users:       snapshot.l30_active_users,
    l7_active_users:        snapshot.l7_active_users,
    running_campaign_count: snapshot.running_campaign_count,
  };

  if (existing.length > 0 && existing[0].Id != null) {
    await nocoUpdate(tableId, existing[0].Id, payload as Record<string, unknown>);
  } else {
    await nocoCreate<ProjectUserSnapshot>(tableId, payload as Record<string, unknown>);
  }
}

// ── 読み取り ─────────────────────────────────────────────────────────────────

/**
 * 複数プロジェクトの「targetDate 以前の最新スナップショット」を一括取得する。
 * 週次差分計算で「7日前時点の状態」を得るのに使用。
 *
 * @returns Map<project_id, ProjectUserSnapshot>
 */
export async function fetchProjectSnapshotsByDate(
  projectIds: string[],
  targetDate: string,
): Promise<Map<string, ProjectUserSnapshot>> {
  const tableId = TABLE_IDS.project_user_snapshots;
  if (!tableId || projectIds.length === 0) return new Map();

  // NocoDB の in フィルタで一括取得
  const where = `(project_id,in,${projectIds.join(',')})~and(snapshot_date,lte,${targetDate})`;
  const limit = String(Math.min(projectIds.length * 3, 3000));

  const rows = await nocoFetch<ProjectUserSnapshot>(tableId, {
    where,
    sort:  '-snapshot_date',
    limit,
  }, false).catch(() => [] as ProjectUserSnapshot[]);

  // project_id ごとに最新1件を選ぶ（sort 済みなので先頭が最新）
  const result = new Map<string, ProjectUserSnapshot>();
  for (const row of rows) {
    if (!row.project_id) continue;
    if (!result.has(row.project_id)) result.set(row.project_id, row);
  }
  return result;
}

/**
 * 複数プロジェクトの「最新スナップショット（各 project_id につき最新日1件）」を返す。
 * CXM v2 個社ページ（/api/company/[companyUid]/usage）が Metabase CSV 全件DLを避け、
 * 日次スナップショットから利用実績を読むために使う。
 *
 * @returns Map<project_id, ProjectUserSnapshot>（該当なしは空 Map）
 */
export async function fetchLatestProjectSnapshots(
  projectIds: string[],
): Promise<Map<string, ProjectUserSnapshot>> {
  const tableId = TABLE_IDS.project_user_snapshots;
  if (!tableId || projectIds.length === 0) return new Map();

  const where = `(project_id,in,${projectIds.join(',')})`;
  const limit = String(Math.min(projectIds.length * 3, 3000));

  const rows = await nocoFetch<ProjectUserSnapshot>(tableId, {
    where,
    sort:  '-snapshot_date',
    limit,
  }, false).catch(() => [] as ProjectUserSnapshot[]);

  const result = new Map<string, ProjectUserSnapshot>();
  for (const row of rows) {
    if (!row.project_id) continue;
    if (!result.has(row.project_id)) result.set(row.project_id, row); // sort 済み先頭 = 最新
  }
  return result;
}

/**
 * 複数プロジェクトの「sinceDate 以降」の全スナップショットを日付昇順で返す。
 * CXM v2 会社詳細の時系列（/api/company/[companyUid]/timeseries）で使用。
 * 返却は日別集計前のフラットな配列。日付ごとの集約は呼び出し側で行う。
 */
export async function fetchProjectSnapshotHistory(
  projectIds: string[],
  sinceDate: string,
): Promise<ProjectUserSnapshot[]> {
  const tableId = TABLE_IDS.project_user_snapshots;
  if (!tableId || projectIds.length === 0) return [];

  const where = `(project_id,in,${projectIds.join(',')})~and(snapshot_date,gte,${sinceDate})`;
  const limit = String(Math.min(projectIds.length * 120, 5000));

  const rows = await nocoFetch<ProjectUserSnapshot>(tableId, {
    where,
    sort:  'snapshot_date',
    limit,
  }, false).catch(() => [] as ProjectUserSnapshot[]);

  return rows;
}
