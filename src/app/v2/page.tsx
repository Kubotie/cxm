// ─── /v2 → 提案準備ボードへ ───────────────────────────────────────────────────
//   v2 の入口は「誰に提案できるか」を決める画面に集約する。
//   機能しないホーム画面を置かない（動線に乗らないものは運用されない）。

import { redirect } from "next/navigation";

export default function V2HomePage() {
  redirect("/v2/readiness");
}
