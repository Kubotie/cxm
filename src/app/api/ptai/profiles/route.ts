// ─── POST /api/ptai/profiles ──────────────────────────────────────────────────
// `user.profiles(ids)` の置き換え。name2 の配列 → { name2: { name } }。
// 新着・更新フィードの「誰が変えたか」表示にだけ使う。

import { NextRequest, NextResponse } from 'next/server';
import { getUserUidFromCookie } from '@/lib/auth/session';
import { fetchAllUserProfiles } from '@/lib/nocodb/user-profile';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!(await getUserUidFromCookie())) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter(x => typeof x === 'string') as string[] : [];
  if (!ids.length) return NextResponse.json({});

  const all = await fetchAllUserProfiles().catch(() => []);
  const out: Record<string, { name: string }> = {};
  for (const id of ids) {
    // 該当が無いとき（アーティファクト時代の claude.ai ユーザー ID など）は空文字。
    // 原本は ps[by]?.name を出すだけなので、空なら「誰が」の欄が消えるだけで済む。
    const p = all.find(x => x.name2 === id);
    out[id] = { name: p?.name ?? '' };
  }
  return NextResponse.json(out);
}
