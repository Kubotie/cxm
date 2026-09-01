// ─── GET/POST /api/batch/intercom-reconcile ───────────────────────────────────
//
// **log_intercom の「未クローズ」を Intercom の現状に合わせ直す。**
//
// ── なぜ必要か ────────────────────────────────────────────────────────────────
// 同期スクリプト sync_intercom_log.py は SYNC_DAYS=7 の窓、つまり
// 「直近7日に更新された会話」しか取りに行かない。
// 4月に open として取り込まれた会話が5月にクローズされても、その行は
// **二度と書き換わらない。** 結果、画面には何ヶ月も前の会話が
// 「未クローズ」として残り続けていた。
//
//   実測（2026-08-31）:
//     Intercom 実際 : open 11 / snoozed 9  = 20件
//     NocoDB       : open 1,105 / snoozed 183 = 1,288行
//   → 表示されていた未クローズの98%が残骸だった。
//
// ── 方針 ──────────────────────────────────────────────────────────────────────
// Intercom に「今 open / snoozed な会話」を直接聞く（数十件しかない）。
// それを正本として、NocoDB 側の食い違いを両方向に直す。
//
//   NocoDB=未クローズ かつ Intercom に居ない → closed に落とす
//   NocoDB=closed     かつ Intercom に居る   → open/snoozed に戻す
//
// 1会話が複数行（メッセージ単位）に分かれているため、同じ source_record_id を
// 持つ行はまとめて同じ状態にする。
//
// ── 補足 ──────────────────────────────────────────────────────────────────────
// closed に落とす行の close_at は埋めない。クローズ時刻を知るには会話を
// 1件ずつ取り直す必要があり、割に合わない。CXM は close_at を読んでいない
// （型定義にあるだけで参照ゼロ）。
//
//   ?dryRun=1   書き込まず差分だけ返す
//   ?limit=N    書き換える行数の上限（既定 5000）

import { NextRequest, NextResponse } from 'next/server';
import { checkCronOrBatchAuth } from '@/lib/batch/auth';
import { TABLE_IDS, nocoFetchAll } from '@/lib/nocodb/client';
import { nocoUpdateMany } from '@/lib/nocodb/write';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

type LiveState = 'open' | 'snoozed';

const INTERCOM_BASE = 'https://api.intercom.io';

function intercomHeaders() {
  return {
    Authorization: `Bearer ${process.env.TOKEN_INTERCOM ?? ''}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Intercom-Version': '2.10',
  } as const;
}

/**
 * Intercom で現在 open / snoozed な会話 ID を全部集める。
 *
 * conversations/search は 150件/ページ。件数は数十のはずだが、
 * 溜まっている可能性もあるのでページングは実装しておく。
 */
async function fetchLiveConversations(): Promise<Map<string, LiveState>> {
  const live = new Map<string, LiveState>();

  for (const state of ['open', 'snoozed'] as const) {
    let startingAfter: string | null = null;
    for (let page = 0; page < 50; page++) {
      const body: Record<string, unknown> = {
        query: { field: 'state', operator: '=', value: state },
        pagination: startingAfter
          ? { per_page: 150, starting_after: startingAfter }
          : { per_page: 150 },
      };
      const res = await fetch(`${INTERCOM_BASE}/conversations/search`, {
        method: 'POST',
        headers: intercomHeaders(),
        body: JSON.stringify(body),
        cache: 'no-store',
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => '(body read failed)');
        throw new Error(`Intercom search ${res.status} [state=${state}] — ${errBody.slice(0, 300)}`);
      }
      const json = await res.json() as {
        conversations?: Array<{ id?: string | number }>;
        pages?: { next?: { starting_after?: string } | null };
      };
      for (const c of json.conversations ?? []) {
        if (c.id != null) live.set(String(c.id), state);
      }
      startingAfter = json.pages?.next?.starting_after ?? null;
      if (!startingAfter) break;
    }
  }
  return live;
}

interface Row {
  Id?: number;
  source_record_id?: string | number | null;
  source_status?: string | null;
  routing_status?: string | null;
}

const FIELDS = 'Id,source_record_id,source_status,routing_status';

export async function GET(req: NextRequest)  { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  const unauthorized = checkCronOrBatchAuth(req);
  if (unauthorized) return unauthorized;

  const tableId = TABLE_IDS.log_intercom;
  if (!tableId) {
    return NextResponse.json({ ok: false, error: 'NOCODB_LOG_INTERCOM_TABLE_ID が未設定です' }, { status: 500 });
  }
  if (!process.env.TOKEN_INTERCOM) {
    return NextResponse.json({ ok: false, error: 'TOKEN_INTERCOM が未設定です' }, { status: 500 });
  }

  const sp     = req.nextUrl.searchParams;
  const dryRun = sp.get('dryRun') === '1';
  const limit  = Math.max(1, Number(sp.get('limit') ?? 5000));
  const started = Date.now();

  let live: Map<string, LiveState>;
  try {
    live = await fetchLiveConversations();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  // ── NocoDB 側で未クローズ扱いの行 ────────────────────────────────────────────
  const staleOpen = await nocoFetchAll<Row>(
    tableId,
    { where: '(source_status,eq,open)~or(source_status,eq,snoozed)', fields: FIELDS },
    false,
    { maxRows: 50_000 },
  );

  // ── 語彙が古いまま残っている行 ──────────────────────────────────────────────
  //    'unassigned' は廃止済み（アサインを見ていない偽の状態だった）。
  //    source_status が closed でも routing_status だけ残っている行を拾う。
  const legacyRouting = await nocoFetchAll<Row>(
    tableId,
    { where: '(routing_status,eq,unassigned)', fields: FIELDS },
    false,
    { maxRows: 50_000 },
  );

  // ── Intercom では生きているが NocoDB が closed にしている行 ──────────────────
  //    live は数十件なので source_record_id の in 句で一発で引ける
  const liveIds = [...live.keys()];
  const liveRows = liveIds.length
    ? await nocoFetchAll<Row>(
        tableId,
        { where: `(source_record_id,in,${liveIds.join(',')})`, fields: FIELDS },
        false,
        { maxRows: 50_000 },
      )
    : [];

  // 同じ行を二度拾わないように Id で寄せる
  const byId = new Map<number, Row>();
  for (const r of [...staleOpen, ...legacyRouting, ...liveRows]) {
    if (r.Id != null) byId.set(r.Id, r);
  }

  const updates: Array<Record<string, unknown>> = [];
  const closedConversations = new Set<string>();
  const revivedConversations = new Set<string>();

  let ignoredPreserved = 0;

  for (const r of byId.values()) {
    const sourceId = r.source_record_id == null ? '' : String(r.source_record_id);
    const desired: 'open' | 'snoozed' | 'closed' = live.get(sourceId) ?? 'closed';
    const routingNow = (r.routing_status ?? '').toLowerCase();

    // **ignored は温存する。** case_type=sales（営業・マーケメール）を
    // 運用対象外にしている分類で、closed で潰すと二度と戻らない
    // （古い会話は同期の7日窓に入らないため再分類されない）。
    // source_status さえ直せば画面の「未クローズ」からは消える。
    const routingNext = routingNow === 'ignored' ? 'ignored' : desired;
    if (routingNow === 'ignored') ignoredPreserved++;

    if ((r.source_status ?? '').toLowerCase() === desired && routingNow === routingNext) continue;

    updates.push({ Id: r.Id, source_status: desired, routing_status: routingNext });
    if (desired === 'closed') closedConversations.add(sourceId);
    else revivedConversations.add(sourceId);
    if (updates.length >= limit) break;
  }

  let updated = 0;
  let error: string | null = null;
  if (!dryRun && updates.length > 0) {
    try {
      updated = await nocoUpdateMany(tableId, updates);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({
    ok: error === null,
    dryRun,
    intercomLive:      { total: live.size, open: [...live.values()].filter(v => v === 'open').length,
                         snoozed: [...live.values()].filter(v => v === 'snoozed').length },
    nocodbRowsChecked: byId.size,
    plannedUpdates:    updates.length,
    updatedRows:       updated,
    ignoredPreserved,
    closedConversations:  closedConversations.size,
    revivedConversations: revivedConversations.size,
    truncated:         updates.length >= limit,
    error,
    elapsedSec: Math.round((Date.now() - started) / 1000),
  });
}
