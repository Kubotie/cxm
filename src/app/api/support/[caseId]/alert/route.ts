// ─── POST /api/support/[caseId]/alert ────────────────────────────────────────
// 案件から運用アラートを AI で生成する。
// save=true を渡すと生成結果を support_alerts へ upsert する。
//
// フロー:
//   1. NocoDB から source record を取得（未設定の場合は body.caseContext にフォールバック）
//   2. CSE Ticket / AI state を補助参照（任意）
//   3. OpenAI で Structured Output として alert を生成
//   4. save=true の場合: support_alerts へ upsert（保護チェックあり）
//   5. 結果を返す
//
// upsert キー: source_id + source_table + alert_type
// 保護条件: alert の status が "Resolved" または "Dismissed" の場合は上書きしない

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupportCaseById,
  getCseTicketQueueByCompanyOrCase,
  getSupportCaseAIStateBySource,
} from '@/lib/nocodb/support';
import { buildSourceRef } from '@/lib/support/source-ref';
import { getOpenAIClient, getOpenAIModel } from '@/lib/openai/client';
import {
  SUPPORT_ALERT_SYSTEM_PROMPT,
  SUPPORT_ALERT_JSON_SCHEMA,
  buildSupportAlertPrompt,
  buildSupportAlertPromptFromContext,
} from '@/lib/prompts/support-alert';
import type { SupportAlertResult, SupportAlertApiResponse } from '@/lib/prompts/support-alert';
import type { SupportAlertWritePayload } from '@/lib/support/ai-types';
import { saveSupportAlert } from '@/lib/nocodb/support-write';

// ── リクエストボディ型 ────────────────────────────────────────────────────────

interface AlertRequestBody {
  sourceTable?: string;
  save?: boolean;
  caseContext?: import('@/lib/support/ai-types').CaseContext;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;
  const body: AlertRequestBody = await req.json().catch(() => ({}));
  const ref = buildSourceRef(caseId, body.sourceTable);

  try {
    // ── 1. source record の取得 ──────────────────────────────────────────────
    const [sourceCase, cseTickets, aiState] = await Promise.all([
      getSupportCaseById(ref.sourceRecordId).catch(() => null),
      getCseTicketQueueByCompanyOrCase({ caseId }).catch(() => []),
      getSupportCaseAIStateBySource(ref.sourceRecordId, ref.sourceQueue).catch(() => null),
    ]);

    // ── 2. プロンプト構築 ────────────────────────────────────────────────────
    const userPrompt = sourceCase
      ? buildSupportAlertPrompt(sourceCase, { cseTickets, aiState })
      : buildSupportAlertPromptFromContext(caseId, body.caseContext);

    // ── 3. OpenAI でアラート生成 ─────────────────────────────────────────────
    const openai = getOpenAIClient();
    const model   = getOpenAIModel();

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SUPPORT_ALERT_SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: SUPPORT_ALERT_JSON_SCHEMA,
      },
    });

    const raw = completion.choices[0].message.content;
    if (!raw) {
      return NextResponse.json(
        { error: 'OpenAI が空のレスポンスを返しました' },
        { status: 502 },
      );
    }

    const result: SupportAlertResult = JSON.parse(raw);

    // ── 4. NocoDB への保存（save=true 時のみ）────────────────────────────────
    let saved: boolean | undefined;
    let save_skipped: boolean | undefined;
    let save_skip_reason: string | undefined;

    if (body.save) {
      const writePayload: SupportAlertWritePayload = {
        source_record_id: ref.sourceRecordId,
        source_queue:     ref.sourceQueue,
        alert_type:      result.alert_type,
        priority:        result.priority,
        status:          result.status,
        title:           result.title,
        summary:         result.summary,
        why_this_matters: result.why_this_matters,
        suggested_action: result.suggested_action,
        escalation_needed: result.escalation_needed,
        source:          ref.sourceQueue,
        company_name:    sourceCase?.company ?? body.caseContext?.company,
        company_uid:     sourceCase?.companyId ?? undefined,
        generated_by:    completion.model,
      };

      const saveResult = await saveSupportAlert(writePayload);

      if (saveResult.ok) {
        saved = true;
      } else {
        save_skipped = true;
        const r = saveResult as Extract<typeof saveResult, { ok: false }>;
        if (r.skipped) {
          save_skip_reason = r.reason;
        } else {
          console.warn('[api/support/alert] save failed:', (r as { ok: false; skipped: false; error: string }).error);
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
    } satisfies SupportAlertApiResponse);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes('OPENAI_API_KEY')) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    if (msg.includes('OpenAI') || msg.includes('openai')) {
      return NextResponse.json({ error: `OpenAI エラー: ${msg}` }, { status: 502 });
    }

    console.error('[api/support/alert]', err);
    return NextResponse.json({ error: `Internal error: ${msg}` }, { status: 500 });
  }
}
