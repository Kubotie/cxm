// ─── / → /v2 ─────────────────────────────────────────────────────────────────
//   ログイン後のトップは v2 ホーム。
//   旧ホームは /legacy に残してある（v2 サイドバーのアーカイブから開ける）。

import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/v2");
}
