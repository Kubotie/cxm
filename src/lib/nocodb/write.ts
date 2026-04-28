// ─── NocoDB write helper（サーバーサイド専用）────────────────────────────────
// NocoDB v2 REST API への書き込み操作。
// read は client.ts / support.ts を使うこと。
//
// 使い方（OpenAI 連携フェーズで実装する）:
//
//   // 新規作成
//   const record = await nocoCreate<RawSupportCaseAIState>(
//     TABLE_IDS.support_case_ai_state,
//     payload,
//   );
//
//   // ID 指定で更新（NocoDB row ID が必要）
//   await nocoUpdate(TABLE_IDS.support_case_ai_state, rowId, patch);
//
//   // where 句で lookup → なければ create、あれば update
//   const { record, created } = await nocoUpsert(
//     TABLE_IDS.support_case_ai_state,
//     sourceRefToWhere(ref),
//     payload,
//   );

const API_TOKEN = process.env.NOCODB_API_TOKEN ?? '';
const BASE_URL  = process.env.NOCODB_BASE_URL  ?? 'https://odtable.ptmind.ai';

function apiHeaders() {
  return {
    'Content-Type': 'application/json',
    'xc-token': API_TOKEN,
  } as const;
}

// ── 基本 write 操作 ──────────────────────────────────────────────────────────

/**
 * テーブルに新規レコードを 1 件作成する。
 * NocoDB v2: POST /api/v2/tables/{tableId}/records
 */
export async function nocoCreate<T>(
  tableId: string,
  payload: object,
): Promise<T> {
  if (!API_TOKEN) throw new Error('NOCODB_API_TOKEN が未設定です');

  const res = await fetch(`${BASE_URL}/api/v2/tables/${tableId}/records`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '(body read failed)');
    throw new Error(`NocoDB create ${res.status}: ${res.statusText} [${tableId}] — ${errBody}`);
  }
  return res.json() as Promise<T>;
}

/**
 * 行 ID を指定してレコードを部分更新する。
 * NocoDB v2: PATCH /api/v2/tables/{tableId}/records
 * ※ NocoDB v2 は行 ID を body に含める形式
 */
export async function nocoUpdate<T>(
  tableId: string,
  rowId: number,
  patch: object,
): Promise<T> {
  if (!API_TOKEN) throw new Error('NOCODB_API_TOKEN が未設定です');

  const res = await fetch(`${BASE_URL}/api/v2/tables/${tableId}/records`, {
    method: 'PATCH',
    headers: apiHeaders(),
    body: JSON.stringify({ Id: rowId, ...patch }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '(body read failed)');
    throw new Error(`NocoDB update ${res.status}: ${res.statusText} [${tableId}] — ${errBody}`);
  }
  return res.json() as Promise<T>;
}

/**
 * 行 ID を指定してレコードを削除する。
 * NocoDB v2: DELETE /api/v2/tables/{tableId}/records
 */
export async function nocoDelete(
  tableId: string,
  rowId: number,
): Promise<void> {
  if (!API_TOKEN) throw new Error('NOCODB_API_TOKEN が未設定です');

  const res = await fetch(`${BASE_URL}/api/v2/tables/${tableId}/records`, {
    method: 'DELETE',
    headers: apiHeaders(),
    body: JSON.stringify({ Id: rowId }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '(body read failed)');
    throw new Error(`NocoDB delete ${res.status}: ${res.statusText} [${tableId}] — ${errBody}`);
  }
}

/**
 * lookup → なければ create、あれば update を行う。
 *
 * @param tableId      対象テーブル ID
 * @param lookupWhere  既存レコードを探す NocoDB where 句
 * @param payload      作成 or 更新するフィールド群
 * @returns { record, created } — created=true なら新規作成
 */
export async function nocoUpsert<T extends { Id: number }>(
  tableId: string,
  lookupWhere: string,
  payload: object,
): Promise<{ record: T; created: boolean }> {
  if (!API_TOKEN) throw new Error('NOCODB_API_TOKEN が未設定です');

  // 1. 既存レコードを検索
  const searchUrl = new URL(`${BASE_URL}/api/v2/tables/${tableId}/records`);
  searchUrl.searchParams.set('where', lookupWhere);
  searchUrl.searchParams.set('limit', '1');

  const searchRes = await fetch(searchUrl.toString(), {
    headers: { 'xc-token': API_TOKEN },
    cache: 'no-store',
  });

  if (!searchRes.ok) {
    throw new Error(`NocoDB upsert lookup ${searchRes.status}: ${searchRes.statusText} [${tableId}]`);
  }

  const { list } = await searchRes.json() as { list: T[] };

  // 2a. 既存あり → update
  if (list.length > 0) {
    const updated = await nocoUpdate<T>(tableId, list[0].Id, payload);
    return { record: updated, created: false };
  }

  // 2b. 既存なし → create
  const created = await nocoCreate<T>(tableId, payload);
  return { record: created, created: true };
}
