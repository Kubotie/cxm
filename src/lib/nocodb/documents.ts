// ─── CSMドキュメント NocoDB ヘルパー ─────────────────────────────────────────
// csm_documents テーブルの CRUD 操作。
//
// file_attachment カラム: NocoDB Attachment 型。
// 保存形式: JSON配列文字列 [{ url, title, mimetype, size }]
// 取得時: 文字列 or null → JSON.parse して配列に変換

import { TABLE_IDS, nocoFetch } from './client';
import { nocoCreate, nocoDelete } from './write';

export type DocumentFileType = 'pptx' | 'doc' | 'md' | 'pdf' | 'csv' | 'other';

/** NocoDB Attachment フィールドの 1 エントリ */
export interface NocoAttachment {
  url: string;
  title: string;
  mimetype: string;
  size?: number;
}

export interface CsmDocument {
  Id: number;
  document_id: string;
  document_type: DocumentFileType;
  template_type: string;
  title: string;
  referenced_asset_ids: string | null; // JSON配列文字列
  generated_content: string | null;    // SlideStructure JSON
  file_attachment: string | null;      // NocoDB Attachment JSON配列文字列
  blob_url: string | null;
  created_by: string | null;
  created_at: string | null;
}

export interface CreateDocumentPayload {
  document_id: string;
  document_type: DocumentFileType;
  template_type: string;
  title: string;
  referenced_asset_ids: string[];
  generated_content: string;
  /** Vercel Blob にアップロード済みのファイル情報 */
  attachment?: NocoAttachment;
  blob_url: string | null;
  created_by: string | null;
}

/** 新規ドキュメントを作成 */
export async function createDocument(payload: CreateDocumentPayload): Promise<CsmDocument> {
  const { attachment, ...rest } = payload;
  return nocoCreate<CsmDocument>(TABLE_IDS.csm_documents, {
    ...rest,
    referenced_asset_ids: JSON.stringify(payload.referenced_asset_ids),
    // NocoDB Attachment 型は JSON 配列文字列で保存
    file_attachment: attachment ? JSON.stringify([attachment]) : null,
    created_at: new Date().toISOString(),
  });
}

/** ドキュメント一覧を取得（userId を渡すとそのユーザーの分だけ返す） */
export async function getDocuments(limit = 50, userId?: string | null): Promise<CsmDocument[]> {
  const params: Record<string, string> = { limit: String(limit), sort: '-created_at' };
  if (userId) params.where = `(created_by,eq,${userId})`;
  return nocoFetch<CsmDocument>(TABLE_IDS.csm_documents, params, false);
}

/** file_attachment を NocoAttachment[] に変換するユーティリティ */
export function parseAttachments(doc: CsmDocument): NocoAttachment[] {
  if (!doc.file_attachment) return [];
  try {
    return JSON.parse(doc.file_attachment) as NocoAttachment[];
  } catch {
    return [];
  }
}

/** ドキュメントを削除 */
export async function deleteDocument(rowId: number): Promise<void> {
  return nocoDelete(TABLE_IDS.csm_documents, rowId);
}
