// ─── Twenty CRM 読み取り専用クライアント（サーバーサイド専用）──────────────────
//
// 利用者は **PtAI Pipeline の連携経路だけ**。CXM のデータ経路からは呼ばない。
//
// **Phase 1 は読み取りのみ。** このファイルは GET しか発行しない。
// 汎用の request(method, …) は export しない。POST / PATCH / DELETE の関数も置かない。
// 書き込みは Phase 3 で、別ファイル（個人 API キーを扱う層）として追加する。
//
// ── 出典 ──────────────────────────────────────────────────────────────────────
//   挙動は Utty の取得スクリプト pga_dashboard_fetch.py（twenty_common.py 内蔵版）と、
//   2026-09-30 に本番 Twenty に対して実測した結果に合わせている。推測で変えないこと。
//
// ── 認証 ──────────────────────────────────────────────────────────────────────
//   Authorization: Bearer <API key>（OAuth ではない）
//   環境変数 TWENTY_API_KEY（別名 TWENTY_READ_API_KEY）。
//   **キーは戻り値にも例外にもログにも出さない。** 長さも先頭末尾も出さない。
//
// ── base URL ─────────────────────────────────────────────────────────────────
//   実測: https://crm.ptengine.com が API。
//   引き継ぎ資料の https://crm.ptengine.com/api は**フロントエンドの SPA** が返るだけ。
//   末尾スラッシュと誤った /api・/rest・/metadata の接尾辞は正規化して剥がす。
//
// ── REST の制約（実測。守らないと黙って壊れる）──────────────────────────────
//   - limit は最大 200。**超えると黙って切り詰められる**
//   - 既定ページサイズ 60
//   - depth は 0 か 1 のみ
//   - fields パラメータは存在しない（列の間引きはできない）
//   - ページングは starting_after カーソル ＋ pageInfo.hasNextPage / endCursor
//   - 応答の封筒が new / legacy の 2 形式ある
//
// ブラウザから import しないこと。

/** twenty-shared QUERY_MAX_RECORDS。超えると黙って切り詰められる */
export const TWENTY_MAX_LIMIT = 200;
/** twenty-shared QUERY_DEFAULT_LIMIT_RECORDS */
export const TWENTY_DEFAULT_PAGE_SIZE = 60;

const RATE_LIMIT_PER_SEC = 10;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRY = 3;
const RETRY_BACKOFF_MS = [2000, 4000, 8000];
/** 例外・ログに載せるエラー本文の上限。無制限に出さない */
const ERROR_BODY_MAX = 300;

const DEFAULT_BASE_URL = 'https://crm.ptengine.com';

// ── 設定 ─────────────────────────────────────────────────────────────────────

/**
 * 読み取り用 API キー。
 * TWENTY_API_KEY が主。TWENTY_READ_API_KEY は読み取り専用キーを別名で持つ場合の受け口。
 * **この関数の戻り値をログ・レスポンスに載せないこと。**
 */
function readKey(): string | null {
  const k = process.env.TWENTY_API_KEY || process.env.TWENTY_READ_API_KEY || '';
  return k.trim() ? k.trim() : null;
}

// ── API キーの解決（2026-10-01）────────────────────────────────────────────
//   ① ptai_settings（管理画面から設定・AES-256-GCM で暗号化）
//   ② 環境変数 TWENTY_API_KEY
//   DB に無ければ環境変数へ落ちるので、設定前でも動く。
async function resolveKey(): Promise<string | null> {
  const { resolveSecret, SETTING_TWENTY_API_KEY } = await import('@/lib/ptai/settings-store');
  return resolveSecret(SETTING_TWENTY_API_KEY, readKey() ?? undefined);
}

/**
 * 設定値を正規化する。
 *   - 末尾スラッシュを落とす
 *   - 誤って付けられた /api, /rest, /metadata を剥がす（実測で /api は SPA が返る）
 *   - 空なら既定値
 */
export function normalizeBaseUrl(raw: string | undefined | null): string {
  let v = (raw ?? '').trim();
  if (!v) return DEFAULT_BASE_URL;
  v = v.replace(/\/+$/, '');
  for (const suffix of ['/api', '/rest', '/metadata']) {
    if (v.endsWith(suffix)) v = v.slice(0, -suffix.length);
  }
  v = v.replace(/\/+$/, '');
  return v || DEFAULT_BASE_URL;
}

function configuredBase(): string {
  return normalizeBaseUrl(process.env.TWENTY_API_URL);
}

/** 環境変数だけを見る同期版。**管理画面で設定したキーは見ない** */
export function isTwentyConfigured(): boolean {
  return readKey() !== null;
}

/** 管理画面で設定したキーも含めて判定する。ルートはこちらを使うこと */
export async function isTwentyConfiguredAsync(): Promise<boolean> {
  return (await resolveKey()) !== null;
}

export interface TwentyConfigStatus {
  configured:    boolean;
  /** 不足している環境変数名。値は含まない */
  missing:       string[];
  /** 正規化後の接続先。**キーではない** */
  baseUrl:       string;
  /** 実測で確定した base。未確定なら null */
  resolvedUrl:   string | null;
}

/** 診断用。**キーそのものは返さない** */
export function getTwentyConfigStatus(): TwentyConfigStatus {
  const missing: string[] = [];
  if (!readKey()) missing.push('TWENTY_API_KEY');
  return {
    configured:  missing.length === 0,
    missing,
    baseUrl:     configuredBase(),
    resolvedUrl: _resolvedBase,
  };
}

// ── エラー ───────────────────────────────────────────────────────────────────

export type TwentyErrorKind =
  | 'config'        // キー未設定・base 未解決
  | 'auth'          // 401 / 403
  | 'not_api'       // API ではない応答（HTML 等）
  | 'rate_limited'  // 429（再試行しても解消しなかった）
  | 'server'        // 5xx
  | 'network'       // 接続断・タイムアウト
  | 'bad_response'  // JSON として読めない・形が想定外
  | 'client';       // その他 4xx

export class TwentyError extends Error {
  readonly kind: TwentyErrorKind;
  readonly status?: number;
  /** 上限まで切り詰めた応答本文。顧客データが載り得るのでログには出さない */
  readonly bodySnippet?: string;
  readonly path?: string;

  constructor(message: string, kind: TwentyErrorKind, opts: { status?: number; body?: string; path?: string } = {}) {
    super(message);
    this.name = 'TwentyError';
    this.kind = kind;
    this.status = opts.status;
    this.bodySnippet = opts.body ? opts.body.slice(0, ERROR_BODY_MAX) : undefined;
    this.path = opts.path;
  }

  /** ログ・レスポンス向けの安全な要約。本文も鍵も含まない */
  toSafeString(): string {
    return `${this.kind}${this.status ? ` (HTTP ${this.status})` : ''}: ${this.message}`;
  }
}

// ── レート制御 ───────────────────────────────────────────────────────────────

const MIN_INTERVAL_MS = 1000 / RATE_LIMIT_PER_SEC;
let _lastCallAt = 0;

async function throttle(): Promise<void> {
  const wait = MIN_INTERVAL_MS - (Date.now() - _lastCallAt);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _lastCallAt = Date.now();
}

// ── base URL 解決 ───────────────────────────────────────────────────────────

/** 正規化した設定値から試す候補を組み立てる */
export function candidateBases(configured: string): string[] {
  const out: string[] = [];
  const add = (u: string) => { if (u && !out.includes(u)) out.push(u); };

  const base = normalizeBaseUrl(configured);
  add(base);
  try {
    const u = new URL(base);
    add(`${u.protocol}//${u.host}`);
  } catch { /* URL として壊れていれば候補を増やさない */ }
  return out;
}

/**
 * 候補ごとの判定。
 *   ok          … metadata が返った
 *   auth_failed … Twenty 形式の 401/403。base は正しく、キーの問題
 *   not_api     … HTML 等。API ではない
 *   unreachable … ネットワーク断・タイムアウト・5xx
 */
export type BaseProbeResult = 'ok' | 'auth_failed' | 'not_api' | 'unreachable';

export interface BaseProbe {
  base:      string;
  result:    BaseProbeResult;
  /** 人が読む短い説明。応答本文は含めない */
  detail:    string;
  envelope?: 'legacy' | 'new';
}

function classifyFailure(err: TwentyError): BaseProbeResult {
  if (err.kind === 'auth')    return 'auth_failed';
  if (err.kind === 'not_api' || err.kind === 'bad_response' || err.kind === 'client') return 'not_api';
  return 'unreachable';
}

let _resolvedBase: string | null = null;

export interface ResolveResult {
  base: string | null;
  report: BaseProbe[];
  /** base は当たっているがキーで弾かれた候補 */
  authFailedBase: string | null;
}

export async function resolveBaseUrl(opts: { force?: boolean } = {}): Promise<ResolveResult> {
  if (_resolvedBase && !opts.force) return { base: _resolvedBase, report: [], authFailedBase: null };

  const key = await resolveKey();
  if (!key) throw new TwentyError('TWENTY_API_KEY が未設定です', 'config');

  const report: BaseProbe[] = [];
  for (const base of candidateBases(configuredBase())) {
    try {
      const payload = await getJson('/rest/metadata/objects', { limit: 1 }, { base, key, noRetry: true });
      const objs = unwrapList(payload, 'objects');
      const envelope: 'legacy' | 'new' =
        isRecord(payload) && isRecord(payload.data) ? 'legacy' : 'new';
      report.push({ base, result: 'ok', detail: `metadata に応答（objects: ${objs.length}）`, envelope });
      _resolvedBase = base;
      return { base, report, authFailedBase: null };
    } catch (e) {
      const err = e as TwentyError;
      report.push({ base, result: classifyFailure(err), detail: err.toSafeString() });
    }
  }
  return { base: null, report, authFailedBase: report.find(r => r.result === 'auth_failed')?.base ?? null };
}

/** テスト用にモジュール状態を初期化する（本番コードからは呼ばない） */
export function __resetClientStateForTests(): void {
  _resolvedBase = null;
  _lastCallAt = 0;
}

// ── 低レベル GET（**このモジュールの外に出さない**）──────────────────────────

interface GetOpts {
  base?:    string;
  key?:     string;
  noRetry?: boolean;
}

async function getJson(
  path: string,
  params: Record<string, string | number> | undefined,
  opts: GetOpts = {},
): Promise<unknown> {
  const key = opts.key ?? await resolveKey();
  if (!key) throw new TwentyError('Twenty の API キーが未設定です', 'config');

  const base = normalizeBaseUrl(opts.base ?? _resolvedBase ?? configuredBase());
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
    : '';
  const url = `${base}${path}${qs}`;

  const attempts = opts.noRetry ? 1 : MAX_RETRY + 1;
  let lastErr: TwentyError | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    await throttle();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'GET',                                     // ★ GET 以外は発行しない
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal: ctl.signal,
        cache: 'no-store',
      });

      if (res.ok) {
        const text = await res.text();
        if (!text.trim()) return null;
        try {
          return JSON.parse(text);
        } catch {
          // HTML が返るのはだいたい base URL が違うとき（/api は SPA を返す）
          throw new TwentyError('JSON ではない応答（API ではない可能性）', 'not_api', { path });
        }
      }

      const body = await res.text().catch(() => '');
      // 401 / 403 は再試行しない
      if (res.status === 401 || res.status === 403) {
        throw new TwentyError('認証に失敗しました', 'auth', { status: res.status, body, path });
      }
      if (res.status === 429) {
        lastErr = new TwentyError('レート制限', 'rate_limited', { status: res.status, body, path });
      } else if (res.status >= 500) {
        lastErr = new TwentyError('サーバーエラー', 'server', { status: res.status, body, path });
      } else {
        // その他の 4xx は再試行しても同じ
        throw new TwentyError(`要求が拒否されました`, 'client', { status: res.status, body, path });
      }
    } catch (e) {
      if (e instanceof TwentyError) {
        // 再試行しないもの
        if (e.kind === 'auth' || e.kind === 'client' || e.kind === 'not_api' || e.kind === 'config') throw e;
        lastErr = e;
      } else {
        const name = (e as Error)?.name ?? 'Error';
        lastErr = new TwentyError(
          name === 'AbortError' ? `タイムアウト（${REQUEST_TIMEOUT_MS}ms）` : `接続に失敗しました（${name}）`,
          'network', { path },
        );
      }
    } finally {
      clearTimeout(timer);
    }

    if (attempt < attempts - 1) {
      await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)]));
    }
  }
  throw lastErr ?? new TwentyError('取得に失敗しました', 'network', { path });
}

/** base を解決したうえで GET する */
async function readJson(path: string, params?: Record<string, string | number>): Promise<unknown> {
  if (!_resolvedBase) {
    const { base } = await resolveBaseUrl();
    if (!base) throw new TwentyError('Twenty の base URL を解決できませんでした', 'config');
  }
  return getJson(path, params);
}

// ── 応答の検証・封筒吸収 ─────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * 一覧応答から配列を取り出す。
 *   new    : { data: [...], pageInfo, totalCount }
 *   legacy : { data: { objects: [...] } }
 */
export function unwrapList(payload: unknown, legacyKey: string): Record<string, unknown>[] {
  if (payload == null) return [];
  const data = isRecord(payload) && 'data' in payload ? payload.data : payload;
  if (Array.isArray(data)) return data.filter(isRecord);
  if (isRecord(data)) {
    const byKey = data[legacyKey];
    if (Array.isArray(byKey)) return byKey.filter(isRecord);
    for (const v of Object.values(data)) if (Array.isArray(v)) return v.filter(isRecord);
  }
  return [];
}

interface PageInfo { hasNextPage?: boolean; endCursor?: string }

function readPageInfo(payload: unknown): PageInfo {
  if (!isRecord(payload)) return {};
  const pi = payload.pageInfo;
  if (!isRecord(pi)) return {};
  return {
    hasNextPage: typeof pi.hasNextPage === 'boolean' ? pi.hasNextPage : undefined,
    endCursor:   typeof pi.endCursor === 'string' ? pi.endCursor : undefined,
  };
}

function readTotalCount(payload: unknown): number | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.totalCount === 'number') return payload.totalCount;
  if (isRecord(payload.data) && typeof payload.data.totalCount === 'number') return payload.data.totalCount;
  return null;
}

// ── 公開する読み取り API ─────────────────────────────────────────────────────

export interface ReadOptions {
  /** 1 ページの件数。**200 を超えると Twenty が黙って切り詰める**ので clamp する */
  pageSize?: number;
  /** 0 か 1 のみ。1 で relation を 1 段引く */
  depth?: 0 | 1;
  /** Twenty のフィルタ式。**省略すると全件になる**（companies は 5,000 件超） */
  filter?: string;
  /** 安全弁。総取得件数の上限 */
  maxRecords?: number;
}

/**
 * 全レコードをカーソルページングで取得する（GET のみ）。
 * `plural` は Twenty の複数形名（companies / opportunities / notes / workspaceMembers …）。
 */
export async function listRecords(plural: string, opts: ReadOptions = {}): Promise<Record<string, unknown>[]> {
  const pageSize = Math.min(Math.max(1, opts.pageSize ?? TWENTY_DEFAULT_PAGE_SIZE), TWENTY_MAX_LIMIT);
  const maxRecords = opts.maxRecords ?? 5000;
  const out: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  let guard = 0;

  for (;;) {
    if (++guard > 200) break;                              // 無限ループの保険
    const params: Record<string, string | number> = { limit: pageSize };
    if (opts.depth !== undefined) params.depth = opts.depth;
    if (opts.filter) params.filter = opts.filter;
    if (cursor) params.starting_after = cursor;

    const payload = await readJson(`/rest/${plural}`, params);
    const items = unwrapList(payload, plural);
    out.push(...items);

    const info = readPageInfo(payload);
    cursor = info.hasNextPage ? info.endCursor : undefined;
    if (!cursor || items.length === 0 || out.length >= maxRecords) break;
  }
  return out;
}

/**
 * totalCount だけを取る。
 *
 * **filter は必須引数にしている。** 省略可能にしていた実装では PtAI フィルタが
 * 落ちて companies が 5,134 件（全社）になり、対象の 126 件と桁が変わった。
 * フィルタ不要なら明示的に null を渡すこと。
 */
export async function countRecords(plural: string, filter: string | null): Promise<number | null> {
  const params: Record<string, string | number> = { limit: 1, depth: 0 };
  if (filter) params.filter = filter;
  const payload = await readJson(`/rest/${plural}`, params);
  return readTotalCount(payload);
}

// ── metadata ────────────────────────────────────────────────────────────────

export interface TwentyFieldMeta {
  name:      string;
  type:      string;
  label?:    string;
  isCustom?: boolean;
  isActive?: boolean;
  options?:  string[];
}

export interface TwentyObjectMeta {
  nameSingular: string;
  namePlural?:  string;
  fields:       TwentyFieldMeta[];
}

function toFieldMeta(v: unknown): TwentyFieldMeta | null {
  if (!isRecord(v) || typeof v.name !== 'string' || typeof v.type !== 'string') return null;
  const rawOpts = Array.isArray(v.options) ? v.options : [];
  const options = rawOpts
    .map(o => (isRecord(o) && typeof o.value === 'string' ? o.value : null))
    .filter((x): x is string => x !== null);
  return {
    name: v.name,
    type: v.type,
    label: typeof v.label === 'string' ? v.label : undefined,
    isCustom: typeof v.isCustom === 'boolean' ? v.isCustom : undefined,
    isActive: typeof v.isActive === 'boolean' ? v.isActive : undefined,
    ...(options.length ? { options } : {}),
  };
}

/** 全 object metadata（field 込み）。unknown を検証してから返す */
export async function listObjectMetadata(): Promise<TwentyObjectMeta[]> {
  const out: TwentyObjectMeta[] = [];
  let cursor: string | undefined;
  let guard = 0;

  for (;;) {
    if (++guard > 50) break;
    const params: Record<string, string | number> = { limit: Math.min(100, TWENTY_MAX_LIMIT) };
    if (cursor) params.starting_after = cursor;
    const payload = await readJson('/rest/metadata/objects', params);
    const items = unwrapList(payload, 'objects');

    for (const it of items) {
      if (typeof it.nameSingular !== 'string') continue;
      const fields = (Array.isArray(it.fields) ? it.fields : [])
        .map(toFieldMeta)
        .filter((f): f is TwentyFieldMeta => f !== null && f.isActive !== false);
      out.push({
        nameSingular: it.nameSingular,
        namePlural: typeof it.namePlural === 'string' ? it.namePlural : undefined,
        fields,
      });
    }

    const info = readPageInfo(payload);
    cursor = info.hasNextPage ? info.endCursor : undefined;
    if (!cursor || items.length === 0) break;
  }
  return out;
}
