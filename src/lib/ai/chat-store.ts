// ─── AI チャット履歴ストア（Vercel Blob / サーバーサイド専用）──────────────────
//
// ユーザーごとにスレッドを保存する。NocoDB を使わないのは、このデータが
// 「運用対象の業務データ」ではなく各利用者の作業ログであり、
// スキーマ追加なしで完結させたいため（Blob は BLOB_READ_WRITE_TOKEN のみで動く）。
//
// ── 追記専用（append-only）設計にしている理由 ────────────────────────────────
//   Vercel Blob の cacheControlMaxAge は最小 60 秒。つまり「同じ pathname を
//   上書きして読み直す」設計にすると、送信直後のリロードで最大1分間 **古い履歴**
//   が返る。チャット履歴としては壊れているので、上書きを一切しない。
//
//   pathname = ai-chat/{userKey}/{threadId}/{seq}.{updatedAtMs}.{msgCount}.{titleB64}.json
//
//   - 保存は毎回 seq+1 の **新しい pathname** に put する（内容は不変 → CDN も新鮮）
//   - 一覧は list()（API 直・キャッシュ無し）だけで完結する。
//     タイトル・更新時刻・件数を pathname に埋めているので本文を1件も取りに行かない。
//   - 保存後、同一スレッドの古い版は削除する（失敗しても最大 seq が正なので無害）
//   - seq 衝突時は put が 409 で落ちる → 楽観排他としてそのまま再試行に使える

import { list, put, del } from '@vercel/blob';
import { scopedRoot } from '@/lib/blob/env-scope';

// ── 型 ────────────────────────────────────────────────────────────────────────

/** AI が実行したデータ取得。UI で「何を見て答えたか」を開示するために残す */
export interface AiChatToolCall {
  /** ツール名（現状 fetch_page_data のみ） */
  name:    string;
  /** 叩いた内部 API パス */
  path:    string;
  ok:      boolean;
  /** 結果の要約（件数 or エラー文） */
  summary: string;
}

export interface AiChatMessage {
  role:       'user' | 'assistant';
  content:    string;
  createdAt:  string;
  /** assistant のみ。回答生成中に参照したデータ取得元 */
  toolCalls?: AiChatToolCall[];
}

export interface AiChatThread {
  id:        string;
  title:     string;
  /** 起点になった画面の識別子（例: v2-readiness） */
  pageId:    string;
  /** 起点になった画面のパス。履歴から「どの画面の話か」を辿れるようにする */
  pagePath:  string;
  createdAt: string;
  updatedAt: string;
  messages:  AiChatMessage[];
}

/** 一覧表示用。本文を読まずに pathname から復元できる範囲だけ持つ */
export interface AiChatThreadSummary {
  id:           string;
  title:        string;
  pageId:       string;
  pagePath:     string;
  updatedAt:    string;
  messageCount: number;
}

// ── pathname のエンコード / デコード ─────────────────────────────────────────

// 環境（production / preview / ローカル）ごとに分ける。ローカルでの試行が
// 本番の履歴に混ざらないようにするため。cf. src/lib/blob/env-scope.ts
const ROOT = scopedRoot('ai-chat');

/**
 * Blob pathname に安全な文字だけにする（name2 は Roman/nickname 想定だが保険）。
 * user-ai-prefs.ts も同じ鍵で別 prefix に書くので export している。
 */
export function blobUserKey(userUid: string): string { return userKey(userUid); }

function userKey(userUid: string): string {
  const safe = userUid.toLowerCase().replace(/[^a-z0-9._-]+/g, '_').slice(0, 64);
  return safe || 'unknown';
}

function encodeSegment(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeSegment(value: string): string {
  try {
    const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

/** タイトルは pathname に載せるので長さを制限する（Blob pathname 上限 1024 に対する余裕を確保） */
const MAX_TITLE_LEN = 80;

interface ParsedPath {
  threadId: string;
  seq:      number;
  updatedAt: string;
  messageCount: number;
  title:    string;
  pageId:   string;
  pagePath: string;
}

function buildPathname(uKey: string, t: AiChatThread, seq: number): string {
  const meta = encodeSegment(JSON.stringify({
    t: t.title.slice(0, MAX_TITLE_LEN),
    p: t.pageId,
    h: t.pagePath,
  }));
  return [
    ROOT, uKey, t.id,
    `${String(seq).padStart(6, '0')}.${Date.parse(t.updatedAt) || Date.now()}.${t.messages.length}.${meta}.json`,
  ].join('/');
}

function parsePathname(pathname: string, uKey: string): ParsedPath | null {
  const prefix = `${ROOT}/${uKey}/`;
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  const slash = rest.indexOf('/');
  if (slash < 0) return null;
  const threadId = rest.slice(0, slash);
  const file     = rest.slice(slash + 1);
  const m = /^(\d{6})\.(\d+)\.(\d+)\.([A-Za-z0-9_-]*)\.json$/.exec(file);
  if (!m) return null;
  let title = '', pageId = '', pagePath = '';
  try {
    const meta = JSON.parse(decodeSegment(m[4])) as { t?: string; p?: string; h?: string };
    title    = meta.t ?? '';
    pageId   = meta.p ?? '';
    pagePath = meta.h ?? '';
  } catch { /* メタ壊れは無題として扱う */ }
  return {
    threadId,
    seq:          Number(m[1]),
    updatedAt:    new Date(Number(m[2])).toISOString(),
    messageCount: Number(m[3]),
    title,
    pageId,
    pagePath,
  };
}

// ── Blob 有効性 ───────────────────────────────────────────────────────────────

/** Blob が使えるか。未設定時は履歴機能だけ無効にして、チャット自体は動かす */
export function isChatStoreEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

// ── 読み取り ──────────────────────────────────────────────────────────────────

interface Entry { pathname: string; url: string; parsed: ParsedPath }

/** ユーザーの全 blob を列挙し、スレッドごとに最新版だけ返す */
async function latestByThread(uKey: string): Promise<Map<string, Entry>> {
  const latest = new Map<string, Entry>();
  let cursor: string | undefined;

  do {
    const page = await list({ prefix: `${ROOT}/${uKey}/`, limit: 1000, cursor });
    for (const blob of page.blobs) {
      const parsed = parsePathname(blob.pathname, uKey);
      if (!parsed) continue;
      const cur = latest.get(parsed.threadId);
      if (!cur || parsed.seq > cur.parsed.seq) {
        latest.set(parsed.threadId, { pathname: blob.pathname, url: blob.url, parsed });
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return latest;
}

/** スレッド一覧（更新が新しい順）。本文は読まない */
export async function listThreads(userUid: string): Promise<AiChatThreadSummary[]> {
  if (!isChatStoreEnabled()) return [];
  const uKey  = userKey(userUid);
  const latest = await latestByThread(uKey);

  return Array.from(latest.values())
    .map(({ parsed }) => ({
      id:           parsed.threadId,
      title:        parsed.title || '無題のチャット',
      pageId:       parsed.pageId,
      pagePath:     parsed.pagePath,
      updatedAt:    parsed.updatedAt,
      messageCount: parsed.messageCount,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** スレッド本文を取得する。存在しなければ null */
export async function getThread(userUid: string, threadId: string): Promise<AiChatThread | null> {
  if (!isChatStoreEnabled()) return null;
  const uKey = userKey(userUid);

  // 対象スレッドだけを prefix で絞る
  const page = await list({ prefix: `${ROOT}/${uKey}/${threadId}/`, limit: 1000 });
  let best: Entry | null = null;
  for (const blob of page.blobs) {
    const parsed = parsePathname(blob.pathname, uKey);
    if (!parsed || parsed.threadId !== threadId) continue;
    if (!best || parsed.seq > best.parsed.seq) best = { pathname: blob.pathname, url: blob.url, parsed };
  }
  if (!best) return null;

  // pathname は書き込み後に不変なので CDN キャッシュでも内容は正しい
  const res = await fetch(best.url);
  if (!res.ok) return null;
  const body = await res.json() as Partial<AiChatThread>;

  return {
    id:        threadId,
    title:     body.title    ?? best.parsed.title ?? '無題のチャット',
    pageId:    body.pageId   ?? best.parsed.pageId,
    pagePath:  body.pagePath ?? best.parsed.pagePath,
    createdAt: body.createdAt ?? best.parsed.updatedAt,
    updatedAt: body.updatedAt ?? best.parsed.updatedAt,
    messages:  Array.isArray(body.messages) ? body.messages as AiChatMessage[] : [],
  };
}

// ── 書き込み ──────────────────────────────────────────────────────────────────

/**
 * スレッドを保存する。常に新しい seq に書き、古い版は削除する。
 * seq 衝突（同時保存）時は seq を進めて最大3回まで再試行する。
 */
export async function saveThread(userUid: string, thread: AiChatThread): Promise<void> {
  if (!isChatStoreEnabled()) return;
  const uKey = userKey(userUid);

  const existing = await list({ prefix: `${ROOT}/${uKey}/${thread.id}/`, limit: 1000 });
  const olds = existing.blobs.map(b => b.url);
  let seq = existing.blobs.reduce((max, b) => {
    const p = parsePathname(b.pathname, uKey);
    return p && p.seq > max ? p.seq : max;
  }, 0);

  const payload = JSON.stringify(thread);

  for (let attempt = 0; attempt < 3; attempt++) {
    seq += 1;
    try {
      await put(buildPathname(uKey, thread, seq), payload, {
        access:           'public',
        contentType:      'application/json',
        addRandomSuffix:  false,
        cacheControlMaxAge: 60,
      });
      break;
    } catch (err) {
      // 同一 pathname が既にある（= 別リクエストが同 seq を取った）場合だけ再試行
      if (attempt === 2) throw err;
    }
  }

  // 旧版の掃除。失敗しても最大 seq が正なので読み取りには影響しない
  if (olds.length > 0) {
    await del(olds).catch(() => { /* 掃除失敗は無視 */ });
  }
}

/** タイトルを変更する（本文はそのまま新しい版として書き直す） */
export async function renameThread(userUid: string, threadId: string, title: string): Promise<AiChatThread | null> {
  const thread = await getThread(userUid, threadId);
  if (!thread) return null;
  const next = { ...thread, title: title.slice(0, MAX_TITLE_LEN) };
  await saveThread(userUid, next);
  return next;
}

/** スレッドを削除する（全版） */
export async function deleteThread(userUid: string, threadId: string): Promise<void> {
  if (!isChatStoreEnabled()) return;
  const uKey = userKey(userUid);
  const page = await list({ prefix: `${ROOT}/${uKey}/${threadId}/`, limit: 1000 });
  const urls = page.blobs.map(b => b.url);
  if (urls.length > 0) await del(urls);
}

/** そのユーザーの履歴を全削除する */
export async function deleteAllThreads(userUid: string): Promise<number> {
  if (!isChatStoreEnabled()) return 0;
  const uKey = userKey(userUid);
  let deleted = 0;
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: `${ROOT}/${uKey}/`, limit: 1000, cursor });
    const urls = page.blobs.map(b => b.url);
    if (urls.length > 0) {
      await del(urls);
      deleted += urls.length;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return deleted;
}

/**
 * 保持期間を超えたスレッドを削除する。retentionDays <= 0 は無期限（何もしない）。
 * 更新時刻は pathname に埋まっているので、判定のために本文を読む必要はない。
 * 返り値は削除したスレッド数。
 */
export async function pruneOldThreads(userUid: string, retentionDays: number): Promise<number> {
  if (!isChatStoreEnabled() || retentionDays <= 0) return 0;
  const uKey = userKey(userUid);
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  const latest = await latestByThread(uKey);
  const expired = Array.from(latest.values())
    .filter(e => Date.parse(e.parsed.updatedAt) < cutoff)
    .map(e => e.parsed.threadId);

  for (const threadId of expired) {
    await deleteThread(userUid, threadId).catch(() => { /* 個別失敗は無視 */ });
  }
  return expired.length;
}

// ── ID / タイトル生成 ────────────────────────────────────────────────────────

/** スレッド ID。時刻順に並ぶ prefix + ランダムで衝突を避ける */
export function newThreadId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 最初のユーザー発言からタイトルを作る */
export function deriveTitle(firstMessage: string): string {
  const oneLine = firstMessage.replace(/\s+/g, ' ').trim();
  if (!oneLine) return '無題のチャット';
  return oneLine.length > 40 ? `${oneLine.slice(0, 40)}…` : oneLine;
}
