// ─── OpenRouter クライアント（サーバーサイド専用）────────────────────────────
// Claudeモデルに OpenRouter 経由でアクセスする。
// OpenAI SDK を使用（既存の openai パッケージを再利用）。
// 既存のOpenAIクライアント（サポートケース系）とは独立して共存。
// ブラウザから直接インポートしないこと。
// 使用箇所: src/app/api/assets/**, src/app/api/documents/**, src/app/api/actions/ai-plan のみ

import OpenAI from 'openai';

let _client: OpenAI | null = null;

/**
 * OpenRouter クライアントのシングルトンを返す。
 * OPENROUTER_API_KEY が未設定の場合は Error を throw する。
 */
export function getAnthropicClient(): OpenAI {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      'OPENROUTER_API_KEY が未設定です。.env.local に OPENROUTER_API_KEY=sk-or-... を追加して dev server を再起動してください。',
    );
  }
  if (!_client) {
    _client = new OpenAI({
      apiKey:  process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }
  return _client;
}

/**
 * 使用するモデル名（OpenRouter 形式）。
 * .env.local で ANTHROPIC_MODEL を設定すると上書きできる。
 * デフォルト: anthropic/claude-sonnet-4-5
 */
export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL ?? 'anthropic/claude-sonnet-4-5';
}
