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
import { fetchStoredIndustryIntel } from '@/lib/nocodb/industry-intel-cache';
import {
  fetchWhatCatalog, EMPTY_CATALOG,
  type WhatCatalog, type ProposalIntentEntry, type ContractPrecondition,
} from '@/lib/notion/what-catalog';
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

/**
 * 観測された状況が、**選んだ狙いにおいて**どういう意味を持つか。
 * 同じシグナルでも狙いによって反転する。
 * 例: `H1_Health_HighHabituation_60d`（習慣化）は
 *   Bundle化 → tailwind（定着しているから次を足せる）
 *   FDE伴走  → blocker（自走できているので伴走は要らないと返される）
 */
export type SignalRole = 'tailwind' | 'blocker' | 'prerequisite' | 'unrelated';

export interface IntentSignal {
  id:      string;
  labelJa: string;
  role:    SignalRole;
  /** prerequisite のとき、実際に立っているか */
  satisfied?: boolean;
}

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

  // ── B1（提案の狙い）由来 ──────────────────────────────────────────────
  /** 契約前提。画面で「この契約だから出ている / 出ていない」を説明する */
  contract: ContractPrecondition;
  /** 契約前提を満たしているか。false のものはそもそも返さない */
  contractOk: boolean;
  /** 骨子に要る材料。利用活性化以外はほぼ業界情報が要る */
  requiredInputs: string[];
  /** 誰に語るか。部長・決裁者なら機能でなく組織と事業の話にする */
  audiences: string[];
  /** 組織の何を変えるか（骨子の Goal / Gap の素材） */
  changeTarget: string;
  /** その変化が何につながるか（決裁者向けの芯） */
  businessImpact: string;
  /**
   * **観測された状況を、この狙いにおける役割で分類したもの。**
   * 画面はこれを「追い風 / 先に解消 / 無関係」に並べ替える。
   */
  signals: IntentSignal[];
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
  /** 契約プラン。狙いの絞り込みに使った値 */
  contractPlan: 'insight' | 'experience' | 'bundle' | null;
  /** 契約前提が合わないため出していない狙い。「なぜ出ないか」の答え */
  hiddenByContract: Array<{ name: string; contract: ContractPrecondition }>;
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

  const [facts, situations, catalog, industry] = await Promise.all([
    loadReadinessFacts(companyUid),
    fetchCompanySituations(companyUid).catch(() => []),
    fetchWhatCatalog({ force: refresh }).catch(() => EMPTY_CATALOG),
    // 業界名は週次バッチが保存済み。事例を業種で絞る第二の軸に使う
    fetchStoredIndustryIntel(companyUid).catch(() => ({ intel: null })),
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
    industryName: industry.intel?.industry ?? null,
  });

  // 補助WHATとフレームを主役に紐づける
  const supportingNames = match.supporting.map(s =>
    applyNamingRule({ name: s.name, namingRule: s.namingRule }).display);

  // ── カード = B1（提案の狙い）─────────────────────────────────────────
  //
  // **以前は B（提供できるもの）の主役WHAT をそのまま並べていた。**
  // その結果、Bundle 契約の顧客に「Ptengine Insight」「Ptengine Experience」を
  // "深化" として出していた（契約済みのものを提案していた）。
  // 狙いは「契約状態 × 前進の方向」で決まるので、B1 を正本にする。
  //
  // 契約前提を満たさない狙いは**返さない**。順位を下げるだけでは、
  // Bundle 契約の画面に「Bundle化」が残ってしまう。
  const active = new Set(activeSignals);
  const plan = facts.contractPlan;

  const usable = catalog.intents.filter(i => contractSatisfied(i.contract, plan));

  const intents: ProposalIntent[] = usable
    .map(i => {
      const hitEff  = i.effectiveFor.filter(id => active.has(id));
      const hitAnti = i.antiPatterns.filter(id => active.has(id));
      const missingPre = i.prerequisites.filter(id => !active.has(id));

      // 逆効果が立っていれば非推奨。前提が欠けていれば「条件付き」に落とす。
      const fit: ProposalIntent['fit'] =
        hitAnti.length > 0     ? 'not_advised'
        : missingPre.length > 0 ? 'possible'
        : hitEff.length > 0     ? 'recommended'
        : 'possible';

      // **観測された状況を、この狙いにおける役割で分類する。**
      // 同じシグナルが狙いによって追い風にも障害にもなる。
      const signals: IntentSignal[] = activeSignals.map(id => {
        const role: SignalRole =
          i.antiPatterns.includes(id)  ? 'blocker'
          : i.prerequisites.includes(id) ? 'prerequisite'
          : i.effectiveFor.includes(id)  ? 'tailwind'
          : 'unrelated';
        return {
          id, labelJa: labelOf(catalog, id), role,
          ...(role === 'prerequisite' ? { satisfied: true } : {}),
        };
      });
      // 立っていない前提条件も「まだ確認できていない」ものとして出す
      for (const id of missingPre) {
        signals.push({ id, labelJa: labelOf(catalog, id), role: 'prerequisite', satisfied: false });
      }

      const whatDisplays = i.whatNames.map(n => applyNamingRule({
        name: n,
        namingRule: catalog.solutions.find(x => x.name === n)?.namingRule ?? '',
      }));

      return {
        name: i.name,
        // 狙いの名称は社内語彙。対外呼称ルールは中で使う WHAT 側に付いている
        displayName: i.name,
        nameSafe: whatDisplays.every(d => d.safe),
        kind: null,
        proposalType: proposalTypeFromName(i.name),
        valueLine: i.valueLine,
        expectedEffect: i.businessImpact,
        fit,
        relatedSituations: [...new Set([...i.effectiveFor, ...i.prerequisites, ...i.antiPatterns])],
        reasons:  hitEff.map(id => labelOf(catalog, id)),
        cautions: [
          ...hitAnti.map(id => labelOf(catalog, id)),
          ...missingPre.map(id => `前提が確認できていません: ${labelOf(catalog, id)}`),
        ],
        matchedSituations: hitEff,
        meetingRate: null,
        supporting: whatDisplays.map(d => d.display),
        frameName: i.frameNames[0] ?? null,
        contract: i.contract,
        contractOk: true,
        requiredInputs: i.requiredInputs,
        audiences: i.audiences,
        changeTarget: i.changeTarget,
        businessImpact: i.businessImpact,
        signals,
        // 並べ替え用（レスポンスには出さない）
        _hit:   hitEff.length,
        _order: i.order,
      };
    })
    // おすすめ順: 一致あり（一致数の多い順）→ 妨げなし → 逆効果あり。
    // 同点は B1 の並び順（人が決めた既定の順）で固定する。
    .sort((a, b) => {
      const rank = (v: ProposalIntent['fit']) =>
        v === 'recommended' ? 0 : v === 'possible' ? 1 : 2;
      return rank(a.fit) - rank(b.fit)
        || b._hit - a._hit
        || a._order - b._order;
    })
    .map(({ _hit, _order, ...rest }) => rest);

  /** 契約前提で外した狙い。「なぜ出ていないか」を画面に出すために返す */
  const hiddenByContract = catalog.intents
    .filter(i => !contractSatisfied(i.contract, plan))
    .map(i => ({ name: i.name, contract: i.contract }));

  const body: ProposalIntentsResponse = {
    companyUid:  facts.companyUid,
    companyName: facts.companyName,
    intents,
    groups,
    activeSignals,
    situationLabels: Object.fromEntries(
      catalog.situations.filter(s => s.labelJa).map(s => [s.id, s.labelJa]),
    ),
    contractPlan: plan,
    hiddenByContract,
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

/**
 * 契約前提を満たすか。
 *
 * **Bundle 契約に「Bundle化」を出さないための判定。**
 * プランが読み取れない（null）ときは、契約に依存しない狙いだけ通す。
 */
function contractSatisfied(
  required: ContractPrecondition,
  plan: 'insight' | 'experience' | 'bundle' | null,
): boolean {
  switch (required) {
    case 'any':             return true;
    case 'contracted':      return plan !== null;
    case 'insight_only':    return plan === 'insight';
    case 'experience_only': return plan === 'experience';
    case 'none':            return plan === null;
  }
}

/**
 * 狙いの名前から骨子の型を決める。
 * FDE / PoC は伴走の比重が大きく、章8（Execution）の書き方が変わる。
 */
function proposalTypeFromName(name: string): ProposalType {
  return /FDE|PoC/i.test(name) ? proposalTypeFromKind('支援メニュー') : proposalTypeFromKind('製品・機能');
}
