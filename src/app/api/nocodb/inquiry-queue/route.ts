import { NextRequest, NextResponse } from 'next/server';
import { getInquiryQueueByCompanyOrCase } from '@/lib/nocodb/support';

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
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
