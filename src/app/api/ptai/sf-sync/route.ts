// ─── POST /api/ptai/sf-sync ───────────────────────────────────────────────────
//
// 画面の「Salesforce から更新」ボタンの受け口。
//
// **Salesforce が商談と金額の正本。** ここは一方向の写し取りで、書き戻さない。
// 定期実行にはせず、押されたときだけ走らせる（2026-10-01 の判断）。
//
// 返すのは件数だけ。顧客名・商談名は出さない。

import { NextRequest, NextResponse } from 'next/server';
import { getPtaiIdentity } from '@/lib/ptai/approver';
import { actorStampFor } from '@/lib/ptai/staff';
import { syncSalesforceOpportunities } from '@/lib/ptai/salesforce/sync';
import { getPtaiDataSource } from '@/lib/twenty/data-source';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** 画面を開いたときの自動同期で使う間隔。これより新しければ何もしない */
const AUTO_MAX_AGE_MS = 60 * 60_000;

/** このインスタンスで走っている取り込み。重なったら同じ結果を待つ（新規商談の二重作成を防ぐ）。
 *  2026-10-06 から画面を開いたときの取り込みを待たなくなり、その間に「Salesforce から更新」を押せるため */
let running: ReturnType<typeof syncSalesforceOpportunities> | null = null;

export async function POST(req: NextRequest) {
  const me = await getPtaiIdentity();
  if (!me) return NextResponse.json({ ok: false, code: 'session_expired' }, { status: 401 });

  // 移行元スナップショットを読んでいる環境では、書き込む先が噛み合わない
  if (getPtaiDataSource() !== 'twenty') {
    return NextResponse.json(
      { ok: false, code: 'not_supported', message: 'この環境では Salesforce 同期を使えません' },
      { status: 501 },
    );
  }

  try {
    // `?ifStale=1` は画面を開いたときの自動同期。
    // Vercel の Hobby プランは Cron が 1 日 1 回までなので、
    // 1 時間おきの更新は**画面を開いたときに古ければ走らせる**で担保する。
    const ifStale = req.nextUrl.searchParams.get('ifStale') === '1';
    const actor = await actorStampFor(me.id, me.name);
    if (!running) {
      running = syncSalesforceOpportunities(actor, false, ifStale ? AUTO_MAX_AGE_MS : undefined)
        .finally(() => { running = null; });
    }
    const r = await running;
    if (r.skipped) {
      return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } });
    }
    console.info('[ptai/sf-sync]', JSON.stringify({
      fetched: r.fetched, matched: r.matched,
      created: r.created, updated: r.updated, deleted: r.deleted,
    }));
    return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[ptai/sf-sync] 失敗', (e as Error).name);
    return NextResponse.json(
      { ok: false, code: 'upstream_unavailable', message: 'Salesforce から取り込めませんでした' },
      { status: 502 },
    );
  }
}
