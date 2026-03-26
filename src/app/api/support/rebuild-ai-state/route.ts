// ─── POST /api/support/rebuild-ai-state ──────────────────────────────────────
// support_queue の複数案件に対して summary / triage / draft_reply を一括再生成し、
// support_case_ai_state へ保存するバッチ入口。
//
// ── リクエストボディ ──────────────────────────────────────────────────────────
// {
//   limit?:          number;    // 最大処理件数 (default: 10, max: 50)
//   source_queue?:   string;    // 対象キュー名 (default: "support_queue")
//   company_uid?:    string;    // 特定企業案件のみ対象
//   case_ids?:       string[];  // 特定 caseId のみ対象（limit より優先）
//   dry_run?:        boolean;   // true のとき対象件数だけ返し、write しない (default: false)
//   steps?:          ("summary"|"triage"|"draft_reply")[];  // (default: 全3ステップ)
//   draft_tone?:     "formal"|"friendly"|"technical";       // (default: "formal")
//   draft_language?: "ja"|"en";                             // (default: "ja")
// }
//
// ── レスポンス（通常） ────────────────────────────────────────────────────────
// {
//   dry_run:        false,
//   started_at:     ISO8601,
//   finished_at:    ISO8601,
//   duration_ms:    number,
//   source_queue:   string,
//   steps:          string[],
//   limit:          number,
//   total_targeted: number,
//   success_count:  number,   // status=ok のみ
//   partial_count:  number,   // 一部ステップ成功
//   failed_count:   number,
//   skipped_count:  number,   // 保護レコードでスキップ（正常動作）
//   failures: [{ case_id, reason }],  // failed のみ記録
//   results:  [{ case_id, status, steps, saved?, skip_reason?, errors }]
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
//   partial_count:   0,
//   failed_count:    0,
//   skipped_count:   0,
//   failures:        [],
// }
//
// ── ステータス定義 ────────────────────────────────────────────────────────────
// ok      : 全ステップ成功 + 保存成功
// partial : 一部ステップ成功 + 成功分は保存済み
// failed  : 全ステップ失敗 または 保存エラー（failures[] に記録）
// skipped : human_review_status が保護状態のため上書きスキップ（正常動作）
//
// ── 保護方針 ─────────────────────────────────────────────────────────────────
// - limit は MAX_LIMIT=50 でキャップ（scheduler による大量誤実行を防ぐ）
// - source tables（support_queue 等）は一切更新しない
// - human_review_status が approved/locked/finalized のレコードは上書きしない
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
  SUPPORT_SUMMARY_SYSTEM_PROMPT,
  SUPPORT_SUMMARY_JSON_SCHEMA,
  buildSupportSummaryPrompt,
} from '@/lib/prompts/support-summary';
import type { SupportSummaryResult } from '@/lib/prompts/support-summary';
import {
  SUPPORT_TRIAGE_SYSTEM_PROMPT,
  SUPPORT_TRIAGE_JSON_SCHEMA,
  buildSupportTriagePrompt,
} from '@/lib/prompts/support-triage';
import type { SupportTriageResult } from '@/lib/prompts/support-triage';
import {
  SUPPORT_DRAFT_REPLY_JSON_SCHEMA,
  buildDraftReplySystemPrompt,
  buildDraftReplyPrompt,
} from '@/lib/prompts/support-draft-reply';
import type { SupportDraftReplyResult } from '@/lib/prompts/support-draft-reply';
import type { SupportCaseAIStateWritePayload } from '@/lib/support/ai-types';
import { saveSupportCaseAIState } from '@/lib/nocodb/support-write';
import type { AppSupportCase } from '@/lib/nocodb/types';

// ── 定数 ─────────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 10;
const MAX_LIMIT     = 50;

type StepName   = 'summary' | 'triage' | 'draft_reply';
type StepStatus = 'ok' | 'failed';

const ALL_STEPS: StepName[] = ['summary', 'triage', 'draft_reply'];

// ── リクエスト / レスポンス型 ─────────────────────────────────────────────────

interface RequestBody {
  limit?:          number;
  source_queue?:   string;
  company_uid?:    string;
  case_ids?:       string[];
  dry_run?:        boolean;
  steps?:          StepName[];
  draft_tone?:     'formal' | 'friendly' | 'technical';
  draft_language?: 'ja' | 'en';
}

interface Failure {
  case_id: string;
  reason:  string;
}

interface CaseResult {
  case_id:      string;
  status:       'ok' | 'partial' | 'failed' | 'skipped';
  steps:        Partial<Record<StepName, StepStatus>>;
  saved?:       boolean;
  skip_reason?: string;
  errors:       string[];
}

// ── per-case 処理 ─────────────────────────────────────────────────────────────

async function processCase(
  sc: AppSupportCase,
  opts: {
    steps:          StepName[];
    sourceQueue:    string;
    draftTone:      'formal' | 'friendly' | 'technical';
    draftLanguage:  'ja' | 'en';
    openai:         ReturnType<typeof getOpenAIClient>;
    model:          string;
  },
): Promise<CaseResult> {
  const caseId = sc.id;
  const ref    = buildSourceRef(caseId, opts.sourceQueue);
  const result: CaseResult = { case_id: caseId, status: 'failed', steps: {}, errors: [] };

  // 補助データ（失敗は無視して空値にフォールバック）
  const [cseTickets, aiState] = await Promise.all([
    getCseTicketQueueByCompanyOrCase({ caseId }).catch(() => []),
    getSupportCaseAIStateBySource(ref.sourceRecordId, ref.sourceQueue).catch(() => null),
  ]);

  const mergedPayload: SupportCaseAIStateWritePayload = {
    source_id:    ref.sourceRecordId,
    source_table: ref.sourceQueue,
  };

  // ── summary ───────────────────────────────────────────────────────────────
  if (opts.steps.includes('summary')) {
    try {
      const comp = await opts.openai.chat.completions.create({
        model: opts.model,
        messages: [
          { role: 'system', content: SUPPORT_SUMMARY_SYSTEM_PROMPT },
          { role: 'user',   content: buildSupportSummaryPrompt(sc, { cseTickets }) },
        ],
        response_format: { type: 'json_schema', json_schema: SUPPORT_SUMMARY_JSON_SCHEMA },
      });
      const raw = comp.choices[0].message.content;
      if (!raw) throw new Error('OpenAI から空のレスポンス');
      const r: SupportSummaryResult = JSON.parse(raw);
      mergedPayload.summary           = r.ai_summary;
      mergedPayload.urgency           = r.severity;
      mergedPayload.next_steps        = JSON.stringify(r.suggested_next_steps);
      mergedPayload.customer_intent   = r.customer_intent;
      mergedPayload.product_area      = r.product_area;
      mergedPayload.urgency_reasoning = r.urgency_reasoning;
      mergedPayload.generated_by      = comp.model;
      result.steps.summary = 'ok';
    } catch (err) {
      result.steps.summary = 'failed';
      result.errors.push(`summary: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── triage ────────────────────────────────────────────────────────────────
  if (opts.steps.includes('triage')) {
    try {
      const comp = await opts.openai.chat.completions.create({
        model: opts.model,
        messages: [
          { role: 'system', content: SUPPORT_TRIAGE_SYSTEM_PROMPT },
          { role: 'user',   content: buildSupportTriagePrompt(sc, { cseTickets }) },
        ],
        response_format: { type: 'json_schema', json_schema: SUPPORT_TRIAGE_JSON_SCHEMA },
      });
      const raw = comp.choices[0].message.content;
      if (!raw) throw new Error('OpenAI から空のレスポンス');
      const r: SupportTriageResult = JSON.parse(raw);
      mergedPayload.triage_note       = r.triage_note;
      mergedPayload.suggested_action  = r.suggested_action;
      mergedPayload.escalation_needed = r.escalation_needed;
      mergedPayload.category          = r.category;
      mergedPayload.urgency           = mergedPayload.urgency ?? r.severity;
      mergedPayload.suggested_team    = r.suggested_team;
      mergedPayload.routing_reason    = r.routing_reason;
      mergedPayload.generated_by      = comp.model;
      result.steps.triage = 'ok';
    } catch (err) {
      result.steps.triage = 'failed';
      result.errors.push(`triage: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── draft_reply ───────────────────────────────────────────────────────────
  if (opts.steps.includes('draft_reply')) {
    try {
      const comp = await opts.openai.chat.completions.create({
        model: opts.model,
        messages: [
          { role: 'system', content: buildDraftReplySystemPrompt(opts.draftTone, opts.draftLanguage) },
          { role: 'user',   content: buildDraftReplyPrompt(sc, { aiState }) },
        ],
        response_format: { type: 'json_schema', json_schema: SUPPORT_DRAFT_REPLY_JSON_SCHEMA },
      });
      const raw = comp.choices[0].message.content;
      if (!raw) throw new Error('OpenAI から空のレスポンス');
      const r: SupportDraftReplyResult = JSON.parse(raw);
      mergedPayload.draft_reply       = r.draft_reply;
      mergedPayload.reply_tone        = r.reply_tone;
      mergedPayload.reply_key_points  = JSON.stringify(r.key_points);
      mergedPayload.generated_by      = comp.model;
      result.steps.draft_reply = 'ok';
    } catch (err) {
      result.steps.draft_reply = 'failed';
      result.errors.push(`draft_reply: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── ステップ結果集計 ───────────────────────────────────────────────────────
  const succeededSteps = opts.steps.filter(s => result.steps[s] === 'ok');
  const failedSteps    = opts.steps.filter(s => result.steps[s] === 'failed');

  if (succeededSteps.length === 0) {
    result.status = 'failed';
    return result;
  }

  // ── NocoDB への保存 ────────────────────────────────────────────────────────
  try {
    const saveResult = await saveSupportCaseAIState(ref, mergedPayload);

    if (saveResult.ok) {
      result.saved  = true;
      result.status = failedSteps.length === 0 ? 'ok' : 'partial';
    } else {
      const r = saveResult as Extract<typeof saveResult, { ok: false }>;
      if (r.skipped) {
        result.status      = 'skipped';
        result.skip_reason = r.reason;
      } else {
        const e = (r as { ok: false; skipped: false; error: string }).error;
        result.status = 'failed';
        result.errors.push(`save: ${e}`);
      }
    }
  } catch (err) {
    result.status = 'failed';
    result.errors.push(`save: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
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
  const steps       = body.steps?.length ? body.steps : ALL_STEPS;
  const draftTone   = body.draft_tone     ?? 'formal';
  const draftLang   = body.draft_language ?? 'ja';
  const dryRun      = body.dry_run ?? false;

  // ── 対象ケース取得 ─────────────────────────────────────────────────────────
  let targetCases: AppSupportCase[];
  try {
    targetCases = await resolveTargetCases(body, limit);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[rebuild-ai-state] 対象ケース取得失敗:', err);
    return NextResponse.json({ error: `ケース取得エラー: ${msg}` }, { status: 500 });
  }

  // ── dry_run: write せず対象だけ返す ──────────────────────────────────────
  if (dryRun) {
    const finishedAt = new Date();
    await writeBatchRunLog({
      endpoint:        '/api/support/rebuild-ai-state',
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
      steps,
      limit,
      total_targeted:  targetCases.length,
      target_case_ids: targetCases.map(c => c.id),
      success_count:   0,
      partial_count:   0,
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
      steps,
      limit,
      total_targeted: 0,
      success_count:  0,
      partial_count:  0,
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
  const caseResults: CaseResult[] = [];

  for (const sc of targetCases) {
    console.log(`[rebuild-ai-state] processing ${sc.id} (${sc.title?.slice(0, 40)})`);
    const r = await processCase(sc, {
      steps,
      sourceQueue,
      draftTone,
      draftLanguage: draftLang,
      openai,
      model,
    });
    caseResults.push(r);
    console.log(`[rebuild-ai-state] ${sc.id} → ${r.status}`);
  }

  // ── 集計 ──────────────────────────────────────────────────────────────────
  let successCount = 0, partialCount = 0, failedCount = 0, skippedCount = 0;
  const failures: Failure[] = [];

  for (const r of caseResults) {
    if      (r.status === 'ok')      successCount++;
    else if (r.status === 'partial') partialCount++;
    else if (r.status === 'failed')  { failedCount++;  failures.push({ case_id: r.case_id, reason: r.errors.join('; ') }); }
    else if (r.status === 'skipped') skippedCount++;
  }

  const finishedAt = new Date();

  await writeBatchRunLog({
    endpoint:        '/api/support/rebuild-ai-state',
    started_at:      startedAt.toISOString(),
    finished_at:     finishedAt.toISOString(),
    duration_ms:     finishedAt.getTime() - startedAt.getTime(),
    dry_run:         false,
    source_queue:    sourceQueue,
    request_params:  sanitizeRequestParams(body as Record<string, unknown>),
    total_targeted:  caseResults.length,
    success_count:   successCount,
    partial_count:   partialCount,
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
    steps,
    limit,
    total_targeted: caseResults.length,
    success_count:  successCount,
    partial_count:  partialCount,
    failed_count:   failedCount,
    skipped_count:  skippedCount,
    failures,
    results:        caseResults,
  });
}
