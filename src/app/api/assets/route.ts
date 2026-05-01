// ─── GET /api/assets ─────────────────────────────────────────────────────────
// CSMアセット一覧を取得する。
//
// クエリパラメータ:
//   q:            全文検索（title / summary）
//   category:     カテゴリフィルタ
//   author:       作成者名フィルタ
//   source_type:  uploaded | ai_plan | review
//   tag:          タグフィルタ（部分一致）
//   sort_by:      created_at | reference_count | title（デフォルト: created_at）
//   sort_dir:     asc | desc（デフォルト: desc）
//   limit:        件数（デフォルト50）
//   offset:       オフセット（デフォルト0）
//
// レスポンス: { assets: CsmAsset[] }

import { NextRequest, NextResponse } from 'next/server';
import { getAssets, type AssetSortBy } from '@/lib/nocodb/assets';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const q               = searchParams.get('q')             ?? undefined;
  const category        = searchParams.get('category')      ?? undefined;
  const author          = searchParams.get('author')        ?? undefined;
  const source_type     = searchParams.get('source_type')   ?? undefined;
  const linked_action_id= searchParams.get('linked_action_id') ?? undefined;
  const tag             = searchParams.get('tag')           ?? undefined;
  const sort_by         = (searchParams.get('sort_by')      ?? 'created_at') as AssetSortBy;
  const sort_dir        = (searchParams.get('sort_dir')     ?? 'desc') as 'asc' | 'desc';
  const limit           = parseInt(searchParams.get('limit') ?? '50', 10);
  const offset          = parseInt(searchParams.get('offset') ?? '0', 10);

  try {
    const assets = await getAssets({
      q, category, author, source_type, linked_action_id,
      tag, sort_by, sort_dir, limit, offset,
    });
    return NextResponse.json({ assets });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
