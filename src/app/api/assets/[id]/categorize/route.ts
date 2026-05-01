// ─── POST /api/assets/[id]/categorize ────────────────────────────────────────
// 既存アセットをClaude APIで再カテゴリ分類する。
// アップロード後に手動で再分析したい場合に使用。

import { NextRequest, NextResponse } from 'next/server';
import { getAssetById, updateAssetCategory } from '@/lib/nocodb/assets';
import { getAnthropicClient, getAnthropicModel } from '@/lib/anthropic/client';
import {
  ASSET_ANALYSIS_TOOL,
  buildAssetAnalysisPrompt,
  type AssetAnalysisResult,
} from '@/lib/prompts/asset-analysis';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const asset = await getAssetById(id).catch(() => null);
  if (!asset) {
    return NextResponse.json({ error: 'アセットが見つかりません' }, { status: 404 });
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
    max_tokens: 1024,
    tools: [ASSET_ANALYSIS_TOOL],
    tool_choice: { type: 'function', function: { name: 'analyze_asset' } },
    messages: [
      {
        role: 'user',
        content: buildAssetAnalysisPrompt(asset.title, asset.content),
      },
    ],
  });

  const toolCall = response.choices[0]?.message.tool_calls?.[0];
  if (!toolCall || toolCall.type !== 'function') {
    return NextResponse.json({ error: 'Claude API からツール呼び出しが返されませんでした' }, { status: 500 });
  }

  const analysis = JSON.parse(toolCall.function.arguments) as AssetAnalysisResult;
  const updated = await updateAssetCategory(asset.Id, {
    category: analysis.category,
    category_reason: analysis.category_reason,
    summary: analysis.summary,
    title: analysis.title_suggestion,
  });

  return NextResponse.json({ asset: updated, analysis });
}
