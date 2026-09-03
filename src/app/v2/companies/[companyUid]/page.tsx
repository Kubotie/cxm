// ─── CXM v2 会社詳細（Server Component）───────────────────────────────────────
//   サーバー側で利用状況・時系列を取得し、クライアント view に初期データを渡す。
//   これにより「JSバンドル→mount→fetch」のクライアント・ウォーターフォールを排除する。
//   await 中は loading.tsx がフォールバック表示される（ストリーミング）。

import { loadCompanyUsage } from "@/lib/company/company-usage";
import { loadCompanyTimeseries } from "@/lib/company/company-timeseries";
import { fetchStoredCampaignOrg } from "@/lib/nocodb/campaign-org-cache";
import type { CompanyCampaignsResponse } from "@/lib/company/company-campaigns";
import { CompanyDetailView } from "./view";

export default async function V2CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyUid: string }>;
  /** `?from=readiness` などで戻り先を指定する。無ければ提案準備ボード */
  searchParams: Promise<{ from?: string }>;
}) {
  const { companyUid } = await params;
  const { from } = await searchParams;

  // usage / timeseries / 施策の動き をサーバーで並列取得（互いに独立）。
  // 施策の動きは日次バッチが保存済みなので読むだけ（明細CSVは引かない）
  const [initialUsage, initialTs, campaignOrg] = await Promise.all([
    loadCompanyUsage(companyUid).catch(() => null),
    loadCompanyTimeseries(companyUid, 90).catch(() => null),
    fetchStoredCampaignOrg<CompanyCampaignsResponse>(companyUid)
      .then(r => r.payload)
      .catch(() => null),
  ]);

  return (
    <CompanyDetailView
      companyUid={companyUid}
      initialUsage={initialUsage}
      initialTs={initialTs}
      monthlyCampaigns={campaignOrg?.org?.monthly ?? null}
      from={from ?? null}
    />
  );
}
