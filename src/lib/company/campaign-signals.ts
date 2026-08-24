// ─── 施策データからの判定 ────────────────────────────────────────────────────
//
// 「稼働施策 N本」は在庫数で、時間の概念がない。
// 実測（2026-08-22 / 有料PJ）: 稼働5本以上なのに30日間1本も公開していないPJが48件。
// 最終公開が2023年のものまで「施策7本」と表示されていた。
//
// 直近30日のパターン（有料PJ 579件）:
//   停止 193 / 健全に回っている 188 / **放置運用 178** / 作っているが公開できていない 20
//   放置運用（過去の施策が動き続けているだけ）は、施策数だけ見ると健全に見える。
//
// 副作用なし。サーバー・クライアント両対応。

import type { CampaignSummary } from '@/lib/metabase/project-campaigns';

export type CampaignActivity =
  | 'unknown'    // 施策データが無い
  | 'stopped'    // 30日 作成も公開もなし、稼働中もゼロ
  | 'idle_run'   // 放置運用: 30日 作成も公開もないが、過去の施策が動き続けている
  | 'stuck'      // 作っているが公開できていない
  | 'active';    // 健全に回っている

export interface CampaignSignalVM {
  activity: CampaignActivity;
  /** 稼働中（在庫） */
  running:  number;
  /** 直近30日に公開した数。**在庫と必ず併記する** */
  ran30d:   number;
  created30d: number;
  lastRunAt: string | null;
  /** 最終公開からの経過日数。null = 公開履歴なし */
  daysSinceLastRun: number | null;

  /** 配信中なのにゴール未設定。最も分かりやすい介入理由 */
  runningWithoutGoal: number;
  publishRate:  number | null;
  untitledRate: number | null;
  abTestRate:   number | null;

  reasons: string[];
  /** 提案の入口になる観察 */
  opportunities: string[];
}

export const EMPTY_CAMPAIGN_SIGNAL: CampaignSignalVM = {
  activity: 'unknown', running: 0, ran30d: 0, created30d: 0,
  lastRunAt: null, daysSinceLastRun: null, runningWithoutGoal: 0,
  publishRate: null, untitledRate: null, abTestRate: null,
  reasons: ['施策データが取得できていません'],
  opportunities: [],
};

/** 公開率がこれ未満なら「作るが出せていない」 */
const LOW_PUBLISH_RATE = 0.30;
/** 無題率がこれを超えたら場当たり的な運用 */
const HIGH_UNTITLED_RATE = 0.50;

export function buildCampaignSignal(s: CampaignSummary | null): CampaignSignalVM {
  if (!s) return EMPTY_CAMPAIGN_SIGNAL;

  const days = daysSince(s.lastRunAt);
  const reasons: string[] = [];
  const opportunities: string[] = [];

  let activity: CampaignActivity;
  if (s.created30d > 0 && s.ran30d > 0) {
    activity = 'active';
    reasons.push(`30日で ${s.created30d}本作成・${s.ran30d}本公開`);
  } else if (s.created30d > 0 && s.ran30d === 0) {
    activity = 'stuck';
    reasons.push(`30日で ${s.created30d}本作ったが、1本も公開されていません`);
    opportunities.push('作った施策が公開まで進んでいません。詰まっている理由を確認する余地があります');
  } else if (s.runningCount > 0) {
    activity = 'idle_run';
    reasons.push(
      `稼働中 ${s.runningCount}本ありますが、30日間の新規作成・公開はゼロです`
      + (days !== null ? `（最終公開 ${days}日前）` : ''),
    );
    opportunities.push('過去の施策が動き続けているだけの状態です。次の打ち手を一緒に決める余地があります');
  } else {
    activity = 'stopped';
    reasons.push(days !== null ? `施策が止まっています（最終公開 ${days}日前）` : '公開された施策がありません');
  }

  // ── 介入理由 ────────────────────────────────────────────────────────────
  if (s.runningWithoutGoal > 0) {
    reasons.push(`配信中 ${s.runningWithoutGoal}本がゴール未設定（効果を測れていません）`);
    opportunities.push(`ゴール未設定の配信が${s.runningWithoutGoal}本。成果を測れる状態にする提案ができます`);
  }
  if (s.totalCampaigns >= 5 && s.publishRate < LOW_PUBLISH_RATE) {
    reasons.push(`公開率 ${Math.round(s.publishRate * 100)}%（${s.totalCampaigns}本中 ${s.everRanCount}本のみ公開）`);
    opportunities.push('作った施策の多くが公開されていません。制作から公開までの詰まりを解く余地があります');
  }
  if (s.totalCampaigns >= 5 && s.untitledRate > HIGH_UNTITLED_RATE) {
    reasons.push(`無題の施策が ${Math.round(s.untitledRate * 100)}%（命名が整っていない＝場当たり的な運用）`);
  }
  if (s.abTestCount > 0) {
    reasons.push(`A/Bテスト ${s.abTestCount}本（全体の${Math.round(s.abTestRate * 100)}%）`);
  }

  return {
    activity,
    running: s.runningCount,
    ran30d:  s.ran30d,
    created30d: s.created30d,
    lastRunAt: s.lastRunAt,
    daysSinceLastRun: days,
    runningWithoutGoal: s.runningWithoutGoal,
    publishRate:  s.totalCampaigns > 0 ? s.publishRate : null,
    untitledRate: s.totalCampaigns > 0 ? s.untitledRate : null,
    abTestRate:   s.totalCampaigns > 0 ? s.abTestRate : null,
    reasons, opportunities,
  };
}

/** 企業単位に合算する。1つでも動いていれば停止扱いにしない */
export function aggregateCampaignSignals(list: Array<CampaignSummary | null>): CampaignSignalVM {
  const items = list.filter((s): s is CampaignSummary => Boolean(s));
  if (items.length === 0) return EMPTY_CAMPAIGN_SIGNAL;

  const sum = (f: (s: CampaignSummary) => number) => items.reduce((n, s) => n + f(s), 0);
  const total = sum(s => s.totalCampaigns);
  const everRan = sum(s => s.everRanCount);
  const running = sum(s => s.runningCount);
  const lastRunAt = items
    .map(s => s.lastRunAt)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1) ?? null;

  const merged: CampaignSummary = {
    ...items[0],
    projectId: `${items.length}件のプロジェクト合算`,
    totalCampaigns: total,
    runningCount: running,
    everRanCount: everRan,
    runningWithoutGoal: sum(s => s.runningWithoutGoal),
    untitledCount: sum(s => s.untitledCount),
    abTestCount:   sum(s => s.abTestCount),
    created30d: sum(s => s.created30d),
    ran30d:     sum(s => s.ran30d),
    created90d: sum(s => s.created90d),
    ran90d:     sum(s => s.ran90d),
    lastRunAt,
    publishRate:  everRan / Math.max(total, 1),
    untitledRate: sum(s => s.untitledCount) / Math.max(total, 1),
    abTestRate:   sum(s => s.abTestCount)   / Math.max(total, 1),
    noGoalRate:   running > 0 ? sum(s => s.runningWithoutGoal) / running : null,
  };
  return buildCampaignSignal(merged);
}

export const ACTIVITY_META: Record<CampaignActivity, { label: string; tone: 'red' | 'amber' | 'slate' | 'green'; hint: string }> = {
  unknown:  { label: '不明', tone: 'slate',
    hint: '施策データが取得できていないプロジェクトです' },
  stopped:  { label: '停止', tone: 'red',
    hint: '30日間の作成・公開がなく、稼働中の施策もありません' },
  idle_run: { label: '放置運用', tone: 'amber',
    hint: '過去の施策が動き続けているだけで、30日間の新規作成・公開はありません。施策数だけ見ると健全に見えるので注意' },
  stuck:    { label: '公開できていない', tone: 'amber',
    hint: '30日で施策を作っているのに、1本も公開されていません。制作から公開までのどこかで詰まっています' },
  active:   { label: '回っている', tone: 'green',
    hint: '30日で作成・公開の両方があります' },
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

/**
 * 判定済みの CampaignSignalVM を企業単位に畳む。
 *
 * `aggregateCampaignSignals` は生のサマリから計算するが、こちらは
 * **事前計算済みの結論を合成する**（CSV を引かないための経路）。
 * 1つでも回っていれば停止扱いにしない。
 */
export function mergeCampaignSignals(list: Array<CampaignSignalVM | null>): CampaignSignalVM {
  const items = list.filter((v): v is CampaignSignalVM => Boolean(v) && v!.activity !== 'unknown');
  if (items.length === 0) return EMPTY_CAMPAIGN_SIGNAL;
  if (items.length === 1) return items[0];

  const sum = (f: (v: CampaignSignalVM) => number) => items.reduce((n, v) => n + f(v), 0);
  const created30d = sum(v => v.created30d);
  const ran30d     = sum(v => v.ran30d);
  const running    = sum(v => v.running);
  const days = items
    .map(v => v.daysSinceLastRun)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b)[0] ?? null;

  let activity: CampaignActivity;
  if (created30d > 0 && ran30d > 0) activity = 'active';
  else if (created30d > 0)          activity = 'stuck';
  else if (running > 0)             activity = 'idle_run';
  else                              activity = 'stopped';

  const rates = items.map(v => v.publishRate).filter((v): v is number => v !== null);

  return {
    activity, running, ran30d, created30d,
    lastRunAt: null,
    daysSinceLastRun: days,
    runningWithoutGoal: sum(v => v.runningWithoutGoal),
    publishRate:  rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null,
    untitledRate: null,
    abTestRate:   null,
    reasons:       items.find(v => v.activity === activity)?.reasons ?? [],
    opportunities: [...new Set(items.flatMap(v => v.opportunities))],
  };
}
