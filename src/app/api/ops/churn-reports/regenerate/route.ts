// ─── POST /api/ops/churn-reports/regenerate ───────────────────────────────────
//
// UI から手動で解約分析レポートを再生成するためのエンドポイント。
// Bearer 認証は要求しない（middleware のセッション認証で保護される想定）。
// 実処理は /api/batch/churn-analysis-weekly と共有 (churn-report-run.ts)。
//
// ブラウザからの fetch(POST) で叩いて accepted を返し、実処理は after() で背景実行。

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { runWeeklyReport } from '@/lib/company/churn-report-run';
import { requireOpsOrAdmin } from '@/lib/auth/guard';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

interface RequestBody {
  window_days?: number;
}

export async function POST(req: NextRequest) {
  // 運用系エンドポイント。サーバー側でロールを検証する（UI の出し分けは認可ではない）
  const gate = await requireOpsOrAdmin();
  if (!gate.ok) return gate.response;

  const body: RequestBody = await req.json().catch(() => ({}));
  const windowDays = body.window_days ?? 90;

  after(() => runWeeklyReport(false, windowDays, 'manual-ui').catch(err =>
    console.error('[ops/churn-reports/regenerate] background 例外:', err),
  ));

  return NextResponse.json({
    status:      'accepted',
    window_days: windowDays,
    message:     'バックグラウンドで解約分析レポートの再生成を開始しました。数分後に一覧を再読み込みしてください。',
  });
}
