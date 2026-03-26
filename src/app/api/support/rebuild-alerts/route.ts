// ─── POST /api/support/rebuild-alerts ────────────────────────────────────────
// support_queue の複数案件に対して support_alerts を一括再生成するバッチ入口。
//
// ── リクエストボディ ──────────────────────────────────────────────────────────
// {
//   limit?:        number;    // 最大処理件数 (default: 10, max: 50)
//   source_queue?: string;    // 対象キュー名 (default: "support_queue")
//   company_uid?:  string;    // 特定企業案件のみ対象
//   case_ids?:     string[];  // 特定 caseId のみ対象（limit より優先）
//   dry_run?:      boolean;   // true のとき対象件数だけ返し、write しない (default: false)
// }
//
// ── レスポンス（通常） ────────────────────────────────────────────────────────
// {
//   dry_run:        false,
//   started_at:     ISO8601,
//   finished_at:    ISO8601,
//   duration_ms:    number,
//   source_queue:   string,
//   limit:          number,
//   total_targeted: number,
//   success_count:  number,
//   failed_count:   number,
//   skipped_count:  number,   // Resolved/Dismissed アラートは上書きしない（正常動作）
//   failures: [{ case_id, reason }],  // failed のみ記録
//   results:  [{ case_id, status, alert_type?, priority?, saved?, skip_reason?, error? }]
// }
//
// ── レスポンス（dry_run=true） ─────────────────────────────────────────────────
// {
//   dry_run:         true,
//   source_queue:    string,
//   limit:           number,
//   total_targeted:  number,
//   target_case_ids: string[],
//   success_count:   0,
//   failed_count:    0,
//   skipped_count:   0,
//   failures:        [],
// }
//
// ── ステータス定義 ────────────────────────────────────────────────────────────
// ok      : 生成成功 + 保存成功
// failed  : OpenAI エラー または NocoDB 保存エラー（failures[] に記録）
// skipped : 既存アラートが Resolved/Dismissed のため上書きスキップ（正常動作）
//
// ── 保護方針 ─────────────────────────────────────────────────────────────────
// - limit は MAX_LIMIT=50 でキャップ（scheduler による大量誤実行を防ぐ）
// - source tables（support_queue 等）は一切更新しない
// - status が Resolved/Dismissed のアラートは上書きしない
// - dry_run=true を使って対象件数を確認してから本実行できる

import { NextRequest, NextResponse } from 'next/server';
import { checkBatchAuth } from '@/lib/batch/auth';
import { writeBatchRunLog, sanitizeRequestParams } from '@/lib/batch/logger';
import {
  getSupportQueueList,
  getSupportQueueByCompanyUid,
  getSupportCaseById,
  getCseTicketQueueByCompanyOrCase,
  getSupportCaseAIStateBySource,
} from '@/lib/nocodb/support';
import { buildSourceRef, isSourceQueueName } from '@/lib/support/source-ref';
import { getOpenAIClient, getOpenAIModel } from '@/lib/openai/client';
import {
  SUPPORT_ALERT_SYSTEM_PROMPT,
  SUPPORT_ALERT_JSON_SCHEMA,
  buildSupportAlertPrompt,
} from '@/lib/prompts/support-alert';
import type { SupportAlertResult } from '@/lib/prompts/support-alert';
import type { SupportAlertWritePayload } from '@/lib/support/ai-types';
import { saveSupportAlert } from '@/lib/nocodb/support-write';
import type { AppSupportCase } from '@/lib/nocodb/types';

// ── 定数 ─────────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 10;
const MAX_LIMIT     = 50;

// ── リクエスト / レスポンス型 ─────────────────────────────────────────────────

interface RequestBody {
  limit?:       number;
  source_queue?: string;
  company_uid?: string;
  case_ids?:    string[];
  dry_run?:     boolean;
}

interface Failure {
  case_id: string;
  reason:  string;
}

interface AlertCaseResult {
  case_id:      string;
  status:       'ok' | 'failed' | 'skipped';
  alert_type?:  string;
  priority?:    string;
  saved?:       boolean;
  skip_reason?: string;
  error?:       string;
}

// ── per-case 処理 ─────────────────────────────────────────────────────────────

async function processCase(
  sc: AppSupportCase,
  opts: {
    sourceQueue: string;
    openai:      ReturnType<typeof getOpenAIClient>;
    model:       string;
  },
): Promise<AlertCaseResult> {
  const caseId = sc.id;
  const ref    = buildSourceRef(caseId, opts.sourceQueue);

  try {
    // 補助データ（失敗は無視して空値にフォールバック）
    const [cseTickets, aiState] = await Promise.all([
      getCseTicketQueueByCompanyOrCase({ caseId }).catch(() => []),
      getSupportCaseAIStateBySource(ref.sourceRecordId, ref.sourceQueue).catch(() => null),
    ]);

    // ── OpenAI でアラート生成 ────────────────────────────────────────────────
    const comp = await opts.openai.chat.completions.create({
      model: opts.model,
      messages: [
        { role: 'system', content: SUPPORT_ALERT_SYSTEM_PROMPT },
        { role: 'user',   content: buildSupportAlertPrompt(sc, { cseTickets, aiState }) },
      ],
      response_format: { type: 'json_schema', json_schema: SUPPORT_ALERT_JSON_SCHEMA },
    });

    const raw = comp.choices[0].message.content;
    if (!raw) throw new Error('OpenAI から空のレスポンス');

    const result: SupportAlertResult = JSON.parse(raw);

    // ── NocoDB への保存 ─────────────────────────────────────────────────────
    const writePayload: SupportAlertWritePayload = {
      source_id:         ref.sourceRecordId,
      source_table:      ref.sourceQueue,
      alert_type:        result.alert_type,
      priority:          result.priority,
      status:            result.status,
      title:             result.title,
      summary:           result.summary,
      why_this_matters:  result.why_this_matters,
      suggested_action:  result.suggested_action,
      escalation_needed: result.escalation_needed,
      source:            ref.sourceQueue,
      company_name:      sc.company ?? undefined,
      company_uid:       sc.companyId ?? undefined,
      generated_by:      comp.model,
    };

    const saveResult = await saveSupportAlert(writePayload);

    if (saveResult.ok) {
      return { case_id: caseId, status: 'ok', alert_type: result.alert_type, priority: result.priority, saved: true };
    }

    const r = saveResult as Extract<typeof saveResult, { ok: false }>;
    if (r.skipped) {
      return { case_id: caseId, status: 'skipped', alert_type: result.alert_type, priority: result.priority, skip_reason: r.reason };
    }
    const e = (r as { ok: false; skipped: false; error: string }).error;
    console.warn(`[rebuild-alerts] ${caseId} 保存失敗:`, e);
    return { case_id: caseId, status: 'failed', error: `保存エラー: ${e}` };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[rebuild-alerts] ${caseId} 処理エラー:`, err);
    return { case_id: caseId, status: 'failed', error: msg };
  }
}

// ── 対象ケース取得 ─────────────────────────────────────────────────────────────

async function resolveTargetCases(
  body: RequestBody,
  limit: number,
): Promise<AppSupportCase[]> {
  if (body.case_ids && body.case_ids.length > 0) {
    const fetched = await Promise.all(
      body.case_ids.slice(0, limit).map(id => getSupportCaseById(id).catch(() => null)),
    );
    return fetched.filter((c): c is AppSupportCase => c !== null);
  }
  if (body.company_uid) {
    return getSupportQueueByCompanyUid(body.company_uid, limit);
  }
  return getSupportQueueList(limit);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 認証 ──────────────────────────────────────────────────────────────────
  const authError = checkBatchAuth(req);
  if (authError) return authError;

  const startedAt = new Date();
  const body: RequestBody = await req.json().catch(() => ({}));

  // ── パラメータ正規化 ───────────────────────────────────────────────────────
  const limit       = Math.min(body.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const sourceQueue = isSourceQueueName(body.source_queue) ? body.source_queue : 'support_queue';
  const dryRun      = body.dry_run ?? false;

  // ── 対象ケース取得 ─────────────────────────────────────────────────────────
  let targetCases: AppSupportCase[];
  try {
    targetCases = await resolveTargetCases(body, limit);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[rebuild-alerts] 対象ケース取得失敗:', err);
    return NextResponse.json({ error: `ケース取得エラー: ${msg}` }, { status: 500 });
  }

  // ── dry_run: write せず対象だけ返す ──────────────────────────────────────
  if (dryRun) {
    const finishedAt = new Date();
    await writeBatchRunLog({
      endpoint:        '/api/support/rebuild-alerts',
      started_at:      startedAt.toISOString(),
      finished_at:     finishedAt.toISOString(),
      duration_ms:     finishedAt.getTime() - startedAt.getTime(),
      dry_run:         true,
      source_queue:    sourceQueue,
      request_params:  sanitizeRequestParams(body as Record<string, unknown>),
      total_targeted:  targetCases.length,
      success_count:   0,
      partial_count:   0,
      failed_count:    0,
      skipped_count:   0,
      failure_details: '[]',
    });
    return NextResponse.json({
      dry_run:         true,
      source_queue:    sourceQueue,
      limit,
      total_targeted:  targetCases.length,
      target_case_ids: targetCases.map(c => c.id),
      success_count:   0,
      failed_count:    0,
      skipped_count:   0,
      failures:        [] as Failure[],
      note: '対象ケースの確認のみ。dry_run=false で実行すると書き込みを行います。',
    });
  }

  if (targetCases.length === 0) {
    return NextResponse.json({
      dry_run:        false,
      started_at:     startedAt.toISOString(),
      finished_at:    new Date().toISOString(),
      duration_ms:    Date.now() - startedAt.getTime(),
      source_queue:   sourceQueue,
      limit,
      total_targeted: 0,
      success_count:  0,
      failed_count:   0,
      skipped_count:  0,
      failures:       [] as Failure[],
      results:        [],
      note: '対象ケースが見つかりませんでした（NocoDB テーブル未設定またはキューが空）',
    });
  }

  // ── OpenAI クライアント初期化 ──────────────────────────────────────────────
  let openai: ReturnType<typeof getOpenAIClient>;
  let model: string;
  try {
    openai = getOpenAIClient();
    model  = getOpenAIModel();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  // ── per-case 処理（順次実行 - rate limit 配慮）────────────────────────────
  const caseResults: AlertCaseResult[] = [];

  for (const sc of targetCases) {
    console.log(`[rebuild-alerts] processing ${sc.id} (${sc.title?.slice(0, 40)})`);
    const r = await processCase(sc, { sourceQueue, openai, model });
    caseResults.push(r);
    console.log(`[rebuild-alerts] ${sc.id} → ${r.status}${r.alert_type ? ` (${r.alert_type}/${r.priority})` : ''}`);
  }

  // ── 集計 ──────────────────────────────────────────────────────────────────
  let successCount = 0, failedCount = 0, skippedCount = 0;
  const failures: Failure[] = [];

  for (const r of caseResults) {
    if      (r.status === 'ok')      successCount++;
    else if (r.status === 'failed')  { failedCount++; failures.push({ case_id: r.case_id, reason: r.error ?? 'unknown' }); }
    else if (r.status === 'skipped') skippedCount++;
  }

  const finishedAt = new Date();

  await writeBatchRunLog({
    endpoint:        '/api/support/rebuild-alerts',
    started_at:      startedAt.toISOString(),
    finished_at:     finishedAt.toISOString(),
    duration_ms:     finishedAt.getTime() - startedAt.getTime(),
    dry_run:         false,
    source_queue:    sourceQueue,
    request_params:  sanitizeRequestParams(body as Record<string, unknown>),
    total_targeted:  caseResults.length,
    success_count:   successCount,
    partial_count:   0,
    failed_count:    failedCount,
    skipped_count:   skippedCount,
    failure_details: JSON.stringify(failures),
  });

  return NextResponse.json({
    dry_run:        false,
    started_at:     startedAt.toISOString(),
    finished_at:    finishedAt.toISOString(),
    duration_ms:    finishedAt.getTime() - startedAt.getTime(),
    source_queue:   sourceQueue,
    limit,
    total_targeted: caseResults.length,
    success_count:  successCount,
    failed_count:   failedCount,
    skipped_count:  skippedCount,
    failures,
    results:        caseResults,
  });
}
