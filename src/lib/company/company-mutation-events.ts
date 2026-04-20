// ─── Company Mutation Events ──────────────────────────────────────────────────
//
// Company 配下の Action / Contact / SF ToDo に関する mutation の型定義。
// NOCODB_COMPANY_MUTATION_LOGS_TABLE_ID が設定されている場合は NocoDB の
// company_mutation_logs テーブルへ保存し、未設定時は console.log fallback。
//
// ── company_mutation_logs テーブル 必須カラム ─────────────────────────────────
//   event_type      : Single line text  (action_created / contact_updated など)
//   company_uid     : Single line text
//   entity_id       : Single line text  (actionId / personId など)
//   actor_source    : Single line text  (ui / api / batch)
//   actor_user_id   : Single line text  (任意)
//   actor_user_name : Single line text  (任意)
//   timestamp       : Single line text  (ISO8601)
//   payload_json    : Long text         (イベント全体の JSON 文字列)
//
// 環境変数: NOCODB_COMPANY_MUTATION_LOGS_TABLE_ID
//
// 使い方:
//   const event = buildActionCreatedEvent(companyUid, action, actor);
//   await logMutationEvent(event);

// ── Actor ─────────────────────────────────────────────────────────────────────

export interface MutationActor {
  /** Clerk userId など */
  userId?:   string;
  /** 表示名 */
  userName?: string;
  /** 操作元（'ui' = Web UI, 'api' = 外部API, 'batch' = バッチ処理） */
  source:    'ui' | 'api' | 'batch';
}

// ── Base event ────────────────────────────────────────────────────────────────

interface BaseMutationEvent {
  /** イベント種別 */
  eventType:  string;
  /** 対象企業 UID */
  companyUid: string;
  /** 操作者情報 */
  actor:      MutationActor;
  /** ISO 8601 タイムスタンプ */
  timestamp:  string;
}

// ── Action events ─────────────────────────────────────────────────────────────

export interface ActionCreatedEvent extends BaseMutationEvent {
  eventType:    'action_created';
  actionId:     string;
  title:        string;
  createdFrom:  string;
  status:       string;
  owner:        string;
  dueDate:      string | null;
  sourceRef:    string | null;
  personRef:    string | null;
}

export interface ActionUpdatedEvent extends BaseMutationEvent {
  eventType:  'action_updated';
  actionId:   string;
  /** 変更前の状態 */
  before: {
    status?:    string;
    title?:     string;
    owner?:     string;
    dueDate?:   string | null;
  };
  /** 変更後の状態 */
  after: {
    status?:    string;
    title?:     string;
    owner?:     string;
    dueDate?:   string | null;
  };
}

// ── Contact events ────────────────────────────────────────────────────────────

export interface ContactCreatedEvent extends BaseMutationEvent {
  eventType:         'contact_created';
  personId:          string;
  name:              string;
  role:              string;
  decisionInfluence: string;
  contactStatus:     string;
  source:            string;   // 'cxm' | 'salesforce' | 'unknown'
}

export interface ContactUpdatedEvent extends BaseMutationEvent {
  eventType: 'contact_updated';
  personId:  string;
  name:      string;
  before: {
    role?:              string;
    decisionInfluence?: string;
    contactStatus?:     string;
    owner?:             string;
    lastTouchpoint?:    string | null;
  };
  after: {
    role?:              string;
    decisionInfluence?: string;
    contactStatus?:     string;
    owner?:             string;
    lastTouchpoint?:    string | null;
  };
}

// ── SF push events ────────────────────────────────────────────────────────────

export interface ActionSfPushedEvent extends BaseMutationEvent {
  eventType:    'action_sf_pushed';
  actionId:     string;
  sfTaskId:     string;
  syncedFields: string[];
  syncResult:   'synced' | 'sync_error';
  error?:       string;
}

export interface ContactSfPushedEvent extends BaseMutationEvent {
  eventType:    'contact_sf_pushed';
  personId:     string;
  sfContactId:  string;
  syncedFields: string[];
  syncResult:   'synced' | 'sync_error';
  error?:       string;
}

// ── SF ToDo event ─────────────────────────────────────────────────────────────

export interface SfTodoCreatedEvent extends BaseMutationEvent {
  eventType:         'sf_todo_created';
  /** SF Task ID（sync 成功後に設定） */
  sfTodoId?:         string;
  subject:           string;
  priority:          string;
  dueDate:           string | null;
  relatedSignalId:   string | null;
  relatedPersonId:   string | null;
  /** 'simulated' | 'synced' | 'sync_error' */
  syncResult:        string;
}

// ── Union ─────────────────────────────────────────────────────────────────────

export type CompanyMutationEvent =
  | ActionCreatedEvent
  | ActionUpdatedEvent
  | ActionSfPushedEvent
  | ContactCreatedEvent
  | ContactUpdatedEvent
  | ContactSfPushedEvent
  | SfTodoCreatedEvent;

// ── Builders ──────────────────────────────────────────────────────────────────

function nowIso() { return new Date().toISOString(); }

export function buildActionCreatedEvent(
  companyUid: string,
  action: {
    id: string; title: string; createdFrom: string;
    status: string; owner: string; dueDate: string | null;
    sourceRef: string | null; personRef: string | null;
  },
  actor: MutationActor,
): ActionCreatedEvent {
  return {
    eventType: 'action_created',
    companyUid,
    actor,
    timestamp:   nowIso(),
    actionId:    action.id,
    title:       action.title,
    createdFrom: action.createdFrom,
    status:      action.status,
    owner:       action.owner,
    dueDate:     action.dueDate,
    sourceRef:   action.sourceRef,
    personRef:   action.personRef,
  };
}

export function buildActionUpdatedEvent(
  companyUid: string,
  actionId: string,
  before: ActionUpdatedEvent['before'],
  after:  ActionUpdatedEvent['after'],
  actor: MutationActor,
): ActionUpdatedEvent {
  return { eventType: 'action_updated', companyUid, actor, timestamp: nowIso(), actionId, before, after };
}

export function buildContactCreatedEvent(
  companyUid: string,
  person: {
    id: string; name: string; role: string;
    decisionInfluence: string; contactStatus: string; source?: string;
  },
  actor: MutationActor,
): ContactCreatedEvent {
  return {
    eventType: 'contact_created',
    companyUid,
    actor,
    timestamp:         nowIso(),
    personId:          person.id,
    name:              person.name,
    role:              person.role,
    decisionInfluence: person.decisionInfluence,
    contactStatus:     person.contactStatus,
    source:            person.source ?? 'cxm',
  };
}

export function buildContactUpdatedEvent(
  companyUid: string,
  personId: string,
  name: string,
  before: ContactUpdatedEvent['before'],
  after:  ContactUpdatedEvent['after'],
  actor: MutationActor,
): ContactUpdatedEvent {
  return { eventType: 'contact_updated', companyUid, actor, timestamp: nowIso(), personId, name, before, after };
}

export function buildActionSfPushedEvent(
  companyUid: string,
  push: {
    actionId: string; sfTaskId: string;
    syncedFields: string[]; syncResult: 'synced' | 'sync_error'; error?: string;
  },
  actor: MutationActor,
): ActionSfPushedEvent {
  return {
    eventType:    'action_sf_pushed',
    companyUid,
    actor,
    timestamp:    nowIso(),
    actionId:     push.actionId,
    sfTaskId:     push.sfTaskId,
    syncedFields: push.syncedFields,
    syncResult:   push.syncResult,
    error:        push.error,
  };
}

export function buildContactSfPushedEvent(
  companyUid: string,
  push: {
    personId: string; sfContactId: string;
    syncedFields: string[]; syncResult: 'synced' | 'sync_error'; error?: string;
  },
  actor: MutationActor,
): ContactSfPushedEvent {
  return {
    eventType:    'contact_sf_pushed',
    companyUid,
    actor,
    timestamp:    nowIso(),
    personId:     push.personId,
    sfContactId:  push.sfContactId,
    syncedFields: push.syncedFields,
    syncResult:   push.syncResult,
    error:        push.error,
  };
}

export function buildSfTodoCreatedEvent(
  companyUid: string,
  todo: {
    sfTodoId?: string; subject: string; priority: string;
    dueDate: string | null; relatedSignalId: string | null;
    relatedPersonId: string | null; syncResult: string;
  },
  actor: MutationActor,
): SfTodoCreatedEvent {
  return {
    eventType:       'sf_todo_created',
    companyUid,
    actor,
    timestamp:       nowIso(),
    sfTodoId:        todo.sfTodoId,
    subject:         todo.subject,
    priority:        todo.priority,
    dueDate:         todo.dueDate,
    relatedSignalId: todo.relatedSignalId,
    relatedPersonId: todo.relatedPersonId,
    syncResult:      todo.syncResult,
  };
}

// ── Logger ────────────────────────────────────────────────────────────────────

import { TABLE_IDS }  from '@/lib/nocodb/client';
import { nocoCreate } from '@/lib/nocodb/write';

/** company_mutation_logs の raw レコード型（Id のみ必要） */
interface RawMutationLog { Id: number; }

/** event から entity_id を抽出する */
function extractEntityId(event: CompanyMutationEvent): string {
  switch (event.eventType) {
    case 'action_created':   return event.actionId;
    case 'action_updated':   return event.actionId;
    case 'action_sf_pushed': return event.actionId;
    case 'contact_created':  return event.personId;
    case 'contact_updated':  return event.personId;
    case 'contact_sf_pushed':return event.personId;
    case 'sf_todo_created':  return event.sfTodoId ?? '';
  }
}

/**
 * mutation event を記録する。
 * NOCODB_COMPANY_MUTATION_LOGS_TABLE_ID が設定されていれば NocoDB へ保存し、
 * 未設定 or 保存失敗時は console.log fallback（実行は止めない）。
 */
export async function logMutationEvent(event: CompanyMutationEvent): Promise<void> {
  // console サマリー（dev / staging は常に出力、prod はエラー時のみ）
  if (process.env.NODE_ENV !== 'production') {
    console.log('[mutation]', event.eventType, event.companyUid, extractEntityId(event));
  }

  const tableId = TABLE_IDS.company_mutation_logs;
  if (!tableId) return;  // テーブル未設定 → console fallback のみ

  try {
    await nocoCreate<RawMutationLog>(tableId, {
      event_type:      event.eventType,
      company_uid:     event.companyUid,
      entity_id:       extractEntityId(event),
      actor_source:    event.actor.source,
      actor_user_id:   event.actor.userId   ?? '',
      actor_user_name: event.actor.userName ?? '',
      timestamp:       event.timestamp,
      payload_json:    JSON.stringify(event),
    });
  } catch (err) {
    // 保存失敗は実行を止めない
    console.error('[mutation] company_mutation_logs 保存失敗:', err instanceof Error ? err.message : err);
  }
}
