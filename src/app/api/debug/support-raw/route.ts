// ─── デバッグ用: log_intercom の生レコードをそのまま返す ──────────────────────
// フィールド名の確認に使用する。本番では削除または保護すること。
// GET /api/debug/support-raw?limit=3

import { NextRequest, NextResponse } from 'next/server';
import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';

export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get('limit') ?? '3';
  const tableId = TABLE_IDS.log_intercom;
  if (!tableId) {
    return NextResponse.json({ error: 'NOCODB_LOG_INTERCOM_TABLE_ID 未設定' }, { status: 500 });
  }
  try {
    const rows = await nocoFetch<Record<string, unknown>>(tableId, { limit });
    // フィールド名一覧も返す（最初の行のキー）
    const fields = rows.length > 0 ? Object.keys(rows[0]) : [];
    return NextResponse.json({ fields, rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
