// ─── /v2/radar/[companyUid] ───────────────────────────────────────────────────
// 解約レーダーの個社ドリル。設計: docs-src/cxm_v2/19_Churn_Radar_Design.md §5.3

import DrillView from "./drill-view";

export const dynamic = "force-dynamic";

export default async function Page(
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  return <DrillView companyUid={companyUid} />;
}
