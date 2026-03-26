// ─── NocoDB HTTP クライアント ────────────────────────────────────────────────
// サーバーサイドに移行する際はここだけ書き換えてください。
// dev モード: Vite プロキシ経由（CORS 回避）
// prod モード: VITE_NOCODB_BASE_URL に直接リクエスト

const API_TOKEN = import.meta.env.VITE_NOCODB_API_TOKEN ?? '';

/** テーブル ID は .env.local で管理。ハードコードは最終フォールバック用 */
export const TABLE_IDS = {
  companies: import.meta.env.VITE_NOCODB_COMPANIES_TABLE_ID ?? 'mlwfjmp43n6ofwb',
  alerts:    import.meta.env.VITE_NOCODB_ALERTS_TABLE_ID    ?? 'mwhmdw4co9vb18i',
  evidence:  import.meta.env.VITE_NOCODB_EVIDENCE_TABLE_ID  ?? 'mj3li55fwaoxf8h',
  people:    import.meta.env.VITE_NOCODB_PEOPLE_TABLE_ID    ?? 'mirv9mk98899bfj',
} as const;

export interface NocoDBResponse<T> {
  list: T[];
  pageInfo: {
    totalRows: number;
    page: number;
    pageSize: number;
    isFirstPage: boolean;
    isLastPage: boolean;
  };
}

/**
 * API ベース URL を返す。
 * dev: /nocodb-proxy（Vite proxy が odtable.ptmind.ai に転送）
 * prod: VITE_NOCODB_BASE_URL の値をそのまま使用
 */
function getApiBase(): string {
  if (import.meta.env.DEV) {
    return window.location.origin + '/nocodb-proxy';
  }
  return import.meta.env.VITE_NOCODB_BASE_URL ?? '';
}

/**
 * NocoDB v2 REST API からテーブルレコードを取得する汎用関数。
 * @param tableId  対象テーブルID
 * @param params   クエリパラメータ (where/sort/limit/offset 等)
 */
export async function nocoFetch<T>(
  tableId: string,
  params: Record<string, string> = {},
): Promise<T[]> {
  if (!API_TOKEN) {
    throw new Error(
      'VITE_NOCODB_API_TOKEN が未設定です。.env.local を確認して dev server を再起動してください。',
    );
  }

  const apiBase = getApiBase();
  const url = new URL(`${apiBase}/api/v2/tables/${tableId}/records`);

  // デフォルト limit
  if (!params.limit) url.searchParams.set('limit', '200');

  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      'xc-token': API_TOKEN,
    },
  });

  if (!res.ok) {
    throw new Error(`NocoDB ${res.status}: ${res.statusText} [${tableId}]`);
  }

  const json: NocoDBResponse<T> = await res.json();
  return json.list ?? [];
}
