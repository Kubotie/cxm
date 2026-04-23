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
  /** Salesforce Account ID（SF Contact sync / SF Task sync で使用） */
  sf_account_id?: string | null;
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
  updatedAt: string | null; // NocoDB UpdatedAt システムカラム (source_updated_at に使用)
  /** Salesforce Account ID（SF Contact/Task sync で使用。未設定時は null） */
  sfAccountId: string | null;
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
  /** "policy:{policyId}" の場合は Policy 由来。alert_id が "pol_" で始まる場合に付与 */
  source?: string;
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
  /** NocoDB row Id（company_people テーブルの PATCH 用。未保存 or SF-only の場合は undefined） */
  rowId?: number;
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
  // ── 永続化 / SF 連携フィールド ─────────────────────────────────────────────
  /** データの出所。'salesforce' = SF 同期, 'cxm' = CXM のみ, 'unknown' = 未判定 */
  source?: 'salesforce' | 'cxm' | 'unknown';
  /** Salesforce Contact ID（連携後に設定）  */
  sfId?: string | null;
  /** SF 同期状態 */
  syncStatus?: 'not_synced' | 'pending' | 'synced' | 'sync_error' | null;
  /** SF 最終同期日時（ISO 8601）*/
  sfLastSyncedAt?: string | null;
  /** 上長の person_id（org chart 階層構築用） */
  managerId?: string | null;
  // ── Org chart 拡張フィールド（company_people テーブルに追加予定）───────────────
  /**
   * 明示的なレイヤー指定。設定されていれば inferOrgLayer() の推定より優先される。
   * 値: 'executive' | 'department_head' | 'manager' | 'operator' | 'unclassified'
   */
  layerRole?: string | null;
  /** 経営層フラグ。true なら layerRole='executive' として扱う */
  isExecutive?: boolean | null;
  /** 部署長フラグ。true なら layerRole='department_head' として扱う */
  isDepartmentHead?: boolean | null;
  /**
   * 直属の上長 person_id。manager_id より精度が高い場合に使用。
   * 解決優先度: reportsToPersonId > managerId
   */
  reportsToPersonId?: string | null;
  /**
   * 横断的に協働している person_id のリスト（CSM が設定する関係性）。
   * NocoDB には JSON 配列文字列として保存。toAppPerson で string[] に変換済み。
   */
  worksWithPersonIds?: string[] | null;
  /** 表示グループ（任意の分類ラベル。部署とは別に CSM が付与） */
  displayGroup?: string | null;
  /** CSM 主観メモ（その人へのアプローチ方針など） */
  stakeholderNote?: string | null;
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
  // ── built-in ──────────────────────────────────────────────────────────────
  onboarding_delay:    'risk',
  health_drop:         'risk',
  missing_exec_sponsor:'risk',
  support_risk:        'risk',
  qbr_missing:         'risk',
  license_opportunity: 'opportunity',
  expansion:           'opportunity',
  // ── policy-derived（category_tag 値）─────────────────────────────────────
  churn_risk:          'risk',
  communication:       'risk',
  support_critical:    'risk',
  queue_surge:         'risk',
  people_risk:         'risk',
  policy_alert:        'risk',   // フォールバック
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
    updatedAt:    raw.UpdatedAt ? String(raw.UpdatedAt).slice(0, 16).replace('T', ' ') : null,
    sfAccountId:  raw.sf_account_id ? String(raw.sf_account_id) : null,
  };
}

export function toAppAlert(raw: RawAlert): AppAlert {
  const alertId = String(raw.alert_id ?? '');
  // alert_id が "pol_" で始まる場合は policy 由来。"pol_{id}:{uid}" → "policy:{id}" を復元
  const source = alertId.startsWith('pol_')
    ? `policy:${alertId.split(':')[0]}`
    : undefined;

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
    ...(source ? { source } : {}),
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
  // 同期スクリプトが書き込む表示用キャッシュ列
  display_title?: string | null;    // AI生成タイトル（20〜40文字）
  display_message?: string | null;  // AI整形済み本文（挨拶・署名・引用を除去）
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
    title: s(raw.display_title) || s(raw.title) || '(タイトルなし)',
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
  support_alert_id?: string | null;  // UUID（AI 生成時に自動採番）
  ai_generated?: boolean | null;     // AI が生成したアラートか
  alert_type?: string | null;        // 運用アラート種別
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
  source_record_id?: string | null;
  source_queue?: string | null;
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
    sourceId: raw.source_record_id ? String(raw.source_record_id) : null,
    sourceTable: raw.source_queue ? String(raw.source_queue) : null,
    escalationNeeded: raw.escalation_needed != null ? Boolean(raw.escalation_needed) : null,
    generatedBy: raw.generated_by ? String(raw.generated_by) : null,
    createdAt: raw.created_at ? String(raw.created_at).slice(0, 16).replace('T', ' ') : '—',
  };
}

// ─── Support Case AI State (derived) ─────────────────────────────────────────

export interface RawSupportCaseAIState {
  Id: number;
  source_record_id?: string | null;
  source_queue?: string | null;       // "support_queue" | "inquiry_queue" | "cseticket_queue"
  summary?: string | null;
  suggested_owner?: string | null;
  suggested_team?: string | null;
  urgency?: string | null;            // "high" | "medium" | "low"
  next_steps?: string | null;         // JSON 配列文字列 e.g. '["step1","step2"]'
  similar_case_ids?: string | null;   // JSON 配列文字列
  // AI 生成タイトル（一覧表示用 20〜40 文字）
  display_title?: string | null;
  // AI 整形済み本文（詳細画面表示用。不要な挨拶・署名・引用を除去した body）
  display_message?: string | null;
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
  // AI 生成タイトル（一覧表示用）
  displayTitle: string | null;
  // AI 整形済み本文（詳細画面表示用）
  displayMessage: string | null;
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
    sourceId: s(raw.source_record_id, ''),
    sourceTable: s(raw.source_queue, 'support_queue'),
    displayTitle: raw.display_title ? String(raw.display_title) : null,
    displayMessage: raw.display_message ? String(raw.display_message) : null,
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
// source of truth: log_intercom テーブル（Intercom からの同期ログ）
//   title        → log_intercom に存在しない。display_title（AI生成）→ body 冒頭で代替。
//   sent_at      → 存在しない。sent_at_jst を使用。
//   company_name → 存在しない。account_name を使用。
//   source       → 存在しない。'Intercom' 固定。
//   original_message → 存在しない。body を使用。

export interface RawSupportCase {
  Id: number;
  case_id?: string | null;
  // ── 同期スクリプトが書き込む表示用キャッシュ列 ─────────────────────────────
  display_title?: string | null;     // AI生成タイトル（20〜40文字）
  display_message?: string | null;   // AI整形済み本文（挨拶・署名・引用を除去）
  // ── log_intercom 実在カラム ──────────────────────────────────────────────────
  body?: string | null;              // 問い合わせ本文（original_message は存在しない）
  sent_at_jst?: string | null;       // 受信日時 JST（created_at は存在しない）
  update_at_jst?: string | null;
  close_at_unix?: number | null;
  account_name?: string | null;      // Intercom アカウント名（company_name は存在しない）
  first_response_at?: string | null; // 初回応答日時（first_response_time は存在しない）
  message_count?: number | null;
  // ── log_intercom 行分類キー ──────────────────────────────────────────────────
  // ※ スペルは DB の実カラム名に合わせて massage_type（message_ ではない）
  massage_type?: string | null;      // "support" | "inquiry" | "billing"
  case_type?: string | null;         // "inquiry" | "support" | "cse_linked"
  // ── CSM チームが付与するカラム（存在する場合のみ値が入る）──────────────────
  company_uid?: string | null;
  project_name?: string | null;
  project_id?: string | null;
  owner_name?: string | null;
  assigned_team?: string | null;     // "CSM" | "Support" | "CSE"（旧フィールド名）
  team_name?: string | null;         // "CSM" | "Support" | "CSE"（新フィールド名）
  routing_status?: string | null;    // "unassigned" | "triaged" | "assigned" | "in progress" | "waiting on customer" | "waiting on CSE"
  source_status?: string | null;     // Intercom / 外部ソース側のステータス
  severity?: string | null;          // "high" | "medium" | "low"
  linked_cse_ticket?: string | null;
  related_content_count?: number | null;
  triage_note?: string | null;
  open_duration_minutes?: number | null;  // オープン経過時間（分）
  open_duration?: string | null;          // 旧フィールド（文字列）
  waiting_duration?: string | null;
  // ── 将来追加予定 / 旧フィールド（現在 log_intercom には存在しない）─────────
  title?: string | null;             // 存在しない（resolveTitle で AI/body から導出）
  original_message?: string | null;  // 存在しない（body を使用）
  company_name?: string | null;      // 存在しない（account_name を使用）
  source?: string | null;            // 存在しない（'Intercom' に固定）
  created_at?: string | null;        // 存在しない（sent_at_jst を使用）
  first_response_time?: string | null; // 存在しない（first_response_at を使用）
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

/**
 * タイトル未設定時に fallbackText（本文等）の冒頭から表示用タイトルを導出する。
 * @param titleField  元テーブルの title カラム値
 * @param fallbackText original_message / description など本文フィールド
 */
function deriveTitle(
  titleField: string | null | undefined,
  fallbackText: string | null | undefined,
): string {
  const src = titleField ? String(titleField).trim() : '';
  if (src) return src;
  if (fallbackText) {
    const msg = String(fallbackText)
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return msg.length > 40 ? msg.slice(0, 38) + '…' : msg;
  }
  return '(タイトルなし)';
}

/** massage_type / case_type から caseType を確定する */
function deriveCaseType(raw: RawSupportCase): string {
  // case_type フィールドが明示されている場合はそちらを優先
  if (raw.case_type) {
    const mapped = CASE_TYPE_MAP[String(raw.case_type).toLowerCase()];
    if (mapped) return mapped;
  }
  // log_intercom の massage_type からの導出
  const mt = raw.massage_type ? String(raw.massage_type).toLowerCase() : '';
  if (mt === 'support') return 'Support';
  if (mt === 'inquiry') return 'Inquiry';
  // fallback: Support（Inquiry に寄らない）
  return 'Support';
}

const CSE_STATUS_TO_ROUTING: Record<string, string> = {
  open:        'waiting on CSE',
  in_progress: 'in progress',
  resolved:    'resolved_like',
  closed:      'resolved_like',
};

/**
 * RawCseTicket を AppSupportCase 形式に変換する（queue 統合表示用）。
 * source table は更新しない。
 */
export function cseTicketToAppSupportCase(raw: RawCseTicket): AppSupportCase {
  const statusKey = s(raw.status, 'open').toLowerCase();
  return {
    id: raw.ticket_id ? s(raw.ticket_id) : String(raw.Id),
    title: deriveTitle(raw.display_title ?? raw.title, raw.description),
    caseType: raw.linked_case_id ? 'CSE Ticket Linked' : 'CSE Ticket',
    source: 'CSE Ticket',
    company: s(raw.company_name, s(raw.company_uid, '—')),
    companyId: s(raw.company_uid, ''),
    project: null,
    projectId: null,
    owner: null,
    assignedTeam: 'CSE',
    routingStatus: CSE_STATUS_TO_ROUTING[statusKey] ?? 'waiting on CSE',
    sourceStatus: s(raw.status, 'open'),
    severity: s(raw.priority, 'medium'),
    createdAt: raw.created_at ? String(raw.created_at).slice(0, 16).replace('T', ' ') : '—',
    firstResponseTime: null,
    openDuration: '—',
    waitingDuration: raw.waiting_hours != null ? `${raw.waiting_hours}h` : null,
    linkedCSETicket: raw.ticket_id ? s(raw.ticket_id) : String(raw.Id),
    relatedContent: 0,
    originalMessage: raw.description ? s(raw.description) : undefined,
  };
}

export function toAppSupportCase(raw: RawSupportCase): AppSupportCase {
  const rawStatus = s(raw.routing_status).toLowerCase().replace(/ /g, '_');
  // body: log_intercom の実カラム。original_message は存在しないため body を優先
  const bodyText = raw.body ? s(raw.body) : (raw.original_message ? s(raw.original_message) : undefined);
  // company: account_name（Intercom アカウント名）→ company_name → company_uid の優先順
  const rawAccountName = raw.account_name ? String(raw.account_name).trim() : '';
  const companyDisplay = rawAccountName
    || (raw.company_name ? s(raw.company_name) : '')
    || s(raw.company_uid, '—');
  return {
    id: raw.case_id ? s(raw.case_id) : String(raw.Id),
    // display_title = AI生成タイトル（存在すれば優先）, title は log_intercom に存在しない
    title: deriveTitle(raw.display_title ?? raw.title, bodyText),
    caseType: deriveCaseType(raw),
    // source: log_intercom に source カラムは存在しない → 固定値 'Intercom'
    source: s(raw.source) || 'Intercom',
    company: companyDisplay,
    companyId: s(raw.company_uid, ''),
    project: raw.project_name ? s(raw.project_name) : null,
    projectId: raw.project_id ? s(raw.project_id) : null,
    owner: raw.owner_name ? s(raw.owner_name) : null,
    assignedTeam: raw.assigned_team ? s(raw.assigned_team) : null,
    routingStatus: ROUTING_STATUS_MAP[rawStatus] ?? s(raw.routing_status, 'unassigned'),
    sourceStatus: raw.source_status ? s(raw.source_status) : null,
    severity: s(raw.severity, 'medium'),
    // createdAt: log_intercom は sent_at_jst を使用（created_at は存在しない）
    createdAt: (raw.sent_at_jst ?? raw.created_at)
      ? String(raw.sent_at_jst ?? raw.created_at).slice(0, 16).replace('T', ' ')
      : '—',
    // firstResponseTime: log_intercom は first_response_at を使用
    firstResponseTime: (raw.first_response_at ?? raw.first_response_time)
      ? s(raw.first_response_at ?? raw.first_response_time)
      : null,
    openDuration: s(raw.open_duration, '—'),
    waitingDuration: raw.waiting_duration ? s(raw.waiting_duration) : null,
    linkedCSETicket: raw.linked_cse_ticket ? s(raw.linked_cse_ticket) : null,
    relatedContent: n(raw.related_content_count),
    originalMessage: bodyText,
    triageNote:      raw.triage_note ? s(raw.triage_note) : undefined,
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
// upsert キー: company_uid + summary_type（複合）
// summary_type のデフォルト値は "default"（将来の複数 summary 対応のための拡張点）
// 配列フィールドは NocoDB の flat テーブル制約上 JSON 文字列として保存する。

/** NocoDB から取得する生レコード */
export interface RawCompanySummaryState {
  Id:                       number;
  // ── upsert キー ──
  company_uid?:             string;
  summary_type?:            string;       // "default" | 将来: "renewal" | "onboarding" など
  // ── AI 生成コンテンツ ──
  ai_summary?:              string;
  overall_health?:          string;       // healthy | at_risk | critical | expanding
  /** RiskItem[] を JSON 文字列化 */
  key_risks?:               string;
  /** OpportunityItem[] を JSON 文字列化 */
  key_opportunities?:       string;
  recommended_next_action?: string;
  // ── バージョン管理 ──
  model?:                   string;       // 例: "gpt-4o-2024-08-06"
  ai_version?:              string;       // 例: "company-summary-v1"
  // ── 時刻管理 ──
  source_updated_at?:       string | null; // 会社レコードの updated_at（freshness 基準）
  last_ai_updated_at?:      string | null;
  // ── 統計 ──
  evidence_count?:          number;
  alert_count?:             number;
  people_count?:            number;
  // ── Human Review ──
  human_review_status?:     string | null; // pending | reviewed | corrected | approved
  reviewed_by?:             string | null;
  reviewed_at?:             string | null;
  // ── Policy 連携 ──
  /** この summary を生成した Summary Policy の policy_id（ない場合は null） */
  applied_policy_id?:       string | null;
  [key: string]: unknown;
}

/** アプリケーション層で使う型（配列は parse 済み） */
export interface AppCompanySummaryState {
  rowId:                 number;
  companyUid:            string;
  summaryType:           string;
  aiSummary:             string;
  overallHealth:         string;
  keyRisks:              unknown[];
  keyOpportunities:      unknown[];
  recommendedNextAction: string;
  model:                 string;
  aiVersion:             string | null;
  sourceUpdatedAt:       string | null;
  lastAiUpdatedAt:       string | null;
  evidenceCount:         number;
  alertCount:            number;
  peopleCount:           number;
  humanReviewStatus:     string | null; // pending | reviewed | corrected | approved
  reviewedBy:            string | null;
  reviewedAt:            string | null;
  /** この summary を生成した Summary Policy の policy_id（ない場合は null） */
  appliedPolicyId:       string | null;
}

export function toAppCompanySummaryState(
  raw: RawCompanySummaryState,
): AppCompanySummaryState {
  return {
    rowId:                 raw.Id,
    companyUid:            raw.company_uid ?? '',
    summaryType:           raw.summary_type ?? 'default',
    aiSummary:             raw.ai_summary ?? '',
    overallHealth:         raw.overall_health ?? '',
    keyRisks:              safeParseJsonArray(raw.key_risks),
    keyOpportunities:      safeParseJsonArray(raw.key_opportunities),
    recommendedNextAction: raw.recommended_next_action ?? '',
    model:                 raw.model ?? '',
    aiVersion:             raw.ai_version ?? null,
    sourceUpdatedAt:       raw.source_updated_at ?? null,
    lastAiUpdatedAt:       raw.last_ai_updated_at ?? null,
    evidenceCount:         raw.evidence_count ?? 0,
    alertCount:            raw.alert_count ?? 0,
    peopleCount:           raw.people_count ?? 0,
    humanReviewStatus:     raw.human_review_status ?? null,
    reviewedBy:            raw.reviewed_by ?? null,
    reviewedAt:            raw.reviewed_at ?? null,
    appliedPolicyId:       raw.applied_policy_id ?? null,
  };
}

// ── CSM_customer_phase ────────────────────────────────────────────────────────
// source of truth: csm_customer_phase テーブル（M-Phase 管理）
//   実カラム: M-Phase（raw['M-Phase']）, sf_cs（cs owner）, stat_date（更新日時）
//   ※ phase_updated_at / cs_owner / m_phase はコード側の旧フィールド名。実テーブルには存在しない。
//   sort は stat_date（phase_updated_at は存在しない → NocoDB が 0件返す）
// CSM 担当がいる企業の M-Phase 管理テーブル。
// 1企業につき 1 レコードを想定（複数バージョンがある場合は latest を使う）。

export interface RawCsmPhase {
  Id:                  number;
  company_uid?:        string | null;
  m_phase?:            string | null;  // フェーズ値 例: "Onboarding" | "Adoption" | "Renewal" | "Churn Risk"
  phase_label?:        string | null;  // 表示用ラベル（m_phase の日本語訳など）
  phase_updated_at?:   string | null;  // フェーズ更新日時
  cs_owner?:           string | null;  // CSM 担当者名
  health_score?:       number | null;  // 担当者入力の健全性スコア（0-100）
  target_renewal_date?: string | null; // 更新予定日
  note?:               string | null;  // 担当メモ
  [key: string]: unknown;
}

export interface AppCsmPhase {
  companyUid:         string;
  mPhase:             string | null;
  phaseLabel:         string | null;
  phaseUpdatedAt:     string | null;  // "YYYY-MM-DD" or "YYYY-MM-DD HH:mm"
  csOwner:            string | null;
  healthScore:        number | null;
  targetRenewalDate:  string | null;
  note:               string | null;
}

export function toAppCsmPhase(raw: RawCsmPhase): AppCsmPhase {
  // 実テーブルのカラム名: "M-Phase", "sf_cs", "stat_date" — ドット記法不可のため index アクセス
  const mPhase = (raw['M-Phase'] ?? raw.m_phase ?? null) as string | null;
  const csOwner = (raw.sf_cs ?? raw.cs_owner ?? null) as string | null;
  const updatedAt = (raw.stat_date ?? raw.phase_updated_at ?? null) as string | null;
  return {
    companyUid:        raw.company_uid ?? '',
    mPhase,
    phaseLabel:        (raw.phase_label as string | null) ?? mPhase,
    phaseUpdatedAt:    updatedAt ? String(updatedAt).slice(0, 10) : null,
    csOwner,
    healthScore:       raw.health_score != null ? Number(raw.health_score) : null,
    targetRenewalDate: raw.target_renewal_date
                         ? String(raw.target_renewal_date).slice(0, 10)
                         : null,
    note:              raw.note ?? null,
  };
}

// ── CRM_customer_phase ────────────────────────────────────────────────────────
// source of truth: crm_customer_phase テーブル（A-Phase 管理）
//   実カラム: A-Phase（raw['A-Phase']）, CSM（crm owner）, stat_date（更新日時）
//   ※ phase_updated_at / crm_owner / a_phase はコード側の旧フィールド名。実テーブルには存在しない。
//   sort は stat_date（phase_updated_at は存在しない → NocoDB が 0件返す）
// CRM 起点の A-Phase 管理テーブル。
// CSM 担当がいない企業のフォールバック表示に使用。

export interface RawCrmPhase {
  Id:                  number;
  company_uid?:        string | null;
  a_phase?:            string | null;  // A-Phase 値 例: "Prospect" | "Onboarding" | "Active" | "Renewal"
  phase_label?:        string | null;
  phase_updated_at?:   string | null;
  crm_owner?:          string | null;  // CRM 担当者名
  arr?:                number | null;  // 年間契約額（ARR）
  contract_start_date?: string | null;
  contract_end_date?:  string | null;
  note?:               string | null;
  [key: string]: unknown;
}

export interface AppCrmPhase {
  companyUid:        string;
  aPhase:            string | null;
  phaseLabel:        string | null;
  phaseUpdatedAt:    string | null;
  crmOwner:          string | null;
  arr:               number | null;
  contractStartDate: string | null;
  contractEndDate:   string | null;
  note:              string | null;
}

export function toAppCrmPhase(raw: RawCrmPhase): AppCrmPhase {
  // 実テーブルのカラム名: "A-Phase", "CSM" (CRM owner), "stat_date"
  const aPhase = (raw['A-Phase'] ?? raw.a_phase ?? null) as string | null;
  const crmOwner = (raw['CSM'] ?? raw.crm_owner ?? null) as string | null;
  const updatedAt = (raw.stat_date ?? raw.phase_updated_at ?? null) as string | null;
  return {
    companyUid:        raw.company_uid ?? '',
    aPhase,
    phaseLabel:        (raw.phase_label as string | null) ?? aPhase,
    phaseUpdatedAt:    updatedAt ? String(updatedAt).slice(0, 10) : null,
    crmOwner,
    arr:               raw.arr != null ? Number(raw.arr) : null,
    contractStartDate: raw.contract_start_date
                         ? String(raw.contract_start_date).slice(0, 10)
                         : null,
    contractEndDate:   raw.contract_end_date
                         ? String(raw.contract_end_date).slice(0, 10)
                         : null,
    note:              raw.note ?? null,
  };
}

// ── project_info ──────────────────────────────────────────────────────────────
// 1企業配下の複数プロジェクトを管理するテーブル。
//
// ⚠️ 実テーブル (mse3eosn7551z82) の注意点:
//   - company_uid カラムが存在しない。代わりに master_company_sf_id (= sf_account_id) でリンク
//   - status カラムなし。l30_active / habituation_status / paid_type で導出
//   - last_updated_at カラムなし。latest_order_end_date / project_create_time を使用
//   - project_id, project_name は存在

export interface RawProjectInfo {
  Id:              number;
  company_uid?:    string | null;           // 存在しない（互換用フィールド）
  project_id?:     string | null;           // 実テーブル: project_id ✓
  project_name?:   string | null;           // 実テーブル: project_name ✓
  // ── 実テーブルの実カラム ──────────────────────────────────────────────────
  master_company_sf_id?: string | null;     // SF Account ID（company_uid の代替 FK）
  habituation_status?:   string | null;     // "True" / "False"
  l30_active?:           number | null;     // 過去30日アクティブイベント数
  paid_type?:            string | null;     // "PTI-PAID" / "PTX-PAID" / "FREE"
  project_create_time?:  string | null;     // プロジェクト作成日時
  latest_order_end_date?: string | null;    // 最新契約終了日
  // ── 互換用（将来テーブルが正規化された場合のフォールバック）────────────────
  status?:         string | null;
  start_date?:     string | null;
  last_updated_at?: string | null;
  description?:    string | null;
  use_case?:       string | null;
  health?:         string | null;
  [key: string]: unknown;
}

export interface AppProjectInfo {
  id:                 string;  // project_id or NocoDB Id
  companyUid:         string;
  sfAccountId:        string | null;  // master_company_sf_id（join キー）
  name:               string;
  status:             'active' | 'stalled' | 'unused' | 'inactive';
  startDate:          string | null;
  lastUpdatedAt:      string | null;
  description:        string;
  useCase:            string | null;
  health:             'high' | 'medium' | 'low' | null;
  paidType:           string | null;  // "PTI-PAID" / "PTX-PAID" / "FREE"
  // ── 利用状況シグナル（UI + AI 用）────────────────────────────────────────
  /** 過去30日アクティブイベント数（利用活動量の直接指標） */
  l30Active:          number | null;
  /** 活用済みフラグ（habituation_status = "True"） */
  habituationStatus:  boolean | null;
  /** 最新契約終了日（upsell / renewal タイミング判定用） */
  latestOrderEndDate: string | null;
}

/**
 * @param raw         NocoDB から取得した生レコード
 * @param companyUid  呼び出し元で確定している company_uid（raw に存在しないため上書き注入）
 */
export function toAppProjectInfo(raw: RawProjectInfo, companyUid?: string): AppProjectInfo {
  // ── status 導出: 実テーブルには status カラムなし ────────────────────────
  // 優先順位: 既存 status フィールド → l30_active / habituation_status / paid_type から推定
  let status: AppProjectInfo['status'] = 'inactive';
  if (raw.status) {
    const s = String(raw.status).toLowerCase();
    status = s === 'active' ? 'active' : s === 'stalled' ? 'stalled' : s === 'never_activated' ? 'unused' : 'inactive';
  } else {
    const l30 = raw.l30_active != null ? Number(raw.l30_active) : 0;
    const hab  = String(raw.habituation_status ?? '').toLowerCase() === 'true';
    const paid = String(raw.paid_type ?? '').toUpperCase();
    if (l30 > 0 || hab) {
      status = 'active';
    } else if (paid === 'FREE') {
      status = 'unused';
    } else {
      status = 'inactive';
    }
  }

  const rawHealth = String(raw.health ?? '').toLowerCase();
  const health: AppProjectInfo['health'] =
    rawHealth === 'high'   ? 'high'
    : rawHealth === 'medium' ? 'medium'
    : rawHealth === 'low'    ? 'low'
    : null;

  const lastUpdatedRaw = raw.last_updated_at ?? raw.latest_order_end_date ?? null;
  const startDateRaw   = raw.start_date ?? raw.project_create_time ?? null;

  return {
    id:                 raw.project_id ? String(raw.project_id) : String(raw.Id),
    companyUid:         companyUid ?? raw.company_uid ?? '',
    sfAccountId:        (raw.master_company_sf_id as string | null | undefined) ?? null,
    name:               raw.project_name ? String(raw.project_name) : '(名前なし)',
    status,
    startDate:          startDateRaw ? String(startDateRaw).slice(0, 10) : null,
    lastUpdatedAt:      lastUpdatedRaw ? String(lastUpdatedRaw).slice(0, 10) : null,
    description:        raw.description ? String(raw.description) : '',
    useCase:            raw.use_case ? String(raw.use_case) : null,
    health,
    paidType:           (raw.paid_type as string | null | undefined) ?? null,
    l30Active:          raw.l30_active != null ? Number(raw.l30_active) : null,
    habituationStatus:  raw.habituation_status != null
      ? String(raw.habituation_status).toLowerCase() === 'true'
      : null,
    latestOrderEndDate: raw.latest_order_end_date
      ? String(raw.latest_order_end_date).slice(0, 10)
      : null,
  };
}

// ── log_chatwork ──────────────────────────────────────────────────────────────
// Chatwork のコミュニケーションログ。company_uid でフィルタして取得する。

export interface RawLogChatwork {
  Id:           number;
  company_uid?: string | null;
  message_id?:  string | null;
  sent_at?:     string | null;
  sender_name?: string | null;
  room_name?:   string | null;   // Chatwork ルーム名
  body?:        string | null;   // メッセージ本文
  is_outbound?: boolean | null;  // CSM 側からの送信か
  [key: string]: unknown;
}

export interface AppLogChatwork {
  id:          string;
  companyUid:  string;
  sentAt:      string | null;
  senderName:  string | null;
  roomName:    string | null;
  body:        string;
  isOutbound:  boolean;
}

export function toAppLogChatwork(raw: RawLogChatwork): AppLogChatwork {
  // 実テーブルのカラム名: sent_at_jst, account_name, channel_id
  const sentAtRaw = (raw.sent_at_jst ?? raw.sent_at ?? null) as string | null;
  const senderName = (raw.account_name ?? raw.sender_name ?? null) as string | null;
  const roomName = (raw.channel_id ?? raw.room_name ?? null) as string | null;
  return {
    id:          raw.message_id ? String(raw.message_id) : String(raw.Id),
    companyUid:  raw.company_uid ?? '',
    sentAt:      sentAtRaw ? String(sentAtRaw).slice(0, 16).replace('T', ' ') : null,
    senderName,
    roomName,
    body:        raw.body ? String(raw.body) : '',
    isOutbound:  Boolean(raw.is_outbound),
  };
}

// ── log_slack ─────────────────────────────────────────────────────────────────
// Slack のコミュニケーションログ。

export interface RawLogSlack {
  Id:           number;
  company_uid?: string | null;
  message_id?:  string | null;   // Slack ts
  sent_at?:     string | null;
  user_name?:   string | null;
  channel?:     string | null;
  text?:        string | null;   // メッセージ本文
  thread_ts?:   string | null;   // スレッド親 ts
  is_outbound?: boolean | null;
  [key: string]: unknown;
}

export interface AppLogSlack {
  id:          string;
  companyUid:  string;
  sentAt:      string | null;
  userName:    string | null;
  channel:     string | null;
  text:        string;
  threadTs:    string | null;
  isOutbound:  boolean;
}

export function toAppLogSlack(raw: RawLogSlack): AppLogSlack {
  // 実テーブルのカラム名: sent_at_jst, account_name, channel_id, body
  const sentAtRaw = (raw.sent_at_jst ?? raw.sent_at ?? null) as string | null;
  const userName = (raw.account_name ?? raw.user_name ?? null) as string | null;
  const channel = (raw.channel_id ?? raw.channel ?? null) as string | null;
  const text = (raw.body ?? raw.text ?? '') as string;
  return {
    id:          raw.message_id ? String(raw.message_id) : String(raw.Id),
    companyUid:  raw.company_uid ?? '',
    sentAt:      sentAtRaw ? String(sentAtRaw).slice(0, 16).replace('T', ' ') : null,
    userName,
    channel,
    text:        text ? String(text) : '',
    threadTs:    raw.thread_ts ?? null,
    isOutbound:  Boolean(raw.is_outbound),
  };
}

// ── log_notion_minutes ────────────────────────────────────────────────────────
// Notion 議事録ログ。meeting_date でソートして最新を表示する。

export interface RawLogNotionMinutes {
  Id:            number;
  company_uid?:  string | null;
  page_id?:      string | null;
  title?:        string | null;
  meeting_date?: string | null;
  participants?: string | null;  // カンマ区切り or JSON 配列文字列
  body?:         string | null;  // 議事録本文
  action_items?: string | null;  // アクション項目（JSON 配列文字列）
  created_at?:   string | null;
  [key: string]: unknown;
}

export interface AppLogNotionMinutes {
  id:           string;
  companyUid:   string;
  title:        string;
  meetingDate:  string | null;
  participants: string[];
  body:         string;
  actionItems:  string[];
  createdAt:    string | null;
}

export function toAppLogNotionMinutes(raw: RawLogNotionMinutes): AppLogNotionMinutes {
  // 実テーブルのカラム名: page_name (title), creat_at_jst (meeting_date/created_at)
  const title = (raw.page_name ?? raw.title ?? null) as string | null;
  const dateRaw = (raw.creat_at_jst ?? raw.meeting_date ?? raw.created_at ?? null) as string | null;
  return {
    id:           raw.page_id ? String(raw.page_id) : String(raw.Id),
    companyUid:   raw.company_uid ?? '',
    title:        title ? String(title) : '(タイトルなし)',
    meetingDate:  dateRaw ? String(dateRaw).slice(0, 10) : null,
    participants: parseParticipants(raw.participants),
    body:         raw.body ? String(raw.body) : '',
    actionItems:  parseStringJsonArray(raw.action_items),
    createdAt:    dateRaw ? String(dateRaw).slice(0, 16).replace('T', ' ') : null,
  };
}

function parseParticipants(v: unknown): string[] {
  if (!v) return [];
  const str = String(v).trim();
  // JSON 配列形式 ["A","B"] か カンマ区切り "A,B" かを判定
  if (str.startsWith('[')) {
    try { const arr = JSON.parse(str); return Array.isArray(arr) ? arr.map(String) : []; }
    catch { return []; }
  }
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

function parseStringJsonArray(v: unknown): string[] {
  if (!v) return [];
  try { const arr = JSON.parse(String(v)); return Array.isArray(arr) ? arr.map(String) : []; }
  catch { return []; }
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

// ─── Company Action ──────────────────────────────────────────────────────────

export interface RawCompanyAction {
  Id: number;
  action_id?: string | null;
  company_uid?: string | null;
  title?: string | null;
  /** NocoDB カラム名は description（アプリ内では body として扱う）*/
  description?: string | null;
  owner?: string | null;
  due_date?: string | null;
  /** open / in_progress / done / cancelled */
  status?: string | null;
  /** manual / risk_signal / opportunity_signal / support_case / people_risk */
  created_from?: string | null;
  source_ref?: string | null;
  person_ref?: string | null;
  /** not_synced / synced / sync_error */
  sf_todo_status?: string | null;
  sf_todo_id?: string | null;
  /** SF Task 最終同期日時（ISO 8601） */
  sf_last_synced_at?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface AppCompanyAction {
  /** NocoDB row Id（PATCH 時に使用） */
  rowId: number;
  /** アプリ生成 UUID */
  id: string;
  companyUid: string;
  title: string;
  body: string;
  owner: string;
  dueDate: string | null;
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  createdFrom: 'manual' | 'risk_signal' | 'opportunity_signal' | 'support_case' | 'people_risk';
  sourceRef: string | null;
  personRef: string | null;
  sfTodoStatus: 'not_synced' | 'synced' | 'sync_error' | null;
  sfTodoId: string | null;
  /** SF Task 最終同期日時（ISO 8601） */
  sfLastSyncedAt: string | null;
  createdAt: string;
}

const ACTION_STATUS_VALUES = new Set(['open', 'in_progress', 'done', 'cancelled']);
const ACTION_CREATED_FROM_VALUES = new Set([
  'manual', 'risk_signal', 'opportunity_signal', 'support_case', 'people_risk',
]);
const SF_TODO_STATUS_VALUES = new Set(['not_synced', 'synced', 'sync_error']);

export function toAppCompanyAction(raw: RawCompanyAction): AppCompanyAction {
  const rawStatus = s(raw.status, 'open');
  const status = ACTION_STATUS_VALUES.has(rawStatus)
    ? rawStatus as AppCompanyAction['status']
    : 'open';

  const rawCreatedFrom = s(raw.created_from, 'manual');
  const createdFrom = ACTION_CREATED_FROM_VALUES.has(rawCreatedFrom)
    ? rawCreatedFrom as AppCompanyAction['createdFrom']
    : 'manual';

  const rawSfTodoStatus = raw.sf_todo_status ? s(raw.sf_todo_status) : null;
  const sfTodoStatus = rawSfTodoStatus && SF_TODO_STATUS_VALUES.has(rawSfTodoStatus)
    ? rawSfTodoStatus as AppCompanyAction['sfTodoStatus']
    : null;

  return {
    rowId:       raw.Id,
    id:          s(raw.action_id, String(raw.Id)),
    companyUid:  s(raw.company_uid, ''),
    title:       s(raw.title, '(タイトルなし)'),
    body:        s(raw.description, ''),
    owner:       s(raw.owner, ''),
    dueDate:     raw.due_date ? String(raw.due_date).slice(0, 10) : null,
    status,
    createdFrom,
    sourceRef:   raw.source_ref   ? s(raw.source_ref)   : null,
    personRef:   raw.person_ref   ? s(raw.person_ref)   : null,
    sfTodoStatus,
    sfTodoId:        raw.sf_todo_id        ? s(raw.sf_todo_id)        : null,
    sfLastSyncedAt:  raw.sf_last_synced_at ? s(raw.sf_last_synced_at) : null,
    createdAt:   raw.created_at
      ? String(raw.created_at).slice(0, 19).replace('T', ' ')
      : (raw.CreatedAt ? String(raw.CreatedAt).slice(0, 19).replace('T', ' ') : new Date().toISOString()),
  };
}

// ─── Company People（CXM マネージド連絡先）─────────────────────────────────────
//
// 既存の people テーブル（TABLE_IDS.people）は Salesforce 同期データで読み取り専用。
// company_people テーブルは CSM が CXM 上で追加・編集する連絡先を永続化する。
// 表示時は両テーブルをマージして allContacts を構成する。

export interface RawCompanyPerson {
  Id: number;
  /** アプリ生成 UUID */
  person_id?: string | null;
  company_uid?: string | null;
  name?: string | null;
  /** Champion / Economic Buyer / User など CXM 上の役割ラベル */
  role?: string | null;
  /** 実際の職名（例: プロダクトマネージャー） */
  title?: string | null;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  /** high / medium / low / unknown */
  decision_influence?: string | null;
  /** active / contacted / not contacted / inactive / unknown */
  contact_status?: string | null;
  /** confirmed / proposed / unresolved */
  status?: string | null;
  /** YYYY-MM-DD */
  last_touchpoint?: string | null;
  /** 上長の person_id（org chart 階層構築用） */
  manager_id?: string | null;
  // ── Org chart 拡張カラム（追加予定） ─────────────────────────────────────────
  layer_role?:            string | null;
  is_executive?:          boolean | null;
  is_department_head?:    boolean | null;
  reports_to_person_id?:  string | null;
  works_with_person_ids?: string | null;  // JSON 配列文字列
  display_group?:         string | null;
  stakeholder_note?:      string | null;
  /** CSM担当名 */
  owner?: string | null;
  /** salesforce / cxm / unknown */
  source?: string | null;
  /** Salesforce Contact ID */
  sf_id?: string | null;
  /** not_synced / pending / synced / sync_error */
  sync_status?: string | null;
  sf_last_synced_at?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

const DECISION_INFLUENCE_VALUES = new Set(['high', 'medium', 'low', 'unknown']);
const CONTACT_STATUS_VALUES = new Set(['active', 'contacted', 'not contacted', 'inactive', 'unknown']);
const PERSON_STATUS_VALUES   = new Set(['confirmed', 'proposed', 'unresolved']);
const PERSON_SOURCE_VALUES   = new Set(['salesforce', 'cxm', 'unknown']);
const SYNC_STATUS_VALUES     = new Set(['not_synced', 'pending', 'synced', 'sync_error']);

export function toAppPersonFromCompanyPeople(raw: RawCompanyPerson): AppPerson {
  const rawInfluence = s(raw.decision_influence, 'unknown');
  const decisionInfluence = DECISION_INFLUENCE_VALUES.has(rawInfluence)
    ? rawInfluence as AppPerson['decisionInfluence']
    : 'unknown';

  const rawContactStatus = s(raw.contact_status, 'unknown');
  const contactStatus = CONTACT_STATUS_VALUES.has(rawContactStatus)
    ? rawContactStatus as AppPerson['contactStatus']
    : 'unknown';

  const rawStatus = s(raw.status, 'proposed');
  const status = PERSON_STATUS_VALUES.has(rawStatus)
    ? rawStatus as AppPerson['status']
    : 'proposed';

  const rawSource = raw.source ? s(raw.source) : 'cxm';
  const source = PERSON_SOURCE_VALUES.has(rawSource)
    ? rawSource as NonNullable<AppPerson['source']>
    : 'cxm';

  const rawSyncStatus = raw.sync_status ? s(raw.sync_status) : null;
  const syncStatus = rawSyncStatus && SYNC_STATUS_VALUES.has(rawSyncStatus)
    ? rawSyncStatus as NonNullable<AppPerson['syncStatus']>
    : null;

  return {
    rowId:             raw.Id,
    id:                s(raw.person_id, String(raw.Id)),
    name:              s(raw.name, '(名前なし)'),
    role:              s(raw.role, ''),
    title:             raw.title    ? s(raw.title)      : undefined,
    department:        raw.department ? s(raw.department) : undefined,
    roleType:          s(raw.role, ''),
    decisionInfluence,
    contactStatus,
    company:           s(raw.company_uid, ''),
    email:             raw.email  ? s(raw.email)  : undefined,
    phone:             raw.phone  ? s(raw.phone)  : undefined,
    status,
    evidenceCount:     0,
    lastTouchpoint:    raw.last_touchpoint ? String(raw.last_touchpoint).slice(0, 10) : null,
    linkedProjects:    [],
    owner:             raw.owner  ? s(raw.owner)  : undefined,
    source,
    sfId:              raw.sf_id           ? s(raw.sf_id)           : null,
    syncStatus,
    sfLastSyncedAt:    raw.sf_last_synced_at
      ? String(raw.sf_last_synced_at).slice(0, 19).replace('T', ' ')
      : null,
    managerId:         raw.manager_id ? s(raw.manager_id) : null,
    // ── 拡張フィールド（カラム未追加時は null/undefined のまま）──────────────
    layerRole:         raw.layer_role           ? s(raw.layer_role)           : null,
    isExecutive:       raw.is_executive         ?? null,
    isDepartmentHead:  raw.is_department_head   ?? null,
    reportsToPersonId: raw.reports_to_person_id ? s(raw.reports_to_person_id) : null,
    worksWithPersonIds: (() => {
      if (!raw.works_with_person_ids) return null;
      try { return JSON.parse(String(raw.works_with_person_ids)) as string[]; }
      catch { return null; }
    })(),
    displayGroup:      raw.display_group      ? s(raw.display_group)      : null,
    stakeholderNote:   raw.stakeholder_note   ? s(raw.stakeholder_note)   : null,
  };
}
