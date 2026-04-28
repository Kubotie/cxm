// ─── POST /api/user/session ───────────────────────────────────────────────────
// ユーザーを選択して Cookie を書き込む。
// Body: { name2: string }  ← staff_identify.name2（Roman/nickname）
//
// ─── DELETE /api/user/session ────────────────────────────────────────────────
// Cookie を削除してセッションをクリアする。

import { NextRequest, NextResponse } from 'next/server';
import { fetchUserProfileByName2 } from '@/lib/nocodb/user-profile';
import {
  buildSetCookieHeader, buildClearCookieHeader,
  buildSetRoleCookieHeader, buildClearRoleCookieHeader,
} from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const name2 = typeof body.name2 === 'string' ? body.name2.trim() : '';

  if (!name2) {
    return NextResponse.json({ error: 'name2 is required' }, { status: 400 });
  }

  const profile = await fetchUserProfileByName2(name2);
  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const res = NextResponse.json(profile);
  res.headers.set('Set-Cookie', buildSetCookieHeader(name2));
  res.headers.append('Set-Cookie', buildSetRoleCookieHeader(profile.role ?? 'csm'));
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', buildClearCookieHeader());
  res.headers.append('Set-Cookie', buildClearRoleCookieHeader());
  return res;
}
