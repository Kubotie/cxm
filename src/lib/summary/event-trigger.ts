// ─── Company Summary イベントトリガー ─────────────────────────────────────────
//
// Evidence 追加など「イベント起因」で Company Summary を再生成する入口。
// HTTP エンドポイント（/api/batch/company-summary-event）と将来の queue の
// 両方から呼ばれる共通の薄い入口として機能する。
//
// ── 現在の実装方針 ──────────────────────────────────────────────────────────
//   queue / lock は導入しない。
//   triggerSummaryRefreshForCompany は generateCompanySummaryNow を直接呼ぶ。
//
// ── 重複生成の許容方針 ───────────────────────────────────────────────────────
//   同一企業への Evidence が短時間で連続追加されると、同数の生成が走る場合がある。
//   これは現時点では許容する。理由:
//     1. Evidence 追加頻度が低く（手動 CSM 入力 / 単件 sync が主体）、
//        バースト追加（Intercom 一括 import 等）は現在未実装
//     2. saveCompanySummaryState は後勝ち upsert のため、データ破壊は起きない
//     3. approved ステータスの上書き防止は write helper に委ねている
//   → 一括 sync / webhook burst が入るタイミングで queue 化を検討する
//
// ── 将来 queue 化するときの差し込み点 ─────────────────────────────────────────
//
//   ① triggerSummaryRefreshForCompany の本体を enqueue に差し替える
//      現在:
//        return generateCompanySummaryNow(companyUid, reason, options);
//      将来:
//        await enqueueCompanyRefresh({ companyUid, reason, ...options });
//        return { status: 'queued', applied_policy_id: null };
//
//   ② debounce は queue consumer（ワーカー）側で行う
//      - "同一 company_uid への最後のエンキューから N 分後に1回だけ実行"
//      - エンキュー側は都度 push するだけでよい
//      - 実装候補: Upstash QStash の delay / Redis の sorted set TTL
//
//   ③ company_uid 単位の集約は queue レイヤーで行う
//      - 複数 evidence イベントが同じ companyUid で来たとき、
//        キュー内で pending 中のジョブがあれば上書き（idempotency key = companyUid）
//      - QStash の deduplication ID、または BullMQ の jobId 上書きで実現できる

import { resolveCompanySummaryTargets } from '@/lib/batch/company-summary-targets';
import { getCompanySummaryState }        from '@/lib/nocodb/company-summary-read';
import { listPolicies, getPolicyById }   from '@/lib/nocodb/policy-store';
import { fetchEvidence }                 from '@/lib/nocodb/evidence';
import { fetchAlerts }                   from '@/lib/nocodb/alerts';
import { fetchPeople }                   from '@/lib/nocodb/people';
import { fetchProjectsByCompany }        from '@/lib/nocodb/project-info';
import { buildProjectAggregateVM }       from '@/lib/company/project-aggregate';
import { fetchSupportAggregateForCompany } from '@/lib/nocodb/support-by-company';
import { saveCompanySummaryState }       from '@/lib/nocodb/company-summary-write';
import { getOpenAIClient, getOpenAIModel } from '@/lib/openai/client';
import {
  COMPANY_EVIDENCE_SUMMARY_JSON_SCHEMA,
  buildCompanyEvidenceSummaryPrompt,
  buildSummaryPolicySystemPrompt,
} from '@/lib/prompts/company-evidence-summary';
import type { CompanyEvidenceSummaryResult } from '@/lib/prompts/company-evidence-summary';
import type { AppPolicy } from '@/lib/nocodb/policy-store';

// ── 型定義 ───────────────────────────────────────────────────────────────────

export interface SummaryRefreshOptions {
  /** 使用する Summary Policy の ID。省略時は active な on_event ポリシーを自動選択 */
  policy_id?: string;
  /** true のとき企業情報・policy 解決だけ行い、生成・保存はしない */
  dry_run?:   boolean;
}

export interface SummaryRefreshResult {
  status:            'generated' | 'skipped' | 'failed';
  company_name:      string;
  applied_policy_id: string | null;
  skip_reason?:      string;
  error?:            string;
}

// ── on_event ポリシーを自動解決 ───────────────────────────────────────────────

async function resolveOnEventPolicy(
  policyId: string | undefined,
): Promise<AppPolicy | null> {
  if (policyId) {
    return getPolicyById(policyId).catch(() => null);
  }
  // active な on_event summary ポリシーを先着1件で選択
  const all = await listPolicies('summary').catch(() => [] as AppPolicy[]);
  return all.find(
    p => p.status === 'active' && p.summaryPolicy?.generation_trigger === 'on_event',
  ) ?? null;
}

// ── 実際の生成処理 ────────────────────────────────────────────────────────────
//
// ここが将来 queue worker に移動するブロック。
// triggerSummaryRefreshForCompany から直接呼ばれている部分を
// enqueue に差し替えれば queue 化が完結する。

async function generateCompanySummaryNow(
  companyUid:    string,
  reason:        string,
  options:       SummaryRefreshOptions,
): Promise<SummaryRefreshResult> {
  // ── 企業情報取得 ──────────────────────────────────────────────────────────
  const targets = await resolveCompanySummaryTargets({ limit: 1, company_uids: [companyUid] });
  if (targets.length === 0) {
    return {
      status:            'failed',
      company_name:      companyUid,
      applied_policy_id: null,
      error:             `company_uid="${companyUid}" が見つかりません`,
    };
  }
  const company = targets[0].company;

  // ── approved 保護チェック ──────────────────────────────────────────────────
  // write helper でも保護されているが、OpenAI 呼び出しを節約するためここでも確認する
  const currentState = await getCompanySummaryState(companyUid).catch(() => null);
  if (currentState?.humanReviewStatus === 'approved') {
    return {
      status:            'skipped',
      company_name:      company.name,
      applied_policy_id: null,
      skip_reason:       'approved のため on_event 自動再生成をスキップしました',
    };
  }

  // ── Policy 解決 ───────────────────────────────────────────────────────────
  const policyRecord    = await resolveOnEventPolicy(options.policy_id);
  const appliedPolicyId = policyRecord?.policyId ?? null;

  // ── dry_run ───────────────────────────────────────────────────────────────
  if (options.dry_run) {
    return {
      status:            'skipped',
      company_name:      company.name,
      applied_policy_id: appliedPolicyId,
      skip_reason:       `dry_run=true のため生成をスキップしました (reason: ${reason})`,
    };
  }

  // ── OpenAI 呼び出し + 保存 ────────────────────────────────────────────────
  const openai       = getOpenAIClient();
  const defaultModel = getOpenAIModel();

  const [evidence, alerts, people, rawProjects, supportAgg] = await Promise.all([
    fetchEvidence(companyUid).catch(() => []),
    fetchAlerts(companyUid).catch(()   => []),
    fetchPeople(companyUid).catch(()   => []),
    fetchProjectsByCompany(companyUid).catch(() => []),
    fetchSupportAggregateForCompany(companyUid).catch(() => null),
  ]);

  const projectsVM = buildProjectAggregateVM(rawProjects);

  const summaryPolicy  = policyRecord?.summaryPolicy ?? null;
  const systemPrompt   = buildSummaryPolicySystemPrompt(summaryPolicy);
  const effectiveModel = summaryPolicy?.model ?? defaultModel;

  const comp = await openai.chat.completions.create({
    model:   effectiveModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: buildCompanyEvidenceSummaryPrompt(company, evidence, alerts, people, {
        projects: projectsVM,
        support:  supportAgg ?? undefined,
      }) },
    ],
    response_format: { type: 'json_schema', json_schema: COMPANY_EVIDENCE_SUMMARY_JSON_SCHEMA },
  });

  const raw = comp.choices[0].message.content;
  if (!raw) throw new Error('OpenAI から空のレスポンス');

  const aiResult: CompanyEvidenceSummaryResult = JSON.parse(raw);
  const generatedAt = new Date().toISOString();

  const saveResult = await saveCompanySummaryState({
    company_uid:             companyUid,
    ai_summary:              aiResult.summary,
    overall_health:          aiResult.overall_health,
    key_risks:               JSON.stringify(aiResult.key_risks),
    key_opportunities:       JSON.stringify(aiResult.key_opportunities),
    recommended_next_action: aiResult.recommended_next_action,
    model:                   comp.model,
    ai_version:              'company-summary-v1',
    last_ai_updated_at:      generatedAt,
    source_updated_at:       company.updatedAt ?? null,
    evidence_count:          evidence.length,
    alert_count:             alerts.length,
    people_count:            people.length,
    applied_policy_id:       appliedPolicyId,
  });

  if (saveResult.ok) {
    return { status: 'generated', company_name: company.name, applied_policy_id: appliedPolicyId };
  }
  if ('skipped' in saveResult && saveResult.skipped) {
    return { status: 'skipped', company_name: company.name, applied_policy_id: appliedPolicyId, skip_reason: saveResult.reason };
  }
  const errMsg = (saveResult as { ok: false; skipped: false; error: string }).error;
  return { status: 'failed', company_name: company.name, applied_policy_id: appliedPolicyId, error: `save: ${errMsg}` };
}

// ── 公開エントリポイント ──────────────────────────────────────────────────────
//
// 今は generateCompanySummaryNow を直接呼ぶ。
// 将来 queue 化する場合は、この関数の本体を enqueue に差し替えるだけでよい。
// 呼び出し元（HTTP エンドポイント・今後追加する Evidence API 等）の変更は不要。

export async function triggerSummaryRefreshForCompany(
  companyUid: string,
  reason:     string,        // ログ・追跡用 (e.g. "evidence_created", "manual", "alert_fired")
  options:    SummaryRefreshOptions = {},
): Promise<SummaryRefreshResult> {
  // ── 将来の差し替え点（① enqueue に変える）────────────────────────────────
  // 現在: 直接生成
  return generateCompanySummaryNow(companyUid, reason, options);

  // 将来の例（queue 化後）:
  // await enqueueCompanyRefresh({ companyUid, reason, policyId: options.policy_id });
  // return { status: 'queued', company_name: companyUid, applied_policy_id: null };
}
