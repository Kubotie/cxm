// ─── Next.js Middleware ────────────────────────────────────────────────────────
//
// 署名付きセッション Cookie（cxm_session）を検証し、未認証を弾く。
//
// ── 2026-09-30 セキュリティ是正での変更 ──────────────────────────────────────
//   旧: `if (pathname.startsWith('/api/')) return NextResponse.next();`
//       → 146 本の API のうち 92 本が認可を持たず、未認証で顧客データを返していた
//   新: API も既定でセッション必須。通すのは下の allowlist に明記したものだけ。
//       API の未認証応答は HTML リダイレクトではなく **JSON の 401** を返す
//       （fetch が HTML を受け取って壊れるのを防ぐ）。
//
// ── 多層防御 ─────────────────────────────────────────────────────────────────
//   ここは「ログインしているか」しか見ない。
//   「その操作をしてよいか」は各ハンドラで src/lib/auth/guard.ts を使って判定する。

import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { verifySession } from '@/lib/auth/session-token';

/**
 * Cookie セッションを要求しない API。
 * ここに載せるものは **ハンドラ側で必ず別の認証を持つこと**。
 *
 *   /api/auth/*   ログイン・ログアウト（認証の入口。Cookie がまだ無い）
 *   /api/batch/*  Vercel Cron と外部バッチ。Authorization: Bearer を
 *                 checkCronOrBatchAuth / checkBatchAuth で照合する
 *                 （全 19 本に実装済みであることを確認済み）。
 *                 画面から呼ぶものは requireBatchTokenOrOps でセッションも受ける。
 *
 * ワイルドカードは前方一致。新しい公開 API を足すときは
 * 「なぜ Cookie 不要か」「代わりに何で認証するか」をここに書くこと。
 */
const API_ALLOWLIST: readonly string[] = [
  '/api/auth/',
  '/api/batch/',
];

/** 未ログインでも開けるページ */
const PUBLIC_PAGES: readonly string[] = [
  '/login',
];

function isAllowlistedApi(pathname: string): boolean {
  return API_ALLOWLIST.some(prefix => pathname.startsWith(prefix));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySession(token);

  // ── API ────────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    if (isAllowlistedApi(pathname)) return NextResponse.next();
    if (session.ok) return NextResponse.next();

    // リダイレクトしない。fetch() が HTML を受け取らないよう JSON で返す
    return NextResponse.json(
      { error: 'unauthenticated', message: 'ログインが必要です' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // ── ページ ─────────────────────────────────────────────────────────────────
  if (PUBLIC_PAGES.some(p => pathname.startsWith(p))) {
    // ログイン済みならプロダクト選択へ
    if (session.ok) return NextResponse.redirect(new URL('/apps', req.url));
    return NextResponse.next();
  }

  if (!session.ok) {
    const url = new URL('/login', req.url);
    const res = NextResponse.redirect(url);
    // 期限切れ・改ざん・旧形式の平文 Cookie が残っている場合は消す
    if (token) res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 以下を除くすべてのリクエストにマッチ:
     * - _next/static（静的ファイル）
     * - _next/image（画像最適化）
     * - favicon.ico
     *
     * public/ 配下（/ptai-pipeline/board.js など）も通るので、
     * 顧客データを含む静的ファイルもここで保護される。
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
