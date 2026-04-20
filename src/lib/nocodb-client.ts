// ─── NocoDB クライアントサイドフェッチャー ───────────────────────────────────
// 'use client' コンポーネントからのデータ取得に使用する。
// /api/nocodb/* エンドポイント経由でサーバーサイドの NocoDB クライアントを呼び出す。

import type {
  AppCompany, AppAlert, AppEvidence, AppLogEntry, AppPerson,
  AppSupportCase, AppSupportAlert, AppSupportCaseAIState,
  AppCseTicket, AppInquiry,
} from "@/lib/nocodb/types";
export type {
  AppCompany, AppAlert, AppEvidence, AppLogEntry, AppPerson,
  AppSupportCase, AppSupportAlert, AppSupportCaseAIState,
  AppCseTicket, AppInquiry,
};
import type { QueueItem, CaseDetail } from "@/lib/support/queue-adapter";
export type { QueueItem, CaseDetail };

export async function fetchAllCompanies(limit = 50): Promise<AppCompany[]> {
  const res = await fetch(`/api/nocodb/companies?limit=${limit}`);
  if (!res.ok) throw new Error(`companies fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchCompanyByUid(uid: string): Promise<AppCompany | null> {
  const res = await fetch(`/api/nocodb/companies?uid=${encodeURIComponent(uid)}`);
  if (!res.ok) throw new Error(`company fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchAlerts(companyUid?: string): Promise<AppAlert[]> {
  const url = companyUid
    ? `/api/nocodb/alerts?companyUid=${encodeURIComponent(companyUid)}`
    : "/api/nocodb/alerts";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`alerts fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchEvidence(companyUid: string): Promise<AppEvidence[]> {
  const res = await fetch(`/api/nocodb/evidence?companyUid=${encodeURIComponent(companyUid)}`);
  if (!res.ok) throw new Error(`evidence fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchLogEntries(companyUid: string): Promise<AppLogEntry[]> {
  const res = await fetch(`/api/nocodb/evidence?companyUid=${encodeURIComponent(companyUid)}&asLog=true`);
  if (!res.ok) throw new Error(`log entries fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchPeople(companyUid: string): Promise<AppPerson[]> {
  const res = await fetch(`/api/nocodb/people?companyUid=${encodeURIComponent(companyUid)}`);
  if (!res.ok) throw new Error(`people fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchSupportCases(limit = 100): Promise<QueueItem[]> {
  const res = await fetch(`/api/nocodb/support-queue?limit=${limit}`);
  if (!res.ok) throw new Error(`support-queue fetch failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data;
}

/** Detail ページ用: caseId で 1 件取得（CaseDetail を返す）。*/
export async function fetchCaseDetail(caseId: string): Promise<CaseDetail | null> {
  const res = await fetch(`/api/nocodb/support-queue?caseId=${encodeURIComponent(caseId)}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || Array.isArray(data)) return null;
  return data as CaseDetail;
}

/** @deprecated fetchCaseDetail を使用してください */
export async function fetchSupportCase(caseId: string): Promise<AppSupportCase | null> {
  return fetchCaseDetail(caseId) as unknown as Promise<AppSupportCase | null>;
}

export async function fetchSupportAlerts(limit = 50): Promise<AppSupportAlert[]> {
  const res = await fetch(`/api/nocodb/support-alerts?limit=${limit}`);
  if (!res.ok) throw new Error(`support-alerts fetch failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data;
}

export async function fetchSupportCaseAIState(
  sourceId: string,
  sourceTable = 'support_queue',
): Promise<AppSupportCaseAIState | null> {
  const url = `/api/nocodb/support-case-ai-state?sourceId=${encodeURIComponent(sourceId)}&sourceTable=${encodeURIComponent(sourceTable)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`support-case-ai-state fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchCseTickets(opts: {
  companyUid?: string;
  caseId?: string;
  limit?: number;
} = {}): Promise<AppCseTicket[]> {
  const params = new URLSearchParams();
  if (opts.companyUid) params.set('companyUid', opts.companyUid);
  if (opts.caseId)     params.set('caseId', opts.caseId);
  if (opts.limit)      params.set('limit', String(opts.limit));
  const res = await fetch(`/api/nocodb/cseticket-queue?${params}`);
  if (!res.ok) throw new Error(`cseticket-queue fetch failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data;
}

export async function fetchInquiries(opts: {
  companyUid?: string;
  caseId?: string;
  limit?: number;
} = {}): Promise<AppInquiry[]> {
  const params = new URLSearchParams();
  if (opts.companyUid) params.set('companyUid', opts.companyUid);
  if (opts.caseId)     params.set('caseId', opts.caseId);
  if (opts.limit)      params.set('limit', String(opts.limit));
  const res = await fetch(`/api/nocodb/inquiry-queue?${params}`);
  if (!res.ok) throw new Error(`inquiry-queue fetch failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data;
}
