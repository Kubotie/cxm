// ─── 週次解約分析レポート生成の共有ロジック ─────────────────────────────────
//
// バッチ (Vercel Cron / DolphinScheduler) と UI からの手動再生成 (/api/ops/*)
// の両方から呼ばれる本体。認証と HTTP 応答は呼び出し側が担う。

import { randomUUID } from 'crypto';
import { generateChurnRetrospective } from './churn-retrospective';
import { generateChurnAiReport } from './churn-report-ai';
import { insertChurnReport } from '@/lib/nocodb/churn-reports';
import { fetchLatestChronicSilentSnapshot } from '@/lib/nocodb/chronic-silent';
import { writeBatchRunLog, sanitizeRequestParams } from '@/lib/batch/logger';

export interface RunWeeklyReportResult {
  reportId: string;
  status:   'ok' | 'failed';
  message?: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekBounds(today: Date): { start: string; end: string } {
  const end   = new Date(today);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 6);
  return { start: isoDate(start), end: isoDate(end) };
}

/**
 * 週次解約分析レポートを生成し、churn_retrospective_reports に保存する。
 * @param dryRun     true なら NocoDB に書かず結果だけ返す
 * @param windowDays 遡及日数（デフォルト 90）
 * @param sourceQueue 監査ログに書く呼び出し元識別子（"weekly-cron" / "manual-ui" 等）
 */
export async function runWeeklyReport(
  dryRun:      boolean,
  windowDays:  number,
  sourceQueue: string = 'weekly-cron',
): Promise<RunWeeklyReportResult> {
  const startedAt = new Date();
  const reportId  = `churn-${startedAt.toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8)}`;
  console.log(`[churn-report-run] 開始 reportId=${reportId} dry_run=${dryRun} source=${sourceQueue}`);

  const report = await generateChurnRetrospective(windowDays).catch(err => {
    console.error('[churn-report-run] retrospective 失敗:', err);
    return null;
  });
  if (!report) {
    return { reportId, status: 'failed', message: 'retrospective generation failed' };
  }
  console.log(
    `[churn-report-run] retrospective 完了 churn=${report.churnEvents.total} ` +
    `warning=${report.aggregate.metabase.warningCount}`,
  );

  const silentSnapshot = await fetchLatestChronicSilentSnapshot('JP').catch(err => {
    console.warn('[churn-report-run] 休眠スナップショット取得失敗（注入スキップ）:', err);
    return null;
  });
  if (silentSnapshot) {
    console.log(
      `[churn-report-run] 休眠スナップショット注入 ref=${silentSnapshot.refMonth} ` +
      `accounts=${silentSnapshot.items.length}`,
    );
  }

  const ai = await generateChurnAiReport(report, silentSnapshot).catch(err => {
    console.error('[churn-report-run] AI サマリー生成失敗:', err);
    return null;
  });
  if (!ai) {
    return { reportId, status: 'failed', message: 'AI summary generation failed' };
  }
  console.log(`[churn-report-run] AI サマリー生成完了 model=${ai.modelUsed}`);

  const bounds = weekBounds(startedAt);
  const warningTotal =
    report.aggregate.metabase.warningCount +
    report.aggregate.firstWarningAtD90 +
    report.aggregate.firstWarningAtD60 +
    report.aggregate.firstWarningAtD30;
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
      source_queue:    sourceQueue,
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
