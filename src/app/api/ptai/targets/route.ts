// ─── /api/ptai/targets ────────────────────────────────────────────────────────
//
// 出典: docs/ptai-dashboard-operation-flows.md B-01・§9-1
//
// ═══════════════════════════════════════════════════════════════════════════
//  チーム目標・期限・メンバー別目標の読み書き。
//  **正本は Notion の専用DB「PtAI 目標（Pipeline）」**（§9-1 の回答で新設）。
//  旧 `pga_docs/settings/targets` の置き換え先。
//
//    GET  → { targetMrr, targetDue, targets{name2: 円}, rows[] }
//    PUT  → { rows: [{ pageId, mrr?, due?, active? }] } を 1 行ずつ反映
// ═══════════════════════════════════════════════════════════════════════════
//
// 認可: ログイン必須。**目標の編集は承認者のみ**（チーム全体の数字が動くため）。
//       §4-2 は受注フェーズの承認だけを求めているが、目標は全員の評価に直結するので
//       同じ承認者ロールで絞る。緩めるならここを変えること。
//
// ログ: 金額と件数だけ。顧客データは扱わない。

import { NextRequest, NextResponse } from 'next/server';
import { getPtaiIdentity } from '@/lib/ptai/approver';
import {
  isConfigured, readTeamTargets, listTargetRows, updateTargetRow, NotionError,
} from '@/lib/ptai/notion/client';
import { targetsDataSourceId } from '@/lib/ptai/notion/schema';

export const dynamic = 'force-dynamic';

function notConfigured() {
  return NextResponse.json(
    {
      error: 'targets_not_configured',
      message: 'NOTION_PTAI_TARGETS_DS_ID が未設定です。scripts/notion-targets-db.mjs --apply で作成してください',
    },
    { status: 503 },
  );
}

export async function GET() {
  const me = await getPtaiIdentity();
  if (!me) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isConfigured() || !targetsDataSourceId()) return notConfigured();

  try {
    const [targets, rows] = await Promise.all([readTeamTargets(), listTargetRows()]);
    return NextResponse.json(
      { ...targets, rows, canEdit: me.isApprover },
      { headers: { 'Cache-Control': 'private, max-age=30' } },
    );
  } catch (e) {
    const err = e as NotionError;
    console.error('[ptai/targets] 読み取りに失敗', err.toSafeString?.() ?? String(err));
    return NextResponse.json(
      { error: 'notion_unavailable', message: err.toSafeString?.() ?? 'Notion から読めませんでした' },
      { status: 502 },
    );
  }
}

interface PatchRow {
  pageId: string;
  mrr?: number | null;
  due?: string | null;
  active?: boolean;
}

function parseRows(body: unknown): PatchRow[] | null {
  const rows = (body as { rows?: unknown })?.rows;
  if (!Array.isArray(rows) || !rows.length || rows.length > 50) return null;

  const out: PatchRow[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.pageId !== 'string' || !r.pageId) return null;

    const row: PatchRow = { pageId: r.pageId };
    if ('mrr' in r) {
      if (r.mrr === null) row.mrr = null;
      else if (typeof r.mrr === 'number' && Number.isFinite(r.mrr) && r.mrr >= 0) row.mrr = Math.round(r.mrr);
      else return null;
    }
    if ('due' in r) {
      if (r.due === null || r.due === '') row.due = null;
      // 期限は YYYY-MM だけ受ける（原本の targetDue と同じ形）
      else if (typeof r.due === 'string' && /^\d{4}-\d{2}$/.test(r.due)) row.due = r.due;
      else return null;
    }
    if ('active' in r) {
      if (typeof r.active !== 'boolean') return null;
      row.active = r.active;
    }
    out.push(row);
  }
  return out;
}

export async function PUT(req: NextRequest) {
  const me = await getPtaiIdentity();
  if (!me) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!me.isApprover) {
    return NextResponse.json({ error: 'approver_required', message: '目標の編集は承認者のみです' }, { status: 403 });
  }
  if (!isConfigured() || !targetsDataSourceId()) return notConfigured();

  const rows = parseRows(await req.json().catch(() => null));
  if (!rows) return NextResponse.json({ error: 'invalid_argument' }, { status: 400 });

  // 送られた pageId が目標DB の行かどうかを確認する。他のページを書き換えさせない
  let known: Set<string>;
  try {
    known = new Set((await listTargetRows()).map(r => r.pageId));
  } catch (e) {
    const err = e as NotionError;
    return NextResponse.json(
      { error: 'notion_unavailable', message: err.toSafeString?.() ?? 'Notion から読めませんでした' },
      { status: 502 },
    );
  }
  const unknown = rows.filter(r => !known.has(r.pageId));
  if (unknown.length) {
    return NextResponse.json(
      { error: 'unknown_row', message: '目標DB に無い行が含まれています' },
      { status: 400 },
    );
  }

  const failed: string[] = [];
  for (const row of rows) {
    try {
      await updateTargetRow(row.pageId, row);
    } catch (e) {
      failed.push((e as NotionError).kind ?? 'error');
    }
  }

  console.info('[ptai/targets] 更新', JSON.stringify({
    actor: me.id, rows: rows.length, failed: failed.length,
  }));

  if (failed.length) {
    return NextResponse.json(
      { error: 'partial_failure', updated: rows.length - failed.length, failed: failed.length },
      { status: 502 },
    );
  }

  const targets = await readTeamTargets().catch(() => null);
  return NextResponse.json({ ok: true, updated: rows.length, ...(targets ?? {}) });
}
