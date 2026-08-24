// ─── /api/company/[companyUid]/external-intel ─────────────────────────────────
//
// 外部WHO情報（「今提案する理由」）の取得と登録。
// 設計根拠: docs-src/cxm_v2/17_WHO_WHAT_Matching_Plan.md §11
//
// GET  … 保存済み外部シグナル + 議事録から抽出した候補を統合して返す
//        `hasOpportunity` が readiness の opportunity 入力になる
//
// POST … 2つのモードがある
//        (a) 貼り付けテキストの構造化: { text, sourceLabel, source, sourceUrl?, dryRun? }
//            dryRun=true なら抽出結果を返すだけで保存しない
//        (b) 承認済み候補の保存:       { items: [...] }
//            /external-intel/research が返した候補のうち、
//            **担当者が選択したものだけ**を保存する（human in the loop）
//
// 2層構成:
//   第1層 … 議事録のキーワード抽出（追加コストゼロ・confidence 0.35・保存しない）
//   第2層 … 手動登録した外部情報を LLM 構造化して保存（confidence 高・出典URL付き）
//
// テーブル未作成でも第1層だけで動く（graceful degradation）。

import { NextResponse } from 'next/server';
import { fetchCompanyByUid } from '@/lib/nocodb/companies';
import { fetchNotionMinutes } from '@/lib/nocodb/communication-logs';
import { fetchExternalIntel, createExternalIntel } from '@/lib/nocodb/external-intel';
import { getAnthropicClient, getAnthropicModel } from '@/lib/anthropic/client';
import {
  buildExternalOpportunity,
  extractExternalSignalsFromMinutes,
  EXTERNAL_SIGNAL_META,
  type ExternalOpportunityVM,
  type ExternalSignalItem,
  type ExternalSignalId,
  type IntelSource,
} from '@/lib/company/external-signal';
import {
  EXTERNAL_INTEL_SYSTEM_PROMPT,
  EXTERNAL_INTEL_TOOL,
  buildExternalIntelUserPrompt,
  type ExternalIntelExtractResult,
} from '@/lib/prompts/external-intel-extract';

export const maxDuration = 60;

/** 議事録の読み込み件数（本文まで読むため多すぎない範囲で） */
const MINUTES_LIMIT = 40;
/** LLM に渡すテキストの上限文字数 */
const MAX_INPUT_CHARS = 20_000;

// ── レスポンス型 ──────────────────────────────────────────────────────────────

export interface ExternalIntelResponse {
  companyUid:  string;
  companyName: string;
  opportunity: ExternalOpportunityVM;
  /** 保存済み（第2層）の件数 */
  storedCount:  number;
  /** 議事録から抽出した候補（第1層）の件数 */
  derivedCount: number;
  /** company_external_intel テーブルが未設定か */
  storeUnavailable: boolean;
  /** シグナル定義（UI のラベル表示用） */
  signalMeta: typeof EXTERNAL_SIGNAL_META;
}

export interface ExternalIntelPostResponse {
  extracted: Array<{
    signalId:   ExternalSignalId;
    headline:   string;
    excerpt:    string;
    occurredAt: string | null;
    confidence: number;
    saved:      boolean;
    saveError?: string;
  }>;
  note:    string;
  dryRun:  boolean;
  storeUnavailable: boolean;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }

  const [company, stored, minutes] = await Promise.all([
    fetchCompanyByUid(companyUid).catch(() => null),
    fetchExternalIntel(companyUid).catch(() => [] as ExternalSignalItem[]),
    fetchNotionMinutes(companyUid, MINUTES_LIMIT).catch(() => []),
  ]);

  if (!company) {
    return NextResponse.json({ error: `企業が見つかりません: ${companyUid}` }, { status: 404 });
  }

  // 第1層: 議事録からのキーワード抽出（保存しない・毎回導出する）
  const derived = extractExternalSignalsFromMinutes(minutes);

  const body: ExternalIntelResponse = {
    companyUid,
    companyName: company.name,
    opportunity: buildExternalOpportunity([...stored, ...derived]),
    storedCount:  stored.length,
    derivedCount: derived.length,
    storeUnavailable: !process.env.NOCODB_EXTERNAL_INTEL_TABLE_ID,
    signalMeta: EXTERNAL_SIGNAL_META,
  };

  return NextResponse.json(body);
}

// ── POST ──────────────────────────────────────────────────────────────────────

interface PostBody {
  text?:        string;
  sourceLabel?: string;
  source?:      IntelSource;
  sourceUrl?:   string;
  dryRun?:      boolean;
  createdBy?:   string;
  /** 承認済み候補の直接保存（research の結果から担当者が選んだもの） */
  items?: Array<{
    signalId:   string;
    headline:   string;
    excerpt:    string;
    occurredAt: string | null;
    confidence: number;
    sourceUrl:  string | null;
    sourceRef:  string | null;
    source:     IntelSource;
  }>;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({})) as PostBody;

  // ── (b) 承認済み候補の保存 ──────────────────────────────────────────────
  // research が返した候補のうち、担当者が選んだものだけを保存する。
  // AI は提案までで、採否は人が決める（human in the loop）。
  if (Array.isArray(body.items) && body.items.length > 0) {
    return saveApprovedItems(companyUid, body.items, body.createdBy ?? null);
  }

  const text = (body.text ?? '').trim();
  if (!text) {
    return NextResponse.json({ error: 'text または items が必要です' }, { status: 400 });
  }

  const source     = body.source ?? 'manual';
  const sourceUrl  = body.sourceUrl?.trim() || null;
  const sourceLabel = body.sourceLabel?.trim() || sourceUrl || '手入力';
  const dryRun     = body.dryRun === true;

  // 出典を必須にする（§11 の原則: 出典を出せない情報は採用しない）
  if (!sourceUrl && !body.sourceLabel?.trim()) {
    return NextResponse.json(
      { error: '出典（sourceUrl または sourceLabel）が必要です。出典のない外部情報は登録できません。' },
      { status: 400 },
    );
  }

  const company = await fetchCompanyByUid(companyUid).catch(() => null);
  if (!company) {
    return NextResponse.json({ error: `企業が見つかりません: ${companyUid}` }, { status: 404 });
  }

  // ── LLM で構造化 ────────────────────────────────────────────────────────
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
            text: text.slice(0, MAX_INPUT_CHARS),
          }),
        },
      ],
    });

    const toolCall = completion.choices[0]?.message.tool_calls?.[0];
    if (!toolCall || toolCall.type !== 'function') {
      throw new Error('LLM がツール呼び出しを返しませんでした');
    }
    result = JSON.parse(toolCall.function.arguments) as ExternalIntelExtractResult;
  } catch (e) {
    return NextResponse.json(
      { error: `外部情報の構造化に失敗しました: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  const items = Array.isArray(result.items) ? result.items : [];

  // ── 保存 ────────────────────────────────────────────────────────────────
  const storeUnavailable = !process.env.NOCODB_EXTERNAL_INTEL_TABLE_ID;
  const extracted: ExternalIntelPostResponse['extracted'] = [];

  for (const it of items) {
    const signalId = it.signal_id as ExternalSignalId;
    if (!EXTERNAL_SIGNAL_META[signalId]) continue;  // 未知の signal_id は捨てる

    let saved = false;
    let saveError: string | undefined;

    if (!dryRun && !storeUnavailable) {
      const res = await createExternalIntel({
        companyUid,
        signalId,
        headline:   it.headline,
        excerpt:    it.excerpt,
        source,
        sourceUrl,
        sourceRef:  sourceLabel,
        occurredAt: it.occurred_at,
        confidence: it.confidence,
        createdBy:  body.createdBy ?? null,
      });
      saved = res.ok;
      if (!res.ok) saveError = res.error;
    }

    extracted.push({
      signalId,
      headline:   it.headline,
      excerpt:    it.excerpt,
      occurredAt: it.occurred_at,
      confidence: it.confidence,
      saved,
      saveError,
    });
  }

  const response: ExternalIntelPostResponse = {
    extracted,
    note:   result.note ?? '',
    dryRun,
    storeUnavailable,
  };

  return NextResponse.json(response);
}

// ── 承認済み候補の保存 ────────────────────────────────────────────────────────

async function saveApprovedItems(
  companyUid: string,
  items: NonNullable<PostBody['items']>,
  createdBy: string | null,
) {
  const storeUnavailable = !process.env.NOCODB_EXTERNAL_INTEL_TABLE_ID;
  const extracted: ExternalIntelPostResponse['extracted'] = [];

  for (const it of items) {
    const signalId = it.signalId as ExternalSignalId;
    if (!EXTERNAL_SIGNAL_META[signalId]) continue;

    // 出典がないものは保存しない（§11 の原則）
    if (!it.sourceUrl && !it.sourceRef) {
      extracted.push({
        signalId, headline: it.headline, excerpt: it.excerpt,
        occurredAt: it.occurredAt, confidence: it.confidence,
        saved: false, saveError: '出典がないため保存できません',
      });
      continue;
    }

    let saved = false;
    let saveError: string | undefined;

    if (!storeUnavailable) {
      const res = await createExternalIntel({
        companyUid,
        signalId,
        headline:   it.headline,
        excerpt:    it.excerpt,
        source:     it.source,
        sourceUrl:  it.sourceUrl,
        sourceRef:  it.sourceRef,
        occurredAt: it.occurredAt,
        confidence: it.confidence,
        createdBy,
      });
      saved = res.ok;
      if (!res.ok) saveError = res.error;
    }

    extracted.push({
      signalId, headline: it.headline, excerpt: it.excerpt,
      occurredAt: it.occurredAt, confidence: it.confidence,
      saved, saveError,
    });
  }

  const response: ExternalIntelPostResponse = {
    extracted, note: '', dryRun: false, storeUnavailable,
  };
  return NextResponse.json(response);
}
