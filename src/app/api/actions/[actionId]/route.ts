// PATCH /api/actions/[actionId]
// company/[companyUid] に依存しないアクション単体の部分更新。
// actionId = action_id (UUID)。rowId は body に含める（NocoDB Id）。

import { NextResponse } from 'next/server';
import { updateCompanyAction } from '@/lib/nocodb/company-actions';
import type { CompanyActionPatchPayload } from '@/lib/nocodb/company-actions';

type RouteContext = { params: Promise<{ actionId: string }> };

export async function PATCH(req: Request, { params }: RouteContext) {
  const { actionId } = await params;
  if (!actionId) {
    return NextResponse.json({ error: 'actionId is required' }, { status: 400 });
  }

  let body: CompanyActionPatchPayload & { rowId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rowId = body.rowId;
  if (typeof rowId !== 'number' || rowId <= 0) {
    return NextResponse.json({ error: 'rowId (NocoDB Id) is required' }, { status: 400 });
  }

  const patch: CompanyActionPatchPayload = {};
  if (body.title               !== undefined) patch.title               = body.title;
  if (body.description         !== undefined) patch.description         = body.description;
  if (body.owner               !== undefined) patch.owner               = body.owner;
  if (body.due_date            !== undefined) patch.due_date            = body.due_date;
  if (body.status              !== undefined) patch.status              = body.status;
  if (body.urgency             !== undefined) patch.urgency             = body.urgency;
  if (body.recommended_channel !== undefined) patch.recommended_channel = body.recommended_channel;
  if (body.sf_todo_status      !== undefined) patch.sf_todo_status      = body.sf_todo_status;
  if (body.sf_todo_id          !== undefined) patch.sf_todo_id          = body.sf_todo_id;
  if (body.sf_last_synced_at   !== undefined) patch.sf_last_synced_at   = body.sf_last_synced_at;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const action = await updateCompanyAction(rowId, patch);
    return NextResponse.json({ action });
  } catch (err) {
    console.error('[PATCH /api/actions/[actionId]]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
