// ─── GET /api/ptai/me ─────────────────────────────────────────────────────────
// アーティファクトの `window.claude.use('user')` の置き換え。
//   id()      → CXM の name2（feed の by に入る）
//   isOwner() → 契約確定の承認者かどうか（HANDOVER 10-4-5：Utty のみ）
//
// 承認者は PGA_APPROVER_EMAILS（カンマ区切り）で上書きできる。

import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * 既定は staff_identify.name2 が Utty の人。
 * メールで指定したいときは PGA_APPROVER_EMAILS（カンマ区切り）を設定する。
 * 公開リポジトリなので、既定値に個人のメールアドレスは書かない。
 */
const DEFAULT_APPROVER_NAME2 = 'Utty';

function approverEmails(): string[] {
  return (process.env.PGA_APPROVER_EMAILS ?? '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function approverName2(): string {
  return process.env.PGA_APPROVER_NAME2 ?? DEFAULT_APPROVER_NAME2;
}

export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const email  = (profile.email ?? '').toLowerCase();
  const emails = approverEmails();
  const isOwner = emails.length
    ? Boolean(email) && emails.includes(email)
    : profile.name2 === approverName2();

  return NextResponse.json({
    id:      profile.name2,
    name:    profile.name || profile.name2,
    email:   profile.email ?? null,
    isOwner,
  });
}
