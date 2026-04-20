// POST /api/support/cases/[caseId]/action
// Action を作成（または上書き更新）する。

import { NextResponse } from 'next/server';
import { upsertCaseState } from '@/lib/nocodb/case-state-store';
import { getCurrentSupportOperator } from '@/lib/support/current-operator';

interface ActionBody {
  title?:  string | null;
  owner?:  string | null;
  actor?:  string | null;
  status?: string | null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;
  const body: ActionBody = await req.json().catch(() => ({}));
  const actor = body.actor ?? getCurrentSupportOperator();
  const now = new Date().toISOString();

  try {
    const state = await upsertCaseState(caseId, {
      has_action:        true,
      action_created_at: now,
      action_updated_at: now,
      action_id:         null,
      action_status:     body.status ?? 'open',
      action_owner:      body.owner  ?? actor,
      action_title:      body.title  ?? null,
    });
    return NextResponse.json({ state });
  } catch (err) {
    console.error('[POST action]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
