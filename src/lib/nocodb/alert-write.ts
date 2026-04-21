// ─── Policy アラート write helper ─────────────────────────────────────────────
//
// Alert Policy 実行エンジン（alert-runner.ts）が生成した候補を
// NocoDB alerts テーブルに upsert する。
//
// ── dedup ロジック ────────────────────────────────────────────────────────────
//   upsert キー: alert_id = "{policyId}:{companyUid}"（候補の dedup_key と一致）
//   lookup 条件: alert_id=dedup_key かつ status=open
//
//   open が存在 → title / description / severity / timestamp を更新
//   open が存在しない（未作成 or closed 済み）→ 新規作成（status='open'）
//
// ── built-in アラートとの区別 ────────────────────────────────────────────────
//   alert_id が "pol_" で始まるレコードが policy-derived。
//   toAppAlert で source フィールドに反映。

import { TABLE_IDS, nocoFetch } from './client';
import { nocoCreate, nocoUpdate } from './write';
import type { RawAlert } from './types';
import type { PolicyAlertCandidate } from '@/lib/policy/alert-runner';

// ── 結果型 ────────────────────────────────────────────────────────────────────

export type AlertSaveResult =
  | { ok: true;  created: boolean }
  | { ok: false; skipped: false; error: string };

// ── メイン helper ─────────────────────────────────────────────────────────────

/**
 * PolicyAlertCandidate を alerts テーブルに upsert する。
 *
 * - 既存 open あり → 内容を refresh（updated）
 * - 既存 open なし → 新規作成（created）
 */
export async function savePolicyAlert(
  candidate: PolicyAlertCandidate,
): Promise<AlertSaveResult> {
  const tableId = TABLE_IDS.alerts;
  if (!tableId) {
    return { ok: false, skipped: false, error: 'NOCODB_ALERTS_TABLE_ID が未設定です' };
  }

  // ── 1. open な既存アラートを dedup_key で検索 ──────────────────────────────
  // NocoDB フィルタ構文は raw クエリ文字列として渡す（nocoFetch が raw で付与）
  const where = `(alert_id,eq,${candidate.dedup_key})~and(status,eq,open)`;

  let existing: RawAlert[];
  try {
    existing = await nocoFetch<RawAlert>(tableId, { where, limit: '1' });
  } catch (err) {
    return { ok: false, skipped: false, error: err instanceof Error ? err.message : String(err) };
  }

  const now = new Date().toISOString();

  // ── 2. 既存 open あり → 内容を更新 ──────────────────────────────────────────
  if (existing.length > 0) {
    try {
      await nocoUpdate<RawAlert>(tableId, existing[0].Id, {
        title:       candidate.title,
        description: candidate.description,
        severity:    candidate.severity,
        timestamp:   now,
      });
      return { ok: true, created: false };
    } catch (err) {
      return { ok: false, skipped: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── 3. 存在しない（または closed 済み）→ 新規作成 ──────────────────────────
  try {
    await nocoCreate<RawAlert>(tableId, {
      alert_id:    candidate.dedup_key,
      company_uid: candidate.company_uid,
      type:        candidate.category_tag || 'policy_alert',
      title:       candidate.title,
      description: candidate.description,
      severity:    candidate.severity,
      status:      'open',
      timestamp:   now,
    });
    return { ok: true, created: true };
  } catch (err) {
    return { ok: false, skipped: false, error: err instanceof Error ? err.message : String(err) };
  }
}
