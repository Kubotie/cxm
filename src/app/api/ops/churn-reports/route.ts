// ─── GET /api/ops/churn-reports ───────────────────────────────────────────────
//
// 週次解約分析レポートの一覧を返す（新しい順）。UI サイドバーで使う軽量なメタ情報のみ。

import { NextRequest, NextResponse } from 'next/server';
import { fetchChurnReports, type ChurnReportRow } from '@/lib/nocodb/churn-reports';

export const dynamic = 'force-dynamic';

export interface ChurnReportListItem {
  reportId:     string;
  weekStart:    string;
  weekEnd:      string;
  windowDays:   number;
  churnTotal:   number;
  warningTotal: number;
  warningRate:  number;
  summary:      string;
  generatedAt:  string;
  modelUsed:    string;
}

function toItem(r: ChurnReportRow): ChurnReportListItem {
  return {
    reportId:     r.report_id,
    weekStart:    r.week_start,
    weekEnd:      r.week_end,
    windowDays:   Number(r.window_days ?? 0),
    churnTotal:   Number(r.churn_total ?? 0),
    warningTotal: Number(r.warning_total ?? 0),
    warningRate:  Number(r.warning_rate ?? 0),
    summary:      r.ai_summary ?? '',
    generatedAt:  r.generated_at,
    modelUsed:    r.model_used ?? '',
  };
}

export async function GET(
  req: NextRequest,
): Promise<NextResponse<{ items: ChurnReportListItem[] } | { error: string }>> {
  try {
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10) || 50, 200);
    const rows  = await fetchChurnReports(limit);
    return NextResponse.json({ items: rows.map(toItem) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
