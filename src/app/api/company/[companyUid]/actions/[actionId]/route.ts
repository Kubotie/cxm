// PATCH /api/company/[companyUid]/actions/[actionId]
// アクションのステータス等を部分更新する。
// actionId は action_id (UUID)。rowId は body に含める。

import { NextResponse } from 'next/server';
import { updateCompanyAction } from '@/lib/nocodb/company-actions';
import type { CompanyActionPatchPayload } from '@/lib/nocodb/company-actions';
import {
  logMutationEvent,
  buildActionUpdatedEvent,
} from '@/lib/company/company-mutation-events';

type RouteContext = { params: Promise<{ companyUid: string; actionId: string }> };

export async function PATCH(
  req: Request,
  { params }: RouteContext,
) {
  const { companyUid, actionId } = await params;
  if (!companyUid || !actionId) {
    return NextResponse.json({ error: 'companyUid and actionId are required' }, { status: 400 });
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
  if (body.title       !== undefined) patch.title          = body.title;
  if (body.description !== undefined) patch.description    = body.description;
  if (body.owner       !== undefined) patch.owner          = body.owner;
  if (body.due_date    !== undefined) patch.due_date       = body.due_date;
  if (body.status      !== undefined) patch.status         = body.status;
  if (body.sf_todo_status !== undefined) patch.sf_todo_status = body.sf_todo_status;
  if (body.sf_todo_id        !== undefined) patch.sf_todo_id        = body.sf_todo_id;
  if (body.sf_last_synced_at !== undefined) patch.sf_last_synced_at = body.sf_last_synced_at;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const action = await updateCompanyAction(rowId, patch);
    // mutation log（fire and forget）
    const afterEvent: Parameters<typeof buildActionUpdatedEvent>[3] = {};
    if (patch.status    !== undefined) afterEvent.status  = patch.status;
    if (patch.title     !== undefined) afterEvent.title   = patch.title;
    if (patch.owner     !== undefined) afterEvent.owner   = patch.owner;
    if (patch.due_date  !== undefined) afterEvent.dueDate = patch.due_date;
    logMutationEvent(buildActionUpdatedEvent(companyUid, actionId, {}, afterEvent, { source: 'ui' })).catch(() => {});
    return NextResponse.json({ action });
  } catch (err) {
    console.error('[PATCH /api/company/[companyUid]/actions/[actionId]]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
