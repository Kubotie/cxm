// ─── AI 出力 → support_case_ai_state payload mapper ───────────────────────────
// AI の各推論結果（summary / triage / draft）を
// SupportCaseAiStatePayload に変換する。
//
// 設計方針:
//   - 各 AI 操作は独立して実行できる（summary のみ、triage のみ等）
//   - 実行された操作の結果だけが payload に反映される
//   - NocoDB に送る前に toAllowedSelect で値を必ず検証する
//   - severity は summary / triage どちらからでも来る（triage 優先）
//
// このファイルはサーバー・クライアント両側で import 可能（副作用なし）。

import type { SupportCaseAiStatePayload, SupportCaseAiSourceQueue } from '@/lib/nocodb/support-ai-state-types';
import {
  SUPPORT_CASE_AI_CATEGORIES,
  SUPPORT_CASE_AI_SEVERITIES,
  SUPPORT_CASE_AI_CUSTOMER_INTENTS,
  SUPPORT_CASE_AI_PRODUCT_AREAS,
  SUPPORT_CASE_AI_ESCALATION_TARGETS,
  SUPPORT_CASE_AI_ROUTING_STATUSES,
  SUPPORT_CASE_AI_PRIORITIES,
} from '@/lib/nocodb/support-ai-state-types';
import {
  toNocoDateTime,
  nowNocoDateTime,
  toAllowedSelect,
  toLongText,
  toJsonArrayString,
  buildCaseAiId,
} from '@/lib/nocodb/support-ai-state-helpers';
import type { SupportSummaryResult } from '@/lib/prompts/support-summary';
import type { SupportTriageResult } from '@/lib/prompts/support-triage';
import type { SupportDraftReplyResult } from '@/lib/prompts/support-draft-reply';

// ── 入力型 ────────────────────────────────────────────────────────────────────

/** ケース本体から必要な識別情報 */
export interface CaseAiStateSource {
  /** source_queue: 'intercom' | 'cse_ticket' */
  sourceQueue:      SupportCaseAiSourceQueue;
  /** NocoDB のレコード ID（case_id フィールドの値） */
  sourceRecordId:   string;
  /** 企業 UID（任意） */
  companyUid?:      string | null;
  /** 元ケースの更新日時（source_updated_at として保存） */
  sourceUpdatedAt?: string | null;
}

/** AI 推論結果群（各操作は任意） */
export interface AiRunResults {
  summary?:    SupportSummaryResult | null;
  triage?:     SupportTriageResult  | null;
  draftReply?: SupportDraftReplyResult | null;
  /** AI version 文字列 — デフォルト: 'support-ai-v1' */
  aiVersion?:  string;
  /** 生成日時（ISO 文字列） — デフォルト: 現在時刻 */
  generatedAt?: string;
}

// ── Severity 集約 helper ──────────────────────────────────────────────────────

/**
 * triage と summary の severity を統合する。
 * - triage が `critical` を追加している（summary は high/medium/low のみ）ので triage 優先
 * - どちらもなければ null
 */
/**
 * triage / summary の severity を統合する（triage 優先）。
 * どちらも invalid なら null を返す（呼び出し元で ?? 'medium' を適用する）。
 */
function mergeSeverity(
  triageSev:  string | undefined,
  summarySev: string | undefined,
): SupportCaseAiStatePayload['severity'] {
  return (
    toAllowedSelect(triageSev,  SUPPORT_CASE_AI_SEVERITIES, null) ??
    toAllowedSelect(summarySev, SUPPORT_CASE_AI_SEVERITIES, null)
  );
}

// ── Routing status 推定 ───────────────────────────────────────────────────────

/**
 * AI 結果から routing_status を推定する。
 * - escalation_needed = true → 'waiting_cse'
 * - triage 済み           → 'triage'
 * - それ以外              → 'new'
 */
function deriveRoutingStatus(
  triage: SupportTriageResult | null | undefined,
): SupportCaseAiStatePayload['routing_status'] {
  if (!triage) return toAllowedSelect('new', SUPPORT_CASE_AI_ROUTING_STATUSES, null);
  if (triage.escalation_needed) return toAllowedSelect('waiting_cse', SUPPORT_CASE_AI_ROUTING_STATUSES, null);
  return toAllowedSelect('triage', SUPPORT_CASE_AI_ROUTING_STATUSES, null);
}

// ── Priority 推定 ─────────────────────────────────────────────────────────────

/**
 * severity から priority を推定する。
 * critical → urgent, high → high, medium → normal, low → low
 */
function derivePriority(
  severity: SupportCaseAiStatePayload['severity'],
): SupportCaseAiStatePayload['priority'] {
  const map: Record<string, SupportCaseAiStatePayload['priority']> = {
    critical: toAllowedSelect('urgent', SUPPORT_CASE_AI_PRIORITIES, null),
    high:     toAllowedSelect('high',   SUPPORT_CASE_AI_PRIORITIES, null),
    medium:   toAllowedSelect('normal', SUPPORT_CASE_AI_PRIORITIES, null),
    low:      toAllowedSelect('low',    SUPPORT_CASE_AI_PRIORITIES, null),
  };
  return severity ? (map[severity] ?? null) : null;
}

// ── メイン mapper ─────────────────────────────────────────────────────────────

/**
 * ケース識別情報 + AI 推論結果群 → SupportCaseAiStatePayload
 *
 * @param source  ケース本体の識別情報
 * @param results 各 AI 操作の結果（未実行は undefined / null）
 * @returns NocoDB に送れる payload（human_review_status = 'pending' 固定）
 *
 * @example
 * const payload = buildSupportCaseAiStatePayload(
 *   { sourceQueue: 'intercom', sourceRecordId: case.id, companyUid: case.companyUid },
 *   { triage: triageResult, aiVersion: 'support-triage-v1' },
 * );
 * await upsertSupportCaseAiState(payload);
 */
export function buildSupportCaseAiStatePayload(
  source:  CaseAiStateSource,
  results: AiRunResults,
): SupportCaseAiStatePayload {
  const { summary, triage, draftReply } = results;
  const aiVersion  = results.aiVersion  ?? 'support-ai-v1';
  const generatedAt = nowNocoDateTime();
  const sourceUpdatedAt = toNocoDateTime(source.sourceUpdatedAt) ?? null;

  // severity: triage 優先、fallback は 'medium'
  const severity = mergeSeverity(triage?.severity, summary?.severity) ?? 'medium';
  // routing_status: fallback は 'triage'
  const routingStatus = deriveRoutingStatus(triage) ?? 'triage';
  // priority: severity から推定、fallback は 'normal'
  const priority = derivePriority(severity) ?? 'normal';

  // escalation_target: triage の suggested_team から推定。
  // escalation_needed かつ不明チーム → 'unknown'
  const escalationTarget = (() => {
    if (!triage?.escalation_needed) return null;
    const teamMap: Record<string, string> = {
      cse: 'cse', CSE: 'cse', billing: 'billing', Billing: 'billing',
    };
    const raw = teamMap[triage.suggested_team ?? ''] ?? null;
    return toAllowedSelect(raw, SUPPORT_CASE_AI_ESCALATION_TARGETS, null) ?? 'unknown';
  })();

  const payload: SupportCaseAiStatePayload = {
    // ── 識別系 ──────────────────────────────────────────────────────────────
    case_ai_id:           buildCaseAiId(source.sourceQueue, source.sourceRecordId),
    source_queue:         source.sourceQueue,
    source_record_id:     source.sourceRecordId,
    company_uid:          source.companyUid ?? null,

    // ── 元ケース追従系 ──────────────────────────────────────────────────────
    source_updated_at:    sourceUpdatedAt,
    last_ai_updated_at:   generatedAt,
    ai_version:           aiVersion,

    // ── AI 判断系（常に書き込む — 未生成フィールドも明示的な空値で記録） ──────
    ai_summary:       summary  ? toLongText(summary.ai_summary) : null,
    triage_note:      triage   ? toLongText(triage.triage_note) : null,
    suggested_action: triage   ? toLongText(triage.suggested_action) : null,

    // draft_reply は未生成でも必ず空文字で書き込む（null は使わない）
    draft_reply:      draftReply ? (toLongText(draftReply.draft_reply) ?? '') : '',

    // similar_case_ids は未検出でも必ず "[]" で書き込む（null / 空文字は不可）
    similar_case_ids: toJsonArrayString([]),

    // ── Single select: allowed values 外は fallback に固定 ───────────────────
    category:         toAllowedSelect(triage?.category,          SUPPORT_CASE_AI_CATEGORIES,       'uncategorized'),
    severity,
    customer_intent:  toAllowedSelect(summary?.customer_intent,  SUPPORT_CASE_AI_CUSTOMER_INTENTS,  'unknown'),
    product_area:     toAllowedSelect(summary?.product_area,     SUPPORT_CASE_AI_PRODUCT_AREAS,     'unknown'),
    routing_status:   routingStatus,
    priority,

    // ── エスカレーション ──────────────────────────────────────────────────────
    escalation_needed: triage?.escalation_needed ?? false,
    escalation_target: escalationTarget,
    escalation_reason: triage?.escalation_needed ? toLongText(triage.routing_reason) : null,

    // ── 人手レビュー系（AI 書き込み時は常に pending） ─────────────────────────
    human_review_status: 'pending',
    reviewed_by:         null,
    reviewed_at:         null,
  };

  return payload;
}

// ── 単一 AI 操作用 convenience builders ──────────────────────────────────────

/**
 * Summary のみの場合の convenience builder。
 * aiVersion が未指定の場合は 'support-summary-v1' を使う。
 */
export function buildSummaryOnlyPayload(
  source:   CaseAiStateSource,
  summary:  SupportSummaryResult,
  options?: { aiVersion?: string },
): SupportCaseAiStatePayload {
  return buildSupportCaseAiStatePayload(source, {
    summary,
    aiVersion: options?.aiVersion ?? 'support-summary-v1',
  });
}

/**
 * Triage のみの場合の convenience builder。
 * aiVersion が未指定の場合は 'support-triage-v1' を使う。
 */
export function buildTriageOnlyPayload(
  source:  CaseAiStateSource,
  triage:  SupportTriageResult,
  options?: { aiVersion?: string },
): SupportCaseAiStatePayload {
  return buildSupportCaseAiStatePayload(source, {
    triage,
    aiVersion: options?.aiVersion ?? 'support-triage-v1',
  });
}

/**
 * Draft Reply のみの場合の convenience builder。
 * aiVersion が未指定の場合は 'support-draft-v1' を使う。
 */
export function buildDraftOnlyPayload(
  source:     CaseAiStateSource,
  draftReply: SupportDraftReplyResult,
  options?:   { aiVersion?: string },
): SupportCaseAiStatePayload {
  return buildSupportCaseAiStatePayload(source, {
    draftReply,
    aiVersion: options?.aiVersion ?? 'support-draft-v1',
  });
}
