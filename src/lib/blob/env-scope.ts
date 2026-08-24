// ─── Blob の環境スコープ（サーバーサイド専用）──────────────────────────────────
//
// production / preview / ローカル開発が同じ Blob ストアを共有しているため、
// 「利用者ごとの作業データ」は環境ごとに名前空間を分ける。
//
// 分けるもの:   ai-chat（チャット履歴）, ai-prefs（AI 設定）
// 分けないもの: csm-assets, csm-documents
//   → こちらは業務成果物であり、ローカルでも本番のものを参照したい。
//     分けるとローカルで一覧が空になり、確認作業ができなくなる。
//
// VERCEL_ENV は Vercel が自動で入れる（production / preview / development）。
// ローカルでは未定義なので development として扱う。

export type BlobEnvScope = 'production' | 'preview' | 'development';

export function blobEnvScope(): BlobEnvScope {
  const env = process.env.VERCEL_ENV;
  if (env === 'production' || env === 'preview') return env;
  return 'development';
}

/**
 * 環境で分ける prefix を作る。
 * 例: scopedRoot('ai-chat') → 'ai-chat/development'
 */
export function scopedRoot(root: string): string {
  return `${root}/${blobEnvScope()}`;
}
