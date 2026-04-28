// ─── GET    /api/ops/ai-config ──────────────────────────────────────────────────
// AI 設定（システムプロンプト等）の一覧を返す。admin のみ。
//
// ─── PUT    /api/ops/ai-config ──────────────────────────────────────────────────
// 指定キーの AI 設定を保存（upsert）する。admin のみ。
// Body: { config_key, value, label, description? }
//
// ─── DELETE /api/ops/ai-config?key=xxx ──────────────────────────────────────────
// 指定キーの NocoDB レコードを削除する（コードデフォルトに戻る）。admin のみ。

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';
import { listAiConfigs, upsertAiConfig, deleteAiConfig } from '@/lib/nocodb/ai-config';
import { TABLE_IDS } from '@/lib/nocodb/client';

function isAdmin(role: string | null | undefined): boolean {
  return role === 'admin';
}

export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!isAdmin(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tableId = TABLE_IDS.ai_config;
  if (!tableId) {
    return NextResponse.json(
      { error: 'NOCODB_AI_CONFIG_TABLE_ID が未設定です', records: [] },
      { status: 200 },
    );
  }

  const records = await listAiConfigs();
  return NextResponse.json({ records });
}

export async function PUT(req: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!isAdmin(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tableId = TABLE_IDS.ai_config;
  if (!tableId) {
    return NextResponse.json(
      { error: 'NOCODB_AI_CONFIG_TABLE_ID が未設定です' },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { config_key, value, label, description } = body;

  if (!config_key || typeof config_key !== 'string') {
    return NextResponse.json({ error: 'config_key は必須です' }, { status: 400 });
  }
  if (value === undefined || typeof value !== 'string') {
    return NextResponse.json({ error: 'value は必須です' }, { status: 400 });
  }
  if (!label || typeof label !== 'string') {
    return NextResponse.json({ error: 'label は必須です' }, { status: 400 });
  }

  const updatedBy = profile?.name2 ?? 'unknown';

  await upsertAiConfig(
    config_key,
    value,
    label,
    updatedBy,
    typeof description === 'string' ? description : undefined,
  );

  return NextResponse.json({ ok: true, config_key });
}

export async function DELETE(req: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!isAdmin(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tableId = TABLE_IDS.ai_config;
  if (!tableId) {
    return NextResponse.json({ error: 'NOCODB_AI_CONFIG_TABLE_ID が未設定です' }, { status: 503 });
  }

  const key = req.nextUrl.searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'key パラメータが必要です' }, { status: 400 });
  }

  await deleteAiConfig(key);
  return NextResponse.json({ ok: true, config_key: key });
}
