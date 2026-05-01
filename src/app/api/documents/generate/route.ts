// ─── POST /api/documents/generate ────────────────────────────────────────────
// デッキテンプレートとアセットをもとにPPTXを生成する。
//
// リクエスト:
//   { deck_template_id, asset_ids?, company_name?, auto_recommend? }
//
// レスポンス:
//   { download_url, document_id, title, referenced_asset_count, slide_count }

export const maxDuration = 60; // Vercel Function タイムアウト延長（PPTX生成に必要）

import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient, getAnthropicModel } from '@/lib/anthropic/client';
import {
  DOCUMENT_GENERATE_TOOL,
  ASSET_RECOMMEND_TOOL,
  buildDocumentGeneratePrompt,
  buildAssetRecommendPrompt,
  type SlideStructure,
} from '@/lib/prompts/document-generate';
import { getAssets, getAssetById, incrementReferenceCount } from '@/lib/nocodb/assets';
import { generatePptx } from '@/lib/pptx/generator';
import { createDocument } from '@/lib/nocodb/documents';
import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';
import { getBuiltinTemplate } from '@/lib/deck-templates';
import type { DeckTemplate } from '@/lib/deck-templates';

/** Blob に保存されたテンプレートを取得 */
async function fetchBlobTemplate(templateId: string): Promise<DeckTemplate | null> {
  try {
    const { list } = await import('@vercel/blob');
    const { blobs } = await list({ prefix: `deck-templates/${templateId}.json` });
    const blob = blobs[0];
    if (!blob) return null;
    const res = await fetch(blob.url);
    if (!res.ok) return null;
    return await res.json() as DeckTemplate;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: {
    deck_template_id?: string;
    asset_ids?: string[];
    company_name?: string;
    user_instruction?: string;
    auto_recommend?: boolean;
  };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'リクエストボディのパースに失敗しました' }, { status: 400 });
  }

  const templateId = body.deck_template_id ?? 'ptmind-deck';

  // デッキテンプレートを解決（内蔵 → Blob の順で検索）
  const deckTemplate: DeckTemplate | null =
    getBuiltinTemplate(templateId) ?? await fetchBlobTemplate(templateId);

  if (!deckTemplate) {
    return NextResponse.json(
      { error: `デッキテンプレート "${templateId}" が見つかりません` },
      { status: 400 },
    );
  }

  // Claude クライアント
  let anthropic: ReturnType<typeof getAnthropicClient>;
  let model: string;
  try {
    anthropic = getAnthropicClient();
    model = getAnthropicModel();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 503 });
  }

  // ── アセットを決定 ─────────────────────────────────────────────────────────
  let selectedAssetIds: string[] = body.asset_ids ?? [];

  if (selectedAssetIds.length === 0 || body.auto_recommend) {
    const allAssets = await getAssets({ limit: 50 }).catch(() => []);
    if (allAssets.length > 0) {
      const summaries = allAssets.map(a => ({
        asset_id: a.asset_id,
        title:    a.title,
        summary:  a.summary ?? '',
      }));

      const recommendRes = await anthropic.chat.completions.create({
        model,
        max_tokens: 512,
        tools: [ASSET_RECOMMEND_TOOL],
        tool_choice: { type: 'function', function: { name: 'recommend_assets' } },
        messages: [{
          role: 'user',
          content: buildAssetRecommendPrompt(deckTemplate.name, summaries),
        }],
      });

      const toolCall = recommendRes.choices[0]?.message.tool_calls?.[0];
      if (toolCall && toolCall.type === 'function') {
        const input = JSON.parse(toolCall.function.arguments) as { recommended_asset_ids: string[] };
        selectedAssetIds = input.recommended_asset_ids ?? [];
      }
    }
  }

  // アセット内容を取得
  const assetDetails = await Promise.all(
    selectedAssetIds.map(id => getAssetById(id).catch(() => null)),
  ).then(arr => arr.filter(a => a !== null));

  const assetContexts = assetDetails.map(a => ({
    title:   a!.title,
    summary: a!.summary ?? '',
    content: a!.content,
  }));

  // ── スライド生成（Claude API via OpenRouter）─────────────────────────────
  const generateRes = await anthropic.chat.completions.create({
    model,
    max_tokens: 4096,
    tools: [DOCUMENT_GENERATE_TOOL],
    tool_choice: { type: 'function', function: { name: 'generate_slides' } },
    messages: [{
      role: 'user',
      content: buildDocumentGeneratePrompt(
        deckTemplate.prompt_guidance,
        assetContexts,
        body.company_name,
        body.user_instruction,
      ),
    }],
  });

  const genToolCall = generateRes.choices[0]?.message.tool_calls?.[0];
  if (!genToolCall || genToolCall.type !== 'function') {
    return NextResponse.json(
      { error: 'Claude API からスライド構造が返されませんでした' },
      { status: 500 },
    );
  }

  const slideStructure = JSON.parse(genToolCall.function.arguments) as SlideStructure;

  // ── PPTX生成 ─────────────────────────────────────────────────────────────
  let pptxBuffer: Buffer;
  try {
    pptxBuffer = await generatePptx(slideStructure, deckTemplate.brand_tokens, deckTemplate.id, deckTemplate.layout_engine);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `PPTX生成エラー: ${message}` }, { status: 500 });
  }

  // ── Vercel Blob にアップロード ──────────────────────────────────────────
  const documentId = randomUUID();
  const filename = `${documentId}-${deckTemplate.name}.pptx`;

  let blobUrl: string | null = null;
  try {
    const blob = await put(`csm-documents/${filename}`, pptxBuffer, {
      access: 'public',
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
    blobUrl = blob.url;
  } catch (err) {
    console.warn('Vercel Blob アップロードスキップ:', err instanceof Error ? err.message : err);
  }

  // ── reference_count をインクリメント ─────────────────────────────────────
  await Promise.allSettled(
    assetDetails.map(a =>
      incrementReferenceCount(a!.Id, a!.reference_count).catch(() => {}),
    ),
  );

  // ── NocoDB に記録 ────────────────────────────────────────────────────────
  await createDocument({
    document_id:          documentId,
    template_type:        deckTemplate.id,
    title:                slideStructure.title,
    referenced_asset_ids: selectedAssetIds,
    generated_content:    JSON.stringify(slideStructure),
    blob_url:             blobUrl,
    created_by:           null,
  }).catch(err => {
    console.warn('csm_documents 保存スキップ:', err instanceof Error ? err.message : err);
  });

  return NextResponse.json({
    document_id:            documentId,
    title:                  slideStructure.title,
    download_url:           blobUrl,
    referenced_asset_count: assetDetails.length,
    slide_count:            slideStructure.slides.length,
  });
}
