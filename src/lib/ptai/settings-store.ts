// ─── PtAI Pipeline: 設定の保存先（サーバー専用）────────────────────────────
//
// 2026-10-01 の判断: Twenty API キーを管理画面から設定できるようにする。
//
// ═══════════════════════════════════════════════════════════════════════════
//  置き場所は **PtAI 専用の `ptai_settings` テーブル**。
//  **`staff_identify` には置かない**（共通認証のホットパスで、1 行＝1 人のため）。
//
//  値は **AES-256-GCM で暗号化**して保存する。暗号鍵は環境変数にだけ置くので、
//  NocoDB のトークンが漏れても復号できない。
//
//  **復号した値を戻り値・ログ・応答に出さないこと。**
//  画面へ返してよいのは `hint`（末尾 4 文字）・更新者・更新日時だけ。
// ═══════════════════════════════════════════════════════════════════════════
//
// ブラウザから import しない。

import { encryptSecret, decryptSecret, secretHint, isSecretKeyConfigured, SecretError } from './secret';

const BASE_URL = process.env.NOCODB_BASE_URL ?? 'https://odtable.ptmind.ai';
const API_TOKEN = process.env.NOCODB_API_TOKEN ?? '';

function tableId(): string {
  return (process.env.NOCODB_PTAI_SETTINGS_TABLE_ID || '').trim();
}

export function isSettingsStoreConfigured(): boolean {
  return Boolean(API_TOKEN && tableId());
}

/** 設定の名前。増えたらここに足す */
export const SETTING_TWENTY_API_KEY = 'twenty_api_key';

interface Row {
  Id: number;
  setting_key: string | null;
  value_enc: string | null;
  hint: string | null;
  updated_by: string | null;
  updated_at_s: string | null;
}

async function noco<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}/api/v2/tables/${tableId()}${path}`, {
    ...init,
    headers: { 'xc-token': API_TOKEN, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // 本文に秘密値は含まれないが、長さは切る
    throw new Error(`NocoDB ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function findRow(key: string): Promise<Row | null> {
  const qs = `?where=${encodeURIComponent(`(setting_key,eq,${key})`)}&limit=1`;
  const json = await noco<{ list: Row[] }>(`/records${qs}`);
  return json.list[0] ?? null;
}

export interface SettingStatus {
  /** 保存されているか */
  stored: boolean;
  /** 末尾 4 文字など。**値そのものではない** */
  hint: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  /** 環境変数にも値があるか（フォールバック元） */
  envFallback: boolean;
  /** 暗号鍵が設定されているか。無いと保存も復号もできない */
  secretKeyReady: boolean;
}

/** 画面に返してよい状態。**復号しない** */
export async function getSettingStatus(key: string, envValue?: string): Promise<SettingStatus> {
  const secretKeyReady = isSecretKeyConfigured();
  const envFallback = Boolean((envValue ?? '').trim());
  if (!isSettingsStoreConfigured()) {
    return { stored: false, hint: null, updatedBy: null, updatedAt: null, envFallback, secretKeyReady };
  }
  const row = await findRow(key);
  return {
    stored:    Boolean(row?.value_enc),
    hint:      row?.hint ?? null,
    updatedBy: row?.updated_by ?? null,
    updatedAt: row?.updated_at_s ?? null,
    envFallback,
    secretKeyReady,
  };
}

/**
 * 値を保存する。**平文は DB に書かない。**
 * 保存できたら hint だけを返す。
 */
export async function setSetting(key: string, plain: string, actor: string): Promise<SettingStatus> {
  if (!isSettingsStoreConfigured()) {
    throw new Error('NOCODB_PTAI_SETTINGS_TABLE_ID が未設定です');
  }
  const value_enc = encryptSecret(plain);          // 鍵が無ければここで SecretError
  const hint = secretHint(plain);
  const now = new Date().toISOString();
  const payload = { setting_key: key, value_enc, hint, updated_by: actor, updated_at_s: now };

  const row = await findRow(key);
  if (row) {
    await noco('/records', { method: 'PATCH', body: JSON.stringify([{ Id: row.Id, ...payload }]) });
  } else {
    await noco('/records', { method: 'POST', body: JSON.stringify([payload]) });
  }
  return { stored: true, hint, updatedBy: actor, updatedAt: now, envFallback: false, secretKeyReady: true };
}

/** 保存されている値を消す。環境変数へのフォールバックに戻る */
export async function clearSetting(key: string): Promise<void> {
  if (!isSettingsStoreConfigured()) return;
  const row = await findRow(key);
  if (!row) return;
  await noco('/records', { method: 'DELETE', body: JSON.stringify([{ Id: row.Id }]) });
}

// ── 読み出し（サーバー内部だけ）────────────────────────────────────────────

/**
 * 保存された値を復号して返す。**この戻り値を応答やログに出さないこと。**
 * 無ければ null。復号に失敗したら null（鍵の入れ替え中などに全体を止めない）。
 */
export async function readSecret(key: string): Promise<string | null> {
  if (!isSettingsStoreConfigured() || !isSecretKeyConfigured()) return null;
  try {
    const row = await findRow(key);
    if (!row?.value_enc) return null;
    return decryptSecret(row.value_enc);
  } catch (e) {
    const kind = e instanceof SecretError ? e.kind : 'error';
    console.error('[ptai/settings] 復号できませんでした', kind);
    return null;
  }
}

// ── キャッシュ付きの解決 ────────────────────────────────────────────────────

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; value: string | null }>();

/**
 * DB → 環境変数 の順に解決する。
 * 毎リクエストで NocoDB を叩かないよう 60 秒だけ覚える。
 * 保存したときは `invalidateSecretCache` で捨てる。
 */
export async function resolveSecret(key: string, envValue?: string): Promise<string | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value ?? (envValue?.trim() || null);

  const fromDb = await readSecret(key).catch(() => null);
  cache.set(key, { at: Date.now(), value: fromDb });
  return fromDb ?? (envValue?.trim() || null);
}

export function invalidateSecretCache(key?: string): void {
  if (key) cache.delete(key); else cache.clear();
}
