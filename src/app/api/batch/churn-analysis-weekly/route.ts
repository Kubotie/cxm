// ─── POST /api/batch/churn-analysis-weekly ────────────────────────────────────
//
// 週次で解約遡及分析 + AI サマリーを生成し churn_retrospective_reports に保存する。
// 実処理は src/lib/company/churn-report-run.ts に集約されている（UI からの
// /api/ops/churn-reports/regenerate と共有）。
//
// ── スケジュール ─────────────────────────────────────────────────────────────
//   Vercel Cron: 毎週月曜 04:00 JST（日曜 19:00 UTC）
//
// ── 認証 ─────────────────────────────────────────────────────────────────────
//   checkCronOrBatchAuth (CRON_SECRET または SUPPORT_BATCH_SECRET)。
//   ⚠ Vercel Cron は CRON_SECRET が Vercel Env に設定されていれば
//     自動で "Authorization: Bearer $CRON_SECRET" を付けて GET する。未設定だと
//     401 になるので、Vercel ダッシュボードで必ず設定すること。

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { checkCronOrBatchAuth } from '@/lib/batch/auth';
import { runWeeklyReport } from '@/lib/company/churn-report-run';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface RequestBody {
  dry_run?:    boolean;
  window_days?: number;
}

export async function POST(req: NextRequest) {
  const authError = checkCronOrBatchAuth(req);
  if (authError) return authError;

  const body: RequestBody = await req.json().catch(() => ({}));
  const dryRun     = body.dry_run     ?? false;
  const windowDays = body.window_days ?? 90;

  if (dryRun) {
    try {
      const result = await runWeeklyReport(true, windowDays, 'batch-dryrun');
      return NextResponse.json({ status: 'ok', dry_run: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  after(() => runWeeklyReport(false, windowDays, 'batch-post').catch(err =>
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

  after(() => runWeeklyReport(false, 90, 'weekly-cron').catch(err =>
    console.error('[batch/churn-analysis-weekly] background 例外:', err),
  ));

  return NextResponse.json({
    status:  'accepted',
    message: 'Vercel Cron 起動: 週次解約分析をバックグラウンドで開始しました。',
  });
}
