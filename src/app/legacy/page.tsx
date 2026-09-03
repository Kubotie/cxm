// ─── /legacy ─────────────────────────────────────────────────────────────────
//   v1 のホーム画面。v2 ホーム（/v2）に主動線を移したあとも、
//   参照用に残しておく（v2 サイドバーの「アーカイブ」から開ける）。

import { Home } from "@/components/pages/home";

export default function LegacyHomePage() {
  return <Home />;
}
