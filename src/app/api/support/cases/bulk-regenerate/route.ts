// ─── POST /api/support/cases/bulk-regenerate ──────────────────────────────────
// Queue UI から呼ぶ一括 AI 再生成エンドポイント。
// approved ケースは内部で自動スキップ（rebuild-ai-state の保護ロジックによる）。
//
// リクエストボディ:
//   { case_ids: string[], source_queue?: 'intercom' | 'cse_ticket' }
//
// レスポンス:
//   { ok: true; succeeded: number; failed: number; locked_skipped: number; failures: Failure[] }
//   { ok: false; error: string }
//
// 最大 20 件 / リクエスト。approved は rebuild-ai-state 側でスキップされる。
// 内部的に /api/support/rebuild-ai-state を呼び出し、結果をサマリーして返す。

import { NextRequest, NextResponse } from 'next/server';

const MAX_CASES = 20;

interface RebuildResult {
  success_count?: number;
  partial_count?: number;
  failed_count?:  number;
  skipped_count?: number;
  failures?:      { case_id: string; reason: string }[];
  error?:         string;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const { case_ids, source_queue } = body as {
    case_ids?:     string[];
    source_queue?: string;
  };

  if (!Array.isArray(case_ids) || case_ids.length === 0) {
    return NextResponse.json({ ok: false, error: 'case_ids is required' }, { status: 400 });
  }

  const ids = case_ids.slice(0, MAX_CASES);

  // source_queue (intercom / cse_ticket) → rebuild-ai-state が受け付けるキュー名に変換
  const rebuildSourceQueue =
    source_queue === 'cse_ticket' ? 'cseticket_queue' : 'support_queue';

  // ── 内部 fetch で rebuild-ai-state を呼ぶ ────────────────────────────────
  // SUPPORT_BATCH_SECRET が設定されていれば Authorization ヘッダーを付与する。
  // 未設定の場合は batch auth がスキップされるため問題なし（ローカル開発互換）。

  const batchSecret = process.env.SUPPORT_BATCH_SECRET;

  // App URL の解決: Vercel デプロイ / カスタムドメイン / ローカル の順で試みる
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    'http://localhost:3000';

  let rebuildResult: RebuildResult = {};

  try {
    const res = await fetch(`${baseUrl}/api/support/rebuild-ai-state`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(batchSecret ? { Authorization: `Bearer ${batchSecret}` } : {}),
      },
      body: JSON.stringify({
        case_ids:     ids,
        source_queue: rebuildSourceQueue,
        limit:        ids.length,
      }),
    });

    rebuildResult = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = rebuildResult.error ?? `rebuild-ai-state HTTP ${res.status}`;
      return NextResponse.json({ ok: false, error: errMsg }, { status: 500 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  return NextResponse.json({
    ok:             true,
    succeeded:      (rebuildResult.success_count ?? 0) + (rebuildResult.partial_count ?? 0),
    failed:         rebuildResult.failed_count   ?? 0,
    locked_skipped: rebuildResult.skipped_count  ?? 0,
    failures:       rebuildResult.failures       ?? [],
  });
}
