// ─── POST /api/ptai/ai ────────────────────────────────────────────────────────
//
// アーティファクトの `window.claude.use('sample').json(prompt, opts)` の置き換え。
// 既存 CXM と同じ経路（OpenRouter 経由の Claude）を使うので、新しいキーは要らない。
//
// Body: { turns: [{role, content}], images?: [dataUrl], jsonOnly?: boolean }
// 返り: 成功 → { ok:true, data:<パース済み JSON> }
//       失敗 → { ok:false, code:'invalid_json'|'rate_limited'|'prompt_too_large'|... }
//
// 原本は応答が JSON である前提（`json()`）なので、テキストから JSON を取り出して parse する。

import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getUserUidFromCookie } from '@/lib/auth/session';
import { getAnthropicClient, getAnthropicModel } from '@/lib/anthropic/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ─── limits()（§D の判断。2026-10-01）────────────────────────────────────
//
// ═══════════════════════════════════════════════════════════════════════════
//  原本（claude.ai の sample）の `maxPromptBytes` は **65,536（64 KiB）**。
//  **ここでは揃えない。** 理由:
//
//   ・64 KiB はプラットフォーム側の制約で、モデルの能力ではない。
//     `gatherSources` は最大 20,000 字（日本語で約 60 KB）を入れるので、
//     原本では上限ギリギリで動いていた（Utty 仕様 §4-2 の指摘）。
//     そのまま 64 KiB にすると、**いままで通っていた材料が落ちる。**
//
//   ・組織図は board.js 側が `min(60000, maxPromptBytes − 3000)` で縮める。
//     原本     min(60000, 62536) = 60000
//     こちら   min(60000, 177000) = 60000
//     **どちらも 60,000 バイトで同じ。** 上限を上げても組織図は変わらない。
//     board.js の 60000 は定数なので、これ以上は広げられない。
//
//   ・残り 4 機能はサイズを測っていないので、ここの値が唯一の関門になる。
//     緩くした結果として、原本なら `prompt_too_large` だった入力が通る。
//
//  値はモデルのコンテキスト長から決める。既定の anthropic/claude-sonnet-4-5 は
//  20 万トークン。日本語は 1 字 ≒ 1 トークン・UTF-8 で 3 バイトなので、
//  180,000 バイト ≒ 6 万字 ≒ 6 万トークン。出力と thinking を引いても十分収まる。
//  小さいモデルに替えるときは `PTAI_AI_MAX_PROMPT_BYTES` で下げること。
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_MAX_PROMPT_BYTES = 180_000;

function maxPromptBytes(): number {
  const v = Number(process.env.PTAI_AI_MAX_PROMPT_BYTES);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_MAX_PROMPT_BYTES;
}

/** 原本の limits() 相当。**shim はこれを GET で取りに来る**（値を二重に持たない）*/
function ptaiLimits() {
  return { maxPromptBytes: maxPromptBytes(), images: { maxCount: 8 } };
}

/** GET /api/ptai/ai — limits() の実体 */
export async function GET() {
  if (!(await getUserUidFromCookie())) {
    return NextResponse.json({ ok: false, code: 'session_expired' }, { status: 401 });
  }
  return NextResponse.json(ptaiLimits(), { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * ⚠ **原本（claude.ai の sample）の実値は未確認。** これは移植側の決め打ち。
 *    組織図は 1 社で数十ノード返るので 8,000 では切れることがある。
 *    実値が分かったら合わせる（docs/ptai-ai-capability-request.md 1-1）。
 */
const MAX_TOKENS = 16_000;

// ─── キャッシュ（§E。2026-10-01）──────────────────────────────────────────
//
// ═══════════════════════════════════════════════════════════════════════════
//  原本は **既定でオン・5 分**（Utty 仕様 1-5）。鍵は
//  閲覧者 × アーティファクト ×（input・modelTier・images・呼び方）で、
//  `cache:false` を渡したときだけ毎回 Claude に聞く。
//
//  board.js の使い分け:
//    組織図・計画相談・サクセスのプラン生成 … `cache:false`（毎回）
//    直近の動き                           … 指定なし ＝ **既定の 5 分**
//
//  ここを実装していないと、直近の動きだけ毎回 OpenRouter を叩くことになる。
//  （原本では無料で返っていた呼び出しが、そのまま費用になる）
//
//  ⚠ プロセス内のメモリに置くだけ。Vercel ではインスタンスが分かれると
//     当たらないし、再起動で消える。**当たればお得、外れても正しい**という
//     性質のものなので、それでよい。永続化はしない（応答に顧客データが入る）。
//
//  鍵には **利用者 ID を必ず混ぜる**。混ぜないと他人の結果が返る。
// ═══════════════════════════════════════════════════════════════════════════

const CACHE_TTL_MS  = 5 * 60_000;
const CACHE_MAX     = 50;
const cache = new Map<string, { at: number; data: unknown; text: string }>();

function cacheKey(uid: string, turns: Turn[], images: string[]): string {
  const h = createHash('sha256');
  h.update(uid).update('\u0000').update(getAnthropicModel()).update('\u0000');
  h.update(JSON.stringify(turns)).update('\u0000').update(JSON.stringify(images));
  return h.digest('base64url');
}

function cacheGet(key: string): { data: unknown; text: string } | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) { cache.delete(key); return null; }
  return { data: hit.data, text: hit.text };
}

function cachePut(key: string, data: unknown, text: string): void {
  // 失敗した回答は入れない（原本と同じ）
  if (data === undefined) return;
  if (cache.size >= CACHE_MAX) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { at: Date.now(), data, text });
}

const SYSTEM_JSON_ONLY =
  'You must reply with a single valid JSON value and nothing else. No markdown fences, no commentary.';

// ─── Extended thinking（2026-10-01 の決定）────────────────────────────────
//
// ═══════════════════════════════════════════════════════════════════════════
//  原本の `modelTier:'default'` は **書き始める前に考える**（Utty 仕様 1-1）。
//  board.js は 5 機能すべて default なので、**全部に thinking を効かせる**のが
//  原本どおり。切ると、組織図とアカウントプランの構造が目に見えて落ちる。
//
//  ・`onText` は考えている間は呼ばれない（原本 1-4）。ここでも `delta.content`
//    だけを流し、`delta.reasoning` は流さない。**思考内容は画面にも JSON にも出さない。**
//  ・Anthropic は `max_tokens` に思考ぶんも含める。出力ぶんを削らないよう
//    budget を足した値を渡す。
//  ・thinking を解さないモデルに送ると 400 になるので、Claude のときだけ付ける。
//  ・`PTAI_AI_THINKING_BUDGET=0` で切れる（切り分け用）。
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_THINKING_BUDGET = 8_000;

function thinkingBudget(): number {
  const raw = process.env.PTAI_AI_THINKING_BUDGET;
  const v = raw === undefined ? DEFAULT_THINKING_BUDGET : Number(raw);
  if (!Number.isFinite(v) || v <= 0) return 0;
  if (!/claude/i.test(getAnthropicModel())) return 0;
  return Math.floor(v);
}

/** chat.completions.create に渡す共通部分。thinking の有無で max_tokens が変わる */
function baseParams(messages: unknown[]): Record<string, unknown> {
  const budget = thinkingBudget();
  return {
    model: getAnthropicModel(),
    messages: [{ role: 'system', content: SYSTEM_JSON_ONLY }, ...messages],
    max_tokens: MAX_TOKENS + budget,
    ...(budget ? { thinking: { type: 'enabled', budget_tokens: budget } } : {}),
  };
}

type Turn = { role: 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  const uid = await getUserUidFromCookie();
  if (!uid) {
    return NextResponse.json({ ok: false, code: 'session_expired' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    turns?: Turn[];
    images?: string[];
    stream?: boolean;
    /** false なら毎回問い合わせる。省略時は 5 分だけ使い回す（原本と同じ既定） */
    cache?: boolean;
  };

  const limits = ptaiLimits();
  const turns  = Array.isArray(body.turns) ? body.turns : [];
  const images = Array.isArray(body.images) ? body.images.slice(0, limits.images.maxCount) : [];
  if (!turns.length) return NextResponse.json({ ok: false, code: 'invalid_request' }, { status: 400 });

  const bytes = Buffer.byteLength(JSON.stringify(turns), 'utf8');
  if (bytes > limits.maxPromptBytes) {
    return NextResponse.json({ ok: false, code: 'prompt_too_large' }, { status: 413 });
  }

  // 画像は最後の user ターンに添付する（原本の images オプションと同じ扱い）
  const messages = turns.map((t, i) => {
    const isLastUser = t.role === 'user' && i === lastUserIndex(turns);
    if (!isLastUser || !images.length) return { role: t.role, content: t.content };
    return {
      role: t.role,
      content: [
        ...images.map(url => ({ type: 'image_url' as const, image_url: { url } })),
        { type: 'text' as const, text: t.content },
      ],
    };
  });

  // ── ストリーミング（原本の opts.onText 相当）────────────────────────────
  //   原本は生成中にテキストが流れてきて、画面が「案をまとめています…」に変わる。
  //   board.js は onText の**引数を使わず、呼ばれたことだけ**を見ているので、
  //   欠片を流すだけで原本と同じ見た目になる。
  //
  //   形式は NDJSON（1 行 1 イベント）。
  //     {"t":"delta","v":"…"}            生成中のテキスト
  //     {"t":"done","data":<JSON>}       パース済みの最終結果
  //     {"t":"error","code":"…"}         失敗
  //   **JSON の取り出しはサーバー側に 1 つだけ置く**（shim に複製しない）。
  // 原本と同じく、キャッシュから返すときも onText は **全文で 1 回だけ**呼ぶ
  const useCache = body.cache !== false;
  const key = useCache ? cacheKey(String(uid), turns, images) : '';
  if (useCache) {
    const hit = cacheGet(key);
    if (hit) {
      return body.stream
        ? cachedStream(hit.text, hit.data)
        : NextResponse.json({ ok: true, data: hit.data, cached: true });
    }
  }

  if (body.stream) {
    return streamResponse(messages, req.signal, useCache ? key : null);
  }

  let text: string;
  try {
    const client = getAnthropicClient();
    const res = await client.chat.completions.create(
      baseParams(messages) as never, { signal: req.signal });
    text = res.choices?.[0]?.message?.content ?? '';
  } catch (e) {
    const code = codeOf(e);
    const status = code === 'cancelled' ? 499
      : code === 'rate_limited' ? 429
      : code === 'prompt_too_large' ? 413
      : code === 'sampling_disabled' ? 503 : 502;
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, code, message: msg.slice(0, 200) }, { status });
  }

  const data = extractJson(text);
  if (data === undefined) return NextResponse.json({ ok: false, code: 'invalid_json' }, { status: 422 });
  if (useCache) cachePut(key, data, text);
  return NextResponse.json({ ok: true, data });
}

/** キャッシュから返すときのストリーム。原本に合わせて delta は 1 回だけ */
function cachedStream(text: string, data: unknown): Response {
  const enc = new TextEncoder();
  const line = (o: unknown) => enc.encode(JSON.stringify(o) + '\n');
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (text) controller.enqueue(line({ t: 'delta', v: text }));
      controller.enqueue(line({ t: 'done', data }));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * OpenRouter の delta を NDJSON で中継し、最後にパース済み JSON を 1 行返す。
 *
 * `signal` は**リクエストが切れたことを上流まで伝える**ためのもの。
 * 原本（claude.ai の sample）は中断すると生成も止まり、閲覧者の利用量がそれ以上
 * かからない（Utty 仕様 1-4）。渡さないと、画面で「取消」を押しても
 * OpenRouter 側は最後まで書き続けて**課金だけ残る**。
 */
function streamResponse(messages: unknown[], signal: AbortSignal | undefined, cacheAs: string | null): Response {
  const enc = new TextEncoder();
  const line = (o: unknown) => enc.encode(JSON.stringify(o) + '\n');

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = '';
      try {
        const client = getAnthropicClient();
        const res = await client.chat.completions.create(
          { ...baseParams(messages), stream: true } as never, { signal });
        // **reasoning は読まない。** 思考中は onText を呼ばないのが原本の挙動
        for await (const chunk of res as unknown as AsyncIterable<{ choices?: Array<{ delta?: { content?: string } }> }>) {
          const v = chunk.choices?.[0]?.delta?.content;
          if (!v) continue;
          text += v;
          controller.enqueue(line({ t: 'delta', v }));
        }
      } catch (e) {
        if (signal?.aborted || (e as { name?: string })?.name === 'AbortError') {
          // 画面側はもう待っていない。黙って閉じる
          controller.close();
          return;
        }
        controller.enqueue(line({ t: 'error', code: codeOf(e) }));
        controller.close();
        return;
      }

      const data = extractJson(text);
      if (cacheAs) cachePut(cacheAs, data, text);
      controller.enqueue(data === undefined ? line({ t: 'error', code: 'invalid_json' }) : line({ t: 'done', data }));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      // プロキシが溜め込むと onText が最後まで呼ばれない
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * 失敗を原本のエラーコードに寄せる（Utty 仕様 1-7 の 19 コード）。
 * board.js が握っていないコードは各機能の既定の文言に落ちるので、
 * **近いコードを作らず、原本にある名前をそのまま使う**。
 * `upstream_error` が「一時的な障害」の唯一の種別。
 */
function codeOf(e: unknown): string {
  const status = (e as { status?: number })?.status;
  const name = (e as { name?: string })?.name;
  const msg = e instanceof Error ? e.message : String(e);
  if (name === 'AbortError') return 'cancelled';
  if (/OPENROUTER_API_KEY/.test(msg)) return 'sampling_disabled';
  if (status === 429) return 'rate_limited';
  if (status === 413) return 'prompt_too_large';
  if (status === 400) return 'invalid_request';
  if (status && status >= 500) return 'upstream_error';
  return 'upstream_error';
}

function lastUserIndex(turns: Turn[]): number {
  for (let i = turns.length - 1; i >= 0; i--) if (turns[i].role === 'user') return i;
  return -1;
}

/**
 * 応答テキストから JSON を取り出す。
 * ```json フェンス → 素の JSON → 最初の { … } / [ … ] の順に試す。
 */
function extractJson(text: string): unknown {
  const s = String(text || '').trim();
  if (!s) return undefined;

  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fence?.[1], s].filter(Boolean) as string[];

  for (const c of candidates) {
    try { return JSON.parse(c.trim()); } catch { /* 次を試す */ }
  }
  // 先頭の { か [ から末尾の対応する括弧までを切り出す
  for (const [open, close] of [['{', '}'], ['[', ']']] as const) {
    const i = s.indexOf(open), j = s.lastIndexOf(close);
    if (i >= 0 && j > i) {
      try { return JSON.parse(s.slice(i, j + 1)); } catch { /* 次を試す */ }
    }
  }
  return undefined;
}
