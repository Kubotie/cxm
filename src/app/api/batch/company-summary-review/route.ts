// ─── POST /api/batch/company-summary-review ──────────────────────────────────
// 全 CSM 管理企業（または指定 UID）の Company Summary を一括レビュー済みに更新する
// DolphinScheduler 向けバッチ入口。
//
// ── 上書き可否ルール（human_review_status の遷移）────────────────────────────
//
//   pending   → reviewed  ✅ 可（AI 生成後に未確認 → レビュー済みに昇格）
//   reviewed  → reviewed  ✅ 可（冪等。再実行しても問題なし）
//   corrected → reviewed  ✅ 可（手修正済みも一括レビュー対象に含める）
//   null      → reviewed  ✅ 可（isUnreviewed=true として扱う）
//   approved  → reviewed  ❌ 不可（approved は一括変更禁止。個別 confirm が必要）
//
//   ※ missing（summary レコードが存在しない）は skip（レコードがないため更新不可）
//
// ── skip 区分 ─────────────────────────────────────────────────────────────────
//   skipped_missing : freshnessStatus === 'missing'（summary レコードなし）
//   skipped_locked  : isApproved=true（approved 保護）
//
// ── リクエストボディ ──────────────────────────────────────────────────────────
// {
//   company_uids?:  string[];     // 指定 UID のみ対象（省略時は全 CSM 管理企業）
//   limit?:         number;       // 最大処理件数 (default: 50, max: 200)
//   reviewed_by?:   string;       // レビュー実施者（省略可）
//   summary_type?:  string;       // default: "default"
//   dry_run?:       boolean;      // true のとき対象一覧だけ返し、write しない
// }
//
// ── レスポンス（通常） ────────────────────────────────────────────────────────
// {
//   dry_run:               false,
//   started_at:            ISO8601,
//   finished_at:           ISO8601,
//   duration_ms:           number,
//   limit:                 number,
//   total_targeted:        number,
//   ok_count:              number,   // pending/reviewed/corrected/null → reviewed に更新
//   skipped_missing_count: number,   // summary レコードなし（fresh 化まで skip）
//   skipped_locked_count:  number,   // approved 保護で skip
//   failed_count:          number,
//   failures:              [{ company_uid, company_name, reason }],
//   results:               [{ company_uid, company_name, status, skip_category?,
//                             freshness_status, human_review_status,
//                             previous_review_status, skip_reason?, error? }],
// }
//
// ── レスポンス（dry_run=true） ─────────────────────────────────────────────────
// {
//   dry_run:               true,
//   limit:                 number,
//   total_targeted:        number,
//   ok_count:              number,   // 実行した場合に更新される見込み件数
//   skipped_missing_count: number,
//   skipped_locked_count:  number,
//   target_companies:      [{
//     company_uid,
//     company_name,
//     freshness_status,
//     human_review_status,
//     can_bulk_approve,
//     review_group_label,
//     skip_reason,         // skip される場合のみ
//   }],
//   note: string,
// }
//
// ── 保護方針 ─────────────────────────────────────────────────────────────────
// - status=approved をリクエストした場合は 400 エラー（一括承認は禁止）
// - isApproved=true（approved 済み）は skipped_locked として skip
// - summary が存在しない（missing）は skipped_missing として skip
// - source tables（companies, evidence, alerts, people）は一切更新しない

import { NextRequest, NextResponse }     from 'next/server';
import { checkBatchAuth }                from '@/lib/batch/auth';
import { writeBatchRunLog, sanitizeRequestParams } from '@/lib/batch/logger';
import { resolveCompanySummaryTargets }  from '@/lib/batch/company-summary-targets';
import { TABLE_IDS, nocoFetch }          from '@/lib/nocodb/client';
import { nocoUpdate }                    from '@/lib/nocodb/write';
import type { RawCompanySummaryState }   from '@/lib/nocodb/types';
import type { SummaryFreshnessStatus }   from '@/lib/company/company-summary-state-policy';
import type { CompanySummaryTargetItem } from '@/lib/batch/company-summary-targets';

// ── 定数 ─────────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 200;
const DEFAULT_TYPE  = 'default';

// batch review で許可するステータス（approved は個別 confirm が必要なため禁止）
const ALLOWED_STATUSES = new Set<string>(['reviewed']);

// ── skip 区分 ─────────────────────────────────────────────────────────────────

type SkipCategory = 'skipped_missing' | 'skipped_locked';

// ── 型定義 ───────────────────────────────────────────────────────────────────

interface RequestBody {
  company_uids?:  string[];
  limit?:         number;
  reviewed_by?:   string;
  summary_type?:  string;
  dry_run?:       boolean;
}

interface CompanyResult {
  company_uid:            string;
  company_name:           string;
  /** ok | skipped_missing | skipped_locked | failed */
  status:                 'ok' | SkipCategory | 'failed';
  freshness_status:       SummaryFreshnessStatus;
  /** 更新後の human_review_status（ok の場合は "reviewed"、それ以外は変更前の値） */
  human_review_status:    string | null;
  /** ok の場合のみ。更新前の human_review_status */
  previous_review_status?: string | null;
  skip_reason?:           string;
  error?:                 string;
}

interface DryRunTarget {
  company_uid:         string;
  company_name:        string;
  freshness_status:    SummaryFreshnessStatus;
  human_review_status: string | null;
  can_bulk_approve:    boolean;
  review_group_label:  string;
  /** skip される場合のみ付与 */
  skip_reason?:        string;
}

interface Failure {
  company_uid:  string;
  company_name: string;
  reason:       string;
}

// ── per-company 処理 ──────────────────────────────────────────────────────────

async function reviewCompany(
  item:        CompanySummaryTargetItem,
  reviewedBy:  string | null,
  summaryType: string,
): Promise<CompanyResult> {
  const { company, listVM } = item;
  const base = {
    company_uid:         company.id,
    company_name:        company.name,
    freshness_status:    listVM.freshnessStatus,
    human_review_status: listVM.humanReviewStatus,
  };

  // ── skip: missing（summary レコードなし）────────────────────────────────
  if (listVM.freshnessStatus === 'missing') {
    return {
      ...base,
      status:      'skipped_missing',
      skip_reason: 'summary レコードが存在しないためスキップ（先に AI 生成・保存を実行してください）',
    };
  }

  // ── skip: approved（locked）保護 ─────────────────────────────────────────
  // canBulkApprove = hasSummary && !isApproved。missing は上で弾いているため
  // ここに来た時点で hasSummary=true。!canBulkApprove は isApproved=true を意味する。
  if (!listVM.canBulkApprove) {
    return {
      ...base,
      status:      'skipped_locked',
      skip_reason: 'approved 済みのため一括レビュー更新をスキップ（解除は個別の承認解除操作が必要です）',
    };
  }

  // ── 実行可能なステータス確認（参考ログ用） ────────────────────────────────
  // pending   → reviewed : ✅ 可
  // reviewed  → reviewed : ✅ 可（冪等）
  // corrected → reviewed : ✅ 可
  // null      → reviewed : ✅ 可（isUnreviewed=true として扱う）

  const tableId = TABLE_IDS.company_summary_state;
  if (!tableId) {
    return {
      ...base,
      status: 'failed',
      error:  'NOCODB_COMPANY_SUMMARY_STATE_TABLE_ID が未設定です',
    };
  }

  try {
    // company_uid + summary_type でレコードを取得
    // summary_type=null のレコードも 'default' として扱う（eq は null にマッチしないため blank も含む）
    const typeFilter = summaryType === 'default'
      ? `(summary_type,eq,default)~or(summary_type,blank)`
      : `(summary_type,eq,${summaryType})`;
    const where = `(company_uid,eq,${company.id})~and(${typeFilter})`;
    // approved を優先するため複数件取得
    const list  = await nocoFetch<RawCompanySummaryState>(tableId, { where, limit: '5' });
    // approved レコードを優先
    if (list.length > 1) {
      const approvedIdx = list.findIndex(r => r.human_review_status === 'approved');
      if (approvedIdx > 0) {
        const [approvedRecord] = list.splice(approvedIdx, 1);
        list.unshift(approvedRecord);
      }
    }

    if (list.length === 0) {
      // resolveCompanySummaryTargets で missing 以外とされたが DB に見つからないケース
      return {
        ...base,
        status:      'skipped_missing',
        skip_reason: 'summary レコードが DB に見つかりませんでした（状態不整合の可能性）',
      };
    }

    const previousStatus = list[0].human_review_status ?? null;

    await nocoUpdate<RawCompanySummaryState>(tableId, list[0].Id, {
      human_review_status: 'reviewed',
      reviewed_by:         reviewedBy ?? null,
      reviewed_at:         new Date().toISOString(),
    });

    return {
      ...base,
      status:                 'ok',
      human_review_status:    'reviewed',
      previous_review_status: previousStatus,
    };
  } catch (err) {
    return {
      ...base,
      status: 'failed',
      error:  err instanceof Error ? err.message : String(err),
    };
  }
}

// ── dry_run 用プレビュー生成 ──────────────────────────────────────────────────

function buildDryRunTarget(item: CompanySummaryTargetItem): DryRunTarget {
  const { company, listVM } = item;
  const base: DryRunTarget = {
    company_uid:         company.id,
    company_name:        company.name,
    freshness_status:    listVM.freshnessStatus,
    human_review_status: listVM.humanReviewStatus,
    can_bulk_approve:    listVM.canBulkApprove,
    review_group_label:  listVM.reviewGroupLabel,
  };

  if (listVM.freshnessStatus === 'missing') {
    return { ...base, skip_reason: 'summary レコードなし（skipped_missing）' };
  }
  if (!listVM.canBulkApprove) {
    return { ...base, skip_reason: 'approved 保護（skipped_locked）' };
  }
  return base;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 認証 ──────────────────────────────────────────────────────────────────
  const authError = checkBatchAuth(req);
  if (authError) return authError;

  const startedAt = new Date();
  const body: RequestBody = await req.json().catch(() => ({}));

  // ── パラメータ正規化 ───────────────────────────────────────────────────────
  const limit       = Math.min(body.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const dryRun      = body.dry_run ?? false;
  const reviewedBy  = body.reviewed_by ?? null;
  const summaryType = body.summary_type ?? DEFAULT_TYPE;

  // status は固定（batch では reviewed のみ許可）
  // リクエストに status が含まれていた場合はバリデーション
  const rawStatus = (body as Record<string, unknown>)['status'];
  if (rawStatus !== undefined && !ALLOWED_STATUSES.has(String(rawStatus))) {
    return NextResponse.json(
      {
        error:  `batch review で指定できる status は "reviewed" のみです。approved への一括変更は禁止されています（個別の confirm ステップが必要です）。`,
        hint:   '単一企業の approved 操作は POST /api/company/[companyUid]/summary/review を使用してください。',
      },
      { status: 400 },
    );
  }

  // ── 対象取得 ──────────────────────────────────────────────────────────────
  // freshness_filter は指定しない（missing も取得して skipped_missing ログを残す）
  let targets: CompanySummaryTargetItem[];
  try {
    targets = await resolveCompanySummaryTargets({
      limit,
      company_uids: body.company_uids,
      summary_type: summaryType,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[batch/company-summary-review] 対象企業取得失敗:', err);
    return NextResponse.json({ error: `企業取得エラー: ${msg}` }, { status: 500 });
  }

  // ── dry_run 用カウントを事前算出（dry_run / 通常共通） ─────────────────────
  let previewOkCount      = 0;
  let previewMissingCount = 0;
  let previewLockedCount  = 0;

  for (const t of targets) {
    if (t.listVM.freshnessStatus === 'missing')  { previewMissingCount++; continue; }
    if (!t.listVM.canBulkApprove)                { previewLockedCount++;  continue; }
    previewOkCount++;
  }

  // ── dry_run: write せず対象だけ返す ──────────────────────────────────────
  if (dryRun) {
    const finishedAt = new Date();
    await writeBatchRunLog({
      endpoint:        '/api/batch/company-summary-review',
      started_at:      startedAt.toISOString(),
      finished_at:     finishedAt.toISOString(),
      duration_ms:     finishedAt.getTime() - startedAt.getTime(),
      dry_run:         true,
      source_queue:    'companies',
      request_params:  sanitizeRequestParams(body as Record<string, unknown>),
      total_targeted:  targets.length,
      success_count:   0,
      partial_count:   0,
      failed_count:    0,
      skipped_count:   previewMissingCount + previewLockedCount,
      failure_details: '[]',
    });
    return NextResponse.json({
      dry_run:               true,
      limit,
      total_targeted:        targets.length,
      ok_count:              previewOkCount,
      skipped_missing_count: previewMissingCount,
      skipped_locked_count:  previewLockedCount,
      target_companies:      targets.map(buildDryRunTarget),
      note: [
        'dry_run=false で実行すると以下の変更が行われます:',
        `  - ${previewOkCount} 件: pending/reviewed/corrected/null → reviewed に更新`,
        `  - ${previewMissingCount} 件: skipped_missing（summary レコードなし）`,
        `  - ${previewLockedCount} 件: skipped_locked（approved 保護）`,
        'approved への一括変更は禁止されています。',
      ].join('\n'),
    });
  }

  // ── 対象なし ───────────────────────────────────────────────────────────────
  if (targets.length === 0) {
    return NextResponse.json({
      dry_run:               false,
      started_at:            startedAt.toISOString(),
      finished_at:           new Date().toISOString(),
      duration_ms:           Date.now() - startedAt.getTime(),
      limit,
      total_targeted:        0,
      ok_count:              0,
      skipped_missing_count: 0,
      skipped_locked_count:  0,
      failed_count:          0,
      failures:              [] as Failure[],
      results:               [] as CompanyResult[],
      note:                  '対象企業が見つかりませんでした（NocoDB テーブル未設定・指定 UID に該当なし）',
    });
  }

  // ── per-company 処理（順次実行） ──────────────────────────────────────────
  const companyResults: CompanyResult[] = [];

  for (const item of targets) {
    console.log(
      `[batch/company-summary-review] processing ${item.company.id} (${item.company.name})` +
      ` [${item.listVM.freshnessStatus}/${item.listVM.humanReviewStatus ?? 'null'}]`,
    );
    const r = await reviewCompany(item, reviewedBy, summaryType);
    companyResults.push(r);
    console.log(`[batch/company-summary-review] ${item.company.id} → ${r.status}`);
  }

  // ── 集計 ──────────────────────────────────────────────────────────────────
  let okCount      = 0;
  let missingCount = 0;
  let lockedCount  = 0;
  let failedCount  = 0;
  const failures: Failure[] = [];

  for (const r of companyResults) {
    if      (r.status === 'ok')               okCount++;
    else if (r.status === 'skipped_missing')  missingCount++;
    else if (r.status === 'skipped_locked')   lockedCount++;
    else if (r.status === 'failed')           {
      failedCount++;
      failures.push({ company_uid: r.company_uid, company_name: r.company_name, reason: r.error ?? '' });
    }
  }

  const finishedAt = new Date();

  const responseBody = {
    dry_run:               false,
    started_at:            startedAt.toISOString(),
    finished_at:           finishedAt.toISOString(),
    duration_ms:           finishedAt.getTime() - startedAt.getTime(),
    limit,
    total_targeted:        companyResults.length,
    ok_count:              okCount,
    skipped_missing_count: missingCount,
    skipped_locked_count:  lockedCount,
    failed_count:          failedCount,
    failures,
    results:               companyResults,
  };

  const { logId } = await writeBatchRunLog({
    endpoint:        '/api/batch/company-summary-review',
    batch_type:      'company-summary-review',
    started_at:      startedAt.toISOString(),
    finished_at:     finishedAt.toISOString(),
    duration_ms:     finishedAt.getTime() - startedAt.getTime(),
    dry_run:         false,
    source_queue:    'companies',
    request_params:  sanitizeRequestParams(body as Record<string, unknown>),
    filters:         JSON.stringify({ summary_type: summaryType }),
    total_targeted:  companyResults.length,
    ok_count:        okCount,
    success_count:   okCount,
    partial_count:   0,
    failed_count:    failedCount,
    skipped_count:   missingCount + lockedCount,
    failure_details: JSON.stringify(failures),
    result_json:     JSON.stringify(responseBody),
  });

  return NextResponse.json({ ...responseBody, audit_log_id: logId });
}
