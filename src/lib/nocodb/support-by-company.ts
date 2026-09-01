// ─── Company 単位の Support 集約 read helpers ────────────────────────────────
//
// 1企業の support 関連データを集約する。
// - Detail API: 実ケース一覧 + AI state を返す
// - List API:   counts のみ（nocoFetchAllByUids で全行ページング取得）
//
// 既存の support.ts は全社横断クエリ専用のため、ここに company_uid フィルタ版を置く。

import { nocoFetch, nocoFetchAll, nocoFetchAllByUids, TABLE_IDS } from './client';
import {
  toAppSupportCase,
  toAppCseTicket,
  toAppSupportCaseAIState,
  type RawSupportCase,
  type RawCseTicket,
  type RawSupportCaseAIState,
  type AppSupportCase,
  type AppCseTicket,
  type AppSupportCaseAIState,
} from './types';

// ── "オープン" の定義 ─────────────────────────────────────────────────────────
//
// log_intercom (Intercom ケース):
//   routing_status が 'closed' / 'resolved' 以外のもの（'unassigned' 等は open 扱い）。
//   未設定の場合も open 扱い（保守的カウント）。
//
// cse_tickets (CSE チケット):
//   status が 'Closed' 以外のもの。実データの語彙は
//   'To Do' / 'In Progress' / 'Pending' / 'Waiting Confirm' / 'Reopened' / 'Closed'。
//   'Waiting Confirm' は open の内訳として waitingCseCount に別集計する。
//
// ── 重複行の畳み込み（重要）──────────────────────────────────────────────────
//
// cse_tickets は同期ジョブが upsert ではなく append で書き込むため、
// 1チケットが source_record_id を共有した複数行として蓄積する
// （実測: Tier1/2 の 69,698 行 = 実チケット 578 件 / 約120倍）。
// 行数をそのまま数えると件数が2桁膨らむため、
// rollupBySourceRecord() で source_record_id 単位に畳み込み、
// CreatedAt が最新の行を「現在の状態」として採用する。
// log_intercom 側は重複していないが、同じ経路を通しても結果は変わらない。
//
// ── 4カウントの定義 ────────────────────────────────────────────────────────────
//
// openSupportCount    : log_intercom オープン件数 + cse_tickets オープン件数（重複畳み込み後）
// waitingCseCount     : cse_tickets の 'Waiting Confirm'（open の内訳）
// criticalSupportCount: log_intercom の severity='critical' かつオープンな件数
// recentSupportCount  : 直近 7 日以内に発生したオープン件数
//
// ─────────────────────────────────────────────────────────────────────────────

/**
 * status 文字列の正規化。
 * cse_tickets の実値は 'Waiting Confirm' / 'To Do' のように空白+大文字混在で、
 * コード側が想定していた 'waiting_customer' 形式とは一致しない。
 * 小文字化 + 区切り（空白/アンダースコア/ハイフン）を単一スペースに畳んで比較する。
 */
function normStatus(v: unknown): string {
  return String(v ?? '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
}

/**
 * cse_tickets.status の実データ語彙（2026-08 実測）:
 *   'To Do' / 'In Progress' / 'Pending' / 'Waiting Confirm' / 'Reopened' / 'Closed'
 * 'resolved' / 'waiting_customer' は実在しない。
 */
const CSE_CLOSED_STATUSES = new Set(['closed', 'resolved', 'done']);

/** cse_tickets の「顧客確認待ち」status（open の内訳として別集計する） */
const CSE_WAITING_STATUSES = new Set(['waiting confirm', 'waiting customer', 'waiting reply']);

/**
 * Intercom の会話状態。**`source_status` が正本。**
 *
 * `routing_status` は CXM 側の振り分け語彙（unassigned / triaged / assigned …）で、
 * **Intercom の実態を表していない。** 実測（2026-08-25 / 全17,280件）:
 *   routing_status=unassigned 1,185件 → 実際は open 1,015 / snoozed 168 / closed 2
 *   routing_status=closed だが source_status=open の取りこぼしが 50件
 *
 * さらに運用上、**アサインの有無でフローは止まらない**（未アサインでも回答担当がいる）。
 * 見るべきは open か snoozed か closed かだけ。
 */
export type IntercomState = 'open' | 'snoozed' | 'closed';

const INTERCOM_OPEN_STATES = new Set(['open', 'snoozed']);

/** 旧同期分（source_status が空）のためのフォールバック語彙 */
const INTERCOM_CLOSED_STATUSES = new Set(['closed', 'resolved', 'ignored']);

/**
 * 会話の状態を決める。source_status を優先し、無ければ routing_status に落ちる。
 * 旧同期分 12,526件は source_status が空で routing_status=closed のため、
 * フォールバックで正しく closed になる。
 */
export function intercomState(
  sourceStatus: string | null | undefined,
  routingStatus: string | null | undefined,
): IntercomState {
  const src = normStatus(sourceStatus);
  if (src === 'open')    return 'open';
  if (src === 'snoozed') return 'snoozed';
  if (src === 'closed')  return 'closed';
  // source_status が無い行だけ routing_status を見る
  return INTERCOM_CLOSED_STATUSES.has(normStatus(routingStatus)) ? 'closed' : 'open';
}

/** 直近 N 日以内 = 「recent」の定義（activity 表示用） */
const RECENT_DAYS = 7;

/**
 * リスクシグナル判定に使う「有効期間」。
 * この日数を超えて作成されたオープンチケットは、クローズし忘れた放置ケースとみなし
 * criticalCount / health シグナルの対象から除外する。
 * AI プロンプトにも stale として明示することで過剰なリスク判定を防ぐ。
 */
export const SUPPORT_RISK_WINDOW_DAYS = 90;

function isIntercomOpen(
  sourceStatus: string | null | undefined,
  routingStatus: string | null | undefined,
): boolean {
  return INTERCOM_OPEN_STATES.has(intercomState(sourceStatus, routingStatus));
}

function isCseOpen(status: string | null | undefined): boolean {
  return !CSE_CLOSED_STATUSES.has(normStatus(status));
}

function isCseWaiting(status: string | null | undefined): boolean {
  return CSE_WAITING_STATUSES.has(normStatus(status));
}

function isRecent(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const ms = new Date(String(createdAt).trim().replace(' ', 'T')).getTime();
  if (isNaN(ms)) return false;
  return (Date.now() - ms) / (1000 * 60 * 60 * 24) <= RECENT_DAYS;
}

/** リスク判定ウィンドウ内（SUPPORT_RISK_WINDOW_DAYS 以内）に作成されたか */
function isWithinRiskWindow(createdAt: string | null | undefined): boolean {
  if (!createdAt) return true; // 作成日不明は保守的に含める
  const ms = new Date(String(createdAt).trim().replace(' ', 'T')).getTime();
  if (isNaN(ms)) return true;
  return (Date.now() - ms) / (1000 * 60 * 60 * 24) <= SUPPORT_RISK_WINDOW_DAYS;
}

// ── 型定義 ────────────────────────────────────────────────────────────────────

export interface SupportAggregateVM {
  /** log_intercom オープンケース数（routing_status が open/snoozed/未設定） */
  openIntercomCount:  number;
  /** cse_tickets オープンチケット数（resolved/closed 以外） */
  openCseCount:       number;
  /** cse_tickets の中で waiting_customer のチケット数 */
  waitingCseCount:    number;
  /** log_intercom の severity=critical かつオープンなケース数（全期間） */
  criticalCount:      number;
  /** log_intercom の severity=high かつオープンなケース数（全期間） */
  highCount:          number;
  /**
   * リスク判定有効ウィンドウ（SUPPORT_RISK_WINDOW_DAYS 以内）のオープンケース数。
   * AI プロンプト・health シグナルのリスク判定はこちらを使う。
   */
  recentOpenCount:    number;
  /** リスク判定ウィンドウ内の critical オープン数（health シグナル用） */
  recentCriticalCount: number;
  /**
   * リスク判定ウィンドウ外（SUPPORT_RISK_WINDOW_DAYS 超）のオープン件数。
   * クローズし忘れ等の放置ケース。AI には参考値として渡すがリスク根拠にしない。
   */
  staleOpenCount:     number;
  /** 直近 RECENT_DAYS 日以内に作成されたオープンケース数 */
  recentSupportCount: number;
  /** 直近 N 件のケース（Detail API で使用） */
  recentCases:        AppSupportCase[];
  /** 直近 N 件の CSE チケット（Detail API で使用） */
  cseTickets:         AppCseTicket[];
  /** AI state 集約（Detail API で使用） */
  aiStates:           AppSupportCaseAIState[];
}

export interface SupportCountSummary {
  /** log_intercom オープン + cse_tickets オープンの合計 */
  openCount:           number;
  /** cse_tickets の waiting_customer のみ */
  waitingCseCount:     number;
  /** log_intercom の critical かつオープン */
  criticalCount:       number;
  /** 直近 RECENT_DAYS 日以内に作成されたオープンケース数 */
  recentSupportCount:  number;
  /**
   * リスク判定ウィンドウ（SUPPORT_RISK_WINDOW_DAYS = 90日）内に起票され、
   * 今も開いている件数。**「現在の摩擦」はこちらで測る。**
   *
   * openCount（全期間）を摩擦に使うと、閉じ忘れが恒久的な減点になる。
   * 実測（2026-08-31）: cse_tickets の未クローズ705件のうち、
   * 直近90日に動いたものは **0件**。Waiting Confirm / To Do が
   * 事実上の駐車場になっていて、ステータスが運用されていなかった。
   */
  recentOpenCount:     number;
  /**
   * リスク判定ウィンドウ（SUPPORT_RISK_WINDOW_DAYS = 90日）を超えて開いている件数。
   * R3_Risk_UnresolvedTicket_Aging（未解決チケットの滞留）の判定に使う。
   */
  staleOpenCount:      number;
}

// ── 重複行の畳み込み ──────────────────────────────────────────────────────────

/** source_record_id 単位に畳み込んだ 1 チケット */
interface TicketRollup<T> {
  /** CreatedAt が最大の行 = 現在の状態 */
  latest:      T;
  /** CreatedAt が最小の行の CreatedAt = 同期に初出した時刻（起票時刻の代理） */
  firstSeenAt: string | null;
  /**
   * 重複行のどれかに入っていた created_at（起票時刻）。
   * cse_tickets は追記された行の created_at が null になることが多く、
   * 最新行だけを見ると起票時刻を取り落とす。
   */
  createdAt:   string | null;
  /** 重複行を通じた last_modified_at の最大値（= 元データ側の更新日時） */
  modifiedAt:  string | null;
  /** 畳み込んだ行数（同期の重複度。1 なら重複なし） */
  rowCount:    number;
}

type RollupRow = {
  Id?:               number;
  source_record_id?: unknown;
  CreatedAt?:        unknown;
  created_at?:       unknown;
  last_modified_at?: unknown;
};

/** 空文字を null に落として文字列化する */
function trimmed(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

/**
 * source_record_id 単位に行を畳み込む。
 * source_record_id が無い行は Id 単位（＝畳み込まない）で扱う。
 */
function rollupBySourceRecord<T extends RollupRow>(rows: T[]): TicketRollup<T>[] {
  const map = new Map<string, TicketRollup<T>>();
  rows.forEach((row, i) => {
    const src = row.source_record_id != null ? String(row.source_record_id).trim() : '';
    const key = src || `row:${row.Id ?? `idx${i}`}`;
    const at  = row.CreatedAt != null ? String(row.CreatedAt) : '';
    const createdAt  = trimmed(row.created_at);
    const modifiedAt = trimmed(row.last_modified_at);
    const cur = map.get(key);
    if (!cur) {
      map.set(key, { latest: row, firstSeenAt: at || null, createdAt, modifiedAt, rowCount: 1 });
      return;
    }
    cur.rowCount++;
    if (at && at > String(cur.latest.CreatedAt ?? '')) cur.latest = row;
    if (at && (!cur.firstSeenAt || at < cur.firstSeenAt)) cur.firstSeenAt = at;
    // 起票時刻は全行で同じ値。null が多いので「最初に見つかった値」を採る
    if (createdAt && !cur.createdAt) cur.createdAt = createdAt;
    // 更新日時は最大値
    if (modifiedAt && (!cur.modifiedAt || modifiedAt > cur.modifiedAt)) cur.modifiedAt = modifiedAt;
  });
  return [...map.values()];
}

/**
 * チケットの「発生時刻」。
 * cse_tickets の created_at は追記行では null になるため、
 * 重複行のどこかに入っていた値（rollup.createdAt）を優先して使う。
 * それも無ければ同期初出時刻（firstSeenAt）を代理値にする。
 * CreatedAt（最新行）は同期が行を追加した時刻なので使ってはいけない。
 */
function occurredAt<T extends RollupRow>(r: TicketRollup<T>): string | null {
  return r.createdAt ?? trimmed(r.latest.created_at) ?? r.firstSeenAt;
}

// ── 単一 company_uid（Detail API 用）─────────────────────────────────────────

/**
 * 集計に必要な列だけを投影した cse_tickets の全行取得（ページング）。
 * raw_body / raw_json / describe 等の重量列は取らない
 * （1社で 1,000 行超あるため、本文列を含めると転送量が跳ねる）。
 */
const CSE_COUNT_FIELDS =
  'Id,source_record_id,company_uid,company_name,status,severity,title,display_title,created_at,updated_at,last_modified_at,CreatedAt';

/**
 * 表示用の投影。本文列（describe / display_message）を含むため、
 * 畳み込み後の「代表行だけ」を Id 指定で取り直すときにのみ使う。
 * ⚠️ priority / description / waiting_hours / linked_case_id は cse_tickets に
 *    実在しないので投影しない（存在しない列を指定すると 422 で全件落ちる）。
 */
const CSE_DISPLAY_FIELDS =
  'Id,source_record_id,company_uid,company_name,status,severity,title,display_title,'
  + 'display_message,describe,raw_body,product,type,created_at,updated_at,last_modified_at,CreatedAt';

/** 集計に必要な列だけを投影した log_intercom の全行取得（ページング）用 */
const INTERCOM_COUNT_FIELDS =
  'Id,source_record_id,company_uid,routing_status,source_status,severity,created_at,CreatedAt';

/**
 * 一括カウント専用の投影（表示用の列を含まない最小セット）。
 * cse_tickets は重複行のため全社分では数万行になる。転送量を落として往復を速くする。
 */
const CSE_BULK_COUNT_FIELDS =
  'Id,source_record_id,company_uid,status,severity,created_at,CreatedAt';

/** 1企業の cse_tickets 全行を取得して source_record_id 単位に畳み込む */
async function fetchCseRollupsForCompany(companyUid: string): Promise<TicketRollup<RawCseTicket>[]> {
  const tableId = TABLE_IDS.cse_tickets;
  if (!tableId) return [];
  const rows = await nocoFetchAll<RawCseTicket>(
    tableId,
    { where: `(company_uid,eq,${companyUid})`, sort: '-CreatedAt', fields: CSE_COUNT_FIELDS },
    false,
    { maxRows: 20_000 },
  );
  return rollupBySourceRecord(rows);
}

/** 1企業の log_intercom 全行を取得して source_record_id 単位に畳み込む */
async function fetchIntercomRollupsForCompany(companyUid: string): Promise<TicketRollup<RawSupportCase>[]> {
  const tableId = TABLE_IDS.log_intercom;
  if (!tableId) return [];
  const rows = await nocoFetchAll<RawSupportCase>(
    tableId,
    { where: `(company_uid,eq,${companyUid})`, sort: '-CreatedAt', fields: INTERCOM_COUNT_FIELDS },
    false,
    { maxRows: 20_000 },
  );
  return rollupBySourceRecord(rows);
}

/**
 * 畳み込み済み rollup から表示用の行を作る（log_intercom）。
 *
 * log_intercom は **1会話 = 複数行（メッセージ単位）** なので、
 * 生の行を新しい順に 5 件取ると同じ会話がリストを埋めてしまう。
 * source_record_id で畳み込んだ代表行の Id だけを取り直す。
 *
 * 選び方は「新着順に recent 件」＋「open / snoozed は別枠で live 件」。
 * 直近がすべて closed の会社で、未クローズが 1 件もリストに載らない
 * ——という状態を避けるため（画面で見たいのは Open と Snooze）。
 */
async function hydrateIntercomDisplayRows(
  rollups: TicketRollup<RawSupportCase>[],
  recent = 5,
  live   = 10,
): Promise<AppSupportCase[]> {
  const byNewest = [...rollups].sort(
    (a, b) => String(b.latest.CreatedAt ?? '').localeCompare(String(a.latest.CreatedAt ?? '')));

  // 同じ rollup オブジェクトを両方の枠で拾うため、参照の Set で重複排除する
  const picked = new Set<TicketRollup<RawSupportCase>>();
  const take = (list: TicketRollup<RawSupportCase>[], n: number) => {
    for (const r of list.slice(0, n)) picked.add(r);
  };
  take(byNewest.filter(r =>
    isIntercomOpen(r.latest.source_status as string | null, r.latest.routing_status as string | null)), live);
  take(byNewest, recent);

  const latest = [...picked].sort(
    (a, b) => String(b.latest.CreatedAt ?? '').localeCompare(String(a.latest.CreatedAt ?? '')));
  if (latest.length === 0) return [];

  const tableId = TABLE_IDS.log_intercom;
  const ids = latest.map(r => r.latest.Id).filter((id): id is number => id != null);
  if (!tableId || ids.length === 0) return latest.map(r => toAppSupportCase(r.latest));

  // 本文列は rollup の投影（INTERCOM_COUNT_FIELDS）に無いので Id 指定で取り直す
  const rows = await nocoFetch<RawSupportCase>(tableId, {
    where: `(Id,in,${ids.join(',')})`,
    limit: String(ids.length),
  }).catch(() => [] as RawSupportCase[]);
  const byId = new Map(rows.map(r => [r.Id, r]));
  return latest.map(r => toAppSupportCase(byId.get(r.latest.Id as number) ?? r.latest));
}

/**
 * 畳み込み済み rollup から表示用の最新 limit 件を作る。
 *
 * rollup 側の投影（CSE_COUNT_FIELDS）には本文列が無いため、
 * 代表行の Id を指定して本文列だけを取り直す（1リクエスト）。
 * 全行に本文列を載せると 1社 1,000 行超 × describe/raw_body で転送量が跳ねる。
 */
async function hydrateCseDisplayRows(
  rollups: TicketRollup<RawCseTicket>[],
  limit: number,
): Promise<AppCseTicket[]> {
  const tableId = TABLE_IDS.cse_tickets;
  const latest = [...rollups]
    .sort((a, b) => String(b.latest.CreatedAt ?? '').localeCompare(String(a.latest.CreatedAt ?? '')))
    .slice(0, limit);
  if (latest.length === 0) return [];
  if (!tableId) return latest.map(r => toAppCseTicket(r.latest));

  const ids = latest.map(r => r.latest.Id).filter((id): id is number => id != null);
  if (ids.length === 0) return latest.map(r => toAppCseTicket(r.latest));

  const rows = await nocoFetch<RawCseTicket>(tableId, {
    where:  `(Id,in,${ids.join(',')})`,
    fields: CSE_DISPLAY_FIELDS,
    limit:  String(ids.length),
  }).catch((e: unknown) => {
    // 本文の取り直しに失敗しても一覧自体は出す（本文なし表示になる）
    console.warn('[support-by-company] cse_tickets 本文の再取得に失敗:', e);
    return [] as RawCseTicket[];
  });

  const byId = new Map(rows.map(r => [String(r.Id), r]));
  // 並び順は rollup 側（CreatedAt 降順）を維持する。
  // 代表行の created_at / last_modified_at は追記行だと null になるため、
  // 畳み込みで拾った値（occurredAt / modifiedAt）で補完する。
  return latest.map(r => {
    const row = byId.get(String(r.latest.Id)) ?? r.latest;
    return toAppCseTicket({
      ...row,
      created_at:       row.created_at       ?? occurredAt(r),
      last_modified_at: row.last_modified_at ?? r.modifiedAt,
    });
  });
}

/**
 * 1企業の CSE tickets を取得する（表示用）。
 * 同期の重複行を畳み込んでから最新 limit 件を返すため、
 * 同一チケットが limit 件並ぶ表示崩れが起きない。
 */
export async function fetchCseTicketsForCompany(
  companyUid: string,
  limit = 20,
): Promise<AppCseTicket[]> {
  const rollups = await fetchCseRollupsForCompany(companyUid);
  return hydrateCseDisplayRows(rollups, limit);
}

/**
 * 1企業の support_case_ai_state を取得する。
 * case_id に紐づく AI 分析結果（urgency / summary 等）。
 */
export async function fetchSupportAIStatesForCompany(
  companyUid: string,
  limit = 20,
): Promise<AppSupportCaseAIState[]> {
  const tableId = TABLE_IDS.support_case_ai_state;
  if (!tableId) return [];
  // support_case_ai_state は company_uid を直接持たない場合があるため
  // source_record_id (case_id) を使ったジョインが本来だが、
  // 暫定で company_uid フィールドがある場合はそれを使う
  const rows = await nocoFetch<RawSupportCaseAIState>(tableId, {
    where: `(company_uid,eq,${companyUid})`,
    sort:  '-created_at',
    limit: String(limit),
  }).catch(() => [] as RawSupportCaseAIState[]);
  return rows.map(toAppSupportCaseAIState);
}

/**
 * 4ソースを並行取得して SupportAggregateVM を構築する（Detail API 用）。
 *
 * 件数カウントは「全行ページング取得 → source_record_id で畳み込み」で算出する。
 * 表示用リスト（limit 20）から数えると limit で切れ、かつ同期の重複行を
 * 別チケットとして数えてしまうため、カウントと表示のデータ経路を分けている。
 */
export async function fetchSupportAggregateForCompany(
  companyUid: string,
): Promise<SupportAggregateVM> {
  const [intercomRollups, cseRollups, aiStates] = await Promise.all([
    fetchIntercomRollupsForCompany(companyUid),
    fetchCseRollupsForCompany(companyUid),
    fetchSupportAIStatesForCompany(companyUid),
  ]);

  const openIntercom = intercomRollups.filter(r =>
    isIntercomOpen(r.latest.source_status as string | null, r.latest.routing_status as string | null));
  const openCse      = cseRollups.filter(r => isCseOpen(r.latest.status));

  const sev = (r: TicketRollup<RawSupportCase>) => String(r.latest.severity ?? '').toLowerCase();
  const criticalCount   = openIntercom.filter(r => sev(r) === 'critical').length;
  const highCount       = openIntercom.filter(r => sev(r) === 'high').length;
  const waitingCseCount = cseRollups.filter(r => isCseWaiting(r.latest.status)).length;

  const recentSupportCount = openIntercom.filter(r => isRecent(occurredAt(r))).length
    + openCse.filter(r => isRecent(occurredAt(r))).length;

  // リスク判定ウィンドウ内のオープンケース（90日以内）
  const riskIntercom = openIntercom.filter(r => isWithinRiskWindow(occurredAt(r)));
  const riskCse      = openCse.filter(r => isWithinRiskWindow(occurredAt(r)));
  const recentOpenCount     = riskIntercom.length + riskCse.length;
  const recentCriticalCount = riskIntercom.filter(r => sev(r) === 'critical').length;
  const staleOpenCount      = (openIntercom.length + openCse.length) - recentOpenCount;

  // 本文列は rollup の投影に含まれないため、表示する分だけ取り直す
  const [cseDisplay, intercomDisplay] = await Promise.all([
    hydrateCseDisplayRows(cseRollups, 5),
    hydrateIntercomDisplayRows(intercomRollups),
  ]);

  return {
    openIntercomCount:   openIntercom.length,
    openCseCount:        openCse.length,
    waitingCseCount,
    criticalCount,
    highCount,
    recentOpenCount,
    recentCriticalCount,
    staleOpenCount,
    recentSupportCount,
    recentCases:  intercomDisplay,
    cseTickets:   cseDisplay,
    aiStates:     aiStates.slice(0, 5),
  };
}

// ── 複数 company_uids（List API 用）─────────────────────────────────────────

/**
 * fetchSupportCountsByUids のプロセスメモリキャッシュ。
 * 全行ページングは Tier1/2 で約70リクエスト（実測 ~10秒）かかるため、
 * 同一 uid セットに対する短時間の再取得を抑える。
 */
const _countsCache = new Map<string, { data: Map<string, SupportCountSummary>; ts: number }>();
const COUNTS_TTL_MS = 5 * 60 * 1000;

/** 同一 uid セットの多重実行を防ぐ in-flight レジストリ */
const _countsInflight = new Map<string, Promise<Map<string, SupportCountSummary> | null>>();

/**
 * 取得予算（ミリ秒）。予算内に終わらなければ「未取得」として空 Map を返す。
 *
 * サポート情報は主要指標より優先度が低い。UI 経路では 10 秒待つより
 * 「未取得（null）」で先に画面を返し、裏で完走したキャッシュを次回以降に使う。
 */
export const SUPPORT_COUNTS_UI_BUDGET_MS    = 2_500;
/** バッチ経路の予算。正確さを優先するが無限には待たない */
export const SUPPORT_COUNTS_BATCH_BUDGET_MS = 120_000;

const emptySummary = (): SupportCountSummary =>
  ({ openCount: 0, waitingCseCount: 0, criticalCount: 0, recentSupportCount: 0,
     recentOpenCount: 0, staleOpenCount: 0 });

/**
 * 複数企業の support case counts を一括取得する（List API / バッチ用）。
 * 返り値: Map<company_uid, SupportCountSummary>
 *
 * ── 実装上の注意 ─────────────────────────────────────────────────────────────
 * ・nocoFetchByUids（1リクエスト・limit=min(uids×20, 500)）は使わない。
 *   cse_tickets は Tier1/2 の 70社で約 70,000 行あり、
 *   500 行で打ち切ると sort 順の先頭11社しか返らず、
 *   残りの企業は openCount=0 として記録されてしまう。
 * ・cse_tickets は同期が append 書き込みのため 1チケット = 複数行。
 *   source_record_id 単位に畳み込んでから数える。
 */
export async function fetchSupportCountsByUids(
  companyUids: string[],
  opts: { timeoutMs?: number } = {},
): Promise<Map<string, SupportCountSummary>> {
  if (companyUids.length === 0) return new Map();

  const cacheKey = [...companyUids].sort().join(',');
  const cached   = _countsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < COUNTS_TTL_MS) return new Map(cached.data);

  // 同一 uid セットの実行は共有する。予算切れで呼び出し元が離脱しても
  // 裏で完走してキャッシュを温めるため、次回リクエストは即座に正しい値を返せる。
  let job = _countsInflight.get(cacheKey);
  if (!job) {
    job = runSupportCounts(companyUids, cacheKey)
      .catch((err: unknown) => {
        console.warn('[fetchSupportCountsByUids] 取得失敗 → 未取得として扱う:', err);
        return null;
      })
      .finally(() => { _countsInflight.delete(cacheKey); });
    _countsInflight.set(cacheKey, job);
  }

  const budget = opts.timeoutMs;
  if (!budget) {
    const done = await job;
    return done ? new Map(done) : new Map();
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>(resolve => {
    timer = setTimeout(() => resolve('timeout'), budget);
  });
  const winner = await Promise.race([job, timeout]);
  if (timer) clearTimeout(timer);

  if (winner === 'timeout') {
    console.warn(
      `[fetchSupportCountsByUids] ${budget}ms 予算超過（uids=${companyUids.length}）→ 未取得で返す（裏で継続）`,
    );
    return new Map();
  }
  return winner ? new Map(winner) : new Map();
}

/** fetchSupportCountsByUids の実処理（予算・キャッシュ制御の外側） */
async function runSupportCounts(
  companyUids: string[],
  cacheKey: string,
): Promise<Map<string, SupportCountSummary>> {
  // fields 投影でレスポンスを最小化。no-store で Next.js キャッシュをスキップ
  // （2MB 超のレスポンスは Next.js がキャッシュ保存に失敗して警告を出すため）
  const [intercomMap, cseMap] = await Promise.all([
    nocoFetchAllByUids<RawSupportCase>(
      TABLE_IDS.log_intercom,
      companyUids,
      { sort: '-CreatedAt', fields: INTERCOM_COUNT_FIELDS },
      false,
    ),
    nocoFetchAllByUids<RawCseTicket>(
      TABLE_IDS.cse_tickets,
      companyUids,
      { sort: '-CreatedAt', fields: CSE_BULK_COUNT_FIELDS },
      false,
      { concurrency: 10 },
    ),
  ]);

  const result = new Map<string, SupportCountSummary>(companyUids.map(u => [u, emptySummary()]));

  for (const [uid, cases] of intercomMap) {
    const existing = result.get(uid) ?? emptySummary();
    const open     = rollupBySourceRecord(cases)
      .filter(r =>
        isIntercomOpen(r.latest.source_status as string | null, r.latest.routing_status as string | null));
    // criticalCount: リスク判定ウィンドウ内（90日以内）の critical のみカウント
    // 古いオープンチケットはクローズし忘れとみなしシグナル対象から除外
    const critical = open.filter(r =>
      String(r.latest.severity ?? '').toLowerCase() === 'critical' &&
      isWithinRiskWindow(occurredAt(r)),
    ).length;
    result.set(uid, {
      openCount:          existing.openCount + open.length,
      waitingCseCount:    existing.waitingCseCount,
      criticalCount:      existing.criticalCount + critical,
      recentSupportCount: existing.recentSupportCount + open.filter(r => isRecent(occurredAt(r))).length,
      recentOpenCount:    existing.recentOpenCount + open.filter(r => isWithinRiskWindow(occurredAt(r))).length,
      staleOpenCount:     existing.staleOpenCount + open.filter(r => !isWithinRiskWindow(occurredAt(r))).length,
    });
  }

  for (const [uid, tickets] of cseMap) {
    const existing = result.get(uid) ?? emptySummary();
    const rollups  = rollupBySourceRecord(tickets);
    const open     = rollups.filter(r => isCseOpen(r.latest.status));
    const waiting  = rollups.filter(r => isCseWaiting(r.latest.status));
    result.set(uid, {
      ...existing,
      openCount:          existing.openCount + open.length,
      waitingCseCount:    existing.waitingCseCount + waiting.length,
      recentSupportCount: existing.recentSupportCount + open.filter(r => isRecent(occurredAt(r))).length,
      recentOpenCount:    existing.recentOpenCount + open.filter(r => isWithinRiskWindow(occurredAt(r))).length,
      staleOpenCount:     existing.staleOpenCount + open.filter(r => !isWithinRiskWindow(occurredAt(r))).length,
    });
  }

  _countsCache.set(cacheKey, { data: new Map(result), ts: Date.now() });
  return result;
}
