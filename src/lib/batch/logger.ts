// ─── Batch Run Logger ─────────────────────────────────────────────────────────
// バッチ実行ログを記録する共通ヘルパー。
//
// Phase 1（現在）: console.log に structured JSON を出力。
// Phase 2（将来）: NocoDB の audit_logs テーブルへ保存。
//   → TABLE_IDS.audit_logs を追加し、nocoCreate() で保存する。
//
// NocoDB への保存を見据えて、型は NocoDB が扱える flat な構造にしている。
// 配列は JSON 文字列化して保存する（failure_details, steps）。
//
// ── フィールド一覧 ────────────────────────────────────────────────────────────
// endpoint        : 呼び出された API パス
// started_at      : ISO8601
// finished_at     : ISO8601
// duration_ms     : 実行時間（ms）
// dry_run         : dry_run フラグ
// source_queue    : 対象キュー名
// request_params  : リクエストパラメータのサマリー（JSON 文字列、センシティブ情報除く）
// total_targeted  : 処理対象件数
// success_count   : 成功件数
// partial_count   : 一部成功件数（rebuild-ai-state のみ）
// failed_count    : 失敗件数
// skipped_count   : スキップ件数（保護レコード）
// failure_details : failures[]{case_id, reason} を JSON 文字列化したもの

export interface BatchRunLog {
  endpoint:        string;
  started_at:      string;
  finished_at:     string;
  duration_ms:     number;
  dry_run:         boolean;
  source_queue:    string;
  /** リクエストパラメータのサマリー（JSON 文字列） */
  request_params:  string;
  total_targeted:  number;
  success_count:   number;
  /** 一部ステップ成功（rebuild-ai-state のみ。該当しない場合は 0）*/
  partial_count:   number;
  failed_count:    number;
  skipped_count:   number;
  /** Array<{ case_id: string; reason: string }> を JSON 文字列化 */
  failure_details: string;
}

/**
 * バッチ実行ログを記録する。
 *
 * Phase 1: console.log に出力。
 * Phase 2: NocoDB audit_logs テーブルへ保存（下記 TODO を参照）。
 */
export async function writeBatchRunLog(log: BatchRunLog): Promise<void> {
  // ── Phase 1: console 出力 ─────────────────────────────────────────────────
  // jq などで見やすいよう key を絞った summary を先に出す
  const summary = {
    endpoint:       log.endpoint,
    started_at:     log.started_at,
    duration_ms:    log.duration_ms,
    dry_run:        log.dry_run,
    source_queue:   log.source_queue,
    total_targeted: log.total_targeted,
    success_count:  log.success_count,
    ...(log.partial_count > 0 && { partial_count: log.partial_count }),
    failed_count:   log.failed_count,
    skipped_count:  log.skipped_count,
    ...(log.failed_count > 0 && { failures: JSON.parse(log.failure_details) }),
  };
  console.log('[batch-run]', JSON.stringify(summary));

  // ── Phase 2: NocoDB audit_logs への保存（TODO） ───────────────────────────
  //
  // 実装方法:
  //   1. NocoDB に audit_logs テーブルを作成
  //      必須カラム: endpoint, started_at, finished_at, duration_ms, dry_run,
  //                  source_queue, request_params, total_targeted, success_count,
  //                  partial_count, failed_count, skipped_count, failure_details
  //   2. .env.local に NOCODB_AUDIT_LOGS_TABLE_ID を追加
  //   3. client.ts の TABLE_IDS に audit_logs を追加
  //   4. 下記コメントを解除
  //
  // import { nocoCreate, TABLE_IDS } from '@/lib/nocodb/client';
  // if (TABLE_IDS.audit_logs) {
  //   await nocoCreate(TABLE_IDS.audit_logs, log).catch(err =>
  //     console.error('[batch-run] audit log 保存失敗（無視して続行）:', err),
  //   );
  // }
}

// ── サニタイズヘルパー ────────────────────────────────────────────────────────

/**
 * リクエストボディからセンシティブ情報を除いたサマリーを JSON 文字列として返す。
 * case_ids は件数のみ記録（内容は記録しない）。
 */
export function sanitizeRequestParams(
  body: Record<string, unknown>,
): string {
  const { case_ids, ...rest } = body;
  const params: Record<string, unknown> = { ...rest };
  if (case_ids !== undefined) {
    params.case_ids_count = Array.isArray(case_ids) ? case_ids.length : 1;
  }
  return JSON.stringify(params);
}
