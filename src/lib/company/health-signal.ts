// ─── Health / Risk / Opportunity Signal 集約 ──────────────────────────────────
//
// 複数テーブルからのシグナルを統合して企業全体の health を判定する。
//
// 入力:
//   - AppCompanySummaryState（AI summary の overall_health）
//   - PhaseComparisonVM（phase gap / stagnation）
//   - CommunicationSignalVM（blank days）
//   - ProjectAggregateVM（project 停滞・未活用）
//   - support counts（open critical / high support case 数）
//   - AppAlert[]（open alerts）
//
// 出力:
//   - CompanyHealthSignalVM（overall + signals リスト）
//
// 判定ロジック（優先順位）:
//   critical:  open critical alert OR critical support case
//   at_risk:   複数の medium/high risk signal
//   expanding: overall_health=expanding（AI） + active projects + opportunity signals
//   healthy:   それ以外
//
// このファイルはサーバー・クライアント両対応（副作用なし）。

import type { AppCompanySummaryState } from '@/lib/nocodb/types';
import type { PhaseComparisonVM }      from '@/lib/company/phase-comparison';
import type { CommunicationSignalVM }  from '@/lib/company/communication-signal';
import type { ProjectAggregateVM, ProjectRiskSignal, ProjectOpportunitySignal }
  from '@/lib/company/project-aggregate';
import type { EvidenceSourceType }     from '@/lib/company/evidence-link';
import type { OverallHealth, RiskSeverity } from '@/lib/company/badges';

// ── 型定義 ────────────────────────────────────────────────────────────────────

/**
 * 個別リスクシグナル。
 * UI 側は drilldownUrl をクリックで対応証拠へ遷移できる。
 */
export interface RiskSignal {
  id:           string;          // 一意キー（type:sourceId 等）
  type:         RiskSignalType;
  severity:     RiskSeverity;
  title:        string;          // 短い表示タイトル（20-40字）
  description:  string;          // 詳細説明（80字程度）
  sourceType:   EvidenceSourceType;
  sourceId:     string | null;
  companyUid:   string;
  drilldownUrl: string | null;   // evidence-link.ts 経由で生成
}

export type RiskSignalType =
  | 'phase_gap'
  | 'phase_stagnation'
  | 'communication_blank'
  | 'project_stalled'
  | 'support_critical'
  | 'support_high_volume'
  | 'alert_critical'
  | 'alert_high'
  | 'summary_stale';

/**
 * Opportunity シグナル。
 * CTA（Salesforce ToDo 作成等）と連動する。
 */
export interface OpportunitySignal {
  id:           string;
  type:         OpportunitySignalType;
  score:        number;          // 0-10
  title:        string;
  description:  string;
  sourceType:   EvidenceSourceType;
  sourceId:     string | null;
  companyUid:   string;
  drilldownUrl: string | null;
  /** この Opportunity から Salesforce ToDo を作成できるか */
  canCreateSfTodo: boolean;
}

export type OpportunitySignalType =
  | 'expansion_project'
  | 'new_use_case'
  | 'renewal_upcoming'
  | 'upsell_signal'
  | 'health_improving';

/** 企業全体の Health Signal 集約 */
export interface CompanyHealthSignalVM {
  companyUid:         string;
  overallHealth:      OverallHealth;
  riskSignals:        RiskSignal[];
  opportunitySignals: OpportunitySignal[];
  /** AI summary が出力した overall_health（判定の参考値） */
  aiHealth:           string | null;
  /** AI summary のキーリスク（配列: keyRisks as unknown[]） */
  aiKeyRisks:         unknown[];
  /** AI summary の key opportunities */
  aiKeyOpportunities: unknown[];
}

// ── 入力パラメータ ─────────────────────────────────────────────────────────────

export interface BuildHealthSignalInput {
  companyUid:         string;
  summary:            AppCompanySummaryState | null;
  phaseVM:            PhaseComparisonVM | null;
  communicationVM:    CommunicationSignalVM | null;
  projectVM:          ProjectAggregateVM | null;
  openCriticalSupport: number;  // severity=critical の open support case 数
  openHighSupport:     number;  // severity=high の open support case 数
  openAlertCount:      number;  // companies.open_alert_count
  criticalAlertCount?: number;  // severity=critical の open alert 数
}

// ── シグナル生成ロジック ──────────────────────────────────────────────────────

function buildRiskSignals(
  input:     BuildHealthSignalInput,
): RiskSignal[] {
  const {
    companyUid,
    summary,
    phaseVM,
    communicationVM,
    projectVM,
    openCriticalSupport,
    openHighSupport,
    openAlertCount,
    criticalAlertCount,
  } = input;

  const signals: RiskSignal[] = [];

  // ── アラート ──────────────────────────────────────────────────────────────
  if ((criticalAlertCount ?? 0) > 0) {
    signals.push({
      id:           `alert_critical:${companyUid}`,
      type:         'alert_critical',
      severity:     'critical',
      title:        `Critical アラート (${criticalAlertCount}件)`,
      description:  '緊急対応が必要なアラートがあります',
      sourceType:   'alert',
      sourceId:     null,
      companyUid,
      drilldownUrl: `/companies/${companyUid}?tab=overview&section=alerts`,
    });
  } else if (openAlertCount >= 3) {
    signals.push({
      id:           `alert_high:${companyUid}`,
      type:         'alert_high',
      severity:     'high',
      title:        `オープンアラート ${openAlertCount}件`,
      description:  '複数のアラートが未対応です',
      sourceType:   'alert',
      sourceId:     null,
      companyUid,
      drilldownUrl: `/companies/${companyUid}?tab=overview&section=alerts`,
    });
  }

  // ── Support ──────────────────────────────────────────────────────────────
  if (openCriticalSupport > 0) {
    signals.push({
      id:           `support_critical:${companyUid}`,
      type:         'support_critical',
      severity:     'critical',
      title:        `Critical サポート (${openCriticalSupport}件)`,
      description:  'Critical 重要度のオープンサポートケースがあります',
      sourceType:   'support_case',
      sourceId:     null,
      companyUid,
      drilldownUrl: `/companies/${companyUid}?tab=support`,
    });
  } else if (openHighSupport >= 8) {
    // 8件以上で high、5〜7件は medium（支援負荷はあるがそれだけで at_risk にしない）
    signals.push({
      id:           `support_high:${companyUid}`,
      type:         'support_high_volume',
      severity:     'high',
      title:        `Highサポートケース ${openHighSupport}件`,
      description:  'High重要度のオープンケースが多数積み残されています',
      sourceType:   'support_case',
      sourceId:     null,
      companyUid,
      drilldownUrl: `/companies/${companyUid}?tab=support`,
    });
  } else if (openHighSupport >= 5) {
    signals.push({
      id:           `support_high:${companyUid}`,
      type:         'support_high_volume',
      severity:     'medium',
      title:        `Highサポートケース ${openHighSupport}件`,
      description:  'High重要度のオープンケースが積み残されています',
      sourceType:   'support_case',
      sourceId:     null,
      companyUid,
      drilldownUrl: `/companies/${companyUid}?tab=support`,
    });
  }

  // ── Phase ────────────────────────────────────────────────────────────────
  if (phaseVM) {
    for (const ps of phaseVM.riskSignals) {
      signals.push({
        id:           `${ps.type}:${companyUid}`,
        type:         ps.type,
        severity:     ps.severity,
        title:        ps.type === 'phase_gap'
                        ? 'フェーズ不整合（CSM vs CRM）'
                        : `フェーズ停滞（${phaseVM.stagnationDays}日）`,
        description:  ps.description,
        sourceType:   'phase',
        sourceId:     null,
        companyUid,
        drilldownUrl: `/companies/${companyUid}?tab=overview&section=phase`,
      });
    }
  }

  // ── Communication ────────────────────────────────────────────────────────
  if (communicationVM && communicationVM.riskLevel !== 'none') {
    const days = communicationVM.blankDays;
    const lastDateLabel = communicationVM.lastContactDate
      ? `（最終接触: ${communicationVM.lastContactDate}）`
      : '';
    signals.push({
      id:           `comm_blank:${companyUid}`,
      type:         'communication_blank',
      severity:     communicationVM.riskLevel === 'risk' ? 'high' : 'medium',
      title:        `コミュニケーション空白 ${days}日`,
      description:  `最終接触から ${days} 日間コミュニケーションがありません${lastDateLabel}`,
      sourceType:   'log_chatwork',  // 代表ソース（実際は複数）
      sourceId:     null,
      companyUid,
      drilldownUrl: `/companies/${companyUid}?tab=communication`,
    });
  }

  // ── Projects ─────────────────────────────────────────────────────────────
  if (projectVM) {
    for (const ps of projectVM.riskSignals) {
      signals.push({
        id:           `${ps.type}:${companyUid}`,
        type:         'project_stalled',
        severity:     ps.severity,
        title:        ps.type === 'no_active_projects'        ? 'アクティブプロジェクトなし'
                    : ps.type === 'all_stalled'              ? '全プロジェクトが停滞'
                    : ps.type === 'majority_stalled_or_unused' ? 'プロジェクトの多数が停滞'
                    : 'プロジェクト停滞',
        description:  ps.description,
        sourceType:   'project',
        sourceId:     null,
        companyUid,
        drilldownUrl: `/companies/${companyUid}?tab=projects`,
      });
    }
  }

  // ── Summary stale ─────────────────────────────────────────────────────────
  // （summary freshness は company-summary-state-policy に委ねる）

  // severity 降順でソート（critical → high → medium → low）
  const ORDER: Record<RiskSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  signals.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

  return signals;
}

function buildOpportunitySignals(
  input: BuildHealthSignalInput,
): OpportunitySignal[] {
  const { companyUid, summary, phaseVM, projectVM } = input;
  const signals: OpportunitySignal[] = [];

  // AI Summary の key_opportunities をそのまま昇格
  if (summary?.keyOpportunities?.length) {
    summary.keyOpportunities.forEach((opp, i) => {
      const text = typeof opp === 'string'
        ? opp
        : (opp as { description?: string })?.description ?? String(opp);
      signals.push({
        id:              `ai_opp:${companyUid}:${i}`,
        type:            'upsell_signal',
        score:           6,
        title:           text.slice(0, 40),
        description:     text,
        sourceType:      'evidence',
        sourceId:        null,
        companyUid,
        drilldownUrl:    `/companies/${companyUid}?tab=overview`,
        canCreateSfTodo: true,
      });
    });
  }

  // Project 由来の opportunity
  if (projectVM) {
    for (const ps of projectVM.opportunitySignals) {
      signals.push({
        id:              `${ps.type}:${companyUid}`,
        type:            ps.type === 'expansion_possible' ? 'expansion_project' : 'new_use_case',
        score:           ps.score,
        title:           ps.type === 'expansion_possible' ? 'プロジェクト拡張の可能性' : '新規ユースケース提案',
        description:     ps.description,
        sourceType:      'project',
        sourceId:        null,
        companyUid,
        drilldownUrl:    `/companies/${companyUid}?tab=projects`,
        canCreateSfTodo: true,
      });
    }
  }

  // 契約更新が 90日以内
  if (phaseVM?.daysUntilRenewal !== null && (phaseVM?.daysUntilRenewal ?? Infinity) <= 90) {
    const days = phaseVM!.daysUntilRenewal!;
    signals.push({
      id:              `renewal:${companyUid}`,
      type:            'renewal_upcoming',
      score:           days <= 30 ? 9 : 7,
      title:           `契約更新まで ${days}日`,
      description:     `契約終了が ${days} 日後に迫っています — 更新・upsell 商談を準備してください`,
      sourceType:      'phase',
      sourceId:        null,
      companyUid,
      drilldownUrl:    `/companies/${companyUid}?tab=overview&section=phase`,
      canCreateSfTodo: true,
    });
  }

  // score 降順
  signals.sort((a, b) => b.score - a.score);
  return signals;
}

// ── overall health 判定 ──────────────────────────────────────────────────────

function determineOverallHealth(
  riskSignals: RiskSignal[],
  opSignals:   OpportunitySignal[],
  aiHealth:    string | null,
  projectVM:   ProjectAggregateVM | null,
): OverallHealth {
  const hasCritical = riskSignals.some(s => s.severity === 'critical');
  const highCount   = riskSignals.filter(s => s.severity === 'high').length;
  const mediumCount = riskSignals.filter(s => s.severity === 'medium').length;

  if (hasCritical) return 'critical';
  // at_risk: 複数の明確なリスクが重なる場合のみ（単一シグナルで at_risk にしない）
  if (highCount >= 2 || (highCount >= 1 && mediumCount >= 3)) return 'at_risk';

  // expanding: AI が expanding と判定 かつ active project あり かつ risk シグナルが少ない
  if (
    aiHealth === 'expanding' &&
    (projectVM?.active ?? 0) > 0 &&
    riskSignals.length === 0 &&
    opSignals.length > 0
  ) {
    return 'expanding';
  }

  // AI が at_risk / critical と言っていたら採用（ただし risk シグナルが 2件以上ある場合のみ）
  if (aiHealth === 'critical') return 'critical';
  if (aiHealth === 'at_risk'  && riskSignals.length >= 2) return 'at_risk';

  return 'healthy';
}

// ── メイン関数 ────────────────────────────────────────────────────────────────

/**
 * 複数テーブルのシグナルを統合して CompanyHealthSignalVM を構築する。
 */
export function buildHealthSignalVM(
  input: BuildHealthSignalInput,
): CompanyHealthSignalVM {
  const riskSignals        = buildRiskSignals(input);
  const opportunitySignals = buildOpportunitySignals(input);

  const aiHealth     = input.summary?.overallHealth ?? null;
  const overallHealth = determineOverallHealth(
    riskSignals,
    opportunitySignals,
    aiHealth,
    input.projectVM,
  );

  return {
    companyUid:         input.companyUid,
    overallHealth,
    riskSignals,
    opportunitySignals,
    aiHealth,
    aiKeyRisks:         input.summary?.keyRisks         ?? [],
    aiKeyOpportunities: input.summary?.keyOpportunities ?? [],
  };
}
