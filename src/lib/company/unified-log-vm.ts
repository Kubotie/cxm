// ─── Unified Log ViewModel ────────────────────────────────────────────────────
//
// Company 単位の横断ログ（Communication + Evidence）を統一型に変換する。
// Unified Log ページ（/companies/[uid]/log）で使用する。
//
// データソース:
//   - CommunicationEntry (chatwork / slack / notion_minutes) — communication-signal.ts
//   - AppLogEntry (evidence テーブル) — nocodb/types.ts
//
// このファイルはサーバー・クライアント両対応（副作用なし）。

import type { CommunicationEntry } from '@/lib/company/communication-signal';
import type { AppLogEntry }        from '@/lib/nocodb/types';

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type UnifiedLogSourceType =
  | 'chatwork'
  | 'slack'
  | 'notion_minutes'
  | 'evidence'         // evidence テーブル由来（mail / minutes / support / inquiry / ticket / log）
  | 'intercom'
  | 'cse_ticket';

export type UnifiedLogRawType = 'comm' | 'evidence';

export interface UnifiedLogEntry {
  /** 一意キー */
  id:           string;
  /** "YYYY-MM-DD" or "YYYY-MM-DD HH:mm" */
  date:         string;
  title:        string;
  excerpt:      string;
  source:       UnifiedLogSourceType;
  sourceLabel:  string;
  hasActionItems: boolean;
  rawType:      UnifiedLogRawType;
  /** Evidence タブで Scope 表示に使う（evidence 由来のみ） */
  scope?:       string;
  /** Evidence の status（unprocessed 等） */
  evidenceStatus?: string;
}

// ── ソースラベル ───────────────────────────────────────────────────────────────

export const UNIFIED_LOG_SOURCE_LABEL: Record<UnifiedLogSourceType, string> = {
  chatwork:      'Chatwork',
  slack:         'Slack',
  notion_minutes: '議事録',
  evidence:      'Evidence',
  intercom:      'Intercom',
  cse_ticket:    'CSEチケット',
};

// ── ビルダー ──────────────────────────────────────────────────────────────────

function msFromDateStr(dateStr: string): number {
  if (!dateStr) return 0;
  const ms = new Date(dateStr.trim().replace(' ', 'T')).getTime();
  return isNaN(ms) ? 0 : ms;
}

function commEntryToUnified(entry: CommunicationEntry): UnifiedLogEntry {
  return {
    id:             entry.key,
    date:           entry.dateStr,
    title:          entry.title,
    excerpt:        entry.excerpt,
    source:         entry.source as UnifiedLogSourceType,
    sourceLabel:    UNIFIED_LOG_SOURCE_LABEL[entry.source as UnifiedLogSourceType] ?? entry.source,
    hasActionItems: entry.hasActionItems,
    rawType:        'comm',
  };
}

function logEntryToUnified(entry: AppLogEntry): UnifiedLogEntry {
  const sourceLabel = (() => {
    switch (entry.sourceType) {
      case 'minutes':  return '議事録';
      case 'support':  return 'サポート';
      case 'inquiry':  return '問い合わせ';
      case 'ticket':   return 'チケット';
      case 'mail':     return 'メール';
      default:         return 'ログ';
    }
  })();
  return {
    id:              entry.id,
    date:            entry.date,
    title:           entry.title,
    excerpt:         entry.excerpt,
    source:          'evidence',
    sourceLabel,
    hasActionItems:  false,
    rawType:         'evidence',
    scope:           entry.scope,
    evidenceStatus:  entry.status,
  };
}

/**
 * CommunicationEntry[] と AppLogEntry[] を統合して date 降順でソートした
 * UnifiedLogEntry[] を返す。
 */
export function buildUnifiedLogEntries(
  commEntries:     CommunicationEntry[],
  evidenceEntries: AppLogEntry[],
): UnifiedLogEntry[] {
  const unified = [
    ...commEntries.map(commEntryToUnified),
    ...evidenceEntries.map(logEntryToUnified),
  ];
  return unified.sort((a, b) => msFromDateStr(b.date) - msFromDateStr(a.date));
}

/**
 * UnifiedLogEntry[] を date（YYYY-MM-DD）でグループ化して返す。
 * キーは "YYYY-MM-DD"、値はその日のエントリ配列（date 降順）。
 */
export function groupUnifiedLogByDate(
  entries: UnifiedLogEntry[],
): Record<string, UnifiedLogEntry[]> {
  const result: Record<string, UnifiedLogEntry[]> = {};
  for (const entry of entries) {
    const key = (entry.date ?? '').slice(0, 10);
    if (!result[key]) result[key] = [];
    result[key].push(entry);
  }
  return result;
}
