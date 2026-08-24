// ─── Replaceability Signal（代替可能性の認知検出）────────────────────────────
//
// 「他ツールで代替できる」「内製化で置き換える」という**認知**を接点ログから検出する。
//
// なぜ必要か:
//   サポートチケットが0件でも、顧客側で「これは別のツールで代替できる」と
//   判断されていれば摩擦は存在する。この状態で新提案を持ち込むと不誠実に映る。
//   提案準備度（proposal-readiness.ts）の ④friction はこれを入力に取る。
//
// 設計方針:
//   - キーワード照合による**推定**であり確定ではない。必ず hits（根拠）を返し、
//     UI 側で担当者が打ち消せる形にする（17_WHO_WHAT_Matching_Plan.md §9.2 の3層モデル）
//   - 誤検知を許容し、見逃しを避ける側に振る。判断は人に返す
//   - 競合名の検出は X9_Mkt_CompetitorAdoption（§11.3）の原型としても使う
//
// このファイルはサーバー・クライアント両対応（副作用なし）。

import type { AppLogNotionMinutes, AppLogChatwork, AppLogSlack } from '@/lib/nocodb/types';

// ── 辞書 ──────────────────────────────────────────────────────────────────────
//
// 追加・調整はこの2つの配列のみで完結させる。

/** 代替・撤退の意思を示す語 */
const REPLACEMENT_TERMS = [
  '代替', '内製化', '自社開発', 'リプレース', '乗り換え', '乗換え',
  '解約', '契約終了', '契約見直し', 'ダウングレード', '他社ツール', '無料ツール',
] as const;

/** 競合・代替ツール名（表記ゆれを含む） */
const COMPETITOR_TERMS = [
  'Clarity', 'クラリティ',
  'GA4', 'Googleアナリティクス',
  'VWO', 'Optimize', 'オプティマイズ',
  'Flipdesk', 'フリップデスク',
  'KARTE', 'カルテ',
  'Adobe', 'アドビ',
  'Hotjar', 'ホットジャー',
  'Contentsquare',
] as const;

/** 検出対象とする期間（日） */
const LOOKBACK_DAYS = 180;

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type ReplaceabilitySource = 'minutes' | 'chatwork' | 'slack';

export interface ReplaceabilityHit {
  source: ReplaceabilitySource;
  /** "YYYY-MM-DD"。不明なら null */
  date:   string | null;
  /** 議事録タイトル / チャンネル名など */
  label:  string;
  /** 検出された代替・撤退の語 */
  replacementTerms: string[];
  /** 検出された競合・代替ツール名 */
  competitorTerms:  string[];
}

export interface ReplaceabilitySignalVM {
  /**
   * 代替可能性の認知が検出されたか。
   * 推定であり確定ではない。担当者が打ち消せる前提で使う。
   */
  detected: boolean;
  /** 検出根拠。新しい順 */
  hits:     ReplaceabilityHit[];
  /** 検出された競合名の重複排除リスト（X9 シグナルの入力） */
  competitors: string[];
  /** 最新の検出日（"YYYY-MM-DD"）。未検出なら null */
  latestDate: string | null;
}

export const EMPTY_REPLACEABILITY: ReplaceabilitySignalVM = {
  detected:    false,
  hits:        [],
  competitors: [],
  latestDate:  null,
};

// ── 本体 ──────────────────────────────────────────────────────────────────────

/**
 * 接点ログから代替可能性の認知を検出する。
 *
 * 判定条件:
 *   代替・撤退の語 が1つ以上 検出された場合に hit とする。
 *   競合名のみの言及は hit にしない（比較検討の話題は日常的に出るため）が、
 *   competitors には収集する（X9 シグナル用）。
 */
export function buildReplaceabilitySignal(
  minutes:  AppLogNotionMinutes[],
  chatwork: AppLogChatwork[],
  slack:    AppLogSlack[],
): ReplaceabilitySignalVM {
  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const hits: ReplaceabilityHit[] = [];
  const competitorSet = new Set<string>();

  const scan = (
    source: ReplaceabilitySource,
    date:   string | null,
    label:  string,
    text:   string,
  ) => {
    if (!text) return;
    if (!withinCutoff(date, cutoff)) return;

    const replacementTerms = REPLACEMENT_TERMS.filter(t => text.includes(t));
    const competitorTerms  = COMPETITOR_TERMS.filter(t => text.includes(t));

    for (const c of competitorTerms) competitorSet.add(c);

    // 代替・撤退の語が無ければ hit にしない（競合名だけの言及は通常の比較検討）
    if (replacementTerms.length === 0) return;

    hits.push({
      source,
      date,
      label,
      replacementTerms: [...replacementTerms],
      competitorTerms:  [...competitorTerms],
    });
  };

  for (const m of minutes) {
    scan('minutes', m.meetingDate, m.title, `${m.title}\n${m.body}`);
  }
  for (const c of chatwork) {
    scan('chatwork', dateOf(c.sentAt), c.roomName ?? 'Chatwork', c.body);
  }
  for (const s of slack) {
    scan('slack', dateOf(s.sentAt), s.channel ?? 'Slack', s.text);
  }

  // 新しい順（日付不明は末尾）
  hits.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  return {
    detected:    hits.length > 0,
    hits,
    competitors: [...competitorSet],
    latestDate:  hits.find(h => h.date)?.date ?? null,
  };
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

function dateOf(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** date が null の場合は期間内として扱う（日付欠損で見逃さない） */
function withinCutoff(date: string | null, cutoffMs: number): boolean {
  if (!date) return true;
  const t = new Date(`${date}T00:00:00`).getTime();
  if (isNaN(t)) return true;
  return t >= cutoffMs;
}
