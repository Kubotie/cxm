// ─── 署名付きセッショントークン ───────────────────────────────────────────────
//
// 旧実装は Cookie に name2 を平文で入れていたため、`cxm_user_uid=Utty` を自分で
// 送るだけで任意ユーザーになりすませた。ここで HMAC-SHA256 の署名を付け、
// 改ざん・期限切れを検知できるようにする。
//
// ── Edge Middleware 互換 ─────────────────────────────────────────────────────
//   middleware は Edge ランタイムで動くので node:crypto は使えない。
//   Web Crypto（`crypto.subtle`）と TextEncoder / atob / btoa だけで組む。
//   これらは Edge・Node 18+・ブラウザのすべてにある。
//   ただし**このファイルをクライアントから import しないこと**（秘密鍵を読むため）。
//
// ── トークン形式 ─────────────────────────────────────────────────────────────
//   v1.<base64url(payload JSON)>.<base64url(HMAC-SHA256)>
//   payload = { u: name2, iat: 発行時刻(秒), exp: 失効時刻(秒) }
//
//   ロールは入れない。権限判定は必ずサーバー側で staff_identify から引く
//   （Cookie の自己申告を信じない）。

/** セッションの有効期間。既定 7 日 */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

/** 署名鍵。32 バイト以上のランダム文字列を想定 */
const SECRET_ENV = 'CXM_SESSION_SECRET';
const MIN_SECRET_LENGTH = 32;

export interface SessionPayload {
  /** staff_identify.name2 */
  u: string;
  /** 発行時刻（UNIX 秒） */
  iat: number;
  /** 失効時刻（UNIX 秒） */
  exp: number;
}

/** 検証に失敗した理由。呼び出し側はすべて「未認証」として扱う */
export type SessionFailure =
  | 'no_secret'      // CXM_SESSION_SECRET が未設定 or 短すぎる
  | 'missing'        // Cookie が無い
  | 'malformed'      // 形式が違う（旧平文 Cookie もここに落ちる）
  | 'bad_signature'  // 署名が合わない
  | 'expired';       // exp を過ぎている

// ── 秘密鍵 ───────────────────────────────────────────────────────────────────

function readSecret(): string | null {
  const raw = process.env[SECRET_ENV];
  if (!raw || raw.length < MIN_SECRET_LENGTH) return null;
  return raw;
}

/** 秘密鍵が正しく設定されているか。設定不備の検知に使う（値は返さない） */
export function isSessionSecretConfigured(): boolean {
  return readSecret() !== null;
}

let keyCache: { secret: string; key: CryptoKey } | null = null;

async function hmacKey(): Promise<CryptoKey | null> {
  const secret = readSecret();
  if (!secret) return null;
  if (keyCache && keyCache.secret === secret) return keyCache.key;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  keyCache = { secret, key };
  return key;
}

// ── base64url（Edge / Node どちらでも動く形で）───────────────────────────────

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

const enc = new TextEncoder();
const dec = new TextDecoder();

// ── 発行 ─────────────────────────────────────────────────────────────────────

/**
 * name2 から署名付きトークンを作る。
 * 秘密鍵が未設定なら null を返す（呼び出し側は 503 にすること）。
 */
export async function signSession(
  name2: string,
  ttlSeconds: number = SESSION_TTL_SECONDS,
): Promise<string | null> {
  const key = await hmacKey();
  if (!key) return null;

  const now: number = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { u: name2, iat: now, exp: now + ttlSeconds };

  const body = toBase64Url(enc.encode(JSON.stringify(payload)));
  const sig  = await crypto.subtle.sign('HMAC', key, enc.encode(`v1.${body}`));
  return `v1.${body}.${toBase64Url(new Uint8Array(sig))}`;
}

// ── 検証 ─────────────────────────────────────────────────────────────────────

export type VerifyResult =
  | { ok: true;  payload: SessionPayload }
  | { ok: false; reason: SessionFailure };

/**
 * トークンを検証する。
 * 署名照合は crypto.subtle.verify に任せる（タイミング安全）。
 * 旧形式の平文 Cookie（`Utty` のような文字列）は 'malformed' で落ちる。
 */
export async function verifySession(token: string | undefined | null): Promise<VerifyResult> {
  if (!token) return { ok: false, reason: 'missing' };

  const key = await hmacKey();
  if (!key) return { ok: false, reason: 'no_secret' };

  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return { ok: false, reason: 'malformed' };

  const [, body, sig] = parts;
  const sigBytes = fromBase64Url(sig);
  if (!sigBytes) return { ok: false, reason: 'malformed' };

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes as unknown as ArrayBuffer,
    enc.encode(`v1.${body}`),
  ).catch(() => false);
  if (!valid) return { ok: false, reason: 'bad_signature' };

  const bodyBytes = fromBase64Url(body);
  if (!bodyBytes) return { ok: false, reason: 'malformed' };

  let payload: SessionPayload;
  try {
    payload = JSON.parse(dec.decode(bodyBytes)) as SessionPayload;
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (typeof payload.u !== 'string' || !payload.u) return { ok: false, reason: 'malformed' };
  if (typeof payload.exp !== 'number' || typeof payload.iat !== 'number') {
    return { ok: false, reason: 'malformed' };
  }
  if (Math.floor(Date.now() / 1000) >= payload.exp) return { ok: false, reason: 'expired' };

  return { ok: true, payload };
}
