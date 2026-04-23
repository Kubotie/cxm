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
// ── 応答パターン ──────────────────────────────────────────────────────────────
//   DolphinScheduler の HTTP タスクは 60 秒タイムアウトを持つ。
//   実際の処理（NocoDB × 5 + Metabase + 企業ループ）は 60 秒を超えることがあるため、
//   認証・バリデーション後に即座に 200 を返し、
//   Next.js after() でバックグラウンド処理する。
//   処理結果は Vercel ログ（console.log）で確認できる。
//
// ── DolphinScheduler 設定例 ───────────────────────────────────────────────────
//   タスク種別 : HTTP
//   URL        : https://your-app.vercel.app/api/batch/company-snapshot
//   メソッド   : POST
//   Http Parameters (HEADERS):
//     Authorization : Bearer {SUPPORT_BATCH_SECRET}
//     Content-Type  : application/json
//   Http Condition : {"dry_run": false, "limit": 500}
//   スケジュール: 毎日 03:00 JST (= 18:00 UTC 前日)
//
// ── リクエストボディ ─────────────────────────────────────────────────────────
//   dry_run?  : boolean  (default: false) — true なら NocoDB に書かず結果だけログ出力
//   limit?    : number   (default: 500, max: 1000)
//
// ── レスポンス（即時） ────────────────────────────────────────────────────────
//   { status: 'accepted', snapshot_date: string, dry_run: boolean, limit: number }
//   実際の書き込み結果は Vercel ログで確認する。

import { NextRequest, NextResponse }  from 'next/server';
import { after }                       from 'next/server';
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

// Vercel Pro で最大 300 秒まで実行を許可（after() バックグラウンド処理用）
export const maxDuration = 300;

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

// ── バックグラウンド処理本体 ──────────────────────────────────────────────────

async function runSnapshotJob(
  body:         RequestBody,
  snapshotDate: string,
  limit:        number,
  dryRun:       boolean,
): Promise<void> {
  const startedAt = new Date();
  console.log(`[batch/company-snapshot] 開始 dry_run=${dryRun} limit=${limit} date=${snapshotDate}`);

  // ── Step 1: 全企業リスト取得 ─────────────────────────────────────────────────
  let targets: Awaited<ReturnType<typeof resolveCompanySummaryTargets>>;
  try {
    targets = await resolveCompanySummaryTargets({ limit });
  } catch (err) {
    console.error('[batch/company-snapshot] 企業リスト取得失敗:', err);
    return;
  }

  if (targets.length === 0) {
    console.log('[batch/company-snapshot] 対象企業なし → 終了');
    return;
  }

  const allUids = targets.map(t => t.company.id);
  console.log(`[batch/company-snapshot] 対象企業数: ${allUids.length}`);

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

  for (const { company } of targets) {
    const uid = company.id;

    const csmPhase = csmMap.get(uid) ?? null;
    const crmPhase = crmMap.get(uid) ?? null;
    const mPhase   = csmPhase?.mPhase ?? null;

    const overallHealth: string | null = null;

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

    const support = supportMap.get(uid);
    const openSupportCount = support?.openCount ?? 0;

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
      writtenCount++;
    }
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  console.log(
    `[batch/company-snapshot] 完了 written=${writtenCount} failed=${failedCount} duration=${durationMs}ms`,
  );

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
}

// ── HTTP ハンドラ ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 認証 ────────────────────────────────────────────────────────────────────
  const authError = checkCronOrBatchAuth(req);
  if (authError) return authError;

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

  // ── バックグラウンドで実行（after はレスポンス送信後も継続する）──────────────
  after(() => runSnapshotJob(body, snapshotDate, limit, dryRun));

  // ── 即時 200 を返す（DolphinScheduler タイムアウト対策）─────────────────────
  return NextResponse.json({
    status:        'accepted',
    snapshot_date: snapshotDate,
    dry_run:       dryRun,
    limit,
    message:       'バックグラウンドで処理を開始しました。結果は Vercel ログで確認してください。',
  });
}
