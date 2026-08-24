// ─── POST /api/company/[companyUid]/external-intel/research ───────────────────
//
// 自然言語の指示で外部情報を調べ、シグナル候補を返す。**保存はしない**。
//
// 設計根拠: docs-src/cxm_v2/17_WHO_WHAT_Matching_Plan.md §11
//
// human in the loop:
//   AI は「提案」までを担い、採否は人が決める。
//   このエンドポイントは候補を返すだけで、保存は担当者が選択したものだけを
//   /api/company/[companyUid]/external-intel (POST, items 指定) で行う。
//
// 2段階で処理する:
//   段階1 … Web 検索（OpenRouter web プラグイン）。応答と **出典URL＋ページ本文** を得る
//   段階2 … 段階1で得た本文を構造化して signal_id に変換する
//
// なぜ分けるか: 検索と構造化を1回のツール呼び出しで同時にやらせると、
// 検索結果を読んだうえで空配列を返すことが多く不安定だった（実測）。
// また段階2の入力を「検索で得たページ本文」に限定することで、
// excerpt が必ず原文からの引用になり、モデルの作文を防げる。

import { NextResponse } from 'next/server';
import { fetchCompanyByUid } from '@/lib/nocodb/companies';
import { searchWeb } from '@/lib/anthropic/web-search';
import { getAnthropicClient, getAnthropicModel } from '@/lib/anthropic/client';
import {
  EXTERNAL_INTEL_SYSTEM_PROMPT,
  EXTERNAL_INTEL_TOOL,
  type ExternalIntelExtractResult,
} from '@/lib/prompts/external-intel-extract';
import {
  EXTERNAL_SIGNAL_META,
  type ExternalSignalId,
  type IntelSource,
} from '@/lib/company/external-signal';

export const maxDuration = 120;

/** 検索結果の取り込み件数 */
const MAX_SEARCH_RESULTS = 6;
/** 構造化に渡す本文の上限（出典1件あたり） */
const MAX_CONTENT_PER_SOURCE = 4_000;
/** 構造化に渡す本文の総上限 */
const MAX_TOTAL_CONTENT = 24_000;

// ── 型 ────────────────────────────────────────────────────────────────────────

export interface ResearchFinding {
  signalId:   ExternalSignalId;
  headline:   string;
  excerpt:    string;
  occurredAt: string | null;
  confidence: number;
  /** 出典URL。どの検索結果に由来するかを excerpt の一致で推定する */
  sourceUrl:  string | null;
  sourceRef:  string | null;
  /** 推奨する情報源種別（先行性の評価に使う） */
  source:     IntelSource;
}

export interface ResearchResponse {
  companyUid:  string;
  companyName: string;
  /** 実行した指示（そのまま返す） */
  instruction: string;
  /** モデルの調査サマリー（人が読んで判断するため） */
  summary:     string;
  /** シグナル候補。**保存されていない**。人が選んで登録する */
  findings:    ResearchFinding[];
  /** 参照した出典 */
  sources:     Array<{ url: string; title: string }>;
  /** 概算コスト（USD） */
  costUsd:     number | null;
  note:        string;
}

// ── プロンプト ────────────────────────────────────────────────────────────────

const RESEARCH_SYSTEM_PROMPT = `あなたは BtoB SaaS のカスタマーサクセス担当を支援するアナリストです。
担当者の指示に従い、対象企業について**公開されている一次情報**を Web 検索で調べます。

重視する情報（提案judgmentに直結する順）:
1. 求人情報 — 組織が動く前に出る最速の先行指標
2. 組織改編・人事異動のリリース
3. 中期経営計画・IR・決算説明資料（DX / AI への投資方針や予算）
4. プレスリリース（新サービス・新サイト・新体制）
5. 業界ニュース

厳守すること:
- **検索結果にない事実を書かない。** 推測や一般論で埋めない
- 日付を明示する。読み取れない場合は「日付不明」と書く
- 企業の沿革や製品一覧など、提案判断に関係しない一般情報は報告しない
- 該当する情報が見つからなければ「見つからなかった」と正直に書く

出力は日本語。事実と日付と出典を簡潔に列挙してください。`;

// ── 本体 ──────────────────────────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({})) as { instruction?: string };
  const instruction = (body.instruction ?? '').trim();
  if (!instruction) {
    return NextResponse.json({ error: '調べたい内容（instruction）が空です' }, { status: 400 });
  }

  const company = await fetchCompanyByUid(companyUid).catch(() => null);
  if (!company) {
    return NextResponse.json({ error: `企業が見つかりません: ${companyUid}` }, { status: 404 });
  }

  // ── 段階1: Web 検索 ─────────────────────────────────────────────────────
  let search;
  try {
    search = await searchWeb({
      systemPrompt: RESEARCH_SYSTEM_PROMPT,
      userPrompt:
        `## 対象企業\n${company.name}\n\n` +
        `## 担当者からの指示\n${instruction}\n\n` +
        `上記について調べ、事実・日付・出典を挙げてください。`,
      maxResults: MAX_SEARCH_RESULTS,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Web 検索に失敗しました: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  if (search.citations.length === 0) {
    const empty: ResearchResponse = {
      companyUid, companyName: company.name, instruction,
      summary: search.text, findings: [], sources: [],
      costUsd: search.costUsd,
      note: '検索結果が得られませんでした。指示を具体的にするか、企業名の表記を変えて再実行してください。',
    };
    return NextResponse.json(empty);
  }

  // ── 段階2: 検索で得た本文を構造化 ───────────────────────────────────────
  // 入力を「検索結果の本文」に限定することで、excerpt が原文引用になる
  let structured: ExternalIntelExtractResult;
  try {
    const client = getAnthropicClient();
    const corpus = buildCorpus(search.citations);

    const completion = await client.chat.completions.create({
      model: getAnthropicModel(),
      max_tokens: 4096,
      tools: [EXTERNAL_INTEL_TOOL],
      tool_choice: { type: 'function', function: { name: 'extract_external_intel' } },
      messages: [
        { role: 'system', content: EXTERNAL_INTEL_SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            `## 対象企業\n${company.name}\n\n` +
            `## 担当者の関心\n${instruction}\n\n` +
            `## 検索で得られた本文（この範囲からのみ抽出すること）\n${corpus}`,
        },
      ],
    });

    const toolCall = completion.choices[0]?.message.tool_calls?.[0];
    if (!toolCall || toolCall.type !== 'function') {
      throw new Error('構造化のツール呼び出しが返りませんでした');
    }
    structured = JSON.parse(toolCall.function.arguments) as ExternalIntelExtractResult;
  } catch (e) {
    return NextResponse.json(
      { error: `検索結果の構造化に失敗しました: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  // ── 出典の紐付け ────────────────────────────────────────────────────────
  const findings: ResearchFinding[] = [];
  for (const it of structured.items ?? []) {
    const signalId = it.signal_id as ExternalSignalId;
    if (!EXTERNAL_SIGNAL_META[signalId]) continue;

    const cite = matchCitation(it.excerpt, search.citations);
    findings.push({
      signalId,
      headline:   it.headline,
      excerpt:    it.excerpt,
      occurredAt: it.occurred_at,
      confidence: it.confidence,
      sourceUrl:  cite?.url ?? null,
      sourceRef:  cite?.title ?? null,
      source:     guessSource(cite?.url ?? '', signalId),
    });
  }

  const response: ResearchResponse = {
    companyUid,
    companyName: company.name,
    instruction,
    summary:  search.text,
    findings,
    sources:  search.citations.map(c => ({ url: c.url, title: c.title })),
    costUsd:  search.costUsd,
    note:     structured.note ?? '',
  };

  return NextResponse.json(response);
}

// ── ヘルパー ──────────────────────────────────────────────────────────────────

/** 検索結果の本文を、出典URL付きで1つのテキストにまとめる */
function buildCorpus(citations: { url: string; title: string; content: string }[]): string {
  const parts: string[] = [];
  let total = 0;
  for (const c of citations) {
    const body = c.content.slice(0, MAX_CONTENT_PER_SOURCE);
    if (total + body.length > MAX_TOTAL_CONTENT) break;
    total += body.length;
    parts.push(`### 出典: ${c.title}\nURL: ${c.url}\n\n${body}`);
  }
  return parts.join('\n\n---\n\n');
}

/**
 * excerpt がどの出典に由来するかを推定する。
 *
 * 出典が付かないと保存対象から外れてしまうため、照合はやや緩めにする:
 *   1. 引用の先頭・中間・末尾から短い断片を取り、いずれかが本文に含まれるかを見る
 *   2. 空白と記号を除去して比較する（PDF由来のテキストは空白の入り方が不安定なため）
 * それでも見つからなければ null を返す（出典なし＝保存されない）。
 */
function matchCitation(
  excerpt: string,
  citations: { url: string; title: string; content: string }[],
): { url: string; title: string } | null {
  const normalize = (s: string) => s.replace(/[\s　、。，．・「」『』（）()]/g, '');
  const hay = citations.map(c => ({ c, norm: normalize(c.content) }));
  const src = normalize(excerpt);
  if (src.length < 8) return null;

  // 先頭 / 中間 / 末尾から断片を取る（長い順に試して誤マッチを避ける）
  const fragments: string[] = [];
  for (const len of [24, 14, 10]) {
    if (src.length < len) continue;
    fragments.push(src.slice(0, len));
    if (src.length > len * 2) fragments.push(src.slice(Math.floor((src.length - len) / 2), Math.floor((src.length - len) / 2) + len));
    fragments.push(src.slice(-len));
  }

  for (const frag of fragments) {
    for (const { c, norm } of hay) {
      if (norm.includes(frag)) return { url: c.url, title: c.title };
    }
  }
  return null;
}

/** URL とシグナル種別から情報源の種別を推定する（担当者が UI で変更できる） */
function guessSource(url: string, signalId: ExternalSignalId): IntelSource {
  const u = url.toLowerCase();
  if (/recruit|career|saiyo|hrmos|job|herp|wantedly/.test(u)) return 'hiring';
  if (/\/ir|irbank|edinet|kessan|investor/.test(u))           return 'ir';
  if (/news|press|release/.test(u))                            return 'press';
  if (signalId === 'X8_Org_HiringSurge')                       return 'hiring';
  if (signalId === 'X5_Mkt_DXInvestment')                      return 'ir';
  return 'news';
}
