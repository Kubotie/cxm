// ─── POST/GET /api/batch/churn-radar ──────────────────────────────────────────
//
// 解約レーダーの日次バッチ。全対象企業の判定を計算し churn_radar_state に上書きする。
// 画面はこの作り置きを読むだけにするためのもの（設計 §3「読むときに計算しない」）。
//
// ── スケジュール ─────────────────────────────────────────────────────────────
//   Vercel Cron: 毎日 05:00 JST（20:00 UTC）
//   company-snapshot-light（03:30 JST）が当日ぶんを書いた後に走らせること。
//
// ── 認証 ─────────────────────────────────────────────────────────────────────
//   checkCronOrBatchAuth（CRON_SECRET または SUPPORT_BATCH_SECRET）
//
// ── パラメータ ───────────────────────────────────────────────────────────────
//   dry_run=1   書き込まずに結果だけ返す
//   uid=sf_xxx  対象を絞る（デバッグ用）
//
// 実処理は src/lib/churn/radar-run.ts。

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { checkCronOrBatchAuth } from '@/lib/batch/auth';
import { radarTablesReady } from '@/lib/churn/radar-state';
import { runChurnRadar } from '@/lib/churn/radar-run';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function handle(req: NextRequest): Promise<NextResponse> {
  const authError = checkCronOrBatchAuth(req);
  if (authError) return authError;

  if (!radarTablesReady()) {
    return NextResponse.json({
      error: 'churn_radar_state テーブルが未設定です',
      hint:  'NOCODB_CHURN_RADAR_STATE_TABLE_ID を環境変数に設定してください',
    }, { status: 503 });
  }

  const sp     = req.nextUrl.searchParams;
  const dryRun = sp.get('dry_run') === '1';
  const uids   = sp.get('uid')?.split(',').map(s => s.trim()).filter(Boolean);

  // dry run は結果を見たいので同期実行。本番は 300s を超えうるので背後に回す
  if (dryRun || uids?.length) {
    try {
      return NextResponse.json({ status: 'ok', ...(await runChurnRadar(dryRun, uids)) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  after(() => runChurnRadar(false).catch(err =>
    console.error('[batch/churn-radar] background 例外:', err),
  ));
  return NextResponse.json({
    status:  'accepted',
    message: 'バックグラウンドで解約レーダーの走査を開始しました。完了は Vercel ログで確認してください。',
  });
}

export const POST = handle;
export const GET  = handle;
