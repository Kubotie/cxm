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
