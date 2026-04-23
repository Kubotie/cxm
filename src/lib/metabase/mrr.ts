// ─── Metabase BI MRR データ取得 ────────────────────────────────────────────────
//
// https://bi.ptmind.com/public/question/ac9183fd-b0f0-497f-8d1c-55a3e037b330.csv
//
// CSV カラム（確認済み）:
//   Project ID, Count, Order Start Date (max), Order End Date (max),
//   Order End Date (min), Total MRR (max value), Total MRR (sum),
//   Payment Type (max), has_offline, has_online,
//   Order Term (min - months), Order Term (max - months), has_auto_renewal_contract
//
// キー: Project ID（project_info テーブルの project_id と突合する）
// 1時間キャッシュ（Next.js fetch cache）

const MRR_CSV_URL =
  'https://bi.ptmind.com/public/question/ac9183fd-b0f0-497f-8d1c-55a3e037b330.csv';

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
  const result = new Map<string, ProjectMrrData>();
  try {
    const res = await fetch(MRR_CSV_URL, {
      next: { revalidate: 3600 },  // 1時間キャッシュ
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
    const idxMrrSum    = headers.findIndex(h => h.includes('Total MRR') && h.toLowerCase().includes('sum'));
    const idxEndDate   = headers.findIndex(h => h.includes('Order End Date') && h.toLowerCase().includes('max'));
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
  } catch (e) {
    console.error('[metabase/mrr] CSV 取得エラー:', e);
  }
  return result;
}
