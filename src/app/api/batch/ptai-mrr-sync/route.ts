// ─── /api/batch/ptai-mrr-sync ────────────────────────────────────────────────
//
// Company Database（CCM）の `mrr` を PtAI 顧客管理DB の `現在MRR` へ写す。
// **毎朝 6 時（JST）**＝ vercel.json の `0 21 * * *`（UTC）。
//
// ═══════════════════════════════════════════════════════════════════════════
//  なぜ Notion の ⚠️MRR をやめたか（2026-10-01 Kubotie）
//
//  ⚠️MRR は人が入れた値で、Salesforce から自動反映される Company Database の
//  `mrr` と **127 社中 51 社がずれていた**。ダッシュボードの「現在MRR」は
//  Company Database を正とし、毎朝写した `現在MRR` を見る。
//  ⚠️MRR 自体は他のビューが参照しているので消さない。
//
//  `期初MRR` はここでは触らない（初回に 1 回だけ焼き付けたもの）。
// ═══════════════════════════════════════════════════════════════════════════
//
// 認可は他のバッチと同じ。Vercel Cron / 外部バッチのトークン、または admin・ops。
// 返すのは件数だけ。会社名は出さない。

import { NextRequest, NextResponse } from 'next/server';
import { requireCronTokenOrOps } from '@/lib/auth/guard';
import { syncCurrentMrr } from '@/lib/ptai/notion/mrr-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const gate = await requireCronTokenOrOps(req);
  if (!gate.ok) return gate.response;

  const startedAt = Date.now();
  try {
    const r = await syncCurrentMrr();
    const log = {
      customers: r.customers, viaSfId: r.viaSfId, viaName: r.viaName, zero: r.zero,
      updated: r.updated, unchanged: r.unchanged, failed: r.failed,
      unmatched: r.unmatched, ms: Date.now() - startedAt,
    };
    console.info('[batch/ptai-mrr-sync]', JSON.stringify(log));
    return NextResponse.json({ ok: r.ok, ...log, message: r.message },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[batch/ptai-mrr-sync] 失敗', (e as Error).name);
    return NextResponse.json(
      { ok: false, error: 'upstream_unavailable' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
