// ─── NocoDB HTTP クライアント（サーバーサイド専用）────────────────────────────
// Next.js App Router の Server Components / API Routes から呼び出す。
// process.env を使用（VITE_ プレフィックスなし）。
// ブラウザからは直接呼ばない。

const API_TOKEN = process.env.NOCODB_API_TOKEN ?? '';
const BASE_URL = process.env.NOCODB_BASE_URL ?? 'https://odtable.ptmind.ai';

/** テーブル ID は .env.local で管理 */
export const TABLE_IDS = {
  // ── CSM core ──────────────────────────────────────────────────────────────
  companies:               process.env.NOCODB_COMPANIES_TABLE_ID               ?? 'mlwfjmp43n6ofwb',
  alerts:                  process.env.NOCODB_ALERTS_TABLE_ID                  ?? 'mwhmdw4co9vb18i',
  evidence:                process.env.NOCODB_EVIDENCE_TABLE_ID                ?? 'mj3li55fwaoxf8h',
  people:                  process.env.NOCODB_PEOPLE_TABLE_ID                  ?? 'mirv9mk98899bfj',
  // ── Support: source tables ────────────────────────────────────────────────
  support_queue:           process.env.NOCODB_SUPPORT_QUEUE_TABLE_ID           ?? '',
  cseticket_queue:         process.env.NOCODB_CSETICKET_QUEUE_TABLE_ID         ?? '',
  inquiry_queue:           process.env.NOCODB_INQUIRY_QUEUE_TABLE_ID           ?? '',
  // ── Support: derived tables ───────────────────────────────────────────────
  support_alerts:              process.env.NOCODB_SUPPORT_ALERTS_TABLE_ID              ?? '',
  support_case_ai_state:       process.env.NOCODB_SUPPORT_CASE_AI_STATE_TABLE_ID       ?? '',
  // ── Company: derived tables ───────────────────────────────────────────────
  unified_log_signal_state:    process.env.NOCODB_UNIFIED_LOG_SIGNAL_STATE_TABLE_ID    ?? '',
  company_summary_state:       process.env.NOCODB_COMPANY_SUMMARY_STATE_TABLE_ID       ?? '',
};

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
      'NOCODB_API_TOKEN が未設定です。.env.local を確認して dev server を再起動してください。',
    );
  }

  const url = new URL(`${BASE_URL}/api/v2/tables/${tableId}/records`);

  if (!params.limit) url.searchParams.set('limit', '200');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      'xc-token': API_TOKEN,
    },
    // Next.js キャッシュ: デフォルト force-cache を無効化して常に最新を取得
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`NocoDB ${res.status}: ${res.statusText} [${tableId}]`);
  }

  const json: NocoDBResponse<T> = await res.json();
  return json.list ?? [];
}
