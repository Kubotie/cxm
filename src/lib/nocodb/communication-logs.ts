// ─── Communication log read helpers ──────────────────────────────────────────
//
// log_chatwork / log_slack / log_notion_minutes の取得ヘルパー。
//
// 使用場面:
//   - Detail の Communication タブ: 単一 company_uid で全件取得
//   - List の communication signal: 複数 UIDs で最新日時のみ取得
//   - health-signal.ts: blank_days 計算のために最新 1 件だけ取る場合
//
// 統一型 CommunicationEntry は company/communication-signal.ts で定義する。
// このファイルは NocoDB アクセスのみに責任を持つ。

import { nocoFetch, nocoFetchByUids, TABLE_IDS } from '@/lib/nocodb/client';
import {
  toAppLogChatwork,
  toAppLogSlack,
  toAppLogNotionMinutes,
  toAppLogIntercomMail,
  type RawLogChatwork,
  type RawLogSlack,
  type RawLogNotionMinutes,
  type RawSupportCase,
  type AppLogChatwork,
  type AppLogSlack,
  type AppLogNotionMinutes,
  type AppLogIntercomMail,
} from '@/lib/nocodb/types';

// ── 定数 ─────────────────────────────────────────────────────────────────────

/** Detail タブで取得するデフォルト件数 */
const DETAIL_LIMIT = 100;
/** List 向け一括取得でのデフォルト上限（全社分をまとめて取るので大きめに） */
const BULK_LIMIT_PER_UID = 20;

// ── Chatwork ─────────────────────────────────────────────────────────────────

// 実テーブルのソートカラム: sent_at_jst（旧設計の sent_at は存在しない）
export async function fetchChatworkLogs(
  companyUid: string,
  limit = DETAIL_LIMIT,
): Promise<AppLogChatwork[]> {
  const tableId = TABLE_IDS.log_chatwork;
  if (!tableId) return [];
  const list = await nocoFetch<RawLogChatwork>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-sent_at_jst',
    limit: String(limit),
  });
  return list.map(toAppLogChatwork);
}

export async function fetchChatworkLogsByUids(
  companyUids: string[],
): Promise<Map<string, AppLogChatwork[]>> {
  const tableId = TABLE_IDS.log_chatwork;
  if (!tableId || companyUids.length === 0) return new Map(companyUids.map(u => [u, []]));
  const rawMap = await nocoFetchByUids<RawLogChatwork>(tableId, companyUids, {
    sort:  '-sent_at_jst',
    limit: String(companyUids.length * BULK_LIMIT_PER_UID),
  });
  const result = new Map<string, AppLogChatwork[]>();
  for (const [uid, rows] of rawMap) result.set(uid, rows.map(toAppLogChatwork));
  for (const uid of companyUids) if (!result.has(uid)) result.set(uid, []);
  return result;
}

// ── Slack ─────────────────────────────────────────────────────────────────────

// 実テーブルのソートカラム: sent_at_jst（旧設計の sent_at は存在しない）
export async function fetchSlackLogs(
  companyUid: string,
  limit = DETAIL_LIMIT,
): Promise<AppLogSlack[]> {
  const tableId = TABLE_IDS.log_slack;
  if (!tableId) return [];
  const list = await nocoFetch<RawLogSlack>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-sent_at_jst',
    limit: String(limit),
  });
  return list.map(toAppLogSlack);
}

export async function fetchSlackLogsByUids(
  companyUids: string[],
): Promise<Map<string, AppLogSlack[]>> {
  const tableId = TABLE_IDS.log_slack;
  if (!tableId || companyUids.length === 0) return new Map(companyUids.map(u => [u, []]));
  const rawMap = await nocoFetchByUids<RawLogSlack>(tableId, companyUids, {
    sort:  '-sent_at_jst',
    limit: String(companyUids.length * BULK_LIMIT_PER_UID),
  });
  const result = new Map<string, AppLogSlack[]>();
  for (const [uid, rows] of rawMap) result.set(uid, rows.map(toAppLogSlack));
  for (const uid of companyUids) if (!result.has(uid)) result.set(uid, []);
  return result;
}

// ── Notion Minutes ────────────────────────────────────────────────────────────

// 実テーブルのソートカラム: creat_at_jst（meeting_date カラムは存在しない）
export async function fetchNotionMinutes(
  companyUid: string,
  limit = DETAIL_LIMIT,
): Promise<AppLogNotionMinutes[]> {
  const tableId = TABLE_IDS.log_notion_minutes;
  if (!tableId) return [];
  const list = await nocoFetch<RawLogNotionMinutes>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-creat_at_jst',
    limit: String(limit),
  });
  return list.map(toAppLogNotionMinutes);
}

export async function fetchNotionMinutesByUids(
  companyUids: string[],
): Promise<Map<string, AppLogNotionMinutes[]>> {
  const tableId = TABLE_IDS.log_notion_minutes;
  if (!tableId || companyUids.length === 0) return new Map(companyUids.map(u => [u, []]));
  const rawMap = await nocoFetchByUids<RawLogNotionMinutes>(tableId, companyUids, {
    sort:  '-creat_at_jst',
    limit: String(companyUids.length * BULK_LIMIT_PER_UID),
  });
  const result = new Map<string, AppLogNotionMinutes[]>();
  for (const [uid, rows] of rawMap) result.set(uid, rows.map(toAppLogNotionMinutes));
  for (const uid of companyUids) if (!result.has(uid)) result.set(uid, []);
  return result;
}

// ── Intercom Mail ─────────────────────────────────────────────────────────────

export async function fetchIntercomMailLogs(
  companyUid: string,
  limit = DETAIL_LIMIT,
): Promise<AppLogIntercomMail[]> {
  const tableId = TABLE_IDS.log_intercom;
  if (!tableId) return [];
  const list = await nocoFetch<RawSupportCase>(tableId, {
    where: `(company_uid,eq,${companyUid})~and(massage_type,eq,mail)`,
    sort:  '-sent_at_jst',
    limit: String(limit),
  });
  return list.map(toAppLogIntercomMail);
}

export async function fetchIntercomMailLogsByUids(
  companyUids: string[],
): Promise<Map<string, AppLogIntercomMail[]>> {
  const tableId = TABLE_IDS.log_intercom;
  if (!tableId || companyUids.length === 0) return new Map(companyUids.map(u => [u, []]));
  // nocoFetchByUids は where を受け付けないため全件取得後にメモリでフィルタ
  // fields で必要カラムのみ取得してレスポンスサイズを削減。no-store でキャッシュ警告を回避。
  const rawMap = await nocoFetchByUids<RawSupportCase>(tableId, companyUids, {
    sort:   '-sent_at_jst',
    limit:  String(companyUids.length * BULK_LIMIT_PER_UID),
    fields: 'company_uid,massage_type,sent_at_jst,subject,from_email,from_name,conversation_id',
  }, false);
  const result = new Map<string, AppLogIntercomMail[]>();
  for (const [uid, rows] of rawMap) {
    result.set(uid, rows.filter(r => r.massage_type === 'mail').map(toAppLogIntercomMail));
  }
  for (const uid of companyUids) if (!result.has(uid)) result.set(uid, []);
  return result;
}

// ── List 向け: 最終コミュニケーション日時のみ一括取得 ─────────────────────────

export interface LatestCommunicationDate {
  /** "YYYY-MM-DD" or "YYYY-MM-DD HH:mm"。ログが1件もなければ null */
  latestDate: string | null;
  /** latestDate から今日まで何日経過したか。null = 不明 */
  blankDays:  number | null;
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr.trim().replace(' ', 'T'));
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function latestOf(...dates: (string | null)[]): string | null {
  const valid = dates
    .filter((d): d is string => Boolean(d))
    .map(d => ({ d, ms: new Date(d.trim().replace(' ', 'T')).getTime() }))
    .filter(({ ms }) => !isNaN(ms));
  if (valid.length === 0) return null;
  valid.sort((a, b) => b.ms - a.ms);
  return valid[0].d;
}

/**
 * 複数企業の「最終コミュニケーション日時」を一括取得する（List API 向け）。
 * chatwork / slack / notion-minutes それぞれの最新1件を並行 bulk 取得して
 * 企業ごとに最大値を取る。
 * 返り値: Map<company_uid, LatestCommunicationDate>
 */
export async function fetchLatestCommunicationDatesByUids(
  companyUids: string[],
): Promise<Map<string, LatestCommunicationDate>> {
  if (companyUids.length === 0) return new Map();

  // sort=-sent_at/-meeting_date で最新1件/社を取得。余裕をみて × 3。
  const fetchOpts = { limit: String(Math.min(companyUids.length * 3, 300)) };

  // 最終日時だけ必要なため最小カラムのみ取得。no-store でキャッシュ警告を回避。
  const [chatworkMap, slackMap, notionMap, intercomMailMap] = await Promise.all([
    TABLE_IDS.log_chatwork
      ? nocoFetchByUids<RawLogChatwork>(TABLE_IDS.log_chatwork, companyUids, {
          ...fetchOpts, sort: '-sent_at',
          fields: 'company_uid,sent_at',
        }, false)
      : Promise.resolve(new Map<string, RawLogChatwork[]>()),
    TABLE_IDS.log_slack
      ? nocoFetchByUids<RawLogSlack>(TABLE_IDS.log_slack, companyUids, {
          ...fetchOpts, sort: '-sent_at',
          fields: 'company_uid,sent_at',
        }, false)
      : Promise.resolve(new Map<string, RawLogSlack[]>()),
    TABLE_IDS.log_notion_minutes
      ? nocoFetchByUids<RawLogNotionMinutes>(TABLE_IDS.log_notion_minutes, companyUids, {
          ...fetchOpts, sort: '-meeting_date',
          fields: 'company_uid,meeting_date',
        }, false)
      : Promise.resolve(new Map<string, RawLogNotionMinutes[]>()),
    TABLE_IDS.log_intercom
      ? nocoFetchByUids<RawSupportCase>(TABLE_IDS.log_intercom, companyUids, {
          ...fetchOpts, sort: '-sent_at_jst',
          fields: 'company_uid,massage_type,sent_at_jst',
        }, false)
      : Promise.resolve(new Map<string, RawSupportCase[]>()),
  ]);

  const result = new Map<string, LatestCommunicationDate>();

  for (const uid of companyUids) {
    const cwRows         = chatworkMap.get(uid)     ?? [];
    const slackRows      = slackMap.get(uid)        ?? [];
    const notionRows     = notionMap.get(uid)       ?? [];
    const intercomRows   = intercomMailMap.get(uid) ?? [];

    const cwDate       = cwRows[0]?.sent_at         ? String(cwRows[0].sent_at) : null;
    const slackDate    = slackRows[0]?.sent_at       ? String(slackRows[0].sent_at) : null;
    const notionDate   = notionRows[0]?.meeting_date ? String(notionRows[0].meeting_date) : null;
    // mail タイプのみ最新日付を取得（インメモリフィルタ）
    const mailRow      = intercomRows.find(r => r.massage_type === 'mail');
    const intercomDate = mailRow?.sent_at_jst ? String(mailRow.sent_at_jst) : null;

    const latestDate = latestOf(cwDate, slackDate, notionDate, intercomDate);
    result.set(uid, { latestDate, blankDays: daysSince(latestDate) });
  }

  return result;
}

// ── 全ソース一括（Detail の Communication タブ向け）──────────────────────────

export interface AllCommunicationLogs {
  chatwork:      AppLogChatwork[];
  slack:         AppLogSlack[];
  notionMinutes: AppLogNotionMinutes[];
  intercomMail:  AppLogIntercomMail[];
}

/**
 * 1企業の全コミュニケーションログを並行取得する。
 * Detail の Communication タブ初期ロードで使用する。
 */
export async function fetchAllCommunicationLogs(
  companyUid: string,
): Promise<AllCommunicationLogs> {
  const [chatwork, slack, notionMinutes, intercomMail] = await Promise.all([
    fetchChatworkLogs(companyUid).catch(() => [] as AppLogChatwork[]),
    fetchSlackLogs(companyUid).catch(() => [] as AppLogSlack[]),
    fetchNotionMinutes(companyUid).catch(() => [] as AppLogNotionMinutes[]),
    fetchIntercomMailLogs(companyUid).catch(() => [] as AppLogIntercomMail[]),
  ]);
  return { chatwork, slack, notionMinutes, intercomMail };
}
