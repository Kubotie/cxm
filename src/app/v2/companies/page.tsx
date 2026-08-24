// ─── /v2/companies → 提案準備ボードへ ─────────────────────────────────────────
//   顧客一覧の役割は提案準備ボードが担う。個社ページは /v2/companies/[companyUid]。

import { redirect } from "next/navigation";

export default function V2CompaniesPage() {
  redirect("/v2/readiness");
}
