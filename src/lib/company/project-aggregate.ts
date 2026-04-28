// ─── Project Aggregate ViewModel ─────────────────────────────────────────────
//
// project_info テーブルの複数プロジェクトを企業単位に集約する。
//
// 分類ルール:
//   active   : status === 'active' かつ last_updated_at が PROJECT_STALLED_THRESHOLD_DAYS 以内
//   stalled  : status === 'active' だが last_updated_at が閾値超え、または status === 'stalled'
//   unused   : status === 'never_activated' または status === 'unused'
//   inactive : status === 'inactive'（明示的に無効化済み）
//
// company health への影響:
//   positive: active >= total の 50% かつ expanding シグナルあり
//   negative: stalled + unused > total の 50%
//   neutral:  それ以外
//
// このファイルはサーバー・クライアント両対応（副作用なし）。

import type { AppProjectInfo } from '@/lib/nocodb/types';
import { PROJECT_STALLED_THRESHOLD_DAYS } from '@/lib/company/badges';
import type { ProjectUserActivity } from '@/lib/metabase/project-user-activity';
export type { ProjectUserActivity };

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type ProjectHealthImpact = 'positive' | 'neutral' | 'negative';

export interface ProjectItemVM extends AppProjectInfo {
  /** 実際の稼働状況に基づく分類（Raw status より精密） */
  derivedStatus: 'active' | 'stalled' | 'unused' | 'inactive';
  /** last_updated_at から何日経過したか（null = 不明） */
  stalledDays:   number | null;
  /** Metabase から取得したユーザー活動集計（null = データなし） */
  userActivity:  ProjectUserActivity | null;
}

export interface ProjectAggregateVM {
  total:    number;
  active:   number;   // derivedStatus === 'active'
  stalled:  number;   // derivedStatus === 'stalled'
  unused:   number;   // derivedStatus === 'unused'
  inactive: number;   // derivedStatus === 'inactive'

  /** 企業全体の health への影響（FREE プロジェクトを除いた有償分で評価） */
  healthImpact: ProjectHealthImpact;

  /** 派生したリスクシグナル（health-signal.ts が参照する） */
  riskSignals: ProjectRiskSignal[];

  /** 派生した opportunity シグナル */
  opportunitySignals: ProjectOpportunitySignal[];

  /** 全プロジェクトの detail VM */
  projects: ProjectItemVM[];

  // ── AI / 利用状況集計フィールド ──────────────────────────────────────────
  /** 有償（PTI-PAID / PTX-PAID）かつ active なプロジェクト数 */
  paidActiveCount:  number;
  /** FREE プランで unused なプロジェクト数（シグナル対象外・参考情報） */
  freeUnusedCount:  number;
  /** 企業全体の過去30日アクティブイベント合計（l30_active の総和） */
  totalL30Active:   number;
  // ── スコア集計（有償 active プロジェクトの平均値）──────────────────────
  /** 有償 active プロジェクトの平均 healthyScore（null = スコアデータなし） */
  paidActiveAvgHealthy: number | null;
  /** 有償 active プロジェクトの平均 depthScore */
  paidActiveAvgDepth:   number | null;
  /** 有償 active プロジェクトの平均 breadthScore */
  paidActiveAvgBreadth: number | null;
}

export interface ProjectRiskSignal {
  type:        'all_stalled' | 'majority_stalled_or_unused' | 'no_active_projects';
  severity:    'high' | 'medium';
  description: string;
}

export interface ProjectOpportunitySignal {
  type:        'expansion_possible' | 'new_use_case';
  score:       number;  // 0-10
  description: string;
}

// ── 日付ユーティリティ ────────────────────────────────────────────────────────

function daysSinceDate(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr.trim().replace(' ', 'T'));
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ── derived status 判定 ──────────────────────────────────────────────────────

function deriveProjectStatus(
  project: AppProjectInfo,
): { derivedStatus: ProjectItemVM['derivedStatus']; stalledDays: number | null } {
  const stalledDays = daysSinceDate(project.lastUpdatedAt);

  if (project.status === 'unused' || project.status === 'inactive') {
    return { derivedStatus: project.status, stalledDays };
  }

  if (project.status === 'stalled') {
    return { derivedStatus: 'stalled', stalledDays };
  }

  // status === 'active' でも last_updated_at が閾値超えなら stalled に降格
  if (
    project.status === 'active' &&
    stalledDays !== null &&
    stalledDays >= PROJECT_STALLED_THRESHOLD_DAYS
  ) {
    return { derivedStatus: 'stalled', stalledDays };
  }

  return { derivedStatus: 'active', stalledDays };
}

// ── VM 構築 ───────────────────────────────────────────────────────────────────

/**
 * project_info リストから ProjectAggregateVM を構築する。
 * @param projects         fetchProjectsByCompany の結果
 * @param userActivityMap  Metabase から取得したプロジェクト別ユーザー活動 Map（省略可）
 */
export function buildProjectAggregateVM(
  projects: AppProjectInfo[],
  userActivityMap?: Map<string, ProjectUserActivity>,
): ProjectAggregateVM {
  // ── derived status 付きに変換 ────────────────────────────────────────────
  const projectVMs: ProjectItemVM[] = projects.map(p => {
    const { derivedStatus, stalledDays } = deriveProjectStatus(p);
    const userActivity = userActivityMap?.get(p.id) ?? null;
    return { ...p, derivedStatus, stalledDays, userActivity };
  });

  const total    = projectVMs.length;
  const active   = projectVMs.filter(p => p.derivedStatus === 'active').length;
  const stalled  = projectVMs.filter(p => p.derivedStatus === 'stalled').length;
  const unused   = projectVMs.filter(p => p.derivedStatus === 'unused').length;
  const inactive = projectVMs.filter(p => p.derivedStatus === 'inactive').length;

  // ── 非 FREE プロジェクト集計（シグナル・health 計算用）──────────────────
  const nonFreeProjects = projectVMs.filter(p => (p.paidType ?? '').toUpperCase() !== 'FREE');
  const nonFreeTotal    = nonFreeProjects.length;
  const nonFreeActive   = nonFreeProjects.filter(p => p.derivedStatus === 'active').length;
  const nonFreeStalled  = nonFreeProjects.filter(p => p.derivedStatus === 'stalled').length;
  const nonFreeUnused   = nonFreeProjects.filter(p => p.derivedStatus === 'unused').length;

  // ── health impact 判定（FREE プロジェクトを除外して評価）────────────────
  let healthImpact: ProjectHealthImpact = 'neutral';
  if (nonFreeTotal > 0) {
    if (nonFreeActive / nonFreeTotal >= 0.5) {
      healthImpact = 'positive';
    } else if ((nonFreeStalled + nonFreeUnused) / nonFreeTotal > 0.5) {
      healthImpact = 'negative';
    }
  }

  // ── risk signals（FREE プロジェクトを除外して評価）──────────────────────
  const riskSignals: ProjectRiskSignal[] = [];

  if (nonFreeTotal > 0 && nonFreeActive === 0) {
    // 1件のみなら medium（単体で at_risk を引き起こさない）、2件以上なら high
    riskSignals.push({
      type:        'no_active_projects',
      severity:    nonFreeTotal >= 2 ? 'high' : 'medium',
      description: `全 ${nonFreeTotal} 件の有償プロジェクトが非アクティブです`,
    });
  } else if (nonFreeTotal > 0 && (nonFreeStalled + nonFreeUnused) / nonFreeTotal > 0.5) {
    if (nonFreeActive === 0 && nonFreeStalled + nonFreeUnused === nonFreeTotal) {
      riskSignals.push({
        type:        'all_stalled',
        severity:    'high',
        description: `有償プロジェクトが全て停滞または未活用です（${nonFreeStalled} stalled / ${nonFreeUnused} unused）`,
      });
    } else {
      riskSignals.push({
        type:        'majority_stalled_or_unused',
        severity:    'medium',
        description: `有償プロジェクトの ${Math.round((nonFreeStalled + nonFreeUnused) / nonFreeTotal * 100)}% が停滞または未活用です`,
      });
    }
  }

  // ── opportunity signals ─────────────────────────────────────────────────
  const opportunitySignals: ProjectOpportunitySignal[] = [];

  if (active >= 2) {
    opportunitySignals.push({
      type:        'expansion_possible',
      score:       Math.min(active * 2, 8),
      description: `${active} プロジェクトが稼働中 — 機能拡張・upsell の可能性`,
    });
  }

  // FREE unused は利活用機会としてカウントしない
  if (nonFreeUnused > 0) {
    opportunitySignals.push({
      type:        'new_use_case',
      score:       Math.min(nonFreeUnused * 2, 6),
      description: `${nonFreeUnused} プロジェクト（有償）が未活用 — 利活用支援・ユースケース提案の機会`,
    });
  }

  // ── 利用状況集計 ─────────────────────────────────────────────────────────
  const paidActiveCount = projectVMs.filter(p => {
    const paid = (p.paidType ?? '').toUpperCase();
    return p.derivedStatus === 'active' && (paid === 'PTI-PAID' || paid === 'PTX-PAID');
  }).length;

  const freeUnusedCount = projectVMs.filter(p => {
    const paid = (p.paidType ?? '').toUpperCase();
    return p.derivedStatus === 'unused' && paid === 'FREE';
  }).length;

  const totalL30Active = projectVMs.reduce((sum, p) => sum + (p.l30Active ?? 0), 0);

  // ── スコア平均（有償 active プロジェクトのみ）────────────────────────────
  const paidActive = projectVMs.filter(p => {
    const paid = (p.paidType ?? '').toUpperCase();
    return p.derivedStatus === 'active' && (paid === 'PTI-PAID' || paid === 'PTX-PAID');
  });

  function avgScore(arr: ProjectItemVM[], field: 'healthyScore' | 'depthScore' | 'breadthScore'): number | null {
    const vals = arr.map(p => p[field]).filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }

  const paidActiveAvgHealthy = avgScore(paidActive, 'healthyScore');
  const paidActiveAvgDepth   = avgScore(paidActive, 'depthScore');
  const paidActiveAvgBreadth = avgScore(paidActive, 'breadthScore');

  return {
    total,
    active,
    stalled,
    unused,
    inactive,
    healthImpact,
    riskSignals,
    opportunitySignals,
    projects: projectVMs,
    paidActiveCount,
    freeUnusedCount,
    totalL30Active,
    paidActiveAvgHealthy,
    paidActiveAvgDepth,
    paidActiveAvgBreadth,
  };
}

// ── 空の VM ──────────────────────────────────────────────────────────────────

export const EMPTY_PROJECT_AGGREGATE: ProjectAggregateVM = {
  total:                0,
  active:               0,
  stalled:              0,
  unused:               0,
  inactive:             0,
  healthImpact:         'neutral',
  riskSignals:          [],
  opportunitySignals:   [],
  projects:             [],
  paidActiveCount:      0,
  freeUnusedCount:      0,
  totalL30Active:       0,
  paidActiveAvgHealthy: null,
  paidActiveAvgDepth:   null,
  paidActiveAvgBreadth: null,
};

// ── AI 向けテキスト要約 ────────────────────────────────────────────────────────
//
// buildCompanyEvidenceSummaryPrompt に渡す Project セクションを生成する。
// 情報は「数字中心・シグナル先行」で構造化し、AI が key_risks / key_opportunities に
// 反映しやすい形式にする。

export function buildProjectAISummary(vm: ProjectAggregateVM): string {
  if (vm.total === 0) return '（プロジェクトなし）';

  const lines: string[] = [];

  // ── 集計サマリー ──────────────────────────────────────────────────────────
  lines.push(
    `合計 ${vm.total}件 | Active: ${vm.active} | 停滞: ${vm.stalled} | 未活用: ${vm.unused}` +
    ` | 有償Active: ${vm.paidActiveCount} | FREE未活用: ${vm.freeUnusedCount}（シグナル対象外）` +
    ` | 30日活動イベント合計: ${vm.totalL30Active}`,
  );

  // ── 有償 active スコア平均 ───────────────────────────────────────────────
  const hasScores = vm.paidActiveAvgHealthy !== null
    || vm.paidActiveAvgDepth   !== null
    || vm.paidActiveAvgBreadth !== null;
  if (hasScores) {
    const h = vm.paidActiveAvgHealthy !== null ? `Healthy=${vm.paidActiveAvgHealthy}` : null;
    const d = vm.paidActiveAvgDepth   !== null ? `Depth=${vm.paidActiveAvgDepth}`     : null;
    const b = vm.paidActiveAvgBreadth !== null ? `Breadth=${vm.paidActiveAvgBreadth}` : null;
    lines.push(`有償ActiveスコアAVG: ${[h, d, b].filter(Boolean).join(' ')}`);
  }

  // ── リスクシグナル ────────────────────────────────────────────────────────
  vm.riskSignals.forEach(s => {
    lines.push(`[RISK/${s.severity.toUpperCase()}] ${s.description}`);
  });

  // ── オポチュニティシグナル ─────────────────────────────────────────────────
  vm.opportunitySignals.forEach(s => {
    lines.push(`[OPP] ${s.description}`);
  });

  // ── プロジェクト詳細（有償プランのみ・上位10件）────────────────────────
  // FREE プランは評価対象外のためリストから除外し、AI に渡さない。
  const top = vm.projects
    .filter(p => (p.paidType ?? '').toUpperCase() !== 'FREE')
    .slice(0, 10);
  if (top.length > 0) {
    lines.push('');
    top.forEach(p => {
      const paid     = p.paidType ? `[${p.paidType.replace('-PAID', '')}]` : '[不明]';
      const activity = p.l30Active != null ? `L30活動=${p.l30Active}` : '活動不明';
      const habStr   = p.habituationStatus === true ? '活用済' : p.habituationStatus === false ? '未活用' : '';
      const stall    = p.stalledDays && p.stalledDays >= 60 ? ` 停滞${p.stalledDays}d` : '';
      const orderEnd = p.latestOrderEndDate ? ` 契約終了=${p.latestOrderEndDate}` : '';
      const scores   = [
        p.healthyScore !== null ? `Health=${p.healthyScore}` : null,
        p.depthScore   !== null ? `Depth=${p.depthScore}`    : null,
        p.breadthScore !== null ? `Breadth=${p.breadthScore}` : null,
      ].filter(Boolean).join(' ');
      lines.push(
        `- ${p.name} (${p.derivedStatus}${stall}) ${paid} ${activity}${habStr ? ' ' + habStr : ''}${scores ? ' ' + scores : ''}${orderEnd}`,
      );
    });
  }

  return lines.join('\n');
}
