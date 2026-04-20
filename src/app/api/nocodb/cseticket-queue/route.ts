import { NextRequest, NextResponse } from 'next/server';
import { getCseTicketQueueByCompanyOrCase } from '@/lib/nocodb/support';
import { TABLE_IDS } from '@/lib/nocodb/client';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const companyUid = searchParams.get('companyUid') ?? undefined;
  const caseId     = searchParams.get('caseId')     ?? undefined;
  const limit      = Number(searchParams.get('limit') ?? '50');

  try {
    const data = await getCseTicketQueueByCompanyOrCase({ companyUid, caseId, limit });
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/nocodb/cseticket-queue]', err);
    return NextResponse.json(
      {
        error: String(err),
        attempted_env: 'NOCODB_CSE_TICKETS_TABLE_ID',
        attempted_table_id: TABLE_IDS.cse_tickets || '(empty)',
        source_table: 'cse_tickets',
        applied_filter: '(none)',
      },
      { status: 500 },
    );
  }
}
