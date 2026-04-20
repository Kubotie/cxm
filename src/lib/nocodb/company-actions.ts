// ─── Company Action NocoDB helper ────────────────────────────────────────────
// company_actions テーブルの read / create / update を担当する。
//
// テーブル設定:
//   .env.local: NOCODB_COMPANY_ACTIONS_TABLE_ID=<テーブルID>
//
// 推奨カラム: action_id, company_uid, title, description, owner, due_date, status,
//             created_from, source_ref, person_ref, sf_todo_status, sf_todo_id,
//             created_at
//
// ⚠️  NocoDB テーブルのカラム名は `description`（アプリ内フィールド名は `body` だが、
//      NocoDB に送るキーは `description` に変換する）。

import { TABLE_IDS, nocoFetch } from './client';
import { nocoCreate, nocoUpdate } from './write';
import { toAppCompanyAction, type RawCompanyAction, type AppCompanyAction } from './types';

// ── Bulk signal helpers（List API 向け）──────────────────────────────────────

/**
 * 複数の company_uid に対して「期限切れ未完了 Action が存在するか」を一括チェックする。
 * List API の hasOverdueActions（実測値）として使用する。
 *
 * 判定条件:
 *   - status が open / in_progress
 *   - due_date < today（YYYY-MM-DD 形式、JST ではなく UTC 基準）
 *   - due_date が notblank（null/空 は対象外）
 *
 * @returns Map<company_uid, true>（overdue action がない UID はキー自体が含まれない）
 * @remarks NOCODB_COMPANY_ACTIONS_TABLE_ID 未設定 / エラー時は空 Map を返す（graceful degradation）
 */
export async function fetchOverdueActionSignalsByUids(
  uids: string[],
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (uids.length === 0 || !TABLE_IDS.company_actions) return result;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const where = [
    `(company_uid,in,${uids.join(',')})`,
    `(status,in,open,in_progress)`,
    `(due_date,notblank)`,
    `(due_date,lt,${today})`,
  ].join('~and');

  try {
    const rows = await nocoFetch<RawCompanyAction>(TABLE_IDS.company_actions, {
      where,
      fields: 'company_uid',          // company_uid のみ取得（負荷最小化）
      limit:  String(Math.min(uids.length * 5, 500)),
    });
    for (const row of rows) {
      const uid = row.company_uid?.trim();
      if (uid) result.set(uid, true);
    }
  } catch {
    // エラー時は空 Map → hasOverdueActions = false（近似値 fallback）
  }
  return result;
}

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * company_uid に紐づく全アクションを取得する。
 * created_at 降順で返す。
 * テーブル未設定時は空配列を返す。
 */
export async function getCompanyActions(
  companyUid: string,
): Promise<AppCompanyAction[]> {
  const tableId = TABLE_IDS.company_actions;
  if (!tableId) return [];

  const rows = await nocoFetch<RawCompanyAction>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-created_at',
    limit: '500',
  });

  return rows.map(toAppCompanyAction);
}

// ── Create ───────────────────────────────────────────────────────────────────

export interface CompanyActionCreatePayload {
  action_id:    string;
  company_uid:  string;
  title:        string;
  /** NocoDB カラム名は description */
  description:  string;
  owner:        string;
  due_date:     string | null;
  status:       'open' | 'in_progress' | 'done' | 'cancelled';
  created_from: 'manual' | 'risk_signal' | 'opportunity_signal' | 'support_case' | 'people_risk';
  source_ref:   string | null;
  person_ref:   string | null;
  sf_todo_status: 'not_synced' | 'synced' | 'sync_error' | null;
  sf_todo_id:   string | null;
  created_at:   string;
}

/**
 * company_actions テーブルに新規レコードを作成する。
 * テーブル未設定時は Error をスローする。
 */
export async function createCompanyAction(
  payload: CompanyActionCreatePayload,
): Promise<AppCompanyAction> {
  const tableId = TABLE_IDS.company_actions;
  if (!tableId) {
    throw new Error(
      'NOCODB_COMPANY_ACTIONS_TABLE_ID が未設定です。.env.local に追加してください。',
    );
  }

  console.log('[createCompanyAction] NocoDB create payload:', JSON.stringify(payload));
  const raw = await nocoCreate<RawCompanyAction>(tableId, payload);
  console.log('[createCompanyAction] NocoDB create response:', JSON.stringify(raw));
  return toAppCompanyAction(raw);
}

// ── Update ───────────────────────────────────────────────────────────────────

export type CompanyActionPatchPayload = Partial<{
  title:             string;
  /** NocoDB カラム名は description */
  description:       string;
  owner:             string;
  due_date:          string | null;
  status:            'open' | 'in_progress' | 'done' | 'cancelled';
  sf_todo_status:    'not_synced' | 'synced' | 'sync_error' | null;
  sf_todo_id:        string | null;
  sf_last_synced_at: string | null;
}>;

/**
 * NocoDB row Id（数値）を指定してアクションを部分更新する。
 * テーブル未設定時は Error をスローする。
 */
export async function updateCompanyAction(
  rowId: number,
  patch: CompanyActionPatchPayload,
): Promise<AppCompanyAction> {
  const tableId = TABLE_IDS.company_actions;
  if (!tableId) {
    throw new Error(
      'NOCODB_COMPANY_ACTIONS_TABLE_ID が未設定です。.env.local に追加してください。',
    );
  }

  const raw = await nocoUpdate<RawCompanyAction>(tableId, rowId, patch);
  return toAppCompanyAction(raw);
}
