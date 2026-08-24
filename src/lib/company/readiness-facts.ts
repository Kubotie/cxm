// ─── 個社の提案準備度と、その材料をまとめて読む ──────────────────────────────
//
// 提案準備タブ（/api/company/[uid]/readiness）と提案フロー（proposal-inputs）の
// **共通の土台**。
//
// 分けた理由: 同じ画面の上下で違う準備度が出ると原因が追えない。
//   準備度・提案の型・外部機会の判定は必ずここを通す。
//   計算をコピーすると、片方だけ直したときに静かにずれる。
//
// 重い取得（議事録全件・サポート集計・スナップショット履歴）を含むので、
// 1リクエストに1回だけ呼ぶこと。
//
// サーバーサイド専用。

import { fetchCompanyByUid }              from '@/lib/nocodb/companies';
import { fetchProjectsByCompany }         from '@/lib/nocodb/project-info';
import { fetchAllCommunicationLogs }      from '@/lib/nocodb/communication-logs';
import { fetchSupportAggregateForCompany} from '@/lib/nocodb/support-by-company';
import { fetchCompanySnapshotHistory, nDaysAgoDateStr } from '@/lib/nocodb/company-snapshot';
import { fetchProjectSignalMap }          from '@/lib/metabase/project-signals';
import { loadProjectFacts } from '@/lib/company/project-facts';
import {
  mergeModuleVerdicts, EMPTY_MODULE_SIGNAL, type ModuleSignalVM,
} from '@/lib/company/module-signals';
import { buildCommunicationSignalVM }     from '@/lib/company/communication-signal';
import { buildReplaceabilitySignal, EMPTY_REPLACEABILITY } from '@/lib/company/replaceability-signal';
import { fetchExternalIntel }             from '@/lib/nocodb/external-intel';
import {
  buildExternalOpportunity,
  extractExternalSignalsFromMinutes,
  type ExternalOpportunityVM,
  type ExternalSignalItem,
} from '@/lib/company/external-signal';
import {
  calcProposalReadiness,
  decideProposalPlay,
  type ProposalReadinessInput,
  type ProposalReadinessVM,
  type ProposalPlayResult,
  type RenewalBucket,
} from '@/lib/company/proposal-readiness';
import type { ReplaceabilitySignalVM } from '@/lib/company/replaceability-signal';
import { fetchCsmPhase } from '@/lib/nocodb/phases';
import {
  detectBehaviorSignals, EMPTY_BEHAVIOR_RESULT,
  type BehaviorSignalResult, type SnapshotFacts,
} from '@/lib/company/behavior-signals';

/** 実行体制の比較に使う遡り日数 */
export const TREND_WINDOW_DAYS = 30;
/** 関係の温度に使う接点カウント期間 */
export const TOUCHPOINT_WINDOW_DAYS = 90;

// ── 型 ────────────────────────────────────────────────────────────────────────

export interface ReadinessProjectFacts {
  readiness: ProposalReadinessVM;
  play:      ProposalPlayResult;
  /** 30日の管理画面モジュール利用。ダッシュボードの「活用」列に使う */
  moduleSignal: ModuleSignalVM;
  project: {
    id:                string;
    name:              string;
    paidType:          string | null;
    status:            'active' | 'stalled' | 'unused' | 'inactive';
    habituationStatus: boolean | null;
  };
  signal: {
    runningCampaignWithGoalCount: number;
    heatmapCount:                 number;
    l30Active:                    number;
    l7EventCount:                 number;
    pvCeiling:                    number | null;
    monthPvCount:                 number | null;
    lastActiveDate:               string | null;
  } | null;
}

export type CommLogs = Awaited<ReturnType<typeof fetchAllCommunicationLogs>>;

export interface ReadinessFacts {
  companyUid:  string;
  companyName: string;
  tier:        1 | 2 | 3 | 5 | null;

  renewalBucket: RenewalBucket | null;
  renewalDate:   string | null;

  hasExternalOpportunity: boolean;
  externalOpportunity:    ExternalOpportunityVM;
  opportunityOverridden:  boolean;

  companyReadiness: ProposalReadinessVM;
  companyPlay:      ProposalPlayResult;
  projects:         ReadinessProjectFacts[];

  /**
   * 内部・行動シグナル（R_ / O_ / H_ 系）。
   * ボードと同じ detectBehaviorSignals() を通す。判定を2箇所に持たない。
   */
  behavior: BehaviorSignalResult;

  /** オンボーディング完了日（csm_customer_phase の 4_ONB完了） */
  onboardingCompletedAt: string | null;

  /** 30日の管理画面モジュール利用（有料PJ合算）。null = 有料PJなし */
  moduleSignal: ModuleSignalVM | null;

  /** 生の材料（提案フローが材料カードに使う） */
  raw: {
    commLogs:    CommLogs;
    storedIntel: ExternalSignalItem[];
    /** 有料PJの利用実態を合算した値 */
    usageTotals: {
      campaigns: number | null; heatmaps: number | null; l30Active: number | null;
      pvRate: number | null; lastActiveDate: string | null; paidProjectCount: number;
    } | null;
  };

  inputs: {
    trendWindowDays:        number;
    trendFrom:              string | null;
    trendTo:                string | null;
    communicationBlankDays: number | null;
    lastContactDate:        string | null;
    touchpointCount90d:     number;
    openSupportCount:       number | null;
    replaceability:         ReplaceabilitySignalVM;
    paidProjectCount:       number;
    excludedFreeCount:      number;
  };
}

// ── 本体 ──────────────────────────────────────────────────────────────────────

/**
 * 企業が見つからない場合は null を返す（呼び出し側で 404 にする）。
 *
 * @param opportunityOverride 外部機会の自動判定を上書きする（null = 自動判定）
 */
export async function loadReadinessFacts(
  companyUid: string,
  opportunityOverride: boolean | null = null,
): Promise<ReadinessFacts | null> {
  const [company, projects, commLogs, support, snapshots, storedIntel, csmPhase] = await Promise.all([
    fetchCompanyByUid(companyUid).catch(() => null),
    fetchProjectsByCompany(companyUid).catch(() => []),
    fetchAllCommunicationLogs(companyUid).catch(() => ({ chatwork: [], slack: [], notionMinutes: [], intercomMail: [] })),
    fetchSupportAggregateForCompany(companyUid).catch(() => null),
    fetchCompanySnapshotHistory(companyUid, nDaysAgoDateStr(TREND_WINDOW_DAYS + 5)).catch(() => []),
    fetchExternalIntel(companyUid).catch(() => [] as ExternalSignalItem[]),
    fetchCsmPhase(companyUid).catch(() => null),
  ]);

  if (!company) return null;

  // 事前計算（朝のバッチ）を優先。揃っていなければ CSV に落ちる（§36.3）
  const paidIds = projects.filter(p => p.paidType !== 'FREE').map(p => p.id);
  const facts = await loadProjectFacts(paidIds);
  const signalMap = new Map<string, NonNullable<ProposalReadinessInput['signal']>>();
  for (const id of paidIds) {
    const sg = facts.map.get(id)?.signal;
    if (sg) signalMap.set(id, sg);
  }

  // ── 外部機会の自動判定（§11）────────────────────────────────────────────
  // 保存済みシグナル（第2層）＋ 議事録からのキーワード抽出（第1層）を統合する
  const externalOpportunity = buildExternalOpportunity([
    ...storedIntel,
    ...extractExternalSignalsFromMinutes(commLogs.notionMinutes),
  ]);
  const hasOpportunity = opportunityOverride ?? externalOpportunity.hasOpportunity;

  // ── 共通入力の組み立て ──────────────────────────────────────────────────
  const communicationVM = buildCommunicationSignalVM(
    commLogs.chatwork,
    commLogs.slack,
    commLogs.notionMinutes,
  );

  const replaceability = commLogs.notionMinutes.length + commLogs.chatwork.length + commLogs.slack.length > 0
    ? buildReplaceabilitySignal(commLogs.notionMinutes, commLogs.chatwork, commLogs.slack)
    : EMPTY_REPLACEABILITY;

  const touchpointCount90d = countTouchpoints(commLogs, TOUCHPOINT_WINDOW_DAYS);

  // friction にはリスク判定ウィンドウ（90日）内のオープン件数を使う。
  // 全期間の合計だと「クローズし忘れの滞留チケット」で提案準備度が不当に沈む
  // （実測: 良品計画はオープン12件のうち11件が90日超の Waiting Confirm）。
  const openSupportCount = support ? support.recentOpenCount : null;

  // スナップショット時系列から30日前と現在を取る（会社合計）
  const sorted  = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
  const latest  = sorted.at(-1) ?? null;
  const oldest  = sorted.at(0)  ?? null;
  const renewalBucket = normalizeRenewalBucket(latest?.renewal_bucket ?? null);

  const sharedTrend = {
    campaignCount30dAgo: oldest?.running_campaign_total ?? null,
    campaignCountNow:    latest?.running_campaign_total ?? null,
    l30Active30dAgo:     oldest?.total_l30_active ?? null,
    l30ActiveNow:        latest?.total_l30_active ?? null,
  };

  const sharedRelationFriction = {
    communicationBlankDays: communicationVM.blankDays,
    touchpointCount90d,
    openSupportCount,
    replaceabilityFlagged: replaceability.detected,
    replaceabilityAgeDays: daysSince(replaceability.latestDate),
    renewalBucket,
  };

  // ── プロジェクト単位（主） ──────────────────────────────────────────────
  // FREE プロジェクトは提案準備度の評価対象外（既存方針に合わせる）
  const paidProjects = projects.filter(p => p.paidType !== 'FREE');

  const projectResults: ReadinessProjectFacts[] = paidProjects.map(p => {
    const signal = signalMap.get(p.id) ?? null;

    const input: ProposalReadinessInput = {
      scope:   'project',
      scopeId: p.id,
      label:   p.name || signal?.projectName || p.id,
      signal,
      habituationStatus: p.habituationStatus,
      // 運用人数（社内アカウントを除く）。プロジェクト単位が本来の粒度
      operators:     facts.map.get(p.id)?.accounts?.operators ?? null,
      operatorsPrev: facts.map.get(p.id)?.accounts?.operatorsPrev ?? null,
      // 30日の管理画面利用。プロジェクト単位で見るのが本来の粒度
      moduleSignal: facts.map.get(p.id)?.module ?? null,
      ...sharedTrend,
      ...sharedRelationFriction,
    };

    const readiness = calcProposalReadiness(input);

    // 会社合計の推移を使っている旨を明示する（プロジェクト別履歴は未保持）
    if (readiness.factors.execution.score !== null) {
      readiness.factors.execution.reasons.push('※会社全体の推移（プロジェクト別の履歴は未保持）');
    }

    return {
      readiness,
      play: decideProposalPlay(readiness, hasOpportunity, renewalBucket),
      moduleSignal: input.moduleSignal ?? EMPTY_MODULE_SIGNAL,
      project: {
        id:         p.id,
        name:       p.name,
        paidType:   p.paidType,
        status:     p.status,
        habituationStatus: p.habituationStatus,
      },
      signal: signal
        ? {
            runningCampaignWithGoalCount: signal.runningCampaignWithGoalCount,
            heatmapCount:                 signal.heatmapCount,
            l30Active:                    signal.l30Active,
            l7EventCount:                 signal.l7EventCount,
            pvCeiling:                    signal.pvCeiling,
            monthPvCount:                 signal.monthPvCount,
            lastActiveDate:               signal.lastActiveDate,
          }
        : null,
    };
  });

  // ── 会社単位（一覧表示用の粗い指標） ────────────────────────────────────
  // 利用実態は最も大きい有料プロジェクトの signal を代表値として使う。
  const representative = pickRepresentativeSignal(paidProjects, signalMap);

  const companyModuleSignal = paidProjects.length > 0
    ? mergeModuleVerdicts(paidProjects.map(p => facts.map.get(p.id)?.module ?? null))
    : null;

  // 会社単位は人を重複排除して数える（複数PJを見る1人を人数分に膨らませない）
  const opsNow = new Set<string>(); const opsPrev = new Set<string>();
  let opsFound = false;
  for (const p of paidProjects) {
    const a = facts.map.get(p.id)?.accounts;
    if (!a) continue;
    opsFound = true;
    for (const e of a.operatorEmails)     opsNow.add(e);
    for (const e of a.operatorEmailsPrev) opsPrev.add(e);
  }

  const companyReadiness = calcProposalReadiness({
    scope:   'company',
    scopeId: companyUid,
    label:   company.name,
    signal:  representative?.signal ?? null,
    habituationStatus: representative?.habituationStatus ?? null,
    moduleSignal: companyModuleSignal,
    ...sharedTrend,
    ...sharedRelationFriction,
  });

  // ── 内部・行動シグナル ──────────────────────────────────────────────────
  // 判定は behavior-signals.ts に閉じる（ボードと同一）。ここは入力を揃えるだけ。
  const usageTotals = sumUsage(projectResults);
  const habituation =
    paidProjects.some(p => p.habituationStatus === true)  ? true
    : paidProjects.some(p => p.habituationStatus === false) ? false
    : null;

  const behavior = paidProjects.length > 0 || latest
    ? detectBehaviorSignals({
        latest: toSnapshotFacts(latest, csmPhase?.mPhase ?? null),
        past:   toSnapshotFacts(oldest, null),
        usage: usageTotals
          ? {
              campaigns:      usageTotals.campaigns,
              heatmaps:       usageTotals.heatmaps,
              l30Active:      usageTotals.l30Active,
              // 週次は個社では合算していないため、代表PJの値ではなく合計を使う
              l7EventCount:   projectResults.reduce((n, it) => n + (it.signal?.l7EventCount ?? 0), 0),
              pvCeiling:      sumOrNull(projectResults.map(it => it.signal?.pvCeiling ?? null)),
              monthPvCount:   sumOrNull(projectResults.map(it => it.signal?.monthPvCount ?? null)),
              lastActiveDate: usageTotals.lastActiveDate,
            }
          : null,
        habituation,
        communicationBlankDays: communicationVM.blankDays,
        paidTypes: [
          ...paidProjects.map(p => p.paidType ?? ''),
          csmPhase?.paidType ?? '',
        ].filter(Boolean),
        support: support
          ? { recentSupportCount: support.recentSupportCount, staleOpenCount: support.staleOpenCount }
          : null,
        onboardingCompletedAt: csmPhase?.onboardingCompletedAt ?? null,
      })
    : EMPTY_BEHAVIOR_RESULT;

  return {
    companyUid,
    companyName: company.name,
    tier:        company.tier,
    renewalBucket,
    renewalDate: latest?.renewal_date ?? null,
    hasExternalOpportunity: hasOpportunity,
    externalOpportunity,
    opportunityOverridden:  opportunityOverride !== null,

    companyReadiness,
    companyPlay: decideProposalPlay(companyReadiness, hasOpportunity, renewalBucket),
    projects:    projectResults,
    behavior,
    onboardingCompletedAt: csmPhase?.onboardingCompletedAt ?? null,
    moduleSignal: companyModuleSignal,

    raw: {
      commLogs,
      storedIntel,
      usageTotals,
    },

    inputs: {
      trendWindowDays:      TREND_WINDOW_DAYS,
      trendFrom:            oldest?.snapshot_date ?? null,
      trendTo:              latest?.snapshot_date ?? null,
      communicationBlankDays: communicationVM.blankDays,
      lastContactDate:      communicationVM.lastContactDate,
      touchpointCount90d,
      openSupportCount,
      replaceability,
      paidProjectCount:     paidProjects.length,
      excludedFreeCount:    projects.length - paidProjects.length,
    },
  };
}

// ── ヘルパー ──────────────────────────────────────────────────────────────────

/** 有料PJの利用実態を合算する。signal が1件も無ければ null */
function sumUsage(items: ReadinessProjectFacts[]): ReadinessFacts['raw']['usageTotals'] {
  let campaigns = 0, heatmaps = 0, l30 = 0;
  let ceiling: number | null = null, pv: number | null = null;
  let lastActive: string | null = null;
  let found = false;

  for (const it of items) {
    const s = it.signal;
    if (!s) continue;
    found = true;
    campaigns += s.runningCampaignWithGoalCount;
    heatmaps  += s.heatmapCount;
    l30       += s.l30Active;
    if (s.pvCeiling    != null) ceiling = (ceiling ?? 0) + s.pvCeiling;
    if (s.monthPvCount != null) pv      = (pv      ?? 0) + s.monthPvCount;
    if (s.lastActiveDate && (!lastActive || s.lastActiveDate > lastActive)) lastActive = s.lastActiveDate;
  }

  if (!found) return null;
  return {
    campaigns, heatmaps, l30Active: l30,
    pvRate: ceiling && ceiling > 0 && pv !== null ? Math.round((pv / ceiling) * 100) : null,
    lastActiveDate: lastActive,
    paidProjectCount: items.length,
  };
}

/** company_daily_snapshot の1行を behavior-signals の入力に落とす */
function toSnapshotFacts(
  snap: { [k: string]: unknown } | null | undefined,
  mPhaseOverride: string | null,
): SnapshotFacts | null {
  if (!snap) return mPhaseOverride ? { ...EMPTY_FACTS, mPhase: mPhaseOverride } : null;
  const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
  return {
    activeProjectCount:   num(snap.active_project_count),
    stalledProjectCount:  num(snap.stalled_project_count),
    totalL30Active:       num(snap.total_l30_active),
    runningCampaignTotal: num(snap.running_campaign_total),
    pvCeilingAlertCount:  num(snap.pv_ceiling_alert_count),
    overallHealth:        str(snap.overall_health),
    // M-Phase はスナップショット側が Light バッチだと常に null になるため正本を優先
    mPhase:               mPhaseOverride ?? str(snap.m_phase),
  };
}

const EMPTY_FACTS: SnapshotFacts = {
  activeProjectCount: null, stalledProjectCount: null, totalL30Active: null,
  runningCampaignTotal: null, pvCeilingAlertCount: null, overallHealth: null, mPhase: null,
};

/** null を無視して合計する。全て null なら null */
function sumOrNull(values: Array<number | null>): number | null {
  let total: number | null = null;
  for (const v of values) if (v !== null) total = (total ?? 0) + v;
  return total;
}

/** 指定日数以内の接点件数（議事録 + Chatwork + Slack + Intercom） */
export function countTouchpoints(logs: CommLogs, windowDays: number): number {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const within = (v: string | null | undefined): boolean => {
    if (!v) return false;
    const t = new Date(String(v).slice(0, 10) + 'T00:00:00').getTime();
    return !isNaN(t) && t >= cutoff;
  };
  return (
    logs.notionMinutes.filter(m => within(m.meetingDate)).length +
    logs.chatwork.filter(c => within(c.sentAt)).length +
    logs.slack.filter(s => within(s.sentAt)).length +
    logs.intercomMail.filter(m => within(m.sentAt)).length
  );
}

/** 有料プロジェクトのうち L30 が最大のものを代表値として選ぶ */
function pickRepresentativeSignal(
  projects: Awaited<ReturnType<typeof fetchProjectsByCompany>>,
  signalMap: Map<string, NonNullable<ProposalReadinessInput['signal']>>,
) {
  let best: { signal: NonNullable<ProposalReadinessInput['signal']>; habituationStatus: boolean | null } | null = null;
  for (const p of projects) {
    const signal = signalMap.get(p.id);
    if (!signal) continue;
    if (!best || signal.l30Active > best.signal.l30Active) {
      best = { signal, habituationStatus: p.habituationStatus };
    }
  }
  return best;
}

/** "YYYY-MM-DD" から今日までの経過日数。null / 不正な値は null */
function daysSince(date: string | null): number | null {
  if (!date) return null;
  const t = new Date(`${date}T00:00:00`).getTime();
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

const RENEWAL_BUCKETS: RenewalBucket[] = ['0-30', '31-90', '91-180', '180+', 'expired'];

export function normalizeRenewalBucket(v: string | null): RenewalBucket | null {
  if (!v) return null;
  return RENEWAL_BUCKETS.includes(v as RenewalBucket) ? (v as RenewalBucket) : null;
}
