// GET /api/support/cases/[caseId]/state
// ケースの永続化済み状態を返す。

import { NextResponse } from 'next/server';
import { getCaseStateFromNoco } from '@/lib/nocodb/case-state-store';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;
  if (!caseId) {
    return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
  }

  try {
    const state = await getCaseStateFromNoco(caseId);
    return NextResponse.json({ state });
  } catch (err) {
    console.error('[GET /api/support/cases/[caseId]/state]', err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 },
    );
  }
}
