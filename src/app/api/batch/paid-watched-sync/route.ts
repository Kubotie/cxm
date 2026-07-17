// ─── POST /api/batch/paid-watched-sync ────────────────────────────────────────
//
// project_info テーブルから有料 (paid_type=%PAID%、契約中) の企業を抽出し、
// NocoDB companies.is_paid_watched を同期する。
//
// ── ハードミラー動作 ──────────────────────────────────────────────────────────
//   1. project_info から paid_type=%PAID% & latest_order_end_date >= today の企業を集計
//   2. NocoDB companies.is_paid_watched を対応する行に true セット
//   3. is_paid_watched=true だが有料リストに無い企業は false にクリア
//   → Metabase 側の paid ステータスに完全追従
//
// ── Tier との関係 ─────────────────────────────────────────────────────────────
//   is_paid_watched は tier とは独立フラグ。
//   Tier 1/2 も是永 is_paid_watched=true（当然有料）。
//   Light snapshot batch は tier=3 OR is_paid_watched=true をカバーする。
//
// ── 認証 ─────────────────────────────────────────────────────────────────────
//   checkCronOrBatchAuth（CRON_SECRET / SUPPORT_BATCH_SECRET）
//
// ── スケジュール ─────────────────────────────────────────────────────────────
//   Vercel Cron: 毎日 02:30 JST（tier-sync の 30分後）

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { checkCronOrBatchAuth } from '@/lib/batch/auth';
import { writeBatchRunLog, sanitizeRequestParams } from '@/lib/batch/logger';
import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';
import { nocoUpdate } from '@/lib/nocodb/write';
import { fetchPaidCompanySfIds } from '@/lib/metabase/paid-companies';
import type { RawCompany } from '@/lib/nocodb/types';

export const maxDuration = 300;

interface RequestBody {
  dry_run?: boolean;
}

interface SyncResult {
  paid_project_rows: number;
  paid_sf_ids:       number;
  db_matched:        number;
  db_unmatched:      number;
  set_true:          number;   // false → true にした件数
  set_false:         number;   // true → false にクリアした件数
  unchanged:         number;
  failed:            number;
  changes: {
    turned_on:  Array<{ sfAccountId: string; companyUid: string; canonicalName: string | null }>;
    turned_off: Array<{ sfAccountId: string; companyUid: string; canonicalName: string | null }>;
  };
  unmatched_sf_ids: string[];
}

function toBoolLoose(raw: unknown): boolean {
  return raw === true || raw === 'true' || raw === 1 || raw === '1';
}

async function runPaidWatchedSync(dryRun: boolean): Promise<SyncResult> {
  const startedAt = new Date();
  console.log(`[batch/paid-watched-sync] 開始 dry_run=${dryRun}`);

  const { sfAccountIds: paidSet, projectRowCount } = await fetchPaidCompanySfIds();
  console.log(
    `[batch/paid-watched-sync] paid projects=${projectRowCount} unique sf_ids=${paidSet.size}`,
  );

  const result: SyncResult = {
    paid_project_rows: projectRowCount,
    paid_sf_ids:       paidSet.size,
    db_matched:        0,
    db_unmatched:      0,
    set_true:          0,
    set_false:         0,
    unchanged:         0,
    failed:            0,
    changes:           { turned_on: [], turned_off: [] },
    unmatched_sf_ids:  [],
  };

  if (!TABLE_IDS.companies) return result;

  // ── NocoDB companies を "paid リスト内 OR 現在 is_paid_watched=true" 両方取得 ──
  //    - paid リスト内 → true をセット
  //    - 現在 true だが paid リストに無い → false にクリア
  const paidSfIdList = Array.from(paidSet);

  // 1) paid リスト内の企業を取得
  const paidRows = paidSfIdList.length > 0
    ? await nocoFetch<RawCompany>(TABLE_IDS.companies, {
        where:  `(sf_account_id,in,${paidSfIdList.join(',')})`,
        fields: 'Id,company_uid,sf_account_id,canonical_name,is_paid_watched',
        limit:  String(paidSfIdList.length + 100),
      }, false).catch(err => {
        console.error('[batch/paid-watched-sync] paid rows 取得失敗:', err);
        return [] as RawCompany[];
      })
    : [];

  const matchedSfIds = new Set<string>();
  for (const row of paidRows) {
    if (row.Id == null) continue;
    const sfId = row.sf_account_id?.toString().trim();
    if (!sfId) continue;
    matchedSfIds.add(sfId);
    result.db_matched++;

    const current = toBoolLoose(row.is_paid_watched);
    if (current === true) {
      result.unchanged++;
      continue;
    }

    result.changes.turned_on.push({
      sfAccountId: sfId,
      companyUid:  row.company_uid,
      canonicalName: row.canonical_name ?? null,
    });

    if (dryRun) {
      result.set_true++;
      continue;
    }
    try {
      await nocoUpdate(TABLE_IDS.companies, row.Id, { is_paid_watched: true });
      result.set_true++;
    } catch (err) {
      console.error(`[batch/paid-watched-sync] set-true 失敗 uid=${row.company_uid}:`, err);
      result.failed++;
    }
  }

  // paid リストに含まれるが NocoDB に無い sfId
  for (const sfId of paidSet) {
    if (!matchedSfIds.has(sfId)) {
      result.db_unmatched++;
      result.unmatched_sf_ids.push(sfId);
    }
  }

  // 2) 現在 is_paid_watched=true の企業を全件取得し、paid リストに無ければ false へ
  const trueRows = await nocoFetch<RawCompany>(TABLE_IDS.companies, {
    where:  '(is_paid_watched,eq,true)',
    fields: 'Id,company_uid,sf_account_id,canonical_name,is_paid_watched',
    limit:  '2000',
  }, false).catch(err => {
    console.error('[batch/paid-watched-sync] true rows 取得失敗:', err);
    return [] as RawCompany[];
  });

  for (const row of trueRows) {
    if (row.Id == null) continue;
    const sfId = row.sf_account_id?.toString().trim() ?? '';
    if (sfId && paidSet.has(sfId)) continue; // まだ paid → 変更なし

    result.changes.turned_off.push({
      sfAccountId: sfId,
      companyUid:  row.company_uid,
      canonicalName: row.canonical_name ?? null,
    });

    if (dryRun) {
      result.set_false++;
      continue;
    }
    try {
      await nocoUpdate(TABLE_IDS.companies, row.Id, { is_paid_watched: false });
      result.set_false++;
    } catch (err) {
      console.error(`[batch/paid-watched-sync] set-false 失敗 uid=${row.company_uid}:`, err);
      result.failed++;
    }
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  console.log(
    `[batch/paid-watched-sync] 完了 paid=${paidSet.size} set_true=${result.set_true} ` +
    `set_false=${result.set_false} unchanged=${result.unchanged} failed=${result.failed} ` +
    `duration=${durationMs}ms`,
  );

  if (!dryRun) {
    await writeBatchRunLog({
      endpoint:        '/api/batch/paid-watched-sync',
      batch_type:      'paid-watched-sync',
      started_at:      startedAt.toISOString(),
      finished_at:     finishedAt.toISOString(),
      duration_ms:     durationMs,
      dry_run:         false,
      source_queue:    'nocodb:project_info',
      request_params:  sanitizeRequestParams({}),
      filters:         '{}',
      total_targeted:  paidSet.size,
      ok_count:        result.set_true + result.set_false + result.unchanged,
      success_count:   result.set_true + result.set_false,
      partial_count:   0,
      failed_count:    result.failed,
      skipped_count:   result.unchanged,
      failure_details: '[]',
      result_json:     JSON.stringify({
        paid_project_rows: result.paid_project_rows,
        paid_sf_ids:       result.paid_sf_ids,
        db_matched:        result.db_matched,
        db_unmatched:      result.db_unmatched,
      }),
    }).catch(() => {});
  }

  return result;
}

export async function POST(req: NextRequest) {
  const authError = checkCronOrBatchAuth(req);
  if (authError) return authError;

  const body: RequestBody = await req.json().catch(() => ({}));
  const dryRun = body.dry_run ?? false;

  if (!TABLE_IDS.companies || !TABLE_IDS.project_info) {
    return NextResponse.json(
      { error: 'NOCODB_COMPANIES_TABLE_ID / NOCODB_PROJECT_INFO_TABLE_ID が未設定です' },
      { status: 503 },
    );
  }

  if (dryRun) {
    try {
      const result = await runPaidWatchedSync(true);
      return NextResponse.json({ status: 'ok', dry_run: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  after(() => runPaidWatchedSync(false).catch(err =>
    console.error('[batch/paid-watched-sync] background 例外:', err),
  ));

  return NextResponse.json({
    status:  'accepted',
    dry_run: false,
    message: 'バックグラウンドで paid-watched 同期を開始しました。',
  });
}

// Vercel Cron は GET で叩く
export async function GET(req: NextRequest) {
  const authError = checkCronOrBatchAuth(req);
  if (authError) return authError;

  after(() => runPaidWatchedSync(false).catch(err =>
    console.error('[batch/paid-watched-sync] background 例外:', err),
  ));

  return NextResponse.json({
    status:  'accepted',
    dry_run: false,
    message: 'Vercel Cron 起動: バックグラウンドで paid-watched 同期を開始しました。',
  });
}
