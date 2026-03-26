// ─── POST /api/company/[companyUid]/summary ────────────────────────────────
// 指定企業の Evidence / Alerts / People を読み取り、OpenAI で Company Summary を生成。
// save=true のとき company_summary_state (derived table) へ upsert する。
//
// ── リクエスト ──────────────────────────────────────────────────────────────
// POST /api/company/[companyUid]/summary
// Body: { save?: boolean }   // true のとき NocoDB へ保存 (default: false)
//
// ── レスポンス（共通） ──────────────────────────────────────────────────────
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
//   saved?:          boolean,     // save=true 時のみ
//   created?:        boolean,     // save=true 時: true=新規作成 / false=更新
//   save_error?:     string,      // 保存失敗・スキップ時のメッセージ（生成結果は返す）
// }

import { NextRequest, NextResponse } from 'next/server';
import { fetchCompanyByUid } from '@/lib/nocodb/companies';
import { fetchEvidence }     from '@/lib/nocodb/evidence';
import { fetchAlerts }       from '@/lib/nocodb/alerts';
import { fetchPeople }       from '@/lib/nocodb/people';
import { getOpenAIClient, getOpenAIModel } from '@/lib/openai/client';
import {
  COMPANY_EVIDENCE_SUMMARY_SYSTEM_PROMPT,
  COMPANY_EVIDENCE_SUMMARY_JSON_SCHEMA,
  buildCompanyEvidenceSummaryPrompt,
} from '@/lib/prompts/company-evidence-summary';
import type { CompanyEvidenceSummaryResult } from '@/lib/prompts/company-evidence-summary';
import { saveCompanySummaryState } from '@/lib/nocodb/company-summary-write';

// ── リクエストボディ型 ────────────────────────────────────────────────────────

interface RequestBody {
  save?: boolean;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;

  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が必要です' }, { status: 400 });
  }

  const body: RequestBody = await req.json().catch(() => ({}));
  const shouldSave = body.save === true;

  // ── OpenAI クライアント初期化 ──────────────────────────────────────────
  let openai: ReturnType<typeof getOpenAIClient>;
  let model: string;
  try {
    openai = getOpenAIClient();
    model  = getOpenAIModel();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  // ── NocoDB からデータ取得（並列） ──────────────────────────────────────
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

  // ── プロンプト構築 & OpenAI 呼び出し ────────────────────────────────
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

  // ── NocoDB への保存（save=true のみ） ──────────────────────────────────
  let saved:     boolean | undefined;
  let created:   boolean | undefined;
  let saveError: string  | undefined;

  if (shouldSave) {
    const saveResult = await saveCompanySummaryState({
      company_uid:             companyUid,
      summary:                 result.summary,
      overall_health:          result.overall_health,
      key_risks:               JSON.stringify(result.key_risks),
      key_opportunities:       JSON.stringify(result.key_opportunities),
      recommended_next_action: result.recommended_next_action,
      generated_by:            comp.model,
      generated_at:            generatedAt,
      last_ai_updated_at:      generatedAt,
      evidence_count:          evidence.length,
      alert_count:             alerts.length,
      people_count:            people.length,
    }).catch(err => ({
      ok: false  as const,
      skipped: false as const,
      error: err instanceof Error ? err.message : String(err),
    }));

    if (saveResult.ok) {
      saved   = true;
      created = saveResult.created;
    } else if ('skipped' in saveResult && saveResult.skipped) {
      saved     = false;
      saveError = saveResult.reason;
      console.warn('[summary] NocoDB 保存スキップ（保護ステータス）:', saveError);
    } else {
      saved     = false;
      saveError = (saveResult as { ok: false; skipped: false; error: string }).error;
      console.warn('[summary] NocoDB 保存失敗（生成結果は返す）:', saveError);
    }
  }

  return NextResponse.json({
    company_uid:    companyUid,
    model:          comp.model,
    generated_at:   generatedAt,
    evidence_count: evidence.length,
    alert_count:    alerts.length,
    people_count:   people.length,
    ...result,
    ...(shouldSave && { saved, created }),
    ...(saveError  && { save_error: saveError }),
  });
}
