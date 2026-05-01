// ─── POST /api/actions/[actionId]/review ─────────────────────────────────────
// アクション実施後のレビューをAIが整理してcsm_assetsに資産化する。
//
// リクエスト: { review_text, action_title, company_name?, original_plan?, created_by? }
// レスポンス: { review: ActionReviewResult, asset_id: string }

import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient, getAnthropicModel } from '@/lib/anthropic/client';
import {
  ACTION_REVIEW_TOOL,
  buildActionReviewPrompt,
  type ActionReviewResult,
} from '@/lib/prompts/action-review';
import { createAsset } from '@/lib/nocodb/assets';
import { randomUUID } from 'crypto';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ actionId: string }> },
) {
  const { actionId } = await params;

  let body: {
    review_text?: string;
    action_title?: string;
    company_name?: string;
    original_plan?: string;
    created_by?: string;
  };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'リクエストボディのパースに失敗しました' }, { status: 400 });
  }

  if (!body.review_text?.trim()) {
    return NextResponse.json({ error: 'review_text が必要です' }, { status: 400 });
  }
  if (!body.action_title?.trim()) {
    return NextResponse.json({ error: 'action_title が必要です' }, { status: 400 });
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
    tools: [ACTION_REVIEW_TOOL],
    tool_choice: { type: 'function', function: { name: 'summarize_action_review' } },
    messages: [
      {
        role: 'user',
        content: buildActionReviewPrompt(
          body.action_title,
          body.company_name,
          body.original_plan,
          body.review_text,
        ),
      },
    ],
  });

  const toolCall = response.choices[0]?.message.tool_calls?.[0];
  if (!toolCall || toolCall.type !== 'function') {
    return NextResponse.json({ error: 'Claude API からレビュー結果が返されませんでした' }, { status: 500 });
  }

  const review = JSON.parse(toolCall.function.arguments) as ActionReviewResult;

  // csm_assets に保存（source_type: 'review'）
  const assetId = randomUUID();
  const title = `レビュー: ${body.action_title}${body.company_name ? ` (${body.company_name})` : ''}`;

  const asset = await createAsset({
    asset_id:          assetId,
    title,
    content:           review.md_content,
    blob_url:          null,
    category:          '事例',
    category_reason:   'アクションレビューから生成',
    summary:           review.summary,
    author:            body.created_by ?? null,
    source_type:       'review',
    linked_action_id:  actionId,
    created_by:        body.created_by ?? null,
    created_at:        new Date().toISOString(),
    tags:              'レビュー,学習,AI生成',
  });

  return NextResponse.json({ review, asset_id: asset.asset_id, asset });
}
