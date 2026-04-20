// ─── support_case_ai_state 正規化 helpers ──────────────────────────────────────
// NocoDB に送る値を正規化・検証するユーティリティ群。
// NocoDB に invalid value を送らないことが最優先。
// このファイルはサーバー・クライアント両側で import 可能（副作用なし）。

import type { SupportCaseAiSourceQueue } from './support-ai-state-types';
import type { SupportCaseAiStateRecord, RawSupportCaseAiState } from './support-ai-state-types';
import {
  SUPPORT_CASE_AI_SOURCE_QUEUES,
  SUPPORT_CASE_AI_CATEGORIES,
  SUPPORT_CASE_AI_SEVERITIES,
  SUPPORT_CASE_AI_CUSTOMER_INTENTS,
  SUPPORT_CASE_AI_PRODUCT_AREAS,
  SUPPORT_CASE_AI_ESCALATION_TARGETS,
  SUPPORT_CASE_AI_HUMAN_REVIEW_STATUSES,
  SUPPORT_CASE_AI_ROUTING_STATUSES,
  SUPPORT_CASE_AI_PRIORITIES,
} from './support-ai-state-types';

// ── DateTime 正規化 ───────────────────────────────────────────────────────────

/**
 * 任意の日時値を NocoDB DateTime 形式 `YYYY-MM-DD HH:MM:SS` に正規化する。
 * 変換できない場合は null を返す。
 *
 * 対応入力例:
 *   "2026-04-06T12:34:56.789Z" → "2026-04-06 12:34:56"
 *   "2026-04-06 12:34:56"      → そのまま
 *   "2026-04-06"               → "2026-04-06 00:00:00"
 *   new Date()                 → 変換
 */
export function toNocoDateTime(value: unknown): string | null {
  if (value == null) return null;

  let s: string;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    s = value.toISOString();
  } else {
    s = String(value).trim();
  }
  if (!s) return null;

  // すでに YYYY-MM-DD HH:MM:SS 形式
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s;

  // YYYY-MM-DD のみ
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s} 00:00:00`;

  // ISO 8601: 2026-04-06T12:34:56[.xxx][Z|+hh:mm]
  // → UTC に揃えたうえで YYYY-MM-DD HH:MM:SS へ変換
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const iso = d.toISOString(); // "2026-04-06T12:34:56.000Z"
      return iso.slice(0, 19).replace('T', ' ');
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * 現在時刻を NocoDB DateTime 形式で返す。
 */
export function nowNocoDateTime(): string {
  return toNocoDateTime(new Date()) ?? new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// ── Select 値バリデーション ────────────────────────────────────────────────────

/**
 * `value` が `allowedValues` に含まれれば `value as T` を返し、
 * 含まれなければ `fallback` を返す。
 * NocoDB の Single Select 列への書き込み時に使う。
 *
 * @example
 * toAllowedSelect(raw.severity, SUPPORT_CASE_AI_SEVERITIES, null)
 * // => 'high' | 'medium' | 'low' | 'critical' | null
 */
export function toAllowedSelect<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fallback: T | null,
): T | null {
  if (typeof value !== 'string') return fallback;
  const v = value.trim().toLowerCase() as T;
  return (allowedValues as readonly string[]).includes(v) ? v : fallback;
}

/**
 * source_queue 値を検証する。
 * 不正値は 'intercom' にフォールバック（最も一般的なソース）。
 */
export function toSourceQueue(value: unknown): SupportCaseAiSourceQueue {
  return toAllowedSelect(value, SUPPORT_CASE_AI_SOURCE_QUEUES, null) ?? 'intercom';
}

// ── LongText 正規化 ───────────────────────────────────────────────────────────

/**
 * 任意の値を LongText 文字列に変換する。
 * null / undefined → null（空で書き込まない）
 * オブジェクト / 配列 → JSON 文字列
 */
export function toLongText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value || null;
  return JSON.stringify(value);
}

// ── JSON Array 文字列 ─────────────────────────────────────────────────────────

/**
 * string[] または JSON 配列文字列を `["id1","id2"]` 形式の文字列に変換する。
 * 空配列の場合は `'[]'` を返す（NocoDB に送る際は空文字より明示的な方が望ましい）。
 */
export function toJsonArrayString(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
    } catch {
      // 文字列を単一要素として扱う
      if (value.trim()) return JSON.stringify([value]);
    }
  }
  return '[]';
}

/**
 * JSON 配列文字列から string[] に変換する（read 時に使う）。
 */
export function fromJsonArrayString(value: unknown): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// ── case_ai_id 生成 ───────────────────────────────────────────────────────────

/**
 * `source_queue` と `source_record_id` から安定した `case_ai_id` を生成する。
 * NocoDB での重複チェックには source_queue + source_record_id の複合キーを使うが、
 * case_ai_id は人間が識別するための補助 ID として使う。
 *
 * @example
 * buildCaseAiId('intercom', '12345') → 'intercom:12345'
 */
export function buildCaseAiId(sourceQueue: string, sourceRecordId: string): string {
  return `${sourceQueue}:${sourceRecordId}`;
}

// ── RawSupportCaseAiState → SupportCaseAiStateRecord 変換 ────────────────────

/**
 * NocoDB Raw レコードをアプリ domain 型に変換する。
 * 型安全な変換のため toAllowedSelect を使用し、
 * allowed values 外の値は null に変換する。
 */
export function toSupportCaseAiStateRecord(raw: RawSupportCaseAiState): SupportCaseAiStateRecord {
  const sourceQueue = toAllowedSelect(raw.source_queue, SUPPORT_CASE_AI_SOURCE_QUEUES, null) ?? 'intercom';
  const sourceRecordId = raw.source_record_id ? String(raw.source_record_id) : String(raw.Id);
  return {
    rowId:             raw.Id,
    caseAiId:          raw.case_ai_id ? String(raw.case_ai_id) : buildCaseAiId(sourceQueue, sourceRecordId),
    sourceQueue,
    sourceRecordId,
    companyUid:        raw.company_uid         ? String(raw.company_uid)         : null,
    sourceUpdatedAt:   raw.source_updated_at   ? String(raw.source_updated_at)   : null,
    lastAiUpdatedAt:   raw.last_ai_updated_at  ? String(raw.last_ai_updated_at)  : null,
    aiVersion:         raw.ai_version          ? String(raw.ai_version)          : null,
    aiSummary:         raw.ai_summary          ? String(raw.ai_summary)          : null,
    triageNote:        raw.triage_note         ? String(raw.triage_note)         : null,
    category:          toAllowedSelect(raw.category,         SUPPORT_CASE_AI_CATEGORIES,         null),
    severity:          toAllowedSelect(raw.severity,         SUPPORT_CASE_AI_SEVERITIES,         null),
    customerIntent:    toAllowedSelect(raw.customer_intent,  SUPPORT_CASE_AI_CUSTOMER_INTENTS,   null),
    productArea:       toAllowedSelect(raw.product_area,     SUPPORT_CASE_AI_PRODUCT_AREAS,      null),
    similarCaseIds:    fromJsonArrayString(raw.similar_case_ids),
    suggestedAction:   raw.suggested_action ? String(raw.suggested_action) : null,
    draftReply:        raw.draft_reply      ? String(raw.draft_reply)      : null,
    escalationNeeded:  raw.escalation_needed != null ? Boolean(raw.escalation_needed) : null,
    escalationReason:  raw.escalation_reason ? String(raw.escalation_reason) : null,
    escalationTarget:  toAllowedSelect(raw.escalation_target,   SUPPORT_CASE_AI_ESCALATION_TARGETS, null),
    humanReviewStatus: toAllowedSelect(raw.human_review_status, SUPPORT_CASE_AI_HUMAN_REVIEW_STATUSES, null) ?? 'pending',
    reviewedBy:        raw.reviewed_by ? String(raw.reviewed_by) : null,
    reviewedAt:        raw.reviewed_at ? String(raw.reviewed_at) : null,
    routingStatus:     toAllowedSelect(raw.routing_status, SUPPORT_CASE_AI_ROUTING_STATUSES, null),
    priority:          toAllowedSelect(raw.priority,       SUPPORT_CASE_AI_PRIORITIES,       null),
  };
}
