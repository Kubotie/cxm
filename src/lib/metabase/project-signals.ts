// ─── Metabase BI プロジェクトシグナルデータ ──────────────────────────────────
//
// https://bi.ptmind.com/public/question/fd240d36-5044-456f-968c-f675f37b829c.csv
//
// CSV カラム（確認済み、インデックス順）:
//   0:  Master Account Email
//   1:  Project ID
//   2:  Paid Type
//   3:  Project Name
//   4:  Pti History Heatmap Count         — ヒートマップ実施数
//   5:  Running Campaign With Goal Count  — 実行中キャンペーン数（目標付き）
//   6:  L30 Active                        — 過去30日アクティブイベント数（ローリング）
//   7:  L7 Event Count                    — 今週イベント数
//   8:  First Cv Create Date
//   9:  First Event Create Date
//   10: First History Heatmap Create Date — ヒートマップ初回日
//   11: Master Company Sf ID
//   12: Master Company Name
//   13: Customer Type
//   14: Habituation Status
//   15-27: Order集計...
//   28: Pv Ceiling                        — PV上限
//   29: Month Period Pv Forecast          — 当月PV予測
//   30: Month Period Start Time
//   31: Month Period End Time
//   32-47: First Order Start Date, Domain, ...
//   48: Last Active Date                  — 最終活動日
//   49: ... (Tier)
//   50: Paid Status
//
// キー: Project ID
// プロセスメモリキャッシュ（1時間）

const PROJECT_SIGNALS_CSV_URL =
  'https://bi.ptmind.com/public/question/fd240d36-5044-456f-968c-f675f37b829c.csv';

// ── 型定義 ────────────────────────────────────────────────────────────────────

export interface ProjectSignalData {
  /** プロジェクト名 */
  projectName:                    string;
  /** 有料タイプ */
  paidType:                       string | null;
  /** 実行中キャンペーン数（目標付き） */
  runningCampaignWithGoalCount:   number;
  /** ヒートマップ実施数（History Heatmap） */
  heatmapCount:                   number;
  /** ヒートマップ初回利用日（YYYY-MM-DD, 未実施なら null） */
  firstHeatmapDate:               string | null;
  /** PV上限（プランで設定された上限値） */
  pvCeiling:                      number | null;
  /** 当月 PV 実績値（Month Period Pv Count） */
  monthPvCount:                   number | null;
  /** 過去30日アクティブイベント数（ローリング） */
  l30Active:                      number;
  /** 今週イベント数 */
  l7EventCount:                   number;
  /** 最終活動日（YYYY-MM-DD） */
  lastActiveDate:                 string | null;
  /** 当月 PV 集計期間終了日（YYYY-MM-DD）。PV 上限残日数の計算に使う */
  monthPeriodEndTime:             string | null;
  /** Salesforce Master Company SF ID（企業への逆引き用） */
  masterCompanySfId:              string | null;
}

// ── キャッシュ ────────────────────────────────────────────────────────────────

let _cache:   Map<string, ProjectSignalData> | null = null;
let _cacheAt: number = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1時間

// ── CSV パーサ ────────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseNum(v: string | undefined): number {
  const n = parseFloat(v ?? '');
  return isNaN(n) ? 0 : n;
}

function parseDate(v: string | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s || s === '' || s === 'null') return null;
  return s.slice(0, 10) || null;
}

// ── 公開関数 ──────────────────────────────────────────────────────────────────

/**
 * Metabase CSV を取得し、Map<project_id, ProjectSignalData> を返す。
 * 取得失敗時は空 Map（graceful degradation）。
 */
export async function fetchProjectSignalMap(): Promise<Map<string, ProjectSignalData>> {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL_MS) return _cache;

  const result = new Map<string, ProjectSignalData>();
  try {
    const res = await fetch(PROJECT_SIGNALS_CSV_URL, { cache: 'no-store' });
    if (!res.ok) {
      console.warn(`[metabase/project-signals] CSV fetch failed: ${res.status}`);
      return _cache ?? result;
    }
    const text  = await res.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return result;

    // ヘッダー行でインデックス確認
    const header = parseCsvLine(lines[0]);
    const IDX_ID          = header.indexOf('Project ID');
    const IDX_NAME        = header.indexOf('Project Name');
    const IDX_PAID_TYPE   = header.indexOf('Paid Type');
    const IDX_HEATMAP_CNT = header.indexOf('Pti History Heatmap Count');
    const IDX_CAMPAIGN    = header.indexOf('Running Campaign With Goal Count');
    const IDX_L30         = header.indexOf('L30 Active');
    const IDX_L7          = header.indexOf('L7 Event Count');
    const IDX_HEATMAP_DT  = header.indexOf('First History Heatmap Create Date');
    const IDX_PV_CEIL     = header.indexOf('Pv Ceiling');
    const IDX_PV_FORECAST = header.indexOf('Month Period Pv Count');
    const IDX_PV_END      = header.indexOf('Month Period End Time');
    const IDX_LAST_ACT    = header.indexOf('Last Active Date');
    const IDX_SF_ID       = header.indexOf('Master Company Sf ID');

    if (IDX_ID < 0) {
      console.warn('[metabase/project-signals] "Project ID" カラムが見つかりません', header.slice(0, 5));
      return _cache ?? result;
    }

    for (let i = 1; i < lines.length; i++) {
      const f = parseCsvLine(lines[i]);
      const projectId = f[IDX_ID];
      if (!projectId) continue;

      result.set(projectId, {
        projectName:                  f[IDX_NAME]        ?? '',
        paidType:                     f[IDX_PAID_TYPE]   || null,
        runningCampaignWithGoalCount: parseNum(f[IDX_CAMPAIGN]),
        heatmapCount:                 parseNum(f[IDX_HEATMAP_CNT]),
        firstHeatmapDate:             parseDate(f[IDX_HEATMAP_DT]),
        pvCeiling:                    parseNum(f[IDX_PV_CEIL]) || null,
        monthPvCount:                 parseNum(f[IDX_PV_FORECAST]) || null,
        monthPeriodEndTime:           parseDate(f[IDX_PV_END]),
        l30Active:                    parseNum(f[IDX_L30]),
        l7EventCount:                 parseNum(f[IDX_L7]),
        lastActiveDate:               parseDate(f[IDX_LAST_ACT]),
        masterCompanySfId:            f[IDX_SF_ID] || null,
      });
    }

    _cache   = result;
    _cacheAt = Date.now();
    console.log(`[metabase/project-signals] CSV ロード完了: ${result.size} プロジェクト`);
  } catch (e) {
    console.error('[metabase/project-signals] CSV 取得エラー:', e);
    if (_cache) return _cache;
  }
  return result;
}
