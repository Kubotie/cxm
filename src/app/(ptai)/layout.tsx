// ─── Ptengine AI Pipeline Board のルートレイアウト ────────────────────────────
//
// CXM（(cxm) グループ）とは **別のルートレイアウト**にしている。
// 原本の CSS は body や素の要素を直接指定しているので、CXM 側の Tailwind の
// preflight と同じドキュメントに同居させると見た目が変わる（HANDOVER 12-1-1 に反する）。
// ルートグループを分けると <html>/<body> ごと分離でき、URL は変わらない。

import type { Metadata } from "next";
import "./board.css";
import "./shell.css";

export const metadata: Metadata = {
  title: "Ptengine AI Pipeline Board",
  description: "Ptengine AI 拡販のパイプライン・アカウントサクセス管理",
};

export default function PtaiRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
