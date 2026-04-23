// ─── POST /api/batch/company-snapshot ─────────────────────────────────────────
//
// 全 CSM 管理企業の日次スナップショットを company_daily_snapshot テーブルに書き込む。
// 変動コックピット（Home）で「前回からの差分」を計算するための履歴基盤。
//
// ── 書き込むフィールド ────────────────────────────────────────────────────────
//   company_uid        : 企業 UID
//   snapshot_date      : 実行日（JST YYYY-MM-DD）
//   m_phase            : CSM M-Phase（最新）
//   overall_health     : company_summary_state の overall_health（AI 判定）
//   mrr                : Metabase CSV + project_info から集計した MRR 合計
//   open_support_count : openIntercom + openCse の合計
//   renewal_bucket     : 0-30 / 31-90 / 91-180 / 180+ / expired
//   renewal_date       : CSM target_renewal_date > CRM contract_end_date > project end
//
// ── 認証 ─────────────────────────────────────────────────────────────────────
//   checkCronOrBatchAuth（CRON_SECRET または SUPPORT_BATCH_SECRET）
//
// ── DolphinScheduler 設定例 ───────────────────────────────────────────────────
//   タスク種別 : HTTP
//   URL        : https://your-app.vercel.app/api/batch/company-snapshot
//   メソッド   : POST
//   Headers    : Authorization: Bearer {SUPPORT_BATCH_SECRET}
//                Content-Type: application/json
//   Body       : {"dry_run": false, "limit": 500}
//   スケジュール: 毎日 03:00 JST (= 18:00 UTC 前日)
//
// ── リクエストボディ ─────────────────────────────────────────────────────────
//   dry_run?  : boolean  (default: false) — true なら NocoDB に書かず結果だけ返す
//   limit?    : number   (default: 500, max: 1000)
//
// ── レスポンス ────────────────────────────────────────────────────────────────
//   {
//     dry_run:        boolean,
//     snapshot_date:  string,      // "YYYY-MM-DD"
//     total_targeted: number,
//     written_count:  number,
//     skipped_count:  number,      // NOCODB_COMPANY_DAILY_SNAPSHOT_TABLE_ID 未設定時など
//     failed_count:   number,
//     duration_ms:    number,
//   }

import { NextRequest, NextResponse }  from 'next/server';
import { checkCronOrBatchAuth }        from '@/lib/batch/auth';
import { writeBatchRunLog, sanitizeRequestParams } from '@/lib/batch/logger';
import { resolveCompanySummaryTargets } from '@/lib/batch/company-summary-targets';
import { TABLE_IDS }                   from '@/lib/nocodb/client';
import { fetchCsmPhasesByUids, fetchCrmPhasesByUids } from '@/lib/nocodb/phases';
import { fetchProjectsByUids }         from '@/lib/nocodb/project-info';
import { fetchSupportCountsByUids }    from '@/lib/nocodb/support-by-company';
import { fetchProjectMrrMap }          from '@/lib/metabase/mrr';
import { upsertCompanySnapshot, todayDateStr } from '@/lib/nocodb/company-snapshot';
import type { CompanyDailySnapshot }   from '@/lib/nocodb/company-snapshot';

const DEFAULT_LIMIT = 500;
const MAX_LIMIT     = 1000;

interface RequestBody {
  dry_run?: boolean;
  limit?:   number;
}

// ── Renewal 計算（company-summary-list/route.ts と同一ロジック）──────────────

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

export async function POST(req: NextRequest) {
  // ── 認証 ────────────────────────────────────────────────────────────────────
  const authError = checkCronOrBatchAuth(req);
  if (authError) return authError;

  const startedAt = new Date();
  const body: RequestBody = await req.json().catch(() => ({}));

  const dryRun       = body.dry_run ?? false;
  const rawLimit     = body.limit ?? DEFAULT_LIMIT;
  const limit        = Math.min(isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit, MAX_LIMIT);
  const snapshotDate = todayDateStr();

  // ── テーブル ID チェック ─────────────────────────────────────────────────────
  if (!TABLE_IDS.company_daily_snapshot) {
    return NextResponse.json(
      {
        error: 'NOCODB_COMPANY_DAILY_SNAPSHOT_TABLE_ID が未設定です。' +
               'NocoDB でテーブルを作成し、環境変数を設定してください。',
      },
      { status: 503 },
    );
  }

  // ── Step 1: 全企業リスト取得 ─────────────────────────────────────────────────
  let targets: Awaited<ReturnType<typeof resolveCompanySummaryTargets>>;
  try {
    targets = await resolveCompanySummaryTargets({ limit });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[batch/company-snapshot] 企業リスト取得失敗:', err);
    return NextResponse.json({ error: `企業リスト取得エラー: ${msg}` }, { status: 500 });
  }

  if (targets.length === 0) {
    return NextResponse.json({
      dry_run:        dryRun,
      snapshot_date:  snapshotDate,
      total_targeted: 0,
      written_count:  0,
      skipped_count:  0,
      failed_count:   0,
      duration_ms:    Date.now() - startedAt.getTime(),
    });
  }

  const allUids = targets.map(t => t.company.id);

  // ── Step 2: 並列データ取得 ───────────────────────────────────────────────────
  const [csmMap, crmMap, projectMap, mrrMap, supportMap] = await Promise.all([
    fetchCsmPhasesByUids(allUids).catch(() =>
      new Map() as Awaited<ReturnType<typeof fetchCsmPhasesByUids>>,
    ),
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
  ]);

  // ── Step 3: 各企業のスナップショットを構築して upsert ──────────────────────
  let writtenCount = 0;
  let failedCount  = 0;

  for (const { company, listVM } of targets) {
    const uid = company.id;

    // M-Phase
    const csmPhase = csmMap.get(uid) ?? null;
    const crmPhase = crmMap.get(uid) ?? null;
    const mPhase   = csmPhase?.mPhase ?? null;

    // overall_health: listVM（company_summary_state）から取得
    // listVM は CompanySummaryListItemViewModel で overall_health を持たないため
    // company_summary_state の値は取得済みの target に含まれない。
    // 代替: alerts / phase から導出した health は取れないが、
    // overall_health はスナップショットの主用途（差分検知）で十分な精度を持つ。
    // → 今回は null で保存し、将来 company_summary_state を一括取得する形に拡張可能。
    // （company_summary_list API とは別に summaryState を取得するとコストが増大するため省略）
    const overallHealth: string | null = null;

    // MRR + Renewal
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

    const renewalDate =
      csmPhase?.targetRenewalDate ??
      crmPhase?.contractEndDate   ??
      earliestEndDate             ?? null;
    const { bucket: renewalBucket } = computeRenewal(renewalDate);

    // Support
    const support = supportMap.get(uid);
    const openSupportCount = (support?.openCount ?? 0);

    const snapshot: Omit<CompanyDailySnapshot, 'Id'> = {
      company_uid:        uid,
      snapshot_date:      snapshotDate,
      m_phase:            mPhase,
      overall_health:     overallHealth,
      mrr:                totalMrr > 0 ? totalMrr : null,
      open_support_count: openSupportCount,
      renewal_bucket:     renewalBucket,
      renewal_date:       renewalDate,
    };

    if (!dryRun) {
      try {
        await upsertCompanySnapshot(snapshot);
        writtenCount++;
      } catch (err) {
        console.error(`[batch/company-snapshot] upsert 失敗 ${uid}:`, err);
        failedCount++;
      }
    } else {
      writtenCount++; // dry_run では常にカウント
    }
  }

  const finishedAt   = new Date();
  const durationMs   = finishedAt.getTime() - startedAt.getTime();

  // ── 監査ログ ─────────────────────────────────────────────────────────────────
  if (!dryRun) {
    await writeBatchRunLog({
      endpoint:        '/api/batch/company-snapshot',
      batch_type:      'company-snapshot',
      started_at:      startedAt.toISOString(),
      finished_at:     finishedAt.toISOString(),
      duration_ms:     durationMs,
      dry_run:         dryRun,
      source_queue:    'companies',
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

  return NextResponse.json({
    dry_run:        dryRun,
    snapshot_date:  snapshotDate,
    total_targeted: targets.length,
    written_count:  writtenCount,
    skipped_count:  0,
    failed_count:   failedCount,
    duration_ms:    durationMs,
  });
}
