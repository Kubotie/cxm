// ─── POST /api/ops/policies/run ───────────────────────────────────────────────
//
// アクティブな Alert Policy を実行し、候補アラートを返す。
// dry_run=true（デフォルト）の場合は評価のみ（NocoDB への書き込みなし）。
// dry_run=false の場合は候補を NocoDB alerts テーブルに upsert し、件数を返す。
//
// ── リクエストボディ ─────────────────────────────────────────────────────────
// {
//   dry_run?:     boolean   (default: true)
//   policy_ids?:  string[]  (省略=全 active ポリシー)
//   company_uids?: string[] (省略=全 CSM 管理企業)
//   limit?:       number    (default: 200)
// }
//
// ── レスポンス（dry_run=false 追加フィールド）──────────────────────────────────
// {
//   ...RunAlertPoliciesResult,
//   created_count: number,
//   updated_count: number,
//   failed_count:  number,
// }

import { NextRequest, NextResponse } from 'next/server';
import { runAlertPolicies } from '@/lib/policy/alert-runner';
import { savePolicyAlert } from '@/lib/nocodb/alert-write';

export async function POST(req: NextRequest) {
  let body: {
    dry_run?:      boolean;
    policy_ids?:   string[];
    company_uids?: string[];
    limit?:        number;
  } = {};

  try { body = await req.json(); }
  catch { /* body は省略可 */ }

  const dryRun = body.dry_run ?? true;

  let result: Awaited<ReturnType<typeof runAlertPolicies>>;
  try {
    result = await runAlertPolicies({
      dryRun,
      policyIds:    body.policy_ids,
      companyUids:  body.company_uids,
      limit:        body.limit ?? 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[policies/run] error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // ── dry_run=true の場合はそのまま返す ───────────────────────────────────────
  if (dryRun) {
    return NextResponse.json(result);
  }

  // ── dry_run=false: 候補を NocoDB に upsert ───────────────────────────────────
  let createdCount = 0;
  let updatedCount = 0;
  let failedCount  = 0;

  const writeErrors: { dedup_key: string; error: string }[] = [];

  await Promise.allSettled(
    result.candidates.map(async (candidate) => {
      const saveResult = await savePolicyAlert(candidate);
      if (saveResult.ok) {
        if (saveResult.created) createdCount++;
        else                     updatedCount++;
      } else {
        failedCount++;
        const errMsg = (saveResult as { ok: false; skipped: false; error: string }).error;
        writeErrors.push({ dedup_key: candidate.dedup_key, error: errMsg });
        console.error('[policies/run] write error:', errMsg);
      }
    }),
  );

  return NextResponse.json({
    ...result,
    created_count: createdCount,
    updated_count: updatedCount,
    failed_count:  failedCount,
    ...(writeErrors.length > 0 ? { write_errors: writeErrors } : {}),
  });
}
