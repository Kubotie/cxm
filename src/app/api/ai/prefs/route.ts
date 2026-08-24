// ─── /api/ai/prefs ────────────────────────────────────────────────────────────
//
// GET — ログインユーザーの AI アシスタント設定 + 選べるモデルの候補
// PUT — 設定の保存  Body: { instructions?, retentionDays?, model? }
//
// 設定は Blob にユーザー単位で保存する（src/lib/ai/user-ai-prefs.ts）。
// 他ユーザーの設定には触れない（prefix がユーザー単位で分かれている）。

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth/session';
import {
  loadUserAiPrefs, saveUserAiPrefs, normalizeUserAiPrefs, isUserAiPrefsEnabled,
  resolveModel, MAX_INSTRUCTIONS_LEN, RETENTION_CHOICES,
} from '@/lib/ai/user-ai-prefs';
import { fetchModelChoices, isSelectableModel } from '@/lib/ai/openrouter-models';
import { getAnthropicModel } from '@/lib/anthropic/client';

export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });

  const [prefs, models] = await Promise.all([
    loadUserAiPrefs(profile.name2),
    fetchModelChoices(),
  ]);

  return NextResponse.json({
    prefs,
    /** 実際に使われるモデル（未指定なら環境変数の既定） */
    effectiveModel: resolveModel(prefs),
    defaultModel:   getAnthropicModel(),
    models,
    storageEnabled: isUserAiPrefsEnabled(),
    limits: { maxInstructionsLen: MAX_INSTRUCTIONS_LEN, retentionChoices: RETENTION_CHOICES },
  });
}

export async function PUT(req: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!profile) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 });
  }

  const next = normalizeUserAiPrefs(body);

  // 存在しないモデル ID を保存すると、次の質問が実行時 400 で落ちる。ここで弾く
  if (!await isSelectableModel(next.model)) {
    return NextResponse.json({ error: `選択できないモデルです: ${next.model}` }, { status: 400 });
  }

  if (!isUserAiPrefsEnabled()) {
    return NextResponse.json(
      { error: '設定を保存できません（BLOB_READ_WRITE_TOKEN が未設定）' },
      { status: 503 },
    );
  }

  try {
    const saved = await saveUserAiPrefs(profile.name2, next);
    return NextResponse.json({ prefs: saved, effectiveModel: resolveModel(saved) });
  } catch (err) {
    console.error('[ai/prefs] 保存に失敗', err);
    return NextResponse.json({ error: '設定の保存に失敗しました' }, { status: 500 });
  }
}
