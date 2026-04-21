// ─── /api/company/[companyUid]/summary ─────────────────────────────────────
//
// GET  → 保存済み Company Summary を取得（AI 生成しない）
// POST → Evidence / Alerts / People を読み取り AI で Company Summary を生成
//         ※ 保存は行わない。保存は POST /save、再生成+保存は POST /regenerate を使うこと。
//
// ── GET レスポンス ─────────────────────────────────────────────────────────
// { record: AppCompanySummaryState | null }
//
// ── POST レスポンス ────────────────────────────────────────────────────────
// {
//   company_uid:            string,
//   model:                  string,
//   generated_at:           ISO8601,
//   evidence_count:         number,
//   alert_count:            number,
//   people_count:           number,
//   summary:                string,
//   overall_health:         'healthy' | 'at_risk' | 'critical' | 'expanding',
//   key_risks:              [{ title, description }],
//   key_opportunities:      [{ title, description }],
//   recommended_next_action: string,
// }

import { NextRequest, NextResponse } from 'next/server';
import { fetchCompanyByUid } from '@/lib/nocodb/companies';
import { fetchEvidence }     from '@/lib/nocodb/evidence';
import { fetchAlerts }       from '@/lib/nocodb/alerts';
import { fetchPeople }       from '@/lib/nocodb/people';
import { getCompanySummaryState } from '@/lib/nocodb/company-summary-read';
import { getOpenAIClient, getOpenAIModel } from '@/lib/openai/client';
import {
  COMPANY_EVIDENCE_SUMMARY_SYSTEM_PROMPT,
  COMPANY_EVIDENCE_SUMMARY_JSON_SCHEMA,
  buildCompanyEvidenceSummaryPrompt,
  buildSummaryPolicySystemPrompt,
} from '@/lib/prompts/company-evidence-summary';
import type { CompanyEvidenceSummaryResult } from '@/lib/prompts/company-evidence-summary';
import { getPolicyById } from '@/lib/nocodb/policy-store';

// ── GET: 保存済み summary を返す ──────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;

  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が必要です' }, { status: 400 });
  }

  const record = await getCompanySummaryState(companyUid).catch(() => null);
  return NextResponse.json({ record: record ?? null });
}

// ── POST: AI 生成のみ（保存しない） ──────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;

  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が必要です' }, { status: 400 });
  }

  // ── リクエストボディ（省略可） ───────────────────────────────────────────
  // policy_id: Summary Policy を適用する場合に指定
  interface RequestBody { policy_id?: string; }
  const body: RequestBody = await req.json().catch(() => ({}));
  const policyId = body.policy_id;

  // ── OpenAI クライアント初期化 ────────────────────────────────────────────
  let openai: ReturnType<typeof getOpenAIClient>;
  let model: string;
  try {
    openai = getOpenAIClient();
    model  = getOpenAIModel();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  // ── NocoDB からデータ取得（並列）+ Summary Policy 取得 ───────────────────
  const [company, evidence, alerts, people, policyRecord] = await Promise.all([
    fetchCompanyByUid(companyUid).catch(() => null),
    fetchEvidence(companyUid).catch(() => []),
    fetchAlerts(companyUid).catch(() => []),
    fetchPeople(companyUid).catch(() => []),
    policyId ? getPolicyById(policyId).catch(() => null) : Promise.resolve(null),
  ]);

  if (!company) {
    return NextResponse.json(
      { error: `企業が見つかりませんでした: ${companyUid}` },
      { status: 404 },
    );
  }

  // ── Summary Policy の設定を適用 ─────────────────────────────────────────
  const summaryPolicy = policyRecord?.summaryPolicy ?? null;
  const systemPrompt = buildSummaryPolicySystemPrompt(summaryPolicy);

  // ── プロンプト構築 & OpenAI 呼び出し ────────────────────────────────────
  const userPrompt = buildCompanyEvidenceSummaryPrompt(company, evidence, alerts, people);

  const comp = await openai.chat.completions.create({
    model:    summaryPolicy?.model ?? model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    response_format: { type: 'json_schema', json_schema: COMPANY_EVIDENCE_SUMMARY_JSON_SCHEMA },
  });

  const raw = comp.choices[0].message.content;
  if (!raw) {
    return NextResponse.json({ error: 'OpenAI から空のレスポンスが返されました' }, { status: 500 });
  }

  const result: CompanyEvidenceSummaryResult = JSON.parse(raw);
  const generatedAt = new Date().toISOString();

  return NextResponse.json({
    company_uid:    companyUid,
    model:          comp.model,
    generated_at:   generatedAt,
    evidence_count: evidence.length,
    alert_count:    alerts.length,
    people_count:   people.length,
    // Summary Policy が適用された場合はメタを追加
    ...(summaryPolicy ? { applied_policy_id: policyId, applied_policy_name: policyRecord?.name } : {}),
    ...result,
  });
}
