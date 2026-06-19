// ─── GET /api/company/[companyUid]/core ───────────────────────────────────────
// 会社詳細ページの初期表示（ヘッダー・Phase・Summary）に必要な最小データを高速返却する。
//
// 対象: company基本情報 + phase + summary state のみ。
// health / communication / support / projects / people / evidence は含まない。
//
// 目的: 重い `/api/company/[companyUid]` の応答を待たずにヘッダーを即時表示するため。
// ページ側で core → full の2段階ロードを行い、体感速度を改善する。

import { NextResponse } from 'next/server';
import { fetchCompanyByUid }      from '@/lib/nocodb/companies';
import { getCompanySummaryState } from '@/lib/nocodb/company-summary-read';
import { fetchBothPhases }        from '@/lib/nocodb/phases';
import { buildCompanySummaryViewModel } from '@/lib/company/company-summary-state-policy';
import { buildPhaseComparisonVM, hasAssignedCsm } from '@/lib/company/phase-comparison';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }

  // 3つのソースを並列取得
  const [company, summaryState, { csmPhase, crmPhase }] = await Promise.all([
    fetchCompanyByUid(companyUid).catch(() => null),
    getCompanySummaryState(companyUid).catch(() => null),
    fetchBothPhases(companyUid).catch(() => ({ csmPhase: null, crmPhase: null })),
  ]);

  if (!company) {
    return NextResponse.json({ error: `企業が見つかりません: ${companyUid}` }, { status: 404 });
  }

  const summaryVM = buildCompanySummaryViewModel(summaryState);
  const phaseVM   = buildPhaseComparisonVM(csmPhase, crmPhase, hasAssignedCsm(company.owner));

  return NextResponse.json({
    company,
    phase: phaseVM,
    summary: {
      state: summaryState,
      vm:    summaryVM,
    },
  });
}
