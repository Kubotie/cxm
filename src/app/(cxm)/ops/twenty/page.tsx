// Ptai Pipeline の Twenty 移行用の運用画面。
//
// `(cxm)` ルートグループ配下にあるのは、共通の管理 UI レイアウト
// （SidebarNav / GlobalHeader、Tailwind のルートレイアウト）を使うためだけで、
// **CXM のデータ機能ではない。** CXM の NocoDB テーブルには一切アクセスしない。

import { TwentyOpsPage } from "@/components/pages/twenty-ops";

export default function TwentyOpsRoute() {
  return <TwentyOpsPage />;
}
