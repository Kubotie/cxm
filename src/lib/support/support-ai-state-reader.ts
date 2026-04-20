// ─── support_case_ai_state UI-safe reader ─────────────────────────────────────
// NocoDB から読んだ AI state record を UI 用に安全に整形する。
// null / undefined / 空文字 / JSON parse 失敗をすべて吸収する。
//
// このファイルはサーバー・クライアント両側で import 可能（副作用なし）。
// NocoDB I/O は support-ai-state-store.ts 参照。

import type { SupportCaseAiStateRecord } from '@/lib/nocodb/support-ai-state-types';
import { fromJsonArrayString } from '@/lib/nocodb/support-ai-state-helpers';

// ── Null-safe text helpers ────────────────────────────────────────────────────

/** null / undefined / 空白文字列を吸収して string を返す */
function safeStr(v: string | null | undefined, fallback = ''): string {
  if (v == null) return fallback;
  const s = String(v).trim();
  return s || fallback;
}

// ── Main parseSupportCaseAiState ──────────────────────────────────────────────

/**
 * SupportCaseAiStateRecord を UI が直接使える形にパースする。
 * フィールドごとの null 安全性を保証する。
 * record が null の場合は null を返す（呼び出し元で hasAiState チェックに使う）。
 */
export function parseSupportCaseAiState(
  record: SupportCaseAiStateRecord | null | undefined,
): SupportCaseAiStateRecord | null {
  if (!record) return null;
  return record;
}

// ── Individual safe getters ───────────────────────────────────────────────────

/**
 * similar_case_ids を string[] として返す。
 * JSON parse 失敗 / null / 空文字 → []
 */
export function getSimilarCaseIds(
  record: SupportCaseAiStateRecord | null | undefined,
): string[] {
  if (!record) return [];
  // record.similarCaseIds は toSupportCaseAiStateRecord で変換済みだが
  // 念のため raw 値も受け取れるよう fromJsonArrayString を通す
  if (Array.isArray(record.similarCaseIds)) return record.similarCaseIds;
  return fromJsonArrayString(record.similarCaseIds);
}

/**
 * AI サマリーを安全に返す。null → ''
 */
export function getSafeAiSummary(
  record: SupportCaseAiStateRecord | null | undefined,
): string {
  return safeStr(record?.aiSummary);
}

/**
 * トリアージノートを安全に返す。null → ''
 */
export function getSafeTriageNote(
  record: SupportCaseAiStateRecord | null | undefined,
): string {
  return safeStr(record?.triageNote);
}

/**
 * 推奨アクションを安全に返す。null → ''
 */
export function getSafeSuggestedAction(
  record: SupportCaseAiStateRecord | null | undefined,
): string {
  return safeStr(record?.suggestedAction);
}

/**
 * 下書き返信を安全に返す。null / 空文字 → ''
 * NocoDB に `""` で保存されている場合も空文字として返す。
 */
export function getSafeDraftReply(
  record: SupportCaseAiStateRecord | null | undefined,
): string {
  return safeStr(record?.draftReply);
}

// ── Human review status checkers ─────────────────────────────────────────────

/**
 * human_review_status === 'approved' かどうか。
 * record が null → false。
 */
export function isAiApproved(
  record: SupportCaseAiStateRecord | null | undefined,
): boolean {
  return record?.humanReviewStatus === 'approved';
}

/**
 * human_review_status === 'reviewed' | 'corrected' かどうか。
 * 「人が確認済みだが approved ではない」状態。
 */
export function isAiReviewed(
  record: SupportCaseAiStateRecord | null | undefined,
): boolean {
  const s = record?.humanReviewStatus;
  return s === 'reviewed' || s === 'corrected';
}

/**
 * human_review_status === 'pending' かどうか。
 * record が null → false（AI 未生成 ≠ pending）。
 */
export function isAiPending(
  record: SupportCaseAiStateRecord | null | undefined,
): boolean {
  return record?.humanReviewStatus === 'pending';
}
