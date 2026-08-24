// ─── POST /api/auth/login ─────────────────────────────────────────────────────
// Body: { email: string; password: string }
//
// パスワードの照合は2段階:
//   1. staff_identify.password_hash が設定済み → **そのハッシュだけで判定**
//      （個別パスワードを設定した人は共有パスワードでは入れない）
//   2. 未設定 → 従来どおり共有パスワード（APP_PASSWORD）
//
// 2 は移行のための経過措置。全員が個別パスワードを設定し終えたら
// APP_PASSWORD を廃止して 1 のみにする。
//
// 成功時は cxm_user_uid / cxm_user_role Cookie をセットして profile を返す。

import { NextRequest, NextResponse } from 'next/server';
import { fetchAllUserProfiles, fetchCredentialByEmail } from '@/lib/nocodb/user-profile';
import { buildSetCookieHeader, buildSetRoleCookieHeader } from '@/lib/auth/session';
import { verifyPassword, hasPasswordHash } from '@/lib/auth/password';

/** 共有パスワード。.env.local の APP_PASSWORD で上書き可能 */
const APP_PASSWORD = process.env.APP_PASSWORD ?? 'ptengine2026';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const email    = typeof body.email    === 'string' ? body.email.trim().toLowerCase()    : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return NextResponse.json({ error: 'email と password は必須です' }, { status: 400 });
  }

  const credential = await fetchCredentialByEmail(email).catch(() => null);

  // 個別パスワード設定済みならハッシュで判定。未設定なら共有パスワード
  const ok = hasPasswordHash(credential?.passwordHash)
    ? await verifyPassword(password, credential!.passwordHash)
    : password === APP_PASSWORD;

  if (!ok) {
    // ユーザーの存在有無を漏らさないため、文言は一本化する
    return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
  }

  const profiles = await fetchAllUserProfiles().catch(() => []);
  const profile = profiles.find(p => p.email?.toLowerCase() === email);

  if (!profile) {
    return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
  }

  const res = NextResponse.json(profile);
  res.headers.set('Set-Cookie', buildSetCookieHeader(profile.name2));
  res.headers.append('Set-Cookie', buildSetRoleCookieHeader(profile.role ?? 'csm'));
  return res;
}
