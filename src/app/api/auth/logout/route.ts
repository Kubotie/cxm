// ─── POST /api/auth/logout ────────────────────────────────────────────────────
// セッション Cookie と、是正前の平文 Cookie をまとめて削除する。

import { NextResponse } from 'next/server';
import { buildClearSessionCookieHeader, buildClearLegacyCookieHeaders } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', buildClearSessionCookieHeader());
  for (const clear of buildClearLegacyCookieHeaders()) res.headers.append('Set-Cookie', clear);
  return res;
}
