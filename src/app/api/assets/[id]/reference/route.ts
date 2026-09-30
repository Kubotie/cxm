// ─── PATCH /api/assets/[id]/reference ────────────────────────────────────────
// reference_count を1インクリメントする。
// 資料作成でアセットが参照されるたびに呼び出す。

import { NextRequest, NextResponse } from 'next/server';
import { getAssetById, incrementReferenceCount } from '@/lib/nocodb/assets';
import { requireUser } from '@/lib/auth/guard';

export async function PATCH(
  _req: NextRequest,
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
    await incrementReferenceCount(asset.Id, asset.reference_count);
    return NextResponse.json({ reference_count: asset.reference_count + 1 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
