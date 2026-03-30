// ─── Support AI Operations ─────────────────────────────────────────────────────
// Support Detail の AI 接続ポイントで使う型を定義する。
//
// ┌────────────────────────────────────────────────────────────────────────────┐
// │  操作            │ endpoint                           │ 保存先              │
// ├────────────────────────────────────────────────────────────────────────────┤
// │  summary         │ POST /api/support/[caseId]/summary │ support_case_ai_state│
// │  triage          │ POST /api/support/[caseId]/triage  │ support_case_ai_state│
// │  draft-reply     │ POST /api/support/[caseId]/draft-reply │ (未保存 or 別途) │
// └────────────────────────────────────────────────────────────────────────────┘

import type { SourceQueueName } from './source-ref';
import type { AppSupportCaseAIState } from '@/lib/nocodb/types';

// ── 共通 ─────────────────────────────────────────────────────────────────────

/** 全 AI 操作で共通のリクエストオプション */
export interface AiBaseRequestBody {
  /** 対象の source テーブル名。省略時は 'support_queue' */
  sourceTable?: SourceQueueName;
  /** true のとき既存キャッシュを無視して再生成する */
  forceRefresh?: boolean;
}

// ── POST /api/support/[caseId]/summary ────────────────────────────────────────

/**
 * NocoDB 未設定時（または UI が持っている情報を補足したい時）に
 * クライアントから渡すケースコンテキスト。
 * サーバー側で NocoDB から取得できた場合はそちらが優先される。
 */
export interface CaseContext {
  title?: string;
  caseType?: string;
  source?: string;
  company?: string;
  severity?: string;
  routingStatus?: string;
  assignedTeam?: string;
  openDuration?: string;
  linkedCSETicket?: string;
  originalMessage?: string;
  triageNote?: string;
}

/** /summary へのリクエストボディ */
export interface SummarizeRequestBody extends AiBaseRequestBody {
  /** NocoDB 未設定時のフォールバック。UI が持つ情報をそのまま渡す */
  caseContext?: CaseContext;
  /** true のとき生成結果を support_case_ai_state へ保存する */
  save?: boolean;
}

/** /summary からのレスポンス */
export interface SummarizeResponse {
  state: AppSupportCaseAIState;
  /** 'cache': 既存レコードを返した / 'generated': OpenAI で新規生成した */
  source: 'cache' | 'generated';
}

// ── POST /api/support/[caseId]/triage ────────────────────────────────────────

/** /triage へのリクエストボディ */
export interface TriageRequestBody extends AiBaseRequestBody {
  /** true のとき生成結果を support_case_ai_state へ保存する */
  save?: boolean;
  /** NocoDB 未設定時のフォールバック */
  caseContext?: CaseContext;
}

/** AI が提案するトリアージ内容 */
export interface TriageSuggestion {
  /** 推奨アサイン先チーム */
  assignedTeam: 'CSM' | 'Support' | 'CSE';
  /** 推奨ルーティングステータス */
  routingStatus: 'triaged' | 'assigned' | 'in progress';
  /** 推奨 severity */
  severity: 'high' | 'medium' | 'low';
  /** CSE Ticket 起票が必要か */
  requiresCseTicket: boolean;
  /** 推奨する理由（人間が読む用） */
  reasoning: string;
}

/** /triage からのレスポンス */
export interface TriageResponse {
  suggestion: TriageSuggestion;
  /** 'cache': キャッシュから / 'generated': OpenAI で生成 */
  source: 'cache' | 'generated';
  caseId: string;
}

// ── POST /api/support/[caseId]/draft-reply ───────────────────────────────────

/** /draft-reply へのリクエストボディ */
export interface DraftReplyRequestBody {
  /** 文体 */
  tone?: 'formal' | 'friendly' | 'technical';
  /** 返信言語。省略時は 'ja' */
  language?: 'ja' | 'en';
  /** 担当者から AI への追加指示（例: "謝罪を含める"） */
  instructions?: string;
  /** 含めるべき情報へのヒント（例: CSE Ticket 番号など） */
  contextHints?: string[];
  /** true のとき生成結果を support_case_ai_state へ保存する */
  save?: boolean;
  /** NocoDB 未設定時のフォールバック */
  caseContext?: CaseContext;
}

// ── NocoDB write payload 型 ───────────────────────────────────────────────────
// 実際に NocoDB へ書き込む際のペイロード。
// NocoDB フィールド名（snake_case）に合わせること。

/** support_case_ai_state テーブルへの upsert ペイロード */
export interface SupportCaseAIStateWritePayload {
  source_record_id: string;
  source_queue: string;
  /** AI が生成した表示用タイトル（20〜40 文字）。summary 生成時に一緒に保存 */
  display_title?: string;
  /** AI が整形した本文（詳細画面表示用）。不要な挨拶・署名・引用を除去した body */
  display_message?: string;
  summary?: string;
  suggested_owner?: string;
  suggested_team?: string;
  urgency?: string;
  /** JSON 配列を文字列化したもの: '["step1","step2"]' */
  next_steps?: string;
  /** JSON 配列を文字列化したもの */
  similar_case_ids?: string;
  customer_intent?: string;
  product_area?: string;
  urgency_reasoning?: string;
  /** AI トリアージフィールド */
  triage_note?: string;
  suggested_action?: string;
  escalation_needed?: boolean;
  category?: string;
  routing_reason?: string;
  /** AI 下書きフィールド */
  draft_reply?: string;
  reply_tone?: string;
  /** JSON 配列を文字列化したもの */
  reply_key_points?: string;
  /** 生成したモデル名。トレーサビリティ用 */
  generated_by?: string;
}

/** support_alerts テーブルへの upsert ペイロード */
export interface SupportAlertWritePayload {
  /** 既存レコードを更新する場合は指定。新規の場合は省略 */
  alert_id?: string;
  /** upsert キーの一部: source 案件の ID */
  source_record_id: string;
  /** upsert キーの一部: source キュー名 */
  source_queue: string;
  alert_type: string;
  priority: string;
  title: string;
  summary: string;
  company_uid?: string;
  company_name?: string;
  source: string;
  linked_cases?: number;
  cse_tickets?: number;
  assigned_to?: string;
  owner_name?: string;
  /** デフォルト: 'Untriaged' */
  status: string;
  suggested_action?: string;
  why_this_matters?: string;
  escalation_needed?: boolean;
  /** 生成したモデル名 */
  generated_by?: string;
}

// ── ヘルパー ─────────────────────────────────────────────────────────────────

/** string[] を NocoDB 用の JSON 文字列に変換する */
export function stringifyJsonArray(arr: string[]): string {
  return JSON.stringify(arr);
}
