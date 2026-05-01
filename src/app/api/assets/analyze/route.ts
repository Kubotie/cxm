// ─── POST /api/assets/analyze ─────────────────────────────────────────────────
// MDファイルをBlobにアップロードしてClaudeで分析のみ行う（NocoDB保存はしない）。
// アップロードダイアログのステップ1（AI提案取得）で使用。
//
// リクエスト: multipart/form-data
//   file: MDファイル（.md）
//
// レスポンス: { title, category, category_reason, summary, blob_url, content }
// エラー:     { error: string }

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getAnthropicClient, getAnthropicModel } from '@/lib/anthropic/client';
import {
  ASSET_ANALYSIS_TOOL,
  buildAssetAnalysisPrompt,
  type AssetAnalysisResult,
} from '@/lib/prompts/asset-analysis';

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'FormData のパースに失敗しました' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'file が必要です' }, { status: 400 });
  }
  if (!file.name.endsWith('.md')) {
    return NextResponse.json({ error: '.md ファイルのみアップロードできます' }, { status: 400 });
  }

  const content = await file.text();
  if (!content.trim()) {
    return NextResponse.json({ error: 'ファイルが空です' }, { status: 400 });
  }

  // Vercel Blobにアップロード
  let blobUrl: string | null = null;
  try {
    const blob = await put(`csm-assets/${Date.now()}-${file.name}`, file, {
      access: 'public',
    });
    blobUrl = blob.url;
  } catch (err) {
    console.warn('Vercel Blob アップロードスキップ:', err instanceof Error ? err.message : err);
  }

  // Claude API（OpenRouter経由）で分析
  let analysis: AssetAnalysisResult | null = null;
  try {
    const client = getAnthropicClient();
    const model = getAnthropicModel();

    const response = await client.chat.completions.create({
      model,
      max_tokens: 1024,
      tools: [ASSET_ANALYSIS_TOOL],
      tool_choice: { type: 'function', function: { name: 'analyze_asset' } },
      messages: [
        {
          role: 'user',
          content: buildAssetAnalysisPrompt(file.name, content),
        },
      ],
    });

    const toolCall = response.choices[0]?.message.tool_calls?.[0];
    if (toolCall && toolCall.type === 'function') {
      analysis = JSON.parse(toolCall.function.arguments) as AssetAnalysisResult;
    }
  } catch (err) {
    console.warn('Claude API 分析エラー:', err instanceof Error ? err.message : err);
    // 分析失敗時はデフォルト値を返す
    analysis = {
      category: 'その他',
      category_reason: 'AI分析に失敗しました。手動で選択してください。',
      summary: '',
      title_suggestion: file.name.replace(/\.md$/, ''),
    };
  }

  return NextResponse.json({
    title: analysis?.title_suggestion ?? file.name.replace(/\.md$/, ''),
    category: analysis?.category ?? 'その他',
    category_reason: analysis?.category_reason ?? '',
    summary: analysis?.summary ?? '',
    blob_url: blobUrl,
    content,
  });
}
