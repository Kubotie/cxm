// ─── GET /api/users ───────────────────────────────────────────────────────────
// 全ユーザープロファイルを返す（設定 UI のドロップダウン用）。

import { NextResponse } from 'next/server';
import { fetchAllUserProfiles } from '@/lib/nocodb/user-profile';

export async function GET() {
  const profiles = await fetchAllUserProfiles().catch(() => []);
  return NextResponse.json(profiles);
}
