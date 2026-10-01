// ─── POST /api/ptai/mcp ───────────────────────────────────────────────────────
//
// アーティファクトの `window.claude.use('mcp').callTool(server, tool, input)` の置き換え。
// ページが呼ぶのは次の 5 つだけ（HANDOVER 5・6-3）:
//
//   Notion    notion-search / notion-fetch / notion-create-pages
//   Intercom  search / get_conversation
//   host:twenty  execute_tool（企業追加。Phase 1 では未接続 → 同期待ち）
//
// 返り値は claude.ai コネクタの payload 形に寄せる（board.js を書き換えないため）。
// エラーは { code } を返し、shim 側で throw して原本の catch に流す。

import { NextRequest, NextResponse } from 'next/server';
import { getUserUidFromCookie } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const NOTION_BASE = 'https://api.notion.com/v1';
/** data_source_id を parent に使えるのは 2025-09-03 以降（memory: DB ID と data source ID は別物）*/
const NOTION_VERSION_DS = '2025-09-03';
const NOTION_VERSION    = '2022-06-28';
const INTERCOM_BASE = 'https://api.intercom.io';

/**
 * PtAI顧客管理DB に接続されているのは TOKEN_NOTION 側（2026-09-30 実測。
 * TOKEN_NOTION_2 は What 管理ページ用で、この data source には 404）。
 * CXM 本体とは優先順が逆なので、ここで別に持つ。PGA_NOTION_TOKEN で上書きできる。
 */
function notionToken(): string | null {
  return process.env.PGA_NOTION_TOKEN || process.env.TOKEN_NOTION || process.env.TOKEN_NOTION_2 || null;
}

function fail(code: string, message?: string, retryable = false) {
  return NextResponse.json({ ok: false, code, message, retryable });
}

export async function POST(req: NextRequest) {
  if (!(await getUserUidFromCookie())) return fail('session_expired');

  const body = await req.json().catch(() => ({})) as {
    server?: string; tool?: string; input?: Record<string, unknown>;
  };
  const server = body.server ?? '';
  const tool   = body.tool ?? '';
  const input  = body.input ?? {};

  try {
    if (server === 'Notion')   return NextResponse.json({ ok: true, payload: await notion(tool, input) });
    if (server === 'Intercom') return NextResponse.json({ ok: true, payload: await intercom(tool, input) });
    if (server === 'host:twenty') {
      // ═══════════════════════════════════════════════════════════════════
      //  原本はここで Twenty の **既存 Company** を作る（create_one_company）。
      //  いまの設計では作らない。理由は 2 つ:
      //    1. アカウント情報の正本は **Notion**（§9-1）。会社は Notion に作る。
      //       board.js は直前に ncSyncNotion で Notion ページを作っており、
      //       新しい経路（raw-view）は Notion から会社を組み立てる。
      //       Twenty に Company を作っても**ダッシュボードには出ない**。
      //    2. PtAI が書けるのは `test*` だけ（§7）。既存 Company は対象外で、
      //       twenty-test/client.ts が assertWritable で弾く。
      //
      //  2026-10-01 まで `twenty_key_missing`（＝キー未設定）を返していたが、
      //  キーは設定済みなので**理由として誤り**。原本の「同期待ち」表示に落ちる
      //  コードのうち、キーのせいだと誤解させないものへ変える。
      //
      //  ⚠ 画面には「Twenty：同期待ち」と出るが、**待っている処理は無い。**
      //     board.js を変えずに文言を直す方法が無いため、次の版で
      //     「Twenty に作成する」手順自体を外すのが本筋（Utty 判断）。
      // ═══════════════════════════════════════════════════════════════════
      await logTwentySkip(tool, input);
      return fail('not_in_manifest', '新規会社は Notion に作ります（Twenty の Company は作りません）');
    }
    return fail('not_in_manifest', `${server} は未対応です`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/not_connected/.test(msg)) return fail('server_not_connected', msg);
    return fail('tool_error', msg.slice(0, 200), true);
  }
}

/**
 * 「Twenty に会社を作らなかった」ことを操作ログに残す（§6）。
 * 画面には「同期待ち」としか出ないので、**あとで追えるようにここで記録する。**
 * 失敗しても会社追加そのものは Notion 側で成立しているので握りつぶす。
 */
async function logTwentySkip(tool: string, input: Record<string, unknown>): Promise<void> {
  try {
    const [{ getPtaiIdentity }, { actorStampFor }, { upsertByExternalId }, { TEST_OBJECTS }] =
      await Promise.all([
        import('@/lib/ptai/approver'),
        import('@/lib/ptai/staff'),
        import('@/lib/ptai/twenty-test/client'),
        import('@/lib/ptai/twenty-test/schema'),
      ]);
    const me = await getPtaiIdentity();
    if (!me) return;
    const who = await actorStampFor(me.id, me.name);
    const LOG = TEST_OBJECTS.operationLog;
    // 会社名は入れない（顧客データを操作ログに残さない）。種別と件数だけ
    await upsertByExternalId(LOG.plural, LOG.singular,
      `ui:newco:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`, {
        name: '新規会社の Twenty 作成を省略（Notion が正本）',
        at: new Date().toISOString(), actor: who.name2, action: 'sync',
        object: 'company', recordId: null,
        field: String((input as { toolName?: unknown }).toolName ?? tool),
        from: null, to: null, source: 'ui',
        message: 'アカウント情報の正本は Notion。Twenty の既存 Company は作成しない',
      }, who);
  } catch {
    // 記録に失敗しても会社追加は成立している
  }
}

// ── Notion ───────────────────────────────────────────────────────────────────

async function notionFetch(path: string, init: RequestInit, version = NOTION_VERSION): Promise<unknown> {
  const token = notionToken();
  if (!token) throw new Error('Notion not_connected: TOKEN_NOTION_2 / TOKEN_NOTION が未設定');
  const res = await fetch(`${NOTION_BASE}${path}`, {
    ...init,
    headers: {
      Authorization:    `Bearer ${token}`,
      'Notion-Version': version,
      'Content-Type':   'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Notion ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}

async function notion(tool: string, input: Record<string, unknown>): Promise<unknown> {
  if (tool === 'notion-search') {
    const json = await notionFetch('/search', {
      method: 'POST',
      body: JSON.stringify({
        query: String(input.query ?? ''),
        page_size: Number(input.page_size ?? 15),
        filter: { value: 'page', property: 'object' },
      }),
    }) as { results?: NotionSearchHit[] };

    // board.js が読む形（claude.ai コネクタ互換）に詰め替える
    return {
      results: (json.results ?? []).map(p => ({
        type:      'page',
        id:        p.id,
        url:       p.url ?? '',
        title:     notionTitle(p),
        path:      '',                                  // REST では祖先パスが取れない
        timestamp: p.last_edited_time ?? p.created_time ?? '',
      })),
    };
  }

  if (tool === 'notion-fetch') {
    const id = normalizeId(String(input.id ?? ''));
    if (!id) throw new Error('Notion: id が空です');
    const text = await blockTree(id);
    return { text: `<content>${text}</content>` };
  }

  if (tool === 'notion-create-pages') {
    const parent = input.parent as { data_source_id?: string; database_id?: string } | undefined;
    const pages  = (input.pages as Array<{ properties?: Record<string, unknown> }> | undefined) ?? [];
    const page   = pages[0];
    if (!page) throw new Error('Notion: pages が空です');

    const dsId = parent?.data_source_id ?? process.env.NOTION_CUSTOMER_DATA_SOURCE_ID;
    if (!dsId) throw new Error('Notion: data_source_id がありません');

    const schema = await dataSourceSchema(dsId);
    const created = await notionFetch('/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent:     { type: 'data_source_id', data_source_id: dsId },
        properties: toNotionProperties(page.properties ?? {}, schema),
      }),
    }, NOTION_VERSION_DS) as { url?: string; id?: string };

    // 原本は返り値の文字列から notion.so の URL を正規表現で拾う
    return { url: created.url ?? '', id: created.id ?? '' };
  }

  throw new Error(`Notion: 未対応のツール ${tool}`);
}

interface NotionSearchHit {
  id: string;
  url?: string;
  created_time?: string;
  last_edited_time?: string;
  properties?: Record<string, { type?: string; title?: Array<{ plain_text?: string }> }>;
}

function notionTitle(p: NotionSearchHit): string {
  for (const v of Object.values(p.properties ?? {})) {
    if (v?.type === 'title') return (v.title ?? []).map(t => t.plain_text ?? '').join('');
  }
  return '';
}

interface NotionBlock {
  type?: string;
  [k: string]: unknown;
}

function blockText(b: NotionBlock): string {
  const t = b.type;
  if (!t) return '';
  if (t === 'table_row') {
    const cells = (b[t] as { cells?: Array<Array<{ plain_text?: string }>> } | undefined)?.cells ?? [];
    return cells.map(c => c.map(x => x.plain_text ?? '').join('')).join(' | ');
  }
  const node = b[t] as { rich_text?: Array<{ plain_text?: string }> } | undefined;
  const rt = node?.rich_text;
  if (!Array.isArray(rt)) return '';
  return rt.map(x => x.plain_text ?? '').join('');
}

/**
 * ページ本文をテキストにする。トグル・表・カラムの中身は子ブロックに入るので、
 * 深さ 2・追加リクエスト 25 回までで拾う（Notion は平均 3req/s しか叩けない）。
 */
async function blockTree(id: string, depth = 2, budget = { left: 25 }): Promise<string> {
  const json = await notionFetch(`/blocks/${id}/children?page_size=100`, { method: 'GET' }) as {
    results?: Array<NotionBlock & { id?: string; has_children?: boolean }>;
  };
  const out: string[] = [];
  for (const b of json.results ?? []) {
    const line = blockText(b);
    if (line) out.push(line);
    if (b.has_children && b.id && depth > 0 && budget.left > 0) {
      budget.left--;
      const child = await blockTree(b.id, depth - 1, budget).catch(() => '');
      if (child) out.push(child);
    }
  }
  return out.join('\n');
}

function normalizeId(idOrUrl: string): string {
  const m = idOrUrl.match(/([0-9a-f]{32})/i) ?? idOrUrl.match(/([0-9a-f-]{36})/i);
  const raw = (m?.[1] ?? idOrUrl).replace(/-/g, '');
  if (raw.length !== 32) return idOrUrl;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

/** data source のプロパティ名 → 型。値の包み方を推測せず、実際の型に合わせる */
async function dataSourceSchema(dsId: string): Promise<Record<string, string>> {
  try {
    const json = await notionFetch(`/data_sources/${dsId}`, { method: 'GET' }, NOTION_VERSION_DS) as {
      properties?: Record<string, { type?: string }>;
    };
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(json.properties ?? {})) out[k] = v?.type ?? '';
    return out;
  } catch {
    return {};                       // 取れなければ下の既定マッピングにフォールバック
  }
}

/**
 * 原本は Notion のプロパティを素の値（文字列・配列）で渡してくる。
 * REST API の型に包み直す。列の型はスキーマから引く（取れないときは名前で推測）。
 */
function toNotionProperties(
  src: Record<string, unknown>,
  schema: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(src)) {
    if (value == null || value === '') continue;
    const arr = Array.isArray(value);
    const type = schema[key] ?? (key === '企業名' ? 'title' : key === 'MEMO' ? 'rich_text' : arr ? 'multi_select' : 'select');

    switch (type) {
      case 'title':        out[key] = { title:     [{ text: { content: String(value) } }] }; break;
      case 'rich_text':    out[key] = { rich_text: [{ text: { content: String(value).slice(0, 1900) } }] }; break;
      case 'select':       out[key] = { select: { name: String(arr ? (value as unknown[])[0] : value) } }; break;
      case 'status':       out[key] = { status: { name: String(arr ? (value as unknown[])[0] : value) } }; break;
      case 'multi_select': out[key] = { multi_select: (arr ? value as unknown[] : [value]).map(v => ({ name: String(v) })) }; break;
      case 'people':       out[key] = { people: (arr ? value as unknown[] : [value]).map(v => ({ object: 'user', id: String(v) })) }; break;
      case 'url':          out[key] = { url: String(value) }; break;
      case 'number':       out[key] = { number: Number(value) }; break;
      case 'date':         out[key] = { date: { start: String(value) } }; break;
      default:             out[key] = { rich_text: [{ text: { content: String(value).slice(0, 1900) } }] };
    }
  }
  return out;
}

// ── Intercom ─────────────────────────────────────────────────────────────────

async function intercom(tool: string, input: Record<string, unknown>): Promise<unknown> {
  const token = process.env.TOKEN_INTERCOM;
  if (!token) throw new Error('Intercom not_connected: TOKEN_INTERCOM が未設定');
  const headers = {
    Authorization: `Bearer ${token}`,
    'Intercom-Version': '2.11',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (tool === 'search') {
    // 原本は 'object_type:conversations q:"<社名>" limit:10' という MCP 用のクエリ文字列を渡す
    const raw = String(input.query ?? '');
    const q     = raw.match(/q:"([^"]*)"/)?.[1] ?? raw;
    const limit = Number(raw.match(/limit:(\d+)/)?.[1] ?? 10);

    const res = await fetch(`${INTERCOM_BASE}/conversations/search`, {
      method: 'POST',
      headers,
      cache: 'no-store',
      body: JSON.stringify({
        query: { field: 'source.body', operator: '~', value: q },
        pagination: { per_page: Math.min(limit, 25) },
      }),
    });
    const json = await res.json().catch(() => ({})) as { conversations?: IntercomConv[]; errors?: unknown };
    if (!res.ok) throw new Error(`Intercom ${res.status}: ${JSON.stringify(json.errors ?? json).slice(0, 200)}`);

    return {
      results: (json.conversations ?? []).map(c => ({
        id:    `conversation_${c.id}`,
        title: c.custom_attributes?.['AI Title'] ?? c.title ?? '',
        text:  stripHtml(c.source?.body ?? ''),
      })),
    };
  }

  if (tool === 'get_conversation') {
    const id = String(input.id ?? '').replace('conversation_', '');
    const res = await fetch(`${INTERCOM_BASE}/conversations/${id}?display_as=plaintext`, { headers, cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Intercom ${res.status}`);
    return json;   // 原本は Intercom のネイティブ形をそのまま読む
  }

  throw new Error(`Intercom: 未対応のツール ${tool}`);
}

interface IntercomConv {
  id: string;
  title?: string | null;
  custom_attributes?: Record<string, string>;
  source?: { body?: string };
}

function stripHtml(h: string): string {
  return String(h || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n').trim();
}
