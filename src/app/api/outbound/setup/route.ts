// POST /api/outbound/setup
// outbound_campaigns / outbound_audiences テーブルに Id (auto-increment PK) と
// campaign_id / audience_id (UUID) フィールドを追加するワンタイムセットアップ。
// 既にフィールドが存在する場合は NocoDB がエラーを返すが無視して続行する。
//
// 使い方: curl -X POST https://<host>/api/outbound/setup
// (admin 権限が必要)

import { NextResponse }          from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';
import { TABLE_IDS }             from '@/lib/nocodb/client';

const API_TOKEN = process.env.NOCODB_API_TOKEN ?? '';
const BASE_URL  = process.env.NOCODB_BASE_URL  ?? 'https://odtable.ptmind.ai';

async function addField(tableId: string, field: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/api/v2/meta/tables/${tableId}/fields`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'xc-token': API_TOKEN },
    body:    JSON.stringify(field),
  });
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, field: field.title, body };
}

export async function POST() {
  const profile = await getCurrentUserProfile().catch(() => null);
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (profile.role !== 'admin' && profile.role !== 'ops') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const campaignsId = TABLE_IDS.outbound_campaigns;
  const audiencesId = TABLE_IDS.outbound_audiences;

  const results: unknown[] = [];

  // campaigns テーブルに Id (auto-increment PK) を追加
  if (campaignsId) {
    results.push(await addField(campaignsId, {
      title: 'Id', uidt: 'ID', pk: true, ai: true, system: false,
    }));
    // campaign_id (Text, UUID) を追加
    results.push(await addField(campaignsId, {
      title: 'campaign_id', uidt: 'SingleLineText',
    }));
  }

  // audiences テーブルに Id を追加
  if (audiencesId) {
    results.push(await addField(audiencesId, {
      title: 'Id', uidt: 'ID', pk: true, ai: true, system: false,
    }));
  }

  return NextResponse.json({ results });
}
