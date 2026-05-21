// PATCH  /api/outbound/audiences/[id] — 更新
// DELETE /api/outbound/audiences/[id] — 削除

import { NextResponse }           from 'next/server';
import { getCurrentUserProfile }  from '@/lib/auth/session';
import { TABLE_IDS }              from '@/lib/nocodb/client';
import { nocoUpdate, nocoDelete } from '@/lib/nocodb/write';
import type { OutboundAudience }  from '../route';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentUserProfile().catch(() => null);
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const rowId = Number(id);
  if (!rowId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json().catch(() => ({})) as Partial<OutboundAudience>;
  const tableId = TABLE_IDS.outbound_audiences;
  if (!tableId) return NextResponse.json({ error: 'Table not configured' }, { status: 500 });

  const patch: Record<string, unknown> = {};
  if (body.name                 !== undefined) patch.name                 = body.name;
  if (body.company_uids         !== undefined) patch.company_uids         = body.company_uids;
  if (body.per_company_channels !== undefined) patch.per_company_channels = body.per_company_channels;
  if (body.mail_targets         !== undefined) patch.mail_targets         = body.mail_targets;

  const result = await nocoUpdate<OutboundAudience>(tableId, rowId, patch);
  return NextResponse.json(result);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentUserProfile().catch(() => null);
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const rowId = Number(id);
  if (!rowId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const tableId = TABLE_IDS.outbound_audiences;
  if (!tableId) return NextResponse.json({ error: 'Table not configured' }, { status: 500 });

  await nocoDelete(tableId, rowId);
  return NextResponse.json({ ok: true });
}
