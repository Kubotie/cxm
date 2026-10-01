// ─── PtAI Pipeline: 秘密値の暗号化（サーバー専用）──────────────────────────
//
// ═══════════════════════════════════════════════════════════════════════════
//  **NocoDB に秘密値を平文で置かない。**
//
//  NocoDB のトークン（`NOCODB_API_TOKEN`）は CXM と共用で、テーブル単位に
//  絞れていない。そのトークンを持つ人は全テーブルを読めるので、
//  平文で置くと「DB を読める ＝ Twenty を壊せる」になってしまう。
//
//  暗号鍵は **環境変数にだけ**置く（`PTAI_SECRET_KEY`）。
//  こうすると DB が漏れても鍵が無ければ復号できない。
// ═══════════════════════════════════════════════════════════════════════════
//
// 形式: `v1.<iv>.<authTag>.<ciphertext>`（いずれも base64url）
// 方式: AES-256-GCM。改ざんされていれば復号時に例外になる。

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;          // GCM の推奨
const MIN_KEY_LENGTH = 32;

export class SecretError extends Error {
  readonly kind: 'no_key' | 'bad_key' | 'malformed' | 'tampered';
  constructor(kind: SecretError['kind'], message: string) {
    super(message);
    this.name = 'SecretError';
    this.kind = kind;
  }
}

/**
 * 暗号鍵。32 バイト以上のランダム文字列を環境変数に入れる。
 * **鍵そのものをログ・応答に出さないこと。**
 */
function keyMaterial(): Buffer {
  const raw = (process.env.PTAI_SECRET_KEY || '').trim();
  if (!raw) {
    throw new SecretError('no_key',
      'PTAI_SECRET_KEY が未設定です。32 バイト以上のランダム値を設定してください');
  }
  if (raw.length < MIN_KEY_LENGTH) {
    throw new SecretError('bad_key',
      `PTAI_SECRET_KEY が短すぎます（${MIN_KEY_LENGTH} 文字以上）`);
  }
  // 長さをそろえるためにハッシュを噛ませる。鍵の強度は元の値に依存する
  return createHash('sha256').update(raw).digest();
}

export function isSecretKeyConfigured(): boolean {
  try { keyMaterial(); return true; } catch { return false; }
}

const b64 = (b: Buffer): string => b.toString('base64url');
const unb64 = (s: string): Buffer => Buffer.from(s, 'base64url');

/** 平文 → `v1.<iv>.<tag>.<ct>` */
export function encryptSecret(plain: string): string {
  const key = keyMaterial();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, b64(iv), b64(cipher.getAuthTag()), b64(ct)].join('.');
}

/** `v1.<iv>.<tag>.<ct>` → 平文。改ざんされていれば例外 */
export function decryptSecret(packed: string): string {
  const parts = String(packed ?? '').split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new SecretError('malformed', '暗号文の形式が違います');
  }
  const key = keyMaterial();
  try {
    const decipher = createDecipheriv(ALGO, key, unb64(parts[1]));
    decipher.setAuthTag(unb64(parts[2]));
    return Buffer.concat([decipher.update(unb64(parts[3])), decipher.final()]).toString('utf8');
  } catch {
    // 鍵違い・改ざんのどちらかは区別しない（区別すると当てる手がかりになる）
    throw new SecretError('tampered', '復号できませんでした。鍵が違うか、値が壊れています');
  }
}

/**
 * 画面に出す印。
 *
 * ⚠ **キーから作った値を一切出さない。** 末尾数文字も、長さも出さない。
 *    「ログ・画面・テスト結果・ドキュメントへ出力しない。長さ・先頭・末尾も出さない」
 *    という運用に合わせている。どのキーが入っているかは、
 *    更新者・更新日時と、同じ画面の疎通確認の結果で判断する。
 */
export function secretHint(_plain: string): string {
  return '設定済み';
}
