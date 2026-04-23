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

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type ProjectHealthImpact = 'positive' | 'neutral' | 'negative';

export interface ProjectItemVM extends AppProjectInfo {
  /** 実際の稼働状況に基づく分類（Raw status より精密） */
  derivedStatus: 'active' | 'stalled' | 'unused' | 'inactive';
  /** last_updated_at から何日経過したか（null = 不明） */
  stalledDays:   number | null;
}

export interface ProjectAggregateVM {
  total:    number;
  active:   number;   // derivedStatus === 'active'
  stalled:  number;   // derivedStatus === 'stalled'
  unused:   number;   // derivedStatus === 'unused'
  inactive: number;   // derivedStatus === 'inactive'

  /** 企業全体の health への影響 */
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
  /** FREE プランで unused なプロジェクト数（有償転換・利活用支援の余地） */
  freeUnusedCount:  number;
  /** 企業全体の過去30日アクティブイベント合計（l30_active の総和） */
  totalL30Active:   number;
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
 * @param projects  fetchProjectsByCompany の結果
 */
export function buildProjectAggregateVM(
  projects: AppProjectInfo[],
): ProjectAggregateVM {
  // ── derived status 付きに変換 ────────────────────────────────────────────
  const projectVMs: ProjectItemVM[] = projects.map(p => {
    const { derivedStatus, stalledDays } = deriveProjectStatus(p);
    return { ...p, derivedStatus, stalledDays };
  });

  const total    = projectVMs.length;
  const active   = projectVMs.filter(p => p.derivedStatus === 'active').length;
  const stalled  = projectVMs.filter(p => p.derivedStatus === 'stalled').length;
  const unused   = projectVMs.filter(p => p.derivedStatus === 'unused').length;
  const inactive = projectVMs.filter(p => p.derivedStatus === 'inactive').length;

  // ── health impact 判定 ────────────────────────────────────────────────────
  let healthImpact: ProjectHealthImpact = 'neutral';
  if (total > 0) {
    const activeRatio    = active / total;
    const problematicRatio = (stalled + unused) / total;

    if (activeRatio >= 0.5) {
      healthImpact = 'positive';
    } else if (problematicRatio > 0.5) {
      healthImpact = 'negative';
    }
  }

  // ── risk signals ────────────────────────────────────────────────────────
  const riskSignals: ProjectRiskSignal[] = [];

  if (total > 0 && active === 0) {
    // 1件のみなら medium（単体で at_risk を引き起こさない）、2件以上なら high
    riskSignals.push({
      type:        'no_active_projects',
      severity:    total >= 2 ? 'high' : 'medium',
      description: `全 ${total} プロジェクトが非アクティブです`,
    });
  } else if (total > 0 && (stalled + unused) / total > 0.5) {
    if (active === 0 && stalled + unused === total) {
      riskSignals.push({
        type:        'all_stalled',
        severity:    'high',
        description: `全プロジェクトが停滞または未活用です（${stalled} stalled / ${unused} unused）`,
      });
    } else {
      riskSignals.push({
        type:        'majority_stalled_or_unused',
        severity:    'medium',
        description: `プロジェクトの ${Math.round((stalled + unused) / total * 100)}% が停滞または未活用です`,
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

  if (unused > 0) {
    opportunitySignals.push({
      type:        'new_use_case',
      score:       Math.min(unused * 2, 6),
      description: `${unused} プロジェクトが未活用 — 利活用支援・新規ユースケース提案の機会`,
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
  };
}

// ── 空の VM ──────────────────────────────────────────────────────────────────

export const EMPTY_PROJECT_AGGREGATE: ProjectAggregateVM = {
  total:              0,
  active:             0,
  stalled:            0,
  unused:             0,
  inactive:           0,
  healthImpact:       'neutral',
  riskSignals:        [],
  opportunitySignals: [],
  projects:           [],
  paidActiveCount:    0,
  freeUnusedCount:    0,
  totalL30Active:     0,
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
    ` | 有償Active: ${vm.paidActiveCount} | FREE未活用: ${vm.freeUnusedCount}` +
    ` | 30日活動イベント合計: ${vm.totalL30Active}`,
  );

  // ── リスクシグナル ────────────────────────────────────────────────────────
  vm.riskSignals.forEach(s => {
    lines.push(`[RISK/${s.severity.toUpperCase()}] ${s.description}`);
  });

  // ── オポチュニティシグナル ─────────────────────────────────────────────────
  vm.opportunitySignals.forEach(s => {
    lines.push(`[OPP] ${s.description}`);
  });

  // ── プロジェクト詳細（上位10件）──────────────────────────────────────────
  const top = vm.projects.slice(0, 10);
  if (top.length > 0) {
    lines.push('');
    top.forEach(p => {
      const paid     = p.paidType ? `[${p.paidType.replace('-PAID', '')}]` : '[不明]';
      const activity = p.l30Active != null ? `L30活動=${p.l30Active}` : '活動不明';
      const habStr   = p.habituationStatus === true ? '活用済' : p.habituationStatus === false ? '未活用' : '';
      const stall    = p.stalledDays && p.stalledDays >= 60 ? ` 停滞${p.stalledDays}d` : '';
      const orderEnd = p.latestOrderEndDate ? ` 契約終了=${p.latestOrderEndDate}` : '';
      lines.push(
        `- ${p.name} (${p.derivedStatus}${stall}) ${paid} ${activity}${habStr ? ' ' + habStr : ''}${orderEnd}`,
      );
    });
  }

  return lines.join('\n');
}
