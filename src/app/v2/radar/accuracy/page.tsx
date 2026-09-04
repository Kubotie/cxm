// ─── /v2/radar/accuracy ───────────────────────────────────────────────────────
// 解約レーダーの精度パネル。設計: docs-src/cxm_v2/19_Churn_Radar_Design.md §5.4

import AccuracyView from "./accuracy-view";

export const dynamic = "force-dynamic";

export default function Page() {
  return <AccuracyView />;
}
