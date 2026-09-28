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
// 保存先は companies の4列。**レーダー未収録（Tier3 など）の企業にも立てられる**
// ようにするためで、走査結果の churn_radar_state には置かない（§8.11）。
//
// GET  ?companyUid=...   … 1社ぶんを読む（企業詳細ページが使う）
// POST Body:
//   { companyUid: string, effectiveDate?: string|null, note?: string|null }  … 報告する
//   { companyUid: string, cancel: true }                                     … 取り消す

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';
import { saveChurnReport, fetchChurnReport } from '@/lib/churn/churn-report';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const companyUid = req.nextUrl.searchParams.get('companyUid')?.trim();
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が必要です' }, { status: 400 });
  }
  return NextResponse.json({ churnReport: await fetchChurnReport(companyUid) });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  const saved = await saveChurnReport(
    companyUid,
    body.cancel ? null : { by: profile.name2, effectiveDate, note: body.note?.trim() || null },
  );
  if (saved === false) {
    return NextResponse.json({ error: 'この企業が companies に見つかりません' }, { status: 404 });
  }

  return NextResponse.json({ status: 'ok', churnReport: saved });
}
