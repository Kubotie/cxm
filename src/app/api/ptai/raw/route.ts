// ─── GET /api/ptai/raw ────────────────────────────────────────────────────────
//
// 原本 1353 行の `const RAW = {...}`（Twenty + Notion + repo のスナップショット）。
// 顧客名・MRR・議事録を含むので public/ には置かず、ログイン必須のこの経路で返す。
// Phase 2 でここを「Twenty から実行時に取得してキャッシュ」に差し替える。

import { NextResponse } from 'next/server';
import { getUserUidFromCookie } from '@/lib/auth/session';
import { getRawSnapshot, isPgaStoreConfigured } from '@/lib/ptai/store';

export const dynamic = 'force-dynamic';

/** スナップショットは動かないので、プロセス内で持ち回す */
let cached: string | null = null;

export async function GET() {
  if (!(await getUserUidFromCookie())) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!isPgaStoreConfigured()) {
    return NextResponse.json({ error: 'store_not_configured' }, { status: 503 });
  }

  if (!cached) cached = await getRawSnapshot();
  if (!cached) {
    return NextResponse.json(
      { error: 'raw_not_seeded', hint: 'node scripts/ptai-seed-raw.mjs <pga-pipeline-board.html>' },
      { status: 503 },
    );
  }

  return new NextResponse(cached, {
    headers: {
      'Content-Type':  'application/json; charset=utf-8',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
