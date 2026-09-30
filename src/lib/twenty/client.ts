// ─── Twenty CRM REST クライアント（サーバーサイド専用）────────────────────────
//
// 正本は Utty の取得スクリプト `pga_dashboard_fetch.py`（2026-09-24 版の
// twenty_common.py を内蔵したもの）。挙動はそこで実測されたものに合わせている。
// 推測で書き換えないこと。
//
// ── 認証 ──────────────────────────────────────────────────────────────────────
//   Authorization: Bearer <API key>。OAuth ではない。
//   Read は共有キー（TWENTY_API_KEY）。Write は Phase 3 で「操作者本人の個人キー」に
//   切り替える予定なので、ここでは Read 専用として扱う。
//   **キーは戻り値にもログにも出さない。**
//
// ── base URL に注意 ──────────────────────────────────────────────────────────
//   引き継ぎ資料の TWENTY_API_URL は `https://crm.ptengine.com/api` だが、
//   Twenty 本体はルート直下に /rest を生やす（ApiPath.Rest='rest'）。
//   逆プロキシで /api を前置している可能性があるため、**候補を順に叩いて実測で決める**。
//   元スクリプトの candidate_bases() / resolve_base_url() をそのまま移した。
//
// ── REST の制約（実測。守らないと黙って壊れる）──────────────────────────────
//   - limit は最大 200（twenty-shared QUERY_MAX_RECORDS）。**超えると黙って切られる**
//   - 既定ページサイズ 60（QUERY_DEFAULT_LIMIT_RECORDS）
//   - depth は 0 か 1 のみ
//   - **fields パラメータは存在しない**（列の間引きはできない）
//   - ページングは starting_after カーソル ＋ pageInfo.hasNextPage / endCursor
//   - 応答の封筒が 2 種類ある（new / legacy）。unwrapList で吸収する
//
// ブラウザから import しないこと。

/** twenty-shared QUERY_MAX_RECORDS。超えると黙って切り詰められる */
export const TWENTY_MAX_LIMIT = 200;
/** twenty-shared QUERY_DEFAULT_LIMIT_RECORDS */
export const TWENTY_DEFAULT_PAGE_SIZE = 60;
/** 元スクリプトの DEFAULT_RATE_LIMIT（req/s） */
const RATE_LIMIT_PER_SEC = 10;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRY = 4;
/** 元スクリプトの RETRY_BACKOFF（秒） */
const RETRY_BACKOFF_MS = [2000, 4000, 8000, 16000];

const DEFAULT_BASE_URL = 'https://crm.ptengine.com';

// ── 設定 ─────────────────────────────────────────────────────────────────────

function readKey(): string | null {
  // TWENTY_API_KEY が主。TWENTY_READ_API_KEY は読み取り専用キーを分ける場合の別名
  return process.env.TWENTY_API_KEY || process.env.TWENTY_READ_API_KEY || null;
}

function configuredBase(): string {
  return (process.env.TWENTY_API_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

export function isTwentyConfigured(): boolean {
  return readKey() !== null;
}

export interface TwentyConfigStatus {
  configured:    boolean;
  missing:       string[];
  configuredUrl: string;
  /** 実測で決まった base URL。未解決なら null */
  resolvedUrl:   string | null;
}

/** 診断用。**キーそのものは返さない** */
export function getTwentyConfigStatus(): TwentyConfigStatus {
  const missing: string[] = [];
  if (!readKey()) missing.push('TWENTY_API_KEY');
  return {
    configured:    missing.length === 0,
    missing,
    configuredUrl: configuredBase(),
    resolvedUrl:   _resolvedBase,
  };
}

// ── エラー ───────────────────────────────────────────────────────────────────

export class TwentyError extends Error {
  readonly status?: number;
  readonly body?: string;
  readonly path?: string;
  /** 設定不備（キー未設定・base 未解決）。呼び出し側は 503 にする */
  readonly configIssue: boolean;

  constructor(message: string, opts: { status?: number; body?: string; path?: string; configIssue?: boolean } = {}) {
    super(message);
    this.name = 'TwentyError';
    this.status = opts.status;
    this.body = opts.body;
    this.path = opts.path;
    this.configIssue = opts.configIssue ?? false;
  }
}

// ── レート制御 ───────────────────────────────────────────────────────────────
//
// Vercel の関数インスタンスごとに効く簡易スロットル。
// インスタンスをまたいだ制御はしていないので、並列実行を増やすときは要見直し。

const MIN_INTERVAL_MS = 1000 / RATE_LIMIT_PER_SEC;
let _lastCallAt = 0;

async function throttle(): Promise<void> {
  const wait = MIN_INTERVAL_MS - (Date.now() - _lastCallAt);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _lastCallAt = Date.now();
}

// ── base URL の解決 ─────────────────────────────────────────────────────────

/** 設定値から試す base URL 候補を組み立てる（元スクリプト candidate_bases） */
export function candidateBases(configured: string): string[] {
  const out: string[] = [];
  const add = (u: string) => { if (u && !out.includes(u)) out.push(u); };

  const base = (configured || '').replace(/\/+$/, '');
  add(base);
  for (const suffix of ['/api', '/rest', '/metadata']) {
    if (base.endsWith(suffix)) add(base.slice(0, -suffix.length));
  }
  if (base) {
    try {
      const u = new URL(base);
      add(`${u.protocol}//${u.host}`);
      add(`${u.protocol}//${u.host}/api`);
    } catch { /* URL として壊れていれば候補を増やさない */ }
  }
  return out;
}

let _resolvedBase: string | null = null;

/**
 * 候補ごとの判定。
 *   ok          … metadata が返った。この base で確定
 *   auth_failed … **Twenty 形式の 401/403 が返った**。base は正しく、キーの問題
 *   not_api     … HTML が返る等。API ではない（逆プロキシ違い・パス違い）
 *   unreachable … ネットワーク断・タイムアウト・5xx
 */
export type BaseProbeResult = 'ok' | 'auth_failed' | 'not_api' | 'unreachable';

export interface BaseProbe {
  base:      string;
  ok:        boolean;
  result:    BaseProbeResult;
  detail:    string;
  /** 応答の封筒。legacy = {data:{objects:[...]}} / new = {data:[...]} */
  envelope?: 'legacy' | 'new';
}

/** 401/403 が Twenty 由来か（＝ base は当たっているか）を判定する */
function classifyProbeFailure(err: TwentyError): BaseProbeResult {
  if (err.status === 401 || err.status === 403) return 'auth_failed';
  // HTML が返ると JSON.parse で SyntaxError になる
  if (!err.status && /SyntaxError|Unexpected token/.test(err.message)) return 'not_api';
  if (err.status && err.status >= 400 && err.status < 500) return 'not_api';
  return 'unreachable';
}

/**
 * 候補を順に叩き、metadata API が応答する base を返す。
 * 呼び出しごとに実測するのではなく、プロセス内にキャッシュする。
 */
export async function resolveBaseUrl(opts: { force?: boolean } = {}): Promise<{
  base: string | null;
  report: BaseProbe[];
  /** base は当たっているがキーで弾かれた候補（あれば診断に使う） */
  authFailedBase: string | null;
}> {
  if (_resolvedBase && !opts.force) return { base: _resolvedBase, report: [], authFailedBase: null };

  const key = readKey();
  if (!key) throw new TwentyError('TWENTY_API_KEY が未設定です', { configIssue: true });

  const report: BaseProbe[] = [];
  for (const base of candidateBases(configuredBase())) {
    try {
      const payload = await rawRequest('GET', '/rest/metadata/objects', { params: { limit: 1 }, base, key, noRetry: true });
      const objs = unwrapList(payload, 'objects');
      const envelope: 'legacy' | 'new' =
        payload && typeof (payload as Record<string, unknown>).data === 'object'
          && !Array.isArray((payload as Record<string, unknown>).data) ? 'legacy' : 'new';
      report.push({ base, ok: true, result: 'ok', detail: `metadata OK (objects: ${objs.length})`, envelope });
      _resolvedBase = base;
      return { base, report, authFailedBase: null };
    } catch (e) {
      const err = e as TwentyError;
      const result = classifyProbeFailure(err);
      report.push({
        base, ok: false, result,
        detail: `${err.message}${err.body ? ` body=${err.body.slice(0, 200)}` : ''}`,
      });
    }
  }
  // 「API には届いたがキーで弾かれた」候補があれば、それが正しい base とみなして返す
  const authFailed = report.find(r => r.result === 'auth_failed')?.base ?? null;
  return { base: null, report, authFailedBase: authFailed };
}

// ── 低レベル リクエスト ──────────────────────────────────────────────────────

interface RawOpts {
  params?:  Record<string, string | number>;
  body?:    unknown;
  base?:    string;
  key?:     string;
  /** base 解決の探索では再試行しない（候補を早く回すため） */
  noRetry?: boolean;
}

async function rawRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  opts: RawOpts = {},
): Promise<unknown> {
  const key = opts.key ?? readKey();
  if (!key) throw new TwentyError('TWENTY_API_KEY が未設定です', { configIssue: true });

  const base = (opts.base ?? _resolvedBase ?? configuredBase()).replace(/\/+$/, '');
  const qs = opts.params
    ? '?' + new URLSearchParams(Object.entries(opts.params).map(([k, v]) => [k, String(v)])).toString()
    : '';
  const url = `${base}${path}${qs}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  const attempts = opts.noRetry ? 1 : MAX_RETRY + 1;
  let lastErr: TwentyError | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    await throttle();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        headers,
        ...(opts.body !== undefined && { body: JSON.stringify(opts.body) }),
        signal: ctl.signal,
        cache: 'no-store',
      });

      if (res.ok) {
        const text = await res.text();
        return text.trim() ? JSON.parse(text) : null;
      }

      const body = await res.text().catch(() => '');
      // 429 以外の 4xx は再試行しても同じなので即中断（元スクリプトと同じ）
      if (res.status !== 429 && res.status >= 400 && res.status < 500) {
        throw new TwentyError(`HTTP ${res.status} ${method} ${path}`, { status: res.status, body, path });
      }
      lastErr = new TwentyError(`HTTP ${res.status} ${method} ${path}`, { status: res.status, body, path });
    } catch (e) {
      if (e instanceof TwentyError) {
        if (e.status && e.status !== 429 && e.status < 500) throw e;
        lastErr = e;
      } else {
        const name = (e as Error)?.name ?? 'Error';
        lastErr = new TwentyError(`${name}: ${(e as Error)?.message ?? e} (${method} ${path})`, { path });
      }
    } finally {
      clearTimeout(timer);
    }

    if (attempt < attempts - 1) {
      await new Promise(r => setTimeout(r, RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)]));
    }
  }
  throw lastErr ?? new TwentyError(`${method} ${path} に失敗しました`, { path });
}

/** base を解決したうえでリクエストする */
export async function twentyRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  opts: Omit<RawOpts, 'base' | 'key' | 'noRetry'> = {},
): Promise<unknown> {
  if (!_resolvedBase) {
    const { base } = await resolveBaseUrl();
    if (!base) throw new TwentyError('Twenty の base URL を解決できませんでした', { configIssue: true });
  }
  return rawRequest(method, path, opts);
}

// ── 封筒の差を吸収 ───────────────────────────────────────────────────────────

/**
 * 一覧応答から配列を取り出す。
 *   new    : { data: [...], pageInfo, totalCount }
 *   legacy : { data: { objects: [...] } } / { data: { fields: [...] } }
 */
export function unwrapList<T = Record<string, unknown>>(payload: unknown, legacyKey: string): T[] {
  if (payload == null) return [];
  const p = payload as Record<string, unknown>;
  const data = (p.data ?? payload) as unknown;
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d[legacyKey])) return d[legacyKey] as T[];
    for (const v of Object.values(d)) if (Array.isArray(v)) return v as T[];   // 保険：唯一の配列を拾う
  }
  return [];
}

/** 単体応答からオブジェクトを取り出す */
export function unwrapOne<T = Record<string, unknown>>(payload: unknown, ...legacyKeys: string[]): T | null {
  if (payload == null) return null;
  const p = payload as Record<string, unknown>;
  const data = (p.data ?? payload) as unknown;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    for (const k of legacyKeys) {
      if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) return d[k] as T;
    }
    return d as T;
  }
  return null;
}

interface PageInfo { hasNextPage?: boolean; endCursor?: string }

// ── データ取得 ───────────────────────────────────────────────────────────────

export interface ListOptions {
  /** 1 ページの件数。**200 を超えると Twenty が黙って切り詰める** */
  pageSize?: number;
  /** 0 か 1 のみ。1 にすると relation を 1 段引く（pointOfContact など） */
  depth?: 0 | 1;
  /** Twenty のフィルタ式。例: or(pgaStatus[is]:NOT_NULL,customerSource[in]:[PGA_TARGET,BOTH]) */
  filter?: string;
  /** 安全弁。取得総数の上限（超えたら打ち切る） */
  maxRecords?: number;
}

/**
 * 全レコードをカーソルページングで取得する。
 * `plural` は Twenty の複数形名（companies / opportunities / notes / workspaceMembers …）。
 */
export async function listAllRecords<T = Record<string, unknown>>(
  plural: string,
  opts: ListOptions = {},
): Promise<T[]> {
  const pageSize = Math.min(opts.pageSize ?? TWENTY_DEFAULT_PAGE_SIZE, TWENTY_MAX_LIMIT);
  const maxRecords = opts.maxRecords ?? 5000;
  const out: T[] = [];
  let cursor: string | undefined;

  for (;;) {
    const params: Record<string, string | number> = { limit: pageSize };
    if (opts.depth !== undefined) params.depth = opts.depth;
    if (opts.filter) params.filter = opts.filter;
    if (cursor) params.starting_after = cursor;

    const payload = await twentyRequest('GET', `/rest/${plural}`, { params });
    const items = unwrapList<T>(payload, plural);
    out.push(...items);

    const info = ((payload as Record<string, unknown>)?.pageInfo ?? {}) as PageInfo;
    cursor = info.hasNextPage ? info.endCursor : undefined;
    if (!cursor || items.length === 0 || out.length >= maxRecords) break;
  }
  return out;
}

/** totalCount だけを取る（limit=1, depth=0）。取れなければ null */
export async function countRecords(plural: string): Promise<number | null> {
  const payload = await twentyRequest('GET', `/rest/${plural}`, { params: { limit: 1, depth: 0 } });
  const p = payload as Record<string, unknown> | null;
  if (!p) return null;
  if (typeof p.totalCount === 'number') return p.totalCount;
  const data = p.data as Record<string, unknown> | undefined;
  if (data && typeof data.totalCount === 'number') return data.totalCount;
  return null;
}

// ── metadata ────────────────────────────────────────────────────────────────

export interface TwentyFieldMeta {
  name:     string;
  type:     string;
  label?:   string;
  isCustom?: boolean;
  isActive?: boolean;
  options?: Array<{ value?: string }>;
}

export interface TwentyObjectMeta {
  nameSingular?: string;
  namePlural?:   string;
  fields?:       TwentyFieldMeta[];
}

/** 全 object metadata（field 込み）。ページングあり */
export async function listObjectMetadata(): Promise<TwentyObjectMeta[]> {
  const out: TwentyObjectMeta[] = [];
  let cursor: string | undefined;
  for (;;) {
    const params: Record<string, string | number> = { limit: Math.min(100, TWENTY_MAX_LIMIT) };
    if (cursor) params.starting_after = cursor;
    const payload = await twentyRequest('GET', '/rest/metadata/objects', { params });
    const items = unwrapList<TwentyObjectMeta>(payload, 'objects');
    out.push(...items);
    const info = ((payload as Record<string, unknown>)?.pageInfo ?? {}) as PageInfo;
    cursor = info.hasNextPage ? info.endCursor : undefined;
    if (!cursor || items.length === 0) break;
  }
  return out;
}
