// ─── POST /api/batch/company-summary ─────────────────────────────────────────
// 全 CSM 管理企業（または指定 UID）に対して Company Summary を一括 AI 生成し、
// company_summary_state へ upsert する DolphinScheduler 向けバッチ入口。
//
// ── リクエストボディ ──────────────────────────────────────────────────────────
// {
//   limit?:           number;               // 最大処理件数 (default: 10, max: 50)
//   company_uids?:    string[];             // 指定 UID のみ対象（省略時は全 CSM 管理企業）
//   dry_run?:         boolean;             // true のとき対象一覧だけ返し、write しない
//   freshness_filter?: ('missing'|'stale'|'fresh'|'locked')[];
//                                          // 対象絞り込み。省略時は全状態。
//                                          // locked(approved)は指定しても実行時に skip される。
// }
//
// ── レスポンス（通常） ────────────────────────────────────────────────────────
// {
//   dry_run:          false,
//   started_at:       ISO8601,
//   finished_at:      ISO8601,
//   duration_ms:      number,
//   limit:            number,
//   freshness_filter: string[] | 'all',
//   total_targeted:   number,
//   success_count:    number,
//   failed_count:     number,
//   skipped_count:    number,
//   failures:         [{ company_uid, company_name, reason }],
//   results:          [{ company_uid, company_name, status, freshness_status,
//                        regenerate_priority, skip_reason?, error? }],
// }
//
// ── レスポンス（dry_run=true） ─────────────────────────────────────────────────
// {
//   dry_run:              true,
//   limit:                number,
//   freshness_filter:     string[] | 'all',
//   total_targeted:       number,
//   target_companies:     [{ uid, name, freshness_status, regenerate_priority,
//                            can_bulk_regenerate, review_group_label }],
//   note:                 string,
// }
//
// ── 保護方針 ─────────────────────────────────────────────────────────────────
// - limit は MAX_LIMIT=50 でキャップ
// - source tables（companies, evidence, alerts, people）は一切更新しない
// - human_review_status が approved のレコードは上書きしない（write helper + freshness_filter で二重保護）
// - dry_run=true で対象確認後に本実行できる（dry_run 時も regeneratePriority 降順で表示）
// - 1社失敗しても全体が止まらない（per-company エラーハンドリング）
// - results は regeneratePriority 降順（missing=4 > stale=3 > fresh=2 > locked=1）

import { NextRequest, NextResponse }     from 'next/server';
import { checkBatchAuth }                from '@/lib/batch/auth';
import { writeBatchRunLog, sanitizeRequestParams } from '@/lib/batch/logger';
import { resolveCompanySummaryTargets }  from '@/lib/batch/company-summary-targets';
import { fetchEvidence }                 from '@/lib/nocodb/evidence';
import { fetchAlerts }                   from '@/lib/nocodb/alerts';
import { fetchPeople }                   from '@/lib/nocodb/people';
import { getOpenAIClient, getOpenAIModel } from '@/lib/openai/client';
import {
  COMPANY_EVIDENCE_SUMMARY_SYSTEM_PROMPT,
  COMPANY_EVIDENCE_SUMMARY_JSON_SCHEMA,
  buildCompanyEvidenceSummaryPrompt,
} from '@/lib/prompts/company-evidence-summary';
import type { CompanyEvidenceSummaryResult } from '@/lib/prompts/company-evidence-summary';
import { saveCompanySummaryState }       from '@/lib/nocodb/company-summary-write';
import type { SummaryFreshnessStatus }   from '@/lib/company/company-summary-state-policy';
import type { CompanySummaryTargetItem } from '@/lib/batch/company-summary-targets';

// ── 定数 ─────────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 10;
const MAX_LIMIT     = 50;

const VALID_FRESHNESS = new Set<string>(['missing', 'stale', 'fresh', 'locked']);

// ── 型定義 ───────────────────────────────────────────────────────────────────

interface RequestBody {
  limit?:            number;
  company_uids?:     string[];
  dry_run?:          boolean;
  freshness_filter?: string[];
}

interface CompanyResult {
  company_uid:         string;
  company_name:        string;
  status:              'ok' | 'failed' | 'skipped';
  freshness_status:    SummaryFreshnessStatus;
  regenerate_priority: number;
  skip_reason?:        string;
  error?:              string;
}

interface Failure {
  company_uid:  string;
  company_name: string;
  reason:       string;
}

// ── per-company 処理 ──────────────────────────────────────────────────────────

async function processCompany(
  item:   CompanySummaryTargetItem,
  openai: ReturnType<typeof getOpenAIClient>,
  model:  string,
): Promise<CompanyResult> {
  const { company, listVM } = item;
  const base = {
    company_uid:         company.id,
    company_name:        company.name,
    freshness_status:    listVM.freshnessStatus,
    regenerate_priority: listVM.regeneratePriority,
  };

  // approved（locked）は write helper でもブロックされるが、
  // ここでも明示的に skip してログを残す
  if (!listVM.canBulkRegenerate) {
    return {
      ...base,
      status:      'skipped',
      skip_reason: 'approved（locked）のため再生成をスキップしました',
    };
  }

  try {
    // 入力データ取得（失敗時は空配列にフォールバック）
    const [evidence, alerts, people] = await Promise.all([
      fetchEvidence(company.id).catch(() => []),
      fetchAlerts(company.id).catch(()  => []),
      fetchPeople(company.id).catch(()  => []),
    ]);

    // OpenAI 呼び出し
    const userPrompt = buildCompanyEvidenceSummaryPrompt(company, evidence, alerts, people);
    const comp = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: COMPANY_EVIDENCE_SUMMARY_SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
      response_format: { type: 'json_schema', json_schema: COMPANY_EVIDENCE_SUMMARY_JSON_SCHEMA },
    });

    const raw = comp.choices[0].message.content;
    if (!raw) throw new Error('OpenAI から空のレスポンス');

    const result: CompanyEvidenceSummaryResult = JSON.parse(raw);
    const generatedAt = new Date().toISOString();

    // NocoDB へ保存
    const saveResult = await saveCompanySummaryState({
      company_uid:             company.id,
      ai_summary:              result.summary,
      overall_health:          result.overall_health,
      key_risks:               JSON.stringify(result.key_risks),
      key_opportunities:       JSON.stringify(result.key_opportunities),
      recommended_next_action: result.recommended_next_action,
      model:                   comp.model,
      ai_version:              'company-summary-v1',
      last_ai_updated_at:      generatedAt,
      source_updated_at:       company.updatedAt ?? null,
      evidence_count:          evidence.length,
      alert_count:             alerts.length,
      people_count:            people.length,
    });

    if (saveResult.ok) {
      return { ...base, status: 'ok' };
    } else if ('skipped' in saveResult && saveResult.skipped) {
      return { ...base, status: 'skipped', skip_reason: saveResult.reason };
    } else {
      const err = (saveResult as { ok: false; skipped: false; error: string }).error;
      return { ...base, status: 'failed', error: `save: ${err}` };
    }
  } catch (err) {
    return {
      ...base,
      status: 'failed',
      error:  err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 認証 ──────────────────────────────────────────────────────────────────
  const authError = checkBatchAuth(req);
  if (authError) return authError;

  const startedAt = new Date();
  const body: RequestBody = await req.json().catch(() => ({}));

  // ── パラメータ正規化 ───────────────────────────────────────────────────────
  const limit  = Math.min(body.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const dryRun = body.dry_run ?? false;

  const freshnessFilter: SummaryFreshnessStatus[] | undefined =
    body.freshness_filter && body.freshness_filter.length > 0
      ? (body.freshness_filter.filter(s => VALID_FRESHNESS.has(s)) as SummaryFreshnessStatus[])
      : undefined;

  const filterLabel = freshnessFilter ?? 'all';

  // ── 対象取得（フィルタ + regeneratePriority 降順） ─────────────────────────
  let targets: CompanySummaryTargetItem[];
  try {
    targets = await resolveCompanySummaryTargets({
      limit,
      company_uids:     body.company_uids,
      freshness_filter: freshnessFilter,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[batch/company-summary] 対象企業取得失敗:', err);
    return NextResponse.json({ error: `企業取得エラー: ${msg}` }, { status: 500 });
  }

  // ── dry_run: write せず対象だけ返す ──────────────────────────────────────
  if (dryRun) {
    const finishedAt = new Date();
    await writeBatchRunLog({
      endpoint:        '/api/batch/company-summary',
      started_at:      startedAt.toISOString(),
      finished_at:     finishedAt.toISOString(),
      duration_ms:     finishedAt.getTime() - startedAt.getTime(),
      dry_run:         true,
      source_queue:    'companies',
      request_params:  sanitizeRequestParams(body as Record<string, unknown>),
      total_targeted:  targets.length,
      success_count:   0,
      partial_count:   0,
      failed_count:    0,
      skipped_count:   0,
      failure_details: '[]',
    });
    return NextResponse.json({
      dry_run:          true,
      limit,
      freshness_filter: filterLabel,
      total_targeted:   targets.length,
      target_companies: targets.map(t => ({
        uid:                 t.company.id,
        name:                t.company.name,
        freshness_status:    t.listVM.freshnessStatus,
        regenerate_priority: t.listVM.regeneratePriority,
        can_bulk_regenerate: t.listVM.canBulkRegenerate,
        review_group_label:  t.listVM.reviewGroupLabel,
      })),
      note: 'dry_run=false で実行すると company_summary_state へ書き込みます。locked（approved）は skip されます。',
    });
  }

  // ── 対象なし ───────────────────────────────────────────────────────────────
  if (targets.length === 0) {
    return NextResponse.json({
      dry_run:          false,
      started_at:       startedAt.toISOString(),
      finished_at:      new Date().toISOString(),
      duration_ms:      Date.now() - startedAt.getTime(),
      limit,
      freshness_filter: filterLabel,
      total_targeted:   0,
      success_count:    0,
      failed_count:     0,
      skipped_count:    0,
      failures:         [] as Failure[],
      results:          [] as CompanyResult[],
      note:             '対象企業が見つかりませんでした（NocoDB テーブル未設定・フィルタ条件に該当なし）',
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

  // ── per-company 処理（順次実行 - rate limit 配慮）────────────────────────
  const companyResults: CompanyResult[] = [];

  for (const item of targets) {
    console.log(`[batch/company-summary] processing ${item.company.id} (${item.company.name}) [${item.listVM.freshnessStatus}]`);
    const r = await processCompany(item, openai, model);
    companyResults.push(r);
    console.log(`[batch/company-summary] ${item.company.id} → ${r.status}`);
  }

  // ── 集計 ──────────────────────────────────────────────────────────────────
  let successCount = 0, failedCount = 0, skippedCount = 0;
  const failures: Failure[] = [];

  for (const r of companyResults) {
    if      (r.status === 'ok')      successCount++;
    else if (r.status === 'failed')  {
      failedCount++;
      failures.push({ company_uid: r.company_uid, company_name: r.company_name, reason: r.error ?? '' });
    }
    else if (r.status === 'skipped') skippedCount++;
  }

  const finishedAt = new Date();

  const responseBody = {
    dry_run:          false,
    started_at:       startedAt.toISOString(),
    finished_at:      finishedAt.toISOString(),
    duration_ms:      finishedAt.getTime() - startedAt.getTime(),
    limit,
    freshness_filter: filterLabel,
    total_targeted:   companyResults.length,
    success_count:    successCount,
    failed_count:     failedCount,
    skipped_count:    skippedCount,
    failures,
    results:          companyResults,
  };

  const { logId } = await writeBatchRunLog({
    endpoint:        '/api/batch/company-summary',
    batch_type:      'company-summary-regenerate',
    started_at:      startedAt.toISOString(),
    finished_at:     finishedAt.toISOString(),
    duration_ms:     finishedAt.getTime() - startedAt.getTime(),
    dry_run:         false,
    source_queue:    'companies',
    request_params:  sanitizeRequestParams(body as Record<string, unknown>),
    filters:         JSON.stringify({ freshness_filter: filterLabel }),
    total_targeted:  companyResults.length,
    ok_count:        successCount,
    success_count:   successCount,
    partial_count:   0,
    failed_count:    failedCount,
    skipped_count:   skippedCount,
    failure_details: JSON.stringify(failures),
    result_json:     JSON.stringify(responseBody),
  });

  return NextResponse.json({ ...responseBody, audit_log_id: logId });
}
