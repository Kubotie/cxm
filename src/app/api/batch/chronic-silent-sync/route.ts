// ─── POST /api/batch/chronic-silent-sync ──────────────────────────────────────
//
// Ptengine「持続休眠（chronic silent）」スナップショットの ingest エンドポイント。
//
// ── 背景 ─────────────────────────────────────────────────────────────────────
//   「2ヶ月連続休眠の有料プロジェクト」判定は ptengine-analytics MCP（ローカル Python /
//   Metabase API 直アクセス）でしか算出できない。アプリは public question CSV しか
//   叩けず複数月 behavior 履歴を持たないため再現不可。
//   そこで MCP 出力（report_get_chronic_silent_projects の結果 + CSV 明細）を
//   ローカルからこの API に POST し、chronic_silent_snapshots に 1 refMonth = 1 行で保存する。
//
// ── 認証 ─────────────────────────────────────────────────────────────────────
//   CRON_SECRET / SUPPORT_BATCH_SECRET を Bearer で要求（他 batch と同じ）。
//
// ── リクエスト body ───────────────────────────────────────────────────────────
//   {
//     "refMonth": "2026-07", "area": "JP", "lookbackMonths": 3,
//     "totalChronic": 256,
//     "byPlan": { "Pti-only": 145, "Bundle": 88, ... },
//     "items": [ { "sfAccountId": "001…", "companyName": "…", "plan": "Bundle",
//                  "riskLevel": "🔴 持続休眠 (3 月)", "portraitSequence": "休眠 → 休眠 → 休眠",
//                  "projectCount": 1 }, ... ],
//     "sourceCsv": "/Users/…/chronic_silent_JP_2026-07_lb3_….csv",
//     "generatedAt": "2026-07-22T10:41:13Z"   // 省略時はサーバー時刻
//   }

import { NextRequest, NextResponse } from 'next/server';
import { checkCronOrBatchAuth } from '@/lib/batch/auth';
import {
  insertChronicSilentSnapshot,
  type ChronicSilentItem,
  type ChronicSilentSnapshot,
} from '@/lib/nocodb/chronic-silent';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface RequestBody {
  refMonth?:       string;
  area?:           string;
  lookbackMonths?: number;
  totalChronic?:   number;
  byPlan?:         Record<string, number>;
  items?:          Partial<ChronicSilentItem>[];
  sourceCsv?:      string;
  generatedAt?:    string;
}

const MONTH_RE = /^\d{4}-\d{2}$/;

export async function POST(req: NextRequest) {
  const authError = checkCronOrBatchAuth(req);
  if (authError) return authError;

  const body: RequestBody = await req.json().catch(() => ({}));

  // ── バリデーション ─────────────────────────────────────────────────────────
  if (!body.refMonth || !MONTH_RE.test(body.refMonth)) {
    return NextResponse.json({ error: 'refMonth は "YYYY-MM" 形式で必須です' }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'items（休眠アカウント配列）が空です' }, { status: 400 });
  }

  const items: ChronicSilentItem[] = body.items
    .filter(it => typeof it?.sfAccountId === 'string' && it.sfAccountId.trim())
    .map(it => ({
      sfAccountId:      it.sfAccountId!.trim(),
      companyName:      it.companyName ?? null,
      plan:             it.plan ?? null,
      riskLevel:        it.riskLevel ?? null,
      portraitSequence: it.portraitSequence ?? null,
      l30Active:        typeof it.l30Active === 'number' ? it.l30Active : null,
      projectCount:     typeof it.projectCount === 'number' ? it.projectCount : 1,
    }));

  if (items.length === 0) {
    return NextResponse.json({ error: 'sfAccountId を持つ item が 1 件もありません' }, { status: 400 });
  }

  const snap: ChronicSilentSnapshot = {
    refMonth:       body.refMonth,
    area:           body.area ?? 'JP',
    lookbackMonths: body.lookbackMonths ?? 3,
    totalChronic:   body.totalChronic ?? items.length,
    byPlan:         body.byPlan ?? {},
    items,
    sourceCsv:      body.sourceCsv ?? null,
    generatedAt:    body.generatedAt ?? new Date().toISOString(),
  };

  try {
    const { id, snapshotId } = await insertChronicSilentSnapshot(snap);
    console.log(
      `[batch/chronic-silent-sync] 保存完了 snapshot_id=${snapshotId} ` +
      `area=${snap.area} ref=${snap.refMonth} accounts=${items.length} total_chronic=${snap.totalChronic}`,
    );
    return NextResponse.json({
      status:       'ok',
      snapshot_id:  snapshotId,
      row_id:       id,
      ref_month:    snap.refMonth,
      area:         snap.area,
      account_count: items.length,
      total_chronic: snap.totalChronic,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
