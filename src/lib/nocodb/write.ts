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
  /**
   * 主キーの列名。既定は NocoDB の自動生成カラム `Id`。
   *
   * ⚠️ **自分で作ったテーブルは `id`（小文字）のことがある。**
   * 実測: `project_metrics` は `id` なのに `Id` を送っていて
   * `RECORD_NOT_FOUND: Record 'unknown' not found` になった。
   * 404 なのにレコードは存在する、という紛らわしい失敗をする。
   */
  pkColumn: 'Id' | 'id' = 'Id',
): Promise<T> {
  if (!API_TOKEN) throw new Error('NOCODB_API_TOKEN が未設定です');

  const res = await fetch(`${BASE_URL}/api/v2/tables/${tableId}/records`, {
    method: 'PATCH',
    headers: apiHeaders(),
    body: JSON.stringify({ [pkColumn]: rowId, ...patch }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '(body read failed)');
    throw new Error(`NocoDB update ${res.status}: ${res.statusText} [${tableId}] — ${errBody}`);
  }
  return res.json() as Promise<T>;
}

/**
 * 複数行をまとめて部分更新する。
 * NocoDB v2 の PATCH は body に配列を渡すと一括更新になる。
 *
 * 1行ずつ nocoUpdate を回すと N 往復かかる。数百〜数千行を直すときは
 * こちらを使うこと（1リクエストあたり 100 行を上限にしている。
 * NocoDB 側の上限は明示されていないが、大きすぎるとタイムアウトする）。
 *
 * @returns 実際に送った行数
 */
export async function nocoUpdateMany(
  tableId: string,
  rows: Array<Record<string, unknown>>,
  pkColumn: 'Id' | 'id' = 'Id',
): Promise<number> {
  if (!API_TOKEN) throw new Error('NOCODB_API_TOKEN が未設定です');
  if (rows.length === 0) return 0;
  if (rows.some(r => r[pkColumn] == null)) {
    throw new Error(`nocoUpdateMany: 全行に ${pkColumn} が必要です`);
  }

  const CHUNK = 100;
  let sent = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const res = await fetch(`${BASE_URL}/api/v2/tables/${tableId}/records`, {
      method: 'PATCH',
      headers: apiHeaders(),
      body: JSON.stringify(chunk),
      cache: 'no-store',
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '(body read failed)');
      throw new Error(
        `NocoDB bulk update ${res.status}: ${res.statusText} [${tableId}] `
        + `rows ${i}-${i + chunk.length - 1} — ${errBody}`,
      );
    }
    sent += chunk.length;
  }
  return sent;
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
    body: JSON.stringify([{ Id: rowId }]),
    cache: 'no-store',
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '(body read failed)');
    throw new Error(`NocoDB delete ${res.status}: ${res.statusText} [${tableId}] — ${errBody}`);
  }
}

/**
 * where 句に一致するレコードを 1 件探して削除する。
 * 見つからない場合は何もしない（冪等）。
 * Id フィールドがないテーブルでは Error をスローする。
 */
export async function nocoDeleteWhere(
  tableId: string,
  where: string,
): Promise<void> {
  if (!API_TOKEN) throw new Error('NOCODB_API_TOKEN が未設定です');

  // URLSearchParams はフィルタ構文 ( ) , を percent-encode するため raw で構築する
  const urlString = `${BASE_URL}/api/v2/tables/${tableId}/records?where=${where}&limit=1`;

  const searchRes = await fetch(urlString, {
    headers: { 'xc-token': API_TOKEN },
    cache: 'no-store',
  });
  if (!searchRes.ok) return;

  const { list } = await searchRes.json() as { list: { Id?: number }[] };
  if (!list.length) return;
  if (!list[0].Id) throw new Error(`NocoDB: テーブル [${tableId}] に Id フィールドがありません`);

  await nocoDelete(tableId, list[0].Id);
}

/**
 * where 句に一致するレコードを 1 件探して部分更新する。
 * Id フィールドがないテーブルでは Error をスローする。
 */
export async function nocoUpdateWhere<T>(
  tableId: string,
  where: string,
  patch: object,
): Promise<T> {
  if (!API_TOKEN) throw new Error('NOCODB_API_TOKEN が未設定です');

  // URLSearchParams はフィルタ構文 ( ) , を percent-encode するため raw で構築する
  const urlString = `${BASE_URL}/api/v2/tables/${tableId}/records?where=${where}&limit=1`;

  const searchRes = await fetch(urlString, {
    headers: { 'xc-token': API_TOKEN },
    cache: 'no-store',
  });
  if (!searchRes.ok) throw new Error(`NocoDB lookup ${searchRes.status} [${tableId}]`);

  const { list } = await searchRes.json() as { list: (T & { Id?: number })[] };
  if (!list.length) throw new Error(`NocoDB: レコードが見つかりません [${tableId}] where=${where}`);
  if (!list[0].Id) throw new Error(`NocoDB: テーブル [${tableId}] に Id フィールドがありません`);

  return nocoUpdate<T>(tableId, list[0].Id, patch);
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
