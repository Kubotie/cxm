// ─── Company Summary 派生テーブルへの write helper ────────────────────────────
// company_summary_state への upsert を担当する。
//
// ルール:
//   - upsert キー: company_uid + summary_type（複合）
//   - summary_type のデフォルト: "default"
//   - 配列フィールドは JSON 文字列として保存（NocoDB flat table 制約）
//   - 保護条件: human_review_status === 'approved' の場合は上書きしない
//   - 新規作成時: human_review_status = 'pending' を設定
//   - 更新時: human_review_status が null/空の場合は 'pending' を補完（既存値は保持）

import { TABLE_IDS, nocoFetch } from './client';
import { nocoCreate, nocoUpdate } from './write';
import type { RawCompanySummaryState } from './types';

// ── 結果型 ────────────────────────────────────────────────────────────────────

export type SaveResult =
  | { ok: true;  created: boolean }
  | { ok: false; skipped: true;  reason: string }
  | { ok: false; skipped: false; error: string };

// ── 定数 ─────────────────────────────────────────────────────────────────────

const PROTECTED_STATUS = 'approved';
const DEFAULT_STATUS   = 'pending';
const DEFAULT_TYPE     = 'default';

// ── write payload 型 ──────────────────────────────────────────────────────────

/** company_summary_state テーブルへの upsert ペイロード */
export interface CompanySummaryStateWritePayload {
  company_uid:             string;
  summary_type?:           string;         // default: "default"
  ai_summary:              string;
  overall_health:          string;
  /** RiskItem[] を JSON 文字列化 */
  key_risks:               string;
  /** OpportunityItem[] を JSON 文字列化 */
  key_opportunities:       string;
  recommended_next_action: string;
  model:                   string;
  ai_version:              string;
  source_updated_at?:      string | null;
  last_ai_updated_at:      string;
  evidence_count:          number;
  alert_count:             number;
  people_count:            number;
}

// ── メイン helper ─────────────────────────────────────────────────────────────

/**
 * company_uid + summary_type をキーに company_summary_state を upsert する。
 * - 既存あり → approved なら skip、そうでなければ update
 * - 既存なし → create（human_review_status = 'pending'）
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

  const summaryType = payload.summary_type ?? DEFAULT_TYPE;

  // 1. 既存レコードを company_uid + summary_type で検索
  const where = `(company_uid,eq,${payload.company_uid})~and(summary_type,eq,${summaryType})`;

  let existingList: RawCompanySummaryState[];
  try {
    existingList = await nocoFetch<RawCompanySummaryState>(tableId, {
      where,
      limit: '1',
    });
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // 2. 既存あり → 保護条件チェック → update
  if (existingList.length > 0) {
    const existing = existingList[0];
    const status   = existing.human_review_status ?? null;

    if (status === PROTECTED_STATUS) {
      return {
        ok: false,
        skipped: true,
        reason: `human_review_status が approved のため上書きをスキップしました`,
      };
    }

    const human_review_status = status || DEFAULT_STATUS;
    try {
      await nocoUpdate<RawCompanySummaryState>(tableId, existing.Id, {
        ...payload,
        summary_type:         summaryType,
        human_review_status,
      });
    } catch (err) {
      return {
        ok: false,
        skipped: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    return { ok: true, created: false };
  }

  // 3. 既存なし → create
  try {
    await nocoCreate<RawCompanySummaryState>(tableId, {
      ...payload,
      summary_type:         summaryType,
      human_review_status:  DEFAULT_STATUS,
    });
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  return { ok: true, created: true };
}
