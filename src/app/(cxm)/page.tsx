// ─── / → /apps ───────────────────────────────────────────────────────────────
//   ログイン後の着地はプロダクト選択画面。
//   そこから CXM（/v2）か Ptengine AI パイプライン（/ptai-pipeline）へ分岐する。

import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/apps");
}
