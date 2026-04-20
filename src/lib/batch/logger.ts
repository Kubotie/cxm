// ─── Batch Run Logger ─────────────────────────────────────────────────────────
// バッチ実行ログを記録する共通ヘルパー。
//
// Phase 1（fallback）: console.log に structured JSON を出力。
// Phase 2（現在）    : NOCODB_AUDIT_LOGS_TABLE_ID が設定されている場合は NocoDB の
//                      audit_logs テーブルへ保存し、作成されたレコード ID を返す。
//                      未設定 or 保存失敗時は Phase 1 へ fallback（実行自体は止めない）。
//
// ── NocoDB audit_logs テーブル 必須カラム ─────────────────────────────────────
//   endpoint        : Single line text
//   batch_type      : Single line text
//   started_at      : Single line text (ISO8601)
//   finished_at     : Single line text (ISO8601)
//   duration_ms     : Number
//   dry_run         : Checkbox
//   source_queue    : Single line text
//   request_params  : Long text (JSON 文字列)
//   filters         : Long text (JSON 文字列 — freshness_filter 等)
//   total_targeted  : Number
//   ok_count        : Number
//   success_count   : Number
//   partial_count   : Number
//   failed_count    : Number
//   skipped_count   : Number
//   failure_details : Long text (JSON 文字列)
//   result_json     : Long text (JSON 文字列 — レスポンス全体の要約。64KB 上限)
//
// ── 使用方法 ──────────────────────────────────────────────────────────────────
//   const { logId } = await writeBatchRunLog({ ... });
//   // logId: NocoDB Row ID（保存成功時）または null（fallback 時）

import { TABLE_IDS }  from '@/lib/nocodb/client';
import { nocoCreate } from '@/lib/nocodb/write';

// ── 型定義 ───────────────────────────────────────────────────────────────────

export interface BatchRunLog {
  /** 呼び出された API パス */
  endpoint:        string;
  /**
   * batch 種別の識別子。
   * 例: 'company-summary-regenerate' | 'company-summary-review' | 'support-rebuild-ai-state'
   */
  batch_type?:     string;
  /** ISO8601 */
  started_at:      string;
  /** ISO8601 */
  finished_at:     string;
  /** 実行時間（ms） */
  duration_ms:     number;
  /** dry_run フラグ */
  dry_run:         boolean;
  /** 対象キュー名 */
  source_queue:    string;
  /** リクエストパラメータのサマリー（JSON 文字列、センシティブ情報除く） */
  request_params:  string;
  /**
   * フィルタ条件（JSON 文字列）。
   * freshness_filter / review_filter 等を記録する。
   * 例: '{"freshness_filter":["missing","stale"]}'
   */
  filters?:        string;
  /** 処理対象件数 */
  total_targeted:  number;
  /** ok / updated 件数（success_count と同義だが review batch では ok_count を使う） */
  ok_count?:       number;
  /** 成功件数（regenerate batch では success_count を使う） */
  success_count:   number;
  /** 一部ステップ成功（rebuild-ai-state のみ。該当しない場合は 0） */
  partial_count:   number;
  /** 失敗件数 */
  failed_count:    number;
  /** スキップ件数（保護レコード・missing 等） */
  skipped_count:   number;
  /** failures[] を JSON 文字列化したもの */
  failure_details: string;
  /**
   * レスポンス全体の要約 JSON（オプション）。
   * 64KB 超は先頭を切り取り保存する。
   * batch 実行の再現・監査に使う。
   */
  result_json?:    string;
}

/** NocoDB audit_logs レコードの raw 型 */
interface RawAuditLog {
  Id: number;
}

/** writeBatchRunLog の戻り値 */
export interface BatchRunLogResult {
  /** NocoDB に保存されたレコード ID。fallback 時は null。 */
  logId: number | null;
  /** NocoDB への保存が成功したか */
  persisted: boolean;
}

// ── 定数 ─────────────────────────────────────────────────────────────────────

const MAX_RESULT_JSON_BYTES = 64 * 1024; // 64KB

// ── メイン helper ─────────────────────────────────────────────────────────────

/**
 * バッチ実行ログを記録する。
 *
 * - NOCODB_AUDIT_LOGS_TABLE_ID が設定されている場合: NocoDB へ保存し logId を返す。
 * - 未設定 or 保存失敗: console.log に出力し logId=null で返す（fallback）。
 *
 * @returns { logId, persisted }
 */
export async function writeBatchRunLog(log: BatchRunLog): Promise<BatchRunLogResult> {
  // ── console サマリー（常に出力） ─────────────────────────────────────────
  const summary = {
    endpoint:       log.endpoint,
    batch_type:     log.batch_type,
    started_at:     log.started_at,
    duration_ms:    log.duration_ms,
    dry_run:        log.dry_run,
    total_targeted: log.total_targeted,
    ok_count:       log.ok_count ?? log.success_count,
    failed_count:   log.failed_count,
    skipped_count:  log.skipped_count,
    ...(log.failed_count > 0 && { failures: JSON.parse(log.failure_details) }),
  };
  console.log('[batch-run]', JSON.stringify(summary));

  // ── Phase 2: NocoDB 保存 ──────────────────────────────────────────────────
  const tableId = TABLE_IDS.audit_logs;
  if (!tableId) {
    // テーブル未設定 → fallback
    console.warn('[batch-run] NOCODB_AUDIT_LOGS_TABLE_ID 未設定。console.log のみ記録しています。');
    return { logId: null, persisted: false };
  }

  // result_json が大きすぎる場合は切り詰め
  const resultJson = log.result_json
    ? truncateJson(log.result_json, MAX_RESULT_JSON_BYTES)
    : undefined;

  try {
    const record = await nocoCreate<RawAuditLog>(tableId, {
      endpoint:        log.endpoint,
      batch_type:      log.batch_type    ?? deriveType(log.endpoint),
      started_at:      log.started_at,
      finished_at:     log.finished_at,
      duration_ms:     log.duration_ms,
      dry_run:         log.dry_run,
      source_queue:    log.source_queue,
      request_params:  log.request_params,
      filters:         log.filters        ?? '{}',
      total_targeted:  log.total_targeted,
      ok_count:        log.ok_count       ?? log.success_count,
      success_count:   log.success_count,
      partial_count:   log.partial_count,
      failed_count:    log.failed_count,
      skipped_count:   log.skipped_count,
      failure_details: log.failure_details,
      ...(resultJson !== undefined && { result_json: resultJson }),
    });
    console.log(`[batch-run] audit_log 保存完了: Id=${record.Id}`);
    return { logId: record.Id, persisted: true };
  } catch (err) {
    // 保存失敗は実行を止めない（fallback）
    console.error('[batch-run] audit_log 保存失敗（実行は継続）:', err instanceof Error ? err.message : err);
    return { logId: null, persisted: false };
  }
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

/** endpoint から batch_type を推測する（batch_type 未指定時の fallback） */
function deriveType(endpoint: string): string {
  if (endpoint.includes('company-summary-review')) return 'company-summary-review';
  if (endpoint.includes('company-summary'))        return 'company-summary-regenerate';
  if (endpoint.includes('rebuild-ai-state'))       return 'support-rebuild-ai-state';
  if (endpoint.includes('rebuild-alerts'))         return 'support-rebuild-alerts';
  if (endpoint.includes('unified-log'))            return 'unified-log-signals';
  return endpoint.replace(/^\/api\//, '').replace(/\//g, '-');
}

/** JSON 文字列をバイト制限まで切り詰める */
function truncateJson(json: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  const bytes   = encoder.encode(json);
  if (bytes.length <= maxBytes) return json;
  // 切り詰め後は末尾に truncation マーカーを付ける
  const sliced  = bytes.slice(0, maxBytes - 32);
  const decoded = new TextDecoder().decode(sliced);
  return decoded + '...[TRUNCATED]"}}';
}

// ── サニタイズヘルパー ────────────────────────────────────────────────────────

/**
 * リクエストボディからセンシティブ情報を除いたサマリーを JSON 文字列として返す。
 * case_ids / company_uids は件数のみ記録（内容は記録しない）。
 */
export function sanitizeRequestParams(
  body: Record<string, unknown>,
): string {
  const { case_ids, company_uids, ...rest } = body;
  const params: Record<string, unknown> = { ...rest };
  if (case_ids !== undefined) {
    params.case_ids_count = Array.isArray(case_ids) ? case_ids.length : 1;
  }
  if (company_uids !== undefined) {
    params.company_uids_count = Array.isArray(company_uids) ? company_uids.length : 1;
  }
  return JSON.stringify(params);
}
