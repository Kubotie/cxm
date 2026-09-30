// ─── GET /api/ops/churn-retrospective ────────────────────────────────────────
//
// 直近解約企業の遡及分析レポートを返す。
// - Package-Churn イベントに対し、解約日 30/60/90 日前のスナップショットで
//   予兆シグナルが出ていたかを集計する。
//
// Query params:
//   ?days=90   遡及対象期間（デフォルト 90 日、最大 365 日）

import { NextRequest, NextResponse } from 'next/server';
import {
  generateChurnRetrospective,
  type ChurnRetrospectiveReport,
} from '@/lib/company/churn-retrospective';
import { requireManagerOrAbove } from '@/lib/auth/guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(
  req: NextRequest,
): Promise<NextResponse<ChurnRetrospectiveReport | { error: string }>> {
  // 運用系エンドポイント。サーバー側でロールを検証する（UI の出し分けは認可ではない）
  const gate = await requireManagerOrAbove();
  if (!gate.ok) return gate.response;

  try {
    const daysParam = req.nextUrl.searchParams.get('days');
    let days = daysParam ? parseInt(daysParam, 10) : 90;
    if (!Number.isFinite(days) || days <= 0) days = 90;
    if (days > 365) days = 365;

    const report = await generateChurnRetrospective(days);
    return NextResponse.json(report, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
