// ─── POST /api/company/[companyUid]/summary/regenerate ──────────────────────
// AI 再生成 + NocoDB への即時保存を一括で行う。
//
// 差分:
//   - POST /summary   → AI 生成のみ（保存しない）
//   - POST /regenerate → AI 生成 + 即時保存（human_review_status を 'pending' にリセット）
//
// 保護条件:
//   - human_review_status === 'approved' のレコードが存在する場合は 409 を返す
//
// ── リクエスト ──────────────────────────────────────────────────────────────
// {}  または  { summary_type?: string }
//
// ── レスポンス ──────────────────────────────────────────────────────────────
// 成功: {
//   company_uid, model, generated_at,
//   evidence_count, alert_count, people_count,
//   summary, overall_health, key_risks, key_opportunities, recommended_next_action,
//   saved: true, created: boolean,
// }
// 保護エラー: { error: 'APPROVED_LOCKED', message: string }  HTTP 409
// その他エラー: { error: string }

import { NextRequest, NextResponse } from 'next/server';
import { fetchCompanyByUid } from '@/lib/nocodb/companies';
import { fetchEvidence }     from '@/lib/nocodb/evidence';
import { fetchAlerts }       from '@/lib/nocodb/alerts';
import { fetchPeople }       from '@/lib/nocodb/people';
import { getCompanySummaryState } from '@/lib/nocodb/company-summary-read';
import { saveCompanySummaryState } from '@/lib/nocodb/company-summary-write';
import { getOpenAIClient, getOpenAIModel } from '@/lib/openai/client';
import {
  COMPANY_EVIDENCE_SUMMARY_SYSTEM_PROMPT,
  COMPANY_EVIDENCE_SUMMARY_JSON_SCHEMA,
  buildCompanyEvidenceSummaryPrompt,
} from '@/lib/prompts/company-evidence-summary';
import type { CompanyEvidenceSummaryResult } from '@/lib/prompts/company-evidence-summary';

const AI_VERSION    = 'company-summary-v1';
const DEFAULT_TYPE  = 'default';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;

  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が必要です' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({})) as { summary_type?: string };
  const summaryType = body.summary_type ?? DEFAULT_TYPE;

  // ── 保護チェック: approved なら 409 ────────────────────────────────────
  const existing = await getCompanySummaryState(companyUid, summaryType).catch(() => null);
  if (existing?.humanReviewStatus === 'approved') {
    return NextResponse.json(
      {
        error:   'APPROVED_LOCKED',
        message: '承認済みの summary は再生成できません。承認を解除してから再試行してください。',
      },
      { status: 409 },
    );
  }

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

  // ── NocoDB からデータ取得（並列） ────────────────────────────────────────
  const [company, evidence, alerts, people] = await Promise.all([
    fetchCompanyByUid(companyUid).catch(() => null),
    fetchEvidence(companyUid).catch(() => []),
    fetchAlerts(companyUid).catch(() => []),
    fetchPeople(companyUid).catch(() => []),
  ]);

  if (!company) {
    return NextResponse.json(
      { error: `企業が見つかりませんでした: ${companyUid}` },
      { status: 404 },
    );
  }

  // ── AI 生成 ───────────────────────────────────────────────────────────────
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
  if (!raw) {
    return NextResponse.json({ error: 'OpenAI から空のレスポンスが返されました' }, { status: 500 });
  }

  const result: CompanyEvidenceSummaryResult = JSON.parse(raw);
  const generatedAt = new Date().toISOString();

  // ── NocoDB への保存（human_review_status を 'pending' にリセット） ────────
  const saveResult = await saveCompanySummaryState({
    company_uid:             companyUid,
    summary_type:            summaryType,
    ai_summary:              result.summary,
    overall_health:          result.overall_health,
    key_risks:               JSON.stringify(result.key_risks),
    key_opportunities:       JSON.stringify(result.key_opportunities),
    recommended_next_action: result.recommended_next_action,
    model:                   comp.model,
    ai_version:              AI_VERSION,
    last_ai_updated_at:      generatedAt,
    source_updated_at:       company.updatedAt ?? null,
    evidence_count:          evidence.length,
    alert_count:             alerts.length,
    people_count:            people.length,
  }).catch(err => ({
    ok:      false  as const,
    skipped: false  as const,
    error:   err instanceof Error ? err.message : String(err),
  }));

  if (!saveResult.ok) {
    if ('skipped' in saveResult && saveResult.skipped) {
      // approved による保護（保護チェック後に別プロセスが approve した場合）
      return NextResponse.json(
        { error: 'APPROVED_LOCKED', message: saveResult.reason },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: (saveResult as { ok: false; skipped: false; error: string }).error },
      { status: 500 },
    );
  }

  return NextResponse.json({
    company_uid:    companyUid,
    model:          comp.model,
    generated_at:   generatedAt,
    evidence_count: evidence.length,
    alert_count:    alerts.length,
    people_count:   people.length,
    ...result,
    saved:   true,
    created: saveResult.created,
  });
}
