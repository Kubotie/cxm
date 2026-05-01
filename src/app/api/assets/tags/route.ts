// ─── GET /api/assets/tags ─────────────────────────────────────────────────────
// 全アセットからユニークなタグ一覧を返す。
// レスポンス: { tags: string[] }  ← 出現頻度降順

import { NextResponse } from 'next/server';
import { getAssets } from '@/lib/nocodb/assets';

export async function GET() {
  try {
    // タグが設定されているアセットを最大500件取得
    const assets = await getAssets({ limit: 500, offset: 0 });

    const tagCount: Record<string, number> = {};
    for (const asset of assets) {
      if (!asset.tags) continue;
      for (const raw of asset.tags.split(',')) {
        const tag = raw.trim();
        if (tag) tagCount[tag] = (tagCount[tag] ?? 0) + 1;
      }
    }

    // 出現頻度降順でソート
    const tags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);

    return NextResponse.json({ tags });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
