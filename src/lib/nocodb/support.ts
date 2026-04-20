// ─── Support 領域 read 関数（サーバーサイド専用）────────────────────────────
// source tables:   support_queue, cseticket_queue, inquiry_queue
// derived tables:  support_alerts, support_case_ai_state
//
// テーブル ID が空（未設定）のときは空配列 / null を返す。
// 呼び出し元で mock fallback すること。

import { nocoFetch, nocoCount, TABLE_IDS } from './client';
import {
  RawSupportCase,    AppSupportCase,         toAppSupportCase,
  RawCseTicket,      AppCseTicket,            toAppCseTicket,  cseTicketToAppSupportCase,
  RawInquiry,        AppInquiry,              toAppInquiry,
  RawSupportAlert,   AppSupportAlert,         toAppSupportAlert,
  RawSupportCaseAIState, AppSupportCaseAIState, toAppSupportCaseAIState,
} from './types';
import { fetchCanonicalNameMap } from './companies';
import { sourceRefToWhere, buildSourceRef } from '../support/source-ref';
export { sourceRefToWhere, buildSourceRef }; // 呼び出し元が support.ts 経由で使えるよう re-export
import {
  fromLogIntercomRecord, fromCseTicketRecord,
  fromLogIntercomRecordForDetail, fromCseTicketRecordForDetail,
} from '../support/queue-adapter';
import type { QueueItem, CaseDetail } from '../support/queue-adapter';
export type { QueueItem, CaseDetail } from '../support/queue-adapter';

// ── 統合 Support Queue（UI 一覧用）──────────────────────────────────────────
//
// log_intercom（massage_type = support / inquiry）+ cse_tickets を統合して返す。
// source table は更新しない。massage_type / caseType のマッピングはコード側で解決。
// NOCODB_LOG_INTERCOM_TABLE_ID が未設定なら即エラー。NOCODB_CSE_TICKETS_TABLE_ID
// が未設定の場合は CSE tickets なしで続行する（部分的フォールバック）。

/**
 * log_intercom + cse_tickets を統合した Support Queue 一覧を返す。
 * caseType は massage_type / source から自動判定するため massage_type フィルタなし。
 * 各レコードは fromLogIntercomRecord / fromCseTicketRecord で QueueItem に変換される。
 */
export async function getUnifiedQueueList(limit = 100): Promise<QueueItem[]> {
  const logId = TABLE_IDS.log_intercom;
  const cseId = TABLE_IDS.cse_tickets;

  if (!logId && !cseId) {
    throw new Error(
      'NOCODB_LOG_INTERCOM_TABLE_ID と NOCODB_CSE_TICKETS_TABLE_ID がどちらも未設定です',
    );
  }

  // 一覧掲載条件: source.display_title が非空のレコードのみ
  // - NocoDB: (display_title,notblank) で DB レベルフィルタ（空・null 除外）
  // - pre-adapter: 型チェック + trim() で空白のみ文字列・null・undefined を確実に除外
  // - adapter の fromLogIntercomRecord / fromCseTicketRecord は display_title を直接使うため
  //   fallback（body 抜粋・aiState.displayTitle 等）は一覧では発生しない
  const hasDisplayTitle = (r: { display_title?: string | null }) =>
    typeof r.display_title === 'string' && r.display_title.trim() !== '';

  const [logItems, cseItems] = await Promise.all([
    logId
      ? nocoFetch<RawSupportCase>(logId, {
          where: '(display_title,notblank)',
          sort: '-CreatedAt',
          limit: String(limit),
        }).then(rows => {
          const filtered = rows.filter(hasDisplayTitle);
          console.log(`[getUnifiedQueueList] log_intercom raw=${rows.length} after-hasDisplayTitle=${filtered.length}`);
          const items = filtered.map(r => fromLogIntercomRecord(r)).filter((x): x is QueueItem => x !== null);
          console.log(`[getUnifiedQueueList] log_intercom after-adapter=${items.length}`);
          return items;
        })
      : Promise.resolve([] as QueueItem[]),
    cseId
      ? nocoFetch<RawCseTicket>(cseId, {
          where: '(display_title,notblank)',
          sort: '-CreatedAt',
          limit: String(Math.min(limit, 50)),
        }).then(rows => {
          const filtered = rows.filter(hasDisplayTitle);
          console.log(`[getUnifiedQueueList] cse_tickets raw=${rows.length} after-hasDisplayTitle=${filtered.length}`);
          const items = filtered.map(r => fromCseTicketRecord(r)).filter((x): x is QueueItem => x !== null);
          console.log(`[getUnifiedQueueList] cse_tickets after-adapter=${items.length}`);
          return items;
        }).catch((err) => {
          console.error('[getUnifiedQueueList] cse_tickets error:', err);
          return [] as QueueItem[];
        })
      : Promise.resolve([] as QueueItem[]),
  ]);

  const withTitle = [...logItems, ...cseItems];

  // createdAt は "YYYY-MM-DD HH:MM" 形式なので辞書順 desc ソートが機能する
  withTitle.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sliced = withTitle.slice(0, limit);

  // ── companyName を canonical_name で上書き ──────────────────────────────────
  // company_uid が取得できている場合、companies テーブルの canonical_name を優先する。
  // account_name（Intercom）は会社の正式名称と異なることがあるため。
  // エラー / TABLE_ID 未設定時は既存の companyName（account_name 等）を保持。
  const uids = [...new Set(sliced.map(i => i.companyUid).filter(Boolean))];
  if (uids.length > 0) {
    const canonicalMap = await fetchCanonicalNameMap(uids).catch(() => new Map<string, string>());
    if (canonicalMap.size > 0) {
      return sliced.map(item => {
        const canonical = item.companyUid ? canonicalMap.get(item.companyUid) : undefined;
        return canonical ? { ...item, companyName: canonical } : item;
      });
    }
  }
  return sliced;
}

/** Support Queue の一覧を取得する（後方互換。内部で getUnifiedQueueList を使用）*/
export async function getSupportQueueList(limit = 100): Promise<QueueItem[]> {
  return getUnifiedQueueList(limit);
}

/**
 * cse_tickets テーブルから ticket_id で 1 件取得し AppSupportCase 形式で返す。
 * getSupportCaseById（log_intercom）がヒットしない場合の fallback として使用。
 */
export async function getCseTicketByIdAsCase(ticketId: string): Promise<AppSupportCase | null> {
  if (!TABLE_IDS.cse_tickets) return null;
  const raw = await nocoFetch<RawCseTicket>(TABLE_IDS.cse_tickets, {
    where: `(ticket_id,eq,${ticketId})`,
    limit: '1',
  }).catch(() => [] as RawCseTicket[]);
  return raw.length > 0 ? cseTicketToAppSupportCase(raw[0]) : null;
}

/** company_uid で絞り込んだ Support Queue リストを取得する */
export async function getSupportQueueByCompanyUid(
  companyUid: string,
  limit = 100,
): Promise<AppSupportCase[]> {
  const tableId = TABLE_IDS.log_intercom;
  if (!tableId) throw new Error(
    'NOCODB_LOG_INTERCOM_TABLE_ID が未設定です' +
    ` | source_table=log_intercom | filter=(massage_type,eq,support)~and(company_uid,eq,${companyUid})`,
  );
  const raw = await nocoFetch<RawSupportCase>(tableId, {
    where: `(massage_type,eq,support)~and(company_uid,eq,${companyUid})`,
    sort: '-CreatedAt',
    limit: String(limit),
  });
  return raw.map(toAppSupportCase);
}

/**
 * CaseDetail の companyName を companies テーブルの canonical_name で上書きする。
 * companyUid が空 / TABLE_ID 未設定 / API エラー時は元の companyName を保持。
 */
async function enrichDetailCompanyName(detail: CaseDetail | null): Promise<CaseDetail | null> {
  if (!detail || !detail.companyUid) return detail;
  const map = await fetchCanonicalNameMap([detail.companyUid]).catch(() => new Map<string, string>());
  const canonical = map.get(detail.companyUid);
  return canonical ? { ...detail, companyName: canonical } : detail;
}

/** case_id で 1 件取得する（massage_type フィルタなし — case_id は一意）*/
export async function getSupportCaseById(caseId: string): Promise<AppSupportCase | null> {
  const tableId = TABLE_IDS.log_intercom;
  if (!tableId) throw new Error(
    'NOCODB_LOG_INTERCOM_TABLE_ID が未設定です' +
    ` | source_table=log_intercom | filter=(case_id,eq,${caseId})`,
  );
  const raw = await nocoFetch<RawSupportCase>(tableId, {
    where: `(case_id,eq,${caseId})`,
    limit: '1',
  });
  return raw.length > 0 ? toAppSupportCase(raw[0]) : null;
}

/**
 * Detail ページ用: log_intercom から case_id で 1 件取得し CaseDetail を返す。
 * fromLogIntercomRecordForDetail を使うため originalMessage が含まれる。
 */
export async function getSupportCaseDetailById(caseId: string): Promise<CaseDetail | null> {
  const tableId = TABLE_IDS.log_intercom;
  if (!tableId) throw new Error(
    'NOCODB_LOG_INTERCOM_TABLE_ID が未設定です' +
    ` | source_table=log_intercom | filter=(case_id,eq,${caseId})`,
  );

  // 1. case_id で検索（多くのレコードはこちらでヒット）
  const byCase = await nocoFetch<RawSupportCase>(tableId, {
    where: `(case_id,eq,${caseId})`,
    limit: '1',
  }).catch(() => [] as RawSupportCase[]);
  if (byCase.length > 0) return enrichDetailCompanyName(fromLogIntercomRecordForDetail(byCase[0]));

  // 2. case_id が null で queue が String(raw.Id) をキーとして使っている場合の fallback
  //    caseId が数値文字列なら NocoDB 内部 Id フィールドで再検索する
  if (/^\d+$/.test(caseId)) {
    const byId = await nocoFetch<RawSupportCase>(tableId, {
      where: `(Id,eq,${caseId})`,
      limit: '1',
    }).catch(() => [] as RawSupportCase[]);
    if (byId.length > 0) return enrichDetailCompanyName(fromLogIntercomRecordForDetail(byId[0]));
  }

  return null;
}

/**
 * Detail ページ用: cse_tickets から ticket_id で 1 件取得し CaseDetail を返す。
 * getSupportCaseDetailById がヒットしない場合の fallback として使用。
 */
export async function getCseTicketDetailById(ticketId: string): Promise<CaseDetail | null> {
  if (!TABLE_IDS.cse_tickets) return null;

  // 1. ticket_id で検索（ticket_id が設定されているレコードはこちらでヒット）
  const byTicket = await nocoFetch<RawCseTicket>(TABLE_IDS.cse_tickets, {
    where: `(ticket_id,eq,${ticketId})`,
    limit: '1',
  }).catch(() => [] as RawCseTicket[]);
  if (byTicket.length > 0) return enrichDetailCompanyName(fromCseTicketRecordForDetail(byTicket[0]));

  // 2. ticket_id が null で queue が String(raw.Id) をキーとして使っている場合の fallback
  //    ticketId が数値文字列なら NocoDB 内部 Id フィールドで再検索する
  if (/^\d+$/.test(ticketId)) {
    const byId = await nocoFetch<RawCseTicket>(TABLE_IDS.cse_tickets, {
      where: `(Id,eq,${ticketId})`,
      limit: '1',
    }).catch(() => [] as RawCseTicket[]);
    if (byId.length > 0) return enrichDetailCompanyName(fromCseTicketRecordForDetail(byId[0]));
  }

  return null;
}

// ── batch 用: source table 直読み（log_intercom / cse_tickets）──────────────
//
// batch/rebuild API から呼ぶ専用関数。view fallback なし。
//
// 方針:
//   - log_intercom source table を直接読み、massage_type をコード側で明示フィルタ
//   - cse_tickets source table を直接読む（フィルタなし）
//   - NOCODB_LOG_INTERCOM_TABLE_ID / NOCODB_CSE_TICKETS_TABLE_ID が未設定なら即エラー
//   - UI read は view ベースの既存関数（getSupportQueueList 等）を使い続ける
//
// フィルタ対応表:
//   massage_type = 'support'  → log_intercom の support_queue 相当
//   massage_type = 'inquiry'  → log_intercom の inquiry_queue 相当
//   cse_tickets（フィルタなし）→ cseticket_queue 相当

/** batch 用メタ情報（dry_run レスポンス + エラー診断に使用）*/
export interface BatchSourceMeta {
  source_table:                 string;        // source table 名（log_intercom / cse_tickets）
  base_filter:                  string | null; // コード側で明示するフィルタ条件
  read_from:                    'source_table' | 'case_ids_lookup';
  attempted_env:                string;        // 使われた env キー名
  attempted_id:                 string;        // NocoDB へ渡した テーブル ID
  attempted_endpoint:           string;        // 呼び出し予定の NocoDB エンドポイント
  fetched_before_filter:        number;        // source table の全件数（フィルタなし、-1=取得不可）
  fetched_after_base_filter:    number;        // base_filter 適用後の件数（-1=N/A）
  fetched_after_request_filter: number;        // company_uid 等リクエストフィルタ後の最終件数
}

/**
 * Batch 用: log_intercom source table から massage_type で直接フィルタして取得。
 * view fallback なし。NOCODB_LOG_INTERCOM_TABLE_ID が未設定なら即エラー。
 *
 * massage_type = 'support' → support_queue view 相当
 * massage_type = 'inquiry' → inquiry_queue view 相当（将来の inquiry batch 用）
 */
export async function getSupportCasesForBatch(opts: {
  massageType: 'support' | 'inquiry';
  limit:       number;
  companyUid?: string;
}): Promise<{ records: AppSupportCase[]; meta: BatchSourceMeta }> {
  const tableId   = TABLE_IDS.log_intercom;
  const baseUrl   = process.env.NOCODB_BASE_URL ?? 'https://odtable.ptmind.ai';
  const baseFilter = `(massage_type,eq,${opts.massageType})`;
  const attemptedEndpoint = tableId
    ? `${baseUrl}/api/v2/tables/${tableId}/records`
    : '(NOCODB_LOG_INTERCOM_TABLE_ID 未設定)';

  // source table 未設定 → view fallback なし、即エラー
  if (!tableId) {
    throw new Error(
      'NOCODB_LOG_INTERCOM_TABLE_ID が未設定です。' +
      'Vercel の Environment Variables に追加してください。' +
      ' batch/rebuild は log_intercom source table 直読みに統一されています（view fallback なし）。' +
      ` | env=NOCODB_LOG_INTERCOM_TABLE_ID, endpoint=${attemptedEndpoint}`,
    );
  }

  // 1. source table 全件数（フィルタなし）
  const fetchedBeforeFilter = await nocoCount(tableId).catch(() => -1);

  // 2. base_filter（massage_type）のみの件数
  const fetchedAfterBaseFilter = await nocoCount(tableId, { where: baseFilter }).catch(() => -1);

  // 3. リクエストフィルタ込みで取得
  let where = baseFilter;
  if (opts.companyUid) {
    where = `${where}~and(company_uid,eq,${opts.companyUid})`;
  }
  const fetchParams: Record<string, string> = {
    sort:  '-CreatedAt',
    limit: String(opts.limit),
    where,
  };

  let raw: RawSupportCase[];
  try {
    raw = await nocoFetch<RawSupportCase>(tableId, fetchParams);
  } catch (err) {
    const base = err instanceof Error ? err.message : String(err);
    throw new Error(
      `${base} | env=NOCODB_LOG_INTERCOM_TABLE_ID, id=${tableId}, endpoint=${attemptedEndpoint}`,
    );
  }

  const records = raw.map(toAppSupportCase);
  return {
    records,
    meta: {
      source_table:                 'log_intercom',
      base_filter:                  baseFilter,
      read_from:                    'source_table',
      attempted_env:                'NOCODB_LOG_INTERCOM_TABLE_ID',
      attempted_id:                 tableId,
      attempted_endpoint:           attemptedEndpoint,
      fetched_before_filter:        fetchedBeforeFilter,
      fetched_after_base_filter:    fetchedAfterBaseFilter,
      fetched_after_request_filter: records.length,
    },
  };
}

/**
 * Batch 用: log_intercom から case_id で1件取得（case_ids 指定時の個別 lookup 用）。
 * view fallback なし。NOCODB_LOG_INTERCOM_TABLE_ID が未設定なら即エラー。
 */
export async function getLogIntercomCaseById(caseId: string): Promise<AppSupportCase | null> {
  const tableId = TABLE_IDS.log_intercom;
  if (!tableId) {
    throw new Error(
      'NOCODB_LOG_INTERCOM_TABLE_ID が未設定です。' +
      ' case_ids lookup も log_intercom source table から直接読みます（view fallback なし）。',
    );
  }
  const raw = await nocoFetch<RawSupportCase>(tableId, {
    where: `(case_id,eq,${caseId})`,
    limit: '1',
  });
  return raw.length > 0 ? toAppSupportCase(raw[0]) : null;
}

/**
 * Batch 用: cse_tickets source table から取得。
 * view fallback なし。NOCODB_CSE_TICKETS_TABLE_ID が未設定なら即エラー。
 *
 * cseticket_queue はフィルタなし view のため、source 直読みと結果は同じ。
 */
export async function getCseTicketsForBatch(opts: {
  limit:       number;
  companyUid?: string;
}): Promise<{ records: AppCseTicket[]; meta: BatchSourceMeta }> {
  const tableId   = TABLE_IDS.cse_tickets;
  const baseUrl   = process.env.NOCODB_BASE_URL ?? 'https://odtable.ptmind.ai';
  const attemptedEndpoint = tableId
    ? `${baseUrl}/api/v2/tables/${tableId}/records`
    : '(NOCODB_CSE_TICKETS_TABLE_ID 未設定)';

  if (!tableId) {
    throw new Error(
      'NOCODB_CSE_TICKETS_TABLE_ID が未設定です。' +
      'Vercel の Environment Variables に追加してください。' +
      ` | env=NOCODB_CSE_TICKETS_TABLE_ID, endpoint=${attemptedEndpoint}`,
    );
  }

  // 1. 全件数（フィルタなし）
  const fetchedBeforeFilter = await nocoCount(tableId).catch(() => -1);

  // 2. cse_tickets はフィルタなしなので base_filter = null, after_base = before
  const fetchParams: Record<string, string> = { sort: '-CreatedAt', limit: String(opts.limit) };
  if (opts.companyUid) fetchParams.where = `(company_uid,eq,${opts.companyUid})`;

  let raw: RawCseTicket[];
  try {
    raw = await nocoFetch<RawCseTicket>(tableId, fetchParams);
  } catch (err) {
    const base = err instanceof Error ? err.message : String(err);
    throw new Error(
      `${base} | env=NOCODB_CSE_TICKETS_TABLE_ID, id=${tableId}, endpoint=${attemptedEndpoint}`,
    );
  }

  const records = raw.map(toAppCseTicket);
  return {
    records,
    meta: {
      source_table:                 'cse_tickets',
      base_filter:                  null,
      read_from:                    'source_table',
      attempted_env:                'NOCODB_CSE_TICKETS_TABLE_ID',
      attempted_id:                 tableId,
      attempted_endpoint:           attemptedEndpoint,
      fetched_before_filter:        fetchedBeforeFilter,
      fetched_after_base_filter:    fetchedBeforeFilter,  // フィルタなしなので同じ
      fetched_after_request_filter: records.length,
    },
  };
}

// ── support_alerts (derived) ─────────────────────────────────────────────────

/** Support Home 用のアラート一覧を取得する（デフォルト 50 件, 新しい順）*/
export async function getSupportAlerts(limit = 50): Promise<AppSupportAlert[]> {
  if (!TABLE_IDS.support_alerts) return [];
  const raw = await nocoFetch<RawSupportAlert>(TABLE_IDS.support_alerts, {
    sort: '-CreatedAt',
    limit: String(limit),
  });
  return raw.map(toAppSupportAlert);
}

// ── support_case_ai_state (derived) ──────────────────────────────────────────

/**
 * 案件の AI 解析状態を取得する。
 * @param sourceId    対象の case_id / inquiry_id / ticket_id
 * @param sourceTable "support_queue" | "inquiry_queue" | "cseticket_queue"
 */
export async function getSupportCaseAIStateBySource(
  sourceId: string,
  sourceTable: string,
): Promise<AppSupportCaseAIState | null> {
  if (!TABLE_IDS.support_case_ai_state) return null;
  const ref = buildSourceRef(sourceId, sourceTable);
  const raw = await nocoFetch<RawSupportCaseAIState>(TABLE_IDS.support_case_ai_state, {
    where: sourceRefToWhere(ref),
    limit: '1',
  });
  return raw.length > 0 ? toAppSupportCaseAIState(raw[0]) : null;
}

// ── cseticket_queue（cse_tickets source table 直読み）───────────────────────
//
// cseticket_queue view はフィルタなし view のため、source table 直読みと結果は同じ。
// NOCODB_CSE_TICKETS_TABLE_ID が未設定なら即エラー（mock fallback なし）。

/**
 * CSE Ticket Queue を company または case でフィルタして取得する。
 * 両方未指定の場合は全件（limit 上限）を返す。
 */
export async function getCseTicketQueueByCompanyOrCase(opts: {
  companyUid?: string;
  caseId?: string;
  limit?: number;
}): Promise<AppCseTicket[]> {
  const tableId = TABLE_IDS.cse_tickets;
  if (!tableId) throw new Error(
    'NOCODB_CSE_TICKETS_TABLE_ID が未設定です | source_table=cse_tickets',
  );
  const where = opts.companyUid
    ? `(company_uid,eq,${opts.companyUid})`
    : opts.caseId
    ? `(linked_case_id,eq,${opts.caseId})`
    : undefined;
  const raw = await nocoFetch<RawCseTicket>(tableId, {
    ...(where ? { where } : {}),
    sort: '-CreatedAt',
    limit: String(opts.limit ?? 50),
  });
  return raw.map(toAppCseTicket);
}

// ── inquiry_queue（log_intercom source table 直読み）─────────────────────────
//
// massage_type = 'inquiry' をコード側でフィルタ。
// NOCODB_LOG_INTERCOM_TABLE_ID が未設定なら即エラー（mock fallback なし）。

/**
 * Inquiry Queue を company または case でフィルタして取得する。
 */
export async function getInquiryQueueByCompanyOrCase(opts: {
  companyUid?: string;
  caseId?: string;
  limit?: number;
}): Promise<AppInquiry[]> {
  const tableId = TABLE_IDS.log_intercom;
  if (!tableId) throw new Error(
    'NOCODB_LOG_INTERCOM_TABLE_ID が未設定です | source_table=log_intercom | filter=(massage_type,eq,inquiry)',
  );
  let where = '(massage_type,eq,inquiry)';
  if (opts.companyUid) {
    where = `${where}~and(company_uid,eq,${opts.companyUid})`;
  } else if (opts.caseId) {
    where = `${where}~and(linked_case_id,eq,${opts.caseId})`;
  }
  const raw = await nocoFetch<RawInquiry>(tableId, {
    where,
    sort: '-CreatedAt',
    limit: String(opts.limit ?? 50),
  });
  return raw.map(toAppInquiry);
}
