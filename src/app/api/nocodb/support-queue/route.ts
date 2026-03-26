import { NextRequest, NextResponse } from 'next/server';
import { getSupportQueueList as fetchSupportQueue, getSupportCaseById as fetchSupportCaseById } from '@/lib/nocodb/support';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const caseId = searchParams.get('caseId');

  try {
    if (caseId) {
      const data = await fetchSupportCaseById(caseId);
      return NextResponse.json(data);
    }
    const limit = Number(searchParams.get('limit') ?? '100');
    const data = await fetchSupportQueue(limit);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/nocodb/support-queue]', err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 },
    );
  }
}
