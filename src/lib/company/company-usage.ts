// ─── GET /api/company/[companyUid]/usage ──────────────────────────────────────
//
// 個社の「現在の利用状況」を集約して返す。CXM v2 の会社詳細ページ用。
//
// 企業レベル: プラン / MRR / PV消費率 / 今週操作数・前週比 / 最終活動 / 休眠 / アラーム・重大度
// プロジェクト別: 稼働状態 / L30 / PV消費率 / ヒートマップ / Campaign / 活用スコア / 活用済・停滞
//
// データソース: project_info + metabase(signals/user-activity) + company_daily_snapshot
//               + project_user_snapshots(前週比) + chronic-silent。すべて集約層で計算。

import { fetchCompanyByUid } from '@/lib/nocodb/companies';
import { fetchProjectsByCompany } from '@/lib/nocodb/project-info';
import { fetchLatestSnapshot, nDaysAgoDateStr } from '@/lib/nocodb/company-snapshot';
import { fetchProjectSnapshotsByDate } from '@/lib/nocodb/project-user-snapshots';
import { loadProjectFacts, type ProjectFacts } from '@/lib/company/project-facts';
import { fetchProjectMetrics, type ProjectMetricRow } from '@/lib/nocodb/project-metrics';
import { pvPeriodStatus } from '@/lib/company/proposal-readiness';
import { buildModuleSignal, type ModuleSignalVM } from '@/lib/company/module-signals';
import { buildSuperLoginTargets, type SuperLoginTarget } from '@/lib/company/super-login';
import { fetchProjectSignalMap, type ProjectSignalData } from '@/lib/metabase/project-signals';
import { fetchProjectUserActivityMap, type ProjectUserActivity } from '@/lib/metabase/project-user-activity';
import { fetchLatestChronicSilentSnapshot, buildSilentItemByCompanyUid } from '@/lib/nocodb/chronic-silent';
import { fetchLatestProjectSnapshots, type ProjectUserSnapshot } from '@/lib/nocodb/project-user-snapshots';
import { buildProjectAggregateVM } from '@/lib/company/project-aggregate';
import type { AppProjectInfo } from '@/lib/nocodb/types';

// ── 型 ────────────────────────────────────────────────────────────────────────

export type ContractPlan = 'insight' | 'experience' | 'bundle';
export type AlarmType = 'pv_over' | 'renewal_soon' | 'ops_drop' | 'inactive_30' | 'upsell';
export type Severity = 'red' | 'amber' | 'blue' | 'green';

export interface ProjectUsageItem {
  id:            string;
  name:          string;
  paidType:      string | null;
  /** 稼働状態（active / stalled / unused / inactive）*/
  status:        'active' | 'stalled' | 'unused' | 'inactive';
  stalledDays:   number | null;
  l30Active:     number | null;
  l7Active:      number | null;
  pvCeiling:     number | null;
  monthPvCount:  number | null;
  /** PV 着地見込み（%）。判定できない場合は現時点の消化率 */
  pvRate:        number | null;
  /** PV 判定の状況（期間が浅い等の理由）。UI のツールチップに出す */
  pvNote:        string;
  heatmapCount:  number | null;
  campaignCount: number | null;
  healthyScore:  number | null;
  depthScore:    number | null;
  breadthScore:  number | null;
  habituation:   boolean | null;
  lastActive:    string | null;
  /**
   * 過去30日の管理画面モジュール利用。null = 未取得。
   *
   * 提案準備タブの readiness に相乗りさせていたが、
   * readiness はそのタブを開いたときしか取得しないため、
   * ダッシュボードタブでは常に「—」になっていた（実測）。
   * ダッシュボードが他タブの読み込みに依存しないよう、ここで持つ。
   */
  moduleSignal:  ModuleSignalVM | null;
}

export interface CompanyUsageResponse {
  companyUid:    string;
  name:          string;
  owner:         string;
  tier:          1 | 2 | 3 | 5 | null;
  isPaidWatched: boolean;

  plan:          ContractPlan | null;
  mrr:           number | null;
  renewalBucket: string | null;
  renewalDate:   string | null;
  openSupport:   number | null;

  pvRate:        number | null;   // 企業内プロジェクト最大
  pvOver:        boolean;
  l7ThisWeek:    number | null;
  l7PrevWeek:    number | null;
  wowPct:        number | null;
  l30Total:      number | null;
  lastActive:    string | null;
  daysSinceActive: number | null;

  activeProjectCount:  number;
  stalledProjectCount: number;
  totalProjectCount:   number;

  isChronicSilent:  boolean;
  chronicSilentL30: number | null;

  alarms:   AlarmType[];
  severity: Severity;

  riskSignals:        { severity: string; description: string }[];
  opportunitySignals: { description: string }[];

  projects: ProjectUsageItem[];

  /**
   * 顧客の管理画面へ代理ログインする入口（superLogin）。
   * 代表メールで束ねてあるので、共通なら1件・分かれていればアドレスの数だけ入る。
   * **無料PJは含まない。** 空配列 = 有料PJがない、または代表メールが未登録。
   */
  loginTargets: SuperLoginTarget[];
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

function num(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const v = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(v) ? v : null;
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr.trim().replace(' ', 'T'));
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / 86_400_000);
}

/** 指定日までの残日数（未来なら正、過去なら負、null=不明）。契約更新の残日数判定に使う。 */
function daysUntil(dateStr: string | null): number | null {
  const since = daysSince(dateStr);
  return since == null ? null : -since;
}

/**
 * 契約プランを判定する。
 *
 * ⚠️ `BUNDLE-PAID` を見ていなかったため、**全PJが BUNDLE-PAID の企業が
 * 「未契約」と表示されていた**（実測: アミナコレクション）。
 * TRIAL も契約状態として扱う（未契約ではない）。
 */
function derivePlan(paidTypes: Set<string>): ContractPlan | null {
  const has = (v: string) => [...paidTypes].some(t => t.startsWith(v));
  if (has('BUNDLE')) return 'bundle';
  const hasI = has('PTI');
  const hasX = has('PTX');
  if (hasI && hasX) return 'bundle';
  if (hasI) return 'insight';
  if (hasX) return 'experience';
  return null;
}

function pvRateOf(monthPv: number | null, ceiling: number | null): number | null {
  if (monthPv == null || !ceiling || ceiling <= 0) return null;
  return Math.round((monthPv / ceiling) * 100);
}

/**
 * 日次スナップショット行から signalMap / activityMap を再構築する。
 * 個社ページが Metabase CSV 全件DL（コールド6.5〜27秒）を避けるための ①。
 * スナップショットに無いメタ情報（projectName / paidType）は project_info から補う。
 */
function buildMapsFromSnapshots(
  projects: AppProjectInfo[],
  snap: Map<string, ProjectUserSnapshot>,
): { signalMap: Map<string, ProjectSignalData>; activityMap: Map<string, ProjectUserActivity> } {
  const signalMap   = new Map<string, ProjectSignalData>();
  const activityMap = new Map<string, ProjectUserActivity>();
  for (const p of projects) {
    const s = snap.get(p.id);
    if (!s) continue;
    activityMap.set(p.id, {
      totalUsers:        s.total_users      ?? 0,
      l30ActiveUsers:    s.l30_active_users ?? 0,
      l7ActiveUsers:     s.l7_active_users  ?? 0,
      maxLastActiveDate: s.last_active_date ?? null,
    });
    signalMap.set(p.id, {
      projectName:                  p.name,
      paidType:                     p.paidType,
      masterCompanyName:            null,
      monthPvForecast:              null,
      monthPeriodStartTime:         null,
      runningCampaignWithGoalCount: s.running_campaign_count ?? 0,
      heatmapCount:                 s.heatmap_count          ?? 0,
      firstHeatmapDate:             null,
      pvCeiling:                    s.pv_ceiling             ?? null,
      monthPvCount:                 s.month_pv_count         ?? null,
      l30Active:                    s.l30_active_users       ?? 0,
      l7EventCount:                 s.l7_active_users        ?? 0,
      lastActiveDate:               s.last_active_date       ?? null,
      monthPeriodEndTime:           null,
      masterCompanySfId:            null,
    });
  }
  return { signalMap, activityMap };
}

// ── ハンドラ ──────────────────────────────────────────────────────────────────

/**
 * 個社の利用状況を集約して返す（route と Server Component から共用）。
 * 企業が見つからない場合は null。
 */
export async function loadCompanyUsage(companyUid: string): Promise<CompanyUsageResponse | null> {
  const company = await fetchCompanyByUid(companyUid).catch(() => null);
  if (!company) return null;

  const [projects, snapshot, silentSnapshot] = await Promise.all([
    fetchProjectsByCompany(companyUid).catch(() => []),
    fetchLatestSnapshot(companyUid).catch(() => null),
    fetchLatestChronicSilentSnapshot('JP').catch(() => null),
  ]);

  // ── モジュール利用は事前計算（project_metrics）から読む ────────────────────
  //   以前は `fetchProjectModuleMap()` で **モジュールCSVを毎回全件DL**していた。
  //   実測（2026-08-24 / 本番）: コールド **31.7秒**、ウォーム1.1秒。
  //   個社ページの初期表示はこの API を待つので、朝いちばんに開いた人が31秒待つ。
  //   ボードと同じ `loadProjectFacts()`（事前計算優先・カバー率が落ちたらCSV）に統一する。
  //
  // ⚠️ **有料PJだけを渡すこと。** `loadProjectFacts` は事前計算のカバー率が
  //    50%を切ると「バッチが動いていない」と判断して CSV に落ちる。
  //    無料PJは事前計算の対象外なので、全PJを渡すと（有料1・無料3のような会社で）
  //    カバー率が 0.25 になり、**毎回 CSV を引いていた**（実測 24秒 / 2026-08-24）。
  const paidIds = projects.filter(p => (p.paidType ?? '').toUpperCase().includes('PAID')).map(p => p.id);
  const facts = await loadProjectFacts(paidIds).catch(
    () => ({ map: new Map<string, ProjectFacts>() } as { map: Map<string, ProjectFacts> }),
  );

  // 朝のバッチ（project_metrics）で埋められる欠損を先に取る。
  // 日次スナップショットは pv_ceiling / last_active_date / 集計期間 を持たないため、
  // PV消費率と最終活動が「—」のままになっていた（実測: アミナコレクション）。
  const metrics = await fetchProjectMetrics(projects.map(p => p.id)).catch(
    () => new Map<string, ProjectMetricRow>(),
  );
  const silentByUid = buildSilentItemByCompanyUid(silentSnapshot);

  const projectIds = projects.map(p => p.id);

  // ── ① 利用実績は日次スナップショットから読む（CSV 全件DL を回避）──────────────
  //   スナップショットが空（未バッチの企業など）の場合のみ Metabase CSV にフォールバック。
  let signalMap:   Map<string, ProjectSignalData>;
  let activityMap: Map<string, ProjectUserActivity>;
  const snapRows = projectIds.length > 0
    ? await fetchLatestProjectSnapshots(projectIds).catch(() => new Map<string, ProjectUserSnapshot>())
    : new Map<string, ProjectUserSnapshot>();

  if (snapRows.size > 0) {
    ({ signalMap, activityMap } = buildMapsFromSnapshots(projects, snapRows));
  } else {
    // フォールバック（回帰防止）: スナップショット未生成の企業は従来どおり CSV から取得
    [signalMap, activityMap] = await Promise.all([
      fetchProjectSignalMap().catch(() => new Map<string, ProjectSignalData>()),
      fetchProjectUserActivityMap().catch(() => new Map<string, ProjectUserActivity>()),
    ]);
  }

  // 前週スナップショット（7日前）の l7_active_users
  const prevSnapMap = projectIds.length > 0
    ? await fetchProjectSnapshotsByDate(projectIds, nDaysAgoDateStr(7)).catch(() => new Map())
    : new Map();

  // 集約 VM（derivedStatus / stalledDays / monthPvCount 上書き / risk・opportunity シグナル）
  const vm = buildProjectAggregateVM(projects, activityMap, signalMap);

  // ── プロジェクト別明細 ──────────────────────────────────────────────────────
  const projectItems: ProjectUsageItem[] = vm.projects.map(p => {
    const sd  = signalMap.get(p.id);
    const act = activityMap.get(p.id);
    const m   = metrics.get(p.id);
    // 日次スナップショットに無い項目は事前計算で埋める（CSVは引かない）
    const pvCeiling    = sd?.pvCeiling ?? m?.pv_ceiling ?? null;
    const monthPvCount = p.monthPvCount ?? sd?.monthPvCount ?? m?.month_pv ?? null;
    const pv = pvPeriodStatus({
      pvCeiling,
      monthPvCount,
      monthPvForecast:      sd?.monthPvForecast      ?? m?.pv_forecast  ?? null,
      monthPeriodStartTime: sd?.monthPeriodStartTime ?? m?.period_start ?? null,
      monthPeriodEndTime:   sd?.monthPeriodEndTime   ?? m?.period_end   ?? null,
    });
    return {
      id:            p.id,
      name:          p.name,
      paidType:      p.paidType,
      status:        p.derivedStatus,
      stalledDays:   p.stalledDays,
      l30Active:     p.l30Active,
      l7Active:      act?.l7ActiveUsers ?? sd?.l7EventCount ?? null,
      pvCeiling,
      monthPvCount,
      // 着地見込みを優先する。PV枠は契約更新日の応当日でリセットされるため、
      // 期間の途中の消化率をそのまま出すと低く見える（§33）
      pvRate:        pv.forecastRate ?? pv.actualRate,
      pvNote:        pv.note,
      heatmapCount:  sd?.heatmapCount ?? null,
      campaignCount: sd?.runningCampaignWithGoalCount ?? null,
      healthyScore:  p.healthyScore,
      depthScore:    p.depthScore,
      breadthScore:  p.breadthScore,
      habituation:   p.habituationStatus,
      lastActive:    sd?.lastActiveDate ?? act?.maxLastActiveDate ?? m?.last_active_date ?? null,
      // 事前計算にある（＝有料）PJはそれを使う。無料PJは行が無いのが正常なので、
      // CSV を引かずに data:null で判定する（L30=0 なら休眠になる）。
      moduleSignal:  facts.map.get(p.id)?.module ?? buildModuleSignal({
        paidType:  p.paidType,
        data:      null,
        l30Active: p.l30Active ?? sd?.l30Active ?? null,
      }),
    };
  });

  // ── 企業レベル集約 ──────────────────────────────────────────────────────────
  const paidTypes = new Set<string>();
  for (const p of projects) { const pt = (p.paidType ?? '').toUpperCase(); if (pt) paidTypes.add(pt); }
  const plan = derivePlan(paidTypes);

  let pvRate: number | null = null;
  let l7ThisWeek: number | null = null, l7PrevWeek: number | null = null;
  let hasThis = false, hasPrev = false;
  let lastActive: string | null = null;
  for (const it of projectItems) {
    if (it.pvRate != null && (pvRate == null || it.pvRate > pvRate)) pvRate = it.pvRate;
    if (it.l7Active != null) { l7ThisWeek = (l7ThisWeek ?? 0) + it.l7Active; hasThis = true; }
    const prev = prevSnapMap.get(it.id);
    if (prev?.l7_active_users != null) { l7PrevWeek = (l7PrevWeek ?? 0) + prev.l7_active_users; hasPrev = true; }
    if (it.lastActive && (!lastActive || it.lastActive > lastActive)) lastActive = it.lastActive;
  }
  const wowPct = (hasThis && hasPrev && (l7PrevWeek ?? 0) > 0)
    ? Math.round(((l7ThisWeek! - l7PrevWeek!) / l7PrevWeek!) * 100)
    : null;
  const pvOver = pvRate != null && pvRate >= 90;
  const daysSinceActive = daysSince(lastActive);

  const mrr           = num(snapshot?.mrr);
  const renewalBucket = snapshot?.renewal_bucket ?? null;
  const renewalDate   = snapshot?.renewal_date ?? null;
  const openSupport   = num(snapshot?.open_support_count);
  const l30Total      = num(snapshot?.total_l30_active) ?? vm.totalL30Active;
  const isChronicSilent  = silentByUid.has(companyUid);
  const chronicSilentL30 = silentByUid.get(companyUid)?.l30Active ?? null;

  // ── アラーム判定（tier3-dashboard と同一ルール）─────────────────────────────
  //   契約更新は renewal_date からの残日数で判定（bucket は 31-90 一括で 60/61 境界を出せないため）:
  //     0-30日 or 期限切れ = 要観察 / 31-60日 = 要注意 / 61日以上 = 無印
  const renewalDays = daysUntil(renewalDate);
  const alarms: AlarmType[] = [];
  if (pvOver) alarms.push('pv_over');
  if (renewalDays != null && renewalDays <= 60) alarms.push('renewal_soon');
  if (wowPct != null && wowPct <= -50) alarms.push('ops_drop');
  if ((daysSinceActive != null && daysSinceActive >= 30) || isChronicSilent) alarms.push('inactive_30');
  const hasActivity = (l7ThisWeek ?? 0) > 0 || (l30Total ?? 0) > 0;
  if (plan != null && plan !== 'bundle' && hasActivity) alarms.push('upsell');

  let severity: Severity = 'green';
  // 契約更新(0-30/expired)は「解約不可期間 or 更新交渉フェーズ」であり緊急ではない → amber(要対応/観察)
  if (alarms.includes('pv_over')) severity = 'red';
  else if (alarms.includes('renewal_soon') || alarms.includes('ops_drop') || alarms.includes('inactive_30')) severity = 'amber';
  else if (alarms.includes('upsell')) severity = 'blue';

  const response: CompanyUsageResponse = {
    companyUid,
    name:          company.name,
    owner:         company.owner,
    tier:          company.tier,
    isPaidWatched: company.isPaidWatched,
    plan,
    mrr,
    renewalBucket,
    renewalDate,
    openSupport,
    pvRate,
    pvOver,
    l7ThisWeek,
    l7PrevWeek,
    wowPct,
    l30Total,
    lastActive,
    daysSinceActive,
    activeProjectCount:  vm.active,
    stalledProjectCount: vm.stalled,
    totalProjectCount:   vm.total,
    isChronicSilent,
    chronicSilentL30,
    alarms,
    severity,
    riskSignals:        vm.riskSignals.map(s => ({ severity: s.severity, description: s.description })),
    opportunitySignals: vm.opportunitySignals.map(s => ({ description: s.description })),
    projects: projectItems,
    // 代理ログインは project_info の代表メールから作る（追加の取得はしない）
    loginTargets: buildSuperLoginTargets(projects),
  };

  return response;
}
