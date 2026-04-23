// ─── Company Summary on_staleness ランナー ────────────────────────────────────
//
// Summary Policy の generation_trigger = 'on_staleness' に対応する runner。
// 「last_ai_updated_at が N 日以上前」または「summary が未生成」の企業を対象に
// AI 生成 → NocoDB 保存 を実行する。
//
// ── 既存の batch/company-summary との違い ─────────────────────────────────────
//   batch/company-summary:   freshness = source_updated_at > last_ai_updated_at（ソース起因）
//   staleness-runner:        freshness = now - last_ai_updated_at > stale_after_days（時間起因）
//
// ── Policy 再適用ルール ───────────────────────────────────────────────────────
//   1. 入力 policy_id が指定された場合 → 全社に同じ policy を適用
//   2. 指定なし + state.appliedPolicyId あり → 前回と同じ policy を再適用
//   3. それ以外 → デフォルトプロンプト（policy なし）
//
// ── dry_run ──────────────────────────────────────────────────────────────────
//   true のとき: 対象企業リストと件数だけ返し、生成・保存は行わない
//
// ── 多重実行防止 ──────────────────────────────────────────────────────────────
//   呼び出し側（cron）の責務。runner 自体はステートレス。
//   Vercel Cron は同一 schedule 内で多重実行しないが、
//   念のため /api/batch/company-summary-staleness に CRON_SECRET チェックを設ける。

import { resolveTargetCompanies }           from '@/lib/batch/company-targets';
import { getCompanySummaryStatesByUids }     from '@/lib/nocodb/company-summary-read';
import { fetchEvidence }                     from '@/lib/nocodb/evidence';
import { fetchAlerts }                       from '@/lib/nocodb/alerts';
import { fetchPeople }                       from '@/lib/nocodb/people';
import { fetchProjectsByCompany }            from '@/lib/nocodb/project-info';
import { buildProjectAggregateVM }           from '@/lib/company/project-aggregate';
import { fetchSupportAggregateForCompany }   from '@/lib/nocodb/support-by-company';
import { saveCompanySummaryState }           from '@/lib/nocodb/company-summary-write';
import { getPolicyById }                     from '@/lib/nocodb/policy-store';
import { getOpenAIClient, getOpenAIModel }   from '@/lib/openai/client';
import {
  COMPANY_EVIDENCE_SUMMARY_JSON_SCHEMA,
  buildCompanyEvidenceSummaryPrompt,
  buildSummaryPolicySystemPrompt,
} from '@/lib/prompts/company-evidence-summary';
import type { CompanyEvidenceSummaryResult } from '@/lib/prompts/company-evidence-summary';
import type { AppCompany, AppCompanySummaryState } from '@/lib/nocodb/types';

// ── デフォルト値 ──────────────────────────────────────────────────────────────

const DEFAULT_STALE_AFTER_DAYS = 30;
const DEFAULT_LIMIT            = 20;
const MAX_LIMIT                = 100;

// ── 型定義 ───────────────────────────────────────────────────────────────────

export interface StalenessRunnerOptions {
  /** 適用する Summary Policy（全社共通）。省略時は per-company の appliedPolicyId を参照 */
  policy_id?:        string;
  /** 対象企業を UID で絞り込む（省略 = 全 CSM 管理企業） */
  company_uids?:     string[];
  /** true のとき対象リストだけ返し、生成・保存しない（デフォルト: false） */
  dry_run?:          boolean;
  /** 最大処理件数（デフォルト: 20, 上限: 100） */
  limit?:            number;
  /**
   * 何日以上更新がない summary を stale とみなすか。
   * 省略時は policy の freshness_rule.stale_after_days → DEFAULT_STALE_AFTER_DAYS を使用。
   */
  stale_after_days?: number;
}

export interface StalenessRunnerResultItem {
  company_uid:          string;
  company_name:         string;
  status:               'generated' | 'skipped' | 'failed';
  /** 適用された policy_id（なければ null） */
  applied_policy_id:    string | null;
  /** 生成前の last_ai_updated_at（null = 未生成） */
  last_ai_updated_at:   string | null;
  skip_reason?:         string;
  error?:               string;
}

export interface StalenessRunnerResult {
  dry_run:                boolean;
  evaluated_at:           string;
  stale_after_days:       number;
  /** stale と判定された企業数（approved はここに含まない） */
  total_targeted:         number;
  generated_count:        number;
  skipped_count:          number;
  failed_count:           number;
  /** approved 保護でスキップした企業数（results に status=skipped で含まれる） */
  approved_skipped_count: number;
  results:                StalenessRunnerResultItem[];
}

// ── 時間ベース staleness チェック ─────────────────────────────────────────────

function isTimeStale(
  state:           AppCompanySummaryState | null | undefined,
  staleAfterDays:  number,
): boolean {
  // 未生成 → stale
  if (!state) return true;
  // approved → skip
  if (state.humanReviewStatus === 'approved') return false;
  // last_ai_updated_at が null → stale（生成されているが日時不明）
  if (!state.lastAiUpdatedAt) return true;

  const lastUpdatedMs = Date.parse(state.lastAiUpdatedAt.replace(' ', 'T'));
  if (isNaN(lastUpdatedMs)) return true;

  const cutoffMs = Date.now() - staleAfterDays * 24 * 60 * 60 * 1000;
  return lastUpdatedMs < cutoffMs;
}

// ── Policy キャッシュ ─────────────────────────────────────────────────────────

type PolicyRecord = Awaited<ReturnType<typeof getPolicyById>>;

async function resolvePolicy(
  policyId:    string | null | undefined,
  cache:       Map<string, PolicyRecord>,
): Promise<PolicyRecord> {
  if (!policyId) return null;
  if (cache.has(policyId)) return cache.get(policyId)!;
  const record = await getPolicyById(policyId).catch(() => null);
  cache.set(policyId, record);
  return record;
}

// ── per-company 生成処理 ──────────────────────────────────────────────────────

async function generateForCompany(
  company:       AppCompany,
  state:         AppCompanySummaryState | null,
  openai:        ReturnType<typeof getOpenAIClient>,
  defaultModel:  string,
  policyRecord:  PolicyRecord,
): Promise<{ ok: boolean; created?: boolean; error?: string }> {
  const [evidence, alerts, people, rawProjects, supportAgg] = await Promise.all([
    fetchEvidence(company.id).catch(() => []),
    fetchAlerts(company.id).catch(()  => []),
    fetchPeople(company.id).catch(()  => []),
    fetchProjectsByCompany(company.id).catch(() => []),
    fetchSupportAggregateForCompany(company.id).catch(() => null),
  ]);

  const projectsVM     = buildProjectAggregateVM(rawProjects);
  const summaryPolicy  = policyRecord?.summaryPolicy ?? null;
  const systemPrompt   = buildSummaryPolicySystemPrompt(summaryPolicy);
  const effectiveModel = summaryPolicy?.model ?? defaultModel;

  const userPrompt = buildCompanyEvidenceSummaryPrompt(company, evidence, alerts, people, {
    projects: projectsVM,
    support:  supportAgg ?? undefined,
  });
  const comp = await openai.chat.completions.create({
    model:    effectiveModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    response_format: { type: 'json_schema', json_schema: COMPANY_EVIDENCE_SUMMARY_JSON_SCHEMA },
  });

  const raw = comp.choices[0].message.content;
  if (!raw) throw new Error('OpenAI から空のレスポンス');

  const result: CompanyEvidenceSummaryResult = JSON.parse(raw);
  const generatedAt = new Date().toISOString();

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
    applied_policy_id:       policyRecord?.policyId ?? null,
  });

  if (saveResult.ok)        return { ok: true, created: saveResult.created };
  if ('skipped' in saveResult && saveResult.skipped)
    throw new Error(saveResult.reason);
  throw new Error((saveResult as { ok: false; skipped: false; error: string }).error);
}

// ── メイン runner ─────────────────────────────────────────────────────────────

export async function runStalenessRunner(
  opts: StalenessRunnerOptions = {},
): Promise<StalenessRunnerResult> {
  const {
    policy_id:     inputPolicyId,
    company_uids:  filterUids,
    dry_run:       dryRun   = false,
    limit:         rawLimit = DEFAULT_LIMIT,
  } = opts;

  const evaluatedAt = new Date().toISOString();
  const limit       = Math.min(rawLimit, MAX_LIMIT);

  // ── stale_after_days を解決 ────────────────────────────────────────────────
  // opts.stale_after_days > policy.freshness_rule.stale_after_days > DEFAULT
  let staleAfterDays = opts.stale_after_days ?? DEFAULT_STALE_AFTER_DAYS;

  // input policy が指定された場合、freshness_rule を参照
  if (!opts.stale_after_days && inputPolicyId) {
    const topPolicy = await getPolicyById(inputPolicyId).catch(() => null);
    const freshnessRule = topPolicy?.summaryPolicy?.freshness_rule;
    if (freshnessRule && typeof freshnessRule === 'object') {
      const days = (freshnessRule as Record<string, unknown>).stale_after_days;
      if (typeof days === 'number' && days > 0) staleAfterDays = days;
    }
  }

  // ── Step 1: 対象企業を取得 ─────────────────────────────────────────────────
  const companies = await resolveTargetCompanies({ limit, company_uids: filterUids });
  if (companies.length === 0) {
    return {
      dry_run: dryRun, evaluated_at: evaluatedAt,
      stale_after_days: staleAfterDays,
      total_targeted: 0, generated_count: 0, skipped_count: 0, failed_count: 0,
      approved_skipped_count: 0,
      results: [],
    };
  }

  // ── Step 2: summary state を一括取得 ──────────────────────────────────────
  const stateMap = await getCompanySummaryStatesByUids(companies.map(c => c.id))
    .catch(() => new Map<string, AppCompanySummaryState>());

  // ── Step 3: stale フィルタ（診断ログ付き）────────────────────────────────
  // approved 企業は isTimeStale=false で除外されるが、results には可視化のため含める
  const approvedResults: StalenessRunnerResultItem[] = [];
  const staleCompanies = companies.filter(c => {
    const state = stateMap.get(c.id);
    const stale  = isTimeStale(state, staleAfterDays);
    console.log(
      `[staleness-runner] stale-check | company=${c.id}` +
      ` | rowId=${state?.rowId ?? 'null'}` +
      ` | human_review_status=${state?.humanReviewStatus ?? 'null(state未取得)'}` +
      ` | last_ai_updated_at=${state?.lastAiUpdatedAt ?? 'null'}` +
      ` | isStale=${stale}`,
    );
    // approved 企業: stale=false で除外されるが skipped として記録
    if (!stale && state?.humanReviewStatus === 'approved') {
      approvedResults.push({
        company_uid:        c.id,
        company_name:       c.name,
        status:             'skipped',
        applied_policy_id:  inputPolicyId ?? state.appliedPolicyId ?? null,
        last_ai_updated_at: state.lastAiUpdatedAt ?? null,
        skip_reason:        'approved（locked）のためスキップ',
      });
    }
    return stale;
  });

  // ── dry_run: 対象リストのみ返す ────────────────────────────────────────────
  if (dryRun) {
    const staleResults: StalenessRunnerResultItem[] = staleCompanies.map(c => {
      const state = stateMap.get(c.id) ?? null;
      return {
        company_uid:        c.id,
        company_name:       c.name,
        status:             'skipped' as const,
        applied_policy_id:  inputPolicyId ?? state?.appliedPolicyId ?? null,
        last_ai_updated_at: state?.lastAiUpdatedAt ?? null,
        skip_reason:        'dry_run=true のため生成をスキップ',
      };
    });
    // approved 企業も results に含める（可視性のため）
    const results = [...approvedResults, ...staleResults];
    return {
      dry_run: true, evaluated_at: evaluatedAt,
      stale_after_days:       staleAfterDays,
      total_targeted:         staleCompanies.length,
      generated_count:        0,
      skipped_count:          staleCompanies.length,
      failed_count:           0,
      approved_skipped_count: approvedResults.length,
      results,
    };
  }

  // ── Step 4: OpenAI 初期化 ─────────────────────────────────────────────────
  const openai       = getOpenAIClient();
  const defaultModel = getOpenAIModel();

  // ── Step 5: per-company 生成（順次 — rate limit 配慮） ────────────────────
  const policyCache = new Map<string, PolicyRecord>();
  const results: StalenessRunnerResultItem[] = [];

  for (const company of staleCompanies) {
    const state = stateMap.get(company.id) ?? null;

    console.log(
      `[staleness-runner] processing | company=${company.id} (${company.name})` +
      ` | rowId=${state?.rowId ?? 'null'}` +
      ` | human_review_status=${state?.humanReviewStatus ?? 'null'}` +
      ` | last_ai_updated_at=${state?.lastAiUpdatedAt ?? 'null'}`,
    );

    // approved はフィルタ段階で staleCompanies から除外済み（isTimeStale=false）。
    // ここに来た場合は state 取得と stale 判定の間にレース条件が発生したケース。念のため保護。
    if (state?.humanReviewStatus === 'approved') {
      console.log(`[staleness-runner] skip approved (race condition guard) | company=${company.id}`);
      // approvedResults に追加済みでない場合のみ追加
      if (!approvedResults.some(r => r.company_uid === company.id)) {
        approvedResults.push({
          company_uid:        company.id,
          company_name:       company.name,
          status:             'skipped',
          applied_policy_id:  state.appliedPolicyId ?? null,
          last_ai_updated_at: state.lastAiUpdatedAt ?? null,
          skip_reason:        'approved（locked）のためスキップ',
        });
      }
      continue;
    }

    // policy 解決: 入力 > 前回適用 > null
    const resolvedPolicyId = inputPolicyId ?? state?.appliedPolicyId ?? null;
    const policyRecord     = await resolvePolicy(resolvedPolicyId, policyCache);

    console.log(
      `[staleness-runner] generate start | company=${company.id}` +
      ` | policy=${resolvedPolicyId ?? 'default'}`,
    );

    try {
      await generateForCompany(company, state, openai, defaultModel, policyRecord);
      results.push({
        company_uid:        company.id,
        company_name:       company.name,
        status:             'generated',
        applied_policy_id:  resolvedPolicyId,
        last_ai_updated_at: state?.lastAiUpdatedAt ?? null,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[staleness-runner] failed: ${company.id} — ${errMsg}`);
      results.push({
        company_uid:        company.id,
        company_name:       company.name,
        status:             'failed',
        applied_policy_id:  resolvedPolicyId,
        last_ai_updated_at: state?.lastAiUpdatedAt ?? null,
        error:              errMsg,
      });
    }
  }

  // approved 企業を results の先頭に追加（可視性のため）
  const allResults = [...approvedResults, ...results];

  const generatedCount = allResults.filter(r => r.status === 'generated').length;
  const skippedCount   = allResults.filter(r => r.status === 'skipped').length;
  const failedCount    = allResults.filter(r => r.status === 'failed').length;

  return {
    dry_run:                dryRun,
    evaluated_at:           evaluatedAt,
    stale_after_days:       staleAfterDays,
    total_targeted:         staleCompanies.length,
    generated_count:        generatedCount,
    skipped_count:          skippedCount,
    failed_count:           failedCount,
    approved_skipped_count: approvedResults.length,
    results:                allResults,
  };
}
