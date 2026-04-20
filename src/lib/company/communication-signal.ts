// ─── Communication Signal ViewModel ──────────────────────────────────────────
//
// log_chatwork / log_slack / log_notion_minutes を統合して
// CommunicationSignalVM を構築する。
//
// source of truth（実カラム名）:
//   log_chatwork:       account_name（送信者）, body（本文）, sent_at_jst（日時）
//   log_slack:          account_name（ユーザー）, body（本文）, sent_at_jst（日時）
//   log_notion_minutes: page_name（タイトル）, creat_at_jst（作成日時）
//                       ※ participants カラムは存在しない（Notion candidate = weakSources 固定・制約）
//
// 責務:
//   - 3つのログソースを日時順に統合（unified timeline）
//   - 最終コミュニケーション日時の計算
//   - blank_days の算出 → risk level 判定
//   - List 画面向けの summary と Detail 向けの full timeline を分離
//
// このファイルはサーバー・クライアント両対応（副作用なし）。

import type {
  AppLogChatwork,
  AppLogSlack,
  AppLogNotionMinutes,
} from '@/lib/nocodb/types';
import {
  getCommunicationRiskLevel,
  COMMUNICATION_BLANK_WARNING_DAYS,
  COMMUNICATION_BLANK_RISK_DAYS,
} from '@/lib/company/badges';

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type CommunicationSource = 'chatwork' | 'slack' | 'notion_minutes';

/** ソースを問わない統一エントリ型（Communication タブのタイムライン用） */
export interface CommunicationEntry {
  /** 一意識別子（source:id） */
  key:         string;
  source:      CommunicationSource;
  companyUid:  string;
  /** "YYYY-MM-DD HH:mm" or "YYYY-MM-DD"。ソートと blank_days 計算に使う */
  dateStr:     string;
  title:       string;   // Notion は title、Chatwork/Slack は senderName + channel
  excerpt:     string;   // 本文冒頭 100 文字
  /** Notion の場合は actionItems の有無 */
  hasActionItems: boolean;
}

/** 1企業の Communication シグナルサマリー */
export interface CommunicationSignalVM {
  /** 最終コミュニケーション日時（"YYYY-MM-DD"）。ログが1件もなければ null */
  lastContactDate: string | null;

  /** 最終コミュニケーションから今日まで何日経過したか。null = 不明 */
  blankDays: number | null;

  /** blank_days に基づく risk level */
  riskLevel: 'none' | 'warning' | 'risk';

  /** データが存在するソース一覧 */
  activeSources: CommunicationSource[];

  /** 直近 30 日のエントリ数（ボリューム指標） */
  recentCount: number;

  /** 全エントリ数 */
  totalCount: number;

  /**
   * 最新 N 件のエントリ（List のツールチップや Detail の初期表示用）。
   * Detail フル表示時は buildCommunicationTimeline を使うこと。
   */
  recentEntries: CommunicationEntry[];
}

// ── 日付ユーティリティ ────────────────────────────────────────────────────────

function toDateStr(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return dateStr.slice(0, 10);  // "YYYY-MM-DD"
}

function parseToMs(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr.trim().replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d.getTime();
}

function daysSinceDate(dateStr: string | null | undefined): number | null {
  const ms = parseToMs(dateStr);
  if (ms === null) return null;
  return Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
}

function isWithinDays(dateStr: string | null | undefined, days: number): boolean {
  const blankDays = daysSinceDate(dateStr);
  return blankDays !== null && blankDays <= days;
}

function truncate(text: string, maxLen = 100): string {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

// ── エントリ変換 ──────────────────────────────────────────────────────────────

function chatworkToEntry(log: AppLogChatwork): CommunicationEntry {
  return {
    key:            `chatwork:${log.id}`,
    source:         'chatwork',
    companyUid:     log.companyUid,
    dateStr:        log.sentAt ?? '',
    title:          log.senderName
                      ? `${log.senderName}${log.roomName ? ` / ${log.roomName}` : ''}`
                      : log.roomName ?? 'Chatwork',
    excerpt:        truncate(log.body),
    hasActionItems: false,
  };
}

function slackToEntry(log: AppLogSlack): CommunicationEntry {
  return {
    key:            `slack:${log.id}`,
    source:         'slack',
    companyUid:     log.companyUid,
    dateStr:        log.sentAt ?? '',
    title:          log.userName
                      ? `${log.userName}${log.channel ? ` #${log.channel}` : ''}`
                      : log.channel ? `#${log.channel}` : 'Slack',
    excerpt:        truncate(log.text),
    hasActionItems: false,
  };
}

function notionToEntry(log: AppLogNotionMinutes): CommunicationEntry {
  return {
    key:            `notion:${log.id}`,
    source:         'notion_minutes',
    companyUid:     log.companyUid,
    dateStr:        log.meetingDate ?? log.createdAt ?? '',
    title:          log.title,
    excerpt:        truncate(log.body),
    hasActionItems: log.actionItems.length > 0,
  };
}

// ── タイムライン構築 ──────────────────────────────────────────────────────────

/**
 * 3ソースのエントリを日時降順で統合した完全タイムラインを返す。
 * Detail の Communication タブで使用する。
 */
export function buildCommunicationTimeline(
  chatwork:      AppLogChatwork[],
  slack:         AppLogSlack[],
  notionMinutes: AppLogNotionMinutes[],
): CommunicationEntry[] {
  const entries: CommunicationEntry[] = [
    ...chatwork.map(chatworkToEntry),
    ...slack.map(slackToEntry),
    ...notionMinutes.map(notionToEntry),
  ];

  // dateStr 降順（新しい順）でソート
  entries.sort((a, b) => {
    const ta = parseToMs(a.dateStr) ?? 0;
    const tb = parseToMs(b.dateStr) ?? 0;
    return tb - ta;
  });

  return entries;
}

// ── CommunicationSignalVM 構築 ────────────────────────────────────────────────

/**
 * 3ソースのログから CommunicationSignalVM を構築する。
 * List 画面・Detail サイドバーで使用する。
 *
 * @param chatwork      fetchChatworkLogs の結果
 * @param slack         fetchSlackLogs の結果
 * @param notionMinutes fetchNotionMinutes の結果
 * @param previewCount  recentEntries に含める件数（default: 5）
 */
export function buildCommunicationSignalVM(
  chatwork:      AppLogChatwork[],
  slack:         AppLogSlack[],
  notionMinutes: AppLogNotionMinutes[],
  previewCount   = 5,
): CommunicationSignalVM {
  const allEntries = buildCommunicationTimeline(chatwork, slack, notionMinutes);
  const totalCount = allEntries.length;

  // 最終コミュニケーション日時（先頭エントリの dateStr）
  const lastContactDate = toDateStr(allEntries[0]?.dateStr ?? null);
  const blankDays       = daysSinceDate(lastContactDate);
  const riskLevel       = getCommunicationRiskLevel(blankDays);

  // 直近 30 日のエントリ数
  const recentCount = allEntries.filter(e => isWithinDays(e.dateStr, 30)).length;

  // アクティブなソース
  const activeSources: CommunicationSource[] = [];
  if (chatwork.length > 0)      activeSources.push('chatwork');
  if (slack.length > 0)         activeSources.push('slack');
  if (notionMinutes.length > 0) activeSources.push('notion_minutes');

  return {
    lastContactDate,
    blankDays,
    riskLevel,
    activeSources,
    recentCount,
    totalCount,
    recentEntries: allEntries.slice(0, previewCount),
  };
}

// ── 空の VM（データなし状態） ──────────────────────────────────────────────────

export const EMPTY_COMMUNICATION_SIGNAL: CommunicationSignalVM = {
  lastContactDate: null,
  blankDays:       null,
  riskLevel:       'none',
  activeSources:   [],
  recentCount:     0,
  totalCount:      0,
  recentEntries:   [],
};

// ── ソースラベル ──────────────────────────────────────────────────────────────

export const COMMUNICATION_SOURCE_LABEL: Record<CommunicationSource, string> = {
  chatwork:      'Chatwork',
  slack:         'Slack',
  notion_minutes: 'Notion 議事録',
};
