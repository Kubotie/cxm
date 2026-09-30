// ─── /api/user/password ───────────────────────────────────────────────────────
//
// GET — 自分が個別パスワードを設定済みかどうかだけを返す（ハッシュは返さない）
// PUT — パスワードを変更する  Body: { currentPassword: string, newPassword: string }
//
// 変更できるのは **ログイン中の本人だけ**。他ユーザーの行は触らない
// （対象行は Cookie の name2 から引く。リクエストで対象を指定させない）。
//
// currentPassword の扱い:
//   - 個別パスワード設定済み → 現在の個別パスワードと照合
//   - 未設定（初回設定）      → 共有パスワード（環境変数 APP_PASSWORD）と照合
//
// パスワードはハッシュ化してから保存する。平文は保存もログ出力もしない。
//
// ── 2026-09-30 セキュリティ是正 ──────────────────────────────────────────────
//   ソース直書きの共有パスワード既定値を撤去した。
//   APP_PASSWORD が未設定のときは初回設定の経路を成立させず 503 を返す
//   （個別パスワード設定済みのユーザーの変更は、APP_PASSWORD 無しでも従来どおり可能）。

import { NextRequest, NextResponse } from 'next/server';
import { getUserUidFromCookie } from '@/lib/auth/session';
import { fetchCredentialByName2, updatePasswordHash } from '@/lib/nocodb/user-profile';
import {
  hashPassword, verifyPassword, hasPasswordHash, validatePassword,
} from '@/lib/auth/password';

/** 共有パスワード。既定値は持たない（public リポジトリに秘密を置かないため） */
function sharedPassword(): string | null {
  return process.env.APP_PASSWORD || null;
}

/** 設定不備。秘密値は含めない */
function misconfigured() {
  console.error('[user/password] 設定不備: APP_PASSWORD が未設定のため初回設定を受け付けられません');
  return NextResponse.json(
    { error: 'service_unavailable', message: 'パスワードの初回設定を受け付けられません。管理者に連絡してください。' },
    { status: 503 },
  );
}

export async function GET() {
  const name2 = await getUserUidFromCookie();
  if (!name2) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });

  const cred = await fetchCredentialByName2(name2).catch(() => null);
  if (!cred) return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });

  return NextResponse.json({ hasPassword: hasPasswordHash(cred.passwordHash) });
}

export async function PUT(req: NextRequest) {
  const name2 = await getUserUidFromCookie();
  if (!name2) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });

  const body = await req.json().catch(() => null) as
    { currentPassword?: unknown; newPassword?: unknown } | null;
  if (!body) return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 });

  const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const next    = typeof body.newPassword     === 'string' ? body.newPassword     : '';

  const invalid = validatePassword(next);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const cred = await fetchCredentialByName2(name2).catch(() => null);
  if (!cred) return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });

  // 本人確認
  const alreadySet = hasPasswordHash(cred.passwordHash);
  const shared = sharedPassword();
  if (!alreadySet && !shared) return misconfigured();

  const verified = alreadySet
    ? await verifyPassword(current, cred.passwordHash)
    : current === shared;

  if (!verified) {
    return NextResponse.json(
      { error: alreadySet ? '現在のパスワードが違います' : '共有パスワードが違います' },
      { status: 401 },
    );
  }

  if (next === current) {
    return NextResponse.json({ error: '現在と同じパスワードです' }, { status: 400 });
  }
  // 共有パスワードのままにされると個別化の意味がない
  if (shared && next === shared) {
    return NextResponse.json({ error: '共有パスワードと同じものは使えません' }, { status: 400 });
  }

  try {
    await updatePasswordHash(cred.rowId, await hashPassword(next));
  } catch (err) {
    console.error('[user/password] 保存に失敗', err);
    return NextResponse.json({ error: 'パスワードの保存に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, hasPassword: true });
}
