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
  // ── Support: source tables（実データの source of truth）─────────────────
  //   未設定の場合は対応 view にフォールバックする
  log_intercom:            process.env.NOCODB_LOG_INTERCOM_TABLE_ID            ?? '',
  cse_tickets:             process.env.NOCODB_CSE_TICKETS_TABLE_ID             ?? '',
  // ── Support: operational views（廃止済み — UI read も source table 直読みに統一）──
  //   support_queue / inquiry_queue は log_intercom + massage_type フィルタで代替。
  //   cseticket_queue は cse_tickets 直読みで代替。
  //   これらの env は読まれなくなったが、既存 Vercel 設定との互換性のため残す。
  support_queue:           '',
  inquiry_queue:           '',
  cseticket_queue:         '',
  // ── Support: derived tables ───────────────────────────────────────────────
  support_alerts:              process.env.NOCODB_SUPPORT_ALERTS_TABLE_ID              ?? '',
  support_case_ai_state:       process.env.NOCODB_SUPPORT_CASE_AI_STATE_TABLE_ID       ?? '',
  support_case_state:          process.env.NOCODB_SUPPORT_CASE_STATE_TABLE_ID          ?? '',
  // ── Company: derived tables ───────────────────────────────────────────────
  unified_log_signal_state:    process.env.NOCODB_UNIFIED_LOG_SIGNAL_STATE_TABLE_ID    ?? '',
  company_summary_state:       process.env.NOCODB_COMPANY_SUMMARY_STATE_TABLE_ID       ?? '',
  company_actions:             process.env.NOCODB_COMPANY_ACTIONS_TABLE_ID             ?? 'm3mu9rwf2w7iho3',
  // CXM マネージド連絡先（CSM が追加・編集。既存の people テーブルとは別テーブル）
  company_people:              process.env.NOCODB_COMPANY_PEOPLE_TABLE_ID              ?? '',
  // ── Company: phase management ─────────────────────────────────────────────
  // CSM担当がいる企業: csm_customer_phase.m_phase を主表示
  // CSM担当がいない企業: crm_customer_phase.a_phase を主表示
  csm_customer_phase:          process.env.NOCODB_CSM_CUSTOMER_PHASE_TABLE_ID          ?? '',
  crm_customer_phase:          process.env.NOCODB_CRM_CUSTOMER_PHASE_TABLE_ID          ?? '',
  // ── Company: project info ─────────────────────────────────────────────────
  project_info:                process.env.NOCODB_PROJECT_INFO_TABLE_ID                ?? '',
  // ── Communication logs (company_uid FK) ──────────────────────────────────
  // chatwork / slack / notion-minutes を communication signal の入力として使用
  log_chatwork:                process.env.NOCODB_LOG_CHATWORK_TABLE_ID                ?? '',
  log_slack:                   process.env.NOCODB_LOG_SLACK_TABLE_ID                   ?? '',
  log_notion_minutes:          process.env.NOCODB_LOG_NOTION_MINUTES_TABLE_ID          ?? '',
  // ── Company: daily snapshot（変動コックピット用履歴）─────────────────────────
  // 日次バッチ（/api/batch/company-snapshot）で書き込む。
  // 未設定の場合はスナップショット機能が無効になるが、他の機能には影響しない。
  company_daily_snapshot:      process.env.NOCODB_COMPANY_DAILY_SNAPSHOT_TABLE_ID ?? '',
  // ── Ops: 監査ログ ──────────────────────────────────────────────────────────
  // 未設定の場合は writeBatchRunLog が console.log fallback になる
  audit_logs:                  process.env.NOCODB_AUDIT_LOGS_TABLE_ID                  ?? '',
  // UI/API からの Company 配下エンティティ変更ログ（batch run とは別テーブル）
  company_mutation_logs:       process.env.NOCODB_COMPANY_MUTATION_LOGS_TABLE_ID       ?? '',
  // ── Policies & Rules ────────────────────────────────────────────────────────
  // alert_policies / summary_policies を管理する運用テーブル。
  // 未設定の場合は CRUD API が 503 を返す（graceful degradation）。
  policies:                    process.env.NOCODB_POLICIES_TABLE_ID                    ?? '',
  // ── User profiles ────────────────────────────────────────────────────────────
  // スタッフ識別テーブル（staff_identify）をユーザープロファイルとして利用する。
  // owner_name in companies = staff_identify.name2（Roman/nickname 形式）
  staff_identify:              process.env.NOCODB_STAFF_IDENTIFY_TABLE_ID              ?? 'munjnmflbul56cu',
  // ── Outbound channel settings ─────────────────────────────────────────────────
  // 各企業の Slack / Chatwork / Intercom チャンネル設定 SSOT
  // カラム: company_uid, channel_type('slack'|'chatwork'|'intercom'), channel_id, channel_name, is_active
  company_channel_identify:    process.env.NOCODB_COMPANY_CHANNEL_IDENTIFY_TABLE_ID   ?? 'm8ssbcn7d8rzzu0',
  // ── Slack workspace bot tokens ─────────────────────────────────────────────
  // 外部 Slack ワークスペース（ext_slack_workspace=true）用の bot_token を管理
  // カラム: slack_team_id, bot_token
  slack_workspace_tokens:      process.env.NOCODB_SLACK_WORKSPACE_TOKENS_TABLE_ID    ?? 'mcktzoact8duhhm',
  // ── Outbound キャンペーン管理 ─────────────────────────────────────────────────
  // 下書き・送信済みキャンペーンを管理するテーブル
  outbound_campaigns:          process.env.NOCODB_OUTBOUND_CAMPAIGNS_TABLE_ID        ?? 'mnq1tzg4wsr684p',
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
 * NocoDB v2 クエリ文字列を構築する。
 * NocoDB のフィルタ構文 ( ) , ~ は raw のまま使う必要があるため、
 * URLSearchParams（percent-encode する）は使わず手動でクエリ文字列を構築する。
 * %28 / %29 / %2C 等にエンコードされると NocoDB がフィルタを無視して全件返す。
 */
function buildNocoQuery(params: Record<string, string>): string {
  const parts: string[] = [];
  // limit がなければデフォルト 200
  if (!params.limit) parts.push('limit=200');
  for (const [k, v] of Object.entries(params)) {
    // NocoDB フィルタ/ソート構文（where / sort / fields など）は raw のまま付与
    parts.push(`${k}=${v}`);
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/** デフォルト TTL: 5 分。mutate 系 API（POST/PATCH/DELETE）後は revalidateTag で無効化する */
export const NOCO_DEFAULT_TTL = 300;

/**
 * NocoDB v2 REST API からテーブルレコードを取得する汎用関数。
 * @param tableId  対象テーブルID
 * @param params   クエリパラメータ (where/sort/limit/offset 等)
 * @param ttl      キャッシュ秒数（デフォルト 300s）。false で no-store
 */
export async function nocoFetch<T>(
  tableId: string,
  params: Record<string, string> = {},
  ttl: number | false = NOCO_DEFAULT_TTL,
): Promise<T[]> {
  if (!API_TOKEN) {
    throw new Error(
      'NOCODB_API_TOKEN が未設定です。.env.local を確認して dev server を再起動してください。',
    );
  }

  const urlString = `${BASE_URL}/api/v2/tables/${tableId}/records${buildNocoQuery(params)}`;
  const cacheOption: RequestInit = ttl === false
    ? { cache: 'no-store' }
    : { next: { revalidate: ttl, tags: [`noco:${tableId}`] } };

  const res = await fetch(urlString, {
    headers: {
      'xc-token': API_TOKEN,
    },
    ...cacheOption,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '(body read failed)');
    const tokenHint = API_TOKEN ? `token=${API_TOKEN.slice(0, 6)}...` : 'token=(empty)';
    throw new Error(`NocoDB ${res.status}: ${res.statusText} [${tableId}] | ${tokenHint} | body=${body}`);
  }

  const json: NocoDBResponse<T> = await res.json();
  return json.list ?? [];
}

/**
 * 複数の company_uid を指定してレコードを一括取得する。
 * NocoDB の `in` オペレータ: (company_uid,in,uid1,uid2,uid3)
 * 返り値は Map<company_uid, T[]> 形式で company_uid → レコード配列の逆引きができる。
 *
 * @param tableId    対象テーブルID
 * @param uids       取得対象の company_uid 配列（空配列時は空 Map を返す）
 * @param extraParams 追加クエリパラメータ（sort/fields 等）
 *
 * ── 将来拡張メモ ─────────────────────────────────────────────────────────────
 *   date range filter: extraParams に `where` を部分結合できるようにすれば
 *     `(company_uid,in,...) ~and (sent_at,gte,2026-01-01)` 等が可能。
 *   limit per uid: 現在は uids.length × 100 の固定上限。
 *     UID 数が多い場合は extraParams.limit を上書きして調整できる。
 *   fields projection: extraParams に `fields=col1,col2` を渡すことで
 *     必要なカラムだけ取得してレスポンスを軽量化できる（NocoDB v2 対応済み）。
 *   sort: extraParams.sort で最新1件取得などに利用可能（例: sort='-sent_at'）。
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function nocoFetchByUids<T extends { company_uid?: string | null }>(
  tableId: string,
  uids: string[],
  extraParams: Omit<Record<string, string>, 'where'> = {},
  ttl: number | false = NOCO_DEFAULT_TTL,
): Promise<Map<string, T[]>> {
  if (!tableId || uids.length === 0) return new Map();
  const where = `(company_uid,in,${uids.join(',')})`;
  // 件数上限: uids × 想定最大件数。extraParams.limit が指定されていればそちらを優先。
  // デフォルトは uids × 20（上限 500）。log 系 bulk は呼び出し元で適切に指定すること。
  const limit = extraParams.limit ?? String(Math.min(uids.length * 20, 500));
  const rows = await nocoFetch<T>(tableId, { where, limit, ...extraParams }, ttl);
  const result = new Map<string, T[]>();
  for (const uid of uids) result.set(uid, []);
  for (const row of rows) {
    const uid = row.company_uid ?? '';
    if (!uid) continue;
    const arr = result.get(uid) ?? [];
    arr.push(row);
    result.set(uid, arr);
  }
  return result;
}

/**
 * NocoDB v2 REST API でレコード総数のみを取得する。
 * nocoFetch の pageInfo.totalRows を読むための最小コスト版（limit=1 で1件だけ取得）。
 * テーブル未設定 / エラー時は -1 を返す。
 */
export async function nocoCount(
  tableId: string,
  params: Record<string, string> = {},
): Promise<number> {
  if (!tableId || !API_TOKEN) return -1;
  // buildNocoQuery と同様に raw クエリ文字列を使用
  const query = buildNocoQuery({ ...params, limit: '1' });
  const urlString = `${BASE_URL}/api/v2/tables/${tableId}/records${query}`;
  const res = await fetch(urlString, {
    headers: { 'xc-token': API_TOKEN },
    next: { revalidate: NOCO_DEFAULT_TTL, tags: [`noco:${tableId}`] },
  });
  if (!res.ok) return -1;
  const json: NocoDBResponse<unknown> = await res.json();
  return json.pageInfo?.totalRows ?? -1;
}
