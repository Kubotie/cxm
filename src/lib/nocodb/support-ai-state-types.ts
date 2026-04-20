// ─── support_case_ai_state 型定義 ─────────────────────────────────────────────
// NocoDB テーブル: support_case_ai_state
// キー: source_queue + source_record_id（複合 upsert キー）
//
// このファイルはサーバー・クライアント両側で import 可能（副作用なし）。
// NocoDB write helpers は support-ai-state-store.ts 参照。

// ── Enum union types ───────────────────────────────────────────────────────────

/** source_queue — ソーステーブル識別子 */
export type SupportCaseAiSourceQueue = 'intercom' | 'cse_ticket';

export const SUPPORT_CASE_AI_SOURCE_QUEUES: SupportCaseAiSourceQueue[] = [
  'intercom',
  'cse_ticket',
];

/** category — AI 判定カテゴリ */
export type SupportCaseAiCategory =
  | 'support'
  | 'billing'
  | 'inquiry'
  | 'mail'
  | 'system'
  | 'cse_ticket'
  | 'uncategorized';

export const SUPPORT_CASE_AI_CATEGORIES: SupportCaseAiCategory[] = [
  'support', 'billing', 'inquiry', 'mail', 'system', 'cse_ticket', 'uncategorized',
];

/** severity — AI 判定深刻度 */
export type SupportCaseAiSeverity = 'low' | 'medium' | 'high' | 'critical';

export const SUPPORT_CASE_AI_SEVERITIES: SupportCaseAiSeverity[] = [
  'low', 'medium', 'high', 'critical',
];

/** customer_intent — 顧客の意図 */
export type SupportCaseAiCustomerIntent =
  | 'ask_question'
  | 'report_issue'
  | 'request_change'
  | 'request_cancellation'
  | 'request_quote'
  | 'confirm_status'
  | 'unknown';

export const SUPPORT_CASE_AI_CUSTOMER_INTENTS: SupportCaseAiCustomerIntent[] = [
  'ask_question', 'report_issue', 'request_change',
  'request_cancellation', 'request_quote', 'confirm_status', 'unknown',
];

/** product_area — 製品領域 */
export type SupportCaseAiProductArea =
  | 'tracking'
  | 'heatmap'
  | 'experience'
  | 'conversion'
  | 'billing'
  | 'member_permission'
  | 'installation'
  | 'unknown';

export const SUPPORT_CASE_AI_PRODUCT_AREAS: SupportCaseAiProductArea[] = [
  'tracking', 'heatmap', 'experience', 'conversion',
  'billing', 'member_permission', 'installation', 'unknown',
];

/** escalation_target — エスカレーション先 */
export type SupportCaseAiEscalationTarget =
  | 'cse'
  | 'billing'
  | 'product'
  | 'engineering'
  | 'sales'
  | 'unknown';

export const SUPPORT_CASE_AI_ESCALATION_TARGETS: SupportCaseAiEscalationTarget[] = [
  'cse', 'billing', 'product', 'engineering', 'sales', 'unknown',
];

/** human_review_status — 人手レビュー状態 */
export type SupportCaseAiHumanReviewStatus =
  | 'pending'
  | 'reviewed'
  | 'approved'
  | 'corrected';

export const SUPPORT_CASE_AI_HUMAN_REVIEW_STATUSES: SupportCaseAiHumanReviewStatus[] = [
  'pending', 'reviewed', 'approved', 'corrected',
];

/** AI 上書き禁止ステータス */
export const SUPPORT_CASE_AI_PROTECTED_STATUSES = new Set<SupportCaseAiHumanReviewStatus>([
  'approved',
]);

/** routing_status — ワークフロー状態 */
export type SupportCaseAiRoutingStatus =
  | 'new'
  | 'triage'
  | 'action_needed'
  | 'waiting_cse'
  | 'dismissed'
  | 'resolved';

export const SUPPORT_CASE_AI_ROUTING_STATUSES: SupportCaseAiRoutingStatus[] = [
  'new', 'triage', 'action_needed', 'waiting_cse', 'dismissed', 'resolved',
];

/** priority — 対応優先度 */
export type SupportCaseAiPriority = 'low' | 'normal' | 'high' | 'urgent';

export const SUPPORT_CASE_AI_PRIORITIES: SupportCaseAiPriority[] = [
  'low', 'normal', 'high', 'urgent',
];

// ── NocoDB Raw レコード型 ──────────────────────────────────────────────────────
// フィールド名は NocoDB 管理画面の列名と 1:1 で対応。
// 存在するが値がない場合は undefined。null は明示的な空値。

export interface RawSupportCaseAiState {
  Id:                    number;
  // 識別系
  case_ai_id?:           string | null;
  source_queue?:         string | null;   // SupportCaseAiSourceQueue
  source_record_id?:     string | null;
  company_uid?:          string | null;
  // 元ケース追従系
  source_updated_at?:    string | null;   // YYYY-MM-DD HH:MM:SS
  last_ai_updated_at?:   string | null;
  ai_version?:           string | null;
  // AI 判断系
  ai_summary?:           string | null;
  triage_note?:          string | null;
  category?:             string | null;   // SupportCaseAiCategory
  severity?:             string | null;   // SupportCaseAiSeverity
  customer_intent?:      string | null;   // SupportCaseAiCustomerIntent
  product_area?:         string | null;   // SupportCaseAiProductArea
  similar_case_ids?:     string | null;   // JSON array string
  suggested_action?:     string | null;
  draft_reply?:          string | null;
  // エスカレーション系
  escalation_needed?:    boolean | null;
  escalation_reason?:    string | null;
  escalation_target?:    string | null;   // SupportCaseAiEscalationTarget
  // 人手レビュー系
  human_review_status?:  string | null;   // SupportCaseAiHumanReviewStatus
  reviewed_by?:          string | null;
  reviewed_at?:          string | null;
  // ルーティング系
  routing_status?:       string | null;   // SupportCaseAiRoutingStatus
  priority?:             string | null;   // SupportCaseAiPriority
  // corrected 系（human_review_status === 'corrected' のとき有効）
  corrected_severity?:          string | null;   // SupportCaseAiSeverity
  corrected_routing_status?:    string | null;   // SupportCaseAiRoutingStatus
  corrected_priority?:          string | null;   // SupportCaseAiPriority
  corrected_triage_note?:       string | null;
  corrected_suggested_action?:  string | null;
  // downgrade 系（approved → reviewed に戻した場合に記録）
  downgraded_at?:        string | null;
  downgraded_by?:        string | null;
  downgrade_reason?:     string | null;
  [key: string]: unknown;
}

// ── アプリ domain 型 ───────────────────────────────────────────────────────────
// 全フィールドが型安全。UI コンポーネントはこの型だけを参照すること。

export interface SupportCaseAiStateRecord {
  // NocoDB row Id（update 時に使用）
  rowId:              number;
  // 識別系
  caseAiId:           string;
  sourceQueue:        SupportCaseAiSourceQueue;
  sourceRecordId:     string;
  companyUid:         string | null;
  // 元ケース追従系
  sourceUpdatedAt:    string | null;
  lastAiUpdatedAt:    string | null;
  aiVersion:          string | null;
  // AI 判断系
  aiSummary:          string | null;
  triageNote:         string | null;
  category:           SupportCaseAiCategory | null;
  severity:           SupportCaseAiSeverity | null;
  customerIntent:     SupportCaseAiCustomerIntent | null;
  productArea:        SupportCaseAiProductArea | null;
  similarCaseIds:     string[];
  suggestedAction:    string | null;
  draftReply:         string | null;
  // エスカレーション系
  escalationNeeded:   boolean | null;
  escalationReason:   string | null;
  escalationTarget:   SupportCaseAiEscalationTarget | null;
  // 人手レビュー系
  humanReviewStatus:  SupportCaseAiHumanReviewStatus;
  reviewedBy:         string | null;
  reviewedAt:         string | null;
  // ルーティング系
  routingStatus:      SupportCaseAiRoutingStatus | null;
  priority:           SupportCaseAiPriority | null;
}

// ── write payload 型 ──────────────────────────────────────────────────────────
// NocoDB に送る payload の型。
// `human_review_status` は AI write 時は常に 'pending' を指定すること。
// `reviewed_by` / `reviewed_at` は人手レビュー時のみ更新すること。

export interface SupportCaseAiStatePayload {
  // 識別系（必須）
  case_ai_id:           string;
  source_queue:         SupportCaseAiSourceQueue;
  source_record_id:     string;
  company_uid?:         string | null;
  // 元ケース追従系
  source_updated_at?:   string | null;   // YYYY-MM-DD HH:MM:SS
  last_ai_updated_at:   string;          // YYYY-MM-DD HH:MM:SS（必須）
  ai_version:           string;          // 例: "support-triage-v1"
  // AI 判断系
  ai_summary?:          string | null;
  triage_note?:         string | null;
  category?:            SupportCaseAiCategory | null;
  severity?:            SupportCaseAiSeverity | null;
  customer_intent?:     SupportCaseAiCustomerIntent | null;
  product_area?:        SupportCaseAiProductArea | null;
  similar_case_ids?:    string | null;   // JSON array string: '["id1","id2"]'
  suggested_action?:    string | null;
  draft_reply?:         string | null;
  // エスカレーション系
  escalation_needed?:   boolean;
  escalation_reason?:   string | null;
  escalation_target?:   SupportCaseAiEscalationTarget | null;
  // 人手レビュー系
  human_review_status:  SupportCaseAiHumanReviewStatus; // AI write: 'pending'
  reviewed_by?:         string | null;
  reviewed_at?:         string | null;
  // ルーティング系
  routing_status?:      SupportCaseAiRoutingStatus | null;
  priority?:            SupportCaseAiPriority | null;
}

// ── Human Review payload 型 ────────────────────────────────────────────────────
// 人手レビュー専用の更新 payload。AI フィールドは含まない。

export interface SupportCaseAiHumanReviewPayload {
  human_review_status: SupportCaseAiHumanReviewStatus;
  reviewed_by:         string;
  reviewed_at:         string;  // YYYY-MM-DD HH:MM:SS
}

// ── Save result 型 ────────────────────────────────────────────────────────────
// upsert 結果の discriminated union。既存 write helper と同一パターン。

export type SupportCaseAiSaveResult =
  | { ok: true;  created: boolean; record: SupportCaseAiStateRecord }
  | { ok: false; skipped: true;   reason: string }
  | { ok: false; skipped: false;  error: string };
