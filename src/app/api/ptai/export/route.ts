// ─── GET /api/ptai/export（**読み取り専用**）─────────────────────────────────
//
// PtAI Pipeline が持っているものを、会社を軸にまとめて返す。
// 分析ツールや Claude に読ませる用。**書き込みはできない。**
//
// 認証
//   `Authorization: Bearer $PTAI_READ_TOKEN`（読み取り専用の鍵）
//   または画面と同じセッション Cookie
//   ⚠ SUPPORT_BATCH_SECRET は受け付けない（あちらは書き込みまで開く鍵）
//
// クエリ
//   include   deals,kpi（既定）／logs,success,org,minutes,notes,docs,recent,feed
//             `include=all` で全部。重いものがあるので既定では外してある
//   owner     担当者で絞る
//   stage     そのフェーズの商談を持つ会社だけ
//   cid       会社の Notion ページ ID
//   q         社名の部分一致
//   withDeals 1 を指定すると商談のある会社だけ
//
// 返す中身には**顧客名・商談名・議事録の本文が入る**。ログには件数しか出さない。

import { NextRequest, NextResponse } from 'next/server';
import { requirePtaiRead } from '@/lib/ptai/read-auth';
import { buildExport, INCLUDES, DEFAULT_INCLUDES, type Include } from '@/lib/ptai/export';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = await requirePtaiRead(req);
  if (denied) return denied;

  const q = req.nextUrl.searchParams;
  const rawInclude = (q.get('include') ?? '').trim();
  let include: Include[] = DEFAULT_INCLUDES;
  if (rawInclude === 'all') include = [...INCLUDES];
  else if (rawInclude) {
    const asked = rawInclude.split(',').map(s => s.trim()).filter(Boolean);
    const bad = asked.filter(s => !INCLUDES.includes(s as Include));
    if (bad.length) {
      return NextResponse.json(
        { error: 'bad_include', message: `include に使えるのは ${INCLUDES.join(' / ')} / all`, bad },
        { status: 400 },
      );
    }
    include = asked as Include[];
  }

  try {
    const data = await buildExport({
      include,
      owner:     q.get('owner')  ?? undefined,
      stage:     q.get('stage')  ?? undefined,
      cid:       q.get('cid')    ?? undefined,
      q:         q.get('q')      ?? undefined,
      withDeals: q.get('withDeals') === '1',
    });
    // 件数だけ。顧客名は出さない
    console.info('[ptai/export]', JSON.stringify({ include, ...(data.counts as object) }));
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  } catch (e) {
    console.error('[ptai/export] 失敗', (e as Error).name);
    return NextResponse.json({ error: 'upstream_unavailable' }, { status: 502 });
  }
}
