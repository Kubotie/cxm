// ─── POST /api/auth/login ─────────────────────────────────────────────────────
// Body: { email: string; password: string }
//
// 共有パスワード（APP_PASSWORD）と照合してログインする。
// 成功時は cxm_user_uid / cxm_user_role Cookie をセットして profile を返す。

import { NextRequest, NextResponse } from 'next/server';
import { fetchAllUserProfiles } from '@/lib/nocodb/user-profile';
import { buildSetCookieHeader, buildSetRoleCookieHeader } from '@/lib/auth/session';

/** 共有パスワード。.env.local の APP_PASSWORD で上書き可能 */
const APP_PASSWORD = process.env.APP_PASSWORD ?? 'ptengine2026';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const email    = typeof body.email    === 'string' ? body.email.trim().toLowerCase()    : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return NextResponse.json({ error: 'email と password は必須です' }, { status: 400 });
  }

  if (password !== APP_PASSWORD) {
    return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 });
  }

  const profiles = await fetchAllUserProfiles().catch(() => []);
  const profile = profiles.find(p => p.email?.toLowerCase() === email);

  if (!profile) {
    return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
  }

  const res = NextResponse.json(profile);
  res.headers.set('Set-Cookie', buildSetCookieHeader(profile.name2));
  res.headers.append('Set-Cookie', buildSetRoleCookieHeader(profile.role ?? 'csm'));
  return res;
}
