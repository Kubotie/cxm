// ─── POST /api/auth/logout ────────────────────────────────────────────────────
// Cookie を削除してログアウト状態にする。

import { NextResponse } from 'next/server';
import { buildClearCookieHeader, buildClearRoleCookieHeader } from '@/lib/auth/session';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', buildClearCookieHeader());
  res.headers.append('Set-Cookie', buildClearRoleCookieHeader());
  return res;
}
