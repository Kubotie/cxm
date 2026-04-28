// PATCH  /api/outbound/campaigns/[id] — 更新
// DELETE /api/outbound/campaigns/[id] — 削除

import { NextResponse }          from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';
import { TABLE_IDS }             from '@/lib/nocodb/client';
import { nocoUpdate, nocoDelete } from '@/lib/nocodb/write';
import type { OutboundCampaign } from '../route';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getCurrentUserProfile().catch(() => null);
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const rowId = Number(id);
  if (!rowId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json().catch(() => ({})) as Partial<OutboundCampaign>;
  const tableId = TABLE_IDS.outbound_campaigns;
  if (!tableId) return NextResponse.json({ error: 'Table not configured' }, { status: 500 });

  const patch: Record<string, unknown> = {};
  if (body.title        !== undefined) patch.title        = body.title;
  if (body.status       !== undefined) patch.status       = body.status;
  if (body.channels     !== undefined) patch.channels     = body.channels;
  if (body.subject      !== undefined) patch.subject      = body.subject;
  if (body.message      !== undefined) patch.message      = body.message;
  if (body.company_uids !== undefined) patch.company_uids = body.company_uids;
  if (body.sent_at      !== undefined) patch.sent_at      = body.sent_at;
  if (body.send_count   !== undefined) patch.send_count   = body.send_count;

  const result = await nocoUpdate<OutboundCampaign>(tableId, rowId, patch);
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

  const tableId = TABLE_IDS.outbound_campaigns;
  if (!tableId) return NextResponse.json({ error: 'Table not configured' }, { status: 500 });

  await nocoDelete(tableId, rowId);
  return NextResponse.json({ ok: true });
}
