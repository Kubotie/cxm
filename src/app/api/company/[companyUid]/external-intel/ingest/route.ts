// ─── POST /api/company/[companyUid]/external-intel/ingest ─────────────────────
//
// URL を貼るだけ / PDF を投げるだけ で外部情報を取り込み、シグナル候補を返す。
// **保存はしない**（human in the loop）。担当者が選んだものだけを
// /api/company/[companyUid]/external-intel (POST, items) で保存する。
//
// 設計根拠: docs-src/cxm_v2/17_WHO_WHAT_Matching_Plan.md §11
//
// 受け取り方は2通り:
//   application/json  … { url }                     URL を取得してテキスト化
//   multipart/form-data … file=<PDF/HTML/テキスト>   アップロードをテキスト化
//
// 出典は自動で埋める:
//   URL の場合   … source_url = そのURL、名称 = <title> / PDF冒頭行
//   ファイルの場合 … 名称 = ファイル名（URL は無いので名称が出典になる）

import { NextResponse } from 'next/server';
import { fetchCompanyByUid } from '@/lib/nocodb/companies';
import { getAnthropicClient, getAnthropicModel } from '@/lib/anthropic/client';
import {
  extractTextFromUrl, extractTextFromFile, FetchBlockedError, type ExtractedDocument,
} from '@/lib/company/document-text';
import { searchWeb } from '@/lib/anthropic/web-search';
import {
  EXTERNAL_INTEL_SYSTEM_PROMPT,
  EXTERNAL_INTEL_TOOL,
  buildExternalIntelUserPrompt,
  type ExternalIntelExtractResult,
} from '@/lib/prompts/external-intel-extract';
import {
  EXTERNAL_SIGNAL_META,
  type ExternalSignalId,
  type IntelSource,
} from '@/lib/company/external-signal';

export const maxDuration = 120;

/** アップロード上限（バイト） */
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export interface IngestResponse {
  companyUid:  string;
  companyName: string;
  /** 取り込んだ資料の情報（UI に出して何を読んだか分かるようにする） */
  document: {
    kind:      ExtractedDocument['kind'];
    title:     string | null;
    sourceUrl: string | null;
    chars:     number;
    truncated: boolean;
  };
  /** シグナル候補。**保存されていない** */
  findings: Array<{
    signalId:   ExternalSignalId;
    headline:   string;
    excerpt:    string;
    occurredAt: string | null;
    confidence: number;
    sourceUrl:  string | null;
    sourceRef:  string | null;
    source:     IntelSource;
  }>;
  note: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }

  const company = await fetchCompanyByUid(companyUid).catch(() => null);
  if (!company) {
    return NextResponse.json({ error: `企業が見つかりません: ${companyUid}` }, { status: 404 });
  }

  // ── 入力の取り込み ──────────────────────────────────────────────────────
  const contentType = (req.headers.get('content-type') ?? '').toLowerCase();
  let doc: ExtractedDocument;
  let sourceUrl: string | null = null;
  let hintedSource: IntelSource | null = null;

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'ファイルが指定されていません' }, { status: 400 });
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: `ファイルが大きすぎます（上限 ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB）` },
          { status: 413 },
        );
      }
      const s = form.get('source');
      if (typeof s === 'string' && s) hintedSource = s as IntelSource;
      doc = await extractTextFromFile(file);
    } else {
      const body = await req.json().catch(() => ({})) as { url?: string; source?: IntelSource };
      const url = (body.url ?? '').trim();
      if (!url) {
        return NextResponse.json({ error: 'url が空です' }, { status: 400 });
      }
      if (!/^https?:\/\//i.test(url)) {
        return NextResponse.json({ error: 'URL は http:// または https:// で始めてください' }, { status: 400 });
      }
      hintedSource = body.source ?? null;
      sourceUrl = url;
      try {
        doc = await extractTextFromUrl(url);
      } catch (e) {
        // 大手企業サイトは CDN の Bot 対策で直接取得を拒否することがある。
        // その場合は Web 検索経由での取得に切り替える（検索エンジンはクロールできている）。
        if (e instanceof FetchBlockedError && e.isBlocked) {
          doc = await fetchViaWebSearch(url);
        } else {
          throw e;
        }
      }
    }
  } catch (e) {
    return NextResponse.json(
      { error: `資料の読み込みに失敗しました: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  if (doc.text.trim().length < 40) {
    return NextResponse.json({
      error: 'テキストをほとんど取り出せませんでした。画像だけのPDFや、JavaScript で描画されるページの可能性があります。本文をコピーして貼り付けてください。',
    }, { status: 422 });
  }

  const sourceLabel = doc.title ?? sourceUrl ?? '取り込んだ資料';

  // ── 構造化 ──────────────────────────────────────────────────────────────
  let result: ExternalIntelExtractResult;
  try {
    const client = getAnthropicClient();
    const completion = await client.chat.completions.create({
      model: getAnthropicModel(),
      max_tokens: 4096,
      tools: [EXTERNAL_INTEL_TOOL],
      tool_choice: { type: 'function', function: { name: 'extract_external_intel' } },
      messages: [
        { role: 'system', content: EXTERNAL_INTEL_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildExternalIntelUserPrompt({
            companyName: company.name,
            sourceLabel,
            text: doc.text,
          }),
        },
      ],
    });

    const toolCall = completion.choices[0]?.message.tool_calls?.[0];
    if (!toolCall || toolCall.type !== 'function') {
      throw new Error('構造化のツール呼び出しが返りませんでした');
    }
    result = JSON.parse(toolCall.function.arguments) as ExternalIntelExtractResult;
  } catch (e) {
    return NextResponse.json(
      { error: `資料の構造化に失敗しました: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  const findings: IngestResponse['findings'] = [];
  for (const it of result.items ?? []) {
    const signalId = it.signal_id as ExternalSignalId;
    if (!EXTERNAL_SIGNAL_META[signalId]) continue;
    findings.push({
      signalId,
      headline:   it.headline,
      excerpt:    it.excerpt,
      occurredAt: it.occurred_at,
      confidence: it.confidence,
      sourceUrl,
      sourceRef:  sourceLabel,
      source:     hintedSource ?? guessSource(sourceUrl ?? '', doc.kind, signalId),
    });
  }

  const response: IngestResponse = {
    companyUid,
    companyName: company.name,
    document: {
      kind:      doc.kind,
      title:     doc.title,
      sourceUrl,
      chars:     doc.text.length,
      truncated: doc.truncated,
    },
    findings,
    note: result.note ?? '',
  };

  return NextResponse.json(response);
}

// ── ヘルパー ──────────────────────────────────────────────────────────────────

/**
 * 直接取得できない URL を、Web 検索経由で読む。
 * 検索エンジンはクロール済みなので、Bot 対策で 403 を返すサイトでも本文が得られる。
 */
async function fetchViaWebSearch(url: string): Promise<ExtractedDocument> {
  const search = await searchWeb({
    systemPrompt: '与えられた URL のページ内容を確認し、要点を日本語で簡潔にまとめてください。ページに書かれていないことは書かないでください。',
    userPrompt:   `次のページの内容を教えてください: ${url}`,
    maxResults:   3,
    maxTokens:    600,
  });

  // 同一URLの引用を優先し、無ければ最初の引用を使う
  const cite = search.citations.find(c => sameUrl(c.url, url)) ?? search.citations[0];
  if (!cite || cite.content.trim().length < 40) {
    throw new Error(
      'このサイトは自動取得を拒否しており、検索経由でも本文を取得できませんでした。' +
      'ページの本文をコピーして「テキストを貼る」から登録してください。',
    );
  }

  return {
    text:      cite.content,
    title:     cite.title || null,
    kind:      'html',
    bytes:     null,
    truncated: false,
  };
}

function sameUrl(a: string, b: string): boolean {
  const norm = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
  return norm(a) === norm(b);
}

function guessSource(url: string, kind: ExtractedDocument['kind'], signalId: ExternalSignalId): IntelSource {
  const u = url.toLowerCase();
  if (/recruit|career|saiyo|hrmos|job|herp|wantedly/.test(u)) return 'hiring';
  if (/\/ir|irbank|edinet|kessan|investor|jpx\.co\.jp/.test(u)) return 'ir';
  if (/news|press|release/.test(u))                            return 'press';
  if (signalId === 'X8_Org_HiringSurge')                       return 'hiring';
  if (signalId === 'X5_Mkt_DXInvestment')                      return 'ir';
  if (kind === 'pdf')                                          return 'ir';
  return 'news';
}
