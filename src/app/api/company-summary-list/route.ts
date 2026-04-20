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
//
// ── レスポンス ──────────────────────────────────────────────────────────────
// {
//   total:   number,
//   filters: { freshness, review, sort, limit },
//   items:   CompanyListItemVM[]
// }
//
// ── 認証 ────────────────────────────────────────────────────────────────────
// SUPPORT_BATCH_SECRET による Bearer 認証（未設定時は警告のみ）

import { NextRequest, NextResponse }        from 'next/server';
import { checkBatchAuth }                    from '@/lib/batch/auth';
import { resolveCompanySummaryTargets }      from '@/lib/batch/company-summary-targets';
import type {
  SummaryFreshnessStatus,
  SummaryHumanReviewStatus,
} from '@/lib/company/company-summary-state-policy';

// ── Phase / Communication / Project / Support / People bulk helpers ───────────
import { fetchBothPhasesByUids }              from '@/lib/nocodb/phases';
import { fetchProjectsByUids }               from '@/lib/nocodb/project-info';
import { fetchLatestCommunicationDatesByUids } from '@/lib/nocodb/communication-logs';
import { fetchSupportCountsByUids }           from '@/lib/nocodb/support-by-company';
import { fetchPeopleSignalsByUids, fetchStaleDmSignalsByUids } from '@/lib/nocodb/people';
import { fetchOverdueActionSignalsByUids }    from '@/lib/nocodb/company-actions';
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

const VALID_FRESHNESS = new Set<string>(['missing', 'stale', 'fresh', 'locked']);
const VALID_REVIEW    = new Set<string>(['pending', 'reviewed', 'corrected', 'approved', 'null']);

export async function GET(req: NextRequest) {
  const authError = checkBatchAuth(req);
  if (authError) return authError;

  const { searchParams } = req.nextUrl;

  // ── パラメータ解析 ────────────────────────────────────────────────────────
  const rawLimit  = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  const limit     = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, MAX_LIMIT);

  const sortMode     = searchParams.get('sort') ?? 'priority_desc';
  const rawFreshness = searchParams.get('freshness');
  const rawReview    = searchParams.get('review');
  const rawUids      = searchParams.get('company_uids');
  const summaryType  = searchParams.get('summary_type') ?? 'default';

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
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[company-summary-list] 対象取得失敗:', err);
    return NextResponse.json({ error: `取得エラー: ${msg}` }, { status: 500 });
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

  const [bothPhases, projectMap, commDateMap, supportMap, peopleSignalMap, overdueActionMap, staleDmMap] = await Promise.all([
    fetchBothPhasesByUids(allUids).catch(() => ({
      csmMap: new Map() as Map<string, import('@/lib/nocodb/types').AppCsmPhase>,
      crmMap: new Map() as Map<string, import('@/lib/nocodb/types').AppCrmPhase>,
    })),
    fetchProjectsByUids(allUids).catch(() =>
      new Map(allUids.map(u => [u, [] as import('@/lib/nocodb/types').AppProjectInfo[]])),
    ),
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
  ]);
  const { csmMap, crmMap } = bothPhases;

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

    // ── People / Action signal を構築（⚠️ 一部は近似値） ───────────────────
    //
    // 【実測値】
    //   hasNoDecisionMaker : fetchPeopleSignalsByUids で得た dmCount から算出（実測）
    //   openActionCount    : companies テーブルの open_action_count カラムを参照（実測）
    //   keyContactCount    : 同上 dmCount（実測）
    //
    // 【⚠️ 近似値 — 常に false 固定】
    //   hasStaleDm        : company_people の lastTouchpoint を全件取得しないため検出不可。
    //                       Detail API では actionVM を通じて実測。
    //                       理想実装: fetchPeopleSignalsByUids に staleDmCount を追加。
    //   hasOverdueActions : company_actions の dueDate を全件取得しないため検出不可。
    //                       Detail API では action 一覧を取得した上で期限比較（実測）。
    //                       理想実装: fetchPeopleSignalsByUids と並行して
    //                                 fetchActionsSignalsByUids(overdueCount) を追加。
    //
    // → priorityScore の breakdown に含まれる hasStaleDm / hasOverdueActions は
    //   List 上では「実際より低く見積もられる可能性がある」近似スコアである点に注意。
    const peopleSignal = peopleSignalMap.get(uid);
    const openActionCount = company.openActions ?? 0;
    const peopleActionSignal: PeopleActionSignal = {
      hasNoDecisionMaker: (peopleSignal?.totalCount ?? 0) > 0 && (peopleSignal?.dmCount ?? 0) === 0,
      hasStaleDm:         staleDmMap.get(uid) ?? false,        // ✅ 実測: company_people の high influence DM で lastTouchpoint > 90d
      hasOverdueActions:  overdueActionMap.get(uid) ?? false, // ✅ 実測: due_date < today の open/in_progress action
      openActionCount,
      keyContactCount:    peopleSignal?.dmCount ?? 0,
    };

    const { score, breakdown } = calcPriorityScore({
      healthVM,
      freshnessStatus:        listVM.freshnessStatus,
      humanReviewStatus:      listVM.humanReviewStatus,
      openSupportCount:       supportCounts.openCount,
      communicationBlankDays: blankDays,
      peopleActionSignal,
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
