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

/**
 * Extended Thinking を有効にした chat.completions.create を実行する。
 * OpenRouter 経由で thinking パラメータを extra_body として渡す。
 * thinking + tool_use の場合、budget_tokens 分だけ先に思考してからツールを呼ぶ。
 *
 * @param client   getAnthropicClient() の戻り値
 * @param params   通常の chat.completions.create パラメータ
 * @param thinkingBudget  thinking に割り当てるトークン数（デフォルト 8,000）
 */
export async function createWithThinking(
  client: OpenAI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>,
  thinkingBudget = 8_000,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // OpenRouter は thinking パラメータを直接受け付ける
  // thinking 使用時は max_tokens を budget 分多く確保する
  const maxTokens = (params.max_tokens ?? 4096) + thinkingBudget;

  return client.chat.completions.create({
    ...params,
    max_tokens: maxTokens,
    stream: false,
    thinking: { type: 'enabled', budget_tokens: thinkingBudget },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}
