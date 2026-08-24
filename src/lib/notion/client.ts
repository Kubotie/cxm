// ─── Notion API クライアント（サーバーサイド専用）────────────────────────────
//
// WHAT カタログ（Notion が正本）の読み取りに使う薄いラッパー。
//
// 環境変数: TOKEN_NOTION_2 を優先し、無ければ TOKEN_NOTION
//   What管理ページに接続されているのは TOKEN_NOTION_2（od-info-flow）側。
//   TOKEN_NOTION（Kubotie-CS/CRM）では 404 になる（実測）。
//   未設定・未接続の場合は例外を投げず空を返す（graceful degradation）。
//   カタログが取れなくても提案準備ボードは動く必要がある。
//
// ⚠️ Notion API はレート制限が厳しい（平均3リクエスト/秒）。
//   同時実行を絞り、429 は指数バックオフで待つ。
//
// ブラウザから import しないこと。

const NOTION_VERSION = '2022-06-28';
const BASE = 'https://api.notion.com/v1';

/** 同時実行数。Notion の平均3req/sec に対して安全側 */
const CONCURRENCY = 2;
/** 429 / 5xx のリトライ回数 */
const MAX_RETRY = 3;

export interface NotionPage {
  id:         string;
  properties: Record<string, NotionProperty>;
  url?:       string;
  archived?:  boolean;
}

/** 使う型だけを緩く定義する（Notion の型は広いので必要分に絞る） */
export interface NotionProperty {
  type:          string;
  title?:        Array<{ plain_text?: string }>;
  rich_text?:    Array<{ plain_text?: string }>;
  select?:       { name?: string } | null;
  multi_select?: Array<{ name?: string }>;
  relation?:     Array<{ id: string }>;
  number?:       number | null;
  people?:       Array<{ id: string; name?: string }>;
  date?:         { start?: string | null } | null;
  formula?:      { type?: string; string?: string | null; number?: number | null };
  rollup?:       { type?: string; array?: NotionProperty[]; number?: number | null };
  [k: string]:   unknown;
}

/**
 * 使用するトークン。What管理ページに接続されている方を優先する。
 * どちらも未設定なら null。
 */
function notionToken(): string | null {
  return process.env.TOKEN_NOTION_2 || process.env.TOKEN_NOTION || null;
}

export function isNotionConfigured(): boolean {
  return Boolean(notionToken());
}

// ── 低レベル ──────────────────────────────────────────────────────────────────

async function notionFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = notionToken();
  if (!token) throw new NotionUnavailableError('TOKEN_NOTION_2 / TOKEN_NOTION が未設定です');

  let lastError = '';
  for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization:    `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type':   'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });

    if (res.ok) return res;

    // 429 / 5xx は待って再試行
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get('retry-after') ?? 0);
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : 400 * Math.pow(2, attempt);
      lastError = `HTTP ${res.status}`;
      if (attempt < MAX_RETRY) {
        await sleep(waitMs);
        continue;
      }
    }

    const body = await res.text().catch(() => '');
    // 404 は「インテグレーションに共有されていない」がほぼ全て。原因が分かる形で投げる
    if (res.status === 404) {
      throw new NotionUnavailableError(
        `Notion のデータベースが見つかりません（${path}）。` +
        `対象DBをインテグレーションに共有してください。詳細: ${body.slice(0, 200)}`,
      );
    }
    throw new Error(`Notion API ${res.status}: ${body.slice(0, 300)}`);
  }
  throw new Error(`Notion API リトライ上限（${lastError}）`);
}

/** 共有されていない / 未設定など、呼び出し側が空で継続すべき状態 */
export class NotionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotionUnavailableError';
  }
}

// ── データソースの全行取得 ────────────────────────────────────────────────────

/**
 * データベース（データソース）の全行を取得する。
 * ページングを最後まで辿る。archived は除外する。
 */
export async function queryAllPages(databaseId: string): Promise<NotionPage[]> {
  const out: NotionPage[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 20; page++) {   // 20*100 = 2000行で打ち切り（暴走防止）
    const res = await notionFetch(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    const json = await res.json() as {
      results?: NotionPage[];
      has_more?: boolean;
      next_cursor?: string | null;
    };

    for (const p of json.results ?? []) {
      if (p.archived) continue;
      out.push(p);
    }

    if (!json.has_more || !json.next_cursor) break;
    cursor = json.next_cursor;
    // 連続クエリの間隔を空ける（レート制限対策）
    await sleep(120);
  }

  return out;
}

/** 複数のデータソースを、同時実行を絞って取得する */
export async function queryDatabases(
  ids: string[],
): Promise<Map<string, NotionPage[]>> {
  const result = new Map<string, NotionPage[]>();
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const chunk = ids.slice(i, i + CONCURRENCY);
    const pages = await Promise.all(chunk.map(id => queryAllPages(id)));
    chunk.forEach((id, j) => result.set(id, pages[j]));
    if (i + CONCURRENCY < ids.length) await sleep(200);
  }
  return result;
}

// ── プロパティ読み取り ────────────────────────────────────────────────────────

export function readTitle(p: NotionProperty | undefined): string {
  return (p?.title ?? []).map(t => t.plain_text ?? '').join('').trim();
}

export function readText(p: NotionProperty | undefined): string {
  return (p?.rich_text ?? []).map(t => t.plain_text ?? '').join('').trim();
}

export function readSelect(p: NotionProperty | undefined): string | null {
  return p?.select?.name?.trim() || null;
}

export function readMultiSelect(p: NotionProperty | undefined): string[] {
  return (p?.multi_select ?? []).map(o => o.name ?? '').filter(Boolean);
}

export function readRelationIds(p: NotionProperty | undefined): string[] {
  return (p?.relation ?? []).map(r => r.id).filter(Boolean);
}

export function readNumber(p: NotionProperty | undefined): number | null {
  return typeof p?.number === 'number' ? p.number : null;
}

export function readPeopleNames(p: NotionProperty | undefined): string[] {
  return (p?.people ?? []).map(u => u.name ?? u.id).filter(Boolean);
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/** Notion のページIDは環境によってハイフン有無が揺れるので正規化して比較する */
export function normalizePageId(id: string): string {
  return id.replace(/-/g, '').toLowerCase();
}
