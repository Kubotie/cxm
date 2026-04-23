// ─── ロール管理 ──────────────────────────────────────────────────────────────
//
// Phase 1: NEXT_PUBLIC_APP_ROLE 環境変数でロールを切り替える（開発・デモ用）。
// Phase 2: 将来の認証基盤（NextAuth / Clerk 等）に差し替える。
//
// 利用例:
//   const role = getCurrentRole();
//   if (!canAccess('/ops', role)) return null;

export type AppRole = 'admin' | 'ops' | 'csm' | 'viewer';

const VALID_ROLES: AppRole[] = ['admin', 'ops', 'csm', 'viewer'];

/**
 * 現在のロールを返す。
 * 環境変数 NEXT_PUBLIC_APP_ROLE が未設定または不正値の場合は 'csm' を返す。
 */
export function getCurrentRole(): AppRole {
  const raw = process.env.NEXT_PUBLIC_APP_ROLE as AppRole | undefined;
  if (raw && VALID_ROLES.includes(raw)) return raw;
  return 'csm';
}

/**
 * 指定ルートへのアクセス可否を返す。
 * route は pathname（例: '/ops/policies', '/settings'）。
 */
export function canAccess(route: string, role: AppRole): boolean {
  // Admin は全ルートにアクセス可能
  if (role === 'admin') return true;

  // Ops エリア: admin / ops のみ
  if (route.startsWith('/ops')) return role === 'ops';

  // Settings: admin のみ（ops も不可）
  if (route === '/settings') return false;

  // それ以外: viewer も含めて全ロールが閲覧可能
  return true;
}
