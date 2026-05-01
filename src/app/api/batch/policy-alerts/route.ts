// ─── POST /api/batch/policy-alerts ───────────────────────────────────────────
// アクティブな Alert Policy を全企業に対して評価し、
// マッチした結果を alerts テーブルに upsert する。
//
// ── リクエストボディ ──────────────────────────────────────────────────────────
// {
//   dry_run?:       boolean;    // true のとき候補を返すだけで write しない（default: false）
//   policy_ids?:    string[];   // 評価対象ポリシーを絞り込む（省略時は全 active ポリシー）
//   company_uids?:  string[];   // 評価対象企業を絞り込む（省略時は全 CSM 管理企業）
//   limit?:         number;     // 企業取得上限（default: 200）
// }
//
// ── レスポンス ─────────────────────────────────────────────────────────────────
// {
//   dry_run:          boolean,
//   started_at:       ISO8601,
//   finished_at:      ISO8601,
//   duration_ms:      number,
//   policies_count:   number,
//   companies_count:  number,
//   candidates_count: number,
//   saved_count:      number,   // dry_run=true のとき 0
//   created_count:    number,
//   updated_count:    number,
//   error_count:      number,
//   policy_summary:   [{ policy_id, policy_name, hit_count }],
//   errors:           [{ company_uid, company_name, dedup_key, error }],
// }
//
// ── 認証 ─────────────────────────────────────────────────────────────────────
// SUPPORT_BATCH_SECRET による Bearer 認証（checkBatchAuth）
// 未設定の場合は認証スキップ（開発環境向け）

import { NextRequest, NextResponse } from 'next/server';
import { checkBatchAuth }            from '@/lib/batch/auth';
import { runAlertPolicies }          from '@/lib/policy/alert-runner';
import { savePolicyAlert }           from '@/lib/nocodb/alert-write';

export async function POST(req: NextRequest) {
  const authError = checkBatchAuth(req);
  if (authError) return authError;

  const startedAt = new Date();

  let body: {
    dry_run?:      boolean;
    policy_ids?:   string[];
    company_uids?: string[];
    limit?:        number;
  } = {};
  try {
    body = await req.json();
  } catch {
    // body なしでも動作する
  }

  const dryRun      = body.dry_run      ?? false;
  const policyIds   = body.policy_ids;
  const companyUids = body.company_uids;
  const limit       = body.limit ?? 200;

  // ── Policy 評価 ────────────────────────────────────────────────────────────
  const result = await runAlertPolicies({
    dryRun: true, // 書き込みは下で個別に行う
    policyIds,
    companyUids,
    limit,
  });

  // ── dry_run のときは候補を返すだけ ─────────────────────────────────────────
  if (dryRun) {
    const finishedAt = new Date();
    return NextResponse.json({
      dry_run:          true,
      started_at:       startedAt.toISOString(),
      finished_at:      finishedAt.toISOString(),
      duration_ms:      finishedAt.getTime() - startedAt.getTime(),
      policies_count:   result.policies_count,
      companies_count:  result.companies_count,
      candidates_count: result.candidates.length,
      saved_count:      0,
      created_count:    0,
      updated_count:    0,
      error_count:      0,
      policy_summary:   result.policy_summary,
      candidates:       result.candidates.map(c => ({
        policy_id:    c.policy_id,
        policy_name:  c.policy_name,
        company_uid:  c.company_uid,
        company_name: c.company_name,
        title:        c.title,
        severity:     c.severity,
        dedup_key:    c.dedup_key,
      })),
      errors: [],
    });
  }

  // ── 本実行: 候補を alerts テーブルに upsert ────────────────────────────────
  let createdCount = 0;
  let updatedCount = 0;
  const errors: { company_uid: string; company_name: string; dedup_key: string; error: string }[] = [];

  for (const candidate of result.candidates) {
    const saveResult = await savePolicyAlert(candidate);
    if (!saveResult.ok) {
      const errMsg = 'error' in saveResult ? saveResult.error : 'unknown error';
      errors.push({
        company_uid:  candidate.company_uid,
        company_name: candidate.company_name,
        dedup_key:    candidate.dedup_key,
        error:        errMsg,
      });
    } else if (saveResult.created) {
      createdCount++;
    } else {
      updatedCount++;
    }
  }

  const finishedAt = new Date();
  return NextResponse.json({
    dry_run:          false,
    started_at:       startedAt.toISOString(),
    finished_at:      finishedAt.toISOString(),
    duration_ms:      finishedAt.getTime() - startedAt.getTime(),
    policies_count:   result.policies_count,
    companies_count:  result.companies_count,
    candidates_count: result.candidates.length,
    saved_count:      createdCount + updatedCount,
    created_count:    createdCount,
    updated_count:    updatedCount,
    error_count:      errors.length,
    policy_summary:   result.policy_summary,
    errors,
  });
}
