// ─── Company 単位の Support 集約 read helpers ────────────────────────────────
//
// 1企業の support 関連データを集約する。
// - Detail API: 実ケース一覧 + AI state を返す
// - List API:   counts のみ（nocoFetchByUids でまとめて取得）
//
// 既存の support.ts は全社横断クエリ専用のため、ここに company_uid フィルタ版を置く。

import { nocoFetch, nocoFetchByUids, TABLE_IDS } from './client';
import {
  toAppSupportCase,
  toAppCseTicket,
  toAppSupportCaseAIState,
  type RawSupportCase,
  type RawCseTicket,
  type RawSupportCaseAIState,
  type AppSupportCase,
  type AppCseTicket,
  type AppSupportCaseAIState,
} from './types';

// ── "オープン" の定義 ─────────────────────────────────────────────────────────
//
// log_intercom (Intercom ケース):
//   routing_status が 'open' または 'snoozed' のもの。
//   'closed' / 'resolved' は除外。未設定の場合は open 扱い（保守的カウント）。
//
// cse_tickets (CSE チケット):
//   status が 'resolved' / 'closed' 以外のもの。
//   'waiting_customer' のものは waitingCseCount として区別して集計する。
//
// ── 4カウントの定義 ────────────────────────────────────────────────────────────
//
// openSupportCount    : log_intercom オープンケース数 + cse_tickets オープンチケット数の合計
// waitingCseCount     : cse_tickets の中で status='waiting_customer' のもの
// criticalSupportCount: log_intercom の severity='critical' かつオープンなケース数
// recentSupportCount  : 直近 7 日以内に作成されたオープンケース数（CreatedAt で判定）
//
// ─────────────────────────────────────────────────────────────────────────────

/** log_intercom ケースが「オープン」とみなされる routing_status 値 */
const INTERCOM_OPEN_STATUSES = new Set(['open', 'snoozed', '']);

/** cse_ticket がクローズとみなされる status 値 */
const CSE_CLOSED_STATUSES = new Set(['resolved', 'closed']);

/** 直近 N 日以内 = 「recent」の定義 */
const RECENT_DAYS = 7;

function isIntercomOpen(routingStatus: string | null | undefined): boolean {
  const s = String(routingStatus ?? '').toLowerCase();
  return !['closed', 'resolved'].includes(s);
}

function isCseOpen(status: string | null | undefined): boolean {
  return !CSE_CLOSED_STATUSES.has(String(status ?? '').toLowerCase());
}

function isRecent(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const ms = new Date(String(createdAt).trim().replace(' ', 'T')).getTime();
  if (isNaN(ms)) return false;
  return (Date.now() - ms) / (1000 * 60 * 60 * 24) <= RECENT_DAYS;
}

// ── 型定義 ────────────────────────────────────────────────────────────────────

export interface SupportAggregateVM {
  /** log_intercom オープンケース数（routing_status が open/snoozed/未設定） */
  openIntercomCount:  number;
  /** cse_tickets オープンチケット数（resolved/closed 以外） */
  openCseCount:       number;
  /** cse_tickets の中で waiting_customer のチケット数 */
  waitingCseCount:    number;
  /** log_intercom の severity=critical かつオープンなケース数 */
  criticalCount:      number;
  /** log_intercom の severity=high かつオープンなケース数 */
  highCount:          number;
  /** 直近 RECENT_DAYS 日以内に作成されたオープンケース数 */
  recentSupportCount: number;
  /** 直近 N 件のケース（Detail API で使用） */
  recentCases:        AppSupportCase[];
  /** 直近 N 件の CSE チケット（Detail API で使用） */
  cseTickets:         AppCseTicket[];
  /** AI state 集約（Detail API で使用） */
  aiStates:           AppSupportCaseAIState[];
}

export interface SupportCountSummary {
  /** log_intercom オープン + cse_tickets オープンの合計 */
  openCount:           number;
  /** cse_tickets の waiting_customer のみ */
  waitingCseCount:     number;
  /** log_intercom の critical かつオープン */
  criticalCount:       number;
  /** 直近 RECENT_DAYS 日以内に作成されたオープンケース数 */
  recentSupportCount:  number;
}

// ── 単一 company_uid（Detail API 用）─────────────────────────────────────────

/**
 * 1企業の support cases を log_intercom から取得する。
 * display_title がある（処理済み）レコードのみを返す。
 */
export async function fetchSupportCasesForCompany(
  companyUid: string,
  limit = 20,
): Promise<AppSupportCase[]> {
  const tableId = TABLE_IDS.log_intercom;
  if (!tableId) return [];
  const rows = await nocoFetch<RawSupportCase>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-CreatedAt',
    limit: String(limit),
  });
  return rows.map(toAppSupportCase);
}

/**
 * 1企業の CSE tickets を取得する。
 */
export async function fetchCseTicketsForCompany(
  companyUid: string,
  limit = 20,
): Promise<AppCseTicket[]> {
  const tableId = TABLE_IDS.cse_tickets;
  if (!tableId) return [];
  const rows = await nocoFetch<RawCseTicket>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-CreatedAt',
    limit: String(limit),
  });
  return rows.map(toAppCseTicket);
}

/**
 * 1企業の support_case_ai_state を取得する。
 * case_id に紐づく AI 分析結果（urgency / summary 等）。
 */
export async function fetchSupportAIStatesForCompany(
  companyUid: string,
  limit = 20,
): Promise<AppSupportCaseAIState[]> {
  const tableId = TABLE_IDS.support_case_ai_state;
  if (!tableId) return [];
  // support_case_ai_state は company_uid を直接持たない場合があるため
  // source_record_id (case_id) を使ったジョインが本来だが、
  // 暫定で company_uid フィールドがある場合はそれを使う
  const rows = await nocoFetch<RawSupportCaseAIState>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-created_at',
    limit: String(limit),
  }).catch(() => [] as RawSupportCaseAIState[]);
  return rows.map(toAppSupportCaseAIState);
}

/**
 * 3ソースを並行取得して SupportAggregateVM を構築する（Detail API 用）。
 */
export async function fetchSupportAggregateForCompany(
  companyUid: string,
): Promise<SupportAggregateVM> {
  const [cases, cseTickets, aiStates] = await Promise.all([
    fetchSupportCasesForCompany(companyUid),
    fetchCseTicketsForCompany(companyUid),
    fetchSupportAIStatesForCompany(companyUid),
  ]);

  const openCases      = cases.filter(c => isIntercomOpen(c.routingStatus));
  const openCseList    = cseTickets.filter(t => isCseOpen(t.status));
  const criticalCount  = openCases.filter(c => String(c.severity ?? '').toLowerCase() === 'critical').length;
  const highCount      = openCases.filter(c => String(c.severity ?? '').toLowerCase() === 'high').length;
  const waitingCseCount   = cseTickets.filter(t => String(t.status ?? '').toLowerCase() === 'waiting_customer').length;
  const recentSupportCount = openCases.filter(c => isRecent(c.createdAt)).length
    + openCseList.filter(t => isRecent(t.createdAt)).length;

  return {
    openIntercomCount:  openCases.length,
    openCseCount:       openCseList.length,
    waitingCseCount,
    criticalCount,
    highCount,
    recentSupportCount,
    recentCases:  cases.slice(0, 5),
    cseTickets:   cseTickets.slice(0, 5),
    aiStates:     aiStates.slice(0, 5),
  };
}

// ── 複数 company_uids（List API 用）─────────────────────────────────────────

/**
 * 複数企業の support case counts を一括取得する（List API 用）。
 * 返り値: Map<company_uid, SupportCountSummary>
 *
 * log_intercom + cse_tickets を並行 bulk fetch して company_uid で集計する。
 */
export async function fetchSupportCountsByUids(
  companyUids: string[],
): Promise<Map<string, SupportCountSummary>> {
  if (companyUids.length === 0) return new Map();

  const emptyMap = (): Map<string, SupportCountSummary> =>
    new Map(companyUids.map(u => [u, { openCount: 0, waitingCseCount: 0, criticalCount: 0, recentSupportCount: 0 }]));

  const [intercomMap, cseMap] = await Promise.all([
    TABLE_IDS.log_intercom
      ? nocoFetchByUids<RawSupportCase>(TABLE_IDS.log_intercom, companyUids, {
          sort: '-CreatedAt',
        })
      : Promise.resolve(new Map<string, RawSupportCase[]>()),
    TABLE_IDS.cse_tickets
      ? nocoFetchByUids<RawCseTicket>(TABLE_IDS.cse_tickets, companyUids, {
          sort: '-CreatedAt',
        })
      : Promise.resolve(new Map<string, RawCseTicket[]>()),
  ]);

  const result = emptyMap();

  for (const [uid, cases] of intercomMap) {
    const existing    = result.get(uid) ?? { openCount: 0, waitingCseCount: 0, criticalCount: 0, recentSupportCount: 0 };
    const openCases   = cases.filter(c => isIntercomOpen(c.routing_status));
    const critical    = openCases.filter(c => String(c.severity ?? '').toLowerCase() === 'critical').length;
    const recentCount = openCases.filter(c => isRecent(c.CreatedAt as string | null)).length;
    result.set(uid, {
      openCount:          existing.openCount + openCases.length,
      waitingCseCount:    existing.waitingCseCount,
      criticalCount:      existing.criticalCount + critical,
      recentSupportCount: existing.recentSupportCount + recentCount,
    });
  }

  for (const [uid, tickets] of cseMap) {
    const openTickets    = tickets.filter(t => isCseOpen(t.status));
    const waitingTickets = tickets.filter(t => String(t.status ?? '').toLowerCase() === 'waiting_customer');
    const recentCount    = openTickets.filter(t => isRecent(t.created_at)).length;
    const existing       = result.get(uid) ?? { openCount: 0, waitingCseCount: 0, criticalCount: 0, recentSupportCount: 0 };
    result.set(uid, {
      ...existing,
      openCount:          existing.openCount + openTickets.length,
      waitingCseCount:    existing.waitingCseCount + waitingTickets.length,
      recentSupportCount: existing.recentSupportCount + recentCount,
    });
  }

  return result;
}
