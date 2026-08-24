// ─── CXM v2 会社詳細（Server Component）───────────────────────────────────────
//   サーバー側で利用状況・時系列を取得し、クライアント view に初期データを渡す。
//   これにより「JSバンドル→mount→fetch」のクライアント・ウォーターフォールを排除する。
//   await 中は loading.tsx がフォールバック表示される（ストリーミング）。

import { loadCompanyUsage } from "@/lib/company/company-usage";
import { loadCompanyTimeseries } from "@/lib/company/company-timeseries";
import { CompanyDetailView } from "./view";

export default async function V2CompanyDetailPage({
  params,
}: {
  params: Promise<{ companyUid: string }>;
}) {
  const { companyUid } = await params;

  // usage と timeseries をサーバーで並列取得（互いに独立）
  const [initialUsage, initialTs] = await Promise.all([
    loadCompanyUsage(companyUid).catch(() => null),
    loadCompanyTimeseries(companyUid, 90).catch(() => null),
  ]);

  return (
    <CompanyDetailView
      companyUid={companyUid}
      initialUsage={initialUsage}
      initialTs={initialTs}
    />
  );
}
