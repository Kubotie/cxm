// ─── /api/batch/ptai-sf-sync ─────────────────────────────────────────────────
//
// Salesforce の PtAI 商談を Twenty へ写す定期バッチ。**1 時間おき**（vercel.json）。
//
// ═══════════════════════════════════════════════════════════════════════════
//  なぜ定期実行にしたか（2026-10-01）
//
//  当初は商談ごとの「更新」ボタンにしていたが、
//    ・押し忘れると古いまま（漏れが出る）
//    ・ダッシュボード全体の数字が人の操作に依存してしまう
//  ため、**全体を 1 時間おきに回す**ことにした（Kubotie 判断）。
//  手で今すぐ取り込みたいときのために、ボタン（/api/ptai/sf-sync）も残す。
// ═══════════════════════════════════════════════════════════════════════════
//
// 認可は既存バッチと同じ。Vercel Cron / 外部バッチのトークン、または admin・ops。
// 返すのは件数だけ。顧客名・商談名は出さない。

import { NextRequest, NextResponse } from 'next/server';
import { requireCronTokenOrOps } from '@/lib/auth/guard';
import { syncSalesforceOpportunities } from '@/lib/ptai/salesforce/sync';
import { getPtaiDataSource } from '@/lib/twenty/data-source';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** バッチが書いたことが分かるようにしておく（人の操作と区別する） */
const BATCH_ACTOR = { name2: 'batch', displayName: 'Salesforce 定期同期', workspaceMemberId: null };

export async function GET(req: NextRequest) {
  const gate = await requireCronTokenOrOps(req);
  if (!gate.ok) return gate.response;

  // 移行元スナップショットを読んでいる環境では書き込む先が噛み合わない
  if (getPtaiDataSource() !== 'twenty') {
    return NextResponse.json(
      { ok: false, skipped: true, reason: 'PTAI_DATA_SOURCE が twenty ではありません' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const startedAt = Date.now();
  try {
    const r = await syncSalesforceOpportunities(BATCH_ACTOR);
    const log = {
      fetched: r.fetched, matched: r.matched,
      created: r.created, updated: r.updated, deleted: r.deleted,
      skippedNoCompany: r.skippedNoCompany, ms: Date.now() - startedAt,
    };
    console.info('[batch/ptai-sf-sync]', JSON.stringify(log));
    return NextResponse.json({ ok: true, ...log, message: r.message },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[batch/ptai-sf-sync] 失敗', (e as Error).name);
    return NextResponse.json(
      { ok: false, error: 'upstream_unavailable' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
