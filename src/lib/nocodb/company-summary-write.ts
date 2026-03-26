// ─── Company Summary 派生テーブルへの write helper ────────────────────────────
// company_summary_state への upsert を担当する。
//
// ルール:
//   - primary key: company_uid（1企業につき1レコード）
//   - 配列フィールドは JSON 文字列として保存（NocoDB flat table 制約）
//   - 保護条件: human_review_status が approved / locked / finalized の場合は上書きしない
//   - human_review_status:
//       新規作成時は必ず "pending" を設定
//       更新時は既存値がなければ "pending" を補完（既存値がある場合はそのまま保持）

import { TABLE_IDS } from './client';
import { nocoCreate, nocoUpdate } from './write';
import type { RawCompanySummaryState } from './types';

// ── 結果型（unified-log-write.ts / support-write.ts と同じ discriminated union） ─

export type SaveResult =
  | { ok: true;  created: boolean }
  | { ok: false; skipped: true;  reason: string }
  | { ok: false; skipped: false; error: string };

// ── ステータス定数 ─────────────────────────────────────────────────────────────

const PROTECTED_STATUSES = new Set(['approved', 'locked', 'finalized']);
const DEFAULT_STATUS = 'pending';

// ── write payload 型 ──────────────────────────────────────────────────────────

/** company_summary_state テーブルへの upsert ペイロード */
export interface CompanySummaryStateWritePayload {
  company_uid:             string;
  summary:                 string;
  overall_health:          string;
  /** RiskItem[] を JSON 文字列化 */
  key_risks:               string;
  /** OpportunityItem[] を JSON 文字列化 */
  key_opportunities:       string;
  recommended_next_action: string;
  generated_by:            string;
  generated_at:            string;
  last_ai_updated_at:      string;
  evidence_count:          number;
  alert_count:             number;
  people_count:            number;
}

// ── 定数 ─────────────────────────────────────────────────────────────────────

const API_TOKEN = process.env.NOCODB_API_TOKEN ?? '';
const BASE_URL  = process.env.NOCODB_BASE_URL  ?? 'https://odtable.ptmind.ai';

// ── メイン helper ─────────────────────────────────────────────────────────────

/**
 * company_uid をキーに company_summary_state を upsert する。
 * - 既存レコードあり → human_review_status が protected なら skip、そうでなければ update
 *   （既存の human_review_status が null/空の場合は "pending" を補完）
 * - 既存レコードなし → create（human_review_status = "pending" を必ず設定）
 */
export async function saveCompanySummaryState(
  payload: CompanySummaryStateWritePayload,
): Promise<SaveResult> {
  const tableId = TABLE_IDS.company_summary_state;
  if (!tableId) {
    return {
      ok: false,
      skipped: false,
      error: 'NOCODB_COMPANY_SUMMARY_STATE_TABLE_ID が未設定です。.env.local に追加してください。',
    };
  }

  // 1. 既存レコードを company_uid で検索
  const where = `(company_uid,eq,${payload.company_uid})`;
  const searchUrl = new URL(`${BASE_URL}/api/v2/tables/${tableId}/records`);
  searchUrl.searchParams.set('where', where);
  searchUrl.searchParams.set('limit', '1');

  const searchRes = await fetch(searchUrl.toString(), {
    headers: { 'xc-token': API_TOKEN },
    cache: 'no-store',
  });

  if (!searchRes.ok) {
    return {
      ok: false,
      skipped: false,
      error: `NocoDB lookup ${searchRes.status}: ${searchRes.statusText}`,
    };
  }

  const { list } = await searchRes.json() as { list: RawCompanySummaryState[] };

  // 2. 既存あり → 保護条件チェック → update
  if (list.length > 0) {
    const existing = list[0];
    const status = existing.human_review_status ?? null;

    if (status && PROTECTED_STATUSES.has(status)) {
      return {
        ok: false,
        skipped: true,
        reason: `human_review_status が ${status} のため上書きをスキップしました`,
      };
    }

    // 既存の human_review_status がなければ "pending" を補完
    const human_review_status = status || DEFAULT_STATUS;
    await nocoUpdate<RawCompanySummaryState>(tableId, existing.Id, {
      ...payload,
      human_review_status,
    });
    return { ok: true, created: false };
  }

  // 3. 既存なし → create（human_review_status = "pending" を必ず設定）
  await nocoCreate<RawCompanySummaryState>(tableId, {
    ...payload,
    human_review_status: DEFAULT_STATUS,
  });
  return { ok: true, created: true };
}
