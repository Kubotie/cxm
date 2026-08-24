// ─── パスワードのハッシュ化と検証（サーバーサイド専用）────────────────────────
//
// staff_identify.password_hash に保存する文字列を作る／照合する。
// **平文は保存しない。ログにも出さない。**
//
// Node 標準の scrypt を使う（bcrypt/argon2 のような依存を増やさない）。
// Vercel Functions は Node ランタイムなので crypto がそのまま使える。
//
// 保存形式: scrypt$N$r$p$<salt b64url>$<hash b64url>
//   パラメータを一緒に持たせているので、後でコストを上げても
//   既存ハッシュは読めるまま移行できる。

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * scrypt の Promise 版。promisify だと options 付きのオーバーロードが
 * 型に出てこないので手で包む。
 */
function scryptAsync(
  password: string, salt: Buffer, keylen: number, options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, key) => {
      if (err) reject(err); else resolve(key);
    });
  });
}

/** scrypt のコスト。128 * N * r = 16MB（既定 maxmem 32MB の範囲内） */
const N = 16_384;
const R = 8;
const P = 1;
const KEY_LEN  = 32;
const SALT_LEN = 16;

/** パスワードの最低文字数。共有パスワード運用からの移行なので緩めだが下限は引く */
export const MIN_PASSWORD_LENGTH = 10;

function b64(buf: Buffer): string {
  return buf.toString('base64url');
}

/** パスワードの形式チェック。問題があれば理由（日本語）を返す */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `パスワードは ${MIN_PASSWORD_LENGTH} 文字以上にしてください`;
  }
  if (password.length > 200) return 'パスワードが長すぎます（200 文字以内）';
  if (/^\s|\s$/.test(password)) return 'パスワードの前後に空白を含めないでください';
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await scryptAsync(password, salt, KEY_LEN, { N, r: R, p: P });
  return ['scrypt', N, R, P, b64(salt), b64(key)].join('$');
}

/**
 * 保存済みハッシュと照合する。
 * 形式不正・空は false（例外は投げない = ログイン処理を落とさない）。
 */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const n = Number(parts[1]), r = Number(parts[2]), p = Number(parts[3]);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  try {
    const salt     = Buffer.from(parts[4], 'base64url');
    const expected = Buffer.from(parts[5], 'base64url');
    const actual   = await scryptAsync(password, salt, expected.length, { N: n, r, p });
    // 長さが違うと timingSafeEqual が投げるので先に確認する
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** そのユーザーが個別パスワードを設定済みか */
export function hasPasswordHash(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith('scrypt$');
}
