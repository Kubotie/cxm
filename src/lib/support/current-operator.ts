// ─── Current Support Operator ─────────────────────────────────────────────
// 操作者 ID / 名前の単一参照点。
// 認証実装後はここを auth session から取得する形に差し替える。
// API Routes でのみ呼び出す（サーバーサイド専用）。

/**
 * 現在の操作者名を返すスタブ。
 * 認証実装後: `session.user.name` 等に置き換える。
 */
export function getCurrentSupportOperator(): string | null {
  // TODO: Replace with real auth session lookup
  // e.g., const session = await getServerSession(authOptions);
  //       return session?.user?.email ?? null;
  return process.env.SUPPORT_OPERATOR_NAME ?? null;
}
