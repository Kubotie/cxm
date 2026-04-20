// ─── GET /api/ops/batch-logs ──────────────────────────────────────────────────
// audit_logs テーブルから batch 実行履歴を取得する。
//
// ── クエリパラメータ ───────────────────────────────────────────────────────────
//   limit        : 最大件数（default: 50, max: 200）
//   batch_type   : フィルタ（例: company-summary-regenerate, company-summary-review）
//   dry_run      : 'true' | 'false' | 省略=全て
//   failed_only  : 'true' のとき failed_count > 0 のみ返す
//   date_from    : ISO8601 日付（例: 2026-04-01）。started_at >= この日付
//   date_to      : ISO8601 日付（例: 2026-04-13）。started_at <= この日付（末尾 T23:59:59 補完）
//
// ── レスポンス ────────────────────────────────────────────────────────────────
//   { available: true,  total, items: RawAuditLog[] }
//   { available: false, reason: string }
//
// ── fallback ─────────────────────────────────────────────────────────────────
//   NOCODB_AUDIT_LOGS_TABLE_ID 未設定時は available=false を返す（エラーにしない）

import { NextRequest, NextResponse } from 'next/server';
import { checkBatchAuth }            from '@/lib/batch/auth';
import { TABLE_IDS, nocoFetch }      from '@/lib/nocodb/client';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 200;

export interface RawAuditLog {
  Id:              number;
  endpoint:        string;
  batch_type:      string | null;
  started_at:      string;
  finished_at:     string;
  duration_ms:     number;
  dry_run:         boolean;
  source_queue:    string;
  request_params:  string;
  filters:         string | null;
  total_targeted:  number;
  ok_count:        number | null;
  success_count:   number;
  partial_count:   number;
  failed_count:    number;
  skipped_count:   number;
  failure_details: string;
  result_json:     string | null;
}

export async function GET(req: NextRequest) {
  const authError = checkBatchAuth(req);
  if (authError) return authError;

  const tableId = TABLE_IDS.audit_logs;
  if (!tableId) {
    return NextResponse.json({
      available: false,
      reason: 'NOCODB_AUDIT_LOGS_TABLE_ID が未設定です。.env.local に追加してください。',
    });
  }

  const { searchParams } = req.nextUrl;
  const rawLimit   = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  const limit      = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, MAX_LIMIT);
  const batchType  = searchParams.get('batch_type');
  const rawDryRun  = searchParams.get('dry_run');
  const failedOnly = searchParams.get('failed_only') === 'true';
  const dateFrom   = searchParams.get('date_from');   // 例: "2026-04-01"
  const dateTo     = searchParams.get('date_to');     // 例: "2026-04-13"

  // where 句の組み立て
  const conditions: string[] = [];
  if (batchType)              conditions.push(`(batch_type,eq,${batchType})`);
  if (rawDryRun === 'true')   conditions.push('(dry_run,eq,true)');
  if (rawDryRun === 'false')  conditions.push('(dry_run,eq,false)');
  if (failedOnly)             conditions.push('(failed_count,gt,0)');
  if (dateFrom)               conditions.push(`(started_at,gte,${dateFrom}T00:00:00)`);
  if (dateTo)                 conditions.push(`(started_at,lte,${dateTo}T23:59:59)`);
  const where = conditions.length > 0 ? conditions.join('~and') : undefined;

  try {
    const items = await nocoFetch<RawAuditLog>(tableId, {
      limit:  String(limit),
      sort:   '-started_at',
      ...(where ? { where } : {}),
    });

    return NextResponse.json({
      available: true,
      total:     items.length,
      items,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ops/batch-logs] 取得失敗:', err);
    return NextResponse.json({ error: `取得エラー: ${msg}` }, { status: 500 });
  }
}
