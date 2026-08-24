// ─── POST/GET /api/batch/project-metrics ──────────────────────────────────────
//
// **内部系データの朝の事前計算。**
//
// Metabase の CSV（signals 4MB / modules 590KB / campaigns 800KB / accounts）を
// リクエスト経路から外すために、プロジェクト単位の判定を NocoDB に落とす。
//
// 実測（2026-08-22 / dev のコールドスタート）:
//   ボード7.0秒 / 準備度4.0秒 / 個社施策5.7秒 / PJ詳細4.2秒
// ウォームなら0〜1.4秒だが、Vercel はインスタンスごとにコールドを払うため
// プロセス内キャッシュでは解決しない。
//
// 対象は**有料プロジェクトのみ**（FREE 8,897件を毎朝書くのは無駄）。
// 書き込みは同じ project_id + metric_date があれば更新する。
//
// ⚠️ **1回で全件は終わらない。**
//   実測（2026-08-24）: Vercel 上で1,295件を処理しようとして
//   300秒の関数上限に当たり `FUNCTION_INVOCATION_TIMEOUT` になった
//   （ローカルは98秒。NocoDB への往復がリージョン差で遅い）。
//   時間予算内で処理して `remaining` を返し、呼び出し側がループする。
//
// ⚠️ 明細CSV（13.8MB）はここでは触らない。個社ページの施策セクション専用。

import { NextRequest, NextResponse } from 'next/server';
import { checkCronOrBatchAuth } from '@/lib/batch/auth';
import { fetchProjectSignalMap } from '@/lib/metabase/project-signals';
import { fetchProjectModuleMap } from '@/lib/metabase/project-modules';
import { fetchCampaignSummaryMap } from '@/lib/metabase/project-campaigns';
import { fetchProjectAccountMap } from '@/lib/metabase/project-accounts';
import { buildModuleSignal, normalizePlan } from '@/lib/company/module-signals';
import { buildCampaignSignal } from '@/lib/company/campaign-signals';
import {
  upsertProjectMetric, fetchMetricRowIds, isProjectMetricsEnabled, jstDate, jstStamp,
} from '@/lib/nocodb/project-metrics';

// ⚠️ 600 を指定してもプラン上限（300秒）で打ち切られた（実測 2026-08-24 / 323秒で応答なし）。
// 上限は延ばせないので、**書き込みを並列化**して1回で収める。
export const maxDuration = 300;

export async function GET(req: NextRequest)  { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  // 外部スケジューラ（DolphinScheduler）からも叩くため、必ず認証する。
  // CRON_SECRET / SUPPORT_BATCH_SECRET のいずれかを Bearer で要求する。
  const unauthorized = checkCronOrBatchAuth(req);
  if (unauthorized) return unauthorized;

  if (!isProjectMetricsEnabled()) {
    return NextResponse.json(
      { error: 'NOCODB_PROJECT_METRICS_TABLE_ID が未設定です' }, { status: 501 },
    );
  }

  const started = Date.now();
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? '0') || 0;
  const budgetSec = Math.min(
    Number(req.nextUrl.searchParams.get('budgetSec') ?? '240') || 240,
    280,
  );
  // NocoDB への書き込みを並列化する。
  // 逐次だと1,295件で約270秒かかり、300秒の関数上限に収まらない（実測）。
  // 上げすぎると NocoDB 側に負荷がかかるので控えめにする。
  const concurrency = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get('concurrency') ?? '6') || 6, 1),
    12,
  );
  const date = jstDate();
  const stamp = jstStamp();

  const [sigs, mods, camps, accts, knownIds] = await Promise.all([
    fetchProjectSignalMap().catch(() => new Map()),
    fetchProjectModuleMap().catch(() => new Map()),
    fetchCampaignSummaryMap().catch(() => new Map()),
    fetchProjectAccountMap().catch(() => new Map()),
    // 当日分の行IDをまとめて引く。1件ずつ SELECT すると往復が倍になる
    fetchMetricRowIds(date).catch(() => new Map<string, number>()),
  ]);

  // 有料のみ。FREE を毎朝書いても判断に使わない
  const all = [...sigs.entries()]
    .filter(([, s]) => ['PTI', 'PTX', 'BUNDLE'].includes(normalizePlan(s.paidType)));

  // **今日まだ書いていないものを先に処理する。** 途中で切れても次の呼び出しが続きを拾う。
  // ?rewrite=1 で当日分も含めて全件書き直す（コード変更後の再計算・実測用）
  const rewrite = req.nextUrl.searchParams.get('rewrite') === '1';
  const pending = rewrite ? all : all.filter(([pid]) => !knownIds.has(pid));
  const queue = (limit > 0 ? pending.slice(0, limit) : pending);

  let created = 0, updated = 0, failed = 0, processed = 0;
  const errors: string[] = [];

  let cursor = 0;
  let stop = false;

  async function worker() {
    while (!stop) {
      const idx = cursor++;
      if (idx >= queue.length) return;
      // 予算を超えたら全ワーカーを止める。残りは remaining で返す
      if ((Date.now() - started) / 1000 > budgetSec) { stop = true; return; }
      const [pid, sig] = queue[idx];
      processed++;
    const mod  = buildModuleSignal({
      paidType: sig.paidType, data: mods.get(pid) ?? null, l30Active: sig.l30Active,
    });
    const camp = buildCampaignSignal(camps.get(pid) ?? null);
    const acct = accts.get(pid) ?? null;

    const res = await upsertProjectMetric({
      project_id:   pid,
      company_uid:  sig.masterCompanySfId ? `sf_${sig.masterCompanySfId}` : null,
      metric_date:  date,
      project_name: sig.projectName || null,
      paid_type:    sig.paidType,

      module_verdict:   mod.verdict,
      module_active_pv: mod.activePv,
      module_deep_pv:   mod.deepPv,
      module_count:     mod.activeModuleCount,
      module_unused:    JSON.stringify(mod.unusedEntitled),

      campaign_activity:       camp.activity,
      campaign_running:        camp.running,
      campaign_ran_30d:        camp.ran30d,
      campaign_created_30d:    camp.created30d,
      campaign_days_since_run: camp.daysSinceLastRun,
      campaign_no_goal:        camp.runningWithoutGoal,
      // NocoDB の Number は bigint 相当で小数を受け付けない（実測でエラー）。
      // 公開率は 0〜100 の整数（％）で持つ
      campaign_publish_rate:   camp.publishRate === null ? null : Math.round(camp.publishRate * 100),

      operators:          acct?.operators ?? null,
      operators_prev:     acct?.operatorsPrev ?? null,
      internal_operators: acct?.internalOperators ?? null,
      role_counts:        acct ? JSON.stringify(acct.roleCounts) : null,
      untouched_products: acct ? JSON.stringify(acct.untouchedProducts) : null,
      // 企業横断で人数を重複排除するために、メールそのものを持つ
      operator_emails: acct
        ? JSON.stringify(acct.accounts
            .filter(a => !a.internal && a.weeks.slice(-4).some(w => w.activeDays > 0))
            .map(a => a.email))
        : null,
      operator_emails_prev: acct
        ? JSON.stringify(acct.accounts
            .filter(a => !a.internal && a.weeks.slice(-8, -4).some(w => w.activeDays > 0))
            .map(a => a.email))
        : null,

      l30_active:  sig.l30Active,
      l7_events:   sig.l7EventCount,
      pv_ceiling:  sig.pvCeiling,
      month_pv:    sig.monthPvCount,
      pv_forecast: sig.monthPvForecast,
      period_start: sig.monthPeriodStartTime,
      period_end:   sig.monthPeriodEndTime,
      last_active_date: sig.lastActiveDate,
      campaigns_with_goal: sig.runningCampaignWithGoalCount,
      habituation: null,

      computed_at_jst: stamp,
    }, knownIds.get(pid));

      if (!res.ok) {
        failed++;
        if (errors.length < 5) errors.push(`${pid}: ${res.error}`);
      } else if (res.created) created++;
      else updated++;
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return NextResponse.json({
    ok: failed === 0,
    date,
    /** 有料PJの総数 */
    total: all.length,
    /** 今回処理した件数 */
    processed,
    created, updated, failed,
    /** まだ今日書けていない件数。**0 になるまで呼び出し側がループする** */
    remaining: Math.max(0, pending.length - processed),
    budgetSec, concurrency,
    errors,
    elapsedSec: Math.round((Date.now() - started) / 1000),
  });
}
