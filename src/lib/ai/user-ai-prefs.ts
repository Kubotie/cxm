// ─── ユーザーごとの AI アシスタント設定（サーバーサイド専用）───────────────────
//
// 「回答スタイル / 履歴の保持期間 / 使用モデル」の3つを持つ。
// これらは **サーバーが読む必要がある** ので localStorage には置けない
// （システムプロンプトへの反映・履歴の期限削除・モデル選択はすべてサーバー側処理）。
//
// 保存先は staff_identify ではなく Vercel Blob。理由:
//   - staff_identify に無い列へ PATCH すると 422 で落ちる（列追加は運用作業）
//   - チャット履歴（chat-store.ts）と同じ「利用者ごとの作業設定」であり、
//     運用対象の業務データではない
//
// chat-store.ts と同じ **追記専用** 設計にしている。Blob の cacheControlMaxAge は
// 最小 60 秒なので、同じ pathname を上書きすると保存直後の最大1分間は古い設定が
// 返る。「モデルを変えたのに次の質問が前のモデルで走る」のは壊れているので、
// 毎回新しい seq に put し、list()（API 直・キャッシュ無し）で最新版を選ぶ。

import { list, put, del } from '@vercel/blob';
import { blobUserKey, isChatStoreEnabled } from './chat-store';
import { scopedRoot } from '@/lib/blob/env-scope';
import { getAnthropicModel } from '@/lib/anthropic/client';

// ── 型 ────────────────────────────────────────────────────────────────────────

export interface UserAiPrefs {
  /** 回答スタイル・常用の前提。システムプロンプト末尾に「利用者の指示」として足す */
  instructions: string;
  /** 履歴の保持日数。0 は無期限 */
  retentionDays: number;
  /** 使用モデル（OpenRouter 形式）。空文字は既定（ANTHROPIC_MODEL）を使う */
  model: string;
}

export const USER_AI_PREFS_DEFAULT: UserAiPrefs = {
  instructions:  '',
  retentionDays: 0,
  model:         '',
};

/** 回答スタイルの上限。長すぎる指示はシステムプロンプト本体を薄めるので切る */
export const MAX_INSTRUCTIONS_LEN = 600;

/** 選べる保持期間（日）。0 = 無期限 */
export const RETENTION_CHOICES = [0, 30, 90, 180, 365] as const;

// ── pathname ──────────────────────────────────────────────────────────────────

/** 環境ごとに分ける。理由は chat-store.ts と同じ */
const ROOT = scopedRoot('ai-prefs');

function parseSeq(pathname: string, prefix: string): number | null {
  if (!pathname.startsWith(prefix)) return null;
  const m = /^(\d{6})\.json$/.exec(pathname.slice(prefix.length));
  return m ? Number(m[1]) : null;
}

// ── 正規化 ────────────────────────────────────────────────────────────────────

/** 外から来た値を安全な形にそろえる。不正値は既定へ落とす（拒否はしない） */
export function normalizeUserAiPrefs(input: unknown): UserAiPrefs {
  const raw = (input ?? {}) as Partial<Record<keyof UserAiPrefs, unknown>>;

  const instructions = typeof raw.instructions === 'string'
    ? raw.instructions.trim().slice(0, MAX_INSTRUCTIONS_LEN)
    : USER_AI_PREFS_DEFAULT.instructions;

  const days = Number(raw.retentionDays);
  const retentionDays = (RETENTION_CHOICES as readonly number[]).includes(days)
    ? days
    : USER_AI_PREFS_DEFAULT.retentionDays;

  // モデル名は OpenRouter の "provider/model" 形式だけ通す。
  // 実在チェックはカタログ側（openrouter-models.ts）で行う。
  const model = typeof raw.model === 'string' && /^[a-z0-9._-]+\/[a-z0-9._:-]+$/i.test(raw.model.trim())
    ? raw.model.trim()
    : USER_AI_PREFS_DEFAULT.model;

  return { instructions, retentionDays, model };
}

/** 実際に使うモデル名。未指定なら環境変数の既定 */
export function resolveModel(prefs: UserAiPrefs | null): string {
  return prefs?.model || getAnthropicModel();
}

// ── 読み取り / 書き込み ───────────────────────────────────────────────────────

/** Blob が使えるか。未設定時は「常に既定値」として動く（設定は保存できない） */
export function isUserAiPrefsEnabled(): boolean {
  return isChatStoreEnabled();
}

export async function loadUserAiPrefs(userUid: string): Promise<UserAiPrefs> {
  if (!isUserAiPrefsEnabled()) return { ...USER_AI_PREFS_DEFAULT };

  const prefix = `${ROOT}/${blobUserKey(userUid)}/`;
  try {
    const page = await list({ prefix, limit: 1000 });
    let best: { seq: number; url: string } | null = null;
    for (const blob of page.blobs) {
      const seq = parseSeq(blob.pathname, prefix);
      if (seq === null) continue;
      if (!best || seq > best.seq) best = { seq, url: blob.url };
    }
    if (!best) return { ...USER_AI_PREFS_DEFAULT };

    // pathname は書き込み後に不変なので、CDN キャッシュに当たっても内容は正しい
    const res = await fetch(best.url);
    if (!res.ok) return { ...USER_AI_PREFS_DEFAULT };
    return normalizeUserAiPrefs(await res.json());
  } catch (err) {
    console.error('[user-ai-prefs] 読み込みに失敗', err);
    return { ...USER_AI_PREFS_DEFAULT };
  }
}

export async function saveUserAiPrefs(userUid: string, prefs: UserAiPrefs): Promise<UserAiPrefs> {
  const next = normalizeUserAiPrefs(prefs);
  if (!isUserAiPrefsEnabled()) return next;

  const prefix = `${ROOT}/${blobUserKey(userUid)}/`;
  const page = await list({ prefix, limit: 1000 });
  const olds = page.blobs.map(b => b.url);
  let seq = page.blobs.reduce((max, b) => {
    const n = parseSeq(b.pathname, prefix);
    return n !== null && n > max ? n : max;
  }, 0);

  const payload = JSON.stringify(next);
  for (let attempt = 0; attempt < 3; attempt++) {
    seq += 1;
    try {
      await put(`${prefix}${String(seq).padStart(6, '0')}.json`, payload, {
        access:             'public',
        contentType:        'application/json',
        addRandomSuffix:    false,
        cacheControlMaxAge: 60,
      });
      break;
    } catch (err) {
      // 同一 pathname が既にある（= 別リクエストが同 seq を取った）場合だけ再試行
      if (attempt === 2) throw err;
    }
  }

  // 旧版の掃除。失敗しても最大 seq が正なので読み取りには影響しない
  if (olds.length > 0) await del(olds).catch(() => { /* 掃除失敗は無視 */ });

  return next;
}
