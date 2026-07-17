// ─── POST /api/batch/tier-sync ────────────────────────────────────────────────
//
// Metabase の Tier マスター CSV を SSOT として、NocoDB companies.tier を同期する。
//
// ── 動作（ハードミラー） ──────────────────────────────────────────────────────
//   1. Metabase 公開 CSV から Tier 一覧を取得
//   2. NocoDB companies を sf_account_id で照合
//   3. CSV にある企業: tier が異なれば PATCH（無変化はスキップ）
//   4. NocoDB で tier IN (1,2,3,5) だが CSV に無い企業: tier=null にクリア
//   → NocoDB を CSV に完全追従させる
//
// ── 認証 ─────────────────────────────────────────────────────────────────────
//   checkCronOrBatchAuth（CRON_SECRET または SUPPORT_BATCH_SECRET）
//
// ── スケジュール ─────────────────────────────────────────────────────────────
//   Vercel Cron: 毎日 02:00 JST（= 17:00 UTC 前日）
//
// ── リクエストボディ ─────────────────────────────────────────────────────────
//   dry_run? : boolean (default: false) — true なら NocoDB を書き換えず結果だけ返す
//
// ── レスポンス ───────────────────────────────────────────────────────────────
//   dry_run=true : 処理結果を同期返却
//   dry_run=false: 即時 accepted、実処理は after() で実行、結果は Vercel ログ

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { checkCronOrBatchAuth } from '@/lib/batch/auth';
import { writeBatchRunLog, sanitizeRequestParams } from '@/lib/batch/logger';
import { nocoFetch, TABLE_IDS } from '@/lib/nocodb/client';
import { nocoUpdate } from '@/lib/nocodb/write';
import { fetchTierRows, type TierRow, type TierValue } from '@/lib/metabase/tier-info';
import type { RawCompany } from '@/lib/nocodb/types';

export const maxDuration = 300;

interface RequestBody {
  dry_run?: boolean;
}

interface SyncResult {
  csv_rows:       number;
  db_matched:     number;
  db_unmatched:   number;
  updated:        number;
  unchanged:      number;
  cleared:        number;
  failed:         number;
  changes:        Array<{
    sfAccountId: string;
    companyUid:  string;
    canonicalName: string | null;
    from: number | null;
    to:   TierValue | null;
  }>;
  cleared_rows: Array<{
    sfAccountId: string | null;
    companyUid:  string;
    canonicalName: string | null;
    from: number | null;
  }>;
  unmatched_sf_ids: string[];
}

function normalizeCurrentTier(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : null;
}

async function runTierSync(dryRun: boolean): Promise<SyncResult> {
  const startedAt = new Date();
  console.log(`[batch/tier-sync] 開始 dry_run=${dryRun}`);

  const rows: TierRow[] = await fetchTierRows();
  console.log(`[batch/tier-sync] CSV 行数=${rows.length}`);

  const bySfId = new Map<string, TierRow>();
  for (const r of rows) bySfId.set(r.sfAccountId, r);

  const result: SyncResult = {
    csv_rows:         rows.length,
    db_matched:       0,
    db_unmatched:     0,
    updated:          0,
    unchanged:        0,
    cleared:          0,
    failed:           0,
    changes:          [],
    cleared_rows:     [],
    unmatched_sf_ids: [],
  };

  if (rows.length === 0 || !TABLE_IDS.companies) {
    return result;
  }

  // ── NocoDB companies を sf_account_id 一括取得（キャッシュ回避）──────────
  const sfIds = rows.map(r => r.sfAccountId);
  const where = `(sf_account_id,in,${sfIds.join(',')})`;
  const companies = await nocoFetch<RawCompany>(TABLE_IDS.companies, {
    where,
    fields: 'Id,company_uid,sf_account_id,canonical_name,tier',
    limit:  String(sfIds.length + 50),
  }, false).catch(err => {
    console.error('[batch/tier-sync] companies 取得失敗:', err);
    return [] as RawCompany[];
  });

  const dbBySfId = new Map<string, RawCompany>();
  for (const c of companies) {
    const sfId = c.sf_account_id?.toString().trim();
    if (sfId) dbBySfId.set(sfId, c);
  }

  // ── 差分計算と PATCH ─────────────────────────────────────────────────────────
  for (const row of rows) {
    const dbRow = dbBySfId.get(row.sfAccountId);
    if (!dbRow || dbRow.Id == null) {
      result.db_unmatched++;
      result.unmatched_sf_ids.push(row.sfAccountId);
      continue;
    }
    result.db_matched++;

    const currentTier = normalizeCurrentTier(dbRow.tier);
    const desiredTier = row.tier;
    if (currentTier === desiredTier) {
      result.unchanged++;
      continue;
    }

    result.changes.push({
      sfAccountId:   row.sfAccountId,
      companyUid:    dbRow.company_uid,
      canonicalName: dbRow.canonical_name ?? null,
      from:          currentTier,
      to:            desiredTier,
    });

    if (dryRun) {
      result.updated++;
      continue;
    }

    try {
      await nocoUpdate(TABLE_IDS.companies, dbRow.Id, { tier: desiredTier });
      result.updated++;
    } catch (err) {
      console.error(`[batch/tier-sync] update 失敗 ${row.sfAccountId}:`, err);
      result.failed++;
    }
  }

  // ── CSV に無いのに tier がセットされている行を null にクリア ─────────────
  const csvSfIdSet = new Set(sfIds);
  const staleRows = await nocoFetch<RawCompany>(TABLE_IDS.companies, {
    where:  '(tier,gt,0)',
    fields: 'Id,company_uid,sf_account_id,canonical_name,tier',
    limit:  '1000',
  }, false).catch(err => {
    console.error('[batch/tier-sync] stale rows 取得失敗:', err);
    return [] as RawCompany[];
  });

  for (const dbRow of staleRows) {
    if (dbRow.Id == null) continue;
    const sfId = dbRow.sf_account_id?.toString().trim() ?? null;
    if (sfId && csvSfIdSet.has(sfId)) continue;

    const currentTier = normalizeCurrentTier(dbRow.tier);
    result.cleared_rows.push({
      sfAccountId:   sfId,
      companyUid:    dbRow.company_uid,
      canonicalName: dbRow.canonical_name ?? null,
      from:          currentTier,
    });

    if (dryRun) {
      result.cleared++;
      continue;
    }

    try {
      await nocoUpdate(TABLE_IDS.companies, dbRow.Id, { tier: null });
      result.cleared++;
    } catch (err) {
      console.error(`[batch/tier-sync] clear 失敗 uid=${dbRow.company_uid}:`, err);
      result.failed++;
    }
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  console.log(
    `[batch/tier-sync] 完了 matched=${result.db_matched} updated=${result.updated} ` +
    `unchanged=${result.unchanged} cleared=${result.cleared} failed=${result.failed} ` +
    `duration=${durationMs}ms`,
  );

  if (!dryRun) {
    await writeBatchRunLog({
      endpoint:        '/api/batch/tier-sync',
      batch_type:      'tier-sync',
      started_at:      startedAt.toISOString(),
      finished_at:     finishedAt.toISOString(),
      duration_ms:     durationMs,
      dry_run:         false,
      source_queue:    'metabase:tier-info',
      request_params:  sanitizeRequestParams({}),
      filters:         '{}',
      total_targeted:  rows.length,
      ok_count:        result.updated + result.unchanged + result.cleared,
      success_count:   result.updated + result.cleared,
      partial_count:   0,
      failed_count:    result.failed,
      skipped_count:   result.unchanged,
      failure_details: '[]',
      result_json:     JSON.stringify({
        csv_rows:     result.csv_rows,
        db_matched:   result.db_matched,
        db_unmatched: result.db_unmatched,
        cleared:      result.cleared,
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

  if (!TABLE_IDS.companies) {
    return NextResponse.json(
      { error: 'NOCODB_COMPANIES_TABLE_ID が未設定です' },
      { status: 503 },
    );
  }

  // dry_run は同期実行して結果を返す（挙動確認用）
  if (dryRun) {
    try {
      const result = await runTierSync(true);
      return NextResponse.json({ status: 'ok', dry_run: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // 本番はバックグラウンド実行、即時 accepted を返す
  after(() => runTierSync(false).catch(err =>
    console.error('[batch/tier-sync] background 例外:', err),
  ));

  return NextResponse.json({
    status:  'accepted',
    dry_run: false,
    message: 'バックグラウンドで tier 同期を開始しました。結果は Vercel ログで確認してください。',
  });
}

// GET は Vercel Cron から叩かれる想定。バックグラウンドで本番同期を走らせて即時 accepted を返す。
// dry_run で試したい場合は POST に切り替えて body で {"dry_run":true} を指定する。
export async function GET(req: NextRequest) {
  const authError = checkCronOrBatchAuth(req);
  if (authError) return authError;

  after(() => runTierSync(false).catch(err =>
    console.error('[batch/tier-sync] background 例外:', err),
  ));

  return NextResponse.json({
    status:  'accepted',
    dry_run: false,
    message: 'Vercel Cron 起動: バックグラウンドで tier 同期を開始しました。',
  });
}
