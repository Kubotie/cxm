// ─── WHAT マッチング（S2）─────────────────────────────────────────────────────
//
// 顧客の activeSignals（状況IDの集合）と Notion の WHAT カタログを突き合わせ、
// 「今この顧客に何を当てるか」を出す。
//
// 設計根拠: docs-src/cxm_v2/17_WHO_WHAT_Matching_Plan.md §3.3
//
// 要点は activeSignals の作り方。**signalIdsFromReadiness() を1箇所に置く**。
// ここが散ると、判定に使う語彙が画面ごとにずれて原因が追えなくなる。
//
// ⚠️ proposal-readiness.ts 側で既に全体ガードレールが効いている:
//     friction < 40 → overall に上限45 / 準備度が低い → connect・rebuild に固定
//   RD_Friction_High と RENEWAL_Near_0_30 を Notion 側の逆効果にも入れると
//   二重に効いて候補が過剰に消えるため、**逆効果としての二重適用は行わない**
//   （activeSignals には入れるが、それは「状況の記述」であって判定の二重掛けではない）。
//
// このファイルはサーバー・クライアント両対応（副作用なし）。

import type { ProposalReadinessVM, ProposalPlay, RenewalBucket } from '@/lib/company/proposal-readiness';
import type { SolutionCatalogEntry, NarrativeFrame, WhatCatalog } from '@/lib/notion/what-catalog';

// ── 状況ID の生成（唯一の場所）────────────────────────────────────────────────

/** 準備度の factor が「低い」とみなすしきい値 */
const LOW_FACTOR_SCORE = 45;

/**
 * 準備度・提案の型・契約更新から状況IDを組み立てる。
 *
 * **この関数以外で状況IDを組み立てないこと。** 語彙の生成箇所が散ると、
 * ボードと個社ページで別の判定になり、原因を追えなくなる。
 *
 * @param manualSituations NocoDB `company_situations` 由来の手動登録状況。
 *   AIREADY_* / SKILL_NoAnalyst / TIME_NoCapacity / USECASE_Unclear など、
 *   自動検出できない語彙はここから入る。**空配列でも動く。**
 */
export function signalIdsFromReadiness(input: {
  readiness?:     ProposalReadinessVM | null;
  play?:          ProposalPlay | null;
  renewalBucket?: RenewalBucket | null;
  /** 契約更新までの残日数（renewalBucket より細かい判定に使う） */
  renewalDaysLeft?: number | null;
  manualSituations?: string[];
  /** 外部シグナル（X5_* など）。既に状況IDの形をしているのでそのまま合流させる */
  externalSignalIds?: string[];
  /**
   * 内部・行動シグナル（R_ / O_ / H_ 系）。detectBehaviorSignals() の結果をそのまま渡す。
   * 判定ロジックは behavior-signals.ts に閉じ、ここは合流だけを担う。
   */
  behaviorSignalIds?: string[];
}): string[] {
  const ids = new Set<string>();

  // ── 準備度の4要素 → RD_* ──────────────────────────────────────────────
  const f = input.readiness?.factors;
  if (f) {
    if (isLow(f.utilization.score))  ids.add('RD_Util_Low');
    if (isLow(f.execution.score))    ids.add('RD_Exec_Low');
    if (isLow(f.relationship.score)) ids.add('RD_Rel_Cold');
    // friction は「摩擦の少なさ」なので、低い = 摩擦が高い
    if (isLow(f.friction.score))     ids.add('RD_Friction_High');
  }

  // ── 提案の型 → PLAY_* ─────────────────────────────────────────────────
  switch (input.play) {
    case 'expand':  ids.add('PLAY_Expand');  break;
    case 'connect': ids.add('PLAY_Connect'); break;
    case 'deepen':  ids.add('PLAY_Deepen');  break;
    case 'rebuild': ids.add('PLAY_Rebuild'); break;
    default: break;
  }

  // ── 契約更新 → RENEWAL_* ──────────────────────────────────────────────
  // 残日数が分かればそちらを優先する（31-60 は bucket では出せない）
  const days = input.renewalDaysLeft;
  if (typeof days === 'number' && days >= 0) {
    if (days <= 30)      ids.add('RENEWAL_Near_0_30');
    else if (days <= 60) ids.add('RENEWAL_31_60');
  } else if (input.renewalBucket === '0-30') {
    ids.add('RENEWAL_Near_0_30');
  }

  // ── 手動登録・外部・行動シグナル ──────────────────────────────────────
  for (const s of input.manualSituations ?? [])  if (s) ids.add(s);
  for (const s of input.externalSignalIds ?? []) if (s) ids.add(s);
  for (const s of input.behaviorSignalIds ?? []) if (s) ids.add(s);

  return [...ids];
}

function isLow(score: number | null): boolean {
  return score !== null && score < LOW_FACTOR_SCORE;
}

/** 事例が0件のときに追加する状況ID */
export const NO_MATCHING_CASE = 'INDUSTRY_NoMatchingCase';

// ── マッチング結果 ────────────────────────────────────────────────────────────

export interface MatchedSolution {
  name:      string;
  role:      string | null;
  valueLine: string;
  /** 一致した状況ID（なぜ選ばれたか） */
  matchedSituations: string[];
  /** 順位付けスコア = 一致した状況数 × 打合せ設定率 */
  score:     number;
  /**
   * 「効く状況」の登録総数。**同点時のタイブレークに使う（少ない = より特化）。**
   * これが無いと同点が名前順で決まり、汎用WHATが常に上位を占めて
   * 特化WHATが一度も候補に出なくなる（Ptengine Insight が全社で3位固定になった）。
   */
  effectiveTotal: number;
  /** 打合せ設定率（提案数が0なら null） */
  meetingRate: number | null;
  namingRule: string;
  expectedEffect: string;
  evidence:   string;
  mustPairWith: string[];
}

export interface ExcludedSolution {
  whatName: string;
  reason:   '逆効果' | '前提条件不足' | '状態';
  /** 除外の決め手になった状況ID */
  situationIds: string[];
}

export interface MatchedFrame {
  name:          string;
  reframe:       string;
  talkingPoints: string;
  avoidWhen:     string;
  matchedSituations: string[];
  targetWhat:    string[];
}

export interface WhatMatchResult {
  activeSignals: string[];
  /** 主役WHAT（スコア降順） */
  primary:   MatchedSolution[];
  /** 補助WHAT（主役の「必ず組む相手」＋ 効く状況が一致した補助） */
  supporting: MatchedSolution[];
  frames:    MatchedFrame[];
  /**
   * 除外した候補。**「逆効果に当たって外した」が最も価値の高い情報**なので必ず返す。
   * 静かに消えると誰も気づけない。
   */
  excluded:  ExcludedSolution[];
  /** カタログ側の問題（未知の状況ID参照・逆効果空など） */
  catalogIssues: WhatCatalog['issues'];
  /** カタログが使えない理由。null = 正常 */
  catalogUnavailable: string | null;
  /**
   * 事例が0件だったため INDUSTRY_NoMatchingCase を足して再判定したか。
   * null = 再判定していない（理由つき）
   */
  noMatchingCase: {
    applied: boolean;
    /** 適用しなかった / した理由。UI に出す */
    reason:  string;
  };
}

export const EMPTY_MATCH: WhatMatchResult = {
  activeSignals: [], primary: [], supporting: [], frames: [],
  excluded: [], catalogIssues: [], catalogUnavailable: null,
  noMatchingCase: { applied: false, reason: 'カタログ未取得' },
};

// ── マッチング本体 ────────────────────────────────────────────────────────────

/**
 * ① 主役候補 = 効く状況 ∩ active ≠ ∅ && 前提条件 ⊆ active && 逆効果 ∩ active = ∅
 *    rank(by: 一致した状況数 × 打合せ設定率)
 * ② 補助 = 主役.必ず組む相手 ∪ (役割=補助 && 効く状況 ∩ active ≠ ∅)
 * ③ フレーム = 状態=利用可 && 起動する状況 ∩ active ≠ ∅
 */
/**
 * 事例が0件のときに INDUSTRY_NoMatchingCase を足して**1回だけ**再判定する。
 *
 * 新規顧客で効く。事例を無理に出すのではなく「同業種・同課題の事例が手元にない」を
 * 状況として認識させ、語り方を変えるための入口。
 *
 * ⚠️ ガード: 効く状況が張られた事例が**カタログに1件も無い**場合は適用しない。
 *   そのとき「事例が無い」と「まだ紐付けていない」は区別できず、
 *   前者だと断定するのは誤り。実測（2026-08-21）で活用ギャラリー80件すべての
 *   効く状況が空だったため、これが無いと全企業に無条件で付いてしまう。
 *   INDUSTRY_NoMatchingCase は B の「施策パターン集」の逆効果なので、
 *   誤って付くと全企業でその補助WHATが候補から消える。
 *
 * 再帰は1回に固定する（NO_MATCHING_CASE を足した結果で再度0件になっても回さない）。
 */
export function matchWhat(input: {
  catalog:       WhatCatalog;
  activeSignals: string[];
}): WhatMatchResult {
  const first = matchWhatOnce(input);
  const { catalog } = input;

  // 効く状況が張られた事例がカタログに存在するか
  const taggedCases = catalog.cases.filter(c => c.effectiveFor.length > 0);
  if (taggedCases.length === 0) {
    return {
      ...first,
      noMatchingCase: {
        applied: false,
        reason: catalog.cases.length === 0
          ? '事例カタログが未取得のため判定していません'
          : `事例${catalog.cases.length}件すべてに「効く状況」が未設定のため判定していません`
            + '（「事例が無い」と「紐付け前」を区別できません）',
      },
    };
  }

  const active = new Set(input.activeSignals);
  if (active.has(NO_MATCHING_CASE)) {
    return { ...first, noMatchingCase: { applied: false, reason: '既に手動登録されています' } };
  }

  const hit = taggedCases.filter(c => c.effectiveFor.some(sid => active.has(sid)));
  if (hit.length > 0) {
    return {
      ...first,
      noMatchingCase: { applied: false, reason: `状況が一致する事例が${hit.length}件あります` },
    };
  }

  // 事例0件 → 状況として認識させて1回だけ再判定する
  const second = matchWhatOnce({ catalog, activeSignals: [...input.activeSignals, NO_MATCHING_CASE] });
  return {
    ...second,
    noMatchingCase: {
      applied: true,
      reason: '状況が一致する事例が0件のため「同業種・同課題の事例が手元にない」を状況に追加しました',
    },
  };
}

function matchWhatOnce(input: {
  catalog:       WhatCatalog;
  activeSignals: string[];
}): Omit<WhatMatchResult, 'noMatchingCase'> {
  const { catalog } = input;
  const active = new Set(input.activeSignals);

  const primary: MatchedSolution[] = [];
  const excluded: ExcludedSolution[] = [];

  for (const s of catalog.solutions) {
    if (s.role !== '主役WHAT') continue;

    const hitEffective = s.effectiveFor.filter(id => active.has(id));
    if (hitEffective.length === 0) continue;   // そもそも効く状況が無い → 除外理由にはしない

    // 逆効果に当たっているか（最優先で外す）
    const hitAnti = s.antiPatterns.filter(id => active.has(id));
    if (hitAnti.length > 0) {
      excluded.push({ whatName: s.name, reason: '逆効果', situationIds: hitAnti });
      continue;
    }

    // 前提条件を満たしているか
    const missingPre = s.prerequisites.filter(id => !active.has(id));
    if (missingPre.length > 0) {
      excluded.push({ whatName: s.name, reason: '前提条件不足', situationIds: missingPre });
      continue;
    }

    primary.push(toMatched(s, hitEffective));
  }

  primary.sort(compareMatched);

  // ② 補助
  const pairNames = new Set(primary.flatMap(p => p.mustPairWith));
  const supporting: MatchedSolution[] = [];
  const seenSupport = new Set<string>();

  for (const s of catalog.solutions) {
    const isPair = pairNames.has(s.name);
    const isSupportRole = s.role === '補助WHAT（部品・証跡）';
    if (!isPair && !isSupportRole) continue;

    const hitEffective = s.effectiveFor.filter(id => active.has(id));
    // 「必ず組む相手」は状況一致がなくても付ける（主役が要求しているため）
    if (!isPair && hitEffective.length === 0) continue;

    // 補助でも逆効果に当たっていれば外す
    const hitAnti = s.antiPatterns.filter(id => active.has(id));
    if (hitAnti.length > 0) {
      excluded.push({ whatName: s.name, reason: '逆効果', situationIds: hitAnti });
      continue;
    }

    if (seenSupport.has(s.name)) continue;
    seenSupport.add(s.name);
    supporting.push(toMatched(s, hitEffective));
  }

  supporting.sort(compareMatched);

  // ③ フレーム
  const frames: MatchedFrame[] = catalog.frames
    .map(fr => ({ fr, hit: fr.triggeredBy.filter(id => active.has(id)) }))
    .filter(({ hit }) => hit.length > 0)
    .map(({ fr, hit }) => ({
      name:          fr.name,
      reframe:       fr.reframe,
      talkingPoints: fr.talkingPoints,
      avoidWhen:     fr.avoidWhen,
      matchedSituations: hit,
      targetWhat:    fr.targetWhat,
    }))
    .sort((a, b) => b.matchedSituations.length - a.matchedSituations.length);

  return {
    activeSignals: [...active],
    primary,
    supporting,
    frames,
    excluded,
    catalogIssues: catalog.issues,
    catalogUnavailable: catalog.unavailable,
  };
}

/**
 * 順位付け。スコア → **特化度（効く状況が少ない方が上）** → 名前 の順で決める。
 *
 * 特化度を入れる理由: 打合せ設定率が溜まるまで score は「一致した状況数」だけになり、
 * 同点が量産される。そこで名前順に落とすと、汎用WHAT（効く状況を多く登録したもの）が
 * たまたま名前で勝って上位を独占し、狭く強く効くWHATが表に出ない。
 * 実績が入れば score 側で差がつくので、これは初期の暫定順位付けとして働く。
 */
function compareMatched(a: MatchedSolution, b: MatchedSolution): number {
  return b.score - a.score
    || a.effectiveTotal - b.effectiveTotal
    || a.name.localeCompare(b.name);
}

function toMatched(s: SolutionCatalogEntry, hitEffective: string[]): MatchedSolution {
  const rate = meetingRate(s);
  return {
    name:      s.name,
    role:      s.role,
    valueLine: s.valueLine,
    matchedSituations: hitEffective,
    // 実績がまだ無い（提案数0）段階では 1.0 として扱い、一致数だけで並べる。
    // 0 を掛けると実績のない WHAT が永久に最下位になり、新しいものが試されない。
    score:       hitEffective.length * (rate ?? 1),
    effectiveTotal: s.effectiveFor.length,
    meetingRate: rate,
    namingRule:  s.namingRule,
    expectedEffect: s.expectedEffect,
    evidence:    s.evidence,
    mustPairWith: s.mustPairWith,
  };
}

/** 打合せ設定率。提案数が未記録 / 0 なら null（実績なし） */
function meetingRate(s: SolutionCatalogEntry): number | null {
  if (!s.proposedCount || s.proposedCount <= 0) return null;
  return (s.meetingCount ?? 0) / s.proposedCount;
}

// ── 対外呼称ルールの適用（文章生成の中に入れる）──────────────────────────────

/** 使用禁止の旧称 → 正しい呼称。ここは実測で判明したものを直接持つ */
const FORBIDDEN_NAMES: Array<{ pattern: RegExp; correct: string }> = [
  // 「Page Studio」は使用禁止。正しくは「集客App内のLP生成機能」
  { pattern: /Page\s*Studio/gi, correct: '集客App内のLP生成機能' },
  // 「AI Insight〈わかる〉」は社内呼称。顧客向けは「インサイトApp（PGA）」
  // （2026-08-21 確定。Notion B の対外呼称ルールも同時に更新済み）
  { pattern: /AI\s*Insight\s*〈わかる〉/gi, correct: 'インサイトApp（PGA）' },
];

export interface NamingCheck {
  /** 顧客向けに出してよいか */
  safe:    boolean;
  /** 置換・除外を適用した後の表示名 */
  display: string;
  /** 適用した理由（ログ・UI 用） */
  note:    string | null;
}

/**
 * WHAT 名を顧客向け文面に出せる形にする。
 *
 * **表示層ではなく、文章を組み立てる関数の中で呼ぶこと。**
 * 表示側でだけ弾いても、生成された文章の中に旧称が残る。
 *
 * ルール:
 *   1. 対外呼称ルールが非空なら、その指示が最優先
 *   2. ルールに「要確認」が含まれる行は顧客向け文面に一切出さない
 *   3. 禁止された旧称は正しい呼称に置換する
 */
export function applyNamingRule(input: { name: string; namingRule: string }): NamingCheck {
  const rule = (input.namingRule ?? '').trim();

  // 2) 要確認 → 顧客向けには出さない
  if (rule.includes('要確認')) {
    return {
      safe: false,
      display: '（呼称未確定のため非表示）',
      note: '対外呼称ルールに「要確認」があるため顧客向け文面に出しません',
    };
  }

  let display = input.name;
  const notes: string[] = [];

  // 3) 禁止された旧称の置換
  for (const { pattern, correct } of FORBIDDEN_NAMES) {
    if (pattern.test(display)) {
      display = display.replace(pattern, correct);
      notes.push(`旧称を「${correct}」に置換`);
    }
    pattern.lastIndex = 0;
  }

  // 1) ルールが非空ならそれを添える（人が最終確認できるように）
  if (rule) notes.push(`呼称ルール: ${rule}`);

  return { safe: true, display, note: notes.length > 0 ? notes.join(' / ') : null };
}

/**
 * 顧客向けの一文を組み立てる。呼称ルールをここで必ず通す。
 * safe = false の WHAT は文面に含めない。
 */
export function buildCustomerFacingLine(input: {
  solution: MatchedSolution;
  frame?:   MatchedFrame | null;
}): { text: string; omitted: boolean; note: string | null } {
  const check = applyNamingRule({ name: input.solution.name, namingRule: input.solution.namingRule });
  if (!check.safe) {
    return { text: '', omitted: true, note: check.note };
  }

  const parts: string[] = [];
  if (input.frame?.reframe) parts.push(input.frame.reframe);
  parts.push(
    input.solution.valueLine
      ? `${check.display}：${input.solution.valueLine}`
      : check.display,
  );
  if (input.solution.expectedEffect) parts.push(input.solution.expectedEffect);

  return { text: parts.join(' '), omitted: false, note: check.note };
}
