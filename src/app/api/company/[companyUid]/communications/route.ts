// ─── GET /api/company/[companyUid]/communications ─────────────────────────────
//
// 個社のコミュニケーション/サポート会話を統一リストで返す。CXM v2 会社詳細タブ3用。
//
//   log_notion_minutes          … 商談議事録（本文・参加者・アクションアイテム）
//   log_chatwork / log_slack    … 顧客チャネルの会話
//   log_intercom（mail）        … メール
//   log_intercom（recentCases） … Intercom サポート会話
//   cse_tickets                 … CSE 案件
//
// ⚠️ 各ソースのフィールド名は型（@/lib/nocodb/types）に厳密に合わせること。
//    以前は存在しないフィールド（pageName / sentAt / displayTitle / body）を参照しており、
//    タイトル・日付・本文がすべて空で返っていた。
//
// ⚠️ 本文カラムの実体（2026-08 実測）:
//    log_intercom … raw_body（会話全文）。body / original_message は存在しない。
//    cse_tickets  … display_message（AI整形済み）→ describe（起票内容）。
//                   description は存在せず、集計用の投影にも本文列が無いため
//                   表示分だけ Id 指定で取り直している（support-by-company.ts）。

import { NextResponse } from 'next/server';
import { fetchAllCommunicationLogs, type AllCommunicationLogs } from '@/lib/nocodb/communication-logs';
import { fetchSupportAggregateForCompany } from '@/lib/nocodb/support-by-company';

export const maxDuration = 60;

export type CommChannel = 'chatwork' | 'slack' | 'notion' | 'mail' | 'intercom' | 'cse';

/** これ以外の severity は表示しない（medium / low は全行に並ぶだけで判断材料にならない） */
const NOTABLE_SEVERITIES = new Set(['high', 'critical', 'urgent']);

export interface CommItem {
  id:      string;
  channel: CommChannel;
  /** 見出し（議事録タイトル / 発言者 / 件名 / 案件名） */
  title:   string;
  /** 本文。空文字 = 元データに本文がない */
  body:    string;
  /** 本文の文字数（UI で「全文を開く」を出すか判断する） */
  bodyLength: number;
  /** 発生日時。"YYYY-MM-DD" or "YYYY-MM-DD HH:mm" */
  date:    string | null;
  /** 最終更新日時。元データに更新日が無い場合は null */
  updatedAt: string | null;
  /** 補足ラベル（チャンネル名 / ステータス等） */
  meta:    string | null;
  /**
   * Intercom の会話状態。open / snoozed が「まだ動いている」もの。
   * Intercom 以外のチャネルは null。
   */
  state?:  'open' | 'snoozed' | 'closed' | null;
  /** 議事録の参加者（議事録のみ） */
  participants?: string[];
  /** 議事録のアクションアイテム（議事録のみ） */
  actionItems?:  string[];
}

export interface CommunicationsResponse {
  companyUid: string;
  counts: Record<CommChannel, number>;
  /** 本文を持つ件数（UI の注意書き用） */
  withBodyCount: number;
  items: CommItem[];
}

const EMPTY_LOGS: AllCommunicationLogs = {
  chatwork: [], slack: [], notionMinutes: [], intercomMail: [],
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyUid: string }> },
): Promise<NextResponse<CommunicationsResponse | { error: string }>> {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }

  const [logs, support] = await Promise.all([
    fetchAllCommunicationLogs(companyUid).catch(() => EMPTY_LOGS),
    fetchSupportAggregateForCompany(companyUid).catch(() => null),
  ]);

  const items: CommItem[] = [];
  // '—'（マッパーの未設定プレースホルダ）は日付なしとして扱う
  const norm = (v: string | null | undefined) => (v && v !== '—' ? v : null);
  const push = (it: Omit<CommItem, 'bodyLength'>) =>
    items.push({
      ...it,
      date:       norm(it.date),
      updatedAt:  norm(it.updatedAt),
      bodyLength: it.body.length,
    });

  // ── 議事録（最も本文価値が高い）─────────────────────────────────────────
  for (const n of logs.notionMinutes) {
    push({
      id:      `nt-${n.id}`,
      channel: 'notion',
      title:   n.title,
      body:    n.body ?? '',
      date:    n.meetingDate ?? n.createdAt,
      updatedAt: n.updatedAt,
      meta:    n.participants.length > 0 ? `参加者 ${n.participants.length}名` : '議事録',
      participants: n.participants,
      actionItems:  n.actionItems,
    });
  }

  // ── チャット ────────────────────────────────────────────────────────────
  for (const c of logs.chatwork) {
    push({
      id:      `cw-${c.id}`,
      channel: 'chatwork',
      title:   c.senderName || 'Chatwork',
      body:    c.body ?? '',
      date:    c.sentAt,
      updatedAt: c.updatedAt,
      meta:    c.roomName,
    });
  }
  for (const s of logs.slack) {
    push({
      id:      `sl-${s.id}`,
      channel: 'slack',
      title:   s.userName || 'Slack',
      body:    s.text ?? '',
      date:    s.sentAt,
      updatedAt: s.updatedAt,
      meta:    s.channel,
    });
  }

  // ── メール ──────────────────────────────────────────────────────────────
  for (const m of logs.intercomMail) {
    push({
      id:      `ml-${m.id}`,
      channel: 'mail',
      title:   m.subject || m.senderName || 'メール',
      body:    m.body ?? '',
      date:    m.sentAt,
      updatedAt: m.updatedAt,
      meta:    m.senderName,
    });
  }

  // ── サポート ────────────────────────────────────────────────────────────
  for (const c of (support?.recentCases ?? [])) {
    push({
      id:      `ic-${c.id}`,
      channel: 'intercom',
      title:   c.title,
      // originalMessage = raw_body（会話全文）。無い場合は triageNote で代替する
      body:    c.originalMessage ?? c.triageNote ?? '',
      date:    c.createdAt,
      updatedAt: c.updatedAt,
      // **アサイン状態は出さない。** 未アサインでも回答担当がいるので運用上の意味が無く、
      // 「unassigned」が滞留しているように見えるだけだった（2026-08-25）。
      // 見るべきは Intercom の会話状態（open / snoozed / closed）。
      state:   c.state,
      // severity は大半が medium で、出すと全行に同じ語が並ぶだけ。
      // 手が要る high / critical のときだけ添える
      meta:    NOTABLE_SEVERITIES.has((c.severity ?? '').toLowerCase()) ? c.severity : null,
    });
  }
  for (const t of (support?.cseTickets ?? [])) {
    push({
      id:      `cse-${t.id}`,
      channel: 'cse',
      title:   t.title,
      // description = display_message / describe（cse_tickets に description 列は無い）
      body:    t.description ?? '',
      date:    t.createdAt,
      updatedAt: t.updatedAt,
      meta:    [t.status, t.priority].filter(Boolean).join(' / ') || null,
    });
  }

  // 新しい順（日付不明は末尾）
  items.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  const counts: Record<CommChannel, number> =
    { chatwork: 0, slack: 0, notion: 0, mail: 0, intercom: 0, cse: 0 };
  for (const it of items) counts[it.channel]++;

  return NextResponse.json({
    companyUid,
    counts,
    withBodyCount: items.filter(i => i.bodyLength > 0).length,
    items,
  });
}
