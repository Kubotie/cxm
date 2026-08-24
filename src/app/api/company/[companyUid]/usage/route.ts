// ─── GET /api/company/[companyUid]/usage ──────────────────────────────────────
// 個社の「現在の利用状況」を集約して返す。CXM v2 の会社詳細ページ用。
// 集約ロジックは @/lib/company/company-usage に集約（Server Component と共用）。

import { NextResponse } from 'next/server';
import { loadCompanyUsage, type CompanyUsageResponse } from '@/lib/company/company-usage';

export type {
  CompanyUsageResponse,
  ProjectUsageItem,
  ContractPlan,
  AlarmType,
  Severity,
} from '@/lib/company/company-usage';

export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyUid: string }> },
): Promise<NextResponse<CompanyUsageResponse | { error: string }>> {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }
  const response = await loadCompanyUsage(companyUid);
  if (!response) {
    return NextResponse.json({ error: `企業が見つかりません: ${companyUid}` }, { status: 404 });
  }
  return NextResponse.json(response);
}
