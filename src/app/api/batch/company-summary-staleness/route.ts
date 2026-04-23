// ─── POST /api/batch/company-summary-staleness ────────────────────────────────
//
// Summary Policy の on_staleness トリガーに対応するバッチエンドポイント。
// last_ai_updated_at が N 日以上前（または未生成）の企業を対象に
// Company Summary を自動再生成・保存する。
//
// ── 認証 ─────────────────────────────────────────────────────────────────────
//   checkCronOrBatchAuth による二重認証。
//   - Vercel Cron: CRON_SECRET が設定されていれば自動で Bearer ヘッダーが付与される
//   - 手動 ops:   SUPPORT_BATCH_SECRET を Authorization: Bearer に設定すること
//
// ── cron 設定例（vercel.json）────────────────────────────────────────────────
//   {
//     "crons": [{
//       "path": "/api/batch/company-summary-staleness",
//       "schedule": "0 2 * * *"   // 毎日 02:00 UTC
//     }]
//   }
//   ※ Cron リクエストには Authorization ヘッダーが自動付与されないため、
//      SUPPORT_BATCH_SECRET を未設定にする or 専用 CRON_SECRET を追加実装すること。
//
// ── リクエストボディ ─────────────────────────────────────────────────────────
// {
//   policy_id?:        string    (全社に適用する Summary Policy)
//   company_uids?:     string[]  (省略 = 全 CSM 管理企業)
//   dry_run?:          boolean   (default: false)
//   limit?:            number    (default: 20, max: 100)
//   stale_after_days?: number    (省略 → policy.freshness_rule.stale_after_days → 30)
// }
//
// ── レスポンス ────────────────────────────────────────────────────────────────
// {
//   dry_run:          boolean,
//   evaluated_at:     ISO8601,
//   stale_after_days: number,
//   total_targeted:   number,
//   generated_count:  number,
//   skipped_count:    number,
//   failed_count:     number,
//   results:          StalenessRunnerResultItem[],
// }
//
// ── イベント起因との使い分け / 将来の queue 化 ─────────────────────────────────
// このエンドポイントは「時間経過 → stale」の時間起因バッチ。
// Evidence 追加など単一イベントで即時再生成する場合は
//   POST /api/batch/company-summary-event → triggerSummaryRefreshForCompany() を使うこと。
// 将来 queue を導入する際の差し替え点は
//   src/lib/summary/event-trigger.ts の triggerSummaryRefreshForCompany() 本体。

import { NextRequest, NextResponse }    from 'next/server';
import { checkCronOrBatchAuth }          from '@/lib/batch/auth';
import { writeBatchRunLog, sanitizeRequestParams } from '@/lib/batch/logger';
import { runStalenessRunner }           from '@/lib/summary/staleness-runner';

interface RequestBody {
  policy_id?:        string;
  company_uids?:     string[];
  dry_run?:          boolean;
  limit?:            number;
  stale_after_days?: number;
}

export async function POST(req: NextRequest) {
  // ── 認証（Vercel Cron + 手動 ops 両対応）────────────────────────────────
  const authError = checkCronOrBatchAuth(req);
  if (authError) return authError;

  const startedAt = new Date();
  const body: RequestBody = await req.json().catch(() => ({}));

  try {
    const result = await runStalenessRunner({
      policy_id:        body.policy_id,
      company_uids:     body.company_uids,
      dry_run:          body.dry_run  ?? false,
      limit:            body.limit,
      stale_after_days: body.stale_after_days,
    });

    const finishedAt = new Date();

    // ── 監査ログ ─────────────────────────────────────────────────────────────
    const { logId } = await writeBatchRunLog({
      endpoint:        '/api/batch/company-summary-staleness',
      batch_type:      'company-summary-staleness',
      started_at:      startedAt.toISOString(),
      finished_at:     finishedAt.toISOString(),
      duration_ms:     finishedAt.getTime() - startedAt.getTime(),
      dry_run:         result.dry_run,
      source_queue:    'companies',
      request_params:  sanitizeRequestParams(body as Record<string, unknown>),
      filters:         JSON.stringify({ stale_after_days: result.stale_after_days }),
      total_targeted:  result.total_targeted,
      ok_count:        result.generated_count,
      success_count:   result.generated_count,
      partial_count:   0,
      failed_count:    result.failed_count,
      skipped_count:   result.skipped_count + result.approved_skipped_count,
      failure_details: JSON.stringify(
        result.results.filter(r => r.status === 'failed').map(r => ({
          company_uid:  r.company_uid,
          company_name: r.company_name,
          reason:       r.error ?? '',
        })),
      ),
      result_json:     JSON.stringify(result),
    }).catch(() => ({ logId: undefined }));

    return NextResponse.json({ ...result, audit_log_id: logId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[batch/company-summary-staleness] error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
