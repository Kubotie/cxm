// ─── Next.js Middleware ────────────────────────────────────────────────────────
// 認証 Cookie（cxm_user_uid）が未設定の場合は /login にリダイレクトする。
// /login と /api/auth/* は常に通過させる。

import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/auth/session';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API ルートはリダイレクトしない（fetch() が HTML を受け取るのを防ぐ）
  // 各 API ハンドラが 401/404 を返す
  if (pathname.startsWith('/api/')) return NextResponse.next();

  // ログイン画面は常に通過
  if (pathname.startsWith('/login')) {
    // すでにログイン済みなら / にリダイレクト
    const uid = req.cookies.get(COOKIE_NAME)?.value;
    if (uid) return NextResponse.redirect(new URL('/', req.url));
    return NextResponse.next();
  }

  // ページリクエスト: Cookie 未設定なら /login へ
  const uid = req.cookies.get(COOKIE_NAME)?.value;
  if (!uid) return NextResponse.redirect(new URL('/login', req.url));

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 以下を除くすべてのリクエストにマッチ:
     * - _next/static（静的ファイル）
     * - _next/image（画像最適化）
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
