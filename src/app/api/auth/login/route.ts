// ─── POST /api/auth/login ─────────────────────────────────────────────────────
// Body: { email: string; password: string }
//
// パスワードの照合は2段階:
//   1. staff_identify.password_hash が設定済み → **そのハッシュだけで判定**
//      （個別パスワードを設定した人は共有パスワードでは入れない）
//   2. 未設定 → 共有パスワード（環境変数 APP_PASSWORD）
//
// 2 は移行のための経過措置。全員が個別パスワードを設定し終えたら
// APP_PASSWORD を廃止して 1 のみにする。
//
// ── 2026-09-30 セキュリティ是正 ──────────────────────────────────────────────
//   旧実装はソースに共有パスワードの既定値を直書きしていた（public リポジトリ）。
//   既定値は撤去した。APP_PASSWORD が未設定なら共有パスワード経路は**成立させない**。
//   秘密値はレスポンスにもログにも出さない。
//
// 成功時は署名付きの cxm_session Cookie をセットし、旧平文 Cookie を削除する。

import { NextRequest, NextResponse } from 'next/server';
import { fetchAllUserProfiles, fetchCredentialByEmail } from '@/lib/nocodb/user-profile';
import {
  buildSessionCookieHeader, buildClearLegacyCookieHeaders,
} from '@/lib/auth/session';
import { isSessionSecretConfigured } from '@/lib/auth/session-token';
import { verifyPassword, hasPasswordHash } from '@/lib/auth/password';

export const dynamic = 'force-dynamic';

/** ユーザーの存在有無を漏らさないため、失敗時の文言は一本化する */
const GENERIC_FAILURE = 'メールアドレスまたはパスワードが違います';

/** 設定不備。秘密値は含めない */
function misconfigured(what: string) {
  console.error(`[auth/login] 設定不備のためログインを拒否しました: ${what} が未設定です`);
  return NextResponse.json(
    { error: 'service_unavailable', message: 'ログインを一時的に受け付けられません。管理者に連絡してください。' },
    { status: 503 },
  );
}

export async function POST(req: NextRequest) {
  // 署名鍵が無いとセッションを発行できない。ここで止める（平文にフォールバックしない）
  if (!isSessionSecretConfigured()) return misconfigured('CXM_SESSION_SECRET');

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const email    = typeof body.email    === 'string' ? body.email.trim().toLowerCase()    : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return NextResponse.json({ error: 'email と password は必須です' }, { status: 400 });
  }

  const credential = await fetchCredentialByEmail(email).catch(() => null);

  let ok = false;
  if (hasPasswordHash(credential?.passwordHash)) {
    // 個別パスワード設定済み。APP_PASSWORD の有無に関わらずこの経路で判定する
    ok = await verifyPassword(password, credential!.passwordHash);
  } else {
    // 共有パスワード経路。既定値は持たない
    const shared = process.env.APP_PASSWORD;
    if (!shared) return misconfigured('APP_PASSWORD');
    ok = password === shared;
  }

  if (!ok) return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });

  const profiles = await fetchAllUserProfiles().catch(() => []);
  const profile = profiles.find(p => p.email?.toLowerCase() === email);
  if (!profile) return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });

  const sessionCookie = await buildSessionCookieHeader(profile.name2);
  if (!sessionCookie) return misconfigured('CXM_SESSION_SECRET');

  const res = NextResponse.json(profile);
  res.headers.set('Set-Cookie', sessionCookie);
  // 是正前に発行された平文 Cookie がブラウザに残っているので消す
  for (const clear of buildClearLegacyCookieHeaders()) res.headers.append('Set-Cookie', clear);
  return res;
}
