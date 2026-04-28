// GET  /api/outbound/campaigns        — キャンペーン一覧
// POST /api/outbound/campaigns        — 新規作成（下書き）

import { NextResponse }          from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';
import { nocoFetch, TABLE_IDS }  from '@/lib/nocodb/client';
import { nocoCreate }            from '@/lib/nocodb/write';

export interface OutboundCampaign {
  Id:           number;
  title:        string;
  status:       'draft' | 'sent';
  channels:     string;          // JSON: string[]
  subject:      string;
  message:      string;          // HTML
  company_uids: string;          // JSON: string[]
  created_by:   string;
  sent_at:      string | null;
  send_count:   number | null;
  CreatedAt:    string;
  UpdatedAt:    string;
}

export async function GET() {
  const profile = await getCurrentUserProfile().catch(() => null);
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tableId = TABLE_IDS.outbound_campaigns;
  if (!tableId) return NextResponse.json([], { status: 200 });

  const rows = await nocoFetch<OutboundCampaign>(tableId, {
    sort:  '-UpdatedAt',
    limit: '200',
  }, false).catch(() => [] as OutboundCampaign[]);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const profile = await getCurrentUserProfile().catch(() => null);
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Partial<OutboundCampaign>;

  const tableId = TABLE_IDS.outbound_campaigns;
  if (!tableId) return NextResponse.json({ error: 'Table not configured' }, { status: 500 });

  const record = await nocoCreate<OutboundCampaign>(tableId, {
    title:        body.title        ?? '（無題）',
    status:       'draft',
    channels:     body.channels     ?? '["slack"]',
    subject:      body.subject      ?? '',
    message:      body.message      ?? '',
    company_uids: body.company_uids ?? '[]',
    created_by:   profile.name2,
    sent_at:      null,
    send_count:   null,
  });

  return NextResponse.json(record, { status: 201 });
}
