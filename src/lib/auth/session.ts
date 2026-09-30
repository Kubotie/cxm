// ─── Cookie ベースセッション管理 ──────────────────────────────────────────────
//
// Cookie `cxm_session` に **HMAC 署名付きトークン**（src/lib/auth/session-token.ts）を入れる。
// 中身は name2（staff_identify のユーザー識別子）と発行・失効時刻だけ。
//
// ── 旧実装からの変更（2026-09-30 セキュリティ是正）─────────────────────────
//   旧: `cxm_user_uid` に name2 を平文で保存 → Cookie を自分で送るだけでなりすませた
//   新: 署名付きトークン。改ざん・期限切れ・鍵未設定はすべて未認証として扱う
//   旧: `cxm_user_role` にロールを保存 → 自己申告値で認可していた
//   新: **ロール Cookie は廃止**。認可時のロールは必ず staff_identify から引く
//
//   旧 Cookie は読まない。ログイン・ログアウト時に明示的に削除する。
//
// サーバー側: cookies() from 'next/headers'
// Cookie は HttpOnly なのでクライアント JS からは読めない。
//   → ユーザー名表示には GET /api/user/profile を使うこと。

import { cookies } from 'next/headers';
import { fetchUserProfileByName2 } from '@/lib/nocodb/user-profile';
import type { AppUserProfile } from '@/lib/nocodb/user-profile';
import { signSession, verifySession, SESSION_TTL_SECONDS } from '@/lib/auth/session-token';

/** 署名付きセッション Cookie */
export const SESSION_COOKIE_NAME = 'cxm_session';

/** 旧実装の平文 Cookie。読まないが、ログイン・ログアウトで消す */
export const LEGACY_COOKIE_NAMES = ['cxm_user_uid', 'cxm_user_role'] as const;

/** 後方互換のための別名（middleware など既存の import 先が参照している） */
export const COOKIE_NAME = SESSION_COOKIE_NAME;

const COOKIE_MAX_AGE = SESSION_TTL_SECONDS;

/** production だけ Secure を付ける（localhost の http では Cookie が落ちるため） */
function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

// ── サーバーサイド読み取り ──────────────────────────────────────────────────

/**
 * Cookie から検証済みの name2 を取得する（サーバー用）。
 * 署名不正・期限切れ・鍵未設定・旧形式の平文 Cookie はすべて null。
 */
export async function getUserUidFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const result = await verifySession(raw);
    return result.ok ? result.payload.u : null;
  } catch {
    return null;
  }
}

/**
 * Cookie から現在のユーザープロファイルを取得する（サーバー用）。
 * セッションが無効、または対応するレコードが無い場合は null。
 */
export async function getCurrentUserProfile(): Promise<AppUserProfile | null> {
  const name2 = await getUserUidFromCookie();
  if (!name2) return null;
  return fetchUserProfileByName2(name2);
}

// ── Cookie ヘッダー文字列構築 ────────────────────────────────────────────────

function cookieAttrs(maxAge: number): string[] {
  return [
    'Path=/',
    `Max-Age=${maxAge}`,
    `Expires=${new Date(Date.now() + maxAge * 1000).toUTCString()}`,
    'SameSite=Lax',
    'HttpOnly',
    ...(isProduction() ? ['Secure'] : []),
  ];
}

/**
 * ログイン成功時の Set-Cookie 値を返す。
 * 秘密鍵が未設定なら null（呼び出し側は 503 にすること）。
 */
export async function buildSessionCookieHeader(name2: string): Promise<string | null> {
  const token = await signSession(name2, COOKIE_MAX_AGE);
  if (!token) return null;
  return [`${SESSION_COOKIE_NAME}=${token}`, ...cookieAttrs(COOKIE_MAX_AGE)].join('; ');
}

/** セッション Cookie を削除する Set-Cookie 値 */
export function buildClearSessionCookieHeader(): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'SameSite=Lax',
    'HttpOnly',
    ...(isProduction() ? ['Secure'] : []),
  ].join('; ');
}

/**
 * 旧平文 Cookie を削除する Set-Cookie 値の配列。
 * 是正前に発行された Cookie がブラウザに残っているので、
 * ログイン・ログアウトのたびに確実に消す。
 */
export function buildClearLegacyCookieHeaders(): string[] {
  return LEGACY_COOKIE_NAMES.map(name =>
    [
      `${name}=`,
      'Path=/',
      'Max-Age=0',
      'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
      'SameSite=Lax',
      'HttpOnly',
    ].join('; '),
  );
}
