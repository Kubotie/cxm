// ─── POST /api/radar/churn-report ─────────────────────────────────────────────
//
// 解約の報告を受けた顧客にフラグを立てる／取り消す。
//
// **予兆の検知と、確定した解約は別物。** 解約が決まった顧客が「今週やる」に並び続けると、
// まだ手を打てる顧客がその下に埋もれる。かといって行ごと消すと、
// 「なぜ消えたのか」「いつ解約なのか」が追えなくなる。
// そこでフラグだけ立て、リストの既定の絞り込みから外す（記録と行は残す）。
//
// 判定スコアには一切触らない。レーダーの精度検証（/v2/radar/accuracy）は
// 「点灯していたか」を後から答え合わせするので、スコアを人が動かすと検証が壊れる。
//
// Body:
//   { companyUid: string, effectiveDate?: string|null, note?: string|null }  … 報告する
//   { companyUid: string, cancel: true }                                     … 取り消す

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';
import { saveChurnReport, radarTablesReady } from '@/lib/churn/radar-state';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!radarTablesReady()) {
    return NextResponse.json({ error: 'レーダーのテーブルが未設定です' }, { status: 503 });
  }

  const profile = await getCurrentUserProfile().catch(() => null);
  if (!profile?.name2) {
    return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    companyUid?: string; effectiveDate?: string | null; note?: string | null; cancel?: boolean;
  };
  const companyUid = body.companyUid?.trim();
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が必要です' }, { status: 400 });
  }

  const effectiveDate = body.effectiveDate?.trim() || null;
  if (effectiveDate && !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    return NextResponse.json({ error: '解約日は YYYY-MM-DD で指定してください' }, { status: 400 });
  }

  const ok = await saveChurnReport(
    companyUid,
    body.cancel ? null : { by: profile.name2, effectiveDate, note: body.note?.trim() || null },
  );
  if (!ok) {
    return NextResponse.json({ error: 'この企業の走査結果がまだありません' }, { status: 404 });
  }

  if (body.cancel) {
    return NextResponse.json({ status: 'ok', churnReport: null });
  }
  return NextResponse.json({
    status: 'ok',
    churnReport: {
      reportedAt:    new Date().toISOString().slice(0, 10),
      reportedBy:    profile.name2,
      effectiveDate,
      note:          body.note?.trim() || null,
    },
  });
}
