// POST /api/support/cases/[caseId]/dismiss   → dismiss
// DELETE /api/support/cases/[caseId]/dismiss → undismiss

import { NextResponse } from 'next/server';
import { upsertCaseState } from '@/lib/nocodb/case-state-store';
import { getCurrentSupportOperator } from '@/lib/support/current-operator';

interface DismissBody {
  reason?: string | null;
  actor?:  string | null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;
  const body: DismissBody = await req.json().catch(() => ({}));
  const actor = body.actor ?? getCurrentSupportOperator();
  const now = new Date().toISOString();

  try {
    const state = await upsertCaseState(caseId, {
      dismissed:        true,
      dismissed_at:     now,
      dismissed_by:     actor,
      dismissed_reason: body.reason ?? null,
      undismissed_at:   null,
      undismissed_by:   null,
    });
    return NextResponse.json({ state });
  } catch (err) {
    console.error('[POST dismiss]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;
  const body: { actor?: string | null } = await req.json().catch(() => ({}));
  const actor = body.actor ?? getCurrentSupportOperator();
  const now = new Date().toISOString();

  try {
    const state = await upsertCaseState(caseId, {
      dismissed:      false,
      undismissed_at: now,
      undismissed_by: actor,
    });
    return NextResponse.json({ state });
  } catch (err) {
    console.error('[DELETE dismiss]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
