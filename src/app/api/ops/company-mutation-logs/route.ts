// ─── GET /api/ops/company-mutation-logs ──────────────────────────────────────
// company_mutation_logs テーブルから UI/API mutation イベント履歴を取得する。
//
// ── クエリパラメータ ───────────────────────────────────────────────────────────
//   limit        : 最大件数（default: 50, max: 200）
//   event_type   : フィルタ（例: action_created, sf_todo_created）
//   company_uid  : 特定企業に絞り込む
//   date_from    : ISO8601 日付（例: 2026-04-01）。timestamp >= この日付
//   date_to      : ISO8601 日付（例: 2026-04-13）。timestamp <= この日付（末尾 T23:59:59 補完）
//
// ── レスポンス ────────────────────────────────────────────────────────────────
//   { available: true,  total, items: RawMutationLogItem[] }
//   { available: false, reason: string }
//
// ── fallback ─────────────────────────────────────────────────────────────────
//   NOCODB_COMPANY_MUTATION_LOGS_TABLE_ID 未設定時は available=false を返す

import { NextRequest, NextResponse } from 'next/server';
import { checkBatchAuth }            from '@/lib/batch/auth';
import { TABLE_IDS, nocoFetch }      from '@/lib/nocodb/client';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 200;

export interface RawMutationLogItem {
  Id:              number;
  event_type:      string;
  company_uid:     string;
  entity_id:       string;
  actor_source:    string;
  actor_user_id:   string | null;
  actor_user_name: string | null;
  timestamp:       string;
  payload_json:    string | null;
}

export async function GET(req: NextRequest) {
  const authError = checkBatchAuth(req);
  if (authError) return authError;

  const tableId = TABLE_IDS.company_mutation_logs;
  if (!tableId) {
    return NextResponse.json({
      available: false,
      reason: 'NOCODB_COMPANY_MUTATION_LOGS_TABLE_ID が未設定です',
    });
  }

  const { searchParams } = req.nextUrl;

  const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, MAX_LIMIT);

  const eventType  = searchParams.get('event_type')  ?? '';
  const companyUid = searchParams.get('company_uid') ?? '';
  const dateFrom   = searchParams.get('date_from')   ?? '';
  const dateTo     = searchParams.get('date_to')     ?? '';

  const conditions: string[] = [];
  if (eventType)  conditions.push(`(event_type,eq,${eventType})`);
  if (companyUid) conditions.push(`(company_uid,eq,${companyUid})`);
  if (dateFrom)   conditions.push(`(timestamp,gte,${dateFrom}T00:00:00)`);
  if (dateTo)     conditions.push(`(timestamp,lte,${dateTo}T23:59:59)`);

  const where = conditions.length > 0 ? conditions.join('~and') : undefined;

  try {
    const rows = await nocoFetch<RawMutationLogItem>(tableId, {
      ...(where ? { where } : {}),
      sort:  '-timestamp',
      limit: String(limit),
    });

    return NextResponse.json({
      available: true,
      total:     rows.length,
      filters:   { eventType: eventType || null, companyUid: companyUid || null, dateFrom: dateFrom || null, dateTo: dateTo || null, limit },
      items:     rows,
    });
  } catch (err) {
    console.error('[api/ops/company-mutation-logs]', err);
    return NextResponse.json(
      { available: false, reason: String(err) },
      { status: 500 },
    );
  }
}
