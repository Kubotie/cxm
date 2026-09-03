// ─── /api/company/[companyUid]/situations ─────────────────────────────────────
//
// GET  … 議事録から「相手の状況」の**候補**を抽出する（登録はしない）
// POST … 担当者が確認した候補を company_situations に登録する
//
// A（状況カタログ）のうち **検出 = 手動（診断・登録）** の語彙は、
// 誰かが登録しない限り一件も立たない。だが実際には議事録に書かれている。
//
// ⚠️ **自動登録しない。** 議事録948件の横断実測（2026-08-24）で、
//   「担当が変わると知見が引き継がれない」は84件・51社で出現するが、
//   その大半が **Ptmind 側の説明文**（「他のお客様からも伺う声」という枕）だった。
//   自社のトークを顧客の状況として登録すると、提案が
//   「相手が言っていないこと」を根拠にし始める。
//   LLM に発言者を判定させたうえで、**最終的な採用は人が押す**。

import { NextRequest, NextResponse } from 'next/server';
import { fetchCompanyByUid } from '@/lib/nocodb/companies';
import { fetchNotionMinutes } from '@/lib/nocodb/communication-logs';
import {
  fetchCompanySituations, createCompanySituation,
} from '@/lib/nocodb/company-situations';
import { fetchWhatCatalog, EMPTY_CATALOG } from '@/lib/notion/what-catalog';
import { getAnthropicClient, getAnthropicModel } from '@/lib/anthropic/client';
import {
  SITUATION_EXTRACT_TOOL, SITUATION_EXTRACT_SYSTEM_PROMPT, buildSituationExtractPrompt,
  type SituationExtractResult,
} from '@/lib/prompts/situation-extract';
import { getCurrentUserProfile } from '@/lib/auth/session';

export const maxDuration = 120;

/** 読む議事録の件数。増やすほど精度は上がるがトークンが増える */
const MINUTES_LIMIT = 8;
/** 議事録1件あたりの本文上限 */
const BODY_CHARS = 3_000;
/**
 * これ未満の確信度は候補にも出さない。
 * 0.3 で試したところ、「JavaScriptの実装が可能」を
 * `LP_NoCodeSkill_InHouse`（直せる人が一人しかいない）に当てるような
 * **逆向きの誤検知**が混ざった（2026-08-24 実測）。文脈から読める水準に上げる。
 */
const MIN_CONFIDENCE = 0.6;

export interface SituationCandidate {
  situationId: string;
  labelJa:     string;
  meaning:     string;
  quote:       string;
  speaker:     string;
  observedAt:  string | null;
  confidence:  number;
  /** すでに登録済みか */
  alreadyRegistered: boolean;
}

export interface SituationCandidatesResponse {
  companyUid:  string;
  companyName: string;
  candidates:  SituationCandidate[];
  /** 登録済みの状況（候補と重複するものを画面で分けるため） */
  registered:  Array<{ situationId: string; labelJa: string; note: string; observedAt: string | null }>;
  /**
   * 自社（Ptmind）の発言として除外した件数。
   * **これを出さないと「候補が少ない」理由が分からない。**
   */
  droppedAsOurTalk: number;
  minutesRead: number;
  note:        string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }

  const [company, minutes, catalog, registered] = await Promise.all([
    fetchCompanyByUid(companyUid).catch(() => null),
    fetchNotionMinutes(companyUid, MINUTES_LIMIT).catch(() => []),
    fetchWhatCatalog().catch(() => EMPTY_CATALOG),
    fetchCompanySituations(companyUid).catch(() => []),
  ]);

  if (!company) {
    return NextResponse.json({ error: `企業が見つかりません: ${companyUid}` }, { status: 404 });
  }

  // 抽出対象は「手動（診断・登録）」の語彙だけ。
  // 自動検出される状況を LLM に読ませても、コード側の判定と二重になるだけ。
  const manual = catalog.situations.filter(s => (s.detection ?? '').startsWith('手動'));
  const labelById = new Map(manual.map(s => [s.id, s]));

  const withBody = minutes.filter(m => (m.body ?? '').trim().length > 0);
  if (manual.length === 0 || withBody.length === 0) {
    return NextResponse.json({
      companyUid, companyName: company.name,
      candidates: [], registered: registered.map(toRegistered(catalog)),
      droppedAsOurTalk: 0, minutesRead: 0,
      note: manual.length === 0
        ? 'Notion A に「手動（診断・登録）」の状況がありません'
        : '本文のある議事録がありません',
    } satisfies SituationCandidatesResponse);
  }

  let result: SituationExtractResult;
  try {
    const client = getAnthropicClient();
    const completion = await client.chat.completions.create({
      model: getAnthropicModel(),
      max_tokens: 4000,
      tools: [SITUATION_EXTRACT_TOOL],
      tool_choice: { type: 'function', function: { name: 'extract_situations' } },
      messages: [
        { role: 'system', content: SITUATION_EXTRACT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildSituationExtractPrompt({
            companyName: company.name,
            situations: manual.map(s => ({ id: s.id, labelJa: s.labelJa || s.id, meaning: s.meaning })),
            minutes: withBody.map(m => ({
              title: m.title ?? '',
              date:  m.meetingDate ?? null,
              body:  (m.body ?? '').slice(0, BODY_CHARS),
            })),
          }),
        },
      ],
    });
    const call = completion.choices[0]?.message.tool_calls?.[0];
    if (!call || call.type !== 'function') throw new Error('ツール呼び出しが返りませんでした');
    result = JSON.parse(call.function.arguments) as SituationExtractResult;
  } catch (e) {
    return NextResponse.json(
      { error: `状況の抽出に失敗しました: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  const registeredIds = new Set(registered.map(r => r.situationId));
  const items = result.items ?? [];

  // **自社の発言として判定されたものはここで落とす。**
  const ourTalk = items.filter(i => !i.by_customer);

  const candidates: SituationCandidate[] = items
    .filter(i => i.by_customer)
    .filter(i => i.confidence >= MIN_CONFIDENCE)
    .filter(i => labelById.has(i.situation_id))   // カタログに無いIDは捨てる
    .map(i => {
      const s = labelById.get(i.situation_id)!;
      return {
        situationId: i.situation_id,
        labelJa: s.labelJa || i.situation_id,
        meaning: s.meaning,
        quote:   i.quote,
        speaker: i.speaker,
        observedAt: i.observed_at?.trim() ? i.observed_at : null,
        confidence: i.confidence,
        alreadyRegistered: registeredIds.has(i.situation_id),
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  return NextResponse.json({
    companyUid,
    companyName: company.name,
    candidates,
    registered: registered.map(toRegistered(catalog)),
    droppedAsOurTalk: ourTalk.length,
    minutesRead: withBody.length,
    note: result.note ?? '',
  } satisfies SituationCandidatesResponse);
}

/** 候補を採用して登録する */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  const body = await req.json().catch(() => ({})) as {
    situationId?: string; note?: string; observedAt?: string | null;
  };
  if (!companyUid || !body.situationId) {
    return NextResponse.json({ error: 'companyUid と situationId は必須です' }, { status: 400 });
  }

  const profile = await getCurrentUserProfile().catch(() => null);
  const res = await createCompanySituation({
    companyUid,
    situationId: body.situationId,
    source:      '議事録からの抽出（担当者が確認）',
    note:        body.note ?? '',
    observedAt:  body.observedAt ?? null,
    createdBy:   profile?.name2 ?? null,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error ?? '登録に失敗しました' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

function toRegistered(catalog: { situations: Array<{ id: string; labelJa: string }> }) {
  const byId = new Map(catalog.situations.map(s => [s.id, s.labelJa]));
  return (r: { situationId: string; note: string; observedAt: string | null }) => ({
    situationId: r.situationId,
    labelJa: byId.get(r.situationId) || r.situationId,
    note: r.note,
    observedAt: r.observedAt,
  });
}
