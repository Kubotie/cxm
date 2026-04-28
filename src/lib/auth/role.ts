// ─── ロール管理 ──────────────────────────────────────────────────────────────
//
// ロールは NocoDB の staff_identify.role から取得する（Cookie 経由）。
// 役割割り当て:
//   admin   → 窪田（全機能）
//   manager → 大内（Ops 系を除く全機能）
//   csm     → 一般 CSM（自分担当データのみ）
//   viewer  → 閲覧専用
//
// 利用例:
//   const role = profile.role;
//   if (!canAccess('/ops', role)) return null;

export type AppRole = 'admin' | 'manager' | 'ops' | 'csm' | 'viewer';

export const VALID_ROLES: AppRole[] = ['admin', 'manager', 'ops', 'csm', 'viewer'];

/**
 * 指定ルートへのアクセス可否を返す。
 * route は pathname（例: '/ops/policies', '/settings'）。
 */
export function canAccess(route: string, role: AppRole): boolean {
  // Admin は全ルートにアクセス可能
  if (role === 'admin') return true;

  // Manager: Ops の運用系（バッチ・ログ・SF データ）を除く全ルート
  if (role === 'manager') {
    const opsOnlyRoutes = [
      '/ops/company-summary',
      '/ops/company-mutation-logs',
      '/ops/salesforce',
      '/ops/sf-data-prep',
    ];
    if (opsOnlyRoutes.some(r => route.startsWith(r))) return false;
    return true;
  }

  // AI Control は admin のみ
  if (route.startsWith('/ops/ai')) return false;

  // その他の Ops エリア: admin / ops のみ
  if (route.startsWith('/ops')) return role === 'ops';

  // Settings: 全ロールがアクセス可能
  if (route === '/settings') return true;

  // それ以外: viewer も含めて全ロールが閲覧可能
  return true;
}
