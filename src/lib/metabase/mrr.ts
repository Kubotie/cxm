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
// CSVが2MB超で Next.js fetch cache の上限を超えるため、プロセスメモリキャッシュを使用する。

const MRR_CSV_URL =
  'https://bi.ptmind.com/public/question/ac9183fd-b0f0-497f-8d1c-55a3e037b330.csv';

// プロセスメモリキャッシュ（Next.js fetch cache の2MB上限回避）
let _cache: Map<string, ProjectMrrData> | null = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1時間

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
 * Metabase CSV を取得し、Map<project_id, ProjectMrrData> を返す。
 * 取得失敗時は空 Map（graceful degradation）。
 */
export async function fetchProjectMrrMap(): Promise<Map<string, ProjectMrrData>> {
  // メモリキャッシュヒット
  if (_cache && Date.now() - _cacheAt < CACHE_TTL_MS) return _cache;

  const result = new Map<string, ProjectMrrData>();
  try {
    const res = await fetch(MRR_CSV_URL, {
      cache: 'no-store',  // Next.js fetch cache はサイズ上限のためスキップ。プロセスキャッシュで代替。
    });
    if (!res.ok) {
      console.warn(`[metabase/mrr] CSV fetch failed: ${res.status}`);
      return result;
    }
    const text = await res.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return result;

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
      console.warn('[metabase/mrr] 必須カラムが見つかりません', headers);
      return result;
    }

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

      result.set(projectId, { projectId, mrr, orderEndDate, hasAutoRenewal });
    }
    _cache = result;
    _cacheAt = Date.now();
  } catch (e) {
    console.error('[metabase/mrr] CSV 取得エラー:', e);
    if (_cache) return _cache;
  }
  return result;
}
