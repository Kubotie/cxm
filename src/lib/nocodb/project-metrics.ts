// ─── project_metrics（プロジェクト日次メトリクス）─────────────────────────────
//
// **Metabase の CSV をリクエスト経路から外すための事前計算テーブル。**
//
// 実測（2026-08-22 / dev）:
//   コールド: ボード7.0秒 / 準備度4.0秒 / 個社施策5.7秒 / PJ詳細4.2秒
//   ウォーム: 0.0〜1.4秒（プロセス内キャッシュが効く）
// つまり遅さの正体はコールドスタート。Vercel はインスタンスごとに払うので、
// プロセス内キャッシュでは解決しない。**朝のバッチで NocoDB に落として読む。**
//
// 読み取り側は必ずフォールバックを持つ:
//   行が無い / 古い → その場で CSV から計算する。
//   事前計算が失敗した日に画面が空になるのは許容できない。
//
// ── テーブル定義（mkwtxyezomso6ik / 主キー id）──────────────────────────────
//   project_id, company_uid, metric_date, project_name, paid_type
//   module_*      30日の管理画面モジュール利用
//   campaign_*    施策サマリ由来
//   operators 等  アカウント別稼働
//   生指標        l30/l7/PV/期間/最終活動（CSVを引かずに済ませるため）

import { TABLE_IDS, nocoFetch } from '@/lib/nocodb/client';
import { nocoCreate, nocoUpdate } from '@/lib/nocodb/write';

export interface ProjectMetricRow {
  id?:            number;
  project_id:     string;
  company_uid:    string | null;
  metric_date:    string;
  project_name:   string | null;
  paid_type:      string | null;

  module_verdict:   string | null;
  module_active_pv: number | null;
  module_deep_pv:   number | null;
  module_count:     number | null;
  /** JSON配列 */
  module_unused:    string | null;

  campaign_activity:       string | null;
  campaign_running:        number | null;
  campaign_ran_30d:        number | null;
  campaign_created_30d:    number | null;
  campaign_days_since_run: number | null;
  campaign_no_goal:        number | null;
  /** 公開率（%）。0〜100 の整数。NocoDB の Number が小数を受け付けないため */
  campaign_publish_rate:   number | null;

  operators:          number | null;
  operators_prev:     number | null;
  internal_operators: number | null;
  /** JSON */
  role_counts:        string | null;
  /** JSON配列 */
  untouched_products: string | null;
  /**
   * 直近4週に稼働した顧客側アカウントのメール（JSON配列）。
   * **人数は企業横断で重複排除する必要がある**ため、数だけでは足りない。
   * PJごとの人数を足すと、複数PJを見ている1人が人数分に膨らむ。
   */
  operator_emails:    string | null;
  /** その1つ前の4週に稼働していた顧客側アカウント（増減の比較用） */
  operator_emails_prev: string | null;

  l30_active:  number | null;
  l7_events:   number | null;
  pv_ceiling:  number | null;
  month_pv:    number | null;
  pv_forecast: number | null;
  period_start: string | null;
  period_end:   string | null;
  last_active_date: string | null;
  campaigns_with_goal: number | null;
  habituation: string | null;

  computed_at_jst: string | null;
}

export function isProjectMetricsEnabled(): boolean {
  return Boolean(TABLE_IDS.project_metrics);
}

/**
 * 指定プロジェクトの最新メトリクスを引く。
 * テーブル未設定・取得失敗時は空 Map（呼び出し側がその場計算に落ちる）。
 */
export async function fetchProjectMetrics(
  projectIds: string[],
): Promise<Map<string, ProjectMetricRow>> {
  const tableId = TABLE_IDS.project_metrics;
  const out = new Map<string, ProjectMetricRow>();
  if (!tableId || projectIds.length === 0) return out;

  // uid をまとめすぎると新しい日付の行で limit を使い切って一部に届かない
  // （company_snapshot で実際に踏んだ。§32）
  const CHUNK = 40;
  for (let i = 0; i < projectIds.length; i += CHUNK) {
    const chunk = projectIds.slice(i, i + CHUNK);
    const rows = await nocoFetch<ProjectMetricRow>(tableId, {
      where: `(project_id,in,${chunk.join(',')})`,
      sort:  '-metric_date',
      limit: String(CHUNK * 10),
    }, false).catch(() => [] as ProjectMetricRow[]);
    for (const r of rows) {
      if (!r.project_id) continue;
      if (!out.has(r.project_id)) out.set(r.project_id, r);   // 降順なので最初が最新
    }
  }
  return out;
}

/**
 * 指定日の既存行を一括で引く（project_id → 行ID）。
 *
 * **1件ずつ SELECT すると往復が倍になる。**
 * 実測（2026-08-24）: 1,295件を1件ずつ upsert すると Vercel 上で300秒を超え、
 * `FUNCTION_INVOCATION_TIMEOUT` になった（ローカルは98秒）。
 * 先に当日分をまとめて読み、書き込みだけを行う。
 */
export async function fetchMetricRowIds(metricDate: string): Promise<Map<string, number>> {
  const tableId = TABLE_IDS.project_metrics;
  const out = new Map<string, number>();
  if (!tableId) return out;

  // NocoDB の limit は最大2000で黙って切り詰められるため、ページングする
  for (let page = 0; page < 20; page++) {
    const rows = await nocoFetch<{ id: number; project_id: string }>(tableId, {
      where:  `(metric_date,eq,${metricDate})`,
      fields: 'id,project_id',
      limit:  '1000',
      offset: String(page * 1000),
    }, false).catch(() => [] as Array<{ id: number; project_id: string }>);
    for (const r of rows) if (r.project_id) out.set(r.project_id, r.id);
    if (rows.length < 1000) break;
  }
  return out;
}

/** 同じ project_id + metric_date があれば更新、無ければ作成 */
export async function upsertProjectMetric(
  row: Omit<ProjectMetricRow, 'id'>,
  /** `fetchMetricRowIds()` の結果。渡すと SELECT を省ける */
  knownId?: number,
): Promise<{ ok: boolean; created: boolean; error?: string }> {
  const tableId = TABLE_IDS.project_metrics;
  if (!tableId) return { ok: false, created: false, error: 'NOCODB_PROJECT_METRICS_TABLE_ID が未設定です' };
  try {
    let rowId = knownId;
    if (rowId === undefined) {
      const existing = await nocoFetch<ProjectMetricRow>(tableId, {
        where: `(project_id,eq,${row.project_id})~and(metric_date,eq,${row.metric_date})`,
        limit: '1',
      }, false).catch(() => [] as ProjectMetricRow[]);
      rowId = existing[0]?.id;
    }

    if (rowId !== undefined) {
      // このテーブルの主キーは小文字 `id`（自作テーブル）
      await nocoUpdate(tableId, rowId, row, 'id');
      return { ok: true, created: false };
    }
    await nocoCreate(tableId, row);
    return { ok: true, created: true };
  } catch (e) {
    return { ok: false, created: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** "YYYY-MM-DD"（JST） */
export function jstDate(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD HH:mm"（JST） */
export function jstStamp(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().replace('T', ' ').slice(0, 16);
}

/** 事前計算が使えるか。今日か昨日の行なら新鮮とみなす */
export function isFresh(row: ProjectMetricRow | undefined): boolean {
  if (!row?.metric_date) return false;
  const y = new Date(Date.now() + 9 * 3600_000 - 86400_000).toISOString().slice(0, 10);
  return row.metric_date >= y;
}
