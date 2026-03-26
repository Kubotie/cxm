// ─── POST /api/companies/[companyUid]/log/signals ─────────────────────────────
// Unified Log のエントリを分析し、リスク・オポチュニティ・不足情報などの
// AI Signal Extraction を行う。
// save=true のとき unified_log_signal_state (derived table) へ upsert する。
//
// ── リクエストボディ ────────────────────────────────────────────────────────
// {
//   save?: boolean;   // true のとき結果を NocoDB へ保存 (default: false)
// }
//
// ── レスポンス（共通） ──────────────────────────────────────────────────────
// {
//   company_uid:     string,
//   model:           string,
//   generated_at:    ISO8601,
//   log_count:       number,
//   key_signals:     [{ title, description, signal_type }],
//   risk_signals:    [{ title, description, urgency }],
//   opportunity_signals: [{ title, description, potential_impact }],
//   missing_information: [{ category, description }],
//   recommended_next_review_focus: string,
//   saved?:          boolean,     // save=true 時のみ
//   created?:        boolean,     // save=true 時: true=新規作成 / false=更新
//   save_error?:     string,      // 保存失敗時のエラーメッセージ（生成結果は返す）
// }

import { NextRequest, NextResponse } from 'next/server';
import { fetchCompanyByUid } from '@/lib/nocodb/companies';
import { fetchLogEntries }   from '@/lib/nocodb/evidence';
import { fetchAlerts }       from '@/lib/nocodb/alerts';
import { fetchPeople }       from '@/lib/nocodb/people';
import { getOpenAIClient, getOpenAIModel } from '@/lib/openai/client';
import {
  UNIFIED_LOG_SIGNAL_SYSTEM_PROMPT,
  UNIFIED_LOG_SIGNAL_JSON_SCHEMA,
  buildUnifiedLogSignalPrompt,
} from '@/lib/prompts/unified-log-signal';
import type { UnifiedLogSignalResult } from '@/lib/prompts/unified-log-signal';
import { saveUnifiedLogSignalState } from '@/lib/nocodb/unified-log-write';

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
  const [company, logs, alerts, people] = await Promise.all([
    fetchCompanyByUid(companyUid).catch(() => null),
    fetchLogEntries(companyUid).catch(() => []),
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
  const userPrompt = buildUnifiedLogSignalPrompt(company, logs, alerts, people);

  const comp = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: UNIFIED_LOG_SIGNAL_SYSTEM_PROMPT },
      { role: 'user',   content: userPrompt },
    ],
    response_format: { type: 'json_schema', json_schema: UNIFIED_LOG_SIGNAL_JSON_SCHEMA },
  });

  const raw = comp.choices[0].message.content;
  if (!raw) {
    return NextResponse.json({ error: 'OpenAI から空のレスポンスが返されました' }, { status: 500 });
  }

  const result: UnifiedLogSignalResult = JSON.parse(raw);
  const generatedAt = new Date().toISOString();

  // ── NocoDB への保存（save=true のみ） ──────────────────────────────────
  let saved:      boolean | undefined;
  let created:    boolean | undefined;
  let saveError:  string  | undefined;

  if (shouldSave) {
    const saveResult = await saveUnifiedLogSignalState({
      company_uid:                   companyUid,
      key_signals:                   JSON.stringify(result.key_signals),
      risk_signals:                  JSON.stringify(result.risk_signals),
      opportunity_signals:           JSON.stringify(result.opportunity_signals),
      missing_information:           JSON.stringify(result.missing_information),
      recommended_next_review_focus: result.recommended_next_review_focus,
      generated_by:                  comp.model,
      generated_at:                  generatedAt,
      last_ai_updated_at:            generatedAt,
      log_count:                     logs.length,
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
      console.warn('[signals] NocoDB 保存スキップ（保護ステータス）:', saveError);
    } else {
      saved     = false;
      saveError = (saveResult as { ok: false; skipped: false; error: string }).error;
      console.warn('[signals] NocoDB 保存失敗（生成結果は返す）:', saveError);
    }
  }

  return NextResponse.json({
    company_uid:  companyUid,
    model:        comp.model,
    generated_at: generatedAt,
    log_count:    logs.length,
    ...result,
    ...(shouldSave && { saved, created }),
    ...(saveError  && { save_error: saveError }),
  });
}
