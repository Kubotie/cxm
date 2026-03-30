// ─── Support Queue 共通表示モデル + source 別 adapter ─────────────────────────
// log_intercom / cse_tickets それぞれの raw レコードを QueueItem に変換する。
// aiState を渡すと AI タイトル・トリアージ情報も反映される。

import { s, n } from '@/lib/nocodb/types';
import type { RawSupportCase, RawCseTicket, AppSupportCaseAIState } from '@/lib/nocodb/types';

// ── サニタイズ・正規化ヘルパー ───────────────────────────────────────────────

/**
 * company_uid が "Unknown_UID" 等の無効値なら空文字を返す。
 * 空文字が返った場合、Company セルはリンクなし表示にする。
 */
function sanitizeUid(uid: string | null | undefined): string {
  const v = uid ? String(uid).trim() : '';
  if (!v || /unknown/i.test(v)) return '';
  return v;
}

/**
 * 表示用会社名を解決する。
 * company_name があればそれを使い、なければ sanitizeUid 済みの UID をフォールバックとする。
 * UID も無効なら '—'。
 */
function resolveCompanyName(
  rawName: string | null | undefined,
  rawUid: string | null | undefined,
): string {
  const name = rawName ? String(rawName).trim() : '';
  if (name) return name;
  const uid = sanitizeUid(rawUid);
  return uid || '—';
}

/**
 * status 値を画面表示用に正規化する（lowercase + アンダースコアをスペースに）。
 * "in_progress" → "in progress"、"OPEN" → "open" 等。
 */
function normalizeStatus(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return String(raw).toLowerCase().replace(/_/g, ' ');
}

/**
 * severity / priority 値を小文字に正規化する。
 * "High" → "high"、"MEDIUM" → "medium" 等。
 * Badge は小文字で厳密マッチしているため必須。
 */
function normalizeSeverity(raw: string | null | undefined): string {
  if (!raw) return 'medium';
  const v = String(raw).toLowerCase().trim();
  return ['high', 'medium', 'low'].includes(v) ? v : 'medium';
}

// ── 共通表示モデル ─────────────────────────────────────────────────────────────

export interface QueueItem {
  // 識別
  id: string;
  sourceTable: 'log_intercom' | 'cse_tickets';

  // 表示
  title: string;        // resolveTitle() の結果（source > AI displayTitle > AI summary > 本文 > fallback）
  bodyExcerpt: string;  // 本文冒頭（空でも可。tooltip や detail 参照用）

  // 分類
  caseType: string;     // "Support" | "Inquiry" | "CSE Ticket" | "CSE Ticket Linked"
  source: string;       // "Intercom" | "Slack" | "CSE Ticket" etc.

  // 会社・プロジェクト
  companyUid: string;
  companyName: string;
  projectName: string | null;
  projectId: string | null;

  // 担当
  owner: string | null;
  assignedTeam: string | null;

  // ステータス
  routingStatus: string;
  sourceStatus: string | null;
  severity: string;

  // 時系列
  createdAt: string;
  firstResponseTime: string | null;
  openDuration: string;
  waitingDuration: string | null;

  // 関連
  linkedCSETicket: string | null;
  relatedContent: number;

  // AI 診断（aiState がある場合のみ非 null）
  triageNote: string | null;
}

// ── タイトル解決（優先順位付き）───────────────────────────────────────────────

function excerptFrom(text: string | null | undefined): string {
  if (!text) return '';
  return String(text).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function resolveTitle(
  sourceTitle: string | null | undefined,
  body: string | null | undefined,
  aiState?: AppSupportCaseAIState | null,
): string {
  // 1. source title（DB の title カラム）
  const src = sourceTitle ? String(sourceTitle).trim() : '';
  if (src) return src;

  // 2. AI display_title（サマリー生成時に生成・保存された表示タイトル）
  if (aiState?.displayTitle) return aiState.displayTitle;

  // 3. AI summary 先頭（サマリーがある場合）
  if (aiState?.summary) {
    const sm = aiState.summary.trim();
    return sm.length > 40 ? sm.slice(0, 38) + '…' : sm;
  }

  // 4. 本文冒頭
  const excerpt = excerptFrom(body);
  if (excerpt) return excerpt.length > 40 ? excerpt.slice(0, 38) + '…' : excerpt;

  // 5. fallback
  return '(タイトルなし)';
}

// ── log_intercom → QueueItem ──────────────────────────────────────────────────

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
  // NocoDB に "resolved" / "closed" が直接入っているケース
  resolved:            'resolved_like',
  closed:              'resolved_like',
  resolved_like:       'resolved_like',
};

function deriveCaseType(raw: RawSupportCase): string {
  if (raw.case_type) {
    const mapped = CASE_TYPE_MAP[String(raw.case_type).toLowerCase()];
    if (mapped) return mapped;
  }
  const mt = raw.massage_type ? String(raw.massage_type).toLowerCase() : '';
  if (mt === 'support') return 'Support';
  if (mt === 'inquiry') return 'Inquiry';
  return 'Support'; // fallback: Support（Inquiry に寄らない）
}

export function fromLogIntercomRecord(
  raw: RawSupportCase,
  aiState?: AppSupportCaseAIState | null,
): QueueItem {
  // routing_status: スペースを _ に変換してから MAP lookup
  const rawStatus = s(raw.routing_status).toLowerCase().replace(/\s+/g, '_');
  const body = raw.original_message ? s(raw.original_message) : undefined;
  return {
    id:               raw.case_id ? s(raw.case_id) : String(raw.Id),
    sourceTable:      'log_intercom',
    title:            resolveTitle(raw.title, body, aiState),
    bodyExcerpt:      excerptFrom(body),
    caseType:         deriveCaseType(raw),
    source:           s(raw.source, '—'),
    companyUid:       sanitizeUid(raw.company_uid),                             // Unknown_UID → ''
    companyName:      resolveCompanyName(raw.company_name, raw.company_uid),    // Unknown_UID → '—'
    projectName:      raw.project_name  ? s(raw.project_name)  : null,
    projectId:        raw.project_id    ? s(raw.project_id)    : null,
    owner:            raw.owner_name    ? s(raw.owner_name)    : null,
    assignedTeam:     raw.assigned_team ? s(raw.assigned_team) : null,
    routingStatus:    ROUTING_STATUS_MAP[rawStatus] ?? s(raw.routing_status, 'unassigned'),
    sourceStatus:     normalizeStatus(raw.source_status),                       // "in_progress" → "in progress"
    severity:         normalizeSeverity(raw.severity),                          // "High" → "high"
    createdAt:        raw.created_at ? String(raw.created_at).slice(0, 16).replace('T', ' ') : '—',
    firstResponseTime: raw.first_response_time ? s(raw.first_response_time) : null,
    openDuration:     raw.open_duration ? s(raw.open_duration) : '',            // 空文字 = 未取得（'—'と区別）
    waitingDuration:  raw.waiting_duration ? s(raw.waiting_duration) : null,
    linkedCSETicket:  raw.linked_cse_ticket ? s(raw.linked_cse_ticket) : null,
    relatedContent:   n(raw.related_content_count),
    triageNote:       raw.triage_note ? s(raw.triage_note) : (aiState?.triageNote ?? null),
  };
}

// ── cse_tickets → QueueItem ───────────────────────────────────────────────────

const CSE_STATUS_TO_ROUTING: Record<string, string> = {
  open:        'waiting on CSE',
  in_progress: 'in progress',
  resolved:    'resolved_like',
  closed:      'resolved_like',
};

export function fromCseTicketRecord(
  raw: RawCseTicket,
  aiState?: AppSupportCaseAIState | null,
): QueueItem {
  const statusKey = s(raw.status, 'open').toLowerCase().replace(/\s+/g, '_');
  const body = raw.description ? s(raw.description) : undefined;
  const ticketId = raw.ticket_id ? s(raw.ticket_id) : String(raw.Id);
  return {
    id:               ticketId,
    sourceTable:      'cse_tickets',
    title:            resolveTitle(raw.title, body, aiState),
    bodyExcerpt:      excerptFrom(body),
    caseType:         raw.linked_case_id ? 'CSE Ticket Linked' : 'CSE Ticket',
    source:           'CSE Ticket',
    companyUid:       sanitizeUid(raw.company_uid),
    companyName:      resolveCompanyName(raw.company_name, raw.company_uid),
    projectName:      null,
    projectId:        null,
    owner:            null,
    assignedTeam:     'CSE',
    routingStatus:    CSE_STATUS_TO_ROUTING[statusKey] ?? 'waiting on CSE',
    sourceStatus:     normalizeStatus(raw.status),                              // "in_progress" → "in progress"
    severity:         normalizeSeverity(raw.priority),                          // "High" → "high"
    createdAt:        raw.created_at ? String(raw.created_at).slice(0, 16).replace('T', ' ') : '—',
    firstResponseTime: null,
    openDuration:     '',                                                        // cse_tickets に open_duration なし
    waitingDuration:  raw.waiting_hours != null ? `${raw.waiting_hours}h` : null,
    linkedCSETicket:  ticketId,
    relatedContent:   0,
    triageNote:       aiState?.triageNote ?? null,
  };
}

// ── Detail 用モデル ────────────────────────────────────────────────────────────
// QueueItem を継承し、詳細ページで必要な追加フィールドを持つ。
// originalMessage: AI プロンプト入力 + 詳細表示用の元本文。

export interface CaseDetail extends QueueItem {
  originalMessage: string;  // 元の問い合わせ本文（空文字のこともある）
}

// ── log_intercom → CaseDetail ─────────────────────────────────────────────────

export function fromLogIntercomRecordForDetail(
  raw: RawSupportCase,
  aiState?: AppSupportCaseAIState | null,
): CaseDetail {
  return {
    ...fromLogIntercomRecord(raw, aiState),
    originalMessage: raw.original_message ? s(raw.original_message) : '',
  };
}

// ── cse_tickets → CaseDetail ──────────────────────────────────────────────────

export function fromCseTicketRecordForDetail(
  raw: RawCseTicket,
  aiState?: AppSupportCaseAIState | null,
): CaseDetail {
  return {
    ...fromCseTicketRecord(raw, aiState),
    originalMessage: raw.description ? s(raw.description) : '',
  };
}
