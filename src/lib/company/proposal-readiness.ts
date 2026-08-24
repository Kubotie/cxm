// ─── Proposal Readiness（提案準備度）─────────────────────────────────────────
//
// 「今この顧客に提案を持ち込んでよいか」を既存データだけで判定する。
//
// 背景:
//   外部トリガー（IR の DX 投資・組織変化など）を掴んでも、提供中の機能が
//   使われていない状態で新提案を持ち込むと、ミーティングの打診が通らず、
//   通っても推進が浅くなる。外部機会は消耗品であり、準備度が低いときに
//   使うと機会そのものを焼く。
//   → 設計根拠は docs-src/cxm_v2/17_WHO_WHAT_Matching_Plan.md §15
//
// 4要素（すべて既存データで算出可能）:
//   ① utilization  利用充足   提供中の機能が実際に使われているか
//   ② execution    実行体制   顧客側に手を動かす人がいるか（施策数の推移）
//   ③ relationship 関係の温度 接点の鮮度と頻度
//   ④ friction     摩擦の少なさ 未解決サポート＋「他ツールで代替可能」の認知
//
// 設計方針:
//   - スコアは 0-100。算出に必要なデータが無い要素は null（推定しない）
//   - null の要素は overall の重みから除外する（欠損で不当に下がらないようにする）
//   - AND 性を持たせる: 摩擦が大きい / 使われていない場合は他が良くても上限を被せる
//   - 評価単位は **project**（＝部門・予算単位）。会社単位で平均すると
//     「主契約部門は解約方向、別部門は拡張余地」のような差が消える（§15.3）
//   - Phase と同様、これは推定であり確定ではない。UI では根拠（reasons）を必ず併記する
//
// このファイルはサーバー・クライアント両対応（副作用なし）。

import type { ProjectSignalData } from '@/lib/metabase/project-signals';
import type { ModuleSignalVM } from '@/lib/company/module-signals';

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type ReadinessLevel = 'high' | 'medium' | 'low' | 'unknown';

/** 提案の型（§15.2 のマトリクス） */
export type ProposalPlay =
  | 'expand'   // 拡張提案     : 機会の文脈で新しい価値を提案する
  | 'connect'  // 接続提案     : 新規購入を求めず「今あるものを成果に変える」文脈に接続
  | 'deepen'   // 深化         : 活用の深掘り・横展開
  | 'rebuild'  // 立て直し     : 提案しない。足元を戻すことに集中する
  | 'unknown';

export type RenewalBucket = '0-30' | '31-90' | '91-180' | '180+' | 'expired';

export interface ReadinessFactor {
  /** 0-100。null = 算出に必要なデータが無い */
  score:   number | null;
  level:   ReadinessLevel;
  /** 表示用の根拠。スコアの内訳をそのまま人が読める形で持つ */
  reasons: string[];
}

export interface ProposalReadinessVM {
  scope:   'project' | 'company';
  scopeId: string;
  /** 表示名（プロジェクト名 or 会社名） */
  label:   string;

  overall:      ReadinessLevel;
  /** 0-100。算出可能な要素が1つも無ければ null */
  overallScore: number | null;

  factors: {
    utilization:  ReadinessFactor;
    execution:    ReadinessFactor;
    relationship: ReadinessFactor;
    friction:     ReadinessFactor;
  };

  /** overall にキャップが適用された場合の理由（空 = 未適用） */
  caps:    string[];
  /** 算出できなかった要素のキー */
  missing: ReadinessFactorKey[];
}

export type ReadinessFactorKey = 'utilization' | 'execution' | 'relationship' | 'friction';

/**
 * 4要素の説明。**画面に出す文言の正本。**
 *
 * UI 側に文言を書くと、配点を直したときに説明だけ古いまま残る。
 * ここを直せば、ボードのツールチップも個社ページの説明も同時に変わる。
 */
export const FACTOR_META: Record<ReadinessFactorKey, {
  /** カードのミニバーに出す短い名前 */
  /**
   * カードの見出し。**2文字に切り詰めない。**
   * 「実行」は実行力とも実行中とも読めて、指すものが伝わらなかった。
   */
  short: string;
  /** 正式名称 */
  label: string;
  /** 何を測っているか（1文） */
  question: string;
  /** 何から算出しているか */
  basis: string;
  /** overall に占める重み */
  weight: number;
  /** 低いと何が起きるか */
  lowMeans: string;
}> = {
  utilization: {
    short: '利用充足', label: '利用の充足',
    question: '提供中の機能が実際に使われているか',
    basis: '稼働キャンペーン数（35）／**30日の分析・検証PV**（25）／習慣化（20）／最終活動の鮮度（20）。'
         + 'PV 消化率が契約に対して極端に低い場合は減点。'
         + '30日間の管理画面アクセスが無い場合は上限20、着地画面までなら上限35、'
         + '契約製品の一部が未使用なら上限60をかけます',
    weight: 0.35,
    lowMeans: '今あるものが使われていない。新しいものを足す前に、使われる状態に戻す必要がある',
  },
  execution: {
    short: '実行体制', label: '実行体制',
    question: '顧客側に手を動かす人がいるか',
    basis: '**運用人数**（40 / 直近4週に管理画面を触った顧客側アカウント数。社内アカウントは除外）'
         + '／稼働キャンペーン数の推移（50）／30日間の活動量の推移（30）。推移は30日前と比較。'
         + '取得できた配点だけで正規化するので、一部が欠けても判定できます',
    weight: 0.25,
    lowMeans: '提案しても実行されない。伴走か、実行負荷の小さい打ち手が要る',
  },
  relationship: {
    short: '関係の温度', label: '関係の温度',
    question: '打診が届く状態か',
    basis: '最終接点からの日数（60）／直近90日の接点件数（40）',
    weight: 0.25,
    lowMeans: '打診自体が届かない。提案の前に関係を戻す必要がある',
  },
  friction: {
    short: '摩擦の少なさ', label: '摩擦の少なさ',
    question: '未解決の摩擦が無いか（高い＝摩擦が少ない）',
    basis: '直近90日のオープンサポート件数。'
         + 'あわせて議事録・チャットの「他ツールで代替可能」という認知を減点として扱う',
    weight: 0.15,
    lowMeans: 'この状態で新提案を出すと不誠実に映る。解消が先',
  },
};

/** 判定を押し下げる上限（AND性）。画面の説明に使う */
export const READINESS_CAP_NOTE = [
  '摩擦が40未満のときは、他が高くても準備度に45の上限がかかります。',
  '利用が25未満のときは、準備度に50の上限がかかります。',
  '契約満了91〜31日前（解約判断期）は、準備度が high でなければ「立て直し」に固定します。',
];

export interface ProposalReadinessInput {
  scope:   'project' | 'company';
  scopeId: string;
  label:   string;

  // ── ① utilization ──────────────────────────────────────────────────────
  /** Metabase project-signals。null = 利用実態データなし */
  signal?: ProjectSignalData | null;
  /** 習慣化ステータス（AppProjectInfo.habituationStatus）。null = 不明 */
  habituationStatus?: boolean | null;
  /**
   * 過去30日の管理画面モジュール利用（module-signals）。null = 未取得。
   *
   * **「今使っているか」はこれでしか分からない。**
   * signal.heatmapCount は契約開始からの累計で、長期契約の顧客は
   * 今使っていなくても満点になっていた（実測で最大9,541件）。
   */
  moduleSignal?: ModuleSignalVM | null;

  // ── ② execution ────────────────────────────────────────────────────────
  /** 稼働キャンペーン数の30日前値（company_daily_snapshot 由来）。null = 比較不能 */
  campaignCount30dAgo?: number | null;
  /** 現在の稼働キャンペーン数。project 評価時は signal 側を優先する */
  campaignCountNow?:    number | null;
  /** l30Active の30日前値 */
  l30Active30dAgo?:     number | null;
  /** 現在の l30Active。project 評価時は signal 側を優先する */
  l30ActiveNow?:        number | null;
  /**
   * 直近4週に管理画面を触った**顧客側**アカウント数（社内 @ptmind.com を除く）。
   *
   * 実行体制は「顧客側に手を動かす人がいるか」なので、本来これが主指標。
   * これまで推移（キャンペーン数・活動量）だけで見ていて、人数を見ていなかった。
   * null = データ未取得（配点から除外する。0人と混同しない）。
   */
  operators?:      number | null;
  /** その前の4週の運用人数。増減を見る */
  operatorsPrev?:  number | null;

  // ── ③ relationship ─────────────────────────────────────────────────────
  /** 最終接点からの経過日数（communication-signal 由来）。null = 接点記録なし */
  communicationBlankDays?: number | null;
  /** 直近90日の接点件数（議事録・チャット・サポートの合計） */
  touchpointCount90d?:     number | null;

  // ── ④ friction ─────────────────────────────────────────────────────────
  /** オープンなサポート／CSE チケット件数 */
  openSupportCount?: number | null;
  /**
   * 「他ツールで代替可能」「内製化で代替」等の認知が確認されているか。
   * チケットが0件でも代替判断が出ていれば摩擦は存在する（認知の摩擦）。
   * 議事録からの抽出（replaceability-signal.ts）or 担当者の手入力で立てる。
   */
  replaceabilityFlagged?: boolean;
  /**
   * 代替認知の最新検出からの経過日数。古い言及は減点を弱める。
   * null / 未指定 = 不明として満額の減点を適用する。
   */
  replaceabilityAgeDays?: number | null;

  // ── ガードレール ────────────────────────────────────────────────────────
  /**
   * 更新バケット。**31-90 が勝負期間**。
   *
   * 契約満了の30日以内は解約できない運用ルールのため、`0-30` は
   * 「更新がほぼ確定した状態」であり緊急ではない（むしろ次期の提案余地がある）。
   * 解約判断が実際に行われるのは満了 90〜31 日前なので、
   * そこで準備度が足りていない場合に更新確保を優先する。
   */
  renewalBucket?: RenewalBucket | null;
}

// ── しきい値 ──────────────────────────────────────────────────────────────────
//
// しきい値は1箇所に集約する（運用しながら調整するため）。
// 実データ（Tier1 企業3社）で妥当性を確認した初期値。

export const READINESS_THRESHOLD = {
  /** level 判定の境界 */
  level: { high: 70, medium: 45 },

  /** overall の重み（null の要素は除外して正規化する） */
  weight: {
    utilization:  0.35,
    execution:    0.25,
    relationship: 0.25,
    friction:     0.15,
  },

  /** AND 性のキャップ: この条件を満たすと overall に上限を被せる */
  cap: {
    /** 摩擦が大きい（friction がこの値未満）→ overall 上限 */
    frictionBelow:      40,
    frictionCapTo:      45,
    /** 使われていない（utilization がこの値未満）→ overall 上限 */
    utilizationBelow:   25,
    utilizationCapTo:   50,
  },

  /** 代替認知の減点。古い言及ほど弱める */
  replaceability: {
    /** この日数以内は満額減点 */
    recentDays:    90,
    recentPenalty: 40,
    /** recentDays 超〜この日数以内は軽減 */
    agingDays:     180,
    agingPenalty:  15,
  },
} as const;

// ── ① utilization（利用充足）─────────────────────────────────────────────────

/**
 * 提供中の機能が実際に使われているかを 0-100 で評価する。
 *
 * 配点: 稼働キャンペーン35 / ヒートマップ25 / 習慣化20 / 活動鮮度20
 *       ＋ PV 消化率が極端に低い場合は減点（契約に対して価値が出ていない）
 */
function calcUtilization(input: ProposalReadinessInput): ReadinessFactor {
  const { signal, habituationStatus } = input;
  if (!signal) {
    return { score: null, level: 'unknown', reasons: ['利用実態データなし（Metabase 未取得）'] };
  }

  const reasons: string[] = [];
  let score = 0;

  // 稼働キャンペーン数（施策が回っているか）
  const camp = signal.runningCampaignWithGoalCount;
  const campPt =
    camp >= 10 ? 35 :
    camp >= 5  ? 25 :
    camp >= 3  ? 15 :
    camp >= 1  ? 7  : 0;
  score += campPt;
  reasons.push(`稼働キャンペーン ${camp}本（+${campPt}）`);

  // 分析が回っているか。
  // **30日の実測（管理画面のモジュール利用）を優先する。**
  // 取得できないときだけ、累計ヒートマップ数にフォールバックする。
  const mod = input.moduleSignal ?? null;
  if (mod && mod.verdict !== 'unevaluated') {
    // 閾値は有料PJ1,302件の実測分布で校正した（2026-08-22）:
    //   50%tile=0 / 70%=2 / 80%=12 / 90%=58 / 95%=108 / 99%=368
    // 上位5%→25点、上位10%→20点、上位20%→14点、上位30%→8点。
    // ⚠️ 旧指標（累計ヒートマップ）は95%tileでも13件で、ほぼ全社が8点以下だった。
    //   分析の配点が事実上死んでいたので、置き換えると多くの企業のスコアが上がる。
    const deep = mod.deepPv;
    const deepPt =
      deep >= 110 ? 25 :
      deep >= 60  ? 20 :
      deep >= 15  ? 14 :
      deep >= 3   ? 8  :
      deep >= 1   ? 3  : 0;
    score += deepPt;
    reasons.push(`30日の分析・検証 ${deep.toLocaleString('ja-JP')}PV（+${deepPt}）`);
  } else {
    const hm = signal.heatmapCount;
    const hmPt =
      hm >= 100 ? 25 :
      hm >= 50  ? 20 :
      hm >= 20  ? 14 :
      hm >= 5   ? 8  :
      hm >= 1   ? 3  : 0;
    score += hmPt;
    reasons.push(`ヒートマップ ${hm}件（累計 / +${hmPt}）※30日の実測が未取得`);
  }

  // 習慣化（定着しているか）
  if (habituationStatus === true) {
    score += 20;
    reasons.push('習慣化 あり（+20）');
  } else if (habituationStatus === false) {
    reasons.push('習慣化 なし（+0）');
  } else {
    score += 10;
    reasons.push('習慣化 不明（+10 / 中間値）');
  }

  // 活動鮮度
  const days = daysSince(signal.lastActiveDate);
  if (days === null) {
    score += 10;
    reasons.push('最終活動日 不明（+10 / 中間値）');
  } else {
    const freshPt =
      days <= 3  ? 20 :
      days <= 7  ? 16 :
      days <= 14 ? 10 :
      days <= 30 ? 5  : 0;
    score += freshPt;
    reasons.push(`最終活動 ${days}日前（+${freshPt}）`);
  }

  // PV 消化（契約枠に対して使い切っているか）
  // **期間の経過を見る。** PV枠は契約更新日の応当日でリセットされるため、
  // 始まったばかりの期間で消化率が低いのは当たり前で、減点してはいけない。
  const pv = pvPeriodStatus(signal);
  if (pv.evaluable && pv.underused) {
    const rate = pv.forecastRate ?? pv.actualRate ?? 0;
    const penalty = rate < 25 ? 12 : 8;
    score -= penalty;
    reasons.push(`PV ${pv.forecastRate !== null ? '着地予測' : '実績'}が契約の${rate}%（オーバースペック / −${penalty}）`);
  } else if (!pv.evaluable && pv.actualRate !== null) {
    reasons.push(`PV ${pv.note}`);
  }

  // ── 30日の実測による上限 ────────────────────────────────────────────────
  // 累計や習慣化フラグだけだと、管理画面に来ていない顧客でも点が積み上がる。
  // 「今どう使われているか」に矛盾するスコアを出さないための頭打ち。
  let capped = clamp(score);
  if (mod) {
    if (mod.verdict === 'dormant') {
      capped = Math.min(capped, MODULE_CAP.dormant);
      reasons.push(`30日間、管理画面へのアクセスなし（上限 ${MODULE_CAP.dormant}）`);
    } else if (mod.verdict === 'unused') {
      capped = Math.min(capped, MODULE_CAP.unused);
      reasons.push(`30日間、着地画面までで止まっている（上限 ${MODULE_CAP.unused}）`);
    } else if (mod.verdict === 'partial') {
      capped = Math.min(capped, MODULE_CAP.partial);
      reasons.push(`契約中の ${mod.unusedEntitled.join('・')} が30日未使用（上限 ${MODULE_CAP.partial}）`);
    }
  }

  return { score: capped, level: toLevel(capped), reasons };
}

/**
 * 30日の実測による利用充足の上限。
 *
 * 実測（2026-08-22 / 有料PJ 1,302件）: 休眠695件・未使用88件・一部未使用69件。
 * 休眠を 20 に抑えるのは、管理画面に来ていない相手に「利用充足が高い」と
 * 出してはいけないため。一部未使用の 60 は「使ってはいるが契約分を使い切っていない」
 * ことを示す位置づけで、提案を止めるための上限ではない。
 */
export const MODULE_CAP = { dormant: 20, unused: 35, partial: 60 } as const;

// ── ② execution（実行体制）───────────────────────────────────────────────────

/**
 * 顧客側に手を動かす人がいるかを、施策数と活動量の推移から評価する。
 *
 * 「増えているか / 減っているか」が本質なので、30日前との比較データが
 * 無い場合は null を返す（現在値だけからは実行体制を判断しない）。
 */
function calcExecution(input: ProposalReadinessInput): ReadinessFactor {
  // 現在値と過去値は必ず同じ集計単位のものを比べる。
  // signal（プロジェクト単位の現在値）を混ぜると、会社合計の過去値と
  // プロジェクト個別の現在値を比較してしまい、増減率が壊れる。
  const campNow = input.campaignCountNow ?? null;
  const campAgo = input.campaignCount30dAgo ?? null;
  const l30Now  = input.l30ActiveNow ?? null;
  const l30Ago  = input.l30Active30dAgo ?? null;

  const campTrend = trendRatio(campAgo, campNow);
  const l30Trend  = trendRatio(l30Ago, l30Now);
  const operators = input.operators ?? null;

  if (campTrend === null && l30Trend === null && operators === null) {
    return { score: null, level: 'unknown', reasons: ['30日前との比較データなし（推移を判定できない）'] };
  }

  const reasons: string[] = [];
  let score = 0;
  let weightSum = 0;

  // 運用人数（配点40）。**顧客側に手を動かす人がいるか**という問いに直接答える。
  // 実測（2026-08-22）: 運用人数の中央値は1人、1,651PJ中1,120PJ（68%）が1人だけ。
  // 1人が普通なので、1人を低く扱いすぎない配点にする。
  if (operators !== null) {
    const pt =
      operators >= 4 ? 40 :
      operators === 3 ? 34 :
      operators === 2 ? 27 :
      operators === 1 ? 18 : 0;
    score += pt;
    weightSum += 40;
    const prev = input.operatorsPrev ?? null;
    const delta = prev !== null && prev !== operators ? `（4週前 ${prev}人）` : '';
    reasons.push(operators === 0
      ? `直近4週に管理画面を触った人が0人（+0）`
      : `運用 ${operators}人${delta}（+${pt}）`);
    if (operators === 1) reasons.push('※1人に依存しています（担当者が抜けると止まります）');
  }

  // 稼働キャンペーンの増減（配点50）
  if (campTrend !== null) {
    const pt = trendPoints(campTrend, 50);
    score += pt;
    weightSum += 50;
    reasons.push(`稼働キャンペーン ${campAgo}→${campNow}（${signedPct(campTrend)} / +${pt}）`);
  }

  // 活動量の増減（配点30）
  if (l30Trend !== null) {
    const pt = trendPoints(l30Trend, 30);
    score += pt;
    weightSum += 30;
    reasons.push(`L30 活動 ${l30Ago}→${l30Now}（${signedPct(l30Trend)} / +${pt}）`);
  }

  // 取得できた配点で正規化する（欠損で不当に下がらないようにする）
  const normalized = weightSum > 0 ? clamp(Math.round((score / weightSum) * 100)) : null;
  if (normalized === null) {
    return { score: null, level: 'unknown', reasons };
  }
  return { score: normalized, level: toLevel(normalized), reasons };
}

// ── ③ relationship（関係の温度）──────────────────────────────────────────────

/**
 * 打診が届く状態かを、接点の鮮度と頻度から評価する。
 * 配点: 最終接点からの日数60 / 直近90日の接点件数40
 */
function calcRelationship(input: ProposalReadinessInput): ReadinessFactor {
  const { communicationBlankDays: blank, touchpointCount90d: count } = input;
  if (blank === null || blank === undefined) {
    if (count === null || count === undefined) {
      return { score: null, level: 'unknown', reasons: ['接点記録なし（最終接点・接点件数ともに不明）'] };
    }
  }

  const reasons: string[] = [];
  let score = 0;
  let weightSum = 0;

  if (blank !== null && blank !== undefined) {
    const pt =
      blank <= 14 ? 60 :
      blank <= 30 ? 50 :
      blank <= 60 ? 35 :
      blank <= 90 ? 20 : 5;
    score += pt;
    weightSum += 60;
    reasons.push(`最終接点 ${blank}日前（+${pt}）`);
  }

  if (count !== null && count !== undefined) {
    const pt =
      count >= 5 ? 40 :
      count >= 3 ? 30 :
      count >= 1 ? 18 : 0;
    score += pt;
    weightSum += 40;
    reasons.push(`直近90日の接点 ${count}件（+${pt}）`);
  }

  const normalized = weightSum > 0 ? clamp(Math.round((score / weightSum) * 100)) : null;
  if (normalized === null) {
    return { score: null, level: 'unknown', reasons };
  }
  return { score: normalized, level: toLevel(normalized), reasons };
}

// ── ④ friction（摩擦の少なさ）────────────────────────────────────────────────

/**
 * 未解決の摩擦がないかを評価する。スコアが高い = 摩擦が少ない。
 *
 * チケット件数だけでなく「他ツールで代替可能」という認知も摩擦として扱う。
 * チケット0件でも代替判断が出ていれば、提案は不誠実に映る。
 */
function calcFriction(input: ProposalReadinessInput): ReadinessFactor {
  const open = input.openSupportCount;
  if ((open === null || open === undefined) && !input.replaceabilityFlagged) {
    return { score: null, level: 'unknown', reasons: ['サポート件数データなし'] };
  }

  const reasons: string[] = [];
  let score: number;

  if (open === null || open === undefined) {
    score = 60;
    reasons.push('サポート件数 不明（60 / 中間値）');
  } else {
    score =
      open === 0  ? 100 :
      open <= 2   ? 85  :
      open <= 5   ? 60  :
      open <= 10  ? 35  : 12;
    reasons.push(`オープンサポート ${open}件（${score}）`);
  }

  // 認知の摩擦。古い言及ほど減点を弱める（4ヶ月前の1回の言及と直近の解約検討を同列に扱わない）
  if (input.replaceabilityFlagged) {
    const age = input.replaceabilityAgeDays;
    const { recentDays, agingDays, recentPenalty, agingPenalty } = READINESS_THRESHOLD.replaceability;
    const penalty =
      age === null || age === undefined ? recentPenalty :
      age <= recentDays ? recentPenalty :
      age <= agingDays  ? agingPenalty  : 0;

    if (penalty > 0) {
      score -= penalty;
      const when = age === null || age === undefined ? '時期不明' : `${age}日前`;
      reasons.push(`「他ツールで代替可能」の認知あり（${when} / −${penalty} / 認知の摩擦）`);
    } else {
      reasons.push(`「他ツールで代替可能」の言及は${age}日前のため減点対象外`);
    }
  }

  const clamped = clamp(score);
  return { score: clamped, level: toLevel(clamped), reasons };
}

// ── 統合 ──────────────────────────────────────────────────────────────────────

/**
 * 提案準備度を算出する。
 *
 * 評価単位は原則 project（＝部門・予算単位）。会社単位で平均すると
 * 部門ごとの差が消えるため、company スコープは一覧表示用の粗い指標として扱う。
 */
export function calcProposalReadiness(input: ProposalReadinessInput): ProposalReadinessVM {
  const factors = {
    utilization:  calcUtilization(input),
    execution:    calcExecution(input),
    relationship: calcRelationship(input),
    friction:     calcFriction(input),
  };

  const missing = (Object.keys(factors) as ReadinessFactorKey[])
    .filter(k => factors[k].score === null);

  // 算出できた要素だけで重み付き平均を取る（欠損分は重みから除外）
  let weighted = 0;
  let weightSum = 0;
  for (const key of Object.keys(factors) as ReadinessFactorKey[]) {
    const score = factors[key].score;
    if (score === null) continue;
    const w = READINESS_THRESHOLD.weight[key];
    weighted  += score * w;
    weightSum += w;
  }

  const caps: string[] = [];
  let overallScore: number | null = weightSum > 0 ? Math.round(weighted / weightSum) : null;

  // AND 性のキャップ: 摩擦が大きい / 使われていない場合は他が良くても提案できない
  if (overallScore !== null) {
    const { cap } = READINESS_THRESHOLD;
    const friction   = factors.friction.score;
    const utilization = factors.utilization.score;

    if (friction !== null && friction < cap.frictionBelow && overallScore > cap.frictionCapTo) {
      overallScore = cap.frictionCapTo;
      caps.push(`未解決の摩擦が大きいため上限 ${cap.frictionCapTo} を適用`);
    }
    if (utilization !== null && utilization < cap.utilizationBelow && overallScore > cap.utilizationCapTo) {
      overallScore = cap.utilizationCapTo;
      caps.push(`提供中の機能が使われていないため上限 ${cap.utilizationCapTo} を適用`);
    }
  }

  return {
    scope:   input.scope,
    scopeId: input.scopeId,
    label:   input.label,
    overall: overallScore === null ? 'unknown' : toLevel(overallScore),
    overallScore,
    factors,
    caps,
    missing,
  };
}

// ── 提案の型判定 ──────────────────────────────────────────────────────────────

export interface ProposalPlayResult {
  play:  ProposalPlay;
  label: string;
  /** 担当者向けの指針（1〜2文） */
  guidance: string;
  /** 判定理由 */
  reasons: string[];
}

/**
 * 提案準備度 × 外部機会の有無から、提案の型を決める（§15.2）。
 *
 * ガードレール: 更新が **91〜31日前**（`31-90`）で準備度が high でない場合は、
 * 外部機会があっても rebuild（更新確保優先）にする。
 * ここが解約判断が実際に行われる期間であり、足元が固まっていない状態で
 * 新提案を持ち込むと機会そのものを焼く。
 *
 * 満了30日以内（`0-30`）は解約できない運用ルールのためガードレールを掛けない。
 * 更新はほぼ確定しており、むしろ次期に向けた提案を仕込む時期になる。
 */
export function decideProposalPlay(
  readiness: ProposalReadinessVM,
  hasExternalOpportunity: boolean,
  renewalBucket?: RenewalBucket | null,
): ProposalPlayResult {
  const reasons: string[] = [];
  const level = readiness.overall;

  if (level === 'unknown') {
    return {
      play:  'unknown',
      label: '判定不能',
      guidance: '準備度を算出できるデータが揃っていません。まず利用実態・接点記録の取得を確認してください。',
      reasons: [`算出できなかった要素: ${readiness.missing.join(', ') || 'なし'}`],
    };
  }

  reasons.push(`準備度 ${level}（${readiness.overallScore}）`);
  reasons.push(hasExternalOpportunity ? '外部機会 あり' : '外部機会 なし');
  for (const c of readiness.caps) reasons.push(c);

  // ── ガードレール: 解約判断期（満了 91〜31日前）──────────────────────────
  if (renewalBucket === '31-90' && level !== 'high') {
    reasons.push('更新91〜31日前（解約判断期）かつ 準備度が high でない');
    return {
      play:  'rebuild',
      label: '立て直し（更新確保を優先）',
      guidance: '解約判断が行われる時期に入っており、足元が固まっていません。新提案は持ち込まず、契約の継続と摩擦の解消に集中してください。外部機会は更新が固まってから使います。',
      reasons,
    };
  }

  if (hasExternalOpportunity) {
    if (level === 'high') {
      return {
        play:  'expand',
        label: '拡張提案',
        guidance: '足元が固まっており外部機会もあります。機会の文脈に沿った新しい価値を提案できます。',
        reasons,
      };
    }
    return {
      play:  'connect',
      label: '接続提案（新規購入を求めない）',
      guidance: '外部機会はありますが足元が固まっていません。新規購入を求めず、「新しい投資が決まった今こそ、既に導入済みのものを成果に変える」文脈に接続してください。',
      reasons,
    };
  }

  if (level === 'high' || level === 'medium') {
    return {
      play:  'deepen',
      label: '深化',
      guidance: '外部機会は観測されていません。現在の活用を深掘りし、成果の再現性を作る局面です。',
      reasons,
    };
  }

  return {
    play:  'rebuild',
    label: '立て直し',
    guidance: '提案の局面ではありません。利用の停滞と未解決の摩擦を解消し、足元を戻すことに集中してください。',
    reasons,
  };
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toLevel(score: number): ReadinessLevel {
  const { high, medium } = READINESS_THRESHOLD.level;
  if (score >= high)   return 'high';
  if (score >= medium) return 'medium';
  return 'low';
}

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(String(dateStr).trim().replace(' ', 'T'));
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

/** PV 実績 / PV 上限。どちらか欠けていれば null */
function pvUsageRatio(signal: ProjectSignalData): number | null {
  const ceiling = signal.pvCeiling;
  const count   = signal.monthPvCount;
  if (!ceiling || ceiling <= 0 || count === null || count === undefined) return null;
  return count / ceiling;
}

/**
 * 増減率を返す。(now - ago) / ago
 * ago が 0 の場合は比率が定義できないため、now > 0 なら +1（増加）、now === 0 なら 0 とする。
 */
function trendRatio(ago: number | null | undefined, now: number | null | undefined): number | null {
  if (ago === null || ago === undefined || now === null || now === undefined) return null;
  if (ago === 0) return now > 0 ? 1 : 0;
  return (now - ago) / ago;
}

/** 増減率を配点に変換する（増加=満点、-30%超の減少=ほぼ0） */
function trendPoints(ratio: number, max: number): number {
  const rate =
    ratio >   0.10 ? 1.00 :   // 増加
    ratio >= -0.10 ? 0.76 :   // 横ばい
    ratio >= -0.30 ? 0.40 :   // 減少
                     0.10;    // 大幅減
  return Math.round(max * rate);
}

function signedPct(ratio: number): string {
  const pct = Math.round(ratio * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

/**
 * ブロッカー（赤いチップ）の一覧。**画面の凡例に出す文言の正本。**
 *
 * 提案準備ボードの `buildBlockers()`（api/companies/proposal-board/route.ts）の条件と
 * 1対1で対応させること。
 * ここと実装がずれると、凡例が嘘になる。
 */
export const BLOCKER_META: Array<{ label: string; when: string; why: string }> = [
  { label: '更新判断期（91〜31日前）',
    when: '契約満了の91〜31日前',
    why:  '解約判断が行われる期間。新提案より契約の継続確保を優先する' },
  { label: '更新期限切れ',
    when: '契約満了日を過ぎている',
    why:  '更新状況の確認が先。提案の前提が成立していない可能性がある' },
  { label: '未解決サポート N件',
    when: '直近90日のオープンサポートが6件以上',
    why:  '未解決の摩擦がある状態で新提案を出すと不誠実に映る' },
  { label: '習慣化なし',
    when: '有料プロジェクトがどれも習慣化に到達していない',
    why:  '運用が定着していない。人ではなく仕組みの問題を先に解く' },
  { label: '稼働施策 N本',
    when: '目標付きの稼働キャンペーンが2本以下',
    why:  '施策が回っていない。提案しても実行されにくい' },
  { label: '放置運用（30日 公開0本 / 最終 N日前）',
    when: '稼働中の施策はあるが、30日間に新規作成も公開もない',
    why:  '過去の施策が動き続けているだけ。**施策本数だけ見ると健全に見える**ので見落としやすい。次の打ち手を一緒に決める' },
  { label: '作成N本・公開0本',
    when: '30日で施策を作っているのに1本も公開されていない',
    why:  '制作から公開までのどこかで詰まっている。介入すれば動き出す' },
  { label: 'ゴール未設定 N本',
    when: '配信中の施策にゴールが設定されていない',
    why:  '効果を測れないまま配信している。最も分かりやすい介入理由' },
  { label: '分析 NPV/30日',
    when: '過去30日の分析・検証PVが5未満（管理画面の実測）',
    why:  '事実を見る習慣が無い。データに基づく提案が刺さりにくい' },
  { label: 'PV着地見込 N%',
    when: 'PV集計期間が25%以上経過し、期末の着地予測が契約枠の40%未満',
    why:  '契約に対して価値が出ていない。増額提案の前に消化を上げる。'
        + 'PV枠は契約更新日の応当日でリセットされるため、期間が始まったばかりのときは判定しない' },
  { label: '施策が減少（実行 N）',
    when: '実行体制のスコアが30未満（30日前と比べて施策・活動が落ちている）',
    why:  '手を動かす人が減っている。実行負荷の小さい打ち手が要る' },
  { label: '接点が途絶（関係 N）',
    when: '関係の温度のスコアが30未満（最終接点が遠く、直近90日の接点も少ない）',
    why:  '打診自体が届かない。提案の前に関係を戻す' },
];

/**
 * 4要素のスコアが高いのにフラグが出ることの説明。凡例に出す。
 *
 * スコアは重み付き平均、フラグは個別条件なので、両立する。
 * これを書いておかないと「矛盾している」と読まれて、どちらも信用されなくなる。
 */
export const BLOCKER_VS_SCORE_NOTE = [
  '準備度は4要素の重み付き平均です。フラグは「その条件に当てはまったか」なので、平均が高くてもフラグは出ます。',
  '例: PV消化が38%でも、稼働施策・分析・習慣化・活動の鮮度が高ければ利用の充足は90台になります（PV消化の減点は最大12点のため）。',
  'フラグはスコアの内訳ではなく、**提案の前に片付けるべきこと**として読んでください。',
] as const;

/**
 * カードに出る利用実態の数字（施策 / 分析 / PV）の定義。**画面に出す文言の正本。**
 *
 * 略記だけを並べると何の数字か分からない。出所（どのデータのどの列か）まで持たせ、
 * 裏を取れるようにする。
 */
export const USAGE_METRIC_META: Array<{
  key: 'campaigns' | 'heatmaps' | 'pvRate' | 'habituation';
  short: string;
  label: string;
  meaning: string;
  source: string;
  /** 読み違えやすい点。無ければ null */
  caveat: string | null;
}> = [
  {
    key: 'campaigns', short: '施策', label: '実行中キャンペーン数（目標付き）',
    meaning: 'Ptengine Experience で今動いている施策の本数。目標が設定されているものだけを数えます',
    source: 'Metabase project-signals の `Running Campaign With Goal Count`',
    caveat: '目標未設定の施策は数えません（効果を測っていない施策は「回っている」と見なさない）',
  },
  {
    key: 'heatmaps', short: '分析', label: '30日の分析・検証PV',
    meaning: '過去30日に管理画面の「分析利用」「施策検証」の画面を開いたPV。'
           + '事実を見て成果を確かめているかの深さです',
    source: 'Metabase project-modules（URLモジュール別PV / 直近30日）',
    caveat: '**着地画面（プロジェクトホーム／データセンター）は含みません。**'
          + '数えると全員が「使っている」になるためです。'
          + 'ヒートマップの閲覧そのものは顧客ドメインへ遷移するため計測外で、リスト到達までしか分かりません',
  },
  {
    key: 'pvRate', short: 'PV', label: 'PV 着地見込み',
    meaning: '期末の着地予測PV ÷ 契約PV上限。契約した枠を使い切れそうかを見ます',
    source: 'Metabase project-signals の `Month Period Pv Forecast` ÷ `Pv Ceiling`',
    caveat: '**PV枠は暦月ではなく契約更新日の応当日でリセットされます**（例: 更新日が17日なら毎月17日）。'
          + '期間の経過が25%未満のときは着地が読めないため判定しません。'
          + '低い＝契約に対して価値が出ていない。高すぎる場合は計測停止リスク（上限超過）',
  },
  {
    key: 'habituation', short: '習慣化', label: '習慣化ステータス',
    meaning: '継続的に使われている状態かどうかの判定。Ptengine 側で付与されます',
    source: 'Metabase project-signals の `Habituation Status`',
    caveat: '企業内に有料PJが複数ある場合、1つでも習慣化していれば「あり」として扱います',
  },
];

// ── PV 消化の判定 ─────────────────────────────────────────────────────────────
//
// **PV枠は暦月ではなく、契約更新日の応当日でリセットされる。**
// 例: 更新日が17日なら毎月17日に0へ戻る（実測: 2026-08-18〜09-17 の期間を持つPJがある）。
//
// そのため「消化率が低い」を経過日数抜きで判定してはいけない。
// 実測（2026-08-22 / アットホーム）: 期間開始から5日目で消化2%。
// 一律40%未満で赤フラグを立てると、始まったばかりの顧客に警告が出る。
//
// 使うのは **着地予測**（`Month Period Pv Forecast`）。BI 側で期間正規化済み。
// アットホームの場合、実績2%に対して予測は12.2%。

/** 判定に必要な最低経過率。これ未満は予測が不安定なので判定しない */
export const PV_MIN_ELAPSED = 0.25;
/** 着地予測が契約枠のこの割合を下回ると「オーバースペック」 */
export const PV_UNDERUSE_RATE = 0.40;

export interface PvPeriodStatus {
  /** 判定できるか。false = 期間や上限が取れていない、または経過が浅い */
  evaluable: boolean;
  /** 期間の経過率 0-1。null = 期間不明 */
  elapsed:   number | null;
  periodStart: string | null;
  periodEnd:   string | null;
  /** 現時点の消化率（%）。null = 上限不明 */
  actualRate:   number | null;
  /** 期末の着地予測消化率（%）。null = 予測なし */
  forecastRate: number | null;
  /** 予測が契約枠を大きく下回る＝オーバースペック */
  underused: boolean;
  /** 判定できない理由。UI に出す */
  note: string;
}

export function pvPeriodStatus(input: {
  pvCeiling:    number | null;
  monthPvCount: number | null;
  monthPvForecast?: number | null;
  monthPeriodStartTime?: string | null;
  monthPeriodEndTime?:   string | null;
}): PvPeriodStatus {
  const ceiling = input.pvCeiling;
  const elapsed = periodElapsed(input.monthPeriodStartTime ?? null, input.monthPeriodEndTime ?? null);
  const actualRate = ceiling && ceiling > 0 && input.monthPvCount !== null
    ? Math.round((input.monthPvCount / ceiling) * 100) : null;
  const forecastRate = ceiling && ceiling > 0 && (input.monthPvForecast ?? null) !== null
    ? Math.round((input.monthPvForecast! / ceiling) * 100) : null;

  const base = { elapsed, periodStart: input.monthPeriodStartTime ?? null,
                 periodEnd: input.monthPeriodEndTime ?? null, actualRate, forecastRate };

  if (!ceiling || ceiling <= 0) {
    return { ...base, evaluable: false, underused: false, note: '契約PV上限が未設定のため判定していません' };
  }
  if (elapsed === null) {
    return { ...base, evaluable: false, underused: false, note: 'PV集計期間が取得できていないため判定していません' };
  }
  if (elapsed < PV_MIN_ELAPSED) {
    const d = Math.round(elapsed * 100);
    return {
      ...base, evaluable: false, underused: false,
      note: `PV集計期間が始まったばかりです（経過${d}%）。着地が読めないため判定していません`,
    };
  }
  const rate = forecastRate ?? actualRate;
  if (rate === null) {
    return { ...base, evaluable: false, underused: false, note: 'PV実績が取得できていないため判定していません' };
  }
  return {
    ...base, evaluable: true,
    underused: rate < PV_UNDERUSE_RATE * 100,
    note: forecastRate !== null
      ? `期末の着地予測 ${forecastRate}%（現時点 ${actualRate ?? '—'}% / 期間経過 ${Math.round(elapsed * 100)}%）`
      : `現時点 ${actualRate}%（期間経過 ${Math.round(elapsed * 100)}%・着地予測なし）`,
  };
}

/** 期間の経過率 0-1。期間が取れないときは null */
export function periodElapsed(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(`${start}T00:00:00`).getTime();
  const e = new Date(`${end}T23:59:59`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
  const now = Date.now();
  if (now <= s) return 0;
  if (now >= e) return 1;
  return (now - s) / (e - s);
}
