// ─── プロジェクト別モジュール利用（過去30日）───────────────────────────────
//
// https://bi.ptmind.com/public/question/ad154749-de47-4a86-b2a3-d818e1808297.csv
//
// CSV: Project ID, URL Module, URL Module Category, period_start, period_end, pageviews
//   1プロジェクト × 1モジュール = 1行。直近30日のPV。
//   実測（2026-08-22）: 10,525行 / 1,719プロジェクト / 191,265 PV
//
// **これが「今どう使われているか」の唯一の実測**。
// project-signals の `Pti History Heatmap Count` は契約開始からの累計なので、
// 「昔たくさん使ったが今は使っていない」を区別できなかった（実測で最大9,541件）。
//
// 判定の要:
//   1. **回遊を利用として数えない。** Project Homepage と PTI-Datacenter は
//      着地画面で、94%・46%が到達する。数えると全員が「使っている」になる。
//      実測で1,719PJ中478PJ（28%）が回遊のみ ＝ ログインして何もしていない。
//   2. **辞書に無いモジュールは捨てる。** 定義できていないものを指標にしない
//      （PTI-Heatmap / PTI-Homepage / PTX-V3 / PTX-Homepage。全PVの4.3%）。
//   3. **ヒートマップ閲覧そのものは計測できない。** PTI-PagesceneList は
//      リスト到達までで、閲覧は顧客ドメインへ遷移するため本データに出ない。
//      代替指標として扱い、UI にもそう書く。
//
// サーバーサイド専用。

import {
  moduleDef, isCountable, ACTIVE_SIGNAL_TYPES, DEEP_SIGNAL_TYPES,
  type ModuleDefinition,
} from '@/lib/metabase/module-dictionary';

const PROJECT_MODULES_CSV_URL =
  'https://bi.ptmind.com/public/question/ad154749-de47-4a86-b2a3-d818e1808297.csv';

// ── 型 ────────────────────────────────────────────────────────────────────────

export interface ModuleUsage {
  moduleId: string;
  def:      ModuleDefinition;
  pageviews: number;
}

export interface ProjectModuleData {
  projectId: string;
  periodStart: string | null;
  periodEnd:   string | null;

  /** 辞書にあり指標に使えるモジュールのみ。PV降順 */
  modules: ModuleUsage[];

  /** signalType → PV 合計 */
  pvBySignalType: Record<string, number>;
  /** product（Insight / Experience / 共通 / LP）→ PV 合計 */
  pvByProduct:    Record<string, number>;

  /** 回遊を除いた実質利用のPV */
  activePv:  number;
  /** 分析利用＋施策検証のPV（深さ） */
  deepPv:    number;
  /** 回遊も含めた総PV（辞書内のみ） */
  totalPv:   number;
  /** 実質利用のあるモジュール数（幅） */
  activeModuleCount: number;

  /** **回遊しかしていない＝ログインして何もしていない** */
  navigationOnly: boolean;

  /** A/Bテストを実際に運用している（PTX-ABTest の出現は強いシグナル） */
  runsAbTest: boolean;
  /** ヒートマップリストに到達した（閲覧そのものは計測外） */
  reachedHeatmapList: boolean;
  /** 無課金ユーザーがプランページを見た（トライアル→有料の検討） */
  viewedPlanAsFree: boolean;
  /** 有料ユーザーがプランページを見た（増減どちらの方向かは不明） */
  viewedPlanAsPaid: boolean;
  /** 決済完了（オンライン契約のみ。無いことは購入していない証拠にならない） */
  paidOnline: boolean;
  /** 提供終了プロダクト（旧 Page Studio）の特例提供先 */
  legacyLp: boolean;

  /** 辞書に無く捨てたPV。透明性のため保持する */
  droppedPv: number;
}

// ── キャッシュ ────────────────────────────────────────────────────────────────

let _cache:   Map<string, ProjectModuleData> | null = null;
let _cacheAt = 0;
let _inflight: Promise<Map<string, ProjectModuleData>> | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

export function getModuleCacheAge(): number | null {
  return _cache ? Date.now() - _cacheAt : null;
}

// ── 公開関数 ──────────────────────────────────────────────────────────────────

/**
 * Map<project_id, ProjectModuleData>。取得失敗時は空 Map（graceful degradation）。
 * モジュールデータが無くても既存の判定は動く必要がある。
 */
export async function fetchProjectModuleMap(
  opts: { force?: boolean } = {},
): Promise<Map<string, ProjectModuleData>> {
  if (!opts.force) {
    if (_cache && Date.now() - _cacheAt < CACHE_TTL_MS) return _cache;
    if (_inflight) return _inflight;
  }
  _inflight = load().finally(() => { _inflight = null; });
  return _inflight;
}

async function load(): Promise<Map<string, ProjectModuleData>> {
  const result = new Map<string, ProjectModuleData>();
  try {
    const res = await fetch(PROJECT_MODULES_CSV_URL, { cache: 'no-store', redirect: 'follow' });
    if (!res.ok) {
      console.warn(`[metabase/project-modules] CSV fetch failed: ${res.status}`);
      return _cache ?? result;
    }
    const text  = await res.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return result;

    const header = parseCsvLine(lines[0]);
    const IDX_ID    = header.indexOf('Project ID');
    const IDX_MOD   = header.indexOf('URL Module');
    const IDX_START = header.indexOf('period_start');
    const IDX_END   = header.indexOf('period_end');
    const IDX_PV    = header.indexOf('pageviews');
    if (IDX_ID < 0 || IDX_MOD < 0 || IDX_PV < 0) {
      console.warn('[metabase/project-modules] 想定した列が見つかりません:', header.join(','));
      return _cache ?? result;
    }

    // 一旦プロジェクトごとに素の行を集める
    const raw = new Map<string, { rows: Array<{ id: string; pv: number }>; dropped: number; s: string | null; e: string | null }>();
    for (let i = 1; i < lines.length; i++) {
      const f = parseCsvLine(lines[i]);
      const pid = f[IDX_ID];
      if (!pid) continue;
      const moduleId = f[IDX_MOD] ?? '';
      const pv = parseNum(f[IDX_PV]);

      let bucket = raw.get(pid);
      if (!bucket) {
        bucket = { rows: [], dropped: 0, s: f[IDX_START] ?? null, e: f[IDX_END] ?? null };
        raw.set(pid, bucket);
      }
      // 辞書に無い / 指標に使わないものは捨てるが、量は残す
      if (!isCountable(moduleId)) { bucket.dropped += pv; }
      bucket.rows.push({ id: moduleId, pv });
    }

    for (const [pid, b] of raw) result.set(pid, build(pid, b));

    _cache = result;
    _cacheAt = Date.now();
    return result;
  } catch (e) {
    console.warn('[metabase/project-modules] 取得に失敗:', e instanceof Error ? e.message : e);
    return _cache ?? result;
  }
}

function build(
  projectId: string,
  b: { rows: Array<{ id: string; pv: number }>; dropped: number; s: string | null; e: string | null },
): ProjectModuleData {
  const modules: ModuleUsage[] = [];
  const pvBySignalType: Record<string, number> = {};
  const pvByProduct:    Record<string, number> = {};
  let activePv = 0, deepPv = 0, totalPv = 0, activeModuleCount = 0;
  const present = new Set<string>();

  for (const r of b.rows) {
    present.add(r.id);
    const def = moduleDef(r.id);
    if (!def || !def.includeInApp) continue;

    modules.push({ moduleId: r.id, def, pageviews: r.pv });
    totalPv += r.pv;
    pvBySignalType[def.signalType] = (pvBySignalType[def.signalType] ?? 0) + r.pv;
    pvByProduct[def.product]       = (pvByProduct[def.product] ?? 0) + r.pv;

    if (ACTIVE_SIGNAL_TYPES.has(def.signalType)) {
      activePv += r.pv;
      if (r.pv > 0) activeModuleCount++;
    }
    if (DEEP_SIGNAL_TYPES.has(def.signalType)) deepPv += r.pv;
  }

  modules.sort((x, y) => y.pageviews - x.pageviews);

  return {
    projectId,
    periodStart: b.s,
    periodEnd:   b.e,
    modules,
    pvBySignalType,
    pvByProduct,
    activePv,
    deepPv,
    totalPv,
    activeModuleCount,
    // 回遊しか無い = 着地画面に来ただけ
    navigationOnly: totalPv > 0 && activePv === 0,
    runsAbTest:         present.has('PTX-ABTest'),
    reachedHeatmapList: present.has('PTI-PagesceneList'),
    viewedPlanAsFree:   present.has('Plan-New'),
    viewedPlanAsPaid:   present.has('Plan-Change'),
    paidOnline:         present.has('Pay-Success'),
    legacyLp:           [...present].some(id => id.startsWith('LP-')),
    droppedPv: b.dropped,
  };
}

// ── CSV パーサ（project-signals と同じ実装）──────────────────────────────────

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
    else current += ch;
  }
  fields.push(current.trim());
  return fields;
}

function parseNum(v: string | undefined): number {
  const n = parseFloat(v ?? '');
  return isNaN(n) ? 0 : n;
}
