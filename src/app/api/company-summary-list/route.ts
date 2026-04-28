// ─── GET /api/company-summary-list ────────────────────────────────────────────
// Company の一覧情報を CompanyListItemVM 形式で返す。
//
// 既存の batch 運用向け CompanySummaryListItemViewModel を拡張し、
// phase / communication / project / priority score を付加する。
//
// ── クエリパラメータ ────────────────────────────────────────────────────────
// freshness    : カンマ区切り。missing,stale,fresh,locked（省略=全て）
// review       : カンマ区切り。pending,reviewed,corrected,approved,null（省略=全て）
// sort         : priority_desc（デフォルト）| regenerate_priority_desc
// limit        : 最大件数（デフォルト: 100, 最大: 500）
// company_uids : カンマ区切りの UID 指定（省略=全 CSM 管理企業）
// summary_type : デフォルト "default"
// owner        : companies.owner_name でフィルタ（staff_identify.name2 に対応）
//
// ── レスポンス ──────────────────────────────────────────────────────────────
// {
//   total:   number,
//   filters: { freshness, review, sort, limit },
//   items:   CompanyListItemVM[]
// }
//
// ── 認証 ────────────────────────────────────────────────────────────────────
// このルートは UI（ブラウザ）から直接呼ばれる。
// /api/company/[companyUid] と同様に UI ルートとして扱い、Bearer 認証は行わない。
// サーバー間専用のバッチ処理には /api/batch/company-summary を使うこと。

import { NextRequest, NextResponse } from 'next/server';
import { resolveCompanySummaryTargets } from '@/lib/batch/company-summary-targets';
import type {
  SummaryFreshnessStatus,
  SummaryHumanReviewStatus,
} from '@/lib/company/company-summary-state-policy';

// ── Phase / Communication / Project / Support / People bulk helpers ───────────
import {
  fetchCsmPhasesWithHistoryByUids,
  fetchCrmPhasesByUids,
  type CsmPhaseWithHistory,
} from '@/lib/nocodb/phases';
import { fetchProjectsByUids }               from '@/lib/nocodb/project-info';
import { fetchProjectMrrMap }                from '@/lib/metabase/mrr';
import { fetchLatestCommunicationDatesByUids } from '@/lib/nocodb/communication-logs';
import { fetchSupportCountsByUids }           from '@/lib/nocodb/support-by-company';
import { fetchPeopleSignalsByUids, fetchStaleDmSignalsByUids } from '@/lib/nocodb/people';
import { fetchOverdueActionSignalsByUids }    from '@/lib/nocodb/company-actions';
import {
  fetchPreviousSnapshotsByUids,
  fetchSnapshotsByDate,
  nDaysAgoDateStr,
}                                              from '@/lib/nocodb/company-snapshot';
import type { PeopleActionSignal }            from '@/lib/company/company-people-risk';

// ── VM builders ───────────────────────────────────────────────────────────────
import {
  buildPhaseComparisonVM,
  hasAssignedCsm,
} from '@/lib/company/phase-comparison';
import {
  buildProjectAggregateVM,
  EMPTY_PROJECT_AGGREGATE,
} from '@/lib/company/project-aggregate';
import {
  getCommunicationRiskLevel,
} from '@/lib/company/badges';
import {
  buildHealthSignalVM,
} from '@/lib/company/health-signal';
import {
  calcPriorityScore,
  comparePriorityDesc,
} from '@/lib/company/priority-score';
import type { CompanyListItemVM }             from '@/lib/company/company-vm';
import type { OverallHealth }                 from '@/lib/company/badges';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT     = 500;

// ── Renewal 計算ヘルパー ──────────────────────────────────────────────────────

type RenewalBucket = '0-30' | '31-90' | '91-180' | '180+' | 'expired';

function computeRenewal(dateStr: string | null): {
  daysLeft: number | null;
  bucket:   RenewalBucket | null;
} {
  if (!dateStr) return { daysLeft: null, bucket: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const renewal = new Date(dateStr);
  const daysLeft = Math.floor((renewal.getTime() - today.getTime()) / 86_400_000);
  let bucket: RenewalBucket;
  if      (daysLeft < 0)   bucket = 'expired';
  else if (daysLeft <= 30)  bucket = '0-30';
  else if (daysLeft <= 90)  bucket = '31-90';
  else if (daysLeft <= 180) bucket = '91-180';
  else                      bucket = '180+';
  return { daysLeft, bucket };
}

const VALID_FRESHNESS = new Set<string>(['missing', 'stale', 'fresh', 'locked']);
const VALID_REVIEW    = new Set<string>(['pending', 'reviewed', 'corrected', 'approved', 'null']);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // ── パラメータ解析 ────────────────────────────────────────────────────────
  const rawLimit  = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  const limit     = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, MAX_LIMIT);

  const sortMode     = searchParams.get('sort') ?? 'priority_desc';
  const rawFreshness = searchParams.get('freshness');
  const rawReview    = searchParams.get('review');
  const rawUids      = searchParams.get('company_uids');
  const summaryType  = searchParams.get('summary_type') ?? 'default';
  const ownerName    = searchParams.get('owner') ?? undefined;

  const freshnessFilter = rawFreshness
    ? (rawFreshness.split(',').map(s => s.trim()).filter(s => VALID_FRESHNESS.has(s)) as SummaryFreshnessStatus[])
    : undefined;

  const reviewFilter = rawReview
    ? rawReview.split(',').map(s => s.trim()).filter(s => VALID_REVIEW.has(s)).map(s =>
        s === 'null' ? null : s as SummaryHumanReviewStatus,
      )
    : undefined;

  const companyUids = rawUids
    ? rawUids.split(',').map(s => s.trim()).filter(Boolean)
    : undefined;

  // ── Step 1: 既存の company + summary state 取得 ───────────────────────────
  let targets: Awaited<ReturnType<typeof resolveCompanySummaryTargets>>;
  try {
    targets = await resolveCompanySummaryTargets({
      limit,
      company_uids:    companyUids,
      freshness_filter: freshnessFilter,
      review_filter:   reviewFilter,
      summary_type:    summaryType,
      owner_name:      ownerName,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[company-summary-list] 対象取得失敗:', err);
    const isNetworkError = msg.includes('fetch failed') || msg.includes('ConnectTimeout') || msg.includes('ECONNREFUSED');
    const status = isNetworkError ? 503 : 500;
    return NextResponse.json(
      { error: isNetworkError ? `データベース接続エラー。しばらく待ってから再試行してください。(${msg.slice(0, 80)})` : `取得エラー: ${msg}` },
      { status },
    );
  }

  if (targets.length === 0) {
    return NextResponse.json({
      total:   0,
      filters: { freshness: freshnessFilter ?? 'all', review: reviewFilter ?? 'all', sort: sortMode, limit, summary_type: summaryType },
      items:   [],
    });
  }

  // ── Step 2: 全企業 UID を収集して bulk fetch ───────────────────────────────
  const allUids = targets.map(t => t.company.id);

  const [csmPhaseHistoryMap, crmMap, projectMap, mrrMap, commDateMap, supportMap, peopleSignalMap, overdueActionMap, staleDmMap, prevSnapshotMap, weeklySnapshotMap, monthlySnapshotMap] = await Promise.all([
    fetchCsmPhasesWithHistoryByUids(allUids).catch(
      () => new Map<string, CsmPhaseWithHistory>(),
    ),
    fetchCrmPhasesByUids(allUids).catch(
      () => new Map() as Map<string, import('@/lib/nocodb/types').AppCrmPhase>,
    ),
    fetchProjectsByUids(allUids).catch(() =>
      new Map(allUids.map(u => [u, [] as import('@/lib/nocodb/types').AppProjectInfo[]])),
    ),
    fetchProjectMrrMap().catch(() => new Map()),
    fetchLatestCommunicationDatesByUids(allUids).catch(() =>
      new Map<string, import('@/lib/nocodb/communication-logs').LatestCommunicationDate>(),
    ),
    fetchSupportCountsByUids(allUids).catch(() =>
      new Map<string, import('@/lib/nocodb/support-by-company').SupportCountSummary>(),
    ),
    // People signal: NOCODB_PEOPLE_TABLE_ID 未設定時は空 Map（graceful degradation）
    fetchPeopleSignalsByUids(allUids).catch(() => new Map()),
    // Overdue action signal: NOCODB_COMPANY_ACTIONS_TABLE_ID 未設定時は空 Map（graceful degradation）
    fetchOverdueActionSignalsByUids(allUids).catch(() => new Map<string, boolean>()),
    // Stale DM signal: NOCODB_COMPANY_PEOPLE_TABLE_ID 未設定時は空 Map（graceful degradation）
    fetchStaleDmSignalsByUids(allUids).catch(() => new Map<string, boolean>()),
    // 前日スナップショット: company_daily_snapshot 未設定 or 未蓄積時は空 Map（graceful degradation）
    fetchPreviousSnapshotsByUids(allUids).catch(() => new Map<string, import('@/lib/nocodb/company-snapshot').CompanyDailySnapshot>()),
    // 7日前スナップショット（週次傾向）
    fetchSnapshotsByDate(allUids, nDaysAgoDateStr(7)).catch(() => new Map<string, import('@/lib/nocodb/company-snapshot').CompanyDailySnapshot>()),
    // 30日前スナップショット（月次傾向）
    fetchSnapshotsByDate(allUids, nDaysAgoDateStr(30)).catch(() => new Map<string, import('@/lib/nocodb/company-snapshot').CompanyDailySnapshot>()),
  ]);
  // csmPhaseHistoryMap から current のみ抽出して既存の csmMap 互換で使う
  const csmMap = new Map(
    [...csmPhaseHistoryMap.entries()].map(([uid, h]) => [uid, h.current]),
  );

  // ── Step 3: 各企業の VM を構築 ────────────────────────────────────────────
  const items: CompanyListItemVM[] = targets.map(({ company, listVM }) => {
    const uid = company.id;

    const phaseVM = buildPhaseComparisonVM(
      csmMap.get(uid) ?? null,
      crmMap.get(uid) ?? null,
      hasAssignedCsm(company.owner),
    );

    const projList  = projectMap.get(uid) ?? [];
    const projectVM = projList.length > 0 ? buildProjectAggregateVM(projList) : EMPTY_PROJECT_AGGREGATE;

    // ── MRR / Renewal 計算 ──────────────────────────────────────────────────
    // 契約終了日の取得元（優先順）:
    //   1. project_info.latestOrderEndDate（NocoDB 直取得 — 最も信頼性が高い）
    //   2. Metabase CSV の orderEndDate（project_id join が成立した場合のみ）
    // → 2つを比べて最も早い（直近の）日付をその企業の renewal 候補とする
    let totalMrr = 0;
    let earliestProjectEndDate: string | null = null;
    for (const p of projList) {
      // MRR 金額は Metabase CSV から
      const mrrData = mrrMap.get(p.id);
      if (mrrData) totalMrr += mrrData.mrr;

      // 終了日: project_info.latestOrderEndDate を優先し、なければ CSV にフォールバック
      const endDate = p.latestOrderEndDate ?? mrrData?.orderEndDate ?? null;
      if (endDate) {
        if (!earliestProjectEndDate || endDate < earliestProjectEndDate) {
          earliestProjectEndDate = endDate;
        }
      }
    }
    // CSM target → CRM contract → project end の優先順で renewal 日を決める
    const csmPhase = csmMap.get(uid) ?? null;
    const crmPhase = crmMap.get(uid) ?? null;
    const renewalDate =
      csmPhase?.targetRenewalDate ??
      crmPhase?.contractEndDate   ??
      earliestProjectEndDate      ?? null;
    const { daysLeft: renewalDaysLeft, bucket: renewalBucket } = computeRenewal(renewalDate);

    // ── Phase 変化検知 ───────────────────────────────────────────────────────
    const phaseHistory = csmPhaseHistoryMap.get(uid);
    const previousMPhase = phaseHistory?.previous?.mPhase ?? null;
    const phaseChanged =
      phaseHistory !== undefined &&
      phaseHistory.previous !== null &&
      phaseHistory.current.mPhase !== previousMPhase;

    const commDate  = commDateMap.get(uid) ?? { latestDate: null, blankDays: null };
    const blankDays = commDate.blankDays;
    const commRisk  = getCommunicationRiskLevel(blankDays);

    const supportCounts = supportMap.get(uid) ?? { openCount: 0, waitingCseCount: 0, criticalCount: 0, recentSupportCount: 0 };

    // Health（List 向けに support_case_ai_state なしの簡易版）
    const healthVM = buildHealthSignalVM({
      companyUid:          uid,
      summary:             null,   // List では summary state は別途 listVM に含まれる
      phaseVM,
      communicationVM:     { lastContactDate: commDate.latestDate, blankDays, riskLevel: commRisk, activeSources: [], recentCount: 0, totalCount: 0, recentEntries: [] },
      projectVM,
      openCriticalSupport: supportCounts.criticalCount,
      openHighSupport:     0,  // List API は high count を個別集計しない（criticalCount で代替）
      openAlertCount:      company.openAlerts,
    });

    // AI health は summary から引く（listVM 経由で取れないので別途 null）
    // List では detail API と違い summaryState を持っていないため省略

    // ── People / Action signal を構築（全フィールド実測）──────────────────
    //
    //   hasNoDecisionMaker : people テーブルから is_decision_maker フラグで集計（実測）
    //   hasStaleDm         : company_people の high DM に lastTouchpoint > 90d が存在（実測）
    //   hasOverdueActions  : company_actions の due_date < today かつ open/in_progress（実測）
    //   openActionCount    : companies.open_actions カラム（実測）
    //   keyContactCount    : people の dmCount（実測）
    //
    // ⚠️ NOCODB_COMPANY_PEOPLE_TABLE_ID / NOCODB_COMPANY_ACTIONS_TABLE_ID が未設定の場合、
    //    対応シグナルは graceful degradation で false/0 になる（スコアに反映されない）。
    const peopleSignal = peopleSignalMap.get(uid);
    // ⚠️ 開発メモ: シードデータ環境では全社 open_actions=5 のため action_many_open(+8) が一律発火し、
    //   priorityScore の順位差が小さく見える。本番データが入ると people/action シグナルが分散し、
    //   scores に意味のある差が生まれる。
    const openActionCount = company.openActions ?? 0;
    const peopleActionSignal: PeopleActionSignal = {
      hasNoDecisionMaker: (peopleSignal?.totalCount ?? 0) > 0 && (peopleSignal?.dmCount ?? 0) === 0,
      hasStaleDm:         staleDmMap.get(uid) ?? false,        // ✅ 実測: company_people の high influence DM で lastTouchpoint > 90d
      hasOverdueActions:  overdueActionMap.get(uid) ?? false, // ✅ 実測: due_date < today の open/in_progress action
      openActionCount,
      keyContactCount:    peopleSignal?.dmCount ?? 0,
    };

    // ── Snapshot 差分計算 ────────────────────────────────────────────────────
    const prevSnap    = prevSnapshotMap.get(uid)    ?? null;
    const weeklySnap  = weeklySnapshotMap.get(uid)  ?? null;
    const monthlySnap = monthlySnapshotMap.get(uid) ?? null;
    let snapshotDiff: import('@/lib/company/company-vm').CompanyListItemVM['snapshotDiff'];

    if (prevSnap || weeklySnap || monthlySnap) {
      const currentMPhase  = csmPhase?.mPhase ?? null;
      const currentMrr_    = totalMrr > 0 ? totalMrr : null;
      const currHealth     = healthVM.overallHealth as string | null;

      const HEALTH_ORDER: Record<string, number> = {
        critical: 0, at_risk: 1, healthy: 2, expanding: 3,
      };

      // ── 前日差分（prevSnap がある場合のみ計算）─────────────────────────────
      const snapshotSupport = prevSnap?.open_support_count ?? 0;
      const supportDelta    = (prevSnap ? supportCounts.openCount - snapshotSupport : 0);
      const snapshotMrr     = prevSnap?.mrr ?? null;
      const mrrDelta        = currentMrr_ !== null && snapshotMrr !== null
        ? currentMrr_ - snapshotMrr : null;
      const snapshotBucket  = (prevSnap?.renewal_bucket ?? null) as import('@/lib/company/company-vm').CompanyListItemVM['renewalBucket'];

      const prevHealth  = prevSnap?.overall_health ?? null;
      const prevHOrder  = prevHealth ? (HEALTH_ORDER[prevHealth]  ?? -1) : -1;
      const currHOrder  = currHealth ? (HEALTH_ORDER[currHealth] ?? -1) : -1;
      const healthChanged  = prevHealth !== null && currHealth !== null && prevHealth !== currHealth;
      const healthWorsened = healthChanged && currHOrder < prevHOrder;
      const healthImproved = healthChanged && currHOrder > prevHOrder;

      // ── 週次傾向（weeklySnap がある場合のみ）─────────────────────────────
      const weeklyHealth   = weeklySnap?.overall_health ?? null;
      const weeklyHOrder   = weeklyHealth ? (HEALTH_ORDER[weeklyHealth] ?? -1) : -1;
      const weeklyChanged  = weeklyHealth !== null && currHealth !== null && weeklyHealth !== currHealth;
      const weeklyHealthWorsened   = weeklyChanged && currHOrder < weeklyHOrder;
      const weeklyActivated        = weeklyChanged && currHOrder > weeklyHOrder
        && (currHealth === 'healthy' || currHealth === 'expanding');
      const weeklyHealthTransition = weeklyChanged
        ? `${weeklyHealth} → ${currHealth}` : null;

      // ── 月次傾向（monthlySnap がある場合のみ）──────────────────────────────
      const monthlyBucket  = (monthlySnap?.renewal_bucket ?? null) as import('@/lib/company/company-vm').CompanyListItemVM['renewalBucket'];
      const monthlyMrr     = monthlySnap?.mrr ?? null;
      const monthlyMrrDelta = currentMrr_ !== null && monthlyMrr !== null
        ? currentMrr_ - monthlyMrr : null;
      // 更新バケットが近づいた: 30日前は 91-180 or 180+ で、今は 31-90 or 0-30
      const monthlyRenewalEntered =
        (monthlyBucket === '91-180' || monthlyBucket === '180+') &&
        (renewalBucket === '31-90'  || renewalBucket === '0-30');

      snapshotDiff = {
        // 前日差分
        phaseChanged:         prevSnap !== null && currentMPhase !== null && prevSnap.m_phase !== null && currentMPhase !== prevSnap.m_phase,
        previousMPhase:       prevSnap?.m_phase ?? null,
        supportDelta:         prevSnap ? supportDelta : null,
        supportIncreased:     prevSnap ? supportDelta > 0 : false,
        renewalEnteredThirty: prevSnap !== null && snapshotBucket !== '0-30' && renewalBucket === '0-30',
        renewalEnteredNinety: prevSnap !== null && (snapshotBucket === '91-180' || snapshotBucket === '180+' || snapshotBucket === null) && renewalBucket === '31-90',
        mrrDelta,
        mrrIncreased:         mrrDelta !== null && mrrDelta > 0,
        mrrDecreased:         mrrDelta !== null && mrrDelta < 0,
        healthChanged,
        healthWorsened,
        healthImproved,
        previousHealth:       prevHealth,
        healthTransition:     healthChanged ? `${prevHealth} → ${currHealth}` : null,
        // 週次傾向
        weeklyHealthWorsened,
        weeklyActivated,
        weeklyHealthTransition,
        // 月次傾向
        monthlyRenewalEntered,
        monthlyMrrDelta,
        monthlyMrrIncreased:  monthlyMrrDelta !== null && monthlyMrrDelta > 0,
        monthlyMrrDecreased:  monthlyMrrDelta !== null && monthlyMrrDelta < 0,
      };
    }

    const { score, breakdown } = calcPriorityScore({
      healthVM,
      freshnessStatus:        listVM.freshnessStatus,
      humanReviewStatus:      listVM.humanReviewStatus,
      openSupportCount:       supportCounts.openCount,
      communicationBlankDays: blankDays,
      peopleActionSignal,
      renewalBucket,
    });

    return {
      // ── 既存 CompanySummaryListItemViewModel ──────────────────────────────
      ...listVM,

      // ── Priority ──────────────────────────────────────────────────────────
      priorityScore:     score,
      priorityBreakdown: breakdown,

      // ── Health ────────────────────────────────────────────────────────────
      overallHealth: healthVM.overallHealth as OverallHealth | null,

      // ── Phase ─────────────────────────────────────────────────────────────
      activePhaseLabel:    phaseVM.primaryPhaseLabel,
      activePhaseSource:   phaseVM.primarySource,
      phaseGap:            phaseVM.hasGap,
      phaseGapDescription: phaseVM.gapDescription,
      phaseStagnationDays: phaseVM.stagnationDays,

      // ── Communication ─────────────────────────────────────────────────────
      communicationBlankDays: blankDays,
      communicationRiskLevel: commRisk,

      // ── Support ───────────────────────────────────────────────────────────
      openSupportCount:     supportCounts.openCount,
      criticalSupportCount: supportCounts.criticalCount,

      // ── Projects ──────────────────────────────────────────────────────────
      projectSummary: {
        total:   projectVM.total,
        active:  projectVM.active,
        stalled: projectVM.stalled,
        unused:  projectVM.unused,
      },

      // ── MRR / Renewal ─────────────────────────────────────────────────────
      mrr:             totalMrr > 0 ? totalMrr : null,
      renewalDate,
      renewalDaysLeft,
      renewalBucket,

      // ── Phase Change ──────────────────────────────────────────────────────
      phaseChanged,
      previousMPhase,

      // ── Snapshot Diff ─────────────────────────────────────────────────────
      snapshotDiff,

      // ── Basic ─────────────────────────────────────────────────────────────
      owner:       company.owner,
      lastContact: company.lastContact,
    } satisfies CompanyListItemVM;
  });

  // ── Step 4: ソート ───────────────────────────────────────────────────────
  if (sortMode === 'priority_desc') {
    items.sort((a, b) =>
      comparePriorityDesc(
        { score: a.priorityScore, lastContact: a.lastContact },
        { score: b.priorityScore, lastContact: b.lastContact },
      ),
    );
  }
  // 'regenerate_priority_desc' は resolveCompanySummaryTargets がすでに適用済み

  return NextResponse.json({
    total:   items.length,
    filters: {
      freshness:    freshnessFilter ?? 'all',
      review:       reviewFilter    ?? 'all',
      sort:         sortMode,
      limit,
      summary_type: summaryType,
    },
    items,
  });
}
