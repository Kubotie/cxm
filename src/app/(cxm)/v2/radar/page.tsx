// ─── /v2/radar ────────────────────────────────────────────────────────────────
// 解約レーダーのトップ。設計: docs-src/cxm_v2/19_Churn_Radar_Design.md §5.1

import ScopeView from "./scope-view";

export const dynamic = "force-dynamic";

export default function Page() {
  return <ScopeView />;
}
