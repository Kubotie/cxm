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
  type RawLogChatwork,
  type RawLogSlack,
  type RawLogNotionMinutes,
  type AppLogChatwork,
  type AppLogSlack,
  type AppLogNotionMinutes,
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

  // sort=-sent_at/-meeting_date で最新1件取得。limit は uid数 × 1 で十分だが
  // NocoDB の in フィルタは全件返すためある程度余裕を持たせる
  const fetchOpts = { limit: String(companyUids.length * 2) };

  const [chatworkMap, slackMap, notionMap] = await Promise.all([
    TABLE_IDS.log_chatwork
      ? nocoFetchByUids<RawLogChatwork>(TABLE_IDS.log_chatwork, companyUids, {
          ...fetchOpts, sort: '-sent_at',
        })
      : Promise.resolve(new Map<string, RawLogChatwork[]>()),
    TABLE_IDS.log_slack
      ? nocoFetchByUids<RawLogSlack>(TABLE_IDS.log_slack, companyUids, {
          ...fetchOpts, sort: '-sent_at',
        })
      : Promise.resolve(new Map<string, RawLogSlack[]>()),
    TABLE_IDS.log_notion_minutes
      ? nocoFetchByUids<RawLogNotionMinutes>(TABLE_IDS.log_notion_minutes, companyUids, {
          ...fetchOpts, sort: '-meeting_date',
        })
      : Promise.resolve(new Map<string, RawLogNotionMinutes[]>()),
  ]);

  const result = new Map<string, LatestCommunicationDate>();

  for (const uid of companyUids) {
    const cwRows     = chatworkMap.get(uid) ?? [];
    const slackRows  = slackMap.get(uid)    ?? [];
    const notionRows = notionMap.get(uid)   ?? [];

    const cwDate     = cwRows[0]?.sent_at     ? String(cwRows[0].sent_at) : null;
    const slackDate  = slackRows[0]?.sent_at  ? String(slackRows[0].sent_at) : null;
    const notionDate = notionRows[0]?.meeting_date ? String(notionRows[0].meeting_date) : null;

    const latestDate = latestOf(cwDate, slackDate, notionDate);
    result.set(uid, { latestDate, blankDays: daysSince(latestDate) });
  }

  return result;
}

// ── 全ソース一括（Detail の Communication タブ向け）──────────────────────────

export interface AllCommunicationLogs {
  chatwork:      AppLogChatwork[];
  slack:         AppLogSlack[];
  notionMinutes: AppLogNotionMinutes[];
}

/**
 * 1企業の全コミュニケーションログを並行取得する。
 * Detail の Communication タブ初期ロードで使用する。
 */
export async function fetchAllCommunicationLogs(
  companyUid: string,
): Promise<AllCommunicationLogs> {
  const [chatwork, slack, notionMinutes] = await Promise.all([
    fetchChatworkLogs(companyUid),
    fetchSlackLogs(companyUid),
    fetchNotionMinutes(companyUid),
  ]);
  return { chatwork, slack, notionMinutes };
}
