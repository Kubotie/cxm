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
import {
  fetchSupportAggregateForCompany, isCseOpen, SUPPORT_RISK_WINDOW_DAYS,
} from '@/lib/nocodb/support-by-company';

export const maxDuration = 60;

export type CommChannel = 'chatwork' | 'slack' | 'notion' | 'mail' | 'intercom' | 'cse';

/**
 * Intercom ワークスペースの id_code。
 * GET https://api.intercom.io/me の app.id_code（Ptengine / US リージョン）。
 * ワークスペース固定値で秘密情報ではない。
 */
const INTERCOM_APP_ID = 'cfiqb37k';

/**
 * Intercom 管理画面の会話URL。
 * 旧形式 /a/apps/{app}/conversations/{id} は現形式へ301するので、
 * リダイレクトを踏まない現形式を直接組む。
 */
function intercomUrl(conversationId: string | null | undefined): string | null {
  const id = String(conversationId ?? '').trim();
  if (!/^\d+$/.test(id)) return null;
  return `https://app.intercom.com/a/inbox/${INTERCOM_APP_ID}/inbox/conversation/${id}`;
}

/**
 * Notion ページURL。CSE チケットも議事録も実体は Notion ページで、
 * どちらもハイフン付き UUID が入っている。ハイフンを抜いた32桁形式で開ける。
 */
function notionUrl(pageId: string | null | undefined): string | null {
  const id = String(pageId ?? '').replace(/-/g, '').toLowerCase();
  return /^[0-9a-f]{32}$/.test(id) ? `https://www.notion.so/${id}` : null;
}

/**
 * 未クローズのまま 90 日以上動いていないか。
 * 日付が読めないものは「古い」とみなす — cse_tickets は created_at が空の行が
 * 多く（実測で未クローズ705件中185件）、日付不明を「新しい」に倒すと
 * 摩擦が過大に出る。
 */
function isStaleOpen(date: string | null): boolean {
  if (!date) return true;
  const ms = new Date(String(date).trim().replace(' ', 'T')).getTime();
  if (isNaN(ms)) return true;
  return (Date.now() - ms) / (1000 * 60 * 60 * 24) > SUPPORT_RISK_WINDOW_DAYS;
}

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
  /**
   * 元コンテンツへのリンク。Intercom は管理画面、CSE と議事録は Notion。
   * 識別子が無い / 形式が想定外なら null（リンクを出さない）。
   */
  url?:    string | null;
  /**
   * 未クローズだが SUPPORT_RISK_WINDOW_DAYS（90日）以上動きが無いもの。
   * 提案準備度の「摩擦」には数えていない（閉じ忘れが恒久的な減点になるため）。
   * リストには出すが、現在の摩擦と区別できるようにする。
   */
  staleOpen?: boolean;
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
  const push = (it: Omit<CommItem, 'bodyLength'>) => {
    const date = norm(it.date);
    items.push({
      ...it,
      date,
      updatedAt:  norm(it.updatedAt),
      // 未クローズのものだけ滞留判定する（closed に付けても意味がない）
      staleOpen:  (it.state === 'open' || it.state === 'snoozed')
                    ? isStaleOpen(norm(it.updatedAt) ?? date)
                    : undefined,
      bodyLength: it.body.length,
    });
  };

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
      // AppLogNotionMinutes.id は page_id（Notion ページUUID）。無い行は Id が入るので notionUrl 側で弾かれる
      url:     notionUrl(n.id),
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
      url:     intercomUrl(m.sourceId),
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
      url:     intercomUrl(c.sourceId),
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
      // CSE も未クローズが分かるようにする。Intercom と同じ state 語彙に寄せる
      state:   isCseOpen(t.status) ? 'open' : 'closed',
      meta:    [t.status, t.priority].filter(Boolean).join(' / ') || null,
      url:     notionUrl(t.sourceId),
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
