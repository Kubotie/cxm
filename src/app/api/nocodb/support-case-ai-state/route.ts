import { NextRequest, NextResponse } from 'next/server';
import { getSupportCaseAIStateBySource } from '@/lib/nocodb/support';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sourceId    = searchParams.get('sourceId');
  const sourceTable = searchParams.get('sourceTable') ?? 'support_queue';

  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId is required' }, { status: 400 });
  }

  try {
    const data = await getSupportCaseAIStateBySource(sourceId, sourceTable);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/nocodb/support-case-ai-state]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
