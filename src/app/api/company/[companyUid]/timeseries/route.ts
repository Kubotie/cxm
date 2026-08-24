// ─── GET /api/company/[companyUid]/timeseries ─────────────────────────────────
// 個社の時系列データ（日次スナップショット履歴）を返す。CXM v2 会社詳細のタブ1/2用。
// 集約ロジックは @/lib/company/company-timeseries に集約（Server Component と共用）。

import { NextResponse } from 'next/server';
import { loadCompanyTimeseries, type TimeseriesResponse } from '@/lib/company/company-timeseries';

export type { TimeseriesResponse, TimeseriesPoint } from '@/lib/company/company-timeseries';

export const maxDuration = 60;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ companyUid: string }> },
): Promise<NextResponse<TimeseriesResponse | { error: string }>> {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }
  const daysRaw = parseInt(new URL(req.url).searchParams.get('days') ?? '90', 10);
  const response = await loadCompanyTimeseries(companyUid, daysRaw);
  if (!response) {
    return NextResponse.json({ error: `企業が見つかりません: ${companyUid}` }, { status: 404 });
  }
  return NextResponse.json(response);
}
