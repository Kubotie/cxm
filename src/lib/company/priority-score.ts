// ─── Company List Priority Score ─────────────────────────────────────────────
//
// Company List のデフォルトソートに使う優先度スコアを計算する。
// スコアが高い企業を上位表示することで「今日どこを触るべきか」を示す。
//
// 設計方針:
//   - health/risk 由来のシグナルをウェイト加算でスコア化
//   - 同スコアの場合は last_contact 古い順を呼び出し元でセカンダリソート
//   - ウェイトは badges.ts の PRIORITY_WEIGHT に集約（変更は1箇所）
//
// 入力は CompanyHealthSignalVM と summary freshness などの派生済み値を受け取る。
// このファイルはサーバー・クライアント両対応（副作用なし）。

import type { CompanyHealthSignalVM } from '@/lib/company/health-signal';
import type { SummaryFreshnessStatus } from '@/lib/company/company-summary-state-policy';
import { PRIORITY_WEIGHT } from '@/lib/company/badges';
import { isUnreviewed }    from '@/lib/company/company-summary-state-policy';
import type { PeopleActionSignal } from '@/lib/company/company-people-risk';

// ── 型定義 ────────────────────────────────────────────────────────────────────

export interface PriorityScoreInput {
  healthVM:          CompanyHealthSignalVM;
  freshnessStatus:   SummaryFreshnessStatus | null;
  humanReviewStatus: string | null;
  openSupportCount:  number;
  communicationBlankDays: number | null;
  /** People / Action シグナル（省略時はスキップ） */
  peopleActionSignal?: PeopleActionSignal | null;
  /** 更新バケット（省略時はスコアに反映しない） */
  renewalBucket?: '0-30' | '31-90' | '91-180' | '180+' | 'expired' | null;
}

export interface PriorityScoreResult {
  score:       number;
  breakdown:   PriorityScoreBreakdown[];
}

export interface PriorityScoreBreakdown {
  reason: string;
  weight: number;
}

// ── スコア計算 ────────────────────────────────────────────────────────────────

/**
 * 1企業の PriorityScore を計算する。
 * Company List のソートに使用する。
 */
export function calcPriorityScore(
  input: PriorityScoreInput,
): PriorityScoreResult {
  const { healthVM, freshnessStatus, humanReviewStatus, openSupportCount, communicationBlankDays } = input;
  const breakdown: PriorityScoreBreakdown[] = [];
  let score = 0;

  const add = (reason: string, weight: number) => {
    score += weight;
    breakdown.push({ reason, weight });
  };

  // ── Health ──────────────────────────────────────────────────────────────
  if (healthVM.overallHealth === 'critical') {
    add('health: critical', PRIORITY_WEIGHT.health_critical);
  } else if (healthVM.overallHealth === 'at_risk') {
    add('health: at_risk', PRIORITY_WEIGHT.health_at_risk);
  }

  // ── Summary freshness ───────────────────────────────────────────────────
  if (freshnessStatus === 'missing') {
    add('summary: missing', PRIORITY_WEIGHT.summary_missing);
  } else if (freshnessStatus === 'stale') {
    add('summary: stale', PRIORITY_WEIGHT.summary_stale);
  }

  if (freshnessStatus !== 'missing' && isUnreviewed(humanReviewStatus)) {
    add('summary: unreviewed', PRIORITY_WEIGHT.summary_unreviewed);
  }

  // ── Communication blank ─────────────────────────────────────────────────
  if (communicationBlankDays !== null) {
    if (communicationBlankDays >= 60) {
      add(`communication blank: ${communicationBlankDays}d`, PRIORITY_WEIGHT.comm_blank_risk);
    } else if (communicationBlankDays >= 30) {
      add(`communication blank: ${communicationBlankDays}d`, PRIORITY_WEIGHT.comm_blank_warning);
    }
  }

  // ── Phase signals ────────────────────────────────────────────────────────
  const hasPhaseGap       = healthVM.riskSignals.some(s => s.type === 'phase_gap');
  const hasPhaseStagnation = healthVM.riskSignals.some(s => s.type === 'phase_stagnation');

  if (hasPhaseGap)        add('phase: gap',       PRIORITY_WEIGHT.phase_gap);
  if (hasPhaseStagnation) add('phase: stagnation', PRIORITY_WEIGHT.phase_stagnation);

  // ── Support ──────────────────────────────────────────────────────────────
  if (healthVM.riskSignals.some(s => s.type === 'support_critical')) {
    add('support: critical case', PRIORITY_WEIGHT.support_critical);
  } else if (openSupportCount >= 5) {
    add(`support: ${openSupportCount} open cases`, PRIORITY_WEIGHT.support_high_count);
  }

  // ── Projects ─────────────────────────────────────────────────────────────
  if (healthVM.riskSignals.some(s => s.type === 'project_stalled')) {
    add('projects: all stalled', PRIORITY_WEIGHT.project_all_stalled);
  }

  // ── Renewal 接近 ────────────────────────────────────────────────────────────
  if (input.renewalBucket === '0-30') {
    add('renewal: 30日以内', PRIORITY_WEIGHT.renewal_30);
  } else if (input.renewalBucket === '31-90') {
    add('renewal: 31-90日', PRIORITY_WEIGHT.renewal_90);
  }

  // ── Opportunity / Expansion ───────────────────────────────────────────────
  // リスク系より弱い重みで機会シグナルを加算する。
  // expanding + opportunity_signal がスタックしても at_risk(15) 程度に収まる設計。
  if (healthVM.overallHealth === 'expanding') {
    add('health: expanding', PRIORITY_WEIGHT.health_expanding);
  }
  const hasExpansionSignal = healthVM.opportunitySignals.some(s =>
    s.type === 'expansion_project' ||
    s.type === 'upsell_signal'     ||
    s.type === 'new_use_case',
  );
  if (hasExpansionSignal) {
    add('opportunity: 拡大・新規活用シグナルあり', PRIORITY_WEIGHT.opportunity_signal);
  }

  // ── People / Action signals ───────────────────────────────────────────────
  if (input.peopleActionSignal) {
    const pa = input.peopleActionSignal;
    if (pa.hasNoDecisionMaker) {
      add('people: 意思決定者未登録', PRIORITY_WEIGHT.people_no_dm);
    } else if (pa.hasStaleDm) {
      add('people: 意思決定者 90d+ 未接触', PRIORITY_WEIGHT.people_stale_dm);
    }
    if (pa.hasOverdueActions) {
      add('action: 期限切れあり', PRIORITY_WEIGHT.action_overdue);
    } else if (pa.openActionCount >= 5) {
      add(`action: open ${pa.openActionCount}件`, PRIORITY_WEIGHT.action_many_open);
    }
  }

  return { score, breakdown };
}

/**
 * Company List のソート比較関数。
 * priority score 降順 → last_contact 昇順（古いほど上位）。
 */
export function comparePriorityDesc(
  a: { score: number; lastContact: string },
  b: { score: number; lastContact: string },
): number {
  if (b.score !== a.score) return b.score - a.score;
  // score が同じなら last_contact が古い（接触機会が遠い）を上位に
  return a.lastContact < b.lastContact ? -1 : a.lastContact > b.lastContact ? 1 : 0;
}
