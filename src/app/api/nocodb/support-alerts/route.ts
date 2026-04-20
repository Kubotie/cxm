import { NextRequest, NextResponse } from 'next/server';
import { getSupportAlerts } from '@/lib/nocodb/support';
import { TABLE_IDS } from '@/lib/nocodb/client';

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? '50');
  try {
    const data = await getSupportAlerts(limit);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/nocodb/support-alerts]', err);
    return NextResponse.json(
      {
        error: String(err),
        attempted_env: 'NOCODB_SUPPORT_ALERTS_TABLE_ID',
        attempted_table_id: TABLE_IDS.support_alerts || '(empty)',
      },
      { status: 500 },
    );
  }
}
