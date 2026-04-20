// ─── POST /api/support/[caseId]/draft-reply ──────────────────────────────────
// 顧客への返信ドラフトを AI で生成する。
// save=true を渡すと生成結果を support_case_ai_state へ upsert する。
//
// フロー:
//   1. NocoDB から source record を取得（未設定の場合は body.caseContext にフォールバック）
//   2. AI state を取得し summary / triage 情報を文脈に加える（任意）
//   3. OpenAI で Structured Output として返信ドラフトを生成
//   4. save=true の場合: support_case_ai_state へ upsert（保護チェックあり）
//   5. 結果を返す

import { NextRequest, NextResponse } from 'next/server';
import { getSupportCaseById, getSupportCaseAIStateBySource, getCseTicketQueueByCompanyOrCase } from '@/lib/nocodb/support';
import { buildSourceRef } from '@/lib/support/source-ref';
import { getOpenAIClient, getOpenAIModel } from '@/lib/openai/client';
import {
  SUPPORT_DRAFT_REPLY_JSON_SCHEMA,
  buildDraftReplySystemPrompt,
  buildDraftReplyPrompt,
  buildDraftReplyPromptFromContext,
} from '@/lib/prompts/support-draft-reply';
import type { SupportDraftReplyResult, SupportDraftReplyApiResponse } from '@/lib/prompts/support-draft-reply';
import type { DraftReplyRequestBody, SupportCaseAIStateWritePayload } from '@/lib/support/ai-types';
import { saveSupportCaseAIState } from '@/lib/nocodb/support-write';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;
  const body: DraftReplyRequestBody = await req.json().catch(() => ({}));
  const tone     = body.tone     ?? 'formal';
  const language = body.language ?? 'ja';
  const ref = buildSourceRef(caseId, 'support_queue');

  try {
    // ── 1. source record の取得 ──────────────────────────────────────────────
    const [sourceCase, aiState] = await Promise.all([
      getSupportCaseById(ref.sourceRecordId).catch(() => null),
      getSupportCaseAIStateBySource(ref.sourceRecordId, ref.sourceQueue).catch(() => null),
    ]);

    // CSE Ticket は補助参照（エラーは無視）
    const cseTickets = await getCseTicketQueueByCompanyOrCase({ caseId }).catch(() => []);
    void cseTickets; // 現時点では prompt に含めないが fetch は保持

    // ── 2. プロンプト構築 ────────────────────────────────────────────────────
    const systemPrompt = buildDraftReplySystemPrompt(tone, language);

    const userPrompt = sourceCase
      ? buildDraftReplyPrompt(sourceCase, {
          aiState,
          instructions:  body.instructions,
          contextHints:  body.contextHints,
        })
      : buildDraftReplyPromptFromContext(caseId, body.caseContext, {
          instructions: body.instructions,
          contextHints: body.contextHints,
        });

    // ── 3. OpenAI で返信ドラフト生成 ─────────────────────────────────────────
    const openai = getOpenAIClient();
    const model   = getOpenAIModel();

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: SUPPORT_DRAFT_REPLY_JSON_SCHEMA,
      },
    });

    const raw = completion.choices[0].message.content;
    if (!raw) {
      return NextResponse.json(
        { error: 'OpenAI が空のレスポンスを返しました' },
        { status: 502 },
      );
    }

    const result: SupportDraftReplyResult = JSON.parse(raw);

    // ── 4. NocoDB への保存（save=true 時のみ）────────────────────────────────
    let saved: boolean | undefined;
    let save_skipped: boolean | undefined;
    let save_skip_reason: string | undefined;

    if (body.save) {
      const writePayload: SupportCaseAIStateWritePayload = {
        source_record_id:  ref.sourceRecordId,
        source_queue:      ref.sourceQueue,
        draft_reply:       result.draft_reply,
        reply_tone:        result.reply_tone,
        reply_key_points:  JSON.stringify(result.key_points),
        generated_by:      completion.model,
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
          console.warn('[api/support/draft-reply] save failed:', (r as { ok: false; skipped: false; error: string }).error);
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
    } satisfies SupportDraftReplyApiResponse);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes('OPENAI_API_KEY')) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    if (msg.includes('OpenAI') || msg.includes('openai')) {
      return NextResponse.json({ error: `OpenAI エラー: ${msg}` }, { status: 502 });
    }

    console.error('[api/support/draft-reply]', err);
    return NextResponse.json({ error: `Internal error: ${msg}` }, { status: 500 });
  }
}
