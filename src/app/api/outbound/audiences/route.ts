// GET  /api/outbound/audiences  — 一覧取得
// POST /api/outbound/audiences  — 新規作成

import { NextResponse }          from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';
import { nocoFetch, TABLE_IDS }  from '@/lib/nocodb/client';
import { nocoCreate }            from '@/lib/nocodb/write';
import { randomUUID }            from 'crypto';

export interface OutboundAudience {
  Id:                   number;
  audience_id:          string;
  name:                 string;
  company_uids:         string; // JSON: string[]
  per_company_channels: string; // JSON: Record<string, string[]>
  mail_targets:         string; // JSON: Record<string, {to: {email: string; name: string}[]; cc: string[]}>
  created_by:           string;
  CreatedAt:            string;
  UpdatedAt:            string;
}

export async function GET() {
  const profile = await getCurrentUserProfile().catch(() => null);
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tableId = TABLE_IDS.outbound_audiences;
  if (!tableId) return NextResponse.json([], { status: 200 });

  const rows = await nocoFetch<OutboundAudience>(tableId, {
    sort:  '-UpdatedAt',
    limit: '200',
  }, false).catch(() => [] as OutboundAudience[]);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const profile = await getCurrentUserProfile().catch(() => null);
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Partial<OutboundAudience>;

  const tableId = TABLE_IDS.outbound_audiences;
  if (!tableId) return NextResponse.json({ error: 'Table not configured' }, { status: 500 });

  const record = await nocoCreate<OutboundAudience>(tableId, {
    audience_id:          randomUUID(),
    name:                 body.name                 ?? '（無題）',
    company_uids:         body.company_uids         ?? '[]',
    per_company_channels: body.per_company_channels ?? '{}',
    mail_targets:         body.mail_targets         ?? '{}',
    created_by:           profile.name2,
  });

  return NextResponse.json(record, { status: 201 });
}
