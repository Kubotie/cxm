// ─── POST /api/actions/ai-plan ───────────────────────────────────────────────
// アクションタイトルと会社名をもとにAIが計画を生成し、csm_assetsに保存する。
//
// リクエスト: { action_id, title, company_uid?, company_name?, action_purpose?, context? }
// レスポンス: { plan: ActionPlanResult, asset_id: string }

import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient, getAnthropicModel } from '@/lib/anthropic/client';
import {
  ACTION_PLAN_TOOL,
  buildActionPlanPrompt,
  type ActionPlanResult,
} from '@/lib/prompts/action-plan';
import { createAsset } from '@/lib/nocodb/assets';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  let body: {
    action_id?: string;
    title?: string;
    company_uid?: string;
    company_name?: string;
    action_purpose?: string;
    context?: string;
    created_by?: string;
  };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'リクエストボディのパースに失敗しました' }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'title が必要です' }, { status: 400 });
  }

  let anthropic: ReturnType<typeof getAnthropicClient>;
  let model: string;
  try {
    anthropic = getAnthropicClient();
    model = getAnthropicModel();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const response = await anthropic.chat.completions.create({
    model,
    max_tokens: 2048,
    tools: [ACTION_PLAN_TOOL],
    tool_choice: { type: 'function', function: { name: 'generate_action_plan' } },
    messages: [
      {
        role: 'user',
        content: buildActionPlanPrompt(
          body.title,
          body.company_name,
          body.action_purpose,
          body.context,
        ),
      },
    ],
  });

  const toolCall = response.choices[0]?.message.tool_calls?.[0];
  if (!toolCall || toolCall.type !== 'function') {
    return NextResponse.json({ error: 'Claude API から計画が返されませんでした' }, { status: 500 });
  }

  const plan = JSON.parse(toolCall.function.arguments) as ActionPlanResult;

  // csm_assets に保存（source_type: 'ai_plan'）
  const assetId = randomUUID();
  const title = `AI計画: ${body.title}${body.company_name ? ` (${body.company_name})` : ''}`;

  const asset = await createAsset({
    asset_id:          assetId,
    title,
    content:           plan.md_content,
    blob_url:          null,
    category:          'AI計画',
    category_reason:   'AI生成計画',
    summary:           `${body.company_name ? `[${body.company_name}] ` : ''}${plan.purpose}`,
    author:            body.created_by ?? null,
    source_type:       'ai_plan',
    linked_action_id:  body.action_id ?? null,
    created_by:        body.created_by ?? null,
    created_at:        new Date().toISOString(),
    tags:              '計画,AI生成',
  });

  return NextResponse.json({ plan, asset_id: asset.asset_id, asset });
}
