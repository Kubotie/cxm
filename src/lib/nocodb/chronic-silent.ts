// ─── Ptengine 持続休眠（chronic silent）スナップショットの read/write ──────────
//
// データ源: ptengine-analytics MCP の report_get_chronic_silent_projects。
//   MCP はローカルの Metabase API 直アクセスで「2ヶ月連続休眠の有料プロジェクト」を
//   算出する。Next.js アプリは public question CSV しか叩けず複数月 behavior 履歴を
//   持たないため、この判定はアプリ側で再現できない。
//
// そこで MCP 出力を ingest API (/api/batch/chronic-silent-sync) 経由で
// chronic_silent_snapshots テーブルへ「1 refMonth = 1 行」保存し、
// 週次解約レポートの AI プロンプト注入・enrichment の source とする。
//
// 用語: 中国語 portrait カテゴリ「沉默」は日本語で「休眠」と表記する。

import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';
import { nocoCreate } from '@/lib/nocodb/write';

// ── 型定義 ───────────────────────────────────────────────────────────────────

/** 休眠アカウント 1 社ぶんの明細（Salesforce account 単位に集約） */
export interface ChronicSilentItem {
  sfAccountId:      string;   // = MCP の mix_unit_id（Salesforce Account ID, "001…"）
  companyName:      string | null;
  plan:             string | null;   // 代表プロジェクトの plan
  riskLevel:        string | null;   // 最も重い risk（🔴 3月 > 🟠 2月）
  portraitSequence: string | null;   // 代表プロジェクトの休眠遷移（日本語化済み想定）
  l30Active:        number | null;   // アカウント内で最小の l30_active（ハイブリッド判定に使用）
  projectCount:     number;
}

/** ingest API が受け取る & テーブルに保存するスナップショット本体 */
export interface ChronicSilentSnapshot {
  refMonth:        string;                        // 'YYYY-MM'
  area:            string;                        // 'JP' 等
  lookbackMonths:  number;
  totalChronic:    number;                        // 休眠プロジェクト総数（MCP の total_chronic）
  byPlan:          Record<string, number>;        // プロジェクト単位の plan 別件数
  items:           ChronicSilentItem[];           // アカウント単位の明細
  sourceCsv:       string | null;                 // MCP CSV パス（トレーサビリティ用）
  generatedAt:     string;                        // ISO8601
}

/** テーブル行（NocoDB 上のカラム名にマップ） */
interface ChronicSilentSnapshotRow {
  Id?:              number;
  snapshot_id:      string;
  ref_month:        string;
  area:             string;
  lookback_months:  number;
  total_chronic:    number;
  by_plan_json:     string;   // JSON string
  items_json:       string;   // JSON string
  source_csv:       string;
  generated_at:     string;
}

// ── write ────────────────────────────────────────────────────────────────────

/**
 * スナップショットを 1 行 insert する。snapshot_id は refMonth+area+generatedAt から生成。
 * @returns 生成された行 Id（テーブル未設定なら null）
 */
export async function insertChronicSilentSnapshot(
  snap: ChronicSilentSnapshot,
): Promise<{ id: number | null; snapshotId: string }> {
  const tableId = TABLE_IDS.chronic_silent_snapshots;
  const snapshotId = `silent-${snap.area}-${snap.refMonth}-${snap.generatedAt.slice(0, 19).replace(/[-:T]/g, '')}`;
  if (!tableId) return { id: null, snapshotId };

  const row: Omit<ChronicSilentSnapshotRow, 'Id'> = {
    snapshot_id:     snapshotId,
    ref_month:       snap.refMonth,
    area:            snap.area,
    lookback_months: snap.lookbackMonths,
    total_chronic:   snap.totalChronic,
    by_plan_json:    JSON.stringify(snap.byPlan),
    items_json:      JSON.stringify(snap.items),
    source_csv:      snap.sourceCsv ?? '',
    generated_at:    snap.generatedAt,
  };
  const created = await nocoCreate<ChronicSilentSnapshotRow>(tableId, row as Record<string, unknown>);
  return { id: (created as ChronicSilentSnapshotRow).Id ?? null, snapshotId };
}

// ── read ─────────────────────────────────────────────────────────────────────

function parseRow(row: ChronicSilentSnapshotRow): ChronicSilentSnapshot {
  const safeJson = <T>(s: string | null | undefined, fallback: T): T => {
    if (!s) return fallback;
    try { return JSON.parse(s) as T; } catch { return fallback; }
  };
  return {
    refMonth:       row.ref_month,
    area:           row.area,
    lookbackMonths: row.lookback_months,
    totalChronic:   row.total_chronic,
    byPlan:         safeJson<Record<string, number>>(row.by_plan_json, {}),
    items:          safeJson<ChronicSilentItem[]>(row.items_json, []),
    sourceCsv:      row.source_csv || null,
    generatedAt:    row.generated_at,
  };
}

/**
 * 最新のスナップショットを 1 件取得する（area 指定可）。無ければ null。
 */
export async function fetchLatestChronicSilentSnapshot(
  area = 'JP',
): Promise<ChronicSilentSnapshot | null> {
  const tableId = TABLE_IDS.chronic_silent_snapshots;
  if (!tableId) return null;
  const list = await nocoFetch<ChronicSilentSnapshotRow>(tableId, {
    where: `(area,eq,${area})`,
    sort:  '-generated_at',
    limit: '1',
  }, false).catch(() => []);
  return list[0] ? parseRow(list[0]) : null;
}

// ── enrichment ヘルパー ────────────────────────────────────────────────────────

/**
 * スナップショットから Salesforce account ID の集合を作る。
 * companies enrichment（is_chronic_silent の read-time 導出）や
 * 解約リストとの突合に使う。
 */
export function buildSilentSfIdMap(
  snap: ChronicSilentSnapshot | null,
): Map<string, ChronicSilentItem> {
  const map = new Map<string, ChronicSilentItem>();
  if (!snap) return map;
  for (const it of snap.items) {
    const sf = (it.sfAccountId ?? '').trim();
    if (sf) map.set(sf, it);
  }
  return map;
}

/**
 * スナップショットから company_uid の集合を作る（一覧UIのバッジ判定用）。
 * SF 連携企業の company_uid は `sf_<sf_account_id>` 形式なので、休眠アカウントの
 * sf_account_id を `sf_` プレフィックス付きに変換して返す。
 */
export function buildSilentCompanyUids(snap: ChronicSilentSnapshot | null): string[] {
  if (!snap) return [];
  return snap.items
    .map(it => (it.sfAccountId ?? '').trim())
    .filter(Boolean)
    .map(sf => `sf_${sf}`);
}

/**
 * company_uid（`sf_<sf_account_id>`）→ 休眠アイテムの Map。
 * 一覧UIで company_uid から l30Active 等を引くのに使う。
 */
export function buildSilentItemByCompanyUid(
  snap: ChronicSilentSnapshot | null,
): Map<string, ChronicSilentItem> {
  const map = new Map<string, ChronicSilentItem>();
  if (!snap) return map;
  for (const it of snap.items) {
    const sf = (it.sfAccountId ?? '').trim();
    if (sf) map.set(`sf_${sf}`, it);
  }
  return map;
}

// ── 解約リストとの突合（週次レポート注入用）─────────────────────────────────────

/** 突合対象の解約企業（churn-retrospective の perCompany から必要分だけ抜いた形） */
export interface ChurnedForOverlap {
  sfAccountId:        string;
  canonicalName:      string | null;
  churnDate:          string;
  metabaseHasWarning: boolean;   // Downsell / 別PJ解約 / Trial 逆行 のいずれか
}

export interface SilentChurnOverlap {
  refMonth:            string;
  silentAccountCount:  number;   // スナップショット上の休眠アカウント総数
  churnTotal:          number;
  churnSilentCount:    number;   // 解約企業のうち休眠だった数
  overlapWithMetabase: number;   // うち Metabase 予兆と重複
  silentOnlyNewCount:  number;   // Metabase 未検知で休眠のみ検知（純新規）
  silentOnlyNew: Array<{
    companyName: string | null;
    sfAccountId: string;
    churnDate:   string;
    riskLevel:   string | null;
    portraitSequence: string | null;
  }>;
  /** 休眠アカウント全体のうち窓内で解約した割合（精度の目安。低いほど誤検知が多い）*/
  precision:           number;
}

/**
 * 休眠スナップショットと解約企業リストを突合する。
 * NOTE: スナップショットは refMonth 時点断面のため、解約後に休眠化した post-churn
 *   アーティファクトを含みうる。厳密な「解約前に休眠だったか」は月次 portrait の
 *   時系列照合が要る（本関数は naive な集合突合。プロンプト側で caveat を明示する）。
 */
export function computeSilentChurnOverlap(
  snap: ChronicSilentSnapshot | null,
  churned: ChurnedForOverlap[],
): SilentChurnOverlap | null {
  if (!snap) return null;
  const silentMap = buildSilentSfIdMap(snap);

  let churnSilentCount = 0;
  let overlapWithMetabase = 0;
  const silentOnlyNew: SilentChurnOverlap['silentOnlyNew'] = [];

  for (const c of churned) {
    const item = silentMap.get((c.sfAccountId ?? '').trim());
    if (!item) continue;
    churnSilentCount++;
    if (c.metabaseHasWarning) {
      overlapWithMetabase++;
    } else {
      silentOnlyNew.push({
        companyName:      c.canonicalName,
        sfAccountId:      c.sfAccountId,
        churnDate:        c.churnDate,
        riskLevel:        item.riskLevel,
        portraitSequence: item.portraitSequence,
      });
    }
  }

  const silentAccountCount = silentMap.size;
  return {
    refMonth:            snap.refMonth,
    silentAccountCount,
    churnTotal:          churned.length,
    churnSilentCount,
    overlapWithMetabase,
    silentOnlyNewCount:  silentOnlyNew.length,
    silentOnlyNew,
    precision:           silentAccountCount > 0 ? churnSilentCount / silentAccountCount : 0,
  };
}
