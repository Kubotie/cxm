// ─── GET /api/ptai/companies ──────────────────────────────────────────────────
//
// 出典: docs/ptai-dashboard-operation-flows.md §B・§C
//
// トップ画面（KPI・ゲージ・企業一覧）が要る軽い ViewModel。
// Notion のアカウント情報 ＋ Twenty の商談を束ね、§3 の計算を通して返す。
//
// 顧客名を含むので **ログイン必須**。ログには件数だけを出す。

import { NextResponse } from 'next/server';
import { getPtaiIdentity } from '@/lib/ptai/approver';
import { listCompanySummaries } from '@/lib/ptai/repository';
import { isConfigured as notionReady, NotionError } from '@/lib/ptai/notion/client';
import { isConfiguredAsync as twentyReady } from '@/lib/ptai/twenty-test/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET() {
  const me = await getPtaiIdentity();
  if (!me) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!notionReady() || !(await twentyReady())) {
    return NextResponse.json(
      { error: 'not_configured', message: 'TOKEN_NOTION と TWENTY_API_KEY が要ります' },
      { status: 503 },
    );
  }

  try {
    const { companies, partialFailures } = await listCompanySummaries();
    return NextResponse.json(
      { companies, partialFailures, fetchedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'private, max-age=60',
          'X-Ptai-Companies': String(companies.length),
          'X-Ptai-Partial-Failures': String(partialFailures.length),
        },
      },
    );
  } catch (e) {
    const err = e as NotionError;
    console.error('[ptai/companies] 取得に失敗', err.toSafeString?.() ?? String(err));
    return NextResponse.json(
      { error: 'upstream_unavailable', message: err.toSafeString?.() ?? '取得できませんでした' },
      { status: 502 },
    );
  }
}
