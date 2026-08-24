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

import { nocoFetch, nocoFetchByUids, nocoFetchAllByUids, TABLE_IDS } from '@/lib/nocodb/client';
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

  // ⚠️ 実カラム名は sent_at_jst / creat_at_jst である（sent_at / meeting_date は存在しない）。
  //    誤ったカラム名を指定していたため、以前は chatwork / slack / notion が常に null になっていた。
  //
  // ⚠️ nocoFetchByUids は「1リクエスト・limit 上限あり」なので、対象企業が多いと
  //    sort 順の先頭を占めた数社だけが返り、残りは 0 件になる（open_support_count=0 と同じ罠）。
  //    最終接点日は全企業について正しく出す必要があるため nocoFetchAllByUids を使う。
  //    日付カラムのみ fields で絞れば、chatwork/slack/notion は各 1000 件強で軽い。
  // ⚠️ 1ソースの失敗で全体を捨てないよう、必ず個別に catch する。
  //    以前は Promise.all の中で1本が reject すると全ソースが失われ、
  //    最終接点日が全企業 null になっていた。
  const [chatworkMap, slackMap, notionMap, intercomMap] = await Promise.all([
    TABLE_IDS.log_chatwork
      ? nocoFetchAllByUids<RawLogChatwork>(TABLE_IDS.log_chatwork, companyUids, {
          sort: '-sent_at_jst', fields: 'company_uid,sent_at_jst',
        }).catch(logAndEmpty<RawLogChatwork>('log_chatwork'))
      : Promise.resolve(new Map<string, RawLogChatwork[]>()),
    TABLE_IDS.log_slack
      ? nocoFetchAllByUids<RawLogSlack>(TABLE_IDS.log_slack, companyUids, {
          sort: '-sent_at_jst', fields: 'company_uid,sent_at_jst',
        }).catch(logAndEmpty<RawLogSlack>('log_slack'))
      : Promise.resolve(new Map<string, RawLogSlack[]>()),
    TABLE_IDS.log_notion_minutes
      ? nocoFetchAllByUids<RawLogNotionMinutes>(TABLE_IDS.log_notion_minutes, companyUids, {
          sort: '-creat_at_jst', fields: 'company_uid,creat_at_jst',
        }).catch(logAndEmpty<RawLogNotionMinutes>('log_notion_minutes'))
      : Promise.resolve(new Map<string, RawLogNotionMinutes[]>()),
    // intercom は件数が多い（1.6万件超）ため limit 方式に留める（best-effort）。
    // メール種別での絞り込みはしない: 実カラムは message_type であり、
    // コード全体で使われている massage_type は存在しない（FIELD_NOT_FOUND になる）。
    // 最終接点日の観点ではサポート問い合わせも接点なので、種別を問わず最新日を取る。
    TABLE_IDS.log_intercom
      ? nocoFetchByUids<RawSupportCase>(TABLE_IDS.log_intercom, companyUids, {
          limit: String(Math.min(companyUids.length * 5, 500)),
          sort: '-sent_at_jst',
          fields: 'company_uid,sent_at_jst',
        }, false).catch(logAndEmpty<RawSupportCase>('log_intercom'))
      : Promise.resolve(new Map<string, RawSupportCase[]>()),
  ]);

  const result = new Map<string, LatestCommunicationDate>();

  for (const uid of companyUids) {
    const cwRows         = chatworkMap.get(uid)     ?? [];
    const slackRows      = slackMap.get(uid)        ?? [];
    const notionRows     = notionMap.get(uid)       ?? [];
    const intercomRows   = intercomMap.get(uid)     ?? [];

    // sort 済みだが、ページング結合後の順序に依存しないよう最大値を取る
    const cwDate     = maxDateOf(cwRows.map(r => r.sent_at_jst ?? r.sent_at));
    const slackDate  = maxDateOf(slackRows.map(r => r.sent_at_jst ?? r.sent_at));
    const notionDate = maxDateOf(notionRows.map(r => r.creat_at_jst ?? r.meeting_date));
    const intercomDate = maxDateOf(intercomRows.map(r => r.sent_at_jst));

    const latestDate = latestOf(cwDate, slackDate, notionDate, intercomDate);
    result.set(uid, { latestDate, blankDays: daysSince(latestDate) });
  }

  return result;
}

/** 取得失敗を warn に落として空 Map を返す catch ハンドラ */
function logAndEmpty<T>(source: string) {
  return (e: unknown): Map<string, T[]> => {
    console.warn(`[communication-logs] ${source} の最終接点日取得に失敗（他ソースで継続）:`, e);
    return new Map<string, T[]>();
  };
}

/** 日付らしい値の配列から最大値を返す。空 / 全て無効なら null */
function maxDateOf(values: unknown[]): string | null {
  let max: string | null = null;
  for (const v of values) {
    if (v === null || v === undefined || v === '') continue;
    const s = String(v);
    if (!max || s > max) max = s;
  }
  return max;
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
