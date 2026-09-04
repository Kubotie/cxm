// ─── /v2/radar/voices ─────────────────────────────────────────────────────────
// 言質レビュー。設計: docs-src/cxm_v2/19_Churn_Radar_Design.md §8.6

import VoicesView from "./voices-view";

export const dynamic = "force-dynamic";

export default function Page() {
  return <VoicesView />;
}
