// ─── NocoDB 生レコード型 ─────────────────────────────────────────────────────
// フィールド名は NocoDB 管理画面の Fields タブで確認できます。
// 型が合わない場合はここを修正してください。

export interface RawCompany {
  Id: number;
  company_uid: string;
  canonical_name?: string | null;
  current_phase?: string | null;
  status?: string | null;          // "active" | "inactive" 等
  owner_name?: string | null;
  last_contact?: string | null;
  open_alert_count?: number | null;
  open_action_count?: number | null;
  is_csm_managed?: boolean | null; // true のみ実データあり
  [key: string]: unknown;
}

export interface RawAlert {
  Id: number;
  alert_id?: string | null;
  company_uid?: string | null;
  type?: string | null;            // "onboarding_delay" | "health_drop" | "license_opportunity" 等
  title?: string | null;
  severity?: string | null;        // "high" | "medium" | "low"
  timestamp?: string | null;
  status?: string | null;          // "open" | "closed"
  description?: string | null;
  [key: string]: unknown;
}

export interface RawEvidence {
  Id: number;
  evidence_id?: string | null;
  company_uid?: string | null;
  date?: string | null;
  title?: string | null;
  source_type?: string | null;     // "minutes" | "slack" | "email" | "product_usage" | "support_ticket" | "crm_note"
  status?: string | null;          // "pending" | "reviewed" | "confirmed" | "synced"
  scope?: string | null;
  excerpt?: string | null;
  summary?: string | null;
  owner_role?: string | null;
  [key: string]: unknown;
}

export interface RawPerson {
  Id: number;
  person_id?: string | null;
  company_uid?: string | null;
  name?: string | null;
  role?: string | null;
  status?: string | null;          // "active" | "candidate"
  email?: string | null;
  evidence_count?: number | null;
  is_decision_maker?: string | null;  // "TRUE" | "FALSE"
  is_missing_role_candidate?: string | null;
  org_parent_person_id?: string | null;
  [key: string]: unknown;
}

// ─── アプリ用ドメイン型 ──────────────────────────────────────────────────────

export interface AppCompany {
  id: string;              // company_uid
  name: string;            // canonical_name ?? company_uid
  phaseLabel: string;
  riskLevel: 'high' | 'medium' | 'low' | 'none';
  owner: string;
  lastContact: string;
  openAlerts: number;
  openActions: number;
  unprocessedMinutes: number;
  priority: 'urgent' | 'high' | 'normal';
  reason: string;
}

export interface AppAlert {
  id: string;
  type: 'risk' | 'opportunity' | 'info';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidenceCount: number;
  timestamp: string;
  company?: string;
  companyId?: string;
}

export interface AppEvidence {
  id: string;
  date: string;
  title: string;
  sourceType: 'mail' | 'minutes' | 'support' | 'inquiry' | 'ticket' | 'log';
  messageType: string;
  status: 'unprocessed' | 'proposal_generated' | 'confirmed' | 'synced';
  scope: string;
  ownerRole: string;
  excerpt: string;
  sourceUrl?: string;
}

export interface AppLogEntry extends AppEvidence {
  timestamp: string;       // "YYYY-MM-DD HH:mm" (date + time if available)
  summary: string;
  channel: string;
  linkedProject: string | null;
  linkedPeople: string[];
  resolverResult: string | null;
  hasOriginalLink: boolean;
  confidence: number | null;
  missingFields?: string[];
  evidenceBadge: boolean;
  riskBadge: boolean;
  opportunityBadge?: boolean;
}

export interface AppPerson {
  id: string;
  name: string;
  role: string;
  title?: string;
  department?: string;
  roleType: string;
  decisionInfluence: 'high' | 'medium' | 'low' | 'unknown';
  contactStatus: 'active' | 'contacted' | 'not contacted' | 'inactive' | 'unknown';
  company: string;
  email?: string;
  phone?: string;
  status: 'confirmed' | 'proposed' | 'unresolved';
  confidence?: string;
  evidenceCount: number;
  lastTouchpoint?: string | null;
  linkedProjects?: string[];
  linkedActions?: number;
  linkedContentJobs?: number;
  owner?: string;
  relationshipHypothesis?: string;
  missingFields?: string[];
  scope?: string;
}

// ─── ヘルパー ────────────────────────────────────────────────────────────────

export function s(v: unknown, fallback = '—'): string {
  if (v == null || v === '') return fallback;
  return String(v);
}

export function n(v: unknown, fallback = 0): number {
  const num = Number(v);
  return isNaN(num) ? fallback : num;
}

// ─── alert type マッピング ───────────────────────────────────────────────────
// NocoDB の type 値 → アプリの type 値
const ALERT_TYPE_MAP: Record<string, AppAlert['type']> = {
  onboarding_delay:    'risk',
  health_drop:         'risk',
  missing_exec_sponsor:'risk',
  support_risk:        'risk',
  qbr_missing:         'risk',
  license_opportunity: 'opportunity',
  expansion:           'opportunity',
};

export function toAlertType(raw: string | null | undefined): AppAlert['type'] {
  if (!raw) return 'info';
  return ALERT_TYPE_MAP[raw.toLowerCase()] ?? 'info';
}

// ─── evidence source_type マッピング ────────────────────────────────────────
const SOURCE_TYPE_MAP: Record<string, AppEvidence['sourceType']> = {
  minutes:        'minutes',
  email:          'mail',
  slack:          'mail',
  chatwork:       'mail',
  intercom:       'mail',
  inquiry:        'inquiry',
  support_ticket: 'support',
  product_usage:  'log',
  crm_note:       'log',
  ai_extracted:   'log',
};

export function toSourceType(raw: string | null | undefined): AppEvidence['sourceType'] {
  if (!raw) return 'log';
  return SOURCE_TYPE_MAP[raw.toLowerCase()] ?? 'log';
}

// ─── evidence status マッピング ──────────────────────────────────────────────
const EVIDENCE_STATUS_MAP: Record<string, AppEvidence['status']> = {
  pending:            'unprocessed',
  reviewed:           'proposal_generated',
  confirmed:          'confirmed',
  synced:             'synced',
};

export function toEvidenceStatus(raw: string | null | undefined): AppEvidence['status'] {
  if (!raw) return 'unprocessed';
  return EVIDENCE_STATUS_MAP[raw.toLowerCase()] ?? 'unprocessed';
}

// ─── ドメイン変換関数 ────────────────────────────────────────────────────────

export function toAppCompany(raw: RawCompany): AppCompany {
  const uid = s(raw.company_uid, String(raw.Id));
  const alerts = n(raw.open_alert_count);
  const riskLevel: AppCompany['riskLevel'] =
    alerts >= 3 ? 'high' : alerts >= 1 ? 'medium' : 'none';
  const priority: AppCompany['priority'] =
    alerts >= 3 ? 'urgent' : alerts >= 1 ? 'high' : 'normal';

  return {
    id: uid,
    name: s(raw.canonical_name, uid),
    phaseLabel: s(raw.current_phase, '—'),
    riskLevel,
    owner: s(raw.owner_name, '—'),
    lastContact: raw.last_contact
      ? String(raw.last_contact).slice(0, 10)
      : '—',
    openAlerts: alerts,
    openActions: n(raw.open_action_count),
    unprocessedMinutes: 0,
    priority,
    reason: '—',
  };
}

export function toAppAlert(raw: RawAlert): AppAlert {
  return {
    id: String(raw.Id),
    type: toAlertType(raw.type as string),
    severity: ((['high', 'medium', 'low'] as const).find(
      s => s === raw.severity,
    ) ?? 'medium') as AppAlert['severity'],
    title: s(raw.title, '(タイトルなし)'),
    description: s(raw.description),
    evidenceCount: 0,
    timestamp: raw.timestamp
      ? String(raw.timestamp).slice(0, 16).replace('T', ' ')
      : '—',
    company: s(raw.company_uid),
    companyId: s(raw.company_uid),
  };
}

export function toAppEvidence(raw: RawEvidence): AppEvidence {
  return {
    id: String(raw.Id),
    date: raw.date ? String(raw.date).slice(0, 10) : '—',
    title: s(raw.title, '(タイトルなし)'),
    sourceType: toSourceType(raw.source_type as string),
    messageType: s(raw.source_type, 'unknown'),
    status: toEvidenceStatus(raw.status as string),
    scope: s(raw.scope, 'Company'),
    ownerRole: s(raw.owner_role, '—'),
    excerpt: s(raw.excerpt),
  };
}

export function toAppLogEntry(raw: RawEvidence): AppLogEntry {
  const base = toAppEvidence(raw);
  const isRisk = ['pending', 'unprocessed'].includes(base.status) ||
    base.sourceType === 'support';
  // NocoDB の date フィールドは "YYYY-MM-DD HH:mm:ss+00:00" 形式
  const timestamp = raw.date
    ? String(raw.date).slice(0, 16).replace('T', ' ')
    : base.date;
  return {
    ...base,
    timestamp,
    summary: s(raw.summary, base.excerpt),
    channel: toChannelLabel(raw.source_type as string),
    linkedProject: null,
    linkedPeople: [],
    resolverResult: base.status === 'unprocessed' ? 'unresolved' : 'action_proposed',
    hasOriginalLink: false,
    confidence: null,
    missingFields: [],
    evidenceBadge: true,
    riskBadge: isRisk,
  };
}

function toChannelLabel(sourceType: string | null | undefined): string {
  const map: Record<string, string> = {
    minutes:        'Meeting',
    slack:          'Slack',
    email:          'Email',
    product_usage:  'Product Analytics',
    support_ticket: 'Support',
    crm_note:       'CRM',
    inquiry:        'Inquiry',
  };
  return map[sourceType ?? ''] ?? sourceType ?? 'Unknown';
}

// ─── CSE Ticket Queue (source) ───────────────────────────────────────────────

export interface RawCseTicket {
  Id: number;
  ticket_id?: string | null;
  title?: string | null;
  status?: string | null;          // "open" | "in_progress" | "resolved" | "closed"
  priority?: string | null;        // "high" | "medium" | "low"
  company_uid?: string | null;
  company_name?: string | null;
  linked_case_id?: string | null;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  waiting_hours?: number | null;
  [key: string]: unknown;
}

export interface AppCseTicket {
  id: string;
  title: string;
  status: string;
  priority: string;
  companyUid: string;
  companyName: string;
  linkedCaseId: string | null;
  description: string;
  createdAt: string;
  updatedAt: string | null;
  waitingHours: number | null;
}

export function toAppCseTicket(raw: RawCseTicket): AppCseTicket {
  return {
    id: raw.ticket_id ? s(raw.ticket_id) : String(raw.Id),
    title: s(raw.title, '(タイトルなし)'),
    status: s(raw.status, 'open'),
    priority: s(raw.priority, 'medium'),
    companyUid: s(raw.company_uid, ''),
    companyName: s(raw.company_name, s(raw.company_uid, '—')),
    linkedCaseId: raw.linked_case_id ? s(raw.linked_case_id) : null,
    description: s(raw.description),
    createdAt: raw.created_at ? String(raw.created_at).slice(0, 16).replace('T', ' ') : '—',
    updatedAt: raw.updated_at ? String(raw.updated_at).slice(0, 16).replace('T', ' ') : null,
    waitingHours: raw.waiting_hours != null ? n(raw.waiting_hours) : null,
  };
}

// ─── Inquiry Queue (source) ───────────────────────────────────────────────────

export interface RawInquiry {
  Id: number;
  inquiry_id?: string | null;
  title?: string | null;
  status?: string | null;          // "open" | "in_progress" | "resolved"
  company_uid?: string | null;
  company_name?: string | null;
  linked_case_id?: string | null;
  source?: string | null;
  body?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface AppInquiry {
  id: string;
  title: string;
  status: string;
  companyUid: string;
  companyName: string;
  linkedCaseId: string | null;
  source: string;
  body: string;
  createdAt: string;
}

export function toAppInquiry(raw: RawInquiry): AppInquiry {
  return {
    id: raw.inquiry_id ? s(raw.inquiry_id) : String(raw.Id),
    title: s(raw.title, '(タイトルなし)'),
    status: s(raw.status, 'open'),
    companyUid: s(raw.company_uid, ''),
    companyName: s(raw.company_name, s(raw.company_uid, '—')),
    linkedCaseId: raw.linked_case_id ? s(raw.linked_case_id) : null,
    source: s(raw.source, '—'),
    body: s(raw.body),
    createdAt: raw.created_at ? String(raw.created_at).slice(0, 16).replace('T', ' ') : '—',
  };
}

// ─── Support Alerts (derived) ─────────────────────────────────────────────────

export interface RawSupportAlert {
  Id: number;
  alert_id?: string | null;
  alert_type?: string | null;      // "Opportunity" | "Risk" | "Content Suggestion" | "Waiting on CSE" | "Urgent"
  priority?: string | null;        // "Critical" | "High" | "Medium" | "Low"
  title?: string | null;
  summary?: string | null;
  company_uid?: string | null;
  company_name?: string | null;
  source?: string | null;
  linked_cases?: number | null;
  cse_tickets?: number | null;
  assigned_to?: string | null;
  owner_name?: string | null;
  status?: string | null;          // "Untriaged" | "In Progress" | "Resolved" | "Dismissed"
  suggested_action?: string | null;
  why_this_matters?: string | null;
  // AI 生成情報（source 案件との紐付け）
  source_id?: string | null;
  source_table?: string | null;
  escalation_needed?: boolean | null;
  generated_by?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface AppSupportAlert {
  id: string;
  alertType: string;
  priority: string;
  title: string;
  summary: string;
  companyUid: string | null;
  companyName: string | null;
  source: string;
  linkedCases: number;
  cseTickets: number;
  assignedTo: string;
  ownerName: string | null;
  status: string;
  suggestedAction: string;
  whyThisMatters: string;
  sourceId: string | null;
  sourceTable: string | null;
  escalationNeeded: boolean | null;
  generatedBy: string | null;
  createdAt: string;
}

export function toAppSupportAlert(raw: RawSupportAlert): AppSupportAlert {
  return {
    id: raw.alert_id ? s(raw.alert_id) : String(raw.Id),
    alertType: s(raw.alert_type, 'info'),
    priority: s(raw.priority, 'Medium'),
    title: s(raw.title, '(タイトルなし)'),
    summary: s(raw.summary),
    companyUid: raw.company_uid ? s(raw.company_uid) : null,
    companyName: raw.company_name ? s(raw.company_name) : null,
    source: s(raw.source, '—'),
    linkedCases: n(raw.linked_cases),
    cseTickets: n(raw.cse_tickets),
    assignedTo: s(raw.assigned_to, 'Unassigned'),
    ownerName: raw.owner_name ? s(raw.owner_name) : null,
    status: s(raw.status, 'Untriaged'),
    suggestedAction: s(raw.suggested_action, '—'),
    whyThisMatters: s(raw.why_this_matters),
    sourceId: raw.source_id ? String(raw.source_id) : null,
    sourceTable: raw.source_table ? String(raw.source_table) : null,
    escalationNeeded: raw.escalation_needed != null ? Boolean(raw.escalation_needed) : null,
    generatedBy: raw.generated_by ? String(raw.generated_by) : null,
    createdAt: raw.created_at ? String(raw.created_at).slice(0, 16).replace('T', ' ') : '—',
  };
}

// ─── Support Case AI State (derived) ─────────────────────────────────────────

export interface RawSupportCaseAIState {
  Id: number;
  source_id?: string | null;
  source_table?: string | null;       // "support_queue" | "inquiry_queue" | "cseticket_queue"
  summary?: string | null;
  suggested_owner?: string | null;
  suggested_team?: string | null;
  urgency?: string | null;            // "high" | "medium" | "low"
  next_steps?: string | null;         // JSON 配列文字列 e.g. '["step1","step2"]'
  similar_case_ids?: string | null;   // JSON 配列文字列
  // AI サマリー生成で追加されるフィールド
  customer_intent?: string | null;
  product_area?: string | null;
  urgency_reasoning?: string | null;
  generated_by?: string | null;       // 生成モデル名（例: "gpt-4o-mini"）
  // AI トリアージで追加されるフィールド
  triage_note?: string | null;
  suggested_action?: string | null;
  escalation_needed?: boolean | null;
  category?: string | null;           // "技術的問題" | "機能リクエスト" 等
  routing_reason?: string | null;
  // AI 下書きで追加されるフィールド
  draft_reply?: string | null;
  reply_tone?: string | null;         // "formal" | "friendly" | "technical"
  reply_key_points?: string | null;   // JSON 配列文字列
  // 人間によるレビュー状態（このフィールドが approved/locked/finalized なら AI で上書きしない）
  human_review_status?: string | null; // null | "draft" | "approved" | "locked" | "finalized"
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface AppSupportCaseAIState {
  id: string;
  sourceId: string;
  sourceTable: string;
  summary: string;
  suggestedOwner: string;
  suggestedTeam: string;
  urgency: string;
  nextSteps: string[];
  similarCaseIds: string[];
  // AI サマリー生成フィールド
  customerIntent: string;
  productArea: string;
  urgencyReasoning: string;
  generatedBy: string | null;
  // AI トリアージフィールド
  triageNote: string | null;
  suggestedAction: string | null;
  escalationNeeded: boolean | null;
  category: string | null;
  routingReason: string | null;
  // AI 下書きフィールド
  draftReply: string | null;
  replyTone: string | null;
  replyKeyPoints: string[];
  // レビュー状態
  humanReviewStatus: string | null;
  createdAt: string;
  updatedAt: string | null;
}

function parseJsonArray(v: unknown): string[] {
  if (!v) return [];
  try { const arr = JSON.parse(String(v)); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
}

export function toAppSupportCaseAIState(raw: RawSupportCaseAIState): AppSupportCaseAIState {
  return {
    id: String(raw.Id),
    sourceId: s(raw.source_id, ''),
    sourceTable: s(raw.source_table, 'support_queue'),
    summary: s(raw.summary),
    suggestedOwner: s(raw.suggested_owner, '—'),
    suggestedTeam: s(raw.suggested_team, '—'),
    urgency: s(raw.urgency, 'Medium'),
    nextSteps: parseJsonArray(raw.next_steps),
    similarCaseIds: parseJsonArray(raw.similar_case_ids),
    customerIntent: s(raw.customer_intent),
    productArea: s(raw.product_area),
    urgencyReasoning: s(raw.urgency_reasoning),
    generatedBy: raw.generated_by ? String(raw.generated_by) : null,
    triageNote: raw.triage_note ? String(raw.triage_note) : null,
    suggestedAction: raw.suggested_action ? String(raw.suggested_action) : null,
    escalationNeeded: raw.escalation_needed != null ? Boolean(raw.escalation_needed) : null,
    category: raw.category ? String(raw.category) : null,
    routingReason: raw.routing_reason ? String(raw.routing_reason) : null,
    draftReply: raw.draft_reply ? String(raw.draft_reply) : null,
    replyTone: raw.reply_tone ? String(raw.reply_tone) : null,
    replyKeyPoints: parseJsonArray(raw.reply_key_points),
    humanReviewStatus: raw.human_review_status ? String(raw.human_review_status) : null,
    createdAt: raw.created_at ? String(raw.created_at).slice(0, 16).replace('T', ' ') : '—',
    updatedAt: raw.updated_at ? String(raw.updated_at).slice(0, 16).replace('T', ' ') : null,
  };
}

// ─── Support Queue ──────────────────────────────────────────────────────────

export interface RawSupportCase {
  Id: number;
  case_id?: string | null;
  title?: string | null;
  case_type?: string | null;         // "inquiry" | "support" | "cse_linked"
  source?: string | null;            // "Intercom" | "Slack" | "Email" | "Chatwork" | "CSE Ticket"
  company_uid?: string | null;
  company_name?: string | null;
  project_name?: string | null;
  project_id?: string | null;
  owner_name?: string | null;
  assigned_team?: string | null;     // "CSM" | "Support" | "CSE"
  routing_status?: string | null;    // "unassigned" | "triaged" | "assigned" | "in progress" | "waiting on customer" | "waiting on CSE"
  source_status?: string | null;     // "open" | "pending"
  severity?: string | null;          // "high" | "medium" | "low"
  created_at?: string | null;
  first_response_time?: string | null;
  open_duration?: string | null;
  waiting_duration?: string | null;
  linked_cse_ticket?: string | null;
  related_content_count?: number | null;
  // AI サマリー生成の入力として使う（NocoDB フィールド追加後に流れる）
  original_message?: string | null;
  triage_note?: string | null;
  [key: string]: unknown;
}

export interface AppSupportCase {
  id: string;
  title: string;
  caseType: string;
  source: string;
  company: string;
  companyId: string;
  project: string | null;
  projectId: string | null;
  owner: string | null;
  assignedTeam: string | null;
  routingStatus: string;
  sourceStatus: string | null;
  severity: string;
  createdAt: string;
  firstResponseTime: string | null;
  openDuration: string;
  waitingDuration: string | null;
  linkedCSETicket: string | null;
  relatedContent: number;
  // AI プロンプト入力用（NocoDB にフィールドが存在する場合のみ値が入る）
  originalMessage?: string;
  triageNote?: string;
}

const CASE_TYPE_MAP: Record<string, string> = {
  inquiry:    'Inquiry',
  support:    'Support',
  cse_linked: 'CSE Ticket Linked',
};

const ROUTING_STATUS_MAP: Record<string, string> = {
  unassigned:          'unassigned',
  triaged:             'triaged',
  assigned:            'assigned',
  in_progress:         'in progress',
  waiting_on_customer: 'waiting on customer',
  waiting_on_cse:      'waiting on CSE',
};

export function toAppSupportCase(raw: RawSupportCase): AppSupportCase {
  const rawStatus = s(raw.routing_status).toLowerCase().replace(/ /g, '_');
  return {
    id: raw.case_id ? s(raw.case_id) : String(raw.Id),
    title: s(raw.title, '(タイトルなし)'),
    caseType: CASE_TYPE_MAP[s(raw.case_type).toLowerCase()] ?? s(raw.case_type, 'Inquiry'),
    source: s(raw.source, '—'),
    company: s(raw.company_name, s(raw.company_uid, '—')),
    companyId: s(raw.company_uid, ''),
    project: raw.project_name ? s(raw.project_name) : null,
    projectId: raw.project_id ? s(raw.project_id) : null,
    owner: raw.owner_name ? s(raw.owner_name) : null,
    assignedTeam: raw.assigned_team ? s(raw.assigned_team) : null,
    routingStatus: ROUTING_STATUS_MAP[rawStatus] ?? s(raw.routing_status, 'unassigned'),
    sourceStatus: raw.source_status ? s(raw.source_status) : null,
    severity: s(raw.severity, 'medium'),
    createdAt: raw.created_at ? String(raw.created_at).slice(0, 16).replace('T', ' ') : '—',
    firstResponseTime: raw.first_response_time ? s(raw.first_response_time) : null,
    openDuration: s(raw.open_duration, '—'),
    waitingDuration: raw.waiting_duration ? s(raw.waiting_duration) : null,
    linkedCSETicket: raw.linked_cse_ticket ? s(raw.linked_cse_ticket) : null,
    relatedContent: n(raw.related_content_count),
    originalMessage: raw.original_message ? s(raw.original_message) : undefined,
    triageNote:      raw.triage_note      ? s(raw.triage_note)      : undefined,
  };
}

// ── unified_log_signal_state (derived) ───────────────────────────────────────
// 1企業につき1レコード。company_uid が主キー。
// 配列フィールドは NocoDB の flat テーブル制約上 JSON 文字列として保存する。

/** NocoDB から取得する生レコード */
export interface RawUnifiedLogSignalState {
  Id:                              number;
  company_uid?:                    string;
  /** SignalItem[] を JSON 文字列化 */
  key_signals?:                    string;
  /** RiskSignalItem[] を JSON 文字列化 */
  risk_signals?:                   string;
  /** OpportunitySignalItem[] を JSON 文字列化 */
  opportunity_signals?:            string;
  /** MissingInfoItem[] を JSON 文字列化 */
  missing_information?:            string;
  recommended_next_review_focus?:  string;
  generated_by?:                   string;
  generated_at?:                   string;
  last_ai_updated_at?:             string;
  log_count?:                      number;
  human_review_status?:            string | null; // null | "draft" | "approved" | "locked" | "finalized"
}

/** アプリケーション層で使う型（配列は parse 済み） */
export interface AppUnifiedLogSignalState {
  id:                            string;  // NocoDB row Id
  companyUid:                    string;
  keySignals:                    unknown[];
  riskSignals:                   unknown[];
  opportunitySignals:            unknown[];
  missingInformation:            unknown[];
  recommendedNextReviewFocus:    string;
  generatedBy:                   string;
  generatedAt:                   string;
  lastAiUpdatedAt:               string;
  logCount:                      number;
  humanReviewStatus:             string | null;
}

function safeParseJsonArray(raw: string | undefined | null): unknown[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as unknown[]; }
  catch { return []; }
}

export function toAppUnifiedLogSignalState(
  raw: RawUnifiedLogSignalState,
): AppUnifiedLogSignalState {
  return {
    id:                         String(raw.Id),
    companyUid:                 raw.company_uid ?? '',
    keySignals:                 safeParseJsonArray(raw.key_signals),
    riskSignals:                safeParseJsonArray(raw.risk_signals),
    opportunitySignals:         safeParseJsonArray(raw.opportunity_signals),
    missingInformation:         safeParseJsonArray(raw.missing_information),
    recommendedNextReviewFocus: raw.recommended_next_review_focus ?? '',
    generatedBy:                raw.generated_by ?? '',
    generatedAt:                raw.generated_at ?? '',
    lastAiUpdatedAt:            raw.last_ai_updated_at ?? '',
    logCount:                   raw.log_count ?? 0,
    humanReviewStatus:          raw.human_review_status ? String(raw.human_review_status) : null,
  };
}

// ── company_summary_state (derived) ───────────────────────────────────────────
// 1企業につき1レコード。company_uid が主キー。
// 配列フィールドは NocoDB の flat テーブル制約上 JSON 文字列として保存する。

/** NocoDB から取得する生レコード */
export interface RawCompanySummaryState {
  Id:                       number;
  company_uid?:             string;
  summary?:                 string;
  overall_health?:          string;
  /** RiskItem[] を JSON 文字列化 */
  key_risks?:               string;
  /** OpportunityItem[] を JSON 文字列化 */
  key_opportunities?:       string;
  recommended_next_action?: string;
  generated_by?:            string;
  generated_at?:            string;
  last_ai_updated_at?:      string;
  evidence_count?:          number;
  alert_count?:             number;
  people_count?:            number;
  human_review_status?:     string | null; // null | "draft" | "approved" | "locked" | "finalized"
}

/** アプリケーション層で使う型（配列は parse 済み） */
export interface AppCompanySummaryState {
  id:                    string;
  companyUid:            string;
  summary:               string;
  overallHealth:         string;
  keyRisks:              unknown[];
  keyOpportunities:      unknown[];
  recommendedNextAction: string;
  generatedBy:           string;
  generatedAt:           string;
  lastAiUpdatedAt:       string;
  evidenceCount:         number;
  alertCount:            number;
  peopleCount:           number;
  humanReviewStatus:     string | null;
}

export function toAppCompanySummaryState(
  raw: RawCompanySummaryState,
): AppCompanySummaryState {
  return {
    id:                    String(raw.Id),
    companyUid:            raw.company_uid ?? '',
    summary:               raw.summary ?? '',
    overallHealth:         raw.overall_health ?? '',
    keyRisks:              safeParseJsonArray(raw.key_risks),
    keyOpportunities:      safeParseJsonArray(raw.key_opportunities),
    recommendedNextAction: raw.recommended_next_action ?? '',
    generatedBy:           raw.generated_by ?? '',
    generatedAt:           raw.generated_at ?? '',
    lastAiUpdatedAt:       raw.last_ai_updated_at ?? '',
    evidenceCount:         raw.evidence_count ?? 0,
    alertCount:            raw.alert_count ?? 0,
    peopleCount:           raw.people_count ?? 0,
    humanReviewStatus:     raw.human_review_status ? String(raw.human_review_status) : null,
  };
}

export function toAppPerson(raw: RawPerson, companyUid: string): AppPerson {
  const isDecisionMaker = String(raw.is_decision_maker).toUpperCase() === 'TRUE';
  const isCandidate = raw.status === 'candidate';

  return {
    id: String(raw.Id),
    name: s(raw.name, '(名前なし)'),
    role: s(raw.role, '—'),
    roleType: isDecisionMaker ? 'Decision Maker' : 'User',
    decisionInfluence: isDecisionMaker ? 'high' : 'medium',
    contactStatus: raw.status === 'active' ? 'active' : 'contacted',
    company: companyUid,
    email: raw.email ? s(raw.email) : undefined,
    status: isCandidate ? 'proposed' : 'confirmed',
    confidence: isDecisionMaker ? 'high' : 'medium',
    evidenceCount: n(raw.evidence_count),
    lastTouchpoint: null,
    linkedProjects: [],
    linkedActions: 0,
    linkedContentJobs: 0,
    missingFields: [],
  };
}
