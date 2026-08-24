// ─── POST /api/ai/chat ────────────────────────────────────────────────────────
//
// 画面内 AI アシスタントの本体。SSE でストリーム返却する。
//
// Body:
//   { threadId?: string, message: string, context: AiChatRequestContext }
//
// SSE イベント（data: JSON）:
//   { type: 'thread',   threadId, title }   スレッド確定（新規時はここで採番）
//   { type: 'thinking', delta }             思考の途中出力
//   { type: 'text',     delta }             回答本文
//   { type: 'tool',     path, status }      データ深掘りの実行状況
//   { type: 'done',     message }           保存された assistant メッセージ
//   { type: 'error',    message }
//
// 認証: 既存の Cookie セッション（cxm_user_uid）。未ログインは 401。

import { NextRequest } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';
import { runChatAgent, type AgentEvent } from '@/lib/ai/chat-agent';
import {
  getThread, saveThread, newThreadId, deriveTitle, isChatStoreEnabled,
  type AiChatThread, type AiChatMessage,
} from '@/lib/ai/chat-store';
import { loadUserAiPrefs } from '@/lib/ai/user-ai-prefs';
import type { AiChatRequestContext } from '@/lib/ai/page-context';

// ツール往復を含むため、既定より長めの実行時間を確保する
export const maxDuration = 300;

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return new Response(JSON.stringify({ error: 'ログインが必要です' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { threadId?: string; message?: string; context?: AiChatRequestContext };
  try {
    body = await req.json() as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'リクエストボディが不正です' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const userMessage = (body.message ?? '').trim();
  if (!userMessage) {
    return new Response(JSON.stringify({ error: 'message が空です' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const context: AiChatRequestContext = body.context ?? {
    pageId: 'unknown', title: '不明な画面', description: '', pathname: '/', sources: [],
  };

  const origin = req.nextUrl.origin;
  const cookie = req.headers.get('cookie') ?? '';
  const userUid = profile.name2;
  const userLabel = `${profile.name ?? profile.name2}（${profile.role}）`;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const emit = (event: AgentEvent | Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sse(event)));
        } catch {
          closed = true;
        }
      };

      try {
        // ── スレッドの解決 ──────────────────────────────────────────────────
        let thread: AiChatThread | null = null;
        if (body.threadId) {
          thread = await getThread(userUid, body.threadId).catch(() => null);
        }
        if (!thread) {
          const now = new Date().toISOString();
          thread = {
            id:        body.threadId ?? newThreadId(),
            title:     deriveTitle(userMessage),
            pageId:    context.pageId,
            pagePath:  context.pathname,
            createdAt: now,
            updatedAt: now,
            messages:  [],
          };
        }
        emit({ type: 'thread', threadId: thread.id, title: thread.title });

        // ── ユーザー発言を積む ──────────────────────────────────────────────
        const userMsg: AiChatMessage = {
          role: 'user', content: userMessage, createdAt: new Date().toISOString(),
        };
        thread.messages.push(userMsg);

        // ── 利用者設定（回答スタイル / モデル）────────────────────────────
        // 取得失敗はチャット自体を止めない。既定設定として続行する
        const prefs = await loadUserAiPrefs(userUid).catch(() => null);

        // ── 生成 ────────────────────────────────────────────────────────────
        const assistantMsg = await runChatAgent({
          messages: thread.messages,
          context,
          userLabel,
          origin,
          cookie,
          emit,
          signal: req.signal,
          prefs,
        });

        thread.messages.push(assistantMsg);
        thread.updatedAt = new Date().toISOString();

        // ── 保存（Blob 未設定でも会話自体は成立させる）────────────────────
        if (isChatStoreEnabled()) {
          try {
            await saveThread(userUid, thread);
          } catch (err) {
            console.error('[ai/chat] 履歴保存に失敗', err);
            emit({ type: 'warn', message: '回答は生成できましたが履歴の保存に失敗しました。' });
          }
        }

        emit({ type: 'done', message: assistantMsg });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[ai/chat] 生成に失敗', err);
        emit({ type: 'error', message: msg });
      } finally {
        closed = true;
        try { controller.close(); } catch { /* すでに閉じている */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream; charset=utf-8',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
