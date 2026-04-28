// GET /api/outbound/debug
// company_channel_identify テーブルの生レコードを最大20件返す（デバッグ用）
// 確認後は削除すること

import { NextResponse } from 'next/server';
import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';

export async function GET() {
  const tableId = TABLE_IDS.company_channel_identify;
  if (!tableId) {
    return NextResponse.json({ error: 'TABLE_ID not set' }, { status: 500 });
  }

  // フィルタなし・全カラム・先頭20件
  const rows = await nocoFetch<Record<string, unknown>>(tableId, { limit: '20' }, false)
    .catch((e: unknown) => ({ error: String(e) }));

  return NextResponse.json({ tableId, rows });
}
