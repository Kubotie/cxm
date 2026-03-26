// ─── Support 領域 read 関数（サーバーサイド専用）────────────────────────────
// source tables:   support_queue, cseticket_queue, inquiry_queue
// derived tables:  support_alerts, support_case_ai_state
//
// テーブル ID が空（未設定）のときは空配列 / null を返す。
// 呼び出し元で mock fallback すること。

import { nocoFetch, TABLE_IDS } from './client';
import {
  RawSupportCase,    AppSupportCase,         toAppSupportCase,
  RawCseTicket,      AppCseTicket,            toAppCseTicket,
  RawInquiry,        AppInquiry,              toAppInquiry,
  RawSupportAlert,   AppSupportAlert,         toAppSupportAlert,
  RawSupportCaseAIState, AppSupportCaseAIState, toAppSupportCaseAIState,
} from './types';
import { sourceRefToWhere, buildSourceRef } from '../support/source-ref';
export { sourceRefToWhere, buildSourceRef }; // 呼び出し元が support.ts 経由で使えるよう re-export

// ── support_queue ────────────────────────────────────────────────────────────

/** Support Queue の一覧を取得する（デフォルト 100 件, 新しい順）*/
export async function getSupportQueueList(limit = 100): Promise<AppSupportCase[]> {
  if (!TABLE_IDS.support_queue) return [];
  const raw = await nocoFetch<RawSupportCase>(TABLE_IDS.support_queue, {
    sort: '-created_at',
    limit: String(limit),
  });
  return raw.map(toAppSupportCase);
}

/** company_uid で絞り込んだ Support Queue リストを取得する */
export async function getSupportQueueByCompanyUid(
  companyUid: string,
  limit = 100,
): Promise<AppSupportCase[]> {
  if (!TABLE_IDS.support_queue) return [];
  const raw = await nocoFetch<RawSupportCase>(TABLE_IDS.support_queue, {
    where: `(company_uid,eq,${companyUid})`,
    sort: '-created_at',
    limit: String(limit),
  });
  return raw.map(toAppSupportCase);
}

/** case_id で 1 件取得する */
export async function getSupportCaseById(caseId: string): Promise<AppSupportCase | null> {
  if (!TABLE_IDS.support_queue) return null;
  const raw = await nocoFetch<RawSupportCase>(TABLE_IDS.support_queue, {
    where: `(case_id,eq,${caseId})`,
    limit: '1',
  });
  return raw.length > 0 ? toAppSupportCase(raw[0]) : null;
}

// ── support_alerts (derived) ─────────────────────────────────────────────────

/** Support Home 用のアラート一覧を取得する（デフォルト 50 件, 新しい順）*/
export async function getSupportAlerts(limit = 50): Promise<AppSupportAlert[]> {
  if (!TABLE_IDS.support_alerts) return [];
  const raw = await nocoFetch<RawSupportAlert>(TABLE_IDS.support_alerts, {
    sort: '-created_at',
    limit: String(limit),
  });
  return raw.map(toAppSupportAlert);
}

// ── support_case_ai_state (derived) ──────────────────────────────────────────

/**
 * 案件の AI 解析状態を取得する。
 * @param sourceId    対象の case_id / inquiry_id / ticket_id
 * @param sourceTable "support_queue" | "inquiry_queue" | "cseticket_queue"
 */
export async function getSupportCaseAIStateBySource(
  sourceId: string,
  sourceTable: string,
): Promise<AppSupportCaseAIState | null> {
  if (!TABLE_IDS.support_case_ai_state) return null;
  const ref = buildSourceRef(sourceId, sourceTable);
  const raw = await nocoFetch<RawSupportCaseAIState>(TABLE_IDS.support_case_ai_state, {
    where: sourceRefToWhere(ref),
    limit: '1',
  });
  return raw.length > 0 ? toAppSupportCaseAIState(raw[0]) : null;
}

// ── cseticket_queue ──────────────────────────────────────────────────────────

/**
 * CSE Ticket Queue を company または case でフィルタして取得する。
 * 両方未指定の場合は全件（limit 上限）を返す。
 */
export async function getCseTicketQueueByCompanyOrCase(opts: {
  companyUid?: string;
  caseId?: string;
  limit?: number;
}): Promise<AppCseTicket[]> {
  if (!TABLE_IDS.cseticket_queue) return [];
  const where = opts.companyUid
    ? `(company_uid,eq,${opts.companyUid})`
    : opts.caseId
    ? `(linked_case_id,eq,${opts.caseId})`
    : undefined;
  const raw = await nocoFetch<RawCseTicket>(TABLE_IDS.cseticket_queue, {
    ...(where ? { where } : {}),
    sort: '-created_at',
    limit: String(opts.limit ?? 50),
  });
  return raw.map(toAppCseTicket);
}

// ── inquiry_queue ────────────────────────────────────────────────────────────

/**
 * Inquiry Queue を company または case でフィルタして取得する。
 */
export async function getInquiryQueueByCompanyOrCase(opts: {
  companyUid?: string;
  caseId?: string;
  limit?: number;
}): Promise<AppInquiry[]> {
  if (!TABLE_IDS.inquiry_queue) return [];
  const where = opts.companyUid
    ? `(company_uid,eq,${opts.companyUid})`
    : opts.caseId
    ? `(linked_case_id,eq,${opts.caseId})`
    : undefined;
  const raw = await nocoFetch<RawInquiry>(TABLE_IDS.inquiry_queue, {
    ...(where ? { where } : {}),
    sort: '-created_at',
    limit: String(opts.limit ?? 50),
  });
  return raw.map(toAppInquiry);
}
