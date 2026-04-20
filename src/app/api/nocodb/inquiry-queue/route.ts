import { NextRequest, NextResponse } from 'next/server';
import { getInquiryQueueByCompanyOrCase } from '@/lib/nocodb/support';
import { TABLE_IDS } from '@/lib/nocodb/client';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const companyUid = searchParams.get('companyUid') ?? undefined;
  const caseId     = searchParams.get('caseId')     ?? undefined;
  const limit      = Number(searchParams.get('limit') ?? '50');

  try {
    const data = await getInquiryQueueByCompanyOrCase({ companyUid, caseId, limit });
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/nocodb/inquiry-queue]', err);
    return NextResponse.json(
      {
        error: String(err),
        attempted_env: 'NOCODB_LOG_INTERCOM_TABLE_ID',
        attempted_table_id: TABLE_IDS.log_intercom || '(empty)',
        source_table: 'log_intercom',
        applied_filter: '(massage_type,eq,inquiry)',
      },
      { status: 500 },
    );
  }
}
