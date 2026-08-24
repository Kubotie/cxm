// ─── POST /api/company/[companyUid]/proposal-outline ──────────────────────────
//
// 選ばれた「狙い」と、チェックが入っているコンテキストから提案骨子を生成する。
//
// 章立ては固定（Context → Why Now → Goal → Gap → Approach → Solution
// → Proof → Execution → Decision）。案件で変わるのは各章の比重だけ。
//
// 守っていること:
//   1. **コンテキストはクライアントが送ったものだけ。** サーバーが勝手に足さない。
//      「このカードを外した」が結果に反映されないと、再生成が意味を持たない。
//   2. 提供物の詳細は Notion カタログ（正本）から引く。クライアントは名前だけ送る。
//   3. **顧客の事実を述べる章（Context / Why Now / Gap）は材料IDが無ければ印を付ける。**
//      検証できない記述をそのまま提案に載せさせない。
//   4. 選んでいない商材名・社内語の混入を機械検査する。

import { NextResponse } from 'next/server';
import { fetchWhatCatalog, EMPTY_CATALOG } from '@/lib/notion/what-catalog';
import { applyNamingRule } from '@/lib/company/what-matching';
import type { EvidenceItem } from '@/lib/company/proposal-inputs';
import { getAnthropicClient, getAnthropicModel } from '@/lib/anthropic/client';
import {
  PROPOSAL_OUTLINE_TOOL, OUTLINE_SYSTEM, buildOutlinePrompt,
  CHAPTERS, proposalTypeFromKind,
  type OutlineChapterKey, type ProposalType,
} from '@/lib/prompts/proposal-outline';

export const maxDuration = 180;

/**
 * 担当者の追記1件あたりの上限文字数。
 * 資料を丸ごと貼れる欄なので、切らないと出力が途中で壊れる。
 */
const CUSTOM_CONTEXT_MAX_CHARS = 8_000;

/**
 * 骨子の出力上限。
 * 9章＋Executive Summary をツール引数のJSONで返させるため、
 * 足りないと**途中で切れて JSON.parse が失敗する**。
 * 章ごとの長さはプロンプト側で絞ってあるので、通常はここまで使わない。
 */
const OUTLINE_MAX_TOKENS = 12_000;

/**
 * カタログに無い狙いを担当者が自分で立てる場合。
 * カタログ（Notion）が正本という原則は崩さないので、**保存も学習もしない**。
 * その場の骨子を書くためだけに使う。
 */
export interface CustomIntent {
  displayName:  string;
  valueLine:    string;
  proposalType: ProposalType;
}

export interface ProposalOutlineRequest {
  companyName: string;
  /** 選ばれた狙い（カタログの名称と完全一致）。カスタム時は表示名をそのまま入れる */
  intentName: string;
  /** カタログ外の狙い。指定時は intentName をカタログ照合しない */
  customIntent?: CustomIntent | null;
  /** チェックが入っているコンテキスト */
  context: EvidenceItem[];
  /** 担当者が追記したコンテキスト */
  customContext?: Array<{ title: string; detail: string }>;
  frameName?: string | null;
  instruction?: string | null;
}

export interface OutlineChapter {
  key:   OutlineChapterKey;
  no:    number;
  label: string;
  en:    string;
  text:  string;
  bullets: string[];
  /** 根拠にした材料（実体化して返す） */
  evidence: Array<{ id: string; title: string; confidence: string; asOf: string | null }>;
  /** 材料で裏付けられていない、この章の前提 */
  assumptions: string[];
  /** 顧客の事実を述べる章なのに材料が挙がっていない */
  unsourced: boolean;
}

export interface ProposalOutlineResponse {
  title: string;
  executiveSummary: {
    problem: string; goal: string; proposal: string; outcome: string; decision: string;
  };
  chapters: OutlineChapter[];
  avoid: Array<{ text: string; reason: string }>;
  missingEvidence: string[];
  intent: { name: string; displayName: string; nameSafe: boolean; kind: string | null; custom: boolean };
  proposalType: ProposalType;
  frame: string | null;
  /** 呼称・社内語・別商材の混入警告。空なら問題なし */
  warnings: string[];
  /** 生成に使ったコンテキストのID（何を使ったかを確定させる） */
  usedContextIds: string[];
  model: string;
}

/** 生成文に混入してはいけない社内呼称・旧称・ID */
const FORBIDDEN_IN_OUTPUT: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /Page\s*Studio/i,             label: 'Page Studio（旧称・使用禁止）' },
  { pattern: /AI\s*Insight\s*〈わかる〉/i,    label: 'AI Insight〈わかる〉（社内呼称）' },
  { pattern: /RD_[A-Za-z_]+/,              label: '状況ID（RD_*）' },
  { pattern: /PLAY_[A-Za-z_]+/,            label: '状況ID（PLAY_*）' },
  { pattern: /RENEWAL_[A-Za-z0-9_]+/,      label: '状況ID（RENEWAL_*）' },
  { pattern: /\b[ROHX]\d+_[A-Za-z_]+/,     label: '状況ID（R/O/H/X 系）' },
];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }

  let payload: ProposalOutlineRequest;
  try {
    payload = await req.json() as ProposalOutlineRequest;
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 });
  }

  if (!payload.intentName) {
    return NextResponse.json({ error: '狙いが選択されていません' }, { status: 400 });
  }

  // 担当者の追記を材料として合流させる（申告扱い）。
  // ⚠️ 長さを必ず切る。ここが無制限だと、資料を丸ごと貼られたときに
  //   モデルが入力の分量につられて長文を書き、出力が max_tokens で切れて
  //   ツール引数の JSON が壊れる（実測: "Expected ',' or '}' at position 5585"）。
  const trimmedCustom: string[] = [];
  const custom: EvidenceItem[] = (payload.customContext ?? [])
    .filter(c => c.detail?.trim())
    .map((c, i) => {
      const full = c.detail.trim();
      const title = c.title?.trim() || `担当者の追記 ${i + 1}`;
      if (full.length > CUSTOM_CONTEXT_MAX_CHARS) trimmedCustom.push(title);
      return {
      id: `custom:${i + 1}`,
      kind: 'manual' as const,
      title,
      detail: full.length > CUSTOM_CONTEXT_MAX_CHARS
        ? `${full.slice(0, CUSTOM_CONTEXT_MAX_CHARS)}\n…（長いため先頭${CUSTOM_CONTEXT_MAX_CHARS.toLocaleString()}文字のみ渡しています）`
        : full,
      situationIds: [],
      source: '担当者の追記',
      asOf: null,
      confidence: 'stated' as const,
      approximate: false,
      defaultSelected: true,
      };
    });
  const context = [...(payload.context ?? []), ...custom];

  // ── 提供物はカタログ（正本）から引く。カスタム時のみ担当者の記述を使う ──
  const catalog = await fetchWhatCatalog().catch(() => EMPTY_CATALOG);
  const customIntent = payload.customIntent ?? null;
  const entry = customIntent ? null : catalog.solutions.find(s => s.name === payload.intentName) ?? null;

  if (!customIntent && !entry) {
    return NextResponse.json(
      { error: `選択された狙いがカタログに見つかりません（カタログが更新された可能性があります）: ${payload.intentName}` },
      { status: 409 },
    );
  }
  if (customIntent && !customIntent.displayName?.trim()) {
    return NextResponse.json({ error: 'カスタムの狙いに名称がありません' }, { status: 400 });
  }

  const naming = entry
    ? applyNamingRule({ name: entry.name, namingRule: entry.namingRule })
    // カスタムは担当者が書いた表記をそのまま使う（呼称ルールの照合対象が無い）
    : { display: customIntent!.displayName.trim(), safe: true };
  const proposalType = entry ? proposalTypeFromKind(entry.kind) : customIntent!.proposalType;

  // カスタムでは「必ず組む相手」が無いので補助は付けない。
  // カタログ外の狙いに勝手に商材を足すと、担当者が意図しない提案になる。
  const supporting = entry
    ? (entry.mustPairWith.length > 0
        ? entry.mustPairWith
        : catalog.solutions.filter(s => s.role !== '主役WHAT').map(s => s.name))
        .map(n => catalog.solutions.find(s => s.name === n))
        .filter((s): s is NonNullable<typeof s> => Boolean(s))
        .slice(0, 4)
        .map(s => ({
          displayName: applyNamingRule({ name: s.name, namingRule: s.namingRule }).display,
          valueLine: s.valueLine,
        }))
    : [];

  const frame = payload.frameName
    ? catalog.frames.find(f => f.name === payload.frameName) ?? null
    : null;

  // ── 生成 ────────────────────────────────────────────────────────────────
  const model = getAnthropicModel();
  let args: {
    title?: string;
    executiveSummary?: ProposalOutlineResponse['executiveSummary'];
    chapters?: Array<{
      key: OutlineChapterKey; text: string; bullets: string[];
      evidenceIds: string[]; assumptions: string[];
    }>;
    avoid?: Array<{ text: string; reason: string }>;
    missingEvidence?: string[];
  } | null = null;

  try {
    const client = getAnthropicClient();
    const res = await client.chat.completions.create({
      model,
      max_tokens: OUTLINE_MAX_TOKENS,
      messages: [
        { role: 'system', content: OUTLINE_SYSTEM },
        { role: 'user', content: buildOutlinePrompt({
            companyName: payload.companyName || companyUid,
            intent: {
              name: entry?.name ?? naming.display,
              displayName: naming.display,
              kind: entry?.kind ?? '担当者が立てた狙い',
              valueLine: entry?.valueLine ?? customIntent!.valueLine,
              expectedEffect: entry?.expectedEffect ?? '',
              evidence: entry?.evidence ?? '',
              namingRule: entry?.namingRule ?? '',
              antiPatterns: entry?.antiPatterns ?? [],
              supporting,
            },
            proposalType,
            evidence: context,
            frame: frame
              ? { name: frame.name, reframe: frame.reframe, talkingPoints: frame.talkingPoints, avoidWhen: frame.avoidWhen }
              : null,
            instruction: payload.instruction ?? null,
          }) },
      ],
      tools: [PROPOSAL_OUTLINE_TOOL],
      tool_choice: { type: 'function', function: { name: 'write_proposal_outline' } },
    });

    const choice = res.choices[0];
    const call = choice?.message?.tool_calls?.[0];

    // **出力が上限で切れていないか先に見る。**
    // 切れたまま JSON.parse すると "Expected ',' or '}'" になり、
    // 原因が「材料が多すぎる」ことだと分からない。
    if (choice?.finish_reason === 'length') {
      console.warn('[proposal-outline] 出力が max_tokens で打ち切られました', {
        maxTokens: OUTLINE_MAX_TOKENS,
        contextCount: context.length,
        contextChars: context.reduce((n, c) => n + c.detail.length, 0),
      });
      return NextResponse.json({
        error:
          '骨子が長くなりすぎて途中で切れました。'
          + '参考にする情報を減らすか、長い追記を要点だけに絞って作り直してください。'
          + `（今回の材料: ${context.length}件 / ${context.reduce((n, c) => n + c.detail.length, 0).toLocaleString()}文字）`,
      }, { status: 502 });
    }

    if (!call || !('function' in call)) {
      return NextResponse.json({ error: '骨子の生成結果が空でした（ツールが呼ばれませんでした）' }, { status: 502 });
    }

    try {
      args = JSON.parse(call.function.arguments);
    } catch {
      console.warn('[proposal-outline] ツール引数のJSONを解釈できません',
        { length: call.function.arguments.length, tail: call.function.arguments.slice(-200) });
      return NextResponse.json({
        error:
          '骨子の生成結果を読み取れませんでした（出力が壊れています）。'
          + 'もう一度お試しください。繰り返す場合は参考にする情報を減らしてください。',
      }, { status: 502 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `骨子の生成に失敗しました: ${msg}` }, { status: 502 });
  }

  if (!args?.chapters) {
    return NextResponse.json({ error: '骨子の生成結果が空でした' }, { status: 502 });
  }

  // ── 整形・検査 ──────────────────────────────────────────────────────────
  const byId = new Map(context.map(e => [e.id, e]));

  const chapters: OutlineChapter[] = CHAPTERS.map(def => {
    const src = args!.chapters!.find(c => c.key === def.key);
    const ids = (src?.evidenceIds ?? []).filter(id => byId.has(id));
    return {
      key: def.key,
      no: def.no,
      label: def.label,
      en: def.en,
      text: src?.text ?? '',
      bullets: src?.bullets ?? [],
      evidence: ids.map(id => {
        const e = byId.get(id)!;
        return { id, title: e.title, confidence: e.confidence, asOf: e.asOf };
      }),
      assumptions: src?.assumptions ?? [],
      // 顧客の事実を述べる章だけを対象にする（Approach などはカタログ由来でよい）
      unsourced: def.requiresEvidence && Boolean(src?.text?.trim()) && ids.length === 0,
    };
  });

  const summary = args.executiveSummary ?? { problem: '', goal: '', proposal: '', outcome: '', decision: '' };
  const allText = [
    args.title ?? '',
    ...Object.values(summary),
    ...chapters.flatMap(c => [c.text, ...c.bullets]),
  ].join('\n');

  const warnings = FORBIDDEN_IN_OUTPUT
    .filter(f => f.pattern.test(allText))
    .map(f => `生成文に「${f.label}」が含まれています。修正してから使用してください。`);

  // **選んでいない商材名の混入検査。**
  // 「Ptengine Insight」と「インサイトApp（PGA）」のように名前が近い別商材があり、
  // モデルが対外呼称ルールを過剰適用して入れ替えた実例がある（2026-08-21）。
  const allowed = new Set([
    ...(entry ? [entry.name] : []),
    naming.display,
    ...supporting.map(s => s.displayName),
  ]);
  for (const s of catalog.solutions) {
    const d = applyNamingRule({ name: s.name, namingRule: s.namingRule }).display;
    for (const cand of [s.name, d]) {
      if (!cand || allowed.has(cand)) continue;
      const core = cand.split(/[（(]/)[0].trim();
      if (core.length < 4) continue;
      if (allText.includes(core)) {
        warnings.push(
          `選択していない提供物「${cand}」が骨子に含まれています。今回の狙いは「${naming.display}」です。`,
        );
        break;
      }
    }
  }

  // **ぼかし対象の事例の実社名が本文に出ていないか検査する。**
  // カード上は「アパレルのECサイト事例（社名非公開）」に置換しているが、
  // モデルが学習知識から社名を補ってしまう可能性がある。
  // 展開可否がぼかしの事例は社名を出せない約束なので、機械的に確かめる。
  for (const c of catalog.cases) {
    if (c.sharing !== 'ぼかしでOK') continue;
    const core = c.rawName.split(/[（(\s]/)[0].trim();
    if (core.length < 3) continue;
    if (allText.includes(core)) {
      warnings.push(
        `社名を出せない事例の名称「${core}」が骨子に含まれています。`
        + '展開可否が「ぼかしでOK」の事例なので、社名を伏せた表現に直してください。',
      );
    }
  }

  // 追記を切り詰めた場合は必ず知らせる（黙って一部だけ使わない）
  for (const t of trimmedCustom) {
    warnings.push(
      `追記「${t}」は長いため先頭${CUSTOM_CONTEXT_MAX_CHARS.toLocaleString()}文字だけを使いました。`
      + '重要な内容が後半にある場合は、要点に絞って入れ直してください。',
    );
  }

  const body: ProposalOutlineResponse = {
    title: args.title ?? '',
    executiveSummary: summary,
    chapters,
    avoid: args.avoid ?? [],
    missingEvidence: args.missingEvidence ?? [],
    intent: {
      name: entry?.name ?? naming.display,
      displayName: naming.display,
      nameSafe: naming.safe,
      kind: entry?.kind ?? null,
      /** true = カタログ外。担当者が立てた狙い */
      custom: !entry,
    },
    proposalType,
    frame: frame?.name ?? null,
    warnings,
    usedContextIds: context.map(c => c.id),
    model,
  };

  return NextResponse.json(body);
}
