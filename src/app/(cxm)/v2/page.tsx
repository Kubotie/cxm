// ─── /v2 → ホーム ────────────────────────────────────────────────────────────
//   ログイン直後の着地点。「今日どこから手をつけるか」を決める画面。
//   個社の精査は提案準備ボード（/v2/readiness）から先へ進む。

import { V2HomeView } from "./home-view";

export const metadata = { title: "ホーム | CXM" };

export default function V2HomePage() {
  return <V2HomeView />;
}
