// ─── PtAI Pipeline: Twenty `test*` 読み書きクライアント（サーバー専用）────────
//
// 出典: docs/ptai-dashboard-operation-flows.md §7
//
// ═══════════════════════════════════════════════════════════════════════════
//  **書き込めるのは `test*` オブジェクトだけ。**
//  plural が WRITABLE_PLURALS に無ければ、リクエストを組み立てる前に例外にする。
//  既存の companies / opportunities / people / notes / tasks には**到達できない**。
//
//  読み取り専用の src/lib/twenty/client.ts とは別ファイルにしてある。
//  あちらは GET しか発行しない保証をテストで固定しているので、混ぜない。
// ═══════════════════════════════════════════════════════════════════════════
//
// ── 守ること ──────────────────────────────────────────────────────────────────
//   - API キーを戻り値・例外・ログに出さない
//   - 顧客名・UUID・本文をログに出さない。出すのは件数と種別だけ
//   - ブラウザから import しない

import {
  WRITABLE_PLURALS, FIELD_ALIAS, twentyField, toTwentyValue, fromTwentyValue,
  LOWERCASE_VALUE_FIELDS,
} from './schema';

const DEFAULT_BASE = 'https://crm.ptengine.com';
const TIMEOUT_MS = 30_000;
const MAX_RETRY = 3;
const BACKOFF_MS = [2000, 4000, 8000];
const RATE_LIMIT_PER_SEC = 10;
const MAX_LIMIT = 200;
const ERROR_BODY_MAX = 300;

function baseUrl(): string {
  return (process.env.TWENTY_API_URL || DEFAULT_BASE).replace(/\/+$/, '');
}
function apiKey(): string | null {
  const k = (process.env.TWENTY_API_KEY || '').trim();
  return k || null;
}

// ── API キーの解決（2026-10-01）────────────────────────────────────────────
//   ① ptai_settings（管理画面から設定・AES-256-GCM で暗号化）
//   ② 環境変数 TWENTY_API_KEY
//   DB に無ければ環境変数へ落ちるので、設定前でも動く。
async function resolveKey(): Promise<string | null> {
  const { resolveSecret, SETTING_TWENTY_API_KEY } = await import('../settings-store');
  return resolveSecret(SETTING_TWENTY_API_KEY, apiKey() ?? undefined);
}
/** 環境変数だけを見る同期版 */
export function isConfigured(): boolean {
  return Boolean(apiKey());
}

/** 管理画面で設定したキーも含めて判定する。ルートはこちらを使うこと */
export async function isConfiguredAsync(): Promise<boolean> {
  return Boolean(await resolveKey());
}

export type TestErrorKind =
  | 'config' | 'forbidden_object' | 'auth' | 'rate_limited'
  | 'server' | 'network' | 'bad_response' | 'client';

export class TestWriteError extends Error {
  readonly kind: TestErrorKind;
  readonly status?: number;
  constructor(kind: TestErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'TestWriteError';
    this.kind = kind;
    this.status = status;
  }
  /** ログ・レスポンスに出してよい文字列。キーも顧客データも含まない */
  toSafeString(): string {
    return `[${this.kind}${this.status ? ' ' + this.status : ''}] ${this.message}`;
  }
}

/** 呼ぶ前に必ず通す。ここが既存オブジェクトへの唯一の防波堤 */
function assertWritable(plural: string): void {
  if (!WRITABLE_PLURALS.has(plural)) {
    throw new TestWriteError(
      'forbidden_object',
      `${plural} は PtAI Pipeline の書き込み対象ではありません（test* のみ許可）`,
    );
  }
}

// ── レート制御 ───────────────────────────────────────────────────────────────

let windowStart = 0;
let inWindow = 0;
async function throttle(): Promise<void> {
  const now = Date.now();
  if (now - windowStart >= 1000) { windowStart = now; inWindow = 0; }
  if (++inWindow > RATE_LIMIT_PER_SEC) {
    await new Promise(r => setTimeout(r, 1000 - (now - windowStart)));
    windowStart = Date.now(); inWindow = 1;
  }
}

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const key = await resolveKey();
  if (!key) throw new TestWriteError('config', 'Twenty の API キーが未設定です（管理画面か TWENTY_API_KEY で設定してください）');

  let lastErr: TestWriteError | null = null;
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    await throttle();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(baseUrl() + path, {
        method,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ac.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);

      if (res.ok) {
        if (res.status === 204) return null;
        try { return await res.json(); }
        catch { throw new TestWriteError('bad_response', '応答を JSON として読めませんでした', res.status); }
      }

      const text = await res.text().catch(() => '');
      const snippet = text.slice(0, ERROR_BODY_MAX);
      if (res.status === 401 || res.status === 403) {
        throw new TestWriteError('auth', 'Twenty にキーが拒否されました', res.status);
      }
      if (res.status === 429) { lastErr = new TestWriteError('rate_limited', 'レート制限', 429); }
      else if (res.status >= 500) { lastErr = new TestWriteError('server', `Twenty がエラーを返しました: ${snippet}`, res.status); }
      else { throw new TestWriteError('client', `リクエストが拒否されました: ${snippet}`, res.status); }
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof TestWriteError) {
        if (e.kind === 'auth' || e.kind === 'client' || e.kind === 'config' || e.kind === 'forbidden_object') throw e;
        lastErr = e;
      } else {
        lastErr = new TestWriteError('network', 'Twenty に接続できませんでした');
      }
    }
    if (attempt < MAX_RETRY) await new Promise(r => setTimeout(r, BACKOFF_MS[attempt]));
  }
  throw lastErr ?? new TestWriteError('network', 'Twenty に接続できませんでした');
}

// ── 応答の封筒を剥がす ───────────────────────────────────────────────────────

function unwrapOne(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  if ('id' in (data as object)) return data as Record<string, unknown>;
  for (const v of Object.values(data as Record<string, unknown>)) {
    if (v && typeof v === 'object' && 'id' in (v as object)) return v as Record<string, unknown>;
  }
  return null;
}

function unwrapList(payload: unknown, plural: string): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = (payload as { data?: unknown }).data;
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === 'object') {
    const byPlural = (data as Record<string, unknown>)[plural];
    if (Array.isArray(byPlural)) return byPlural as Record<string, unknown>[];
    for (const v of Object.values(data as Record<string, unknown>)) {
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
  }
  return [];
}

function pageInfo(payload: unknown): { hasNextPage: boolean; endCursor?: string } {
  const pi = (payload as { pageInfo?: unknown })?.pageInfo
    ?? ((payload as { data?: { pageInfo?: unknown } })?.data?.pageInfo);
  if (!pi || typeof pi !== 'object') return { hasNextPage: false };
  const o = pi as { hasNextPage?: unknown; endCursor?: unknown };
  return {
    hasNextPage: o.hasNextPage === true,
    endCursor: typeof o.endCursor === 'string' ? o.endCursor : undefined,
  };
}

// ── 仕様書の名前 ⇄ Twenty の実名 ─────────────────────────────────────────────

/** アプリの値 → Twenty へ送る形 */
export function toTwentyPayload(singular: string, rec: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (v === undefined) continue;
    if (k === 'id') continue;
    const key = twentyField(singular, k);
    out[key] = LOWERCASE_VALUE_FIELDS.has(k) && typeof v === 'string' ? toTwentyValue(v) : v;
  }
  return out;
}

/** Twenty の実名 → 仕様書の名前（FIELD_ALIAS の逆引き。オブジェクトごとに 1 回だけ作る）*/
const reverseAlias = new Map<string, Map<string, string>>();
function reverseFor(singular: string): Map<string, string> {
  let m = reverseAlias.get(singular);
  if (!m) {
    m = new Map(Object.entries(FIELD_ALIAS[singular] ?? {}).map(([spec, real]) => [real, spec]));
    reverseAlias.set(singular, m);
  }
  return m;
}

/** Twenty の応答 → アプリの値 */
export function fromTwentyRecord(singular: string, row: Record<string, unknown>): Record<string, unknown> {
  const reverse = reverseFor(singular);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const specName = reverse.get(k) ?? k;
    out[specName] = LOWERCASE_VALUE_FIELDS.has(specName) ? fromTwentyValue(specName, v) : v;
  }
  return out;
}

// ── CRUD（test* 限定）───────────────────────────────────────────────────────

export interface ListOptions {
  filter?: string;
  depth?: 0 | 1;
  pageSize?: number;
  maxRecords?: number;
  orderBy?: string;
}

export async function listRecords(
  plural: string, singular: string, opts: ListOptions = {},
): Promise<Record<string, unknown>[]> {
  assertWritable(plural);
  const pageSize = Math.min(Math.max(1, opts.pageSize ?? 60), MAX_LIMIT);
  const max = opts.maxRecords ?? 5000;
  const out: Record<string, unknown>[] = [];
  let cursor: string | undefined;

  for (let guard = 0; guard < 200; guard++) {
    const qs = new URLSearchParams({ limit: String(pageSize) });
    if (opts.depth !== undefined) qs.set('depth', String(opts.depth));
    if (opts.filter) qs.set('filter', opts.filter);
    if (opts.orderBy) qs.set('order_by', opts.orderBy);
    if (cursor) qs.set('starting_after', cursor);

    const payload = await request('GET', `/rest/${plural}?${qs}`);
    const items = unwrapList(payload, plural);
    out.push(...items.map(r => fromTwentyRecord(singular, r)));

    const pi = pageInfo(payload);
    cursor = pi.hasNextPage ? pi.endCursor : undefined;
    if (!cursor || items.length === 0 || out.length >= max) break;
  }
  return out;
}

export async function getRecord(
  plural: string, singular: string, id: string, depth: 0 | 1 = 0,
): Promise<Record<string, unknown> | null> {
  assertWritable(plural);
  const payload = await request('GET', `/rest/${plural}/${encodeURIComponent(id)}?depth=${depth}`);
  const one = unwrapOne(payload);
  return one ? fromTwentyRecord(singular, one) : null;
}

export async function createRecord(
  plural: string, singular: string, rec: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  assertWritable(plural);
  const payload = await request('POST', `/rest/${plural}`, toTwentyPayload(singular, rec));
  const one = unwrapOne(payload);
  if (!one) throw new TestWriteError('bad_response', '作成の応答に id がありませんでした');
  return fromTwentyRecord(singular, one);
}

export async function updateRecord(
  plural: string, singular: string, id: string, patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  assertWritable(plural);
  const payload = await request('PATCH', `/rest/${plural}/${encodeURIComponent(id)}`, toTwentyPayload(singular, patch));
  const one = unwrapOne(payload);
  if (!one) throw new TestWriteError('bad_response', '更新の応答が読めませんでした');
  return fromTwentyRecord(singular, one);
}

export type SafeUpdateResult =
  | { ok: true;  record: Record<string, unknown> }
  | { ok: false; reason: 'conflict'; theirs: Record<string, unknown> };

/**
 * 楽観ロック付きの更新（§9-3 の回答 / 2026-10-01）。
 *
 * 「Twenty を人が直接編集する想定は無いが、イレギュラーで必要かもしれない」
 * という回答だったので、**Webhook は作らず、上書き事故だけ防ぐ**。
 * ツールが最後に読んだ `updatedAt` より Twenty 側が新しければ、書かずに相手の値を返す。
 *
 * Twenty 側で人が直したぶんは、読み取りのキャッシュ（最大 60 秒）が切れれば
 * 画面に出る。通知が要るようになったら Webhook を検討すること。
 *
 * @param expectedUpdatedAt ツールが読んだときの `updatedAt`。省略すると素通し
 */
export async function updateRecordSafely(
  plural: string, singular: string, id: string,
  patch: Record<string, unknown>, expectedUpdatedAt?: string | null,
): Promise<SafeUpdateResult> {
  assertWritable(plural);

  if (expectedUpdatedAt) {
    const current = await getRecord(plural, singular, id);
    if (!current) throw new TestWriteError('client', 'レコードが見つかりません', 404);
    const theirs = typeof current.updatedAt === 'string' ? current.updatedAt : '';
    // ミリ秒の表記ゆれで誤検知しないよう、時刻として比べる
    if (theirs && new Date(theirs).getTime() !== new Date(expectedUpdatedAt).getTime()) {
      return { ok: false, reason: 'conflict', theirs: current };
    }
  }

  return { ok: true, record: await updateRecord(plural, singular, id, patch) };
}

/** Twenty の DELETE は論理削除（deletedAt が入る）*/
export async function deleteRecord(plural: string, id: string): Promise<void> {
  assertWritable(plural);
  await request('DELETE', `/rest/${plural}/${encodeURIComponent(id)}`);
}

// ── 冪等な作成（§7。Twenty に upsert は無い）────────────────────────────────

// ── 「誰が書いたか」のスタンプ ──────────────────────────────────────────────
//
// ═══════════════════════════════════════════════════════════════════════════
//  Twenty の ACTOR 型（`createdBy` / `updatedBy`）の実測（2026-10-01）:
//    - API キー認証だと `name` に **キーの名前**が入り、
//      `workspaceMemberId` は **null** になる
//    - `createdBy` は **作成時に明示できる**。`workspaceMemberId` も効く
//    - `updatedBy` は **明示しても Twenty が API キー名で上書きする**
//
//  したがって「最後に誰が直したか」は Twenty 任せにできない。
//  自前の `updatedByName2` 列に毎回書く。
// ═══════════════════════════════════════════════════════════════════════════

export interface WriteActor {
  /** ダッシュボード表記の name2。`updatedByName2` に入る */
  name2: string;
  /** Twenty に見せる表示名 */
  displayName?: string;
  /** Twenty の本人レコード。取れた人だけ `createdBy` が人物に紐付く */
  workspaceMemberId?: string | null;
}

/**
 * 作成時だけ付ける。更新時に送っても無視される（Twenty が保持する）。
 * **組み立てはここ 1 箇所だけ。** staff.ts からも同じものを使う。
 */
export function createdByPayload(actor: WriteActor): Record<string, unknown> {
  const name = actor.displayName || actor.name2;
  return actor.workspaceMemberId
    ? { source: 'MANUAL', name, workspaceMemberId: actor.workspaceMemberId }
    : { source: 'API', name };
}

/**
 * `externalId` を鍵に、無ければ作り、あれば更新する。
 *
 * 原本は**ドキュメント全置換**で保存してくる（`doc.set(body)`）ので、
 * 保存のたびにこれを通して「作る／直す」を振り分ける。
 * **Twenty に upsert は無い**ので、検索 → 分岐を自前でやる。
 *
 * @param actor 省略可。渡すと `updatedByName2` を毎回、`createdBy` を作成時だけ書く
 */
export async function upsertByExternalId(
  plural: string, singular: string, externalId: string, rec: Record<string, unknown>,
  actor?: WriteActor | null,
): Promise<{ record: Record<string, unknown>; created: boolean }> {
  assertWritable(plural);
  const stamped = actor?.name2 ? { ...rec, updatedByName2: actor.name2 } : rec;

  const found = await listRecords(plural, singular, {
    filter: `externalId[eq]:${externalId}`, pageSize: 2, maxRecords: 2,
  });
  if (found.length) {
    const id = String(found[0].id);
    return { record: await updateRecord(plural, singular, id, stamped), created: false };
  }
  const create: Record<string, unknown> = { ...stamped, externalId };
  if (actor?.name2) create.createdBy = createdByPayload(actor);
  return { record: await createRecord(plural, singular, create), created: true };
}

/** externalId が接頭辞に一致するものを全部返す。全置換の差分取りに使う */
export async function listByExternalPrefix(
  plural: string, singular: string, prefix: string,
): Promise<Record<string, unknown>[]> {
  assertWritable(plural);
  return listRecords(plural, singular, {
    filter: `externalId[ilike]:${prefix}%`, pageSize: 200, maxRecords: 1000,
  });
}

/**
 * 「作る前に検索」して重複を防ぐ。
 * **Twenty には一意制約も upsert も無い**（2026-09-30 実測）。
 * 同じ内容を 2 回 POST すると別 id で 2 件できるので、作成系は必ずこれを通すこと。
 */
export async function createIfAbsent(
  plural: string, singular: string, matchFilter: string, rec: Record<string, unknown>,
): Promise<{ record: Record<string, unknown>; created: boolean }> {
  assertWritable(plural);
  const found = await listRecords(plural, singular, { filter: matchFilter, pageSize: 2, maxRecords: 2 });
  if (found.length) return { record: found[0], created: false };
  return { record: await createRecord(plural, singular, rec), created: true };
}
