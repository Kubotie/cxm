// ─── Unified Log 派生テーブルへの write helper ────────────────────────────────
// unified_log_signal_state への upsert を担当する。
//
// ルール:
//   - primary key: company_uid（1企業につき1レコード）
//   - 配列フィールドは JSON 文字列として保存（NocoDB flat table 制約）
//   - 保護条件: human_review_status が approved / locked / finalized の場合は上書きしない

import { TABLE_IDS } from './client';
import { nocoCreate, nocoUpdate } from './write';
import type { RawUnifiedLogSignalState } from './types';

// ── 結果型（support-write.ts と同じ discriminated union） ────────────────────

export type SaveResult =
  | { ok: true;  created: boolean }
  | { ok: false; skipped: true;  reason: string }
  | { ok: false; skipped: false; error: string };

// ── 保護ステータス ─────────────────────────────────────────────────────────────

const PROTECTED_STATUSES = new Set(['approved', 'locked', 'finalized']);

// ── write payload 型 ──────────────────────────────────────────────────────────

/** unified_log_signal_state テーブルへの upsert ペイロード */
export interface UnifiedLogSignalStateWritePayload {
  company_uid:                    string;
  /** SignalItem[] を JSON 文字列化 */
  key_signals:                    string;
  /** RiskSignalItem[] を JSON 文字列化 */
  risk_signals:                   string;
  /** OpportunitySignalItem[] を JSON 文字列化 */
  opportunity_signals:            string;
  /** MissingInfoItem[] を JSON 文字列化 */
  missing_information:            string;
  recommended_next_review_focus:  string;
  generated_by:                   string;
  generated_at:                   string;
  last_ai_updated_at:             string;
  log_count:                      number;
}

// ── 定数 ─────────────────────────────────────────────────────────────────────

const API_TOKEN = process.env.NOCODB_API_TOKEN ?? '';
const BASE_URL  = process.env.NOCODB_BASE_URL  ?? 'https://odtable.ptmind.ai';

// ── メイン helper ─────────────────────────────────────────────────────────────

/**
 * company_uid をキーに unified_log_signal_state を upsert する。
 * 既存レコードがあれば update、なければ create。
 * human_review_status が approved / locked / finalized の場合は上書きをスキップする。
 */
export async function saveUnifiedLogSignalState(
  payload: UnifiedLogSignalStateWritePayload,
): Promise<SaveResult> {
  const tableId = TABLE_IDS.unified_log_signal_state;
  if (!tableId) {
    return {
      ok: false,
      skipped: false,
      error: 'NOCODB_UNIFIED_LOG_SIGNAL_STATE_TABLE_ID が未設定です。.env.local に追加してください。',
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

  const { list } = await searchRes.json() as { list: RawUnifiedLogSignalState[] };

  // 2. 既存あり → 保護条件チェック → update
  if (list.length > 0) {
    const status = list[0].human_review_status ?? null;
    if (status && PROTECTED_STATUSES.has(status)) {
      return {
        ok: false,
        skipped: true,
        reason: `human_review_status が ${status} のため上書きをスキップしました`,
      };
    }
    await nocoUpdate<RawUnifiedLogSignalState>(tableId, list[0].Id, payload);
    return { ok: true, created: false };
  }

  // 3. 既存なし → create
  await nocoCreate<RawUnifiedLogSignalState>(tableId, payload);
  return { ok: true, created: true };
}
