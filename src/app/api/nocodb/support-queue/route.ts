import { NextRequest, NextResponse } from 'next/server';
import {
  getUnifiedQueueList,
  getSupportCaseDetailById,
  getCseTicketDetailById,
} from '@/lib/nocodb/support';
import { TABLE_IDS } from '@/lib/nocodb/client';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const caseId = searchParams.get('caseId');

  try {
    if (caseId) {
      // log_intercom を優先（fromLogIntercomRecordForDetail）、
      // ヒットしなければ cse_tickets（fromCseTicketRecordForDetail）を試みる。
      // どちらも CaseDetail を返す。
      const data = (await getSupportCaseDetailById(caseId).catch(() => null))
               ?? (await getCseTicketDetailById(caseId).catch(() => null));
      return NextResponse.json(data);
    }
    const limit = Number(searchParams.get('limit') ?? '100');
    const data = await getUnifiedQueueList(limit);
    console.log(`[api/nocodb/support-queue] returning count=${data.length}`);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/nocodb/support-queue]', err);
    return NextResponse.json(
      {
        error: String(err),
        attempted_env: 'NOCODB_LOG_INTERCOM_TABLE_ID / NOCODB_CSE_TICKETS_TABLE_ID',
        attempted_log_intercom_id:  TABLE_IDS.log_intercom  || '(empty)',
        attempted_cse_tickets_id:   TABLE_IDS.cse_tickets   || '(empty)',
        source_tables: ['log_intercom (all massage_type)', 'cse_tickets'],
      },
      { status: 500 },
    );
  }
}
