import { NextRequest, NextResponse } from 'next/server';
import { getSupportAlerts } from '@/lib/nocodb/support';

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? '50');
  try {
    const data = await getSupportAlerts(limit);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/nocodb/support-alerts]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
