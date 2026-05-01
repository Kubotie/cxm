// ─── POST /api/documents/generate ────────────────────────────────────────────
// SSE ストリーミング対応。思考過程をリアルタイムで返す。
//
// レスポンス: text/event-stream
//   data: {"type":"status","message":"..."}
//   data: {"type":"thinking","delta":"..."}   ← 思考テキストの差分
//   data: {"type":"done","document_id":"...","title":"...","download_url":"...","md_content":"...","slide_count":N}
//   data: {"type":"error","message":"..."}

export const maxDuration = 300;

import { NextRequest } from 'next/server';
import { getAnthropicClient, getAnthropicModel } from '@/lib/anthropic/client';
import {
  DOCUMENT_GENERATE_TOOL,
  DOCUMENT_GENERATE_TEXT_TOOL,
  SLIDE_REVIEW_TOOL,
  ASSET_EXTRACT_TOOL,
  ASSET_RECOMMEND_TOOL,
  buildDocumentGeneratePrompt,
  buildTextDocumentPrompt,
  buildSlideReviewPrompt,
  buildSlideFixPrompt,
  buildAssetExtractPrompt,
  buildAssetRecommendPrompt,
  type SlideStructure,
  type SlideReview,
  type AssetInsights,
  type TextDocument,
} from '@/lib/prompts/document-generate';
import { getAssets, getAssetById, incrementReferenceCount } from '@/lib/nocodb/assets';
import { generatePptx } from '@/lib/pptx/generator';
import { createDocument, type DocumentFileType } from '@/lib/nocodb/documents';
import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';
import { getBuiltinTemplate } from '@/lib/deck-templates';
import type { DeckTemplate } from '@/lib/deck-templates';
import { getUserUidFromCookie } from '@/lib/auth/session';

type OutputType = 'pptx' | 'md' | 'docs';

/** SSE イベントを文字列化 */
function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

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

/** Markdown → Word (.docx) バッファを生成 */
async function buildDocxBuffer(title: string, markdownContent: string): Promise<Buffer> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');

  const children: InstanceType<typeof Paragraph>[] = [];
  children.push(new Paragraph({ text: title, heading: HeadingLevel.TITLE, spacing: { after: 400 } }));

  for (const line of markdownContent.split('\n')) {
    if (line.startsWith('### ')) {
      children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } }));
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }));
    } else if (line.startsWith('# ')) {
      children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: line.slice(2) })] }));
    } else if (line.startsWith('  - ') || line.startsWith('  * ')) {
      children.push(new Paragraph({ bullet: { level: 1 }, children: [new TextRun({ text: line.slice(4) })] }));
    } else if (line.trim() === '') {
      children.push(new Paragraph({ text: '' }));
    } else {
      const runs: InstanceType<typeof TextRun>[] = [];
      const boldRegex = /\*\*(.+?)\*\*/g;
      let last = 0; let m: RegExpExecArray | null;
      while ((m = boldRegex.exec(line)) !== null) {
        if (m.index > last) runs.push(new TextRun({ text: line.slice(last, m.index) }));
        runs.push(new TextRun({ text: m[1], bold: true }));
        last = m.index + m[0].length;
      }
      if (last < line.length) runs.push(new TextRun({ text: line.slice(last) }));
      children.push(new Paragraph({ children: runs.length > 0 ? runs : [new TextRun({ text: line })] }));
    }
  }

  return Buffer.from(await Packer.toBuffer(new Document({ sections: [{ children }] })));
}

/**
 * Claude をストリーミングで呼び出し、thinking デルタを controller に流しながら
 * 最終的な tool_call の arguments 文字列を返す。
 */
async function streamClaudeWithThinking(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  anthropic: any,
  model: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>,
  controller: ReadableStreamDefaultController,
  thinkingBudget = 10_000,
): Promise<{ toolArgs: string; finishReason: string }> {
  const maxTokens = (params.max_tokens ?? 4096) + thinkingBudget;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream: any = await anthropic.chat.completions.create({
    ...params,
    model,
    max_tokens: maxTokens,
    stream: true,
    thinking: { type: 'enabled', budget_tokens: thinkingBudget },
  });

  let toolArgs = '';
  let finishReason = 'unknown';

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;

    // 思考テキスト（OpenRouter は reasoning フィールドで流す）
    if (delta.reasoning) {
      controller.enqueue(sseEvent({ type: 'thinking', delta: delta.reasoning }));
    }

    // tool_call の arguments を蓄積
    const toolCallDelta = delta.tool_calls?.[0];
    if (toolCallDelta?.function?.arguments) {
      toolArgs += toolCallDelta.function.arguments;
    }

    if (chunk.choices?.[0]?.finish_reason) {
      finishReason = chunk.choices[0].finish_reason;
    }
  }

  return { toolArgs, finishReason };
}

export async function POST(req: NextRequest) {
  let body: {
    output_type?: OutputType;
    deck_template_id?: string;
    asset_ids?: string[];
    company_name?: string;
    user_instruction?: string;
    auto_recommend?: boolean;
  };
  try {
    body = await req.json() as typeof body;
  } catch {
    return new Response(
      sseEvent({ type: 'error', message: 'リクエストボディのパースに失敗しました' }),
      { status: 400, headers: { 'Content-Type': 'text/event-stream' } },
    );
  }

  const outputType: OutputType = body.output_type ?? 'pptx';
  const userId = await getUserUidFromCookie();

  // SSE ストリームを作成
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(sseEvent(data));
      };

      try {
        // Claude クライアント
        let anthropic: ReturnType<typeof getAnthropicClient>;
        let model: string;
        try {
          anthropic = getAnthropicClient();
          model = getAnthropicModel();
        } catch (err) {
          send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
          controller.close();
          return;
        }

        // ── pptx のみ: デッキテンプレートを解決 ───────────────────────────
        let deckTemplate: DeckTemplate | null = null;
        if (outputType === 'pptx') {
          const templateId = body.deck_template_id ?? 'ptmind-deck';
          deckTemplate = getBuiltinTemplate(templateId) ?? await fetchBlobTemplate(templateId);
          if (!deckTemplate) {
            send({ type: 'error', message: `デッキテンプレート "${templateId}" が見つかりません` });
            controller.close();
            return;
          }
        }

        // ── アセットを決定 ──────────────────────────────────────────────────
        send({ type: 'status', message: 'アセットを確認中...' });
        let selectedAssetIds: string[] = body.asset_ids ?? [];

        if (selectedAssetIds.length === 0 || body.auto_recommend) {
          const allAssets = await getAssets({ limit: 50 }).catch(() => []);
          if (allAssets.length > 0) {
            const summaries = allAssets.map(a => ({ asset_id: a.asset_id, title: a.title, summary: a.summary ?? '' }));
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const recommendRes = await anthropic.chat.completions.create({
                model,
                max_tokens: 512,
                tools: [ASSET_RECOMMEND_TOOL],
                tool_choice: { type: 'function', function: { name: 'recommend_assets' } },
                messages: [{ role: 'user', content: buildAssetRecommendPrompt(deckTemplate?.name ?? outputType, summaries) }],
              } as any);
              const toolCall = recommendRes.choices?.[0]?.message.tool_calls?.[0];
              if (toolCall?.type === 'function') {
                const input = JSON.parse(toolCall.function.arguments) as { recommended_asset_ids: string[] };
                selectedAssetIds = input.recommended_asset_ids ?? [];
              }
            } catch (err) {
              console.warn('[generate] asset recommend error:', err instanceof Error ? err.message : err);
            }
          }
        }

        const assetDetails = await Promise.all(
          selectedAssetIds.map(id => getAssetById(id).catch(() => null)),
        ).then(arr => arr.filter(a => a !== null));

        // ── アセット深読み（並列実行）──────────────────────────────────────
        type AssetContext = { title: string; summary: string; content: string; insights?: AssetInsights };
        let assetContexts: AssetContext[] = assetDetails.map(a => ({
          title: a!.title, summary: a!.summary ?? '', content: a!.content,
        }));

        if (assetDetails.length > 0 && outputType === 'pptx') {
          send({ type: 'status', message: `アセットを深読み中... (${assetDetails.length}件)` });
          const extractContext = {
            templateName:    deckTemplate?.name,
            userInstruction: body.user_instruction,
            companyName:     body.company_name,
          };

          const extracted = await Promise.all(
            assetDetails.map(async (a): Promise<AssetContext> => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const res = await (anthropic as any).chat.completions.create({
                  model,
                  max_tokens: 640,
                  tools: [ASSET_EXTRACT_TOOL],
                  tool_choice: { type: 'function', function: { name: 'extract_insights' } },
                  messages: [{
                    role: 'user',
                    content: buildAssetExtractPrompt({ title: a!.title, content: a!.content }, extractContext),
                  }],
                });
                const call = res.choices?.[0]?.message?.tool_calls?.[0];
                if (call?.type === 'function') {
                  const insights = JSON.parse(call.function.arguments) as AssetInsights;
                  return { title: a!.title, summary: a!.summary ?? '', content: a!.content, insights };
                }
              } catch (err) {
                console.warn('[generate] asset extract error:', err instanceof Error ? err.message : err);
              }
              return { title: a!.title, summary: a!.summary ?? '', content: a!.content };
            }),
          );
          assetContexts = extracted;
        }

        // ── AI 生成（ストリーミング思考付き）──────────────────────────────
        send({ type: 'status', message: 'AI が考えています...' });

        const documentId = randomUUID();
        let blobUrl: string | null = null;
        let blobSize: number | undefined;
        let docTitle = '';
        let mdContent: string | undefined;
        let slideCount: number | undefined;
        const docType = outputType as DocumentFileType;

        if (outputType === 'pptx') {
          let toolArgs: string;
          let finishReason: string;
          try {
            ({ toolArgs, finishReason } = await streamClaudeWithThinking(
              anthropic, model,
              {
                max_tokens: 4096,
                tools: [DOCUMENT_GENERATE_TOOL],
                tool_choice: { type: 'function', function: { name: 'generate_slides' } },
                messages: [{
                  role: 'user',
                  content: buildDocumentGeneratePrompt(
                    deckTemplate!.prompt_guidance, assetContexts, body.company_name, body.user_instruction,
                  ),
                }],
              },
              controller,
            ));
          } catch (err) {
            send({ type: 'error', message: `AI生成エラー: ${err instanceof Error ? err.message : String(err)}` });
            controller.close();
            return;
          }

          if (!toolArgs) {
            send({ type: 'error', message: `Claude API からスライド構造が返されませんでした (finish_reason: ${finishReason})` });
            controller.close();
            return;
          }

          let slideStructure = JSON.parse(toolArgs) as SlideStructure;

          // ── レビューループ ─────────────────────────────────────────────────
          send({ type: 'status', message: 'スライドを検証中...' });
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const reviewRes = await (anthropic as any).chat.completions.create({
              model,
              max_tokens: 1024,
              tools: [SLIDE_REVIEW_TOOL],
              tool_choice: { type: 'function', function: { name: 'review_slides' } },
              messages: [{ role: 'user', content: buildSlideReviewPrompt(slideStructure) }],
            });
            const reviewCall = reviewRes.choices?.[0]?.message?.tool_calls?.[0];
            if (reviewCall?.type === 'function') {
              const review = JSON.parse(reviewCall.function.arguments) as SlideReview;
              send({ type: 'review', score: review.score, issue_count: review.issues.length });

              if (review.has_issues && review.score < 7 && review.issues.length > 0) {
                send({ type: 'status', message: `品質スコア ${review.score}/10 — ${review.issues.length}件の問題を修正中...` });
                const originalPrompt = buildDocumentGeneratePrompt(
                  deckTemplate!.prompt_guidance, assetContexts, body.company_name, body.user_instruction,
                );
                let fixArgs: string;
                try {
                  ({ toolArgs: fixArgs } = await streamClaudeWithThinking(
                    anthropic, model,
                    {
                      max_tokens: 4096,
                      tools: [DOCUMENT_GENERATE_TOOL],
                      tool_choice: { type: 'function', function: { name: 'generate_slides' } },
                      messages: [{
                        role: 'user',
                        content: buildSlideFixPrompt(originalPrompt, slideStructure, review),
                      }],
                    },
                    controller,
                  ));
                  if (fixArgs) {
                    slideStructure = JSON.parse(fixArgs) as SlideStructure;
                  }
                } catch (err) {
                  // 修正に失敗しても初回生成結果で続行
                  console.warn('[generate] fix loop error:', err instanceof Error ? err.message : err);
                }
              }
            }
          } catch (err) {
            // レビュー失敗は無視して続行
            console.warn('[generate] review error:', err instanceof Error ? err.message : err);
          }

          docTitle = slideStructure.title;
          slideCount = slideStructure.slides.length;

          // PPTX 生成
          send({ type: 'status', message: 'スライドを組み立て中...' });
          let pptxBuffer: Buffer;
          try {
            pptxBuffer = await generatePptx(slideStructure, deckTemplate!.brand_tokens, deckTemplate!.id, deckTemplate!.layout_engine);
          } catch (err) {
            send({ type: 'error', message: `PPTX生成エラー: ${err instanceof Error ? err.message : String(err)}` });
            controller.close();
            return;
          }

          send({ type: 'status', message: 'アップロード中...' });
          const safeTemplateName = deckTemplate!.name.replace(/[^\w\-]/g, '_');
          try {
            const blob = await put(`csm-documents/${documentId}-${safeTemplateName}.pptx`, pptxBuffer, {
              access: 'public',
              contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            });
            blobUrl = blob.url;
            blobSize = pptxBuffer.length;
          } catch (err) {
            console.warn('Blob アップロードスキップ:', err instanceof Error ? err.message : err);
          }

          await createDocument({
            document_id: documentId, document_type: docType, template_type: deckTemplate!.id,
            title: docTitle, referenced_asset_ids: selectedAssetIds,
            generated_content: JSON.stringify(slideStructure), blob_url: blobUrl,
            attachment: blobUrl ? { url: blobUrl, title: `${docTitle}.pptx`, mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', size: blobSize } : undefined,
            created_by: userId,
          }).catch(err => console.warn('csm_documents 保存スキップ:', err instanceof Error ? err.message : err));

        } else {
          // MD / Docs
          let toolArgs: string;
          let finishReason: string;
          try {
            ({ toolArgs, finishReason } = await streamClaudeWithThinking(
              anthropic, model,
              {
                max_tokens: 4096,
                tools: [DOCUMENT_GENERATE_TEXT_TOOL],
                tool_choice: { type: 'function', function: { name: 'generate_document' } },
                messages: [{
                  role: 'user',
                  content: buildTextDocumentPrompt(outputType, assetContexts, body.company_name, body.user_instruction),
                }],
              },
              controller,
            ));
          } catch (err) {
            send({ type: 'error', message: `AI生成エラー: ${err instanceof Error ? err.message : String(err)}` });
            controller.close();
            return;
          }

          if (!toolArgs) {
            send({ type: 'error', message: `Claude API から文書が返されませんでした (finish_reason: ${finishReason})` });
            controller.close();
            return;
          }

          const textDoc = JSON.parse(toolArgs) as TextDocument;
          docTitle = textDoc.title;
          mdContent = textDoc.content;

          send({ type: 'status', message: 'ファイルを生成中...' });
          let fileBuffer: Buffer;
          let contentType: string;
          let ext: string;

          if (outputType === 'docs') {
            fileBuffer = await buildDocxBuffer(docTitle, mdContent);
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            ext = 'docx';
          } else {
            fileBuffer = Buffer.from(`# ${docTitle}\n\n${mdContent}`, 'utf-8');
            contentType = 'text/markdown';
            ext = 'md';
          }

          const safeTitle = docTitle.replace(/[^\w\-]/g, '_').slice(0, 40);
          try {
            const blob = await put(`csm-documents/${documentId}-${safeTitle}.${ext}`, fileBuffer, { access: 'public', contentType });
            blobUrl = blob.url;
            blobSize = fileBuffer.length;
          } catch (err) {
            console.warn('Blob アップロードスキップ:', err instanceof Error ? err.message : err);
          }

          await createDocument({
            document_id: documentId, document_type: docType, template_type: outputType,
            title: docTitle, referenced_asset_ids: selectedAssetIds,
            generated_content: mdContent, blob_url: blobUrl,
            attachment: blobUrl ? { url: blobUrl, title: `${docTitle}.${ext}`, mimetype: contentType, size: blobSize } : undefined,
            created_by: userId,
          }).catch(err => console.warn('csm_documents 保存スキップ:', err instanceof Error ? err.message : err));
        }

        // reference_count インクリメント
        await Promise.allSettled(
          assetDetails.map(a => incrementReferenceCount(a!.Id, a!.reference_count).catch(() => {})),
        );

        // 完了
        send({
          type: 'done',
          document_id: documentId,
          output_type: outputType,
          title: docTitle,
          download_url: blobUrl,
          md_content: mdContent,
          referenced_asset_count: assetDetails.length,
          slide_count: slideCount,
        });

      } catch (err) {
        controller.enqueue(sseEvent({ type: 'error', message: err instanceof Error ? err.message : String(err) }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
}
