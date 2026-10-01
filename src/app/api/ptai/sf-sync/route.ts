// ─── POST /api/ptai/sf-sync ───────────────────────────────────────────────────
//
// 画面の「Salesforce から更新」ボタンの受け口。
//
// **Salesforce が商談と金額の正本。** ここは一方向の写し取りで、書き戻さない。
// 定期実行にはせず、押されたときだけ走らせる（2026-10-01 の判断）。
//
// 返すのは件数だけ。顧客名・商談名は出さない。

import { NextResponse } from 'next/server';
import { getPtaiIdentity } from '@/lib/ptai/approver';
import { actorStampFor } from '@/lib/ptai/staff';
import { syncSalesforceOpportunities } from '@/lib/ptai/salesforce/sync';
import { getPtaiDataSource } from '@/lib/twenty/data-source';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
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
    const actor = await actorStampFor(me.id, me.name);
    const r = await syncSalesforceOpportunities(actor);
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
