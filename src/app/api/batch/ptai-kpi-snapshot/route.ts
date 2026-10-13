// ─── /api/batch/ptai-kpi-snapshot ───────────────────────────────────────────
//
// ダッシュボード上部の数値を、その日のぶんとして Twenty に書き留める。
// **毎朝 8:15（JST）**＝ vercel.json の `15 23 * * *`（UTC）。
//
// 現在MRR の同期（8:00）の**あと**に走らせること。先に走ると前日の MRR で
// 記録してしまう。15 分空けてあるのは同期が 127 社ぶん回るため。
//
// 認可は他のバッチと同じ。Vercel Cron / 外部バッチのトークン、または admin・ops。
// 返すのは金額と件数だけ。会社名は出さない（金額は社内の集計値で個社は分からない）。

import { NextRequest, NextResponse } from 'next/server';
import { requireCronTokenOrOps } from '@/lib/auth/guard';
import { runKpiSnapshot } from '@/lib/ptai/kpi-snapshot';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const gate = await requireCronTokenOrOps(req);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const startedAt = Date.now();
  try {
    const r = await runKpiSnapshot({
      date:   url.searchParams.get('date') ?? undefined,
      dryRun: url.searchParams.get('dryRun') === '1',
    });
    const team = r.rows.find(x => x.scope === 'team');
    const log = {
      date: r.date, created: r.created, updated: r.updated, failed: r.failed,
      companies: r.diagnostics.companies, deals: r.diagnostics.deals,
      partialFailures: r.diagnostics.partialFailures,
      plan: team?.plan, won: team?.won, expected: team?.expected, overdue: team?.overdue,
      ms: Date.now() - startedAt,
    };
    console.info('[batch/ptai-kpi-snapshot]', JSON.stringify(log));
    // 取りこぼしたまま書いていない。Cron が失敗として見えるように 503 を返す
    if (r.incomplete) {
      return NextResponse.json(
        { ok: false, incomplete: true, ...log,
          message: '取得に失敗した部分があるので記録しませんでした。時間を置いて再実行してください' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ ok: r.ok, ...log, rows: r.rows },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[batch/ptai-kpi-snapshot] 失敗', (e as Error).name);
    return NextResponse.json({ ok: false, error: 'upstream_unavailable' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
