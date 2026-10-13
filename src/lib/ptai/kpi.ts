// ─── ダッシュボードの数字（毎朝のスナップショットと API が使う）──────────────
//
// ═══════════════════════════════════════════════════════════════════════════
//  **画面（board.js）と同じ式をここに置く。** 数字が 2 通りできないように。
//  board.js 側の FORECAST / rung / m2 / m3 / wonAmt / atLeast / planOf と
//  1 対 1 で対応させてある。board.js を直したらここも直すこと
//  （scripts/ptai-kpi.test.mts が式を固定している）。
//
//  旧 calc.ts は v1 の式（10万円の足切り・合算MRR × Salesforce の確率）で、
//  2026-10-05 に画面を合算MRR 基準へ揃えた時点で合わなくなった。
//  新しく書くものはこちらを使う。
// ═══════════════════════════════════════════════════════════════════════════
//
// 純粋関数だけ。外部接続も I/O も持たない。

import { STAGE_ORDER, type Stage } from './twenty-test/schema';

/** ③（見込）追加MRR の係数。Salesforce の DefaultProbability とは別物（運用で決めた値） */
export const FORECAST: Record<string, number> = {
  INACTIVE: 0, ACTIVE: 0, GOAL_SHARED: .30, QUALIFIED_CHAMPION: .50,
  EVALUATING: .70, PROBABLE: .90, VERBAL: .90, WON: 1, CLOSED_WON: 1,
  ADMIN_CLOSE: 0, CLOSED_LOST: 0,
};

/** 確定とみなすフェーズ（2026-10-01 の決定。Won も含める） */
export const WON_SET: readonly string[] = ['WON', 'CLOSED_WON'];
/** 数えない（失注・管理上のクローズ） */
const CLOSED_OUT: readonly string[] = ['CLOSED_LOST', 'ADMIN_CLOSE'];

/** 計画に数える下限。①か受注額がこれ未満の会社は計画に入れない */
export const AI_MIN = 100_000;

export interface KpiDeal {
  stage: string | null;
  /** （商談）追加MRR。円 */
  addMrr: number;
  /** ネクストアクションの期日 YYYY-MM-DD */
  naDate?: string | null;
  /** ネクストアクションの本文。空なら期限超過に数えない */
  na?: string | null;
}

export interface KpiCompany {
  cid: string;
  owners: string[];
  /** 現在MRR（毎朝の同期で入る値） */
  curMrr: number;
  /** 期初MRR。積み上げの土台はこちら（現在MRR だと受注ぶんが二重になる） */
  baseMrr: number;
  /** ①（目標）追加MRR */
  aim: number;
  deals: KpiDeal[];
}

const rank = (s: string | null | undefined): number =>
  STAGE_ORDER.indexOf(String(s ?? '') as Stage);

const open = (c: KpiCompany): KpiDeal[] =>
  c.deals.filter(d => !CLOSED_OUT.includes(String(d.stage ?? '')));

/** ②（商談）追加MRR */
export const m2 = (c: KpiCompany): number =>
  open(c).reduce((t, d) => t + (d.addMrr || 0), 0);

/** ③（見込）追加MRR ＝ 商談ごとに 金額 × 係数 */
export const m3 = (c: KpiCompany): number =>
  open(c).reduce((t, d) => t + (d.addMrr || 0) * (FORECAST[String(d.stage ?? '')] ?? 0), 0);

/** 受注した商談の金額 */
export const wonAmt = (c: KpiCompany): number =>
  c.deals.filter(d => WON_SET.includes(String(d.stage ?? '')))
    .reduce((t, d) => t + (d.addMrr || 0), 0);

/** 指定フェーズ以上の商談の金額 */
export const atLeast = (c: KpiCompany, from: string): number => {
  const i = rank(from);
  return open(c).reduce((t, d) => t + (rank(d.stage) >= i ? (d.addMrr || 0) : 0), 0);
};

/**
 * 積み上げ 1 段ぶん（合算MRR 基準）。
 * 対象の商談がある会社だけ、期初MRR を **1 回だけ**足す。
 */
export const rung = (c: KpiCompany, amt: number): number => amt > 0 ? c.baseMrr + amt : 0;

/** 計画に入る会社か。入るなら 期初MRR と 追加分 */
export function planOf(c: KpiCompany): { base: number; add: number } | null {
  const a = c.aim, w = wonAmt(c);
  const add = Math.max(a >= AI_MIN ? a : 0, w >= AI_MIN ? w : 0);
  return add ? { base: c.baseMrr, add } : null;
}

/** 共同担当は均等按分。チーム全体は 1 */
export const share = (c: KpiCompany, member?: string | null): number => {
  if (!member) return 1;
  const n = c.owners.length;
  return n && c.owners.includes(member) ? 1 / n : 0;
};

export interface KpiRow {
  /** 'team' かメンバー名 */
  scope: string;
  targetMrr: number;
  /** 計画＝期初MRR ＋ 追加分 */
  plan: number;
  planCompanies: number;
  /** 計画の内訳 */
  planBase: number; planWon: number; planDeal: number; planAim: number;
  /** 期待値＝③の合計 */
  expected: number;
  won: number;        wonCompanies: number;
  commit: number;     commitCompanies: number;
  challenge: number;  challengeCompanies: number;
  pipeline: number;   pipelineCompanies: number;
  /** ネクストアクションの期限超過（件数） */
  overdue: number;
  /** 参考 */
  currentMrr: number; baseMrr: number;
  companies: number;  deals: number;
}

export function computeKpis(
  cos: KpiCompany[], opts: { scope?: string; targetMrr: number; today: string },
): KpiRow {
  const m = opts.scope && opts.scope !== 'team' ? opts.scope : null;
  const w = (c: KpiCompany) => share(c, m);
  const inScope = cos.filter(c => w(c) > 0);
  const sum = (f: (c: KpiCompany) => number) => inScope.reduce((t, c) => t + f(c) * w(c), 0);
  const cnt = (f: (c: KpiCompany) => boolean) => inScope.filter(f).length;

  let planBase = 0, planWon = 0, planDeal = 0, planAim = 0, planCompanies = 0;
  for (const c of inScope) {
    const p = planOf(c); if (!p) continue;
    const k = w(c);
    planCompanies++;
    planBase += p.base * k;
    const v = p.add * k;
    if (wonAmt(c) > 0)   planWon  += v;
    else if (open(c).length) planDeal += v;
    else                 planAim  += v;
  }

  // board.js と同じ条件。**除くのは CLOSED_WON と CLOSED_LOST だけ**で、
  // WON（申込用紙回収済み）と ADMIN_CLOSE は数える。揃えないと件数がずれる
  const overdue = inScope.reduce((t, c) => t + c.deals.filter(d =>
    !['CLOSED_WON', 'CLOSED_LOST'].includes(String(d.stage ?? '')) &&
    d.na && d.naDate && d.naDate < opts.today).length, 0);

  return {
    scope: opts.scope ?? 'team',
    targetMrr: opts.targetMrr,
    plan: planBase + planWon + planDeal + planAim,
    planCompanies, planBase, planWon, planDeal, planAim,
    expected: sum(m3),
    won:       sum(c => rung(c, wonAmt(c))),                    wonCompanies:       cnt(c => wonAmt(c) > 0),
    commit:    sum(c => rung(c, atLeast(c, 'PROBABLE'))),       commitCompanies:    cnt(c => atLeast(c, 'PROBABLE') > 0),
    challenge: sum(c => rung(c, atLeast(c, 'QUALIFIED_CHAMPION'))), challengeCompanies: cnt(c => atLeast(c, 'QUALIFIED_CHAMPION') > 0),
    pipeline:  sum(c => rung(c, m2(c))),                        pipelineCompanies:  cnt(c => m2(c) > 0),
    overdue,
    currentMrr: sum(c => c.curMrr),
    baseMrr:    sum(c => c.baseMrr),
    companies:  inScope.length,
    deals:      inScope.reduce((t, c) => t + c.deals.length, 0),
  };
}
