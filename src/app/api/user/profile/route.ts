// ─── GET /api/user/profile ────────────────────────────────────────────────────
// Cookie から現在ログイン中のユーザープロファイルを返す。
// Cookie 未設定の場合は 404。
//
// ─── PATCH /api/user/profile ─────────────────────────────────────────────────
// 現在のユーザーのプロファイル設定を更新する。
// Body: { role?, team?, default_home_scope?, preferred_summary_policy_id?, focus_areas? }

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';
import { fetchUserProfileByName2, updateUserProfile } from '@/lib/nocodb/user-profile';
import type { UserProfilePatch } from '@/lib/nocodb/user-profile';

export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: 'No active session' }, { status: 404 });
  }
  return NextResponse.json(profile);
}

export async function PATCH(req: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!profile || profile.Id == null) {
    return NextResponse.json({ error: 'No active session' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const patch: UserProfilePatch = {};

  // role は変更不可（NocoDB の設定を source of truth とする）
  if (body.team                        !== undefined) patch.team                        = body.team as string | null;
  if (body.default_home_scope          !== undefined) patch.default_home_scope          = body.default_home_scope as UserProfilePatch['default_home_scope'];
  if (body.preferred_summary_policy_id !== undefined) patch.preferred_summary_policy_id = body.preferred_summary_policy_id as string | null;
  if (body.focus_areas                 !== undefined) patch.focus_areas                 = body.focus_areas as string[];

  await updateUserProfile(profile.Id, patch);

  const updated = await fetchUserProfileByName2(profile.name2);
  return NextResponse.json(updated ?? profile);
}
