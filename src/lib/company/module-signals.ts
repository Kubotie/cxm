// ─── モジュール利用からの判定（契約 × 実利用）─────────────────────────────
//
// 「契約しているのに使われていない」を実測で出す。
// これまで `O4_Opp_FeatureReady_NotUsed` は語彙だけあって判定できていなかった。
//
// 実測（2026-08-22 / project-signals と結合できた1,245PJ）:
//   BUNDLE-PAID なのに Experience 未使用      40 PJ
//   PTI-PAID なのに 何も使っていない          49 PJ
//   BUNDLE-PAID なのに 何も使っていない       19 PJ
//
// ⚠️ 判定の前提:
//   - 「使っている」に回遊（着地画面）を含めない。含めると全員が使っている扱いになる
//   - モジュールデータが無いプロジェクトは **未評価**。「使っていない」と断定しない
//     （CSVは1,719PJ分しか無く、アプリ側の全PJを網羅していない）
//
// 副作用なし。サーバー・クライアント両対応。

import type { ProjectModuleData } from '@/lib/metabase/project-modules';

/** 契約プラン（project-signals の Paid Type） */
export type PlanKind = 'PTI' | 'PTX' | 'BUNDLE' | 'FREE' | 'TRIAL' | 'UNKNOWN';

export function normalizePlan(paidType: string | null | undefined): PlanKind {
  const v = (paidType ?? '').toUpperCase();
  if (v.startsWith('BUNDLE')) return v.includes('TRIAL') ? 'TRIAL' : 'BUNDLE';
  if (v.startsWith('PTI'))    return v.includes('TRIAL') ? 'TRIAL' : 'PTI';
  if (v.startsWith('PTX'))    return v.includes('TRIAL') ? 'TRIAL' : 'PTX';
  if (v === 'FREE')           return 'FREE';
  if (!v)                     return 'UNKNOWN';
  return 'UNKNOWN';
}

/** そのプランで使えるはずの製品 */
export function entitledProducts(plan: PlanKind): string[] {
  switch (plan) {
    case 'BUNDLE': return ['Insight', 'Experience'];
    case 'PTI':    return ['Insight'];
    case 'PTX':    return ['Experience'];
    default:       return [];
  }
}

export type ModuleVerdict =
  | 'dormant'       // 管理画面に来ていない かつ 計測イベントも止まっている
  | 'unevaluated'   // 管理画面データが無いが計測は動いている。判断できない
  | 'unused'        // 着地画面までで止まっている
  | 'partial'       // 契約製品の一部しか使っていない
  | 'shallow'       // 使っているが浅い（分析・検証に届いていない）
  | 'healthy';      // 契約製品を使い、深さもある

export interface ModuleSignalVM {
  verdict: ModuleVerdict;
  plan:    PlanKind;
  /** 契約している製品 */
  entitled: string[];
  /** 実際に使っている製品（回遊を除く） */
  used:     string[];
  /** 契約しているのに使っていない製品。**ここが提案の入口** */
  unusedEntitled: string[];
  activePv:  number;
  deepPv:    number;
  activeModuleCount: number;
  runsAbTest: boolean;
  reachedHeatmapList: boolean;
  legacyLp: boolean;
  /** 判定の言葉での説明。UI にそのまま出す */
  reasons: string[];
  /** 提案に使える機会。空なら無し */
  opportunities: string[];
}

export const EMPTY_MODULE_SIGNAL: ModuleSignalVM = {
  verdict: 'unevaluated', plan: 'UNKNOWN', entitled: [], used: [], unusedEntitled: [],
  activePv: 0, deepPv: 0, activeModuleCount: 0,
  runsAbTest: false, reachedHeatmapList: false, legacyLp: false,
  reasons: ['モジュール利用データが取得できていません（使っていないという意味ではありません）'],
  opportunities: [],
};

/** 深い利用（分析・検証）とみなす最低PV。1〜2回の偶発的な閲覧を除く */
const DEEP_PV_MIN = 5;

export function buildModuleSignal(input: {
  paidType: string | null;
  data:     ProjectModuleData | null;
  /**
   * 過去30日のアクティブイベント数（project-signals の `L30 Active`）。
   * **モジュールデータが無いときの解釈に必須。**
   * 実測（2026-08-22）: モジュールCSVに行が無い有料PJ695件は
   * **全件 L30 Active = 0**、最終活動日の中央値が7か月前だった。
   * CSVは PV>0 の行しか持たない（最小値1）ので、行が無い＝管理画面に来ていない。
   * これを「未評価」で流すと、最も危険な状態を見逃す。
   */
  l30Active?: number | null;
}): ModuleSignalVM {
  const plan = normalizePlan(input.paidType);
  const entitled = entitledProducts(plan);

  if (!input.data) {
    const l30 = input.l30Active;
    if (l30 === 0) {
      return {
        ...EMPTY_MODULE_SIGNAL, plan, entitled,
        verdict: 'dormant',
        reasons: [
          '30日間、管理画面へのアクセスがありません',
          '同期間の計測イベントも0件です（タグ停止・サイト閉鎖の可能性もあります）',
        ],
        opportunities: [],
      };
    }
    return {
      ...EMPTY_MODULE_SIGNAL, plan, entitled,
      reasons: l30 == null
        ? ['モジュール利用データが取得できていません（使っていないという意味ではありません）']
        : [`管理画面の利用データがありませんが、計測イベントは30日で${l30.toLocaleString('ja-JP')}件あります。状況の確認が必要です`],
    };
  }

  const d = input.data;
  // 回遊を除いた実利用のある製品
  const used = Object.entries(d.pvByProduct)
    .filter(([product, pv]) => pv > 0 && product !== '共通')
    .map(([product]) => product);

  const usedActive = new Set<string>();
  for (const m of d.modules) {
    if (m.pageviews <= 0) continue;
    if (m.def.signalType === '回遊' || m.def.signalType === '未分類') continue;
    if (m.def.product === '共通') continue;
    usedActive.add(m.def.product);
  }

  const unusedEntitled = entitled.filter(p => !usedActive.has(p));
  const reasons: string[] = [];
  const opportunities: string[] = [];

  let verdict: ModuleVerdict;
  if (d.navigationOnly || d.activePv === 0) {
    verdict = 'unused';
    reasons.push('30日間、着地画面より先に進んでいません（ログインはしているが機能を触っていない）');
  } else if (unusedEntitled.length > 0) {
    verdict = 'partial';
    reasons.push(`契約している ${unusedEntitled.join('・')} を30日間使っていません`);
  } else if (d.deepPv < DEEP_PV_MIN) {
    verdict = 'shallow';
    reasons.push('施策や設定は触っていますが、分析・成果検証まで進んでいません');
  } else {
    verdict = 'healthy';
    reasons.push(`実利用 ${d.activePv.toLocaleString('ja-JP')}PV / ${d.activeModuleCount}機能。分析・検証まで到達しています`);
  }

  // ── 提案の入口 ──────────────────────────────────────────────────────────
  for (const p of unusedEntitled) {
    opportunities.push(`${p} は契約済みで未使用。追加購入なしで価値を出せます`);
  }
  if (d.runsAbTest) {
    reasons.push('A/Bテストを実際に運用しています');
  } else if (usedActive.has('Experience')) {
    opportunities.push('Experience を使っていますが A/Bテストは未運用。検証量を増やす余地があります');
  }
  if (!d.reachedHeatmapList && usedActive.has('Insight')) {
    opportunities.push('Insight を使っていますがヒートマップに到達していません');
  }
  if (d.viewedPlanAsPaid) {
    reasons.push('有料ユーザーがプランページを閲覧しています（増減どちらの検討かは不明）');
  }
  if (d.legacyLp) {
    reasons.push('提供終了プロダクト（旧 Page Studio）の特例提供先です');
  }

  return {
    verdict, plan, entitled, used,
    unusedEntitled,
    activePv: d.activePv,
    deepPv:   d.deepPv,
    activeModuleCount: d.activeModuleCount,
    runsAbTest: d.runsAbTest,
    reachedHeatmapList: d.reachedHeatmapList,
    legacyLp: d.legacyLp,
    reasons,
    opportunities,
  };
}

export const VERDICT_META: Record<ModuleVerdict, { label: string; tone: 'red' | 'amber' | 'slate' | 'green'; hint: string }> = {
  dormant:     { label: '休眠', tone: 'red',
    hint: '30日間、管理画面へのアクセスも計測イベントもありません。提案より前に、使われる状態に戻すか契約の実態を確認する必要があります' },
  unevaluated: { label: '未評価', tone: 'slate',
    hint: '管理画面の利用データがありません。計測は動いているので、使っていないとは断定できません' },
  unused:      { label: '未使用', tone: 'red',
    hint: '30日間、着地画面より先に進んでいません。提案の前に使われる状態に戻す必要があります' },
  partial:     { label: '一部未使用', tone: 'amber',
    hint: '契約している製品の一部を使っていません。追加購入なしで価値を出せる余地があります' },
  shallow:     { label: '浅い利用', tone: 'amber',
    hint: '施策や設定は触っていますが、分析・成果検証まで進んでいません' },
  healthy:     { label: '活用中', tone: 'green',
    hint: '契約製品を使い、分析・検証まで到達しています' },
};

// ── 企業単位の合算 ────────────────────────────────────────────────────────────

/**
 * 有料プロジェクトのモジュール利用を企業単位に合算する。
 *
 * **判定は「最悪」でも「最良」でもない。**
 *   - 1つでも実利用があれば dormant にしない（子PJが1つ休眠でも企業は動いている）
 *   - 契約している製品が1つでも未使用なら partial（提案の入口を潰さない）
 * 会社の中で状態が割れるのは普通なので、内訳は個社ページで見る前提。
 *
 * データが1件も取れないときは unevaluated / dormant を L30 の合計で決める。
 */
export function aggregateModuleSignals(
  items: Array<{ paidType: string | null; data: ProjectModuleData | null; l30Active: number | null }>,
): ModuleSignalVM {
  if (items.length === 0) return EMPTY_MODULE_SIGNAL;

  const each = items.map(i => buildModuleSignal(i));
  const withData = items.filter(i => i.data);

  const entitled = [...new Set(each.flatMap(v => v.entitled))];
  const usedActive = new Set<string>();
  for (const i of withData) {
    for (const m of i.data!.modules) {
      if (m.pageviews <= 0) continue;
      if (m.def.signalType === '回遊' || m.def.signalType === '未分類') continue;
      if (m.def.product === '共通') continue;
      usedActive.add(m.def.product);
    }
  }

  const activePv = withData.reduce((n, i) => n + i.data!.activePv, 0);
  const deepPv   = withData.reduce((n, i) => n + i.data!.deepPv, 0);
  const activeModuleCount = new Set(
    withData.flatMap(i => i.data!.modules
      .filter(m => m.pageviews > 0 && ACTIVE_TYPES.has(m.def.signalType))
      .map(m => m.moduleId)),
  ).size;

  const unusedEntitled = entitled.filter(p => !usedActive.has(p));
  const plan: PlanKind = each.find(v => v.plan !== 'UNKNOWN')?.plan ?? 'UNKNOWN';
  const reasons: string[] = [];
  const opportunities: string[] = [];

  let verdict: ModuleVerdict;
  if (withData.length === 0) {
    const totalL30 = items.reduce((n, i) => n + (i.l30Active ?? 0), 0);
    verdict = totalL30 === 0 ? 'dormant' : 'unevaluated';
    reasons.push(totalL30 === 0
      ? `有料プロジェクト${items.length}件すべてで30日間、管理画面アクセスも計測イベントもありません`
      : '管理画面の利用データがありません（計測イベントは動いています）');
  } else if (activePv === 0) {
    verdict = 'unused';
    reasons.push('30日間、着地画面より先に進んでいません');
  } else if (unusedEntitled.length > 0) {
    verdict = 'partial';
    reasons.push(`契約している ${unusedEntitled.join('・')} を30日間使っていません`);
  } else if (deepPv < DEEP_PV_MIN) {
    verdict = 'shallow';
    reasons.push('施策や設定は触っていますが、分析・成果検証まで進んでいません');
  } else {
    verdict = 'healthy';
    reasons.push(`実利用 ${activePv.toLocaleString('ja-JP')}PV / ${activeModuleCount}機能`);
  }

  const dormantCount = each.filter(v => v.verdict === 'dormant').length;
  if (dormantCount > 0 && verdict !== 'dormant') {
    reasons.push(`有料プロジェクト${items.length}件のうち${dormantCount}件は30日間アクセスなし`);
  }

  for (const p of unusedEntitled) {
    opportunities.push(`${p} は契約済みで未使用。追加購入なしで価値を出せます`);
  }

  const runsAbTest = withData.some(i => i.data!.runsAbTest);
  if (!runsAbTest && usedActive.has('Experience')) {
    opportunities.push('Experience を使っていますが A/Bテストは未運用です');
  }

  return {
    verdict, plan, entitled, used: [...usedActive], unusedEntitled,
    activePv, deepPv, activeModuleCount,
    runsAbTest,
    reachedHeatmapList: withData.some(i => i.data!.reachedHeatmapList),
    legacyLp:           withData.some(i => i.data!.legacyLp),
    reasons, opportunities,
  };
}

const ACTIVE_TYPES = new Set(['分析利用', '施策構築', '施策検証', '初期設定']);

/**
 * 判定済みの ModuleSignalVM を企業単位に畳む。
 *
 * `aggregateModuleSignals` は生データから計算するが、こちらは
 * **事前計算済みの結論を合成する**（CSV を引かないための経路）。
 *
 * 判定は「最悪」でも「最良」でもない:
 *   1つでも実利用があれば dormant にしない。契約製品が1つでも未使用なら partial。
 */
export function mergeModuleVerdicts(list: Array<ModuleSignalVM | null>): ModuleSignalVM {
  const items = list.filter((v): v is ModuleSignalVM => Boolean(v));
  if (items.length === 0) return EMPTY_MODULE_SIGNAL;
  if (items.length === 1) return items[0];

  const entitled = [...new Set(items.flatMap(v => v.entitled))];
  const used     = [...new Set(items.flatMap(v => v.used))];
  const unusedEntitled = entitled.filter(p => !used.includes(p));

  const activePv = items.reduce((n, v) => n + v.activePv, 0);
  const deepPv   = items.reduce((n, v) => n + v.deepPv, 0);
  const evaluated = items.filter(v => v.verdict !== 'unevaluated');

  let verdict: ModuleVerdict;
  if (evaluated.length === 0) verdict = 'unevaluated';
  else if (evaluated.every(v => v.verdict === 'dormant')) verdict = 'dormant';
  else if (activePv === 0) verdict = 'unused';
  else if (unusedEntitled.length > 0) verdict = 'partial';
  else if (deepPv < DEEP_PV_MIN) verdict = 'shallow';
  else verdict = 'healthy';

  const dormant = items.filter(v => v.verdict === 'dormant').length;
  const reasons = [...items.find(v => v.verdict === verdict)?.reasons ?? []];
  if (dormant > 0 && verdict !== 'dormant') {
    reasons.push(`有料プロジェクト${items.length}件のうち${dormant}件は30日間アクセスなし`);
  }

  return {
    verdict,
    plan: items.find(v => v.plan !== 'UNKNOWN')?.plan ?? 'UNKNOWN',
    entitled, used, unusedEntitled,
    activePv, deepPv,
    activeModuleCount: items.reduce((n, v) => n + v.activeModuleCount, 0),
    runsAbTest:         items.some(v => v.runsAbTest),
    reachedHeatmapList: items.some(v => v.reachedHeatmapList),
    legacyLp:           items.some(v => v.legacyLp),
    reasons,
    opportunities: [...new Set(items.flatMap(v => v.opportunities))],
  };
}
