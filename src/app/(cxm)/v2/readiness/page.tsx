// ─── 提案準備ボード（Server Component）───────────────────────────────────────
//   Tier 1/2/3 の担当顧客を「今どこに提案できるか」で並べる。
//   クライアント側の fetch ウォーターフォールを避けるため、初期データはサーバーで取得する。

import { ReadinessBoardView } from "./board-view";

export default function V2ReadinessBoardPage() {
  return <ReadinessBoardView />;
}
