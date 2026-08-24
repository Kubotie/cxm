// ─── OpenRouter Web 検索付き呼び出し ─────────────────────────────────────────
//
// OpenRouter の web プラグインを使って、モデルに Web 検索させる。
//
// なぜ OpenAI SDK を使わず fetch を直接叩くか:
//   `plugins` は OpenRouter 独自パラメータで OpenAI SDK の型に存在しないため。
//   型キャストで無理に通すより、この関数に閉じ込めて素の fetch で扱う。
//
// 返り値の annotations には **出典URL + ページ本文の抜粋** が含まれる。
// これが「出典必須」「excerpt は原文からの引用」という §11 の要件を満たす鍵で、
// 検索結果の本文をそのまま構造化の入力に使うことで、モデルの作文を防げる。
//
// このファイルはサーバーサイド専用。ブラウザから import しないこと。

/** OpenRouter が返す出典アノテーション */
export interface UrlCitation {
  url:     string;
  title:   string;
  /** ページ本文の抜粋。構造化の入力に使う */
  content: string;
}

export interface WebSearchResult {
  /** モデルの自然言語応答 */
  text:      string;
  /** 出典（URL + 本文抜粋） */
  citations: UrlCitation[];
  /** 概算コスト（USD）。UI に出して使いすぎを可視化する */
  costUsd:   number | null;
}

interface RawAnnotation {
  type?: string;
  url_citation?: { url?: string; title?: string; content?: string };
}

/**
 * Web 検索させて、応答と出典を返す。
 *
 * @param maxResults 検索結果の取り込み件数。多いほど精度は上がるがコストも上がる
 */
export async function searchWeb(input: {
  systemPrompt: string;
  userPrompt:   string;
  maxResults?:  number;
  maxTokens?:   number;
}): Promise<WebSearchResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY が未設定です。.env.local に追加して dev server を再起動してください。');
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? 'anthropic/claude-sonnet-4-5',
      plugins: [{ id: 'web', max_results: input.maxResults ?? 5 }],
      max_tokens: input.maxTokens ?? 2000,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user',   content: input.userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '(body read failed)');
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string | null; annotations?: RawAnnotation[] } }>;
    usage?:   { cost?: number };
  };

  const message = json.choices?.[0]?.message;

  const citations: UrlCitation[] = (message?.annotations ?? [])
    .filter(a => a.type === 'url_citation' && a.url_citation?.url)
    .map(a => ({
      url:     String(a.url_citation!.url),
      title:   String(a.url_citation!.title ?? ''),
      content: String(a.url_citation!.content ?? ''),
    }));

  return {
    text:      message?.content ?? '',
    citations,
    costUsd:   json.usage?.cost ?? null,
  };
}
