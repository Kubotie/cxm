// ─── PtAI Pipeline: 保存しない計算（§3）────────────────────────────────────
//
// 出典: docs/ptai-dashboard-operation-flows.md §3
// 挙動の正: public/ptai-pipeline/board.js（アーティファクト Version 96）
//
// ═══════════════════════════════════════════════════════════════════════════
//  **ここは純粋関数だけ。** 外部接続も I/O も持たない。
//  画面・API・バッチが同じ数字を出せるよう、計算を 1 か所に閉じる。
//
//  ⚠ **仕様書 §3 と原本で 1 か所ずれている。**
//     §3 の表は「期待値MRR ＝ 現在MRR × フェーズの確率」と書いているが、
//     原本の実装と画面のツールチップは「**合算MRR** × フェーズの確率」。
//     ここは**原本に合わせている**（挙動を引き継ぐのが移植の前提のため）。
//     §9 に上げてある未決事項ではないので、必要なら別途確認すること。
//
//  ⚠ **原本 board.js との差が 1 つある（§9-6 の回答による意図的な差）。**
//     原本の `won` は `ph==='CLOSED_WON'` だけを確定にしている。
//     ここは「申込用紙回収済み」も確定に含める（WON_STAGES）。
//     **いま画面に出ている数字は原本側の計算なので、まだ変わらない。**
//     新しいデータ経路が画面を駆動するようになった時点で反映される。
// ═══════════════════════════════════════════════════════════════════════════

import { STAGE_PROB, type Stage } from './twenty-test/schema';

/** 足切り。会社ごとの追加MRR がこの額未満なら合算MRR ごと数えない（原本 AI_MIN）*/
export const AI_MIN = 100_000;

export interface DealLike {
  stage: Stage | null;
  /** （見込）追加MRR。円 */
  addMrr: number;
  /** 課金開始日 YYYY-MM-DD */
  billingDate?: string | null;
}

export interface CompanyLike {
  /** 現在MRR（Notion 顧客管理DB の値）。円 */
  mrr: number;
  /** 代表フェーズ。商談が 1 本ならその商談のフェーズ */
  stage: Stage | null;
  /** 会社としての（見込）追加MRR。商談が複数なら合算 */
  addMrr: number;
  /** （目標）追加MRR。目標の積み上げにだけ使う */
  aimMrr?: number;
  /** 商談。複数あるときは商談ごとに期待値を出す */
  deals?: DealLike[];
  /** 担当（呼称）。共同担当は均等割 */
  owners?: string[];
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const prob = (s: Stage | null): number => (s ? STAGE_PROB[s] ?? 0 : 0);

// ═══════════════════════════════════════════════════════════════════════════
// 金額
// ═══════════════════════════════════════════════════════════════════════════

/** 合算MRR ＝ 現在MRR ＋ 追加MRR */
export const totalMrr = (c: CompanyLike): number => num(c.mrr) + num(c.addMrr);

/** 商談 1 本ぶんの期待値。失注は 0 */
export const dealExpected = (d: DealLike): number =>
  d.stage === 'CLOSED_LOST' ? 0 : num(d.addMrr) * prob(d.stage);

/**
 * 期待値MRR。
 * 足切りを通らなければ 0。商談が 2 本以上なら
 * 「現在MRR × 代表フェーズの確率 ＋ 各商談の期待値」。
 */
export function expectedMrr(c: CompanyLike): number {
  if (num(c.addMrr) < AI_MIN) return 0;
  const deals = c.deals ?? [];
  if (deals.length > 1) {
    return num(c.mrr) * prob(c.stage) + deals.reduce((s, d) => s + dealExpected(d), 0);
  }
  return totalMrr(c) * prob(c.stage);
}

/**
 * **確定として数えるフェーズ**（§9-6 の回答 / 2026-10-01）。
 *
 * 「申込用紙回収済み」を確定MRR に**含める**と決まった。
 * 変更はここ 1 か所。確率（STAGE_PROB）は据え置きなので、
 * **申込用紙回収済みは「確定MRR に入るが、期待値は 95%」**という扱いになる。
 */
export const WON_STAGES: ReadonlySet<Stage> = new Set<Stage>(['APPLICATION', 'CLOSED_WON']);

export const isWon = (s: Stage | null): boolean => Boolean(s && WON_STAGES.has(s));

/** 確定した追加MRR。商談が複数なら確定フェーズのものだけ足す */
export function wonAddMrr(c: CompanyLike): number {
  const deals = c.deals ?? [];
  if (deals.length > 1) {
    return deals.filter(d => isWon(d.stage)).reduce((s, d) => s + num(d.addMrr), 0);
  }
  return num(c.addMrr);
}

/** 確定MRR。確定フェーズで、確定した追加MRR が足切りを超えた会社の合算MRR */
export function wonMrr(c: CompanyLike): number {
  const add = wonAddMrr(c);
  return !isWon(c.stage) || add < AI_MIN ? 0 : num(c.mrr) + add;
}

/**
 * 商談中（初回アポ実施済み〜口頭合意獲得済み）か。
 *
 * ⚠ **申込用紙回収済みは含めない。** §9-6 で確定に入れると決めたため、
 *   ここに残すと同じ金額が「確定MRR」と「商談中の合算MRR」の両方に出てしまい、
 *   商談中カードの「すべて契約になった場合の最大額」という説明が成り立たなくなる。
 *   仕様書 §3 の表は「初回アポ実施済み〜申込用紙回収済み」と書いているが、
 *   これは §9-6 の回答より前の記述。**確定に入れた以上、商談中からは外すのが筋。**
 */
const IN_DEAL: ReadonlySet<Stage> = new Set<Stage>([
  'FIRST_MEETING', 'TRIAL', 'QUOTE', 'VERBAL_COMMIT',
]);
export const isInDeal = (c: CompanyLike): boolean => Boolean(c.stage && IN_DEAL.has(c.stage));

/** 商談中の合算MRR。確率を掛けない、すべて契約になった場合の最大額 */
export const inDealMrr = (c: CompanyLike): number =>
  isInDeal(c) && num(c.addMrr) >= AI_MIN ? totalMrr(c) : 0;

/** 担当の持分。共同担当は均等割 */
export const shareOf = (c: CompanyLike, member: string): number => {
  const owners = c.owners ?? [];
  return owners.includes(member) ? 1 / owners.length : 0;
};

/**
 * 目標の積み上げ。
 * 計上額 ＝ 現在MRR ＋ max（見込追加MRR, 目標追加MRR）。足切りを通ったものだけ。
 * `member` を渡すと担当の持分を掛ける。
 */
export function stackedMrr(c: CompanyLike, member?: string): number {
  const add = Math.max(num(c.addMrr), num(c.aimMrr));
  if (add < AI_MIN) return 0;
  const amount = num(c.mrr) + add;
  return member ? amount * shareOf(c, member) : amount;
}

/** 内訳。確定 → 商談中 → 狙い の順に 1 社を 1 つだけ数える */
export type StackBucket = 'won' | 'inDeal' | 'aim' | 'none';
export function stackBucket(c: CompanyLike): StackBucket {
  if (wonMrr(c) > 0) return 'won';
  if (inDealMrr(c) > 0) return 'inDeal';
  if (Math.max(num(c.addMrr), num(c.aimMrr)) >= AI_MIN) return 'aim';
  return 'none';
}

// ═══════════════════════════════════════════════════════════════════════════
// 到達予定の逆算（§3・F-06）
// ═══════════════════════════════════════════════════════════════════════════

/** 申込完了日から何日前か。原本の値 */
export const MS_OFFSET_DAYS = { TRIAL: 49, QUOTE: 35, VERBAL_COMMIT: 10 } as const;
/** 課金開始日を基準にするときは 14 日引いてから逆算する */
export const MS_BILL_OFFSET_DAYS = 14;

export type MsBase = 'apply' | 'bill';

const parseYmd = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const fmtYmd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number): Date => {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
};
/** 土日は金曜へ寄せる */
function toWeekday(d: Date): Date {
  const w = d.getDay();
  if (w === 6) return addDays(d, -1);   // 土 → 金
  if (w === 0) return addDays(d, -2);   // 日 → 金
  return d;
}

export interface MilestoneDates {
  TRIAL: string | null;
  QUOTE: string | null;
  VERBAL_COMMIT: string | null;
}

/**
 * 到達予定を逆算する。
 * 基準は申込完了日。課金開始日を基準にするときは 14 日引いてから逆算する。
 * 土日に当たったら金曜へ寄せる。
 */
export function backcastMilestones(
  base: { applyDate?: string | null; billingDate?: string | null; msBase?: MsBase | null },
): MilestoneDates {
  const empty: MilestoneDates = { TRIAL: null, QUOTE: null, VERBAL_COMMIT: null };
  const useBill = base.msBase === 'bill';
  const raw = useBill ? base.billingDate : base.applyDate;
  const anchor = parseYmd(String(raw ?? ''));
  if (!anchor) return empty;

  const from = useBill ? addDays(anchor, -MS_BILL_OFFSET_DAYS) : anchor;
  return {
    TRIAL:         fmtYmd(toWeekday(addDays(from, -MS_OFFSET_DAYS.TRIAL))),
    QUOTE:         fmtYmd(toWeekday(addDays(from, -MS_OFFSET_DAYS.QUOTE))),
    VERBAL_COMMIT: fmtYmd(toWeekday(addDays(from, -MS_OFFSET_DAYS.VERBAL_COMMIT))),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 遅れ・期限（§3・お知らせの発生条件）
// ═══════════════════════════════════════════════════════════════════════════

/** 進行順の位置。失注は -1 */
const STAGE_INDEX: readonly Stage[] = [
  'NOT_STARTED', 'FIRST_MEETING', 'TRIAL', 'QUOTE', 'VERBAL_COMMIT', 'APPLICATION', 'CLOSED_WON',
];
export const stageRank = (s: Stage | null): number =>
  s ? STAGE_INDEX.indexOf(s) : -1;

export interface LateMilestone {
  stage: Stage;
  /** 予定日からの遅れ日数 */
  days: number;
}

/**
 * 「予定より遅れ」の判定。
 * 到達予定の日を過ぎているのに、そのフェーズに未到達なら遅れ。
 * 最も古い遅れを 1 つ返す。
 */
export function lateMilestone(
  current: Stage | null, ms: Partial<MilestoneDates>, today: Date,
): LateMilestone | null {
  const cur = stageRank(current);
  if (current === 'CLOSED_WON' || current === 'CLOSED_LOST') return null;

  let worst: LateMilestone | null = null;
  for (const key of ['TRIAL', 'QUOTE', 'VERBAL_COMMIT'] as const) {
    const due = parseYmd(String(ms[key] ?? ''));
    if (!due) continue;
    if (stageRank(key) <= cur) continue;              // すでに到達している
    if (due >= today) continue;                        // まだ期日前
    const days = Math.round((today.getTime() - due.getTime()) / 86_400_000);
    if (!worst || days > worst.days) worst = { stage: key, days };
  }
  return worst;
}

export type DueState = 'overdue' | 'this_week' | 'later' | 'none';

/** ネクストアクション・Todo の期日の状態 */
export function dueState(dueDate: string | null | undefined, today: Date): DueState {
  const due = parseYmd(String(dueDate ?? ''));
  if (!due) return 'none';
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return 'overdue';
  if (diff <= 7) return 'this_week';
  return 'later';
}

// ═══════════════════════════════════════════════════════════════════════════
// 集計
// ═══════════════════════════════════════════════════════════════════════════

export interface Kpis {
  /** 確定MRR */
  won: number;
  /** 期待値MRR */
  expected: number;
  /** 商談中の合算MRR */
  inDeal: number;
  wonCount: number;
  inDealCount: number;
}

/** チーム全体、または 1 メンバーぶんの KPI。member を渡すと持分で按分する */
export function kpis(companies: CompanyLike[], member?: string): Kpis {
  const w = (c: CompanyLike) => (member ? shareOf(c, member) : 1);
  let won = 0, expected = 0, inDeal = 0, wonCount = 0, inDealCount = 0;
  for (const c of companies) {
    const share = w(c);
    if (share === 0) continue;
    const cw = wonMrr(c), ci = inDealMrr(c);
    won      += cw * share;
    expected += expectedMrr(c) * share;
    inDeal   += ci * share;
    if (cw > 0) wonCount++;
    if (ci > 0) inDealCount++;
  }
  return { won, expected, inDeal, wonCount, inDealCount };
}
