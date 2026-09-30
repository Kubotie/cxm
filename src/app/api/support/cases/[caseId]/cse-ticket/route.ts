// POST /api/support/cases/[caseId]/cse-ticket
// CSE Ticket を作成（または上書き更新）する。

import { NextResponse } from 'next/server';
import { upsertCaseState } from '@/lib/nocodb/case-state-store';
import { getCurrentSupportOperator } from '@/lib/support/current-operator';
import { requireUser } from '@/lib/auth/guard';

interface CseTicketBody {
  title?:  string | null;
  owner?:  string | null;
  actor?:  string | null;
  status?: string | null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  // 書き込み系。middleware に加えてハンドラ側でも認証する（多層防御・2026-09-30 是正）
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { caseId } = await params;
  const body: CseTicketBody = await req.json().catch(() => ({}));
  const actor = body.actor ?? getCurrentSupportOperator();
  const now = new Date().toISOString();

  try {
    const state = await upsertCaseState(caseId, {
      has_cse_ticket: true,
      cse_created_at: now,
      cse_updated_at: now,
      cse_ticket_id:  null,
      cse_status:     body.status ?? 'open',
      cse_owner:      body.owner  ?? actor,
      cse_title:      body.title  ?? null,
    });
    return NextResponse.json({ state });
  } catch (err) {
    console.error('[POST cse-ticket]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
