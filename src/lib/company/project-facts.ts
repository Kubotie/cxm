// ─── プロジェクトの事実を1箇所で読む ────────────────────────────────────────
//
// **事前計算（NocoDB `project_metrics`）を優先し、無ければ CSV から計算する。**
//
// 実測（2026-08-22 / dev のコールドスタート）:
//   ボード7.0秒 / 準備度4.0秒 / PJ詳細4.2秒
//   遅さの正体は Metabase CSV（signals 4MB / modules 590KB / campaigns 800KB / accounts）を
//   インスタンスごとに引き直すこと。Vercel では毎回コールドを払う。
//
// フォールバックを必ず持つ理由:
//   朝のバッチが失敗した日に画面が空になるのは許容できない。
//   **1件でも欠けたら CSV に落ちる**（部分的に古いデータを混ぜると原因が追えない）。
//
// サーバーサイド専用。

import {
  fetchProjectMetrics, isFresh, type ProjectMetricRow,
} from '@/lib/nocodb/project-metrics';
import { fetchProjectSignalMap, type ProjectSignalData } from '@/lib/metabase/project-signals';
import { fetchProjectModuleMap } from '@/lib/metabase/project-modules';
import { fetchCampaignSummaryMap } from '@/lib/metabase/project-campaigns';
import { fetchProjectAccountMap } from '@/lib/metabase/project-accounts';
import {
  buildModuleSignal, EMPTY_MODULE_SIGNAL, normalizePlan, entitledProducts,
  type ModuleSignalVM, type ModuleVerdict,
} from '@/lib/company/module-signals';
import {
  buildCampaignSignal, EMPTY_CAMPAIGN_SIGNAL,
  type CampaignSignalVM, type CampaignActivity,
} from '@/lib/company/campaign-signals';

export interface ProjectAccountFacts {
  operators:          number;
  operatorsPrev:      number;
  internalOperators:  number;
  singleOperator:     boolean;
  roleCounts:         Record<string, number>;
  untouchedProducts:  string[];
  /** 直近4週に稼働した顧客側アカウント。企業横断の重複排除に使う */
  operatorEmails:     string[];
  /** その1つ前の4週（増減の比較用） */
  operatorEmailsPrev: string[];
}

export interface ProjectFacts {
  projectId: string;
  /** 生指標。準備度の算出にそのまま渡せる形 */
  signal:    ProjectSignalData | null;
  module:    ModuleSignalVM;
  campaign:  CampaignSignalVM;
  accounts:  ProjectAccountFacts | null;
}

export interface ProjectFactsResult {
  map: Map<string, ProjectFacts>;
  /** precomputed = 朝のバッチのみ / live = CSV から計算 */
  source: 'precomputed' | 'live';
  /** 事前計算で賄えた件数 */
  precomputed: number;
  requested:   number;
  /** live に落ちた理由。null = 事前計算で足りた */
  fallbackReason: string | null;
  /** 事前計算に無かったプロジェクト。黙って落とさず返す */
  missingIds: string[];
}

/**
 * 事前計算だけで進める最低カバー率。
 * これを下回ったら「バッチが動いていない」と判断して CSV に落ちる。
 */
const MIN_PRECOMPUTED_COVERAGE = 0.5;

/**
 * 指定プロジェクトの事実を返す。
 *
 * @param opts.forceLive true で事前計算を無視して CSV から計算する（検証用）
 */
export async function loadProjectFacts(
  projectIds: string[],
  opts: { forceLive?: boolean } = {},
): Promise<ProjectFactsResult> {
  const ids = [...new Set(projectIds.filter(Boolean))];
  if (ids.length === 0) {
    return {
      map: new Map(), source: 'precomputed',
      precomputed: 0, requested: 0, fallbackReason: null, missingIds: [],
    };
  }

  if (!opts.forceLive) {
    const rows = await fetchProjectMetrics(ids).catch(() => new Map<string, ProjectMetricRow>());
    const fresh = ids.filter(id => isFresh(rows.get(id)));

    const coverage = fresh.length / ids.length;

    // **欠けている数件のために CSV 5MB を落とすのは割に合わない。**
    // 実測（2026-08-22）: 有料PJ260件中243件（93%）が事前計算にあり、
    // 欠けた17件は **Metabase 側にも存在しない**PJだった。
    // つまり live に落ちても同じく空になる。
    // カバー率が大きく欠けている（＝バッチが動いていない）ときだけ live にする。
    if (coverage >= MIN_PRECOMPUTED_COVERAGE) {
      const map = new Map<string, ProjectFacts>();
      for (const id of fresh) map.set(id, fromMetricRow(rows.get(id)!));
      return {
        map, source: 'precomputed',
        precomputed: fresh.length, requested: ids.length,
        fallbackReason: null,
        missingIds: ids.filter(id => !isFresh(rows.get(id))),
      };
    }

    var reason = rows.size === 0
      ? '事前計算のデータがありません（朝のバッチ未実行）'
      : `事前計算が ${fresh.length}/${ids.length} 件（${Math.round(coverage * 100)}%）しか揃っていません`;
  }

  const [sigs, mods, camps, accts] = await Promise.all([
    fetchProjectSignalMap().catch(() => new Map<string, ProjectSignalData>()),
    fetchProjectModuleMap().catch(() => new Map()),
    fetchCampaignSummaryMap().catch(() => new Map()),
    fetchProjectAccountMap().catch(() => new Map()),
  ]);

  const map = new Map<string, ProjectFacts>();
  for (const id of ids) {
    const sig = sigs.get(id) ?? null;
    const acct = accts.get(id) ?? null;
    map.set(id, {
      projectId: id,
      signal: sig,
      module: buildModuleSignal({
        paidType:  sig?.paidType ?? null,
        data:      mods.get(id) ?? null,
        l30Active: sig?.l30Active ?? null,
      }),
      campaign: buildCampaignSignal(camps.get(id) ?? null),
      accounts: acct ? {
        operators:         acct.operators,
        operatorsPrev:     acct.operatorsPrev,
        internalOperators: acct.internalOperators,
        singleOperator:    acct.singleOperator,
        roleCounts:        acct.roleCounts,
        untouchedProducts: acct.untouchedProducts,
        operatorEmails:    acct.accounts
          .filter(a => !a.internal && a.weeks.slice(-4).some(w => w.activeDays > 0))
          .map(a => a.email),
        operatorEmailsPrev: acct.accounts
          .filter(a => !a.internal && a.weeks.slice(-8, -4).some(w => w.activeDays > 0))
          .map(a => a.email),
      } : null,
    });
  }

  return {
    map, source: 'live', precomputed: 0, requested: ids.length,
    fallbackReason: opts.forceLive ? '検証のため live 指定' : (reason ?? '事前計算が利用できません'),
    missingIds: ids.filter(id => !map.get(id)?.signal),
  };
}

// ── 事前計算の行 → 事実 ───────────────────────────────────────────────────────

function fromMetricRow(r: ProjectMetricRow): ProjectFacts {
  const plan = normalizePlan(r.paid_type);
  const unused = parseJson<string[]>(r.module_unused, []);

  // ⚠️ 表示に使う文言は判定ロジック側が正本なので、ここで作り直さない。
  //   事前計算には結論（verdict / activity）と数値だけを保存し、
  //   理由文はここで最小限に組み立てる。
  const module: ModuleSignalVM = {
    ...EMPTY_MODULE_SIGNAL,
    verdict:  (r.module_verdict as ModuleVerdict) ?? 'unevaluated',
    plan,
    entitled: entitledProducts(plan),
    used:     entitledProducts(plan).filter(p => !unused.includes(p)),
    unusedEntitled: unused,
    activePv:  r.module_active_pv ?? 0,
    deepPv:    r.module_deep_pv   ?? 0,
    activeModuleCount: r.module_count ?? 0,
    reasons:   moduleReason(r, unused),
    opportunities: unused.map(p => `${p} は契約済みで未使用。追加購入なしで価値を出せます`),
  };

  const campaign: CampaignSignalVM = {
    ...EMPTY_CAMPAIGN_SIGNAL,
    activity: (r.campaign_activity as CampaignActivity) ?? 'unknown',
    running:    r.campaign_running     ?? 0,
    ran30d:     r.campaign_ran_30d     ?? 0,
    created30d: r.campaign_created_30d ?? 0,
    daysSinceLastRun:   r.campaign_days_since_run ?? null,
    runningWithoutGoal: r.campaign_no_goal ?? 0,
    // 保存時に 0〜100 の整数（％）にしている（NocoDB の Number が小数不可）
    publishRate: r.campaign_publish_rate === null || r.campaign_publish_rate === undefined
      ? null : r.campaign_publish_rate / 100,
    reasons: campaignReason(r),
    opportunities: campaignOpportunities(r),
  };

  const signal: ProjectSignalData | null = r.l30_active === null && r.pv_ceiling === null
    ? null
    : {
        projectName: r.project_name ?? '',
        paidType:    r.paid_type,
        masterCompanyName: null,
        masterCompanySfId: r.company_uid?.replace(/^sf_/, '') ?? null,
        runningCampaignWithGoalCount: r.campaigns_with_goal ?? 0,
        heatmapCount:     0,
        firstHeatmapDate: null,
        pvCeiling:        r.pv_ceiling  ?? null,
        monthPvCount:     r.month_pv    ?? null,
        monthPvForecast:  r.pv_forecast ?? null,
        monthPeriodStartTime: r.period_start ?? null,
        monthPeriodEndTime:   r.period_end   ?? null,
        l30Active:      r.l30_active ?? 0,
        l7EventCount:   r.l7_events  ?? 0,
        lastActiveDate: r.last_active_date ?? null,
      };

  const operators = r.operators ?? 0;
  return {
    projectId: r.project_id,
    signal,
    module,
    campaign,
    accounts: r.operators === null || r.operators === undefined ? null : {
      operators,
      operatorsPrev:     r.operators_prev ?? 0,
      internalOperators: r.internal_operators ?? 0,
      singleOperator:    operators === 1,
      roleCounts:        parseJson<Record<string, number>>(r.role_counts, {}),
      untouchedProducts: parseJson<string[]>(r.untouched_products, []),
      operatorEmails:     parseJson<string[]>(r.operator_emails, []),
      operatorEmailsPrev: parseJson<string[]>(r.operator_emails_prev, []),
    },
  };
}

function moduleReason(r: ProjectMetricRow, unused: string[]): string[] {
  switch (r.module_verdict) {
    case 'dormant':
      return ['30日間、管理画面へのアクセスがありません', '同期間の計測イベントも0件です'];
    case 'unused':
      return ['30日間、着地画面より先に進んでいません（ログインはしているが機能を触っていない）'];
    case 'partial':
      return [`契約している ${unused.join('・')} を30日間使っていません`];
    case 'shallow':
      return ['施策や設定は触っていますが、分析・成果検証まで進んでいません'];
    case 'healthy':
      return [`実利用 ${(r.module_active_pv ?? 0).toLocaleString('ja-JP')}PV / ${r.module_count ?? 0}機能。分析・検証まで到達しています`];
    default:
      return ['管理画面の利用データがありません'];
  }
}

function campaignReason(r: ProjectMetricRow): string[] {
  const out: string[] = [];
  const days = r.campaign_days_since_run;
  switch (r.campaign_activity) {
    case 'active':
      out.push(`30日で ${r.campaign_created_30d ?? 0}本作成・${r.campaign_ran_30d ?? 0}本公開`); break;
    case 'stuck':
      out.push(`30日で ${r.campaign_created_30d ?? 0}本作ったが、1本も公開されていません`); break;
    case 'idle_run':
      out.push(`稼働中 ${r.campaign_running ?? 0}本ありますが、30日間の新規作成・公開はゼロです`
        + (days !== null ? `（最終公開 ${days}日前）` : '')); break;
    case 'stopped':
      out.push(days !== null ? `施策が止まっています（最終公開 ${days}日前）` : '公開された施策がありません'); break;
    default: break;
  }
  if ((r.campaign_no_goal ?? 0) > 0) {
    out.push(`配信中 ${r.campaign_no_goal}本がゴール未設定（効果を測れていません）`);
  }
  return out;
}

function campaignOpportunities(r: ProjectMetricRow): string[] {
  const out: string[] = [];
  if (r.campaign_activity === 'idle_run') {
    out.push('過去の施策が動き続けているだけの状態です。次の打ち手を一緒に決める余地があります');
  }
  if (r.campaign_activity === 'stuck') {
    out.push('作った施策が公開まで進んでいません。詰まっている理由を確認する余地があります');
  }
  if ((r.campaign_no_goal ?? 0) > 0) {
    out.push(`ゴール未設定の配信が${r.campaign_no_goal}本。成果を測れる状態にする提案ができます`);
  }
  return out;
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}
