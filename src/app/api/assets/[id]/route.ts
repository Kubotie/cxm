// ─── GET/PATCH /api/assets/[id] ──────────────────────────────────────────────
// GET:  asset_id でアセットを1件取得
// PATCH: アセットのフィールドを更新（title / category / summary 等）

import { NextRequest, NextResponse } from 'next/server';
import { getAssetById } from '@/lib/nocodb/assets';
import { nocoUpdate } from '@/lib/nocodb/write';
import { TABLE_IDS } from '@/lib/nocodb/client';
import { requireUser } from '@/lib/auth/guard';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const asset = await getAssetById(id);
    if (!asset) {
      return NextResponse.json({ error: 'アセットが見つかりません' }, { status: 404 });
    }
    return NextResponse.json({ asset });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 書き込み系。middleware に加えてハンドラ側でも認証する（多層防御・2026-09-30 是正）
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const asset = await getAssetById(id);
    if (!asset) {
      return NextResponse.json({ error: 'アセットが見つかりません' }, { status: 404 });
    }

    const body = await req.json() as Record<string, unknown>;
    const updated = await nocoUpdate(TABLE_IDS.csm_assets, asset.Id, body);
    return NextResponse.json({ asset: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
