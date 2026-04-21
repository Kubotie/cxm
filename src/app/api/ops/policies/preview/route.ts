// ─── POST /api/ops/policies/preview ───────────────────────────────────────────
//
// AlertPolicy を受け取り、現在のデータに対してドライラン評価を行う。
// 保存・変更は一切行わない（純粋な読み取り）。
//
// ── リクエストボディ ─────────────────────────────────────────────────────────
// {
//   policy: Partial<AlertPolicy>
//   limit?:  number   (デフォルト 50, 最大 200)
// }
//
// ── レスポンス ────────────────────────────────────────────────────────────────
// PolicyPreviewResponse {
//   hit_count:            number
//   total_evaluated:      number
//   match_rate_pct:       number
//   top_hits:             PolicyPreviewHit[]
//   new_alerts_count:     number   // 既存 alert がない entity でヒット
//   removed_alerts_count: number   // 既存 alert があるが今回ヒットしない entity
//   preview_at:           string
// }
//
// ── 対応 object_type ─────────────────────────────────────────────────────────
//   company        — bulk fetch で全 CSM 管理企業を評価
//   support_case   — TODO（Phase2）
//   support_queue  — TODO（Phase2）

import { NextRequest, NextResponse } from 'next/server';
import { fetchAllCompanies }          from '@/lib/nocodb/companies';
import { fetchBothPhasesByUids }      from '@/lib/nocodb/phases';
import { fetchProjectsByUids }        from '@/lib/nocodb/project-info';
import { fetchLatestCommunicationDatesByUids } from '@/lib/nocodb/communication-logs';
import { fetchSupportCountsByUids }   from '@/lib/nocodb/support-by-company';
import { fetchPeopleSignalsByUids }   from '@/lib/nocodb/people';
import { evaluatePolicy, toFieldValueRecord } from '@/lib/policy/evaluator';
import type { AlertPolicy, PolicyPreviewResponse, PolicyPreviewHit } from '@/lib/policy/types';
import type { CompanyFieldValues } from '@/lib/policy/evaluator';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 200;
const TOP_HITS_MAX  = 20;

// ── 企業フィールド値を一括構築 ─────────────────────────────────────────────────

interface BulkCompanyData {
  commBlankDays:   number | null;
  activeProjects:  number;
  openCritical:    number;
  openSupport:     number;
  dmCount:         number;
  overallHealth:   string | null;
  stagnationDays:  number | null;
  openAlerts:      number;
  openActions:     number;
}

// ── ハンドラー ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { policy?: Partial<AlertPolicy>; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 });
  }

  const { policy, limit: rawLimit } = body;
  if (!policy) {
    return NextResponse.json({ error: 'policy フィールドが必要です' }, { status: 400 });
  }

  const limit = Math.min(rawLimit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const objectType = policy.object_type ?? 'company';

  // ── company 以外は未実装 ────────────────────────────────────────────────────
  if (objectType !== 'company') {
    return NextResponse.json({
      hit_count:            0,
      total_evaluated:      0,
      match_rate_pct:       0,
      top_hits:             [],
      new_alerts_count:     0,
      removed_alerts_count: 0,
      preview_at:           new Date().toISOString(),
      note:                 `object_type=${objectType} のプレビューは未実装です（company のみ対応）`,
    } satisfies PolicyPreviewResponse & { note: string });
  }

  // ── Step 1: 全 CSM 管理企業を取得 ───────────────────────────────────────────
  let companies: Awaited<ReturnType<typeof fetchAllCompanies>>;
  try {
    companies = await fetchAllCompanies(limit);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `企業取得エラー: ${msg}` }, { status: 500 });
  }

  if (companies.length === 0) {
    return NextResponse.json({
      hit_count: 0, total_evaluated: 0, match_rate_pct: 0,
      top_hits: [], new_alerts_count: 0, removed_alerts_count: 0,
      preview_at: new Date().toISOString(),
    } satisfies PolicyPreviewResponse);
  }

  const allUids = companies.map(c => c.id);

  // ── Step 2: 評価に必要なデータを並行 bulk fetch ─────────────────────────────
  const [bothPhases, projectMap, commDateMap, supportMap, peopleSignalMap] = await Promise.all([
    fetchBothPhasesByUids(allUids).catch(() => ({
      csmMap: new Map<string, import('@/lib/nocodb/types').AppCsmPhase>(),
      crmMap: new Map<string, import('@/lib/nocodb/types').AppCrmPhase>(),
    })),
    fetchProjectsByUids(allUids).catch(() =>
      new Map<string, import('@/lib/nocodb/types').AppProjectInfo[]>(),
    ),
    fetchLatestCommunicationDatesByUids(allUids).catch(() =>
      new Map<string, import('@/lib/nocodb/communication-logs').LatestCommunicationDate>(),
    ),
    fetchSupportCountsByUids(allUids).catch(() =>
      new Map<string, import('@/lib/nocodb/support-by-company').SupportCountSummary>(),
    ),
    fetchPeopleSignalsByUids(allUids).catch(() => new Map()),
  ]);

  const { csmMap } = bothPhases;

  // ── Step 3: 各企業を評価 ─────────────────────────────────────────────────────
  const hits: PolicyPreviewHit[] = [];
  let hitCount = 0;

  for (const company of companies) {
    const uid = company.id;

    const commDate     = commDateMap.get(uid) ?? { latestDate: null, blankDays: null };
    const supportCounts = supportMap.get(uid) ?? { openCount: 0, waitingCseCount: 0, criticalCount: 0, recentSupportCount: 0 };
    const projList     = projectMap.get(uid)  ?? [];
    const peopleSignal = peopleSignalMap.get(uid);
    const csmPhase     = csmMap.get(uid);

    const activeProjects = projList.filter(p => {
      const s = String(p.status ?? '').toLowerCase();
      return s === 'active' || s === '進行中' || s === 'in_progress';
    }).length;

    const fieldValues: CompanyFieldValues = {
      comm_blank_days:             commDate.blankDays,
      active_project_count:        activeProjects,
      open_critical_support_count: supportCounts.criticalCount,
      open_support_count:          supportCounts.openCount,
      decision_maker_count:        peopleSignal?.dmCount ?? 0,
      overall_health:              null, // Summary state は別 fetch — skip for now
      phase_stagnation_days:       null, // PhaseComparisonVM が必要 — bulk preview では未計算
      open_alert_count:            company.openAlerts ?? 0,
      open_action_count:           company.openActions ?? 0,
    };

    const evalResult = evaluatePolicy(policy, toFieldValueRecord(fieldValues));

    if (evalResult.matched) {
      hitCount++;
      if (hits.length < TOP_HITS_MAX) {
        // severity / title をテンプレート変数展開（簡易版）
        const titleTemplate = policy.output?.title ?? '{{company_name}}';
        const resolvedTitle = titleTemplate
          .replace('{{company_name}}', company.name)
          .replace('{{blank_days}}', String(commDate.blankDays ?? '?'))
          .replace('{{count}}', String(supportCounts.criticalCount));

        hits.push({
          entity_id:      uid,
          entity_name:    company.name,
          entity_type:    'company',
          match_reason:   evalResult.reasons,
          would_severity: (policy.output?.severity ?? 'medium') as PolicyPreviewHit['would_severity'],
          would_title:    resolvedTitle,
          current_alerts: company.openAlerts ?? 0,
        });
      }
    }
  }

  const total      = companies.length;
  const matchRate  = total > 0 ? Math.round((hitCount / total) * 100) : 0;

  // ── new_alerts / removed_alerts の近似計算 ────────────────────────────────
  // 現時点では policy 由来の既存 alert を区別するテーブルがない。
  // new_alerts_count = ヒット数（全て新規とみなす）
  // removed_alerts_count = 0（削除対象の特定は永続化後に実装）
  const newAlertsCount     = hitCount;
  const removedAlertsCount = 0;

  return NextResponse.json({
    hit_count:            hitCount,
    total_evaluated:      total,
    match_rate_pct:       matchRate,
    top_hits:             hits,
    new_alerts_count:     newAlertsCount,
    removed_alerts_count: removedAlertsCount,
    preview_at:           new Date().toISOString(),
  } satisfies PolicyPreviewResponse);
}
