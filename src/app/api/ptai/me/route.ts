// ─── GET /api/ptai/me ─────────────────────────────────────────────────────────
// アーティファクトの `window.claude.use('user')` の置き換え。
//   id()      → CXM の name2（feed の by、操作記録の actor に入る）
//   isOwner() → 承認者かどうか（原本の IS_APPROVER）
//
// 承認者の判定は src/lib/ptai/approver.ts に集約している。
// §9-7 の回答（2026-10-01）で **固定ではなくロール**になり、既定は Utty と Kubotie。
// 上書きは PGA_APPROVER_NAME2（カンマ区切り）または PGA_APPROVER_EMAILS。

import { NextResponse } from 'next/server';
import { getPtaiIdentity } from '@/lib/ptai/approver';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await getPtaiIdentity();
  if (!me) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  return NextResponse.json({
    id:    me.id,
    name:  me.name,
    email: me.email,
    /** 原本の `user.isOwner()` が読む名前。中身は「承認者か」 */
    isOwner: me.isApprover,
  });
}
