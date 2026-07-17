// ─── POST /api/batch/company-snapshot-light ──────────────────────────────────
//
// Light snapshot batch. Tier 3 + is_paid_watched=true の企業を対象に、
// AI 依存フィールド (overall_health) を除いた決定論的シグナルだけを書き込む。
//
// ── Deep batch との差分 ──────────────────────────────────────────────────────
//   - 対象: tier=3 OR is_paid_watched=true（Deep は tier IN 1,2）
//   - overall_health: 常に null（AI サマリー呼び出しをスキップ）
//   - m_phase:        常に null（CSM フェーズは Tier 1/2 のみ管理）
//   - 他のフィールド（MRR / 契約 / support / project 集計）は Deep と同一
//
// ── 認証・スケジュール ────────────────────────────────────────────────────────
//   auth: checkCronOrBatchAuth
//   cron: 毎日 03:30 JST（Deep の 30 分後、Vercel Cron）

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { checkCronOrBatchAuth } from '@/lib/batch/auth';
import { writeBatchRunLog, sanitizeRequestParams } from '@/lib/batch/logger';
import { fetchLightWatchCompanies } from '@/lib/nocodb/companies';
import { fetchCrmPhasesByUids } from '@/lib/nocodb/phases';
import { fetchProjectsByUids } from '@/lib/nocodb/project-info';
import { fetchSupportCountsByUids } from '@/lib/nocodb/support-by-company';
import { fetchProjectMrrMap } from '@/lib/metabase/mrr';
import { fetchProjectUserActivityMap } from '@/lib/metabase/project-user-activity';
import { fetchProjectSignalMap } from '@/lib/metabase/project-signals';
import { buildProjectAggregateVM } from '@/lib/company/project-aggregate';
import { upsertCompanySnapshot, todayDateStr } from '@/lib/nocodb/company-snapshot';
import { upsertProjectUserSnapshot } from '@/lib/nocodb/project-user-snapshots';
import type { CompanyDailySnapshot } from '@/lib/nocodb/company-snapshot';
import { TABLE_IDS } from '@/lib/nocodb/client';

export const maxDuration = 300;

const DEFAULT_LIMIT = 2000;
const MAX_LIMIT     = 5000;

interface RequestBody {
  dry_run?: boolean;
  limit?:   number;
}

type RenewalBucket = '0-30' | '31-90' | '91-180' | '180+' | 'expired';

function computeRenewal(dateStr: string | null): {
  daysLeft: number | null;
  bucket:   RenewalBucket | null;
} {
  if (!dateStr) return { daysLeft: null, bucket: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const renewal = new Date(dateStr);
  const daysLeft = Math.floor((renewal.getTime() - today.getTime()) / 86_400_000);
  let bucket: RenewalBucket;
  if      (daysLeft < 0)   bucket = 'expired';
  else if (daysLeft <= 30)  bucket = '0-30';
  else if (daysLeft <= 90)  bucket = '31-90';
  else if (daysLeft <= 180) bucket = '91-180';
  else                      bucket = '180+';
  return { daysLeft, bucket };
}

async function runLightSnapshotJob(
  body:         RequestBody,
  snapshotDate: string,
  limit:        number,
  dryRun:       boolean,
): Promise<void> {
  const startedAt = new Date();
  console.log(`[batch/company-snapshot-light] 開始 dry_run=${dryRun} limit=${limit} date=${snapshotDate}`);

  const targets = await fetchLightWatchCompanies(limit).catch(err => {
    console.error('[batch/company-snapshot-light] 企業リスト取得失敗:', err);
    return [];
  });

  if (targets.length === 0) {
    console.log('[batch/company-snapshot-light] 対象企業なし → 終了');
    return;
  }

  const allUids = targets.map(t => t.id);
  console.log(`[batch/company-snapshot-light] 対象企業数: ${allUids.length}`);

  const [crmMap, projectMap, mrrMap, supportMap, activityMap, signalDataMap] = await Promise.all([
    fetchCrmPhasesByUids(allUids).catch(() =>
      new Map() as Awaited<ReturnType<typeof fetchCrmPhasesByUids>>,
    ),
    fetchProjectsByUids(allUids).catch(() =>
      new Map(allUids.map(u => [u, [] as import('@/lib/nocodb/types').AppProjectInfo[]])),
    ),
    fetchProjectMrrMap().catch(() => new Map()),
    fetchSupportCountsByUids(allUids).catch(() =>
      new Map() as Awaited<ReturnType<typeof fetchSupportCountsByUids>>,
    ),
    fetchProjectUserActivityMap().catch(() => new Map()),
    fetchProjectSignalMap().catch(() => new Map()),
  ]);

  let writtenCount = 0;
  let failedCount  = 0;

  for (const company of targets) {
    const uid = company.id;

    const projList = projectMap.get(uid) ?? [];
    let totalMrr = 0;
    let earliestEndDate: string | null = null;
    for (const p of projList) {
      const mrrData = mrrMap.get(p.id);
      if (mrrData) totalMrr += mrrData.mrr;
      const endDate = p.latestOrderEndDate ?? mrrData?.orderEndDate ?? null;
      if (endDate && (!earliestEndDate || endDate < earliestEndDate)) {
        earliestEndDate = endDate;
      }
    }

    const crmPhase    = crmMap.get(uid) ?? null;
    const renewalDate = crmPhase?.contractEndDate ?? earliestEndDate ?? null;
    const { bucket: renewalBucket } = computeRenewal(renewalDate);

    const support = supportMap.get(uid);
    const openSupportCount = support?.openCount ?? 0;

    const projectVM = projList.length > 0
      ? buildProjectAggregateVM(projList, activityMap, signalDataMap)
      : null;

    let runningCampaignTotal = 0;
    let pvCeilingAlertCount  = 0;
    for (const p of projList) {
      const sd = signalDataMap.get(p.id);
      if (!sd) continue;
      runningCampaignTotal += sd.runningCampaignWithGoalCount;
      if (sd.pvCeiling && sd.pvCeiling > 0 && sd.monthPvForecast != null) {
        if (sd.monthPvForecast / sd.pvCeiling >= 0.9) pvCeilingAlertCount++;
      }
    }

    const snapshot: Omit<CompanyDailySnapshot, 'Id'> = {
      company_uid:             uid,
      snapshot_date:           snapshotDate,
      m_phase:                 null,   // Light: CSM フェーズ未管理
      overall_health:          null,   // Light: AI 判定なし
      mrr:                     totalMrr > 0 ? totalMrr : null,
      open_support_count:      openSupportCount,
      renewal_bucket:          renewalBucket,
      renewal_date:            renewalDate,
      active_project_count:    projectVM?.paidActiveCount ?? null,
      stalled_project_count:   projectVM?.stalled         ?? null,
      total_l30_active:        projectVM?.totalL30Active  ?? null,
      running_campaign_total:  runningCampaignTotal > 0 ? runningCampaignTotal : null,
      pv_ceiling_alert_count:  pvCeilingAlertCount  > 0 ? pvCeilingAlertCount  : null,
    };

    if (!dryRun) {
      try {
        await upsertCompanySnapshot(snapshot);
        writtenCount++;
      } catch (err) {
        console.error(`[batch/company-snapshot-light] upsert 失敗 ${uid}:`, err);
        failedCount++;
      }

      // プロジェクト単位スナップショット（Deep と同じ）
      for (const p of projList) {
        const activity = activityMap.get(p.id);
        const sd       = signalDataMap.get(p.id);
        if (!activity && !sd) continue;
        await upsertProjectUserSnapshot({
          project_id:             p.id,
          company_uid:            uid,
          snapshot_date:          snapshotDate,
          total_users:            activity?.totalUsers            ?? null,
          l30_active_users:       activity?.l30ActiveUsers        ?? sd?.l30Active        ?? null,
          l7_active_users:        activity?.l7ActiveUsers         ?? sd?.l7EventCount     ?? null,
          running_campaign_count: sd?.runningCampaignWithGoalCount ?? null,
        }).catch(err => {
          console.warn(`[batch/company-snapshot-light] project snapshot upsert 失敗 ${p.id}:`, err);
        });
      }
    } else {
      writtenCount++;
    }
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  console.log(
    `[batch/company-snapshot-light] 完了 written=${writtenCount} failed=${failedCount} duration=${durationMs}ms`,
  );

  if (!dryRun) {
    await writeBatchRunLog({
      endpoint:        '/api/batch/company-snapshot-light',
      batch_type:      'company-snapshot-light',
      started_at:      startedAt.toISOString(),
      finished_at:     finishedAt.toISOString(),
      duration_ms:     durationMs,
      dry_run:         false,
      source_queue:    'companies:light-watch',
      request_params:  sanitizeRequestParams(body as Record<string, unknown>),
      filters:         JSON.stringify({ snapshot_date: snapshotDate }),
      total_targeted:  targets.length,
      ok_count:        writtenCount,
      success_count:   writtenCount,
      partial_count:   0,
      failed_count:    failedCount,
      skipped_count:   0,
      failure_details: '[]',
      result_json:     JSON.stringify({ snapshot_date: snapshotDate, written_count: writtenCount }),
    }).catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  const authError = checkCronOrBatchAuth(req);
  if (authError) return authError;

  const body: RequestBody = await req.json().catch(() => ({}));
  const dryRun       = body.dry_run ?? false;
  const rawLimit     = body.limit ?? DEFAULT_LIMIT;
  const limit        = Math.min(isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit, MAX_LIMIT);
  const snapshotDate = todayDateStr();

  if (!TABLE_IDS.company_daily_snapshot) {
    return NextResponse.json(
      { error: 'NOCODB_COMPANY_DAILY_SNAPSHOT_TABLE_ID が未設定です' },
      { status: 503 },
    );
  }

  after(() => runLightSnapshotJob(body, snapshotDate, limit, dryRun));

  return NextResponse.json({
    status:        'accepted',
    snapshot_date: snapshotDate,
    dry_run:       dryRun,
    limit,
    message:       'バックグラウンドで Light snapshot を開始しました。',
  });
}

// Vercel Cron からの GET
export async function GET(req: NextRequest) {
  const authError = checkCronOrBatchAuth(req);
  if (authError) return authError;

  const snapshotDate = todayDateStr();
  after(() => runLightSnapshotJob({}, snapshotDate, DEFAULT_LIMIT, false));

  return NextResponse.json({
    status:        'accepted',
    snapshot_date: snapshotDate,
    message:       'Vercel Cron 起動: Light snapshot バッチをバックグラウンドで開始しました。',
  });
}
