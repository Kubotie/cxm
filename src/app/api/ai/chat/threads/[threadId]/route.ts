// ─── /api/ai/chat/threads/[threadId] ──────────────────────────────────────────
//
// GET    — スレッド1件（本文込み）。履歴からの再開に使う
// PATCH  — タイトル変更  Body: { title: string }
// DELETE — スレッド削除
//
// 保存先はユーザー単位の prefix なので、他人のスレッド ID を指定しても 404 になる。

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';
import { getThread, renameThread, deleteThread, isChatStoreEnabled } from '@/lib/ai/chat-store';

type Ctx = { params: Promise<{ threadId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });
  if (!isChatStoreEnabled()) return NextResponse.json({ error: '履歴ストアが無効です' }, { status: 503 });

  const { threadId } = await params;
  try {
    const thread = await getThread(profile.name2, threadId);
    if (!thread) return NextResponse.json({ error: 'スレッドが見つかりません' }, { status: 404 });
    return NextResponse.json(thread);
  } catch (err) {
    console.error('[ai/chat/threads/:id] 取得に失敗', err);
    return NextResponse.json({ error: 'スレッドの取得に失敗しました' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });

  const { threadId } = await params;
  const body = await req.json().catch(() => ({})) as { title?: string };
  const title = (body.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'title が空です' }, { status: 400 });

  try {
    const updated = await renameThread(profile.name2, threadId, title);
    if (!updated) return NextResponse.json({ error: 'スレッドが見つかりません' }, { status: 404 });
    return NextResponse.json({ ok: true, title: updated.title });
  } catch (err) {
    console.error('[ai/chat/threads/:id] 改名に失敗', err);
    return NextResponse.json({ error: 'タイトルの変更に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });

  const { threadId } = await params;
  try {
    await deleteThread(profile.name2, threadId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[ai/chat/threads/:id] 削除に失敗', err);
    return NextResponse.json({ error: 'スレッドの削除に失敗しました' }, { status: 500 });
  }
}
