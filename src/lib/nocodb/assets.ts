// ─── CSMアセット NocoDB ヘルパー ─────────────────────────────────────────────
// csm_assets テーブルの CRUD 操作。

import { TABLE_IDS, nocoFetch } from './client';
import { nocoCreate, nocoUpdate } from './write';

export interface CsmAsset {
  Id: number;
  asset_id: string;
  title: string;
  content: string;
  blob_url: string | null;
  category: '事例' | 'AI計画' | 'アカウントプランニング' | 'ノウハウ・マニュアル' | 'その他' | null;
  category_reason: string | null;
  summary: string | null;
  author: string | null;
  source_type: 'uploaded' | 'ai_plan' | 'review';
  linked_action_id: string | null;
  reference_count: number;
  created_by: string | null;
  created_at: string | null;
  tags: string | null;
}

export type AssetSortBy = 'created_at' | 'reference_count' | 'title';

export interface GetAssetsOptions {
  q?: string;
  category?: string;
  author?: string;
  source_type?: string;
  linked_action_id?: string;
  tag?: string;
  sort_by?: AssetSortBy;
  sort_dir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/** アセット一覧を取得（検索・フィルタ・ソート対応） */
export async function getAssets(opts: GetAssetsOptions = {}): Promise<CsmAsset[]> {
  const {
    q, category, author, source_type, linked_action_id, tag,
    sort_by = 'created_at', sort_dir = 'desc',
    limit = 50, offset = 0,
  } = opts;

  const sortPrefix = sort_dir === 'asc' ? '' : '-';
  const params: Record<string, string> = {
    limit: String(limit),
    offset: String(offset),
    sort: `${sortPrefix}${sort_by}`,
  };

  const filters: string[] = [];
  if (q) {
    filters.push(`(title,like,%${q}%)~or(summary,like,%${q}%)`);
  }
  if (category) {
    filters.push(`(category,eq,${category})`);
  }
  if (author) {
    filters.push(`(author,eq,${author})`);
  }
  if (source_type) {
    filters.push(`(source_type,eq,${source_type})`);
  }
  if (linked_action_id) {
    filters.push(`(linked_action_id,eq,${linked_action_id})`);
  }
  if (tag) {
    filters.push(`(tags,like,%${tag}%)`);
  }

  if (filters.length > 0) {
    params.where = filters.join('~and');
  }

  return nocoFetch<CsmAsset>(TABLE_IDS.csm_assets, params, false);
}

/** IDでアセットを1件取得 */
export async function getAssetById(asset_id: string): Promise<CsmAsset | null> {
  const list = await nocoFetch<CsmAsset>(
    TABLE_IDS.csm_assets,
    { where: `(asset_id,eq,${asset_id})`, limit: '1' },
    false,
  );
  return list[0] ?? null;
}

/** 新規アセットを作成 */
export async function createAsset(
  payload: Omit<CsmAsset, 'Id' | 'reference_count'> & { reference_count?: number },
): Promise<CsmAsset> {
  return nocoCreate<CsmAsset>(TABLE_IDS.csm_assets, {
    reference_count: 0,
    ...payload,
  });
}

/** アセットのカテゴリ・サマリーを更新 */
export async function updateAssetCategory(
  rowId: number,
  patch: { category: string; category_reason: string; summary: string; title: string },
): Promise<CsmAsset> {
  return nocoUpdate<CsmAsset>(TABLE_IDS.csm_assets, rowId, patch);
}

/** reference_count を1インクリメント */
export async function incrementReferenceCount(rowId: number, current: number): Promise<void> {
  await nocoUpdate(TABLE_IDS.csm_assets, rowId, { reference_count: current + 1 });
}
