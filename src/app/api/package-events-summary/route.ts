// ─── GET /api/package-events-summary ─────────────────────────────────────────
// Home ポートフォリオ分布セクション向けに、パッケージ変動イベントの集計を返す。
//
// CSM 担当企業（resolveCompanySummaryTargets）の SF Account ID でフィルタし、
// 担当外顧客のイベントを除外する。
//
// レスポンス: PackageEventSummary
//   {
//     monthly: PackageEventMonthlySummary[]  // 直近12ヶ月
//     last30:  { churn, downsell, upsell, newEntry }
//   }

import { NextResponse } from 'next/server';
import { resolveCompanySummaryTargets } from '@/lib/batch/company-summary-targets';
import { fetchPackageEventSummary }     from '@/lib/metabase/package-events';

export async function GET() {
  try {
    // 担当企業の SF Account ID を収集
    const targets = await resolveCompanySummaryTargets({ limit: 500 }).catch(() => []);
    const allowedSfIds = new Set(
      targets
        .map(t => t.company.sfAccountId)
        .filter((id): id is string => id !== null && id !== undefined && id !== ''),
    );

    const summary = await fetchPackageEventSummary(allowedSfIds.size > 0 ? allowedSfIds : undefined);
    return NextResponse.json(summary);
  } catch (e) {
    console.error('[package-events-summary] 集計エラー:', e);
    return NextResponse.json(
      { monthly: [], last30: { churn: 0, downsell: 0, upsell: 0, newEntry: 0 } },
      { status: 200 },
    );
  }
}
