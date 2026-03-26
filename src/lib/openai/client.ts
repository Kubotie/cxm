// ─── OpenAI クライアント（サーバーサイド専用）────────────────────────────────
// ブラウザから直接インポートしないこと。
// 使用箇所: src/app/api/** のみ

import OpenAI from 'openai';

let _client: OpenAI | null = null;

/**
 * OpenAI クライアントのシングルトンを返す。
 * OPENAI_API_KEY が未設定の場合は Error を throw する。
 */
export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY が未設定です。.env.local に OPENAI_API_KEY=sk-... を追加して dev server を再起動してください。',
    );
  }
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

/**
 * 使用するモデル名。
 * .env.local で OPENAI_MODEL を設定すると上書きできる。
 * デフォルト: gpt-4o-mini（Structured Outputs 対応・低コスト）
 */
export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
}
