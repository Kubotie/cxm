// ─── POST /api/support/[caseId]/triage ────────────────────────────────────────
// Support Case の AI トリアージを実行して返す。
// save=true を渡すと生成結果を support_case_ai_state へ upsert する。
//
// フロー:
//   1. NocoDB から source record を取得（未設定の場合は body.caseContext にフォールバック）
//   2. リンクされた CSE Ticket を補助参照（テーブル未設定の場合は空）
//   3. OpenAI で Structured Output としてトリアージを生成
//   4. save=true の場合: support_case_ai_state へ upsert（保護チェックあり）
//   5. 結果を返す

import { NextRequest, NextResponse } from 'next/server';
import { getSupportCaseById, getCseTicketQueueByCompanyOrCase } from '@/lib/nocodb/support';
import { buildSourceRef } from '@/lib/support/source-ref';
import { getOpenAIClient, getOpenAIModel } from '@/lib/openai/client';
import {
  SUPPORT_TRIAGE_SYSTEM_PROMPT,
  SUPPORT_TRIAGE_JSON_SCHEMA,
  buildSupportTriagePrompt,
  buildSupportTriagePromptFromContext,
} from '@/lib/prompts/support-triage';
import type { SupportTriageResult, SupportTriageApiResponse } from '@/lib/prompts/support-triage';
import type { TriageRequestBody, SupportCaseAIStateWritePayload } from '@/lib/support/ai-types';
import { saveSupportCaseAIState } from '@/lib/nocodb/support-write';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;
  const body: TriageRequestBody = await req.json().catch(() => ({}));
  const ref = buildSourceRef(caseId, body.sourceTable);

  try {
    // ── 1. source record の取得 ──────────────────────────────────────────────
    const [sourceCase, cseTickets] = await Promise.all([
      getSupportCaseById(ref.sourceRecordId).catch(() => null),
      getCseTicketQueueByCompanyOrCase({ caseId }).catch(() => []),
    ]);

    // ── 2. プロンプト構築 ────────────────────────────────────────────────────
    const userPrompt = sourceCase
      ? buildSupportTriagePrompt(sourceCase, { cseTickets })
      : buildSupportTriagePromptFromContext(caseId, body.caseContext);

    // ── 3. OpenAI でトリアージ生成 ───────────────────────────────────────────
    const openai = getOpenAIClient();
    const model   = getOpenAIModel();

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SUPPORT_TRIAGE_SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: SUPPORT_TRIAGE_JSON_SCHEMA,
      },
    });

    const raw = completion.choices[0].message.content;
    if (!raw) {
      return NextResponse.json(
        { error: 'OpenAI が空のレスポンスを返しました' },
        { status: 502 },
      );
    }

    const result: SupportTriageResult = JSON.parse(raw);

    // ── 4. NocoDB への保存（save=true 時のみ）────────────────────────────────
    let saved: boolean | undefined;
    let save_skipped: boolean | undefined;
    let save_skip_reason: string | undefined;

    if (body.save) {
      const writePayload: SupportCaseAIStateWritePayload = {
        source_id: ref.sourceRecordId,
        source_table: ref.sourceQueue,
        triage_note: result.triage_note,
        suggested_action: result.suggested_action,
        escalation_needed: result.escalation_needed,
        category: result.category,
        urgency: result.severity,
        suggested_team: result.suggested_team,
        routing_reason: result.routing_reason,
        generated_by: completion.model,
      };

      const saveResult = await saveSupportCaseAIState(ref, writePayload);

      if (saveResult.ok) {
        saved = true;
      } else {
        save_skipped = true;
        const r = saveResult as Extract<typeof saveResult, { ok: false }>;
        if (r.skipped) {
          save_skip_reason = r.reason;
        } else {
          console.warn('[api/support/triage] save failed:', (r as { ok: false; skipped: false; error: string }).error);
          save_skip_reason = `保存エラー: ${(r as { ok: false; skipped: false; error: string }).error}`;
        }
      }
    }

    // ── 5. レスポンス ─────────────────────────────────────────────────────────
    return NextResponse.json({
      ...result,
      model: completion.model,
      generated_at: new Date().toISOString(),
      case_id: caseId,
      ...(saved !== undefined        && { saved }),
      ...(save_skipped !== undefined && { save_skipped }),
      ...(save_skip_reason           && { save_skip_reason }),
    } satisfies SupportTriageApiResponse);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes('OPENAI_API_KEY')) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    if (msg.includes('OpenAI') || msg.includes('openai')) {
      return NextResponse.json({ error: `OpenAI エラー: ${msg}` }, { status: 502 });
    }

    console.error('[api/support/triage]', err);
    return NextResponse.json({ error: `Internal error: ${msg}` }, { status: 500 });
  }
}
