// ─── /api/ai/chat/threads ─────────────────────────────────────────────────────
//
// GET    — ログインユーザーのチャット履歴一覧（更新が新しい順）
//          クエリ pageId=... でその画面から始めたスレッドだけに絞れる
// DELETE — ログインユーザーの履歴を全削除
//
// 他ユーザーの履歴には触れない（保存先の prefix がユーザー単位で分かれている）。

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';
import { listThreads, deleteAllThreads, pruneOldThreads, isChatStoreEnabled } from '@/lib/ai/chat-store';
import { loadUserAiPrefs } from '@/lib/ai/user-ai-prefs';

export async function GET(req: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });

  if (!isChatStoreEnabled()) {
    return NextResponse.json({ threads: [], storageEnabled: false });
  }

  const pageId = req.nextUrl.searchParams.get('pageId');
  try {
    // 保持期間の期限切れをここで掃除する。cron を増やさず、一覧を開いた
    // タイミングで回収する（履歴を見る人＝そのユーザー本人しかいない）。
    // 失敗しても一覧表示は続ける
    const prefs = await loadUserAiPrefs(profile.name2).catch(() => null);
    if (prefs && prefs.retentionDays > 0) {
      const pruned = await pruneOldThreads(profile.name2, prefs.retentionDays).catch(() => 0);
      if (pruned > 0) console.log(`[ai/chat/threads] 保持期間超過で ${pruned} 件削除`);
    }

    const all = await listThreads(profile.name2);
    const threads = pageId ? all.filter(t => t.pageId === pageId) : all;
    return NextResponse.json({ threads, storageEnabled: true });
  } catch (err) {
    console.error('[ai/chat/threads] 一覧取得に失敗', err);
    return NextResponse.json({ error: '履歴の取得に失敗しました' }, { status: 500 });
  }
}

export async function DELETE() {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });

  try {
    const deleted = await deleteAllThreads(profile.name2);
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    console.error('[ai/chat/threads] 全削除に失敗', err);
    return NextResponse.json({ error: '履歴の削除に失敗しました' }, { status: 500 });
  }
}
