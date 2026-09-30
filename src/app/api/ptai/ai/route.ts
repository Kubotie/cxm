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

import { NextRequest, NextResponse } from 'next/server';
import { getUserUidFromCookie } from '@/lib/auth/session';
import { getAnthropicClient, getAnthropicModel } from '@/lib/anthropic/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** 原本の limits() 相当。プロンプトの上限と画像枚数（shim 側の LIMITS と揃える）*/
const PGA_LIMITS = { maxPromptBytes: 180_000, images: { maxCount: 8 } };

type Turn = { role: 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  if (!(await getUserUidFromCookie())) {
    return NextResponse.json({ ok: false, code: 'session_expired' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    turns?: Turn[];
    images?: string[];
  };

  const turns  = Array.isArray(body.turns) ? body.turns : [];
  const images = Array.isArray(body.images) ? body.images.slice(0, PGA_LIMITS.images.maxCount) : [];
  if (!turns.length) return NextResponse.json({ ok: false, code: 'invalid_argument' }, { status: 400 });

  const bytes = Buffer.byteLength(JSON.stringify(turns), 'utf8');
  if (bytes > PGA_LIMITS.maxPromptBytes) {
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

  let text: string;
  try {
    const client = getAnthropicClient();
    const res = await client.chat.completions.create({
      model: getAnthropicModel(),
      messages: [
        { role: 'system', content: 'You must reply with a single valid JSON value and nothing else. No markdown fences, no commentary.' },
        ...messages,
      ] as never,
      max_tokens: 8000,
    });
    text = res.choices?.[0]?.message?.content ?? '';
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 429) return NextResponse.json({ ok: false, code: 'rate_limited' }, { status: 429 });
    if (status === 413) return NextResponse.json({ ok: false, code: 'prompt_too_large' }, { status: 413 });
    const msg = e instanceof Error ? e.message : String(e);
    if (/OPENROUTER_API_KEY/.test(msg)) {
      return NextResponse.json({ ok: false, code: 'sampling_disabled', message: msg }, { status: 503 });
    }
    return NextResponse.json({ ok: false, code: 'tool_error', message: msg.slice(0, 200) }, { status: 502 });
  }

  const data = extractJson(text);
  if (data === undefined) return NextResponse.json({ ok: false, code: 'invalid_json' }, { status: 422 });
  return NextResponse.json({ ok: true, data });
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
