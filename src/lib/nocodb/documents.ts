// ─── CSMドキュメント NocoDB ヘルパー ─────────────────────────────────────────
// csm_documents テーブルの CRUD 操作。

import { TABLE_IDS, nocoFetch } from './client';
import { nocoCreate, nocoDelete } from './write';
export interface CsmDocument {
  Id: number;
  document_id: string;
  template_type: string; // deck_template_id
  title: string;
  referenced_asset_ids: string | null; // JSON配列文字列
  generated_content: string | null;    // SlideStructure JSON
  blob_url: string | null;
  created_by: string | null;
  created_at: string | null;
}

export interface CreateDocumentPayload {
  document_id: string;
  template_type: string;
  title: string;
  referenced_asset_ids: string[];
  generated_content: string;
  blob_url: string | null;
  created_by: string | null;
}

/** 新規ドキュメントを作成 */
export async function createDocument(payload: CreateDocumentPayload): Promise<CsmDocument> {
  return nocoCreate<CsmDocument>(TABLE_IDS.csm_documents, {
    ...payload,
    referenced_asset_ids: JSON.stringify(payload.referenced_asset_ids),
    created_at: new Date().toISOString(),
  });
}

/** ドキュメント一覧を取得 */
export async function getDocuments(limit = 50): Promise<CsmDocument[]> {
  return nocoFetch<CsmDocument>(
    TABLE_IDS.csm_documents,
    { limit: String(limit), sort: '-created_at' },
    false,
  );
}

/** ドキュメントを削除 */
export async function deleteDocument(rowId: number): Promise<void> {
  return nocoDelete(TABLE_IDS.csm_documents, rowId);
}
