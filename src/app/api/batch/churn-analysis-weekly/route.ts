// ─── POST /api/batch/churn-analysis-weekly ────────────────────────────────────
//
// 週次で解約遡及分析 + AI サマリーを生成し churn_retrospective_reports に保存する。
//
// ── 動作 ─────────────────────────────────────────────────────────────────────
//   1. generateChurnRetrospective(90) で過去90日の遡及分析を実行
//   2. generateChurnAiReport() で AI サマリーを生成 (Claude via OpenRouter)
//   3. NocoDB churn_retrospective_reports に upsert
//
// ── スケジュール ─────────────────────────────────────────────────────────────
//   Vercel Cron: 毎週月曜 04:00 JST（日曜 19:00 UTC）

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { checkCronOrBatchAuth } from '@/lib/batch/auth';
import { writeBatchRunLog, sanitizeRequestParams } from '@/lib/batch/logger';
import { generateChurnRetrospective } from '@/lib/company/churn-retrospective';
import { generateChurnAiReport } from '@/lib/company/churn-report-ai';
import { insertChurnReport } from '@/lib/nocodb/churn-reports';
import { randomUUID } from 'crypto';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface RequestBody {
  dry_run?:    boolean;
  window_days?: number;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekBounds(today: Date): { start: string; end: string } {
  // 週の終わり = 今日、週の始まり = 6日前 (直近7日ぶんの週次レポート)
  const end   = new Date(today);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 6);
  return { start: isoDate(start), end: isoDate(end) };
}

async function runWeeklyReport(dryRun: boolean, windowDays: number): Promise<{
  reportId: string;
  status: 'ok' | 'skipped' | 'failed';
  message?: string;
}> {
  const startedAt = new Date();
  const reportId  = `churn-${startedAt.toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8)}`;
  console.log(`[batch/churn-analysis-weekly] 開始 reportId=${reportId} dry_run=${dryRun}`);

  // Step 1: 遡及分析
  const report = await generateChurnRetrospective(windowDays).catch(err => {
    console.error('[batch/churn-analysis-weekly] retrospective 失敗:', err);
    return null;
  });
  if (!report) {
    return { reportId, status: 'failed', message: 'retrospective generation failed' };
  }
  console.log(
    `[batch/churn-analysis-weekly] retrospective 完了 churn=${report.churnEvents.total} ` +
    `warning=${report.aggregate.metabase.warningCount}`,
  );

  // Step 2: AI サマリー
  const ai = await generateChurnAiReport(report).catch(err => {
    console.error('[batch/churn-analysis-weekly] AI サマリー生成失敗:', err);
    return null;
  });
  if (!ai) {
    return { reportId, status: 'failed', message: 'AI summary generation failed' };
  }
  console.log(`[batch/churn-analysis-weekly] AI サマリー生成完了 model=${ai.modelUsed}`);

  // Step 3: 保存
  const bounds = weekBounds(startedAt);
  const warningTotal = report.aggregate.metabase.warningCount + report.aggregate.firstWarningAtD90 + report.aggregate.firstWarningAtD60 + report.aggregate.firstWarningAtD30;
  const denom = report.churnEvents.total || 1;
  const warningRate = warningTotal / denom;

  if (!dryRun) {
    await insertChurnReport({
      report_id:          reportId,
      week_start:         bounds.start,
      week_end:           bounds.end,
      window_days:        windowDays,
      churn_total:        report.churnEvents.total,
      warning_total:      warningTotal,
      warning_rate:       warningRate,
      ai_summary:         ai.summary,
      ai_key_findings:    JSON.stringify(ai.keyFindings),
      ai_recommendations: JSON.stringify(ai.recommendations),
      report_json:        JSON.stringify(report),
      generated_at:       startedAt.toISOString(),
      model_used:         ai.modelUsed,
    });

    const finishedAt = new Date();
    await writeBatchRunLog({
      endpoint:        '/api/batch/churn-analysis-weekly',
      batch_type:      'churn-analysis-weekly',
      started_at:      startedAt.toISOString(),
      finished_at:     finishedAt.toISOString(),
      duration_ms:     finishedAt.getTime() - startedAt.getTime(),
      dry_run:         false,
      source_queue:    'weekly-cron',
      request_params:  sanitizeRequestParams({ window_days: windowDays }),
      filters:         '{}',
      total_targeted:  report.churnEvents.total,
      ok_count:        1,
      success_count:   1,
      partial_count:   0,
      failed_count:    0,
      skipped_count:   0,
      failure_details: '[]',
      result_json:     JSON.stringify({ report_id: reportId, warning_total: warningTotal }),
    }).catch(() => {});
  }

  return { reportId, status: 'ok' };
}

export async function POST(req: NextRequest) {
  const authError = checkCronOrBatchAuth(req);
  if (authError) return authError;

  const body: RequestBody = await req.json().catch(() => ({}));
  const dryRun     = body.dry_run     ?? false;
  const windowDays = body.window_days ?? 90;

  if (dryRun) {
    try {
      const result = await runWeeklyReport(true, windowDays);
      return NextResponse.json({ status: 'ok', dry_run: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  after(() => runWeeklyReport(false, windowDays).catch(err =>
    console.error('[batch/churn-analysis-weekly] background 例外:', err),
  ));

  return NextResponse.json({
    status:  'accepted',
    message: 'バックグラウンドで週次解約分析を開始しました。完了は Vercel ログで確認してください。',
  });
}

// Vercel Cron からの GET
export async function GET(req: NextRequest) {
  const authError = checkCronOrBatchAuth(req);
  if (authError) return authError;

  after(() => runWeeklyReport(false, 90).catch(err =>
    console.error('[batch/churn-analysis-weekly] background 例外:', err),
  ));

  return NextResponse.json({
    status:  'accepted',
    message: 'Vercel Cron 起動: 週次解約分析をバックグラウンドで開始しました。',
  });
}
