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
//   allowPartial 1 で、取りこぼしがあっても 200 で返す（調査用）
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
    const partial = data.partialFailures as string[];
    console.info('[ptai/export]', JSON.stringify(
      { include, ...(data.counts as object), partialFailures: partial }));

    // ⚠ 取りこぼしたまま 200 で返さない。Twenty のレート制限（429）に当たると
    //   db-view は空のコレクションを返すので、「商談ゼロ」という**嘘の正常値**に
    //   見えてしまう。2026-10-13 に実際に起きた（商談 71 件が 0 件になった）。
    //   分析に使う API なので、間違った数字を返すより落ちたほうがよい。
    if (partial.length && q.get('allowPartial') !== '1') {
      return NextResponse.json(
        { ...data, ok: false, incomplete: true,
          message: '取得に失敗した部分があります。数字が実態より小さく出るので使わないでください。'
                 + '少し待って取り直すか、allowPartial=1 で中身を確認してください' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  } catch (e) {
    console.error('[ptai/export] 失敗', (e as Error).name);
    return NextResponse.json({ error: 'upstream_unavailable' }, { status: 502 });
  }
}
