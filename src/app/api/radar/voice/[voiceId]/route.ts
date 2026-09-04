// ─── POST /api/radar/voice/[voiceId] ──────────────────────────────────────────
//
// LLM が抽出した言質を人がレビューする。
//   confirmed → 次回走査からスコアに入り、critical の根拠になる
//   rejected  → 以後は無視される（誤検知の記録として残す）
//
// **承認するまでスコアに入れない**のが設計の要。言質は重み4で単独 critical に届くため、
// 誤検知をそのまま通すと画面が信用されなくなる。
//
// Body: { status: "confirmed" | "rejected" | "pending" }
//   pending はレビューの取り消し。**誤操作を戻せないと、人はボタンを押さなくなる。**

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';
import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';
import { nocoUpdate } from '@/lib/nocodb/write';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ voiceId: string }> },
): Promise<NextResponse> {
  const tableId = TABLE_IDS.churn_radar_voice;
  if (!tableId) {
    return NextResponse.json({ error: '言質テーブルが未設定です' }, { status: 503 });
  }

  const profile = await getCurrentUserProfile().catch(() => null);
  if (!profile?.name2) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
  }

  const { voiceId } = await params;
  const body = await req.json().catch(() => ({})) as { status?: string };
  const status = body.status;
  if (status !== 'confirmed' && status !== 'rejected' && status !== 'pending') {
    return NextResponse.json(
      { error: 'status は confirmed / rejected / pending のいずれかです' }, { status: 400 },
    );
  }

  const rows = await nocoFetch<{ Id?: number; voice_id?: string }>(tableId, {
    where: `(voice_id,eq,${voiceId})`,
    limit: '1',
  }, false).catch(() => []);

  const row = rows[0];
  if (!row?.Id) {
    return NextResponse.json({ error: '対象の言質が見つかりません' }, { status: 404 });
  }

  const isReset = status === 'pending';
  await nocoUpdate(tableId, row.Id, {
    review_status: status,
    reviewed_by:   isReset ? null : profile.name2,
    reviewed_at:   isReset ? null : new Date().toISOString().slice(0, 19).replace('T', ' '),
  });

  return NextResponse.json({
    status: 'ok', reviewStatus: status, reviewedBy: isReset ? null : profile.name2,
    // 承認しても、スコアに反映されるのは次の走査から。ここで誤解させない
    note: status === 'confirmed' ? '次回の走査からスコアに反映されます'
      : status === 'rejected'    ? '以後この言質は無視されます'
      : 'レビューを取り消しました',
  });
}
