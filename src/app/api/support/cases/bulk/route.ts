// POST /api/support/cases/bulk
// 一括操作: dismiss / action / cse-ticket
//
// Request body:
//   { op: "dismiss" | "action" | "cse-ticket", ids: string[], payload?: object }
//
// Response:
//   { succeeded: string[], failed: Array<{ id: string; error: string }> }

import { NextResponse } from 'next/server';
import { upsertCaseState } from '@/lib/nocodb/case-state-store';
import { getCurrentSupportOperator } from '@/lib/support/current-operator';

type BulkOp = 'dismiss' | 'action' | 'cse-ticket';

interface BulkBody {
  op:       BulkOp;
  ids:      string[];
  payload?: Record<string, unknown>;
}

export async function POST(req: Request) {
  const body: BulkBody = await req.json().catch(() => ({ op: 'dismiss', ids: [] }));
  const { op, ids, payload = {} } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
  }

  const actor = (payload.actor as string | null | undefined) ?? getCurrentSupportOperator();
  const now = new Date().toISOString();

  function buildPatch() {
    switch (op) {
      case 'dismiss':
        return {
          dismissed:        true,
          dismissed_at:     now,
          dismissed_by:     actor,
          dismissed_reason: (payload.reason as string | null | undefined) ?? null,
          undismissed_at:   null,
          undismissed_by:   null,
        };
      case 'action':
        return {
          has_action:        true,
          action_created_at: now,
          action_updated_at: now,
          action_id:         null,
          action_status:     (payload.status as string | undefined) ?? 'open',
          action_owner:      (payload.owner  as string | null | undefined) ?? actor,
          action_title:      (payload.title  as string | null | undefined) ?? null,
        };
      case 'cse-ticket':
        return {
          has_cse_ticket: true,
          cse_created_at: now,
          cse_updated_at: now,
          cse_ticket_id:  null,
          cse_status:     (payload.status as string | undefined) ?? 'open',
          cse_owner:      (payload.owner  as string | null | undefined) ?? actor,
          cse_title:      (payload.title  as string | null | undefined) ?? null,
        };
    }
  }

  const succeeded: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  // 並列実行（NocoDB への負荷を考慮して concurrency は制御しない — 件数は通常 <50）
  await Promise.all(
    ids.map(async id => {
      try {
        await upsertCaseState(id, buildPatch());
        succeeded.push(id);
      } catch (err) {
        failed.push({ id, error: String(err) });
      }
    }),
  );

  return NextResponse.json({ succeeded, failed });
}
