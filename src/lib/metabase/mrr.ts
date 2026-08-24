// ─── Metabase BI MRR データ取得 ────────────────────────────────────────────────
//
// https://bi.ptmind.com/public/question/ac9183fd-b0f0-497f-8d1c-55a3e037b330.csv
//
// CSV カラム（実際の Metabase 出力 — ロケールにより日本語混じりになる）:
//   Project ID, カウント,
//   Order Start Date: Dayの最大値, Order End Date: Dayの最大値, Order End Date: Dayの最小値,
//   Total Mrrの最大値, Total Mrrの合計値,
//   Payment Typeの最大値, has_offline, has_online,
//   Order Termの最小値, Order Termの最大値, has_auto_renewal_contract
//
// キー: Project ID（project_info テーブルの project_id と突合する）
//
// ── キャッシュ戦略 ────────────────────────────────────────────────────────────
// CSV は 51KB / 625行と小さいが、Metabase がクエリを毎回ライブ実行するため取得に
// 15〜20秒かかる。no-store のままだと Promise.all 全体をこの秒数ブロックしていた。
// → unstable_cache（Data Cache）で結果をラップし、stale-while-revalidate で運用する。
//   revalidate 経過後は「古い値を即返す + 背景で再取得」となり、ユーザーは待たされない。
//   データは1日1回更新のため 12h revalidate で十分。手動更新は revalidateTag('metabase-mrr')。

import { unstable_cache } from 'next/cache';

const MRR_CSV_URL =
  'https://bi.ptmind.com/public/question/ac9183fd-b0f0-497f-8d1c-55a3e037b330.csv';

/** Data Cache の revalidate 秒数（12時間）。1日1回更新のデータに対し SWR で運用 */
const MRR_CACHE_TTL_S = 12 * 60 * 60;
/** 手動無効化用タグ（revalidateTag('metabase-mrr') で即再取得） */
export const MRR_CACHE_TAG = 'metabase-mrr';

export interface ProjectMrrData {
  projectId:      string;
  /** Total MRR (sum) — プロジェクトの現在の MRR 合計 */
  mrr:            number;
  /** Order End Date (max) — 最新契約終了日（YYYY-MM-DD または null） */
  orderEndDate:   string | null;
  hasAutoRenewal: boolean;
}

/** CSV の1行をフィールド配列に分解する（クォート対応）*/
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

/**
 * Metabase CSV を取得・パースして [projectId, ProjectMrrData][] を返す（内部用）。
 * unstable_cache でラップするため、Map ではなく直列化可能な配列を返す。
 * 取得失敗時は throw する（unstable_cache が SWR で直前の成功値を返し続けられるように）。
 */
async function loadMrrEntries(): Promise<[string, ProjectMrrData][]> {
  // unstable_cache 内部なので fetch は no-store でよい（結果は Data Cache 側で保持される）
  const res = await fetch(MRR_CSV_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`[metabase/mrr] CSV fetch failed: ${res.status}`);
  }
  const text = await res.text();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const idxId        = headers.indexOf('Project ID');
  // Metabase のロケール設定により英語 ("Total MRR (sum)") または日本語 ("Total Mrrの合計値") が混在
  const idxMrrSum    = headers.findIndex(h =>
    (h.includes('Total MRR') || h.includes('Total Mrr')) &&
    (h.toLowerCase().includes('sum') || h.includes('合計')),
  );
  const idxEndDate   = headers.findIndex(h =>
    h.includes('Order End Date') &&
    (h.toLowerCase().includes('max') || h.includes('最大')),
  );
  const idxAutoRenew = headers.indexOf('has_auto_renewal_contract');

  if (idxId < 0 || idxMrrSum < 0) {
    throw new Error(`[metabase/mrr] 必須カラムが見つかりません: ${headers.join('|')}`);
  }

  const entries: [string, ProjectMrrData][] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const projectId = fields[idxId];
    if (!projectId) continue;

    // MRR: カンマ区切りの数値文字列（例: "148,104"）を正規化
    const mrrRaw = fields[idxMrrSum]?.replace(/[,\s¥]/g, '') ?? '';
    const mrr = parseFloat(mrrRaw) || 0;

    const orderEndDate = idxEndDate >= 0
      ? (fields[idxEndDate]?.slice(0, 10) || null)
      : null;

    const hasAutoRenewal = idxAutoRenew >= 0
      ? fields[idxAutoRenew]?.toLowerCase() === 'true'
      : false;

    entries.push([projectId, { projectId, mrr, orderEndDate, hasAutoRenewal }]);
  }
  return entries;
}

/** unstable_cache でラップした loader（SWR）。ビルド時のみ生成 */
const cachedMrrEntries = unstable_cache(
  loadMrrEntries,
  ['metabase-mrr-v1'],
  { revalidate: MRR_CACHE_TTL_S, tags: [MRR_CACHE_TAG] },
);

// プロセスメモリキャッシュ。unstable_cache は request 文脈外（instrumentation の暖機など）
// では使えないため、そのフォールバック兼ウォームアップ先として保持する。
let _procCache: Map<string, ProjectMrrData> | null = null;
let _procAt = 0;
const MRR_PROC_TTL_MS = MRR_CACHE_TTL_S * 1000;

async function loadMrrMapDirect(): Promise<Map<string, ProjectMrrData>> {
  const map = new Map(await loadMrrEntries());
  _procCache = map;
  _procAt = Date.now();
  return map;
}

/**
 * 起動時（instrumentation）に呼ぶウォームアップ。
 * unstable_cache を経由せず直接ロードし、プロセスキャッシュを温める。
 * request 文脈外でも安全（incrementalCache に依存しない）。
 */
export async function warmMrrCache(): Promise<void> {
  try {
    await loadMrrMapDirect();
  } catch (e) {
    console.warn('[metabase/mrr] warmup 失敗（非致命）:', e);
  }
}

/**
 * Metabase CSV から Map<project_id, ProjectMrrData> を返す。
 * request 文脈では unstable_cache（SWR）を使い、revalidate 経過後も待たされない。
 * request 文脈外や Data Cache 不可時はプロセスキャッシュ／直接ロードにフォールバックする。
 * 取得失敗時は空 Map（graceful degradation）。
 */
export async function fetchProjectMrrMap(): Promise<Map<string, ProjectMrrData>> {
  try {
    const map = new Map(await cachedMrrEntries());
    _procCache = map;
    _procAt = Date.now();
    return map;
  } catch {
    // unstable_cache が使えない文脈（instrumentation 等）: プロセスキャッシュ or 直接ロード
    if (_procCache && Date.now() - _procAt < MRR_PROC_TTL_MS) return _procCache;
    try {
      return await loadMrrMapDirect();
    } catch (e2) {
      console.error('[metabase/mrr] CSV 取得エラー:', e2);
      return _procCache ?? new Map();
    }
  }
}
