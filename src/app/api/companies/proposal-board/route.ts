// ─── GET /api/companies/proposal-board ────────────────────────────────────────
//
// Tier 1 / 2 / 3 の担当顧客を「今どこに提案できるか」で並べるためのボードデータ。
// /v2/readiness（提案準備ボード）で使用する。
//
// 設計根拠: docs-src/cxm_v2/17_WHO_WHAT_Matching_Plan.md §10.1 / §15
//   「週の始めに誰を見るか決める」動線を担う画面のデータ源。
//
// 外部機会（§11）: 一覧では **company_external_intel の保存済みシグナルのみ**を見る。
//   議事録本文からのキーワード抽出は102社分読むと重いため、個社ページ側で行う。
//   テーブル未設定なら全社「機会なし」となり、従来と同じ挙動になる（安全側）。
//
// **このボードは「今週どこを見るか」の一覧に徹する。**
//   当てるWHATの候補・状況チップ・カタログの状態は個社ページの「提案準備」タブへ移した
//   （2026-08-22）。一覧で両方やるとカードが縦に伸び、絞り込みができなくなる。
//   そのため Notion カタログの取得と WHAT マッチングはここでは行わない。
//
// 更新ルール: 契約満了30日以内は解約できない運用のため、`0-30` は「更新予定」であり
// 緊急ではない。注視すべきは解約判断が行われる満了 91〜31日前（`31-90`）。
//
// 一覧版の準備度は**粗い**。個社詳細（/v2/companies/[uid] の提案準備タブ）で精査する
// 2段構成を前提にしている。一覧で全企業の議事録本文まで読むのは非現実的なため:
//   - relationship : 全チャネルの最終接点日で算出（接点件数は取得しない）
//                    companies.last_contact は SF sync 由来で古いことがあるため使わない
//   - friction     : snapshot.open_support_count のみ。**代替可能性の認知は未評価**
//   - utilization  : 企業内の有料プロジェクトを合算した値で評価する（PV 消化率も合計で判定）
//   - execution    : snapshot の会社合計（最新 vs 30日前）
// 未評価の要素は null のまま渡し、reasons と missing で UI 側に明示する。

import { NextRequest, NextResponse } from 'next/server';
import { fetchCompaniesByTiers } from '@/lib/nocodb/companies';
import { fetchProjectsByUids } from '@/lib/nocodb/project-info';
import {
  fetchLatestSnapshotsByUids,
  fetchSnapshotsByDate,
  nDaysAgoDateStr,
} from '@/lib/nocodb/company-snapshot';
import { fetchProjectSignalMap, type ProjectSignalData } from '@/lib/metabase/project-signals';
import { loadProjectFacts } from '@/lib/company/project-facts';
import { mergeModuleVerdicts } from '@/lib/company/module-signals';
import { mergeCampaignSignals, type CampaignSignalVM } from '@/lib/company/campaign-signals';
import { fetchProjectAccountMap, type ProjectAccountData } from '@/lib/metabase/project-accounts';
import { aggregateModuleSignals, type ModuleSignalVM } from '@/lib/company/module-signals';
import { fetchLatestCommunicationDatesByUids } from '@/lib/nocodb/communication-logs';
import { fetchExternalIntelByUids } from '@/lib/nocodb/external-intel';
import { buildExternalOpportunity, type ExternalSignalItem } from '@/lib/company/external-signal';
import {
  calcProposalReadiness,
  decideProposalPlay,
  type ProposalReadinessVM,
  type ProposalPlayResult,
  type ProposalPlay,
  type RenewalBucket,
  pvPeriodStatus,
  periodElapsed,
} from '@/lib/company/proposal-readiness';

export const maxDuration = 60;
/** 実行体制の比較に使う遡り日数 */
const TREND_WINDOW_DAYS = 30;

/** 取得上限（Tier1-3 の想定社数に対して余裕を持たせる） */
const FETCH_LIMIT = 600;

// ── 型 ────────────────────────────────────────────────────────────────────────

/**
 * ボードのレーン。「今どこに提案できるか / どこは提案してはいけないか」で分ける。
 *
 * renewal は準備度より優先する（期限があるため）。
 * ready 以降は準備度レベルで分ける。
 */
export type BoardLane = 'renewal' | 'ready' | 'conditional' | 'hold';

export interface BoardItem {
  companyUid:    string;
  companyName:   string;
  tier:          1 | 2 | 3 | 5 | null;
  owner:         string;
  mrr:           number | null;
  renewalBucket: RenewalBucket | null;
  renewalDate:   string | null;
  lastContact:   string | null;
  blankDays:     number | null;

  lane:      BoardLane;
  readiness: ProposalReadinessVM;
  /** 外部機会なしの場合の型（既定） */
  play:      ProposalPlayResult;
  /** 外部機会を掴んだ場合に変わる型。同じなら null */
  playIfOpportunity: ProposalPlay | null;
  /** 外部機会が観測されているか（company_external_intel 由来） */
  hasExternalOpportunity: boolean;
  /** 有効な外部シグナルの件数 */
  externalSignalCount: number;
  /** 最新の外部事象の日付 */
  externalLatestDate: string | null;

  /** 企業内の有料プロジェクトを合算した利用実態 */
  usage: {
    campaigns:   number;
    /**
     * 30日の分析・検証PV（管理画面モジュールの実測）。null = モジュールデータ未取得。
     * 累計ヒートマップ数（`heatmaps`）を表示から置き換えるために追加した。
     */
    deepPv:      number | null;
    /** 30日の実利用PV（回遊を除く） */
    activePv:    number | null;
    /** 30日の利用判定。カードで「休眠」「一部未使用」を出すのに使う */
    moduleVerdict: ModuleSignalVM['verdict'] | null;
    /** 契約しているのに30日使っていない製品 */
    unusedEntitled: string[];
    /** @deprecated 契約開始からの累計。表示には使わない（30日の実測に置き換え済み） */
    heatmaps:    number;
    l30Active:   number;
    /** いずれかのPJが習慣化していれば true、全PJが未習慣化なら false、不明のみなら null */
    habituation: boolean | null;
    /** PV 着地見込み（%）= 期末の予測PV / 契約枠。判定不能なら null */
    pvRate:      number | null;
    /** PV の判定状況（経過が浅い等の理由をカードのツールチップに出す） */
    pvNote:      string;
    /**
     * 施策の直近の動き。**「稼働N本」は在庫数なので、これと必ず併記する。**
     * 実測で「稼働5本以上なのに30日間1本も公開していない」有料PJが48件あった。
     */
    campaign: {
      activity:  CampaignSignalVM['activity'];
      ran30d:    number;
      created30d: number;
      daysSinceLastRun: number | null;
      runningWithoutGoal: number;
      publishRate: number | null;
    } | null;
    /** 直近4週に管理画面を触った顧客側の人数（社内除く）。null = データなし */
    operators:      number | null;
    operatorsPrev:  number | null;
    /** L30 が最大のプロジェクト名（どこが主戦場か示す） */
    topProjectName: string | null;
  } | null;
  /** 有料プロジェクト数 */
  paidProjectCount: number;
  /** 進行の妨げになっている要因（UI でチップ表示する） */
  blockers: string[];

  /**
   * 内部・行動シグナル（R_ / O_ / H_ 系）の検出結果。
   * **missing を必ず含める。** 「立たなかった」と「見ていない」を区別できないと、
   * マッチング結果が薄い原因（データ欠損か本当に該当なしか）が判断できない。
   */


  /**
   * WHAT マッチング結果。**常に返す**（null にしない）。
   * カタログが空でも activeSignals は返す。候補0件の原因を切り分けられるようにするため。
   * excluded（特に「逆効果」で外したもの）が最も価値の高い情報なので必ず含める。
   */

}

export interface ProposalBoardResponse {
  updatedAt:    string;
  snapshotDate: string | null;
  trendFromDate: string | null;
  counts: {
    all:         number;
    renewal:     number;
    ready:       number;
    conditional: number;
    hold:        number;
  };
  /** owner フィルタ用の候補 */
  owners: string[];
  /** WHAT カタログの状態（候補が0件のとき理由を UI に出す） */

  /**
   * 状況ID → 日本語名（Notion A が正本）。UI が生のIDを出さないために返す。
   * 語彙が増えても UI 側に辞書を持たせない（正本の二重管理を作らない）。
   */
  items:  BoardItem[];
  /** 一覧では評価できない要素（UI に明示するため返す） */
  notEvaluated: string[];
}

// ── 本体 ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ownerParam = req.nextUrl.searchParams.get('owner') ?? undefined;
  // 全社一括で機会ありに倒したい場合のみ使う（既定は企業ごとの自動判定）
  const forceOpportunity = req.nextUrl.searchParams.get('opportunity') === 'true';

  const companies = await fetchCompaniesByTiers([1, 2, 3], FETCH_LIMIT, ownerParam)
    .catch(() => []);

  if (companies.length === 0) {
    return NextResponse.json(emptyResponse());
  }

  const uids = companies.map(c => c.id);
  const pastDate = nDaysAgoDateStr(TREND_WINDOW_DAYS);

  const [
    latestSnaps, pastSnaps, projectsByUid, commDates, intelByUid,
  ] = await Promise.all([
    fetchLatestSnapshotsByUids(uids).catch(() => new Map()),
    fetchSnapshotsByDate(uids, pastDate).catch(() => new Map()),
    fetchProjectsByUids(uids).catch(() => new Map()),
    // companies.last_contact は SF sync 由来で古いことがあるため、実ログの最終日を使う
    fetchLatestCommunicationDatesByUids(uids).catch(() => new Map()),
    fetchExternalIntelByUids(uids).catch(() => new Map<string, ExternalSignalItem[]>()),
  ]);

  // 事前計算（朝のバッチ）を優先し、揃っていなければ CSV に落ちる。
  // CSV 4本（合計5MB超）をリクエスト経路から外すのが狙い。
  const allPaidIds = companies.flatMap(c =>
    (projectsByUid.get(c.id) ?? []).filter(p => p.paidType !== 'FREE').map(p => p.id));
  const facts = await loadProjectFacts(allPaidIds);

  const items: BoardItem[] = [];

  for (const company of companies) {
    const latest = latestSnaps.get(company.id) ?? null;
    const past   = pastSnaps.get(company.id) ?? null;
    const projects = projectsByUid.get(company.id) ?? [];
    const paidProjects = projects.filter(p => p.paidType !== 'FREE');

    // 利用実態は企業内の有料プロジェクトを合算して評価する。
    // 代表1件だけを見ると、PV 消化率が「どのPJを代表に選んだか」で大きくぶれる。
    const signalMap = new Map<string, ProjectSignalData>();
    for (const p of paidProjects) {
      const sg = facts.map.get(p.id)?.signal;
      if (sg) signalMap.set(p.id, sg);
    }
    const agg = aggregateSignals(paidProjects, signalMap);

    const renewalBucket = normalizeRenewalBucket(latest?.renewal_bucket ?? null);
    const comm = commDates.get(company.id) ?? null;
    // 実ログの最終接点日を優先し、無ければ companies.last_contact にフォールバック
    const lastContact = comm?.latestDate ?? company.lastContact ?? null;
    const blankDays   = comm?.blankDays ?? daysSince(company.lastContact);

    // 30日の管理画面利用（有料PJを合算）。取得できない企業は null のまま
    // 事前計算済みの判定を企業単位に畳む（CSV は引かない）
    const moduleSignal = paidProjects.length > 0
      ? mergeModuleVerdicts(paidProjects.map(p => facts.map.get(p.id)?.module ?? null))
      : null;

    // 運用人数は有料PJ横断で**人（メールアドレス）を重複排除**して数える。
    // PJごとに足すと、複数PJを見ている1人が人数分に膨らむ。
    const ops = countOperators(paidProjects.map(p => facts.map.get(p.id)?.accounts ?? null));

    // 施策の直近の動き（有料PJ合算）
    const campaignSignal = mergeCampaignSignals(
      paidProjects.map(p => facts.map.get(p.id)?.campaign ?? null),
    );

    const readiness = calcProposalReadiness({
      scope:   'company',
      scopeId: company.id,
      label:   company.name,
      signal:  agg?.signal ?? null,
      habituationStatus: agg?.habituation ?? null,
      moduleSignal,
      operators:     ops.operators,
      operatorsPrev: ops.operatorsPrev,
      // 実行体制は会社合計の推移
      campaignCount30dAgo: past?.running_campaign_total ?? null,
      campaignCountNow:    latest?.running_campaign_total ?? null,
      l30Active30dAgo:     past?.total_l30_active ?? null,
      l30ActiveNow:        latest?.total_l30_active ?? null,
      // 関係の温度は最終接点日のみ（接点件数は一覧では取得しない）
      communicationBlankDays: blankDays,
      touchpointCount90d:     null,
      // 摩擦はサポート件数のみ。代替可能性の認知は一覧では未評価
      openSupportCount: latest?.open_support_count ?? null,
      replaceabilityFlagged: false,
      renewalBucket,
    });

    // 外部機会は企業ごとに自動判定する（保存済みシグナルのみ / §11）
    const external = buildExternalOpportunity(intelByUid.get(company.id) ?? []);
    const hasOpportunity = forceOpportunity || external.hasOpportunity;

    const play = decideProposalPlay(readiness, hasOpportunity, renewalBucket);
    // 機会がまだ無い企業について「掴めばどうなるか」を示す（機会探索の優先先を示唆する）
    const playWith = decideProposalPlay(readiness, true, renewalBucket);


    items.push({
      companyUid:  company.id,
      companyName: company.name,
      tier:        company.tier,
      owner:       company.owner,
      mrr:         latest?.mrr ?? null,
      renewalBucket,
      renewalDate: latest?.renewal_date ?? null,
      lastContact,
      blankDays,

      lane: decideLane(readiness, renewalBucket, play.play),
      readiness,
      play,
      playIfOpportunity: playWith.play === play.play ? null : playWith.play,
      hasExternalOpportunity: hasOpportunity,
      externalSignalCount:   external.activeSignals.length,
      externalLatestDate:    external.latestDate,

      usage: agg
        ? {
            campaigns:   agg.signal.runningCampaignWithGoalCount,
            deepPv:      moduleSignal && moduleSignal.verdict !== 'unevaluated' ? moduleSignal.deepPv : null,
            activePv:    moduleSignal && moduleSignal.verdict !== 'unevaluated' ? moduleSignal.activePv : null,
            moduleVerdict:  moduleSignal?.verdict ?? null,
            unusedEntitled: moduleSignal?.unusedEntitled ?? [],
            heatmaps:    agg.signal.heatmapCount,
            l30Active:   agg.signal.l30Active,
            habituation: agg.habituation,
            pvRate:      (() => { const p = pvPeriodStatus(agg.signal); return p.forecastRate ?? p.actualRate; })(),
            pvNote:      pvPeriodStatus(agg.signal).note,
            campaign: campaignSignal.activity === 'unknown' ? null : {
              activity:   campaignSignal.activity,
              ran30d:     campaignSignal.ran30d,
              created30d: campaignSignal.created30d,
              daysSinceLastRun:   campaignSignal.daysSinceLastRun,
              runningWithoutGoal: campaignSignal.runningWithoutGoal,
              publishRate:        campaignSignal.publishRate,
            },
            operators:      ops.operators,
            operatorsPrev:  ops.operatorsPrev,
            topProjectName: agg.topProjectName,
          }
        : null,
      paidProjectCount: paidProjects.length,
      blockers: buildBlockers(readiness, renewalBucket, agg?.signal, agg?.habituation ?? null, latest?.open_support_count ?? null, moduleSignal, campaignSignal.activity === 'unknown' ? null : campaignSignal),

    });
  }

  // レーン順 → 準備度の高い順 → MRR の大きい順
  const LANE_ORDER: Record<BoardLane, number> = { renewal: 0, ready: 1, conditional: 2, hold: 3 };
  items.sort((a, b) =>
    LANE_ORDER[a.lane] - LANE_ORDER[b.lane]
    || (b.readiness.overallScore ?? -1) - (a.readiness.overallScore ?? -1)
    || (b.mrr ?? -1) - (a.mrr ?? -1),
  );

  const owners = [...new Set(companies.map(c => c.owner).filter(Boolean))].sort();

  const body: ProposalBoardResponse = {
    updatedAt:     new Date().toISOString(),
    snapshotDate:  firstSnapshotDate(latestSnaps),
    trendFromDate: pastDate,
    counts: {
      all:         items.length,
      renewal:     items.filter(i => i.lane === 'renewal').length,
      ready:       items.filter(i => i.lane === 'ready').length,
      conditional: items.filter(i => i.lane === 'conditional').length,
      hold:        items.filter(i => i.lane === 'hold').length,
    },
    owners,
    items,
    notEvaluated: [
      '「他ツールで代替可能」の認知（議事録の読解が必要 — 個社ページで評価）',
      '直近90日の接点件数（一覧では最終接点日のみ）',
      '部門別の準備度（一覧は会社単位の粗い指標 — 部門差は個社ページで確認）',
      '議事録からの外部シグナル抽出（一覧は登録済みの外部情報のみ — 個社ページで議事録も走査）',
      'アクティブユーザー数の推移（H4）— ユーザー数の履歴を保持していないため未実装',
    ],
  };

  return NextResponse.json(body);
}

// ── レーン判定 ────────────────────────────────────────────────────────────────

/**
 * レーンを決める。
 *
 * renewal を最優先にするのは、期限が判断を規定するため。
 * 準備度が high でも更新30日以内なら、まず契約の着地を確実にする（§15.2 のガードレール）。
 */
function decideLane(
  readiness: ProposalReadinessVM,
  renewalBucket: RenewalBucket | null,
  play: ProposalPlay,
): BoardLane {
  // 解約判断が実際に行われるのは満了 91〜31日前。
  // 満了30日以内は解約できない運用ルールのため、ここは緊急ではない。
  if (renewalBucket === '31-90' && play === 'rebuild') return 'renewal';
  if (readiness.overall === 'high')   return 'ready';
  if (readiness.overall === 'medium') return 'conditional';
  return 'hold';
}

/**
 * 進行の妨げになっている要因を短いチップ用の文言で返す。
 * スコアの内訳ではなく「何が引っかかっているか」を1行で示す。
 */
/**
 * 赤いフラグ。**すべて実測値をラベルに載せる。**
 *
 * 値の無いラベル（旧「分析ほぼ未実施」など）は、4要素のスコアが高いときに
 * 矛盾して見えて理解できない。実測で「分析226PV/30日」なのに
 * 「分析ほぼ未実施」が出ていた（累計ヒートマップ3件で判定していたため）。
 *
 * ⚠️ 条件を変えたら `BLOCKER_META`（proposal-readiness.ts）の文言も直すこと。
 *   凡例と実装がずれると、画面の説明が嘘になる。
 */
function buildBlockers(
  readiness: ProposalReadinessVM,
  renewalBucket: RenewalBucket | null,
  signal: ProjectSignalData | undefined,
  habituation: boolean | null,
  openSupportCount: number | null,
  moduleSignal: ModuleSignalVM | null,
  campaign: CampaignSignalVM | null,
): string[] {
  const out: string[] = [];

  // 解約判断期。ここが最も注視すべき期間
  if (renewalBucket === '31-90')   out.push('更新判断期（91〜31日前）');
  if (renewalBucket === 'expired') out.push('更新期限切れ');
  // 満了30日以内は解約できないため警戒ではなく状態表示に留める（buildBlockers には出さない）

  if (openSupportCount !== null && openSupportCount >= 6) out.push(`未解決サポート ${openSupportCount}件`);

  if (habituation === false) out.push('習慣化なし');
  if (signal && signal.runningCampaignWithGoalCount <= 2) {
    out.push(`稼働施策 ${signal.runningCampaignWithGoalCount}本`);
  }

  // 施策の「在庫はあるが動いていない」。稼働本数だけでは見えない
  if (campaign) {
    if (campaign.activity === 'idle_run') {
      out.push(`放置運用（30日 公開0本${campaign.daysSinceLastRun !== null ? ` / 最終 ${campaign.daysSinceLastRun}日前` : ''}）`);
    } else if (campaign.activity === 'stuck') {
      out.push(`作成${campaign.created30d}本・公開0本`);
    }
    if (campaign.runningWithoutGoal > 0) {
      out.push(`ゴール未設定 ${campaign.runningWithoutGoal}本`);
    }
  }

  // 分析は**30日の実測**で見る。累計ヒートマップでは「今やっているか」が分からない。
  // モジュールデータが取れないときは判定しない（誤って未実施と出す方が害が大きい）。
  if (moduleSignal && moduleSignal.verdict !== 'unevaluated' && moduleSignal.deepPv < 5) {
    out.push(`分析 ${moduleSignal.deepPv}PV/30日`);
  }

  // PV は期間の経過を見て判定する。始まったばかりの期間では出さない
  const pv = signal ? pvPeriodStatus(signal) : null;
  if (pv?.evaluable && pv.underused) {
    out.push(`PV着地見込 ${pv.forecastRate ?? pv.actualRate}%`);
  }

  const exec = readiness.factors.execution;
  if (exec.score !== null && exec.score < 30) out.push(`施策が減少（実行 ${exec.score}）`);

  const rel = readiness.factors.relationship;
  if (rel.score !== null && rel.score < 30) out.push(`接点が途絶（関係 ${rel.score}）`);

  return out;
}

// ── 利用実態の企業集計 ────────────────────────────────────────────────────────

interface AggregatedUsage {
  /** 企業内の有料プロジェクトを合算した疑似 signal（calcUtilization にそのまま渡す） */
  signal:      ProjectSignalData;
  /** いずれかが習慣化していれば true、全て未習慣化なら false、不明のみなら null */
  habituation: boolean | null;
  /** L30 が最大のプロジェクト名 */
  topProjectName: string | null;
}

/**
 * 有料プロジェクトの利用実態を企業単位に合算する。
 *
 * 代表1件を選ぶ方式だと、PV 消化率が「どのPJを代表に選んだか」で大きくぶれる
 * （契約 PV の大きいPJを選ぶか、活動の多いPJを選ぶかで数値が数十%変わる）。
 * 企業単位の評価では合計で見る。プロジェクト別の内訳は個社ページで確認する。
 */
function aggregateSignals(
  projects:  { id: string; name: string; habituationStatus: boolean | null }[],
  signalMap: Map<string, ProjectSignalData>,
): AggregatedUsage | null {
  let campaigns = 0, heatmaps = 0, l30 = 0, l7 = 0;
  let pvCeiling: number | null = null;
  let pvCount:   number | null = null;
  let pvForecast: number | null = null;
  // 期間はPJごとに違う（契約更新日の応当日でリセット）。
  // 会社単位では「最も進んでいない期間」を採る＝早すぎる判定を避ける安全側。
  let minElapsed: number | null = null;
  let periodStart: string | null = null;
  let periodEnd:   string | null = null;
  let lastActive: string | null = null;
  let topL30 = -1, topName: string | null = null;
  let anyTrue = false, anyFalse = false, found = false;

  for (const p of projects) {
    const s = signalMap.get(p.id);
    if (!s) continue;
    found = true;

    campaigns += s.runningCampaignWithGoalCount;
    heatmaps  += s.heatmapCount;
    l30       += s.l30Active;
    l7        += s.l7EventCount;
    if (s.pvCeiling   != null) pvCeiling = (pvCeiling ?? 0) + s.pvCeiling;
    if (s.monthPvCount != null) pvCount  = (pvCount   ?? 0) + s.monthPvCount;
    if (s.lastActiveDate && (!lastActive || s.lastActiveDate > lastActive)) lastActive = s.lastActiveDate;

    if (s.monthPvForecast != null) pvForecast = (pvForecast ?? 0) + s.monthPvForecast;
    const el = periodElapsed(s.monthPeriodStartTime, s.monthPeriodEndTime);
    if (el !== null && (minElapsed === null || el < minElapsed)) {
      minElapsed = el;
      periodStart = s.monthPeriodStartTime;
      periodEnd   = s.monthPeriodEndTime;
    }

    if (s.l30Active > topL30) { topL30 = s.l30Active; topName = p.name || s.projectName; }

    if (p.habituationStatus === true)  anyTrue = true;
    if (p.habituationStatus === false) anyFalse = true;
  }

  if (!found) return null;

  return {
    signal: {
      projectName:                  topName ?? '',
      paidType:                     null,
      masterCompanyName:            null,
      runningCampaignWithGoalCount: campaigns,
      heatmapCount:                 heatmaps,
      firstHeatmapDate:             null,
      pvCeiling,
      monthPvCount:                 pvCount,
      monthPvForecast:              pvForecast,
      monthPeriodStartTime:         periodStart,
      l30Active:                    l30,
      l7EventCount:                 l7,
      lastActiveDate:               lastActive,
      monthPeriodEndTime:           periodEnd,
      masterCompanySfId:            null,
    },
    habituation: anyTrue ? true : anyFalse ? false : null,
    topProjectName: topName,
  };
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

function pvRate(count: number | null, ceiling: number | null): number | null {
  if (!ceiling || ceiling <= 0 || count === null) return null;
  return Math.round((count / ceiling) * 100);
}

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(String(dateStr).trim().replace(' ', 'T'));
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

const RENEWAL_BUCKETS: RenewalBucket[] = ['0-30', '31-90', '91-180', '180+', 'expired'];

function normalizeRenewalBucket(v: string | null): RenewalBucket | null {
  if (!v) return null;
  return RENEWAL_BUCKETS.includes(v as RenewalBucket) ? (v as RenewalBucket) : null;
}

function firstSnapshotDate(snaps: Map<string, { snapshot_date: string }>): string | null {
  for (const s of snaps.values()) return s.snapshot_date ?? null;
  return null;
}

function emptyResponse(): ProposalBoardResponse {
  return {
    updatedAt:     new Date().toISOString(),
    snapshotDate:  null,
    trendFromDate: null,
    counts: { all: 0, renewal: 0, ready: 0, conditional: 0, hold: 0 },
    owners: [],
    items:  [],
    notEvaluated: [],
  };
}

/** 契約更新日までの残日数。過去日や不正な値は null */
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const t = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`).getTime();
  if (isNaN(t)) return null;
  return Math.floor((t - Date.now()) / 86_400_000);
}


/** 空文字を捨てて重複を畳む */
function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/**
 * 企業の運用人数。有料PJ横断でメールアドレスを重複排除して数える。
 * PJごとに足すと、複数PJを見ている1人が人数分に膨らむ。
 * データが1件も無ければ null（0人と混同しない）。
 */
function countOperators(
  list: Array<{ operatorEmails: string[]; operatorEmailsPrev: string[] } | null>,
): { operators: number | null; operatorsPrev: number | null } {
  const now = new Set<string>();
  const prev = new Set<string>();
  let found = false;
  for (const a of list) {
    if (!a) continue;
    found = true;
    for (const e of a.operatorEmails)     now.add(e);
    for (const e of a.operatorEmailsPrev) prev.add(e);
  }
  if (!found) return { operators: null, operatorsPrev: null };
  return { operators: now.size, operatorsPrev: prev.size };

}
