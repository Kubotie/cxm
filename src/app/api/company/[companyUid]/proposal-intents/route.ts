// ─── GET /api/company/[companyUid]/proposal-intents ───────────────────────────
//
// 提案骨子フローの入口。**1回の呼び出しで「何をしたいか」のカードを返す。**
//
// 材料（コンテキスト）はここで自動収集する。担当者に先に選ばせない。
//   選択は骨子を作った**後**に、サイドカラムのカードで外していく形にする。
//   先に15枚のチェックボックスを見せると、何を選べばいいか判断できないため。
//
// カードの並びは決定的（LLMを使わない）:
//   一致した状況の数 × 打合せ設定率 → 特化度（効く状況が少ない方が上）→ 名前
//   ここで LLM を挟むと表示が20秒以上遅れる。おすすめ順は算出で出せる。
//
// 重い取得はここだけ（約5秒）。骨子生成は選ばれたカードと材料を受け取るので独立。

import { NextResponse } from 'next/server';
import { loadReadinessFacts } from '@/lib/company/readiness-facts';
import { fetchCompanySituations } from '@/lib/nocodb/company-situations';
import { fetchWhatCatalog, EMPTY_CATALOG, type WhatCatalog } from '@/lib/notion/what-catalog';
import { buildEvidenceGroups, situationIdsFromSelection, type EvidenceGroup } from '@/lib/company/proposal-inputs';
import { matchWhat, applyNamingRule, type WhatMatchResult } from '@/lib/company/what-matching';
import { proposalTypeFromKind, type ProposalType } from '@/lib/prompts/proposal-outline';

export const maxDuration = 60;

/**
 * カードの適合度。**一覧は絞り込まず、順位付けで示す。**
 * 状況が一致しないものを消してしまうと「今できること」の全体が見えず、
 * 担当者が自分の判断で選べなくなる。
 */
export type IntentFit =
  | 'recommended'  // 効く状況が一致している
  | 'possible'     // 一致する状況は無いが、妨げる状況も無い
  | 'not_advised'; // 逆効果になる状況が立っている

export interface ProposalIntent {
  /** カタログ上の名称（骨子生成で送り返す鍵） */
  name: string;
  /** 対外呼称を適用した表示名 */
  displayName: string;
  /** false = 呼称未確定。顧客向け文面に出せない */
  nameSafe: boolean;
  kind: string | null;
  /** FDE型 / 通常製品型。骨子の比重が変わる */
  proposalType: ProposalType;
  valueLine: string;
  expectedEffect: string;
  fit: IntentFit;
  /**
   * この狙いに関係する状況ID（効く・前提・逆効果の全部）。
   * **情報選択の関連度判定に使う。** 狙いを決めた後、どの材料がその狙いに
   * 関わるのかを機械的に出せないと、担当者が100件の議事録から選べない。
   */
  relatedSituations: string[];
  /** なぜこれが上位なのか（一致した状況の日本語名） */
  reasons: string[];
  /** not_advised の理由（逆効果になっている状況の日本語名） */
  cautions: string[];
  matchedSituations: string[];
  meetingRate: number | null;
  /** 組み合わせる補助WHAT（部品・証跡）の表示名 */
  supporting: string[];
  /** 当てるときに語り口として使えるフレーム名 */
  frameName: string | null;
}

export interface ProposalIntentsResponse {
  companyUid:  string;
  companyName: string;
  /** おすすめ順の「何をしたいか」カード */
  intents: ProposalIntent[];
  /**
   * 骨子のコンテキストになる材料。**種別ごとの群のまま返す。**
   * 狙いを決めた後に種別ごとに選ばせるため、群の見出しと説明が必要になる。
   */
  groups: EvidenceGroup[];
  /** 判定に使った状況ID */
  activeSignals: string[];
  situationLabels: Record<string, string>;
  /** 逆効果で外したもの。「なぜ出てこないか」の答え */
  excluded: WhatMatchResult['excluded'];
  /** 事例0件による状況の追加。適用しなかった場合も理由を返す */
  noMatchingCase: WhatMatchResult['noMatchingCase'];
  /** 評価できなかった状況と理由 */
  unevaluated: Array<{ id: string; reason: string }>;
  catalog: {
    unavailable: string | null;
    counts:      WhatCatalog['counts'];
    issues:      WhatCatalog['issues'];
    /** Notion から取得した時刻。**古さを画面に出すために必要** */
    fetchedAt:   string;
    /** true = この呼び出しで Notion を取り直した（キャッシュを使っていない） */
    refreshed:   boolean;
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }

  // Notion カタログは1時間キャッシュしている（レート制限が厳しいため）。
  // Notion 側を直したのに反映されない、を避けるために明示的な取り直しを用意する。
  const refresh = new URL(req.url).searchParams.get('refreshCatalog') === '1';

  const [facts, situations, catalog] = await Promise.all([
    loadReadinessFacts(companyUid),
    fetchCompanySituations(companyUid).catch(() => []),
    fetchWhatCatalog({ force: refresh }).catch(() => EMPTY_CATALOG),
  ]);

  if (!facts) {
    return NextResponse.json({ error: `企業が見つかりません: ${companyUid}` }, { status: 404 });
  }

  const logs = facts.raw.commLogs;
  const communications = [
    ...logs.notionMinutes.map(m => ({
      id: `minutes:${m.id}`, channel: '議事録',
      title: m.title ?? '', body: m.body ?? '', date: m.meetingDate ?? null,
    })),
    ...logs.chatwork.map(c => ({
      id: `chatwork:${c.id}`, channel: 'Chatwork',
      title: c.roomName ?? '', body: c.body ?? '', date: c.sentAt ?? null,
    })),
    ...logs.slack.map(s => ({
      id: `slack:${s.id}`, channel: 'Slack',
      title: s.channel ?? '', body: s.text ?? '', date: s.sentAt ?? null,
    })),
  ].filter(c => c.body.trim().length > 0);

  // 事例・施策は状況との交差で絞るため、先に状況IDを確定させる。
  // 材料そのものは状況IDを持たない（Proof / Approach の文章材料）ので、
  // 1周目の状況IDに影響しない。
  const baseGroups = buildEvidenceGroups({
    readiness:  facts.companyReadiness,
    play:       facts.companyPlay.play,
    playLabel:  facts.companyPlay.label,
    renewalBucket:   facts.renewalBucket,
    renewalDate:     facts.renewalDate,
    renewalDaysLeft: daysUntil(facts.renewalDate),
    behavior:   facts.behavior.detected,
    external:   facts.raw.storedIntel.filter(s => !s.dismissed).map((s, i) => ({
      id:        `${s.signalId}#${s.occurredAt ?? s.sourceRef ?? i}`,
      signalId:  s.signalId,
      title:     s.headline || s.signalId,
      summary:   [s.excerpt, `確度 ${Math.round(s.confidence * 100)}%`].filter(Boolean).join('\n'),
      sourceUrl: s.sourceUrl ?? null,
      asOf:      s.occurredAt ?? null,
    })),
    manualSituations: situations.map(s => ({
      situationId: s.situationId, note: s.note, source: s.source, observedAt: s.observedAt,
    })),
    usage: facts.raw.usageTotals,
    communications,
    profileSections: [],
  });

  // 状況IDは「WHATに効く材料」全部から作る。
  // 入口では絞らない（絞るのは骨子を作った後の再生成）。
  const baseIds = baseGroups.flatMap(g => g.items).map(i => i.id);
  const activeSignals = situationIdsFromSelection(baseGroups, baseIds);
  const match = matchWhat({ catalog, activeSignals });

  // 事例・施策を足して作り直す。**再判定後の状況IDを使う**
  // （INDUSTRY_NoMatchingCase が付いた場合、それに効く事例も拾いたい）。
  const groups = buildEvidenceGroups({
    readiness:  facts.companyReadiness,
    play:       facts.companyPlay.play,
    playLabel:  facts.companyPlay.label,
    renewalBucket:   facts.renewalBucket,
    renewalDate:     facts.renewalDate,
    renewalDaysLeft: daysUntil(facts.renewalDate),
    behavior:   facts.behavior.detected,
    external:   facts.raw.storedIntel.filter(s => !s.dismissed).map((s, i) => ({
      id:        `${s.signalId}#${s.occurredAt ?? s.sourceRef ?? i}`,
      signalId:  s.signalId,
      title:     s.headline || s.signalId,
      summary:   [s.excerpt, `確度 ${Math.round(s.confidence * 100)}%`].filter(Boolean).join('\n'),
      sourceUrl: s.sourceUrl ?? null,
      asOf:      s.occurredAt ?? null,
    })),
    manualSituations: situations.map(s => ({
      situationId: s.situationId, note: s.note, source: s.source, observedAt: s.observedAt,
    })),
    usage: facts.raw.usageTotals,
    communications,
    profileSections: [],
    cases:     catalog.cases,
    playbooks: catalog.playbooks,
    activeSignals: match.activeSignals,
  });

  // 補助WHATとフレームを主役に紐づける
  const supportingNames = match.supporting.map(s =>
    applyNamingRule({ name: s.name, namingRule: s.namingRule }).display);

  // ── カード = 利用可の主役WHAT **全件**。絞り込まず順位付けで示す ─────────
  // 一致したものだけを出すと「今できること」の全体が見えない。
  // 実測では厳格マッチで3件しか残らず、FDE・利用活性化・AI Ready が
  // 一覧から消えていた（効く状況が今回の状況と重ならないため）。
  const active = new Set(activeSignals);
  const matchedByName = new Map(match.primary.map(p => [p.name, p]));

  const intents: ProposalIntent[] = catalog.solutions
    .filter(s => s.role === '主役WHAT')
    .map(s => {
      const naming = applyNamingRule({ name: s.name, namingRule: s.namingRule });
      const hitEff  = s.effectiveFor.filter(id => active.has(id));
      const hitAnti = s.antiPatterns.filter(id => active.has(id));
      const matched = matchedByName.get(s.name) ?? null;
      const frame   = match.frames.find(f => f.targetWhat.includes(s.name)) ?? null;

      const fit: ProposalIntent['fit'] =
        hitAnti.length > 0 ? 'not_advised'
        : matched          ? 'recommended'
        : 'possible';

      return {
        name: s.name,
        displayName: naming.display,
        nameSafe: naming.safe,
        kind: s.kind,
        proposalType: proposalTypeFromKind(s.kind),
        valueLine: s.valueLine,
        expectedEffect: s.expectedEffect,
        fit,
        relatedSituations: [...new Set([...s.effectiveFor, ...s.prerequisites, ...s.antiPatterns])],
        reasons:  hitEff.map(id => labelOf(catalog, id)),
        cautions: hitAnti.map(id => labelOf(catalog, id)),
        matchedSituations: hitEff,
        meetingRate: matched?.meetingRate ?? null,
        supporting: s.mustPairWith.length > 0
          ? s.mustPairWith.map(n => applyNamingRule({
              name: n,
              namingRule: catalog.solutions.find(x => x.name === n)?.namingRule ?? '',
            }).display)
          : supportingNames,
        frameName: frame?.name ?? null,
        // 並べ替え用（レスポンスには出さない）
        _score: matched?.score ?? 0,
        _spec:  s.effectiveFor.length,
      };
    })
    // おすすめ順: 一致あり（スコア降順 → 特化度）→ 妨げなし → 逆効果あり
    .sort((a, b) => {
      const rank = (v: ProposalIntent['fit']) =>
        v === 'recommended' ? 0 : v === 'possible' ? 1 : 2;
      return rank(a.fit) - rank(b.fit)
        || b._score - a._score
        || a._spec - b._spec
        || a.name.localeCompare(b.name);
    })
    .map(({ _score, _spec, ...rest }) => rest);

  const body: ProposalIntentsResponse = {
    companyUid:  facts.companyUid,
    companyName: facts.companyName,
    intents,
    groups,
    activeSignals,
    situationLabels: Object.fromEntries(
      catalog.situations.filter(s => s.labelJa).map(s => [s.id, s.labelJa]),
    ),
    excluded: match.excluded,
    noMatchingCase: match.noMatchingCase,
    unevaluated: facts.behavior.missing,
    catalog: {
      unavailable: catalog.unavailable,
      counts:      catalog.counts,
      issues:      catalog.issues,
      fetchedAt:   catalog.fetchedAt,
      refreshed:   refresh,
    },
  };

  return NextResponse.json(body);
}

function labelOf(catalog: WhatCatalog, sid: string): string {
  return catalog.situations.find(s => s.id === sid)?.labelJa || sid;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const t = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`).getTime();
  if (Number.isNaN(t)) return null;
  const days = Math.ceil((t - Date.now()) / 86400000);
  return days >= 0 ? days : null;
}
