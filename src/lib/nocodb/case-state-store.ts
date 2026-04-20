// ─── NocoDB: support_case_state read/write ───────────────────────────────────
// サーバーサイド専用（API Routes から呼び出す）。
// 1 ケース 1 レコード（case_id が主キー相当）。
// UI からは直接呼ばず、API Routes を経由すること。

import { nocoFetch } from './client';
import { nocoCreate, nocoUpdate } from './write';
import { TABLE_IDS } from './client';
import type {
  DismissRecord,
  ActionRecord,
  CseTicketRecord,
  ActionStatus,
  CseTicketStatus,
} from '../support/case-state';

// ── Raw NocoDB レコード型 ──────────────────────────────────────────────────

export interface RawSupportCaseState {
  Id:                    number;
  case_id?:              string | null;
  // dismiss
  dismissed?:            boolean | null;
  dismissed_at?:         string | null;
  dismissed_by?:         string | null;
  dismissed_reason?:     string | null;
  undismissed_at?:       string | null;
  undismissed_by?:       string | null;
  // action
  has_action?:           boolean | null;
  action_created_at?:    string | null;
  action_updated_at?:    string | null;
  action_id?:            string | null;
  action_status?:        string | null;
  action_owner?:         string | null;
  action_title?:         string | null;
  // cse ticket
  has_cse_ticket?:       boolean | null;
  cse_created_at?:       string | null;
  cse_updated_at?:       string | null;
  cse_ticket_id?:        string | null;
  cse_status?:           string | null;
  cse_owner?:            string | null;
  cse_title?:            string | null;
  // metadata
  updated_at?:           string | null;
  [key: string]: unknown;
}

// ── Raw → CaseStateRecord 変換 ────────────────────────────────────────────

import type { CaseStateRecord } from '../support/case-state';

export function toCaseStateRecord(raw: RawSupportCaseState): CaseStateRecord {
  const dismiss: DismissRecord | null = raw.dismissed
    ? {
        active:           raw.dismissed ?? false,
        dismissed_at:     raw.dismissed_at     ?? new Date().toISOString(),
        dismissed_by:     raw.dismissed_by     ?? null,
        dismissed_reason: raw.dismissed_reason ?? null,
        undismissed_at:   raw.undismissed_at   ?? null,
        undismissed_by:   raw.undismissed_by   ?? null,
      }
    : null;

  const action: ActionRecord | null = raw.has_action
    ? {
        created_at: raw.action_created_at ?? new Date().toISOString(),
        updated_at: raw.action_updated_at ?? new Date().toISOString(),
        action_id:  raw.action_id         ?? null,
        status:     (raw.action_status    ?? 'open') as ActionStatus,
        owner:      raw.action_owner      ?? null,
        title:      raw.action_title      ?? null,
      }
    : null;

  const cseTicket: CseTicketRecord | null = raw.has_cse_ticket
    ? {
        created_at: raw.cse_created_at  ?? new Date().toISOString(),
        updated_at: raw.cse_updated_at  ?? new Date().toISOString(),
        ticket_id:  raw.cse_ticket_id   ?? null,
        status:     (raw.cse_status     ?? 'open') as CseTicketStatus,
        owner:      raw.cse_owner       ?? null,
        title:      raw.cse_title       ?? null,
      }
    : null;

  return {
    id:        raw.case_id ?? String(raw.Id),
    dismiss,
    action,
    cseTicket,
  };
}

// ── Read helpers ──────────────────────────────────────────────────────────

/**
 * 1 件のケース状態を NocoDB から取得する。
 * 存在しない場合は null を返す。
 */
export async function getCaseStateFromNoco(
  caseId: string,
): Promise<CaseStateRecord | null> {
  const tableId = TABLE_IDS.support_case_state;
  if (!tableId) return null;

  const list = await nocoFetch<RawSupportCaseState>(tableId, {
    where: `(case_id,eq,${caseId})`,
    limit: '1',
  });
  if (list.length === 0) return null;
  return toCaseStateRecord(list[0]);
}

/**
 * 複数のケース状態を一括取得する。
 * ids が空の場合は空 Map を返す。
 */
export async function getCaseStatesFromNoco(
  caseIds: string[],
): Promise<Map<string, CaseStateRecord>> {
  const result = new Map<string, CaseStateRecord>();
  if (caseIds.length === 0) return result;

  const tableId = TABLE_IDS.support_case_state;
  if (!tableId) return result;

  // NocoDB の OR フィルタ: (case_id,eq,A)~or(case_id,eq,B)...
  const where = caseIds.map(id => `(case_id,eq,${id})`).join('~or');
  const list = await nocoFetch<RawSupportCaseState>(tableId, {
    where,
    limit: String(caseIds.length + 10),
  });

  for (const raw of list) {
    if (!raw.case_id) continue;
    result.set(raw.case_id, toCaseStateRecord(raw));
  }
  return result;
}

// ── Write helper ──────────────────────────────────────────────────────────

export interface UpsertCaseStatePayload {
  // dismiss
  dismissed?:         boolean;
  dismissed_at?:      string | null;
  dismissed_by?:      string | null;
  dismissed_reason?:  string | null;
  undismissed_at?:    string | null;
  undismissed_by?:    string | null;
  // action
  has_action?:        boolean;
  action_created_at?: string | null;
  action_updated_at?: string | null;
  action_id?:         string | null;
  action_status?:     string | null;
  action_owner?:      string | null;
  action_title?:      string | null;
  // cse ticket
  has_cse_ticket?:    boolean;
  cse_created_at?:    string | null;
  cse_updated_at?:    string | null;
  cse_ticket_id?:     string | null;
  cse_status?:        string | null;
  cse_owner?:         string | null;
  cse_title?:         string | null;
  // metadata
  updated_at?:        string;
}

/**
 * case_id で検索して存在すれば更新、なければ新規作成する。
 * 常に最新の CaseStateRecord を返す。
 */
export async function upsertCaseState(
  caseId: string,
  patch: UpsertCaseStatePayload,
): Promise<CaseStateRecord> {
  const tableId = TABLE_IDS.support_case_state;
  if (!tableId) {
    throw new Error('NOCODB_SUPPORT_CASE_STATE_TABLE_ID が未設定です');
  }

  const now = new Date().toISOString();
  const payload = { case_id: caseId, updated_at: now, ...patch };

  // 既存レコードを検索
  const list = await nocoFetch<RawSupportCaseState>(tableId, {
    where: `(case_id,eq,${caseId})`,
    limit: '1',
  });

  let raw: RawSupportCaseState;
  if (list.length > 0) {
    raw = await nocoUpdate<RawSupportCaseState>(tableId, list[0].Id, payload);
  } else {
    raw = await nocoCreate<RawSupportCaseState>(tableId, payload);
  }

  return toCaseStateRecord(raw);
}
