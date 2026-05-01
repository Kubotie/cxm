// ─── PATCH /api/assets/[id]/reference ────────────────────────────────────────
// reference_count を1インクリメントする。
// 資料作成でアセットが参照されるたびに呼び出す。

import { NextRequest, NextResponse } from 'next/server';
import { getAssetById, incrementReferenceCount } from '@/lib/nocodb/assets';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
