// ─── Cookie ベースセッション管理 ──────────────────────────────────────────────
//
// Cookie `cxm_user_uid` に staff_identify.name2 を保存する。
// 本格認証（SSO / NextAuth 等）導入時はここだけ差し替える。
//
// サーバー側: cookies() from 'next/headers'
// Cookie は HttpOnly で設定するため、クライアント JS からは読めない。
//   → ユーザー名表示には GET /api/user/profile を使うこと。

import { cookies } from 'next/headers';
import { fetchUserProfileByName2 } from '@/lib/nocodb/user-profile';
import type { AppUserProfile } from '@/lib/nocodb/user-profile';

export const COOKIE_NAME      = 'cxm_user_uid';
export const ROLE_COOKIE_NAME = 'cxm_user_role';
const COOKIE_MAX_AGE          = 60 * 60 * 24 * 30; // 30日

// ── サーバーサイド読み取り ──────────────────────────────────────────────────

/**
 * Cookie から name2（ユーザー識別子）を取得する（サーバー用）。
 */
export async function getUserUidFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(COOKIE_NAME)?.value;
    return raw ? decodeURIComponent(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Cookie から現在のユーザープロファイルを取得する（サーバー用）。
 * Cookie 未設定または対応するレコードが見つからない場合は null を返す。
 */
export async function getCurrentUserProfile(): Promise<AppUserProfile | null> {
  const name2 = await getUserUidFromCookie();
  if (!name2) return null;
  return fetchUserProfileByName2(name2);
}

// ── ロールクッキー読み取り ────────────────────────────────────────────────────

/**
 * Cookie からロールを取得する（サーバー用）。
 * Cookie 未設定の場合は null を返す。
 */
export async function getUserRoleFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(ROLE_COOKIE_NAME)?.value;
    return raw ? decodeURIComponent(raw) : null;
  } catch {
    return null;
  }
}

// ── Cookie ヘッダー文字列構築 ────────────────────────────────────────────────

/**
 * ユーザーを設定する Set-Cookie ヘッダー値を返す。
 * API Route の Response ヘッダーにセットして使う。
 */
export function buildSetCookieHeader(name2: string): string {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(name2)}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE}`,
    'SameSite=Lax',
    'HttpOnly',
  ].join('; ');
}

/**
 * ロールを設定する Set-Cookie ヘッダー値を返す。
 */
export function buildSetRoleCookieHeader(role: string): string {
  return [
    `${ROLE_COOKIE_NAME}=${encodeURIComponent(role)}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE}`,
    'SameSite=Lax',
    'HttpOnly',
  ].join('; ');
}

/**
 * Cookie を削除する Set-Cookie ヘッダー値を返す。
 */
export function buildClearCookieHeader(): string {
  return [
    `${COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
    'HttpOnly',
  ].join('; ');
}

/**
 * ロール Cookie を削除する Set-Cookie ヘッダー値を返す。
 */
export function buildClearRoleCookieHeader(): string {
  return [
    `${ROLE_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
    'HttpOnly',
  ].join('; ');
}
