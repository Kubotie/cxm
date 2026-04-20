// ─── Action Prefill Helper ────────────────────────────────────────────────────
//
// Action 作成ダイアログへ渡す prefill データを、
// 起票源（risk signal / opportunity signal / org chart person / people risk）
// ごとに統一的に生成するヘルパー。
//
// 使用箇所:
//   - company-detail.tsx の各 CTA ハンドラー
//   - 将来の Support Case → Action 導線
//
// このファイルはサーバー・クライアント両対応（副作用なし）。

import type { RiskSignal, OpportunitySignal } from '@/lib/company/health-signal';
import type { OrgPersonVM, OrgPersonRisk }    from '@/lib/company/org-chart-vm';
import type { SignalCTASpec }                 from '@/lib/company/signal-cta-helper';
import type { ActionCreatedFrom }             from '@/lib/company/action-vm';

// ── 型定義 ────────────────────────────────────────────────────────────────────

/**
 * Action 作成ダイアログへ渡す prefill + metadata。
 * `ActionCreateDialog` の props と 1:1 対応させつつ、
 * `LocalAction` の `createdFrom` / `personRef` も含む。
 */
export interface ActionPrefillConfig {
  /** ダイアログの初期タイトル */
  title:         string;
  /** ダイアログの初期本文 */
  body:          string;
  /** 起票元分類（LocalAction.createdFrom に格納） */
  createdFrom:   ActionCreatedFrom;
  /** signal title / risk label など（参照用 text） */
  sourceRef:     string | null;
  /** 対象 person 名（Org Chart 起票時） */
  personRef:     string | null;
  /** 対象 person id（Org Chart 起票時） */
  personId:      string | null;
  /**
   * この Action と合わせて SF ToDo も作成することを UI で提案するか。
   * true なら Action 作成後に "SF ToDo も作成する？" CTA を表示してよい。
   */
  sfTodoSuggest: boolean;
}

// ── Builders ─────────────────────────────────────────────────────────────────

/** ヘッダーから手動起票 */
export const MANUAL_PREFILL: ActionPrefillConfig = {
  title:         '',
  body:          '',
  createdFrom:   'manual',
  sourceRef:     null,
  personRef:     null,
  personId:      null,
  sfTodoSuggest: false,
};

/**
 * Risk シグナル行の CTA から起票。
 * `cta.suggestedAction` をタイトルに使い、シグナル情報を本文に挿入する。
 */
export function buildRiskSignalPrefill(
  signal: RiskSignal,
  cta:    SignalCTASpec,
): ActionPrefillConfig {
  return {
    title:         cta.suggestedAction,
    body:          `リスクシグナル: ${signal.title}\n${signal.description}`,
    createdFrom:   'risk_signal',
    sourceRef:     signal.title,
    personRef:     null,
    personId:      null,
    sfTodoSuggest: cta.showSfTodoCTA,
  };
}

/**
 * Opportunity シグナル行の CTA から起票。
 */
export function buildOpportunitySignalPrefill(
  signal: OpportunitySignal,
  cta:    SignalCTASpec,
): ActionPrefillConfig {
  return {
    title:         cta.suggestedAction,
    body:          `機会シグナル: ${signal.title}\n${signal.description}`,
    createdFrom:   'opportunity_signal',
    sourceRef:     signal.title,
    personRef:     null,
    personId:      null,
    sfTodoSuggest: cta.showSfTodoCTA,
  };
}

/**
 * Org Chart のコンタクトノードから起票。
 * OrgPersonVM に事前計算された `actionPrefillTitle` / `actionPrefillBody` を使う。
 */
export function buildOrgPersonPrefill(vm: OrgPersonVM): ActionPrefillConfig {
  return {
    title:         vm.actionPrefillTitle,
    body:          vm.actionPrefillBody,
    createdFrom:   'people_risk',
    sourceRef:     vm.name,
    personRef:     vm.name,
    personId:      vm.id,
    sfTodoSuggest: vm.tier === 'decision_maker' || vm.tier === 'influencer',
  };
}

/**
 * Org Chart 上の People リスクバナーから起票。
 * risk.description を本文に使い、person VM からも情報を補完する。
 */
export function buildPeopleRiskPrefill(
  risk:   OrgPersonRisk,
  person: OrgPersonVM,
): ActionPrefillConfig {
  return {
    title:         `${risk.personName} へのフォローアップ`,
    body:          `${risk.description}\n\n${person.actionPrefillBody}`,
    createdFrom:   'people_risk',
    sourceRef:     risk.label,
    personRef:     risk.personName,
    personId:      risk.personId,
    sfTodoSuggest: risk.severity === 'high',
  };
}
