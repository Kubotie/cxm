// ─── GET /api/ptai/company/[notionPageId] ────────────────────────────────────
//
// 出典: docs/ptai-dashboard-operation-flows.md §D〜§I
//
// 企業詳細ドロワーの 6 タブ（要約・組織図・商談管理・サクセス管理・行動履歴・議事録）が
// 要るものを 1 回で返す。会社の鍵は **Notion のページ ID**。
//
// 議事録は Notion（JP_Docs）と Mii（Twenty Note）の両方。**統合せず両方出す**。
// 顧客データを含むので **ログイン必須**。ログには件数だけを出す。

import { NextRequest, NextResponse } from 'next/server';
import { getPtaiIdentity } from '@/lib/ptai/approver';
import { getCompanyDetail } from '@/lib/ptai/repository';
import { isConfigured as notionReady, NotionError } from '@/lib/ptai/notion/client';
import { isConfiguredAsync as twentyReady } from '@/lib/ptai/twenty-test/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Notion のページ ID の形。ここで弾いて任意の文字列を渡させない */
const PAGE_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest, ctx: { params: Promise<{ notionPageId: string }> },
) {
  const me = await getPtaiIdentity();
  if (!me) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { notionPageId } = await ctx.params;
  if (!PAGE_ID.test(notionPageId)) {
    return NextResponse.json({ error: 'invalid_argument' }, { status: 400 });
  }
  if (!notionReady() || !(await twentyReady())) {
    return NextResponse.json(
      { error: 'not_configured', message: 'TOKEN_NOTION と TWENTY_API_KEY が要ります' },
      { status: 503 },
    );
  }

  const limitRaw = Number(req.nextUrl.searchParams.get('minutes') ?? '6');
  const minutesLimit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 0), 20) : 6;

  try {
    const detail = await getCompanyDetail({ notionPageId, minutesLimit });
    return NextResponse.json(detail, {
      headers: {
        'Cache-Control': 'private, max-age=30',
        'X-Ptai-Deals': String(detail.deals.length),
        'X-Ptai-Minutes': String(detail.minutes.length),
        'X-Ptai-Partial-Failures': String(detail.diagnostics.partialFailures.length),
      },
    });
  } catch (e) {
    const err = e as NotionError;
    if (err.kind === 'not_found') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    console.error('[ptai/company] 取得に失敗', err.toSafeString?.() ?? String(err));
    return NextResponse.json(
      { error: 'upstream_unavailable', message: err.toSafeString?.() ?? '取得できませんでした' },
      { status: 502 },
    );
  }
}
