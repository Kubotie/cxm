// ─── GET /api/ops/churn-reports/[reportId] ────────────────────────────────────
//
// 週次解約分析レポートの詳細（AI サマリー + 生 report_json）を返す。

import { NextRequest, NextResponse } from 'next/server';
import { fetchChurnReportById } from '@/lib/nocodb/churn-reports';
import type { ChurnRetrospectiveReport } from '@/lib/company/churn-retrospective';
import {
  fetchLatestChronicSilentSnapshot,
  buildSilentSfIdMap,
  computeSilentChurnOverlap,
  type SilentChurnOverlap,
} from '@/lib/nocodb/chronic-silent';

export const dynamic = 'force-dynamic';

export interface ChurnReportDetail {
  reportId:        string;
  weekStart:       string;
  weekEnd:         string;
  windowDays:      number;
  churnTotal:      number;
  warningTotal:    number;
  warningRate:     number;
  aiSummary:       string;
  aiKeyFindings:   string[];
  aiRecommendations: string[];
  report:          ChurnRetrospectiveReport | null;
  generatedAt:     string;
  modelUsed:       string;
  // ── Ptengine 休眠（chronic silent）enrichment ──────────────────────────────
  silentRefMonth:      string | null;   // 休眠スナップショットの基準月（無ければ null）
  silentSfAccountIds:  string[];        // 休眠アカウントの sf_account_id 一覧（UI バッジ判定用）
  silentOverlap:       SilentChurnOverlap | null;  // 解約 × 休眠 の突合サマリ
}

function safeParseArr(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function safeParseReport(raw: string | null | undefined): ChurnRetrospectiveReport | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ChurnRetrospectiveReport;
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
): Promise<NextResponse<ChurnReportDetail | { error: string }>> {
  try {
    const { reportId } = await params;
    const row = await fetchChurnReportById(reportId);
    if (!row) {
      return NextResponse.json({ error: 'report not found' }, { status: 404 });
    }

    const report = safeParseReport(row.report_json);

    // ── 休眠 enrichment: 最新スナップショットと突合（失敗しても本体は返す）──────
    const silentSnapshot = await fetchLatestChronicSilentSnapshot('JP').catch(() => null);
    const silentMap = buildSilentSfIdMap(silentSnapshot);
    const silentOverlap = report
      ? computeSilentChurnOverlap(
          silentSnapshot,
          report.perCompany.map(c => ({
            sfAccountId:        c.sfAccountId,
            canonicalName:      c.canonicalName,
            churnDate:          c.churnDate,
            metabaseHasWarning: c.metabase.hasWarning,
          })),
        )
      : null;

    return NextResponse.json({
      reportId:          row.report_id,
      weekStart:         row.week_start,
      weekEnd:           row.week_end,
      windowDays:        Number(row.window_days ?? 0),
      churnTotal:        Number(row.churn_total ?? 0),
      warningTotal:      Number(row.warning_total ?? 0),
      warningRate:       Number(row.warning_rate ?? 0),
      aiSummary:         row.ai_summary ?? '',
      aiKeyFindings:     safeParseArr(row.ai_key_findings),
      aiRecommendations: safeParseArr(row.ai_recommendations),
      report,
      generatedAt:       row.generated_at,
      modelUsed:         row.model_used ?? '',
      silentRefMonth:     silentSnapshot?.refMonth ?? null,
      silentSfAccountIds: Array.from(silentMap.keys()),
      silentOverlap,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
