// ─── Source Reference ─────────────────────────────────────────────────────────
// Support 領域の derived data（support_case_ai_state, support_alerts）は
// source_table + source_id の複合キーで元レコードを参照する。
//
// このファイルはそのキー体系を一元管理する。
// read（support.ts）でも write（route handlers）でも同じ型を使うこと。

// ── source queue の名前一覧 ──────────────────────────────────────────────────

/**
 * Support 領域のソーステーブル名。
 * NocoDB の source_table フィールドに格納される文字列と一致させること。
 */
export type SourceQueueName =
  | 'support_queue'
  | 'inquiry_queue'
  | 'cseticket_queue';

export const SOURCE_QUEUE_NAMES: SourceQueueName[] = [
  'support_queue',
  'inquiry_queue',
  'cseticket_queue',
];

export function isSourceQueueName(v: unknown): v is SourceQueueName {
  return SOURCE_QUEUE_NAMES.includes(v as SourceQueueName);
}

// ── SourceRef 型 ─────────────────────────────────────────────────────────────

/**
 * source table + record ID の複合参照。
 * これが derived table のルックアップキーになる。
 *
 * - sourceQueue: ソーステーブル名（'support_queue' 等）
 * - sourceRecordId: そのテーブル内のレコード ID（case_id 等）
 */
export interface SourceRef {
  sourceQueue: SourceQueueName;
  sourceRecordId: string;
}

// ── NocoDB where 句への変換 ──────────────────────────────────────────────────

/**
 * SourceRef → NocoDB v2 の where 句文字列。
 * support_case_ai_state / support_alerts の派生テーブルを引くときに使う。
 *
 * 例: "(source_id,eq,case_001)~and(source_table,eq,support_queue)"
 */
export function sourceRefToWhere(ref: SourceRef): string {
  return `(source_id,eq,${ref.sourceRecordId})~and(source_table,eq,${ref.sourceQueue})`;
}

/**
 * route params から SourceRef を構築する。
 * sourceTable が不正値のときは 'support_queue' にフォールバックする。
 */
export function buildSourceRef(
  sourceRecordId: string,
  sourceTable: unknown = 'support_queue',
): SourceRef {
  return {
    sourceQueue: isSourceQueueName(sourceTable) ? sourceTable : 'support_queue',
    sourceRecordId,
  };
}
