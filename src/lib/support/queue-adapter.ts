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
/**
 * open_duration_minutes（数値）を "1h 30m" / "45m" 等の表示文字列に変換する。
 * 旧フィールド open_duration（文字列）が存在する場合はそちらを優先する。
 */
function formatOpenDuration(
  minutes: number | null | undefined,
  legacyStr: string | null | undefined,
): string {
  if (legacyStr) return String(legacyStr);
  if (minutes == null || minutes <= 0) return '';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

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
  title: string;        // 一覧: source.display_title のみ（fallback なし。getUnifiedQueueList の hasDisplayTitle フィルタ通過後は必ず非空）
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

/**
 * タイトル解決（優先順位）:
 * 1. source.display_title  — 同期スクリプトが書き込んだ AI 生成タイトル（最高品質）
 * 2. aiState.displayTitle  — support_case_ai_state の display_title（後方互換）
 * 3. source.title          — cse_tickets 等が持つ元タイトル
 * 4. body 先頭抜粋         — raw body / description の冒頭
 * 5. aiState.summary 先頭  — body もない場合の最終手段
 * 6. '(タイトルなし)'      — fallback
 */
export function resolveTitle(
  sourceDisplayTitle: string | null | undefined,  // raw.display_title（同期キャッシュ）
  sourceTitle: string | null | undefined,          // raw.title（cse_tickets 等）
  body: string | null | undefined,                 // raw.body / raw.description
  aiState?: AppSupportCaseAIState | null,
): string {
  // 1. source.display_title（同期スクリプトが書き込んだ AI タイトル）
  const sd = sourceDisplayTitle ? String(sourceDisplayTitle).trim() : '';
  if (sd) return sd;

  // 2. aiState.displayTitle（support_case_ai_state — 後方互換）
  if (aiState?.displayTitle) return aiState.displayTitle;

  // 3. source.title（cse_tickets の title カラム等）
  const st = sourceTitle ? String(sourceTitle).trim() : '';
  if (st) return st;

  // 4. body 先頭抜粋
  const excerpt = excerptFrom(body);
  if (excerpt) return excerpt.length > 40 ? excerpt.slice(0, 38) + '…' : excerpt;

  // 5. aiState.summary 先頭（body も title も全くない場合）
  if (aiState?.summary) {
    const sm = aiState.summary.trim();
    return sm.length > 40 ? sm.slice(0, 38) + '…' : sm;
  }

  // 6. fallback
  return '(タイトルなし)';
}

// ── log_intercom → QueueItem ──────────────────────────────────────────────────

const CASE_TYPE_MAP: Record<string, string> = {
  inquiry:    'Inquiry',
  support:    'Support',
  billing:    'Billing',
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
  const mtMapped = CASE_TYPE_MAP[mt];
  if (mtMapped) return mtMapped;
  return 'Support'; // fallback: Support（Inquiry / Billing に寄らない）
}

export function fromLogIntercomRecord(
  raw: RawSupportCase,
  aiState?: AppSupportCaseAIState | null,
): QueueItem | null {
  // 一覧掲載条件: source.display_title が trim 後 non-empty であること
  // fallback（body 抜粋・aiState・raw title）は一切使わない
  const displayTitle = raw.display_title?.trim() ?? '';
  if (!displayTitle) return null;

  // routing_status: スペースを _ に変換してから MAP lookup
  const rawStatus = s(raw.routing_status).toLowerCase().replace(/\s+/g, '_');

  // 本文: log_intercom は body カラムを使用（original_message は存在しない）
  const body = raw.body ? s(raw.body) : undefined;

  // 会社名: account_name（Intercom のアカウント名） → sanitized company_uid → '—'
  // log_intercom に company_name カラムは存在しない
  const companyUid = sanitizeUid(raw.company_uid);
  const rawAccountName = raw.account_name ? String(raw.account_name).trim() : '';
  const companyName = rawAccountName || companyUid || '—';

  return {
    id:               raw.case_id ? s(raw.case_id) : String(raw.Id),
    sourceTable:      'log_intercom',
    title:            displayTitle,
    bodyExcerpt:      excerptFrom(body),
    caseType:         deriveCaseType(raw),
    source:           'Intercom',   // log_intercom に source カラムは存在しない → 固定値
    companyUid,
    companyName,
    projectName:      raw.project_name  ? s(raw.project_name)  : null,
    projectId:        raw.project_id    ? s(raw.project_id)    : null,
    owner:            raw.owner_name    ? s(raw.owner_name)    : null,
    assignedTeam:     (raw.team_name ? s(raw.team_name) : null) ?? (raw.assigned_team ? s(raw.assigned_team) : null),
    routingStatus:    ROUTING_STATUS_MAP[rawStatus] ?? 'unassigned',
    sourceStatus:     normalizeStatus(raw.source_status),
    severity:         normalizeSeverity(raw.severity),
    // 日時: log_intercom は sent_at_jst を使用（created_at は存在しない）
    createdAt:        raw.sent_at_jst
                        ? String(raw.sent_at_jst).slice(0, 16).replace('T', ' ')
                        : '—',
    // 初回応答: log_intercom は first_response_at を使用（first_response_time は存在しない）
    firstResponseTime: raw.first_response_at ? s(raw.first_response_at) : null,
    openDuration:     formatOpenDuration(raw.open_duration_minutes, raw.open_duration),
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
): QueueItem | null {
  // 一覧掲載条件: source.display_title が trim 後 non-empty であること
  // fallback（description・aiState・raw title）は一切使わない
  const displayTitle = raw.display_title?.trim() ?? '';
  if (!displayTitle) return null;

  const statusKey = s(raw.status, 'open').toLowerCase().replace(/\s+/g, '_');
  const body = raw.description ? s(raw.description) : undefined;
  const ticketId = raw.ticket_id ? s(raw.ticket_id) : String(raw.Id);
  return {
    id:               ticketId,
    sourceTable:      'cse_tickets',
    title:            displayTitle,
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
  // ── 詳細タイトルの優先順（一覧と異なり fallback あり）────────────────────
  // 1. source.display_title（AI 生成タイトル）
  // 2. aiState.displayTitle（後方互換）
  // 3. body 先頭抜粋
  // 4. '(タイトルなし)'
  const detailTitle =
    raw.display_title?.trim() ||
    aiState?.displayTitle ||
    ((): string => {
      const ex = excerptFrom(raw.body);
      return ex ? (ex.length > 40 ? ex.slice(0, 38) + '…' : ex) : '';
    })() ||
    '(タイトルなし)';

  // ── 詳細本文の優先順 ──────────────────────────────────────────────────────
  // 1. source.display_message（正本: AI 整形済み本文）
  // 2. aiState.displayMessage（後方互換）
  // 3. raw.body（元本文: 整形なし）
  // 4. ''（全て空の場合は空文字。UI 側で「本文なし」と表示する）
  const dm = raw.display_message?.trim();
  const rb = raw.body ? s(raw.body) : '';
  const originalMessage = dm || aiState?.displayMessage || rb;

  // detail 用ベース: fromLogIntercomRecord は display_title が空なら null を返すため
  // ForDetail では display_title チェックをスキップして直接ベースを構築する
  const rawStatus = s(raw.routing_status).toLowerCase().replace(/\s+/g, '_');
  const body = raw.body ? s(raw.body) : undefined;
  const companyUid = sanitizeUid(raw.company_uid);
  const rawAccountName = raw.account_name ? String(raw.account_name).trim() : '';
  const companyName = rawAccountName || companyUid || '—';

  return {
    id:               raw.case_id ? s(raw.case_id) : String(raw.Id),
    sourceTable:      'log_intercom' as const,
    title:            detailTitle,
    bodyExcerpt:      excerptFrom(body),
    caseType:         deriveCaseType(raw),
    source:           'Intercom',
    companyUid,
    companyName,
    projectName:      raw.project_name  ? s(raw.project_name)  : null,
    projectId:        raw.project_id    ? s(raw.project_id)    : null,
    owner:            raw.owner_name    ? s(raw.owner_name)    : null,
    assignedTeam:     (raw.team_name ? s(raw.team_name) : null) ?? (raw.assigned_team ? s(raw.assigned_team) : null),
    routingStatus:    ROUTING_STATUS_MAP[rawStatus] ?? 'unassigned',
    sourceStatus:     normalizeStatus(raw.source_status),
    severity:         normalizeSeverity(raw.severity),
    createdAt:        raw.sent_at_jst
                        ? String(raw.sent_at_jst).slice(0, 16).replace('T', ' ')
                        : '—',
    firstResponseTime: raw.first_response_at ? s(raw.first_response_at) : null,
    openDuration:     formatOpenDuration(raw.open_duration_minutes, raw.open_duration),
    waitingDuration:  raw.waiting_duration ? s(raw.waiting_duration) : null,
    linkedCSETicket:  raw.linked_cse_ticket ? s(raw.linked_cse_ticket) : null,
    relatedContent:   n(raw.related_content_count),
    triageNote:       raw.triage_note ? s(raw.triage_note) : (aiState?.triageNote ?? null),
    originalMessage,
  };
}

// ── cse_tickets → CaseDetail ──────────────────────────────────────────────────

export function fromCseTicketRecordForDetail(
  raw: RawCseTicket,
  aiState?: AppSupportCaseAIState | null,
): CaseDetail {
  // ── 詳細タイトルの優先順（一覧と異なり fallback あり）────────────────────
  // 1. source.display_title（AI 生成タイトル）
  // 2. aiState.displayTitle（後方互換）
  // 3. source.title（cse_tickets の元タイトル）
  // 4. description 先頭抜粋
  // 5. '(タイトルなし)'
  const detailTitle =
    raw.display_title?.trim() ||
    aiState?.displayTitle ||
    (raw.title ? String(raw.title).trim() : '') ||
    ((): string => {
      const ex = excerptFrom(raw.description);
      return ex ? (ex.length > 40 ? ex.slice(0, 38) + '…' : ex) : '';
    })() ||
    '(タイトルなし)';

  // ── 詳細本文の優先順 ──────────────────────────────────────────────────────
  // 1. source.display_message（正本: AI 整形済み本文）
  // 2. aiState.displayMessage（後方互換）
  // 3. raw.description（元本文: 整形なし）
  // 4. ''（全て空の場合は空文字。UI 側で「本文なし」と表示する）
  const dm = raw.display_message?.trim();
  const rd = raw.description ? s(raw.description) : '';
  const originalMessage = dm || aiState?.displayMessage || rd;

  // detail 用ベース: fromCseTicketRecord は display_title が空なら null を返すため
  // ForDetail では display_title チェックをスキップして直接ベースを構築する
  const statusKey = s(raw.status, 'open').toLowerCase().replace(/\s+/g, '_');
  const ticketId = raw.ticket_id ? s(raw.ticket_id) : String(raw.Id);

  return {
    id:               ticketId,
    sourceTable:      'cse_tickets' as const,
    title:            detailTitle,
    bodyExcerpt:      excerptFrom(raw.description ? s(raw.description) : undefined),
    caseType:         raw.linked_case_id ? 'CSE Ticket Linked' : 'CSE Ticket',
    source:           'CSE Ticket',
    companyUid:       sanitizeUid(raw.company_uid),
    companyName:      resolveCompanyName(raw.company_name, raw.company_uid),
    projectName:      null,
    projectId:        null,
    owner:            null,
    assignedTeam:     'CSE',
    routingStatus:    CSE_STATUS_TO_ROUTING[statusKey] ?? 'waiting on CSE',
    sourceStatus:     normalizeStatus(raw.status),
    severity:         normalizeSeverity(raw.priority),
    createdAt:        raw.created_at ? String(raw.created_at).slice(0, 16).replace('T', ' ') : '—',
    firstResponseTime: null,
    openDuration:     '',
    waitingDuration:  raw.waiting_hours != null ? `${raw.waiting_hours}h` : null,
    linkedCSETicket:  ticketId,
    relatedContent:   0,
    triageNote:       aiState?.triageNote ?? null,
    originalMessage,
  };
}
