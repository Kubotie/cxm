// ─── GET /api/projects/module-usage ───────────────────────────────────────────
//
// プロジェクト分析ダッシュボード（/v2/projects）のデータ源。
//
// 過去30日の管理画面モジュール利用 × 契約プラン × L30アクティブ を突き合わせ、
// 「契約しているのに使われていない」を実測で出す。
//
// 判定の分岐で最も重要なのは、**モジュールデータが無いプロジェクトの扱い**。
// CSV は PV>0 の行しか持たないため、行が無い＝管理画面に来ていない。
// L30 Active も 0 なら「休眠」、L30 が動いていれば「未評価」に分ける。
// これを一緒くたに「未評価」で流すと、有料PJの53%を見逃す（実測）。
//
// 対象は既定で有料プラン（PTI / PTX / BUNDLE）のみ。FREE は数が多く（8,897件）
// 判断対象ではないため、明示的に ?includeFree=1 を付けたときだけ含める。

import { NextRequest, NextResponse } from 'next/server';
import { fetchProjectSignalMap, type ProjectSignalData } from '@/lib/metabase/project-signals';
import { fetchProjectModuleMap, getModuleCacheAge, type ProjectModuleData } from '@/lib/metabase/project-modules';
import { fetchCompaniesByTiers } from '@/lib/nocodb/companies';
import type { AppCompany } from '@/lib/nocodb/types';
import {
  buildModuleSignal, normalizePlan,
  type ModuleVerdict, type PlanKind,
} from '@/lib/company/module-signals';
import { MODULE_DICTIONARY } from '@/lib/metabase/module-dictionary';

export const maxDuration = 60;

export interface ProjectModuleRow {
  projectId:   string;
  projectName: string;
  companyName: string | null;
  companyUid:  string | null;
  /** 担当CSM。NocoDB の担当企業に紐づいたときだけ入る */
  owner:       string | null;
  tier:        number | null;

  plan:    PlanKind;
  verdict: ModuleVerdict;
  reasons: string[];
  opportunities: string[];

  /** 契約しているのに30日使っていない製品 */
  unusedEntitled: string[];
  activePv:  number;
  deepPv:    number;
  activeModuleCount: number;
  runsAbTest: boolean;
  reachedHeatmapList: boolean;
  legacyLp:   boolean;

  l30Active:  number;
  l7Events:   number;
  lastActiveDate: string | null;

  /** 上位モジュール（PV降順・最大6件） */
  topModules: Array<{ id: string; label: string; product: string; signalType: string; pv: number }>;
}

export interface ModuleUsageResponse {
  period: { start: string | null; end: string | null };
  /** 判定別の件数 */
  counts: Record<ModuleVerdict, number>;
  /** プラン別 × 判定別 */
  byPlan: Array<{ plan: PlanKind; total: number; counts: Record<string, number> }>;
  /** モジュールの採用状況（何プロジェクトが使っているか） */
  adoption: Array<{
    id: string; label: string; product: string; signalType: string;
    projects: number; pv: number; caution: string | null;
  }>;
  rows: ProjectModuleRow[];
  /** 辞書に無く捨てたPV。透明性のため出す */
  droppedPv: number;
  /** モジュールCSVのキャッシュ経過秒 */
  cacheAgeSec: number | null;
  owners: string[];
}

export async function GET(req: NextRequest) {
  const includeFree = req.nextUrl.searchParams.get('includeFree') === '1';

  const [sigs, mods, companies] = await Promise.all([
    fetchProjectSignalMap().catch(() => new Map<string, ProjectSignalData>()),
    fetchProjectModuleMap().catch(() => new Map<string, ProjectModuleData>()),
    // 担当・Tier を出すために自社の管理対象企業を引く（取れなくても続行する）
    fetchCompaniesByTiers([1, 2, 3, 5], 2000).catch(() => [] as AppCompany[]),
  ]);

  // NocoDB の company.id は `sf_0017F...`、Metabase CSV は `0017F...`（接頭辞なし）。
  // 実測でこの差により担当者・Tier が1件も紐付いていなかったので、両形式で引く。
  const bySfId = new Map<string, AppCompany>();
  for (const c of companies) {
    bySfId.set(c.id, c);
    if (c.id.startsWith('sf_')) bySfId.set(c.id.slice(3), c);
  }

  const rows: ProjectModuleRow[] = [];
  let droppedPv = 0;
  let periodStart: string | null = null;
  let periodEnd:   string | null = null;

  const adoptionProjects = new Map<string, { projects: number; pv: number }>();

  for (const [pid, sig] of sigs) {
    const plan = normalizePlan(sig.paidType);
    if (!includeFree && !['PTI', 'PTX', 'BUNDLE'].includes(plan)) continue;

    const data = mods.get(pid) ?? null;
    const vm = buildModuleSignal({ paidType: sig.paidType, data, l30Active: sig.l30Active });

    if (data) {
      droppedPv += data.droppedPv;
      periodStart ??= data.periodStart;
      periodEnd   ??= data.periodEnd;
      for (const m of data.modules) {
        const a = adoptionProjects.get(m.moduleId) ?? { projects: 0, pv: 0 };
        a.projects++; a.pv += m.pageviews;
        adoptionProjects.set(m.moduleId, a);
      }
    }

    const company = sig.masterCompanySfId ? bySfId.get(sig.masterCompanySfId) ?? null : null;

    rows.push({
      projectId:   pid,
      projectName: sig.projectName || pid,
      companyName: company?.name ?? sig.masterCompanyName ?? null,
      companyUid:  company?.id ?? null,
      owner:       company?.owner ?? null,
      tier:        company?.tier ?? null,
      plan,
      verdict: vm.verdict,
      reasons: vm.reasons,
      opportunities: vm.opportunities,
      unusedEntitled: vm.unusedEntitled,
      activePv:  vm.activePv,
      deepPv:    vm.deepPv,
      activeModuleCount: vm.activeModuleCount,
      runsAbTest: vm.runsAbTest,
      reachedHeatmapList: vm.reachedHeatmapList,
      legacyLp:  vm.legacyLp,
      l30Active: sig.l30Active,
      l7Events:  sig.l7EventCount,
      lastActiveDate: sig.lastActiveDate,
      topModules: (data?.modules ?? []).slice(0, 6).map(m => ({
        id: m.moduleId, label: m.def.labelJa, product: m.def.product,
        signalType: m.def.signalType, pv: m.pageviews,
      })),
    });
  }

  // 危険なものを上に: 休眠 → 未使用 → 一部未使用 → 浅い → 未評価 → 活用中
  const ORDER: ModuleVerdict[] = ['dormant', 'unused', 'partial', 'shallow', 'unevaluated', 'healthy'];
  rows.sort((a, b) =>
    ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict)
    || b.activePv - a.activePv
    || a.projectName.localeCompare(b.projectName));

  const counts = Object.fromEntries(ORDER.map(v => [v, 0])) as Record<ModuleVerdict, number>;
  const planAgg = new Map<PlanKind, Record<string, number>>();
  for (const r of rows) {
    counts[r.verdict]++;
    const p = planAgg.get(r.plan) ?? {};
    p[r.verdict] = (p[r.verdict] ?? 0) + 1;
    planAgg.set(r.plan, p);
  }

  const adoption = MODULE_DICTIONARY
    .filter(m => m.includeInApp)
    .map(m => {
      const a = adoptionProjects.get(m.id) ?? { projects: 0, pv: 0 };
      return {
        id: m.id, label: m.labelJa, product: m.product, signalType: m.signalType,
        projects: a.projects, pv: a.pv, caution: m.caution,
      };
    })
    .sort((a, b) => b.projects - a.projects);

  const body: ModuleUsageResponse = {
    period: { start: periodStart, end: periodEnd },
    counts,
    byPlan: [...planAgg.entries()]
      .map(([plan, c]) => ({ plan, total: Object.values(c).reduce((x, y) => x + y, 0), counts: c }))
      .sort((a, b) => b.total - a.total),
    adoption,
    rows,
    droppedPv,
    cacheAgeSec: getModuleCacheAge() === null ? null : Math.round(getModuleCacheAge()! / 1000),
    owners: [...new Set(rows.map(r => r.owner).filter((v): v is string => Boolean(v)))].sort(),
  };

  return NextResponse.json(body);
}
