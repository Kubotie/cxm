// ─── Support 派生テーブルへの write helper ────────────────────────────────────
// support_case_ai_state, support_alerts への upsert を担当する。
// ルール:
//   - support_case_ai_state: human_review_status が approved/locked/finalized なら上書きしない
//   - support_alerts: status が Resolved/Dismissed なら上書きしない

import { TABLE_IDS } from './client';
import { nocoCreate, nocoUpdate } from './write';
import type { RawSupportCaseAIState, RawSupportAlert } from './types';
import type { SupportCaseAIStateWritePayload, SupportAlertWritePayload } from '@/lib/support/ai-types';
import type { SourceRef } from '@/lib/support/source-ref';
import { sourceRefToWhere } from '@/lib/support/source-ref';

// 上書きを禁止する human_review_status 値
const PROTECTED_STATUSES = new Set(['approved', 'locked', 'finalized']);

// ── 結果型 ───────────────────────────────────────────────────────────────────

export type SaveResult =
  | { ok: true; created: boolean }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string };

// ── メイン helper ─────────────────────────────────────────────────────────────

const API_TOKEN = process.env.NOCODB_API_TOKEN ?? '';
const BASE_URL  = process.env.NOCODB_BASE_URL  ?? 'https://odtable.ptmind.ai';

/**
 * ref（source_id + source_table）をキーに support_case_ai_state を upsert する。
 * human_review_status が保護されている場合はスキップして SaveResult を返す。
 */
export async function saveSupportCaseAIState(
  ref: SourceRef,
  payload: SupportCaseAIStateWritePayload,
): Promise<SaveResult> {
  const tableId = TABLE_IDS.support_case_ai_state;
  if (!tableId) {
    return { ok: false, skipped: false, error: 'NOCODB_SUPPORT_CASE_AI_STATE_TABLE_ID が未設定です' };
  }

  // 1. 既存レコードを検索
  const where = sourceRefToWhere(ref);
  const searchUrl = new URL(`${BASE_URL}/api/v2/tables/${tableId}/records`);
  searchUrl.searchParams.set('where', where);
  searchUrl.searchParams.set('limit', '1');

  const searchRes = await fetch(searchUrl.toString(), {
    headers: { 'xc-token': API_TOKEN },
    cache: 'no-store',
  });

  if (!searchRes.ok) {
    return {
      ok: false,
      skipped: false,
      error: `NocoDB lookup ${searchRes.status}: ${searchRes.statusText}`,
    };
  }

  const { list } = await searchRes.json() as { list: RawSupportCaseAIState[] };

  // 2. 既存あり → human_review_status チェック → update
  if (list.length > 0) {
    const existing = list[0];
    const status = existing.human_review_status ?? null;

    if (status && PROTECTED_STATUSES.has(status)) {
      return {
        ok: false,
        skipped: true,
        reason: `human_review_status が "${status}" のため上書きをスキップしました`,
      };
    }

    await nocoUpdate<RawSupportCaseAIState>(tableId, existing.Id, payload);
    return { ok: true, created: false };
  }

  // 3. 既存なし → create
  await nocoCreate<RawSupportCaseAIState>(tableId, payload);
  return { ok: true, created: true };
}

// ── support_alerts upsert ─────────────────────────────────────────────────────

// 上書きを禁止する status 値（人間が確定させた状態）
const ALERT_PROTECTED_STATUSES = new Set(['Resolved', 'Dismissed']);

/**
 * source_id + source_table + alert_type をキーに support_alerts を upsert する。
 * status が Resolved / Dismissed の場合はスキップして SaveResult を返す。
 */
export async function saveSupportAlert(
  payload: SupportAlertWritePayload,
): Promise<SaveResult> {
  const tableId = TABLE_IDS.support_alerts;
  if (!tableId) {
    return { ok: false, skipped: false, error: 'NOCODB_SUPPORT_ALERTS_TABLE_ID が未設定です' };
  }

  // 1. 既存レコードを検索（source_id + source_table + alert_type の複合キー）
  const where = [
    `(source_id,eq,${payload.source_id})`,
    `(source_table,eq,${payload.source_table})`,
    `(alert_type,eq,${payload.alert_type})`,
  ].join('~and');

  const searchUrl = new URL(`${BASE_URL}/api/v2/tables/${tableId}/records`);
  searchUrl.searchParams.set('where', where);
  searchUrl.searchParams.set('limit', '1');

  const searchRes = await fetch(searchUrl.toString(), {
    headers: { 'xc-token': API_TOKEN },
    cache: 'no-store',
  });

  if (!searchRes.ok) {
    return {
      ok: false,
      skipped: false,
      error: `NocoDB lookup ${searchRes.status}: ${searchRes.statusText}`,
    };
  }

  const { list } = await searchRes.json() as { list: RawSupportAlert[] };

  // 2. 既存あり → status チェック → update
  if (list.length > 0) {
    const existing = list[0];
    const status = existing.status ?? null;

    if (status && ALERT_PROTECTED_STATUSES.has(status)) {
      return {
        ok: false,
        skipped: true,
        reason: `alert status が "${status}" のため上書きをスキップしました`,
      };
    }

    await nocoUpdate<RawSupportAlert>(tableId, existing.Id, payload);
    return { ok: true, created: false };
  }

  // 3. 既存なし → create
  await nocoCreate<RawSupportAlert>(tableId, payload);
  return { ok: true, created: true };
}
