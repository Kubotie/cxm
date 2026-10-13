// ─── GET /api/ptai/kpi（**PtAI Pipeline 専用**）──────────────────────────────
//
// ダッシュボード上部の数値を返す。2 とおり：
//
//   ?live=1            … いま計算した値（画面に出ているのと同じもの）
//   既定（live なし）  … 毎朝のスナップショットの**時系列**と、前の行からの差分
//
// クエリ
//   scope   team（既定）／ Paul・Baba・Eri・Kubotie・Ava・Utty ／ all（全 scope）
//   from,to YYYY-MM-DD。既定は直近 90 日
//   days    from の代わりに日数で指定
//
// 返す中身は集計値（金額・件数）だけ。会社名・商談名は含めない。
// 認証は画面と同じセッション Cookie。

import { NextRequest, NextResponse } from 'next/server';
import { getUserUidFromCookie } from '@/lib/auth/session';
import { listSnapshots, withDeltas, todayJst } from '@/lib/ptai/kpi-snapshot';
import { computeKpis } from '@/lib/ptai/kpi';
import { loadKpiSource, MEMBERS } from '@/lib/ptai/kpi-source';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const SCOPES = ['team', ...MEMBERS];

export async function GET(req: NextRequest) {
  if (!(await getUserUidFromCookie())) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const q = new URL(req.url).searchParams;
  const scope = q.get('scope') ?? 'team';
  if (scope !== 'all' && !SCOPES.includes(scope)) {
    return NextResponse.json(
      { error: 'bad_scope', message: `scope は ${[...SCOPES, 'all'].join(' / ')} のいずれか` },
      { status: 400 },
    );
  }

  try {
    if (q.get('live') === '1') {
      const src = await loadKpiSource();
      const today = todayJst();
      const scopes = scope === 'all' ? SCOPES : [scope];
      const rows = scopes.map(s => computeKpis(src.companies, {
        scope: s, targetMrr: s === 'team' ? src.targetMrr : (src.targets[s] ?? 0), today,
      }));
      return NextResponse.json(
        { ok: true, live: true, date: today, targetDue: src.targetDue, rows, diagnostics: src.diagnostics },
        { headers: { 'Cache-Control': 'private, max-age=60' } },
      );
    }

    const to   = q.get('to') ?? todayJst();
    const days = Math.min(Math.max(1, Number(q.get('days')) || 90), 730);
    const from = q.get('from')
      ?? new Date(Date.parse(to + 'T00:00:00Z') - (days - 1) * 86_400_000).toISOString().slice(0, 10);

    const all = await listSnapshots({ from, to, ...(scope === 'all' ? {} : { scope }) });
    // 差分は scope ごとに取る（混ぜると team と個人の差を引いてしまう）
    const byScope: Record<string, ReturnType<typeof withDeltas>> = {};
    for (const s of scope === 'all' ? SCOPES : [scope]) {
      byScope[s] = withDeltas(all.filter(p => p.scope === s));
    }

    return NextResponse.json(
      { ok: true, live: false, from, to, scopes: Object.keys(byScope), series: byScope },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    );
  } catch (e) {
    console.error('[ptai/kpi] 失敗', (e as Error).name);
    return NextResponse.json({ error: 'upstream_unavailable' }, { status: 502 });
  }
}
