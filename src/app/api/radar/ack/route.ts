// ─── POST /api/radar/ack ──────────────────────────────────────────────────────
//
// 解約レーダーのカードに対する確認操作を保存する。
//   見た / 対応中 / 様子見 / 誤検知
//
// 「誤検知」は閾値チューニングの教師データになるので、押しやすい場所に置いてある。
// 操作は churn_radar_events にも残す（誰がいつ確認したかを追えないと、また放置が起きる）。
//
// Body: { companyUid: string, status: AckStatus, note?: string }

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';
import { saveRadarAck, radarTablesReady, ACK_LABEL, type AckStatus } from '@/lib/churn/radar-state';

export const dynamic = 'force-dynamic';

const VALID: AckStatus[] = ['none', 'ack', 'working', 'watching', 'dismissed'];

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!radarTablesReady()) {
    return NextResponse.json({ error: 'レーダーのテーブルが未設定です' }, { status: 503 });
  }

  const profile = await getCurrentUserProfile().catch(() => null);
  if (!profile?.name2) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    companyUid?: string; status?: string; note?: string;
  };
  const companyUid = body.companyUid?.trim();
  const status     = body.status as AckStatus | undefined;

  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が必要です' }, { status: 400 });
  }
  if (!status || !VALID.includes(status)) {
    return NextResponse.json(
      { error: `status は ${VALID.join(' / ')} のいずれかです` }, { status: 400 },
    );
  }

  const ok = await saveRadarAck(companyUid, {
    status, by: profile.name2, note: body.note?.trim() || null,
  });
  if (!ok) {
    return NextResponse.json(
      { error: 'この企業の走査結果がまだありません' }, { status: 404 },
    );
  }

  return NextResponse.json({ status: 'ok', ackStatus: status, label: ACK_LABEL[status], by: profile.name2 });
}
