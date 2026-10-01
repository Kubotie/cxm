// ─── PtAI Pipeline: Notion クライアント（サーバー専用）──────────────────────
//
// 出典: docs/ptai-dashboard-operation-flows.md §8
//
// ═══════════════════════════════════════════════════════════════════════════
//  顧客管理DB は**双方向**（アカウント情報の正本）。
//  JP_Docs は**読むだけ**。目標DB（§9-1 で新設）は双方向。
//
//  書き込みは `last_edited_time` の楽観ロックを通す（§8-1）。
//  ツールが最後に読んだ時刻より Notion 側が新しければ、**上書きせずに返す**。
// ═══════════════════════════════════════════════════════════════════════════
//
// ── 守ること ──────────────────────────────────────────────────────────────────
//   - トークンを戻り値・例外・ログに出さない
//   - 顧客名・本文をログに出さない。出すのは件数と種別だけ
//   - 触るのは NOTION_SOURCES と目標DB だけ。他の DB には触れない
//   - ブラウザから import しない

import {
  NOTION_SOURCES, CUSTOMER_PROP, CUSTOMER_READONLY_PROPS, DOC_PROP,
  DOC_CATEGORY_MINUTES, MEETING_BODY_MAX, targetsDataSourceId,
  parseMonth, formatMonth, parseMonthRange, formatMonthRange,
  type MeetingRecord, type KeyDates,
} from './schema';

const API = 'https://api.notion.com/v1';
const VERSION = '2025-09-03';
const TIMEOUT_MS = 30_000;
const MAX_RETRY = 3;
const BACKOFF_MS = [1000, 2000, 4000];
/** Notion の公称レート。平均 3 req/s */
const RATE_PER_SEC = 3;

function token(): string | null {
  const t = (process.env.PGA_NOTION_TOKEN || process.env.TOKEN_NOTION || '').trim();
  return t || null;
}
export function isConfigured(): boolean {
  return Boolean(token());
}

export type NotionErrorKind =
  | 'config' | 'auth' | 'not_found' | 'conflict'
  | 'rate_limited' | 'server' | 'network' | 'bad_response' | 'client';

export class NotionError extends Error {
  readonly kind: NotionErrorKind;
  readonly status?: number;
  constructor(kind: NotionErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'NotionError';
    this.kind = kind;
    this.status = status;
  }
  toSafeString(): string {
    return `[${this.kind}${this.status ? ' ' + this.status : ''}] ${this.message}`;
  }
}

// ── レート制御 ───────────────────────────────────────────────────────────────

let windowStart = 0;
let inWindow = 0;
async function throttle(): Promise<void> {
  const now = Date.now();
  if (now - windowStart >= 1000) { windowStart = now; inWindow = 0; }
  if (++inWindow > RATE_PER_SEC) {
    await new Promise(r => setTimeout(r, Math.max(0, 1000 - (now - windowStart))));
    windowStart = Date.now(); inWindow = 1;
  }
}

async function request(method: string, path: string, body?: unknown): Promise<Record<string, unknown>> {
  const t = token();
  if (!t) throw new NotionError('config', 'Notion のトークンが未設定です');

  let last: NotionError | null = null;
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    await throttle();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API + path, {
        method,
        headers: {
          Authorization: `Bearer ${t}`,
          'Notion-Version': VERSION,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ac.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);

      const json = await res.json().catch(() => null) as Record<string, unknown> | null;
      if (res.ok) {
        if (!json) throw new NotionError('bad_response', '応答を JSON として読めませんでした', res.status);
        return json;
      }

      const code = typeof json?.code === 'string' ? json.code : '';
      if (res.status === 401) throw new NotionError('auth', 'Notion にトークンが拒否されました', 401);
      if (res.status === 404 || code === 'object_not_found') {
        throw new NotionError('not_found', 'Notion にそのページ・DB がありません（共有されていない可能性）', 404);
      }
      if (res.status === 429) { last = new NotionError('rate_limited', 'レート制限', 429); }
      else if (res.status >= 500) { last = new NotionError('server', 'Notion がエラーを返しました', res.status); }
      else throw new NotionError('client', `拒否されました（${code || res.status}）`, res.status);
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof NotionError) {
        if (['auth', 'not_found', 'client', 'config', 'conflict'].includes(e.kind)) throw e;
        last = e;
      } else {
        last = new NotionError('network', 'Notion に接続できませんでした');
      }
    }
    if (attempt < MAX_RETRY) await new Promise(r => setTimeout(r, BACKOFF_MS[attempt]));
  }
  throw last ?? new NotionError('network', 'Notion に接続できませんでした');
}

// ── プロパティの読み書き ─────────────────────────────────────────────────────

type Props = Record<string, Record<string, unknown>>;

export const plainText = (rich: unknown): string =>
  Array.isArray(rich) ? rich.map(r => (r as { plain_text?: string })?.plain_text ?? '').join('') : '';

export function readProp(props: Props | undefined, name: string): unknown {
  const p = props?.[name];
  if (!p) return null;
  switch (p.type) {
    case 'title':        return plainText(p.title);
    case 'rich_text':    return plainText(p.rich_text);
    case 'number':       return typeof p.number === 'number' ? p.number : null;
    case 'checkbox':     return p.checkbox === true;
    case 'select':       return (p.select as { name?: string } | null)?.name ?? null;
    case 'status':       return (p.status as { name?: string } | null)?.name ?? null;
    case 'multi_select': return ((p.multi_select as Array<{ name?: string }>) ?? []).map(o => o.name ?? '');
    case 'date':         return (p.date as { start?: string } | null)?.start ?? null;
    case 'created_time': return p.created_time ?? null;
    case 'last_edited_time': return p.last_edited_time ?? null;
    case 'relation':     return ((p.relation as Array<{ id?: string }>) ?? []).map(o => o.id ?? '');
    case 'formula': {
      const f = p.formula as Record<string, unknown> | undefined;
      return f ? (f.number ?? f.string ?? f.boolean ?? f.date ?? null) : null;
    }
    case 'rollup': {
      const r = p.rollup as Record<string, unknown> | undefined;
      return r ? (r.number ?? r.string ?? null) : null;
    }
    default: return null;
  }
}

const rich = (s: string) => (s ? [{ type: 'text', text: { content: s.slice(0, 2000) } }] : []);

/** 値の型からプロパティの形を組み立てる。**型を取り違えると Notion が 400 を返す** */
export function writeProp(kind: string, value: unknown): Record<string, unknown> {
  switch (kind) {
    case 'title':        return { title: rich(String(value ?? '')) };
    case 'rich_text':    return { rich_text: value == null || value === '' ? [] : rich(String(value)) };
    case 'number':       return { number: value == null || value === '' ? null : Number(value) };
    case 'checkbox':     return { checkbox: value === true };
    case 'select':       return { select: value ? { name: String(value) } : null };
    case 'multi_select': return { multi_select: (Array.isArray(value) ? value : []).filter(Boolean).map(v => ({ name: String(v) })) };
    case 'date':         return { date: value ? { start: String(value) } : null };
    default: throw new NotionError('client', `未対応のプロパティ型: ${kind}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 顧客管理DB（双方向）
// ═══════════════════════════════════════════════════════════════════════════

export interface NotionCustomer {
  pageId:         string;
  url:            string | null;
  lastEditedTime: string;
  name:           string;
  tier:           string | null;
  industry:       string | null;
  owners3:        string[];
  mrr:            number | null;
  aimMrr:         number | null;
  billingMonth:   string | null;
  billingStage:   string | null;
  barrier:        string | null;
  nextAction:     string | null;
  nextActionDate: string | null;
  solutionStatus: string | null;
  companyRelation: string[];
  /** キー日程（§9-4 で Notion に置くと決定）。月で持つ。日付ではない */
  keyDates:       KeyDates;
}

function toCustomer(page: Record<string, unknown>): NotionCustomer {
  const props = page.properties as Props | undefined;
  const r = (n: string) => readProp(props, n);
  return {
    pageId:          String(page.id ?? ''),
    url:             typeof page.url === 'string' ? page.url : null,
    lastEditedTime:  String(page.last_edited_time ?? ''),
    name:            String(r(CUSTOMER_PROP.name) ?? ''),
    tier:            (r(CUSTOMER_PROP.tier) as string | null) ?? null,
    industry:        (r(CUSTOMER_PROP.industry) as string | null) ?? null,
    owners3:         (r(CUSTOMER_PROP.owner3) as string[] | null) ?? [],
    mrr:             (r(CUSTOMER_PROP.mrr) as number | null) ?? null,
    aimMrr:          (r(CUSTOMER_PROP.aimMrr) as number | null) ?? null,
    billingMonth:    (r(CUSTOMER_PROP.billingMonth) as string | null) ?? null,
    billingStage:    (r(CUSTOMER_PROP.billingStage) as string | null) ?? null,
    barrier:         (r(CUSTOMER_PROP.barrier) as string | null) || null,
    nextAction:      (r(CUSTOMER_PROP.nextAction) as string | null) || null,
    nextActionDate:  (r(CUSTOMER_PROP.nextActionDate) as string | null) ?? null,
    solutionStatus:  (r(CUSTOMER_PROP.solutionStatus) as string | null) ?? null,
    companyRelation: (r(CUSTOMER_PROP.companyDatabase) as string[] | null) ?? [],
    keyDates: {
      fiscalMonth:  parseMonth(r(CUSTOMER_PROP.fiscalMonth) as string | null),
      budgetMonths: parseMonthRange(r(CUSTOMER_PROP.budgetMonths) as string | null),
      renewalMonth: parseMonth(r(CUSTOMER_PROP.renewalMonth) as string | null),
    },
  };
}

export async function getCustomer(pageId: string): Promise<NotionCustomer> {
  return toCustomer(await request('GET', `/pages/${pageId}`));
}

export async function listCustomers(opts: { pageSize?: number; maxPages?: number } = {}): Promise<NotionCustomer[]> {
  const out: NotionCustomer[] = [];
  let cursor: string | undefined;
  const max = opts.maxPages ?? 20;
  for (let i = 0; i < max; i++) {
    const body: Record<string, unknown> = { page_size: Math.min(opts.pageSize ?? 100, 100) };
    if (cursor) body.start_cursor = cursor;
    const res = await request('POST', `/data_sources/${NOTION_SOURCES.customers}/query`, body);
    for (const p of (res.results as Array<Record<string, unknown>>) ?? []) out.push(toCustomer(p));
    if (res.has_more !== true) break;
    cursor = String(res.next_cursor ?? '');
    if (!cursor) break;
  }
  return out;
}

/** 書き込める項目と、その Notion 上の型 */
const WRITABLE: Record<keyof CustomerPatch, { prop: string; kind: string }> = {
  tier:           { prop: CUSTOMER_PROP.tier,           kind: 'select' },
  industry:       { prop: CUSTOMER_PROP.industry,       kind: 'select' },
  aimMrr:         { prop: CUSTOMER_PROP.aimMrr,         kind: 'number' },
  billingMonth:   { prop: CUSTOMER_PROP.billingMonth,   kind: 'date' },
  billingStage:   { prop: CUSTOMER_PROP.billingStage,   kind: 'select' },
  barrier:        { prop: CUSTOMER_PROP.barrier,        kind: 'rich_text' },
  nextAction:     { prop: CUSTOMER_PROP.nextAction,     kind: 'rich_text' },
  nextActionDate: { prop: CUSTOMER_PROP.nextActionDate, kind: 'date' },
  owners3:        { prop: CUSTOMER_PROP.owner3,         kind: 'multi_select' },
  fiscalMonth:    { prop: CUSTOMER_PROP.fiscalMonth,    kind: 'select' },
  budgetMonths:   { prop: CUSTOMER_PROP.budgetMonths,   kind: 'rich_text' },
  renewalMonth:   { prop: CUSTOMER_PROP.renewalMonth,   kind: 'select' },
};

export interface CustomerPatch {
  tier?:           string | null;
  industry?:       string | null;
  aimMrr?:         number | null;
  billingMonth?:   string | null;
  billingStage?:   string | null;
  barrier?:        string | null;
  nextAction?:     string | null;
  nextActionDate?: string | null;
  owners3?:        string[];
  /** キー日程。月（1〜12）／'none'（情報なし）／null（未設定） */
  fiscalMonth?:    number | 'none' | null;
  budgetMonths?:   [number, number] | 'none' | null;
  renewalMonth?:   number | 'none' | null;
}

export type UpdateResult =
  | { ok: true;  customer: NotionCustomer; changed: string[] }
  | { ok: false; reason: 'conflict'; theirs: NotionCustomer }
  | { ok: false; reason: 'no_change' };

/**
 * 顧客ページを更新する（§8-1）。
 *
 * @param expectedLastEdited ツールが最後に読んだ `last_edited_time`。
 *   Notion 側がそれより新しければ**上書きせず** conflict を返す。
 *   省略すると楽観ロックを行わない（移行スクリプトなど、意図がある場合だけ）。
 */
export async function updateCustomer(
  pageId: string, patch: CustomerPatch, expectedLastEdited?: string,
): Promise<UpdateResult> {
  return updateCustomerWithExtras(pageId, patch, {}, expectedLastEdited);
}

/**
 * `updateCustomer` に、型を持たせていないプロパティを足して書く。
 *
 * 移行のように「キー日程の確度」「キー日程の出典」など、
 * CustomerPatch に無い列も同時に埋めたいときだけ使う。
 * **`extras` のキーは Notion のプロパティ名そのまま。** 値は文字列だけ受ける。
 * 読み取り専用の列（CUSTOMER_READONLY_PROPS）は無視する。
 */
export async function updateCustomerWithExtras(
  pageId: string, patch: CustomerPatch,
  extras: Record<string, string | null>, expectedLastEdited?: string,
): Promise<UpdateResult> {
  // ページは 1 回だけ取る（移行で 100 社まわすとレート制限に当たるため）
  const page = await request('GET', `/pages/${pageId}`);
  const current = toCustomer(page);
  const currentProps = page.properties as Props | undefined;

  if (expectedLastEdited && current.lastEditedTime && current.lastEditedTime !== expectedLastEdited) {
    return { ok: false, reason: 'conflict', theirs: current };
  }

  const properties: Props = {};
  const changed: string[] = [];
  for (const [key, spec] of Object.entries(WRITABLE) as Array<[keyof CustomerPatch, { prop: string; kind: string }]>) {
    if (!(key in patch)) continue;
    if (CUSTOMER_READONLY_PROPS.includes(spec.prop)) continue;   // 二重の安全弁
    const next = patch[key];
    const prev = key === 'fiscalMonth' || key === 'budgetMonths' || key === 'renewalMonth'
      ? (current.keyDates as unknown as Record<string, unknown>)[key]
      : (current as unknown as Record<string, unknown>)[key];
    if (JSON.stringify(prev ?? null) === JSON.stringify(next ?? null)) continue;

    // キー日程は「7月」「10月〜11月」の表記に直してから書く
    const value =
      key === 'budgetMonths' ? formatMonthRange(next as [number, number] | 'none' | null)
      : key === 'fiscalMonth' || key === 'renewalMonth' ? formatMonth(next as number | 'none' | null)
      : next;

    properties[spec.prop] = writeProp(spec.kind, value) as Record<string, unknown>;
    changed.push(String(key));
  }

  // 型を持たせていない列。select か rich_text かは現在の値の型から決める
  for (const [name, value] of Object.entries(extras)) {
    if (CUSTOMER_READONLY_PROPS.includes(name)) continue;
    const type = currentProps?.[name]?.type;
    if (type !== 'select' && type !== 'rich_text') continue;   // 知らない型には書かない
    const prev = readProp(currentProps, name);
    if (String(prev ?? '') === String(value ?? '')) continue;
    properties[name] = writeProp(type, value) as Record<string, unknown>;
    changed.push(name);
  }

  if (!changed.length) return { ok: false, reason: 'no_change' };

  const updated = await request('PATCH', `/pages/${pageId}`, { properties });
  return { ok: true, customer: toCustomer(updated), changed };
}

// ═══════════════════════════════════════════════════════════════════════════
// JP_Docs（議事録。読むだけ）
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 会社に紐づく議事録を新しい順に返す（§8-2）。
 * **タイトル検索ではなく `関連顧客` リレーションで絞る。**
 *
 * @param companyRelationIds 顧客管理DB の `Company Database` リレーションの id
 */
export async function listMinutes(
  companyRelationIds: string[], limit = 6,
): Promise<MeetingRecord[]> {
  if (!companyRelationIds.length) return [];

  const res = await request('POST', `/data_sources/${NOTION_SOURCES.docs}/query`, {
    page_size: Math.min(Math.max(limit, 1), 100),
    filter: {
      and: [
        { property: DOC_PROP.category, multi_select: { contains: DOC_CATEGORY_MINUTES } },
        { or: companyRelationIds.map(id => ({ property: DOC_PROP.company, relation: { contains: id } })) },
      ],
    },
    sorts: [{ property: DOC_PROP.createdDate, direction: 'descending' }],
  });

  return ((res.results as Array<Record<string, unknown>>) ?? []).map(page => toMeeting(page));
}

/** JP_Docs のページ → MeetingRecord */
function toMeeting(page: Record<string, unknown>): MeetingRecord {
  const props = page.properties as Props | undefined;
  const created = String(readProp(props, DOC_PROP.createdDate) ?? '');
  const title = String(readProp(props, DOC_PROP.title) ?? '');
  return {
    externalId: String(page.id ?? ''),
    source:     'NOTION',
    title,
    date:       titleDate(title) || created.slice(0, 10),
    body:       [
      readProp(props, DOC_PROP.decisions), readProp(props, DOC_PROP.nextAction),
    ].filter(Boolean).map(String).join('\n\n').slice(0, MEETING_BODY_MAX),
    url:        typeof page.url === 'string' ? page.url : null,
    scope:      (readProp(props, DOC_PROP.scope) as string | null) ?? null,
    attendees:  (readProp(props, DOC_PROP.attendees) as string | null) || null,
  };
}

/**
 * `関連顧客` リレーションが無い会社のための**暫定フォールバック**（§8-2）。
 *
 * 実測で、顧客管理DB 127 社のうちリレーションがあるのは 57 社（45%）だけ。
 * 残りはタイトルに社名が入っているかで拾う。
 *
 * ⚠ **誤って別の会社の議事録が出ることがある。** 呼び出し側は `matchedBy: 'title'`
 *   として画面に印を出すこと。リレーションが埋まったらこの経路は消す。
 */
export async function listMinutesByTitle(companyKey: string, limit = 6): Promise<MeetingRecord[]> {
  if (!companyKey || companyKey.length < 3) return [];

  const res = await request('POST', `/data_sources/${NOTION_SOURCES.docs}/query`, {
    page_size: Math.min(Math.max(limit, 1), 100),
    filter: {
      and: [
        { property: DOC_PROP.category, multi_select: { contains: DOC_CATEGORY_MINUTES } },
        { property: DOC_PROP.title,    title: { contains: companyKey } },
      ],
    },
    sorts: [{ property: DOC_PROP.createdDate, direction: 'descending' }],
  });

  return ((res.results as Array<Record<string, unknown>>) ?? []).map(page => toMeeting(page));
}

/** タイトル先頭の YYYYMMDD → YYYY-MM-DD */
export function titleDate(t: string): string {
  const m = String(t || '').match(/(20\d{2})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

/** 議事録の本文（ブロック）。要るときだけ引く。重いので既定では取らない */
export async function fetchMinuteBody(pageId: string): Promise<string> {
  const res = await request('GET', `/blocks/${pageId}/children?page_size=100`);
  const lines: string[] = [];
  for (const b of (res.results as Array<Record<string, unknown>>) ?? []) {
    const type = String(b.type ?? '');
    const inner = b[type] as { rich_text?: unknown } | undefined;
    const text = plainText(inner?.rich_text);
    if (text) lines.push(text);
  }
  return lines.join('\n').slice(0, MEETING_BODY_MAX);
}

// ═══════════════════════════════════════════════════════════════════════════
// 目標DB（§9-1。双方向）
// ═══════════════════════════════════════════════════════════════════════════

export interface TargetRow {
  pageId: string;
  /** 'チーム' | 'メンバー' */
  kind:   string | null;
  label:  string;
  name2:  string | null;
  mrr:    number | null;
  /** YYYY-MM。チーム行だけ入る */
  due:    string | null;
  active: boolean;
}

export interface TeamTargets {
  targetMrr: number;
  targetDue: string;
  /** name2 → 円 */
  targets:   Record<string, number>;
}

function requireTargetsDs(): string {
  const ds = targetsDataSourceId();
  if (!ds) throw new NotionError('config', 'NOTION_PTAI_TARGETS_DS_ID が未設定です');
  return ds;
}

export async function listTargetRows(): Promise<TargetRow[]> {
  const res = await request('POST', `/data_sources/${requireTargetsDs()}/query`, { page_size: 100 });
  return ((res.results as Array<Record<string, unknown>>) ?? []).map(p => {
    const props = p.properties as Props | undefined;
    return {
      pageId: String(p.id ?? ''),
      kind:   (readProp(props, '種別') as string | null) ?? null,
      label:  String(readProp(props, '対象') ?? ''),
      name2:  (readProp(props, 'name2') as string | null) || null,
      mrr:    (readProp(props, '目標MRR') as number | null) ?? null,
      due:    (readProp(props, '期限') as string | null) || null,
      active: readProp(props, '有効') === true,
    };
  });
}

/** 原本の `settings/targets` と同じ形に畳む */
export async function readTeamTargets(): Promise<TeamTargets> {
  const rows = (await listTargetRows()).filter(r => r.active);
  const team = rows.find(r => r.kind === 'チーム');
  const targets: Record<string, number> = {};
  for (const r of rows) {
    if (r.kind !== 'メンバー' || !r.name2 || r.mrr == null) continue;
    targets[r.name2] = r.mrr;
  }
  return {
    targetMrr: team?.mrr ?? 0,
    targetDue: team?.due ?? '',
    targets,
  };
}

/** 1 行だけ更新する。目標の編集（B-01）で使う */
export async function updateTargetRow(
  pageId: string, patch: { mrr?: number | null; due?: string | null; active?: boolean },
): Promise<void> {
  const properties: Props = {};
  if ('mrr' in patch)    properties['目標MRR'] = writeProp('number', patch.mrr) as Record<string, unknown>;
  if ('due' in patch)    properties['期限']    = writeProp('rich_text', patch.due) as Record<string, unknown>;
  if ('active' in patch) properties['有効']    = writeProp('checkbox', patch.active) as Record<string, unknown>;
  if (!Object.keys(properties).length) return;
  await request('PATCH', `/pages/${pageId}`, { properties });
}
