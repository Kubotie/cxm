// ─── support_case_ai_state read/write store ────────────────────────────────────
// サーバーサイド専用（API Routes から呼び出す）。
// upsert キー: source_queue + source_record_id の複合キー。
// 保護条件: human_review_status = 'approved' の場合は AI 上書きをスキップ。

import { nocoFetch, TABLE_IDS } from './client';
import { nocoCreate, nocoUpdate } from './write';
import {
  SUPPORT_CASE_AI_PROTECTED_STATUSES,
} from './support-ai-state-types';
import { toSupportCaseAiStateRecord } from './support-ai-state-helpers';
import type {
  SupportCaseAiSourceQueue,
  SupportCaseAiStateRecord,
  SupportCaseAiStatePayload,
  SupportCaseAiHumanReviewPayload,
  SupportCaseAiSaveResult,
  RawSupportCaseAiState,
} from './support-ai-state-types';

const API_TOKEN = process.env.NOCODB_API_TOKEN ?? '';
const BASE_URL  = process.env.NOCODB_BASE_URL  ?? 'https://odtable.ptmind.ai';

// ── 共通 lookup helper ────────────────────────────────────────────────────────

/**
 * source_queue + source_record_id で既存レコードを 1 件検索する。
 * 見つからなければ null を返す。
 * tableId が未設定ならエラーをスロー。
 */
async function lookupExisting(
  tableId: string,
  sourceQueue: SupportCaseAiSourceQueue,
  sourceRecordId: string,
): Promise<RawSupportCaseAiState | null> {
  const where = `(source_queue,eq,${sourceQueue})~and(source_record_id,eq,${sourceRecordId})`;
  const searchUrl = new URL(`${BASE_URL}/api/v2/tables/${tableId}/records`);
  searchUrl.searchParams.set('where', where);
  searchUrl.searchParams.set('limit', '1');

  const res = await fetch(searchUrl.toString(), {
    headers: { 'xc-token': API_TOKEN },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '(body read failed)');
    throw new Error(
      `NocoDB lookup ${res.status}: ${res.statusText} [${tableId}] where=${where} body=${body}`,
    );
  }

  const { list } = await res.json() as { list: RawSupportCaseAiState[] };
  return list.length > 0 ? list[0] : null;
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * source_queue + source_record_id で 1 件取得する。
 * テーブルが未設定なら null を返す。
 */
export async function getSupportCaseAiState(
  sourceQueue: SupportCaseAiSourceQueue,
  sourceRecordId: string,
): Promise<SupportCaseAiStateRecord | null> {
  const tableId = TABLE_IDS.support_case_ai_state;
  if (!tableId) return null;

  try {
    const raw = await lookupExisting(tableId, sourceQueue, sourceRecordId);
    return raw ? toSupportCaseAiStateRecord(raw) : null;
  } catch (err) {
    console.error('[getSupportCaseAiState]', err);
    return null;
  }
}

/**
 * source_queue で絞り込んで複数件取得する（最大 limit 件）。
 * source_record_id → SupportCaseAiStateRecord の Map を返す。
 */
export async function getSupportCaseAiStatesByQueue(
  sourceQueue: SupportCaseAiSourceQueue,
  limit = 200,
): Promise<Map<string, SupportCaseAiStateRecord>> {
  const result = new Map<string, SupportCaseAiStateRecord>();
  const tableId = TABLE_IDS.support_case_ai_state;
  if (!tableId) return result;

  try {
    const list = await nocoFetch<RawSupportCaseAiState>(tableId, {
      where: `(source_queue,eq,${sourceQueue})`,
      limit: String(limit),
    });
    for (const raw of list) {
      if (!raw.source_record_id) continue;
      result.set(String(raw.source_record_id), toSupportCaseAiStateRecord(raw));
    }
  } catch (err) {
    console.error('[getSupportCaseAiStatesByQueue]', err);
  }
  return result;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * source_queue + source_record_id をキーに support_case_ai_state を upsert する。
 *
 * - human_review_status が `approved` の場合はスキップ
 * - 既存あり → update（payload のフィールドのみ上書き）
 * - 既存なし → create
 *
 * payload には `human_review_status: 'pending'` を必ず指定すること。
 * AI が直接 `approved` にしてはならない。
 */
export async function upsertSupportCaseAiState(
  payload: SupportCaseAiStatePayload,
): Promise<SupportCaseAiSaveResult> {
  const tableId = TABLE_IDS.support_case_ai_state;
  if (!tableId) {
    return {
      ok: false,
      skipped: false,
      error: 'NOCODB_SUPPORT_CASE_AI_STATE_TABLE_ID が未設定です',
    };
  }

  try {
    const existing = await lookupExisting(tableId, payload.source_queue, payload.source_record_id);

    if (existing) {
      // 保護ステータスチェック
      const status = existing.human_review_status;
      if (status && SUPPORT_CASE_AI_PROTECTED_STATUSES.has(status as never)) {
        return {
          ok: false,
          skipped: true,
          reason: `human_review_status が "${status}" のため AI 上書きをスキップしました`,
        };
      }

      const updated = await nocoUpdate<RawSupportCaseAiState>(tableId, existing.Id, payload);
      return { ok: true, created: false, record: toSupportCaseAiStateRecord(updated) };
    }

    const created = await nocoCreate<RawSupportCaseAiState>(tableId, payload);
    return { ok: true, created: true, record: toSupportCaseAiStateRecord(created) };

  } catch (err) {
    return {
      ok: false,
      skipped: false,
      error: String(err),
    };
  }
}

/**
 * 人手レビューステータスのみを更新する。
 * AI フィールドは一切変更しない。
 */
export async function updateHumanReviewStatus(
  sourceQueue: SupportCaseAiSourceQueue,
  sourceRecordId: string,
  reviewPayload: SupportCaseAiHumanReviewPayload,
): Promise<SupportCaseAiSaveResult> {
  const tableId = TABLE_IDS.support_case_ai_state;
  if (!tableId) {
    return { ok: false, skipped: false, error: 'NOCODB_SUPPORT_CASE_AI_STATE_TABLE_ID が未設定です' };
  }

  try {
    const existing = await lookupExisting(tableId, sourceQueue, sourceRecordId);
    if (!existing) {
      return { ok: false, skipped: false, error: 'レコードが存在しません。先に AI 生成を実行してください。' };
    }

    const updated = await nocoUpdate<RawSupportCaseAiState>(tableId, existing.Id, reviewPayload);
    return { ok: true, created: false, record: toSupportCaseAiStateRecord(updated) };
  } catch (err) {
    return { ok: false, skipped: false, error: String(err) };
  }
}
