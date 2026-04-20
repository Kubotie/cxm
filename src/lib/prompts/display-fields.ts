// ─── display_title / display_message 専用プロンプト定義 ───────────────────────
// source tables（log_intercom / cse_tickets）への AI enrichment 専用。
// full summary（support-summary.ts）より軽量：display_title + display_message のみ生成。
// OpenAI SDK は import しない（副作用なし）。

// ── レスポンス型 ─────────────────────────────────────────────────────────────

export interface DisplayFieldsResult {
  display_title:   string;
  display_message: string;
}

// ── JSON Schema（Structured Outputs 用）──────────────────────────────────────

export const DISPLAY_FIELDS_JSON_SCHEMA = {
  name: 'display_fields',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      display_title: {
        type: 'string' as const,
        description: [
          '案件の表示用タイトル（20〜40文字、日本語）。',
          '「何の問題か・どんな状態か」が一目で分かる具体的な文言にする。',
          '「お問い合わせ」「ご連絡」「タイトルなし」「内容不明」などの汎用文言は禁止。',
          'body が空でも、利用可能な情報（title・describe・product 等）から具体的なタイトルを生成すること。',
        ].join(''),
      },
      display_message: {
        type: 'string' as const,
        description: [
          '詳細画面用の整形済み本文。原文の言語・内容をそのまま保持する（翻訳・要約・補完禁止）。',
          '以下を除去: 冒頭の挨拶（「お世話になっております」等）、署名・連絡先ブロック、',
          '定型的な締め文句（「よろしくお願いいたします」等）、引用（> で始まる行・--- Original Message ---以降）。',
          '問い合わせ内容・状況説明・エラー情報・再現手順など意味のある本文は一切削らない。',
          'body が空または情報不足の場合は空文字を返す。',
        ].join(''),
      },
    },
    required: ['display_title', 'display_message'] as const,
    additionalProperties: false,
  },
} as const;

// ── System Prompt ─────────────────────────────────────────────────────────────

export const DISPLAY_FIELDS_SYSTEM_PROMPT = `あなたは SaaS 企業のサポートキュー管理システムです。
問い合わせレコードから「表示用タイトル」と「整形済み本文」の2つを生成してください。

display_title のルール:
- 20〜40文字（日本語）で、問題の主題が一目で分かる具体的な文言
- 主語（会社名・担当者名）は不要
- NG: 「お問い合わせ」「ご連絡」「タイトルなし」「内容不明」など汎用的すぎる文言
- OK: 「レポートのCSV出力が500エラーで失敗する」「API連携のwebhook URLが保存できない」

display_message のルール:
- 原文の言語・内容をそのまま保持（翻訳・要約・補完禁止）
- 除去対象: 冒頭挨拶・署名・定型締め文句・引用（>行・--- Original Message ---以降）・過剰な空行
- 保持対象: 質問内容・状況説明・エラーメッセージ・再現手順・技術情報
- body が空なら空文字を返す

必ず指定された JSON スキーマに厳密に従うこと。`;

// ── Prompt ビルダー ────────────────────────────────────────────────────────────

interface IntercomPromptInput {
  body?:         string | null;
  account_name?: string | null;
  massage_type?: string | null;
}

/** log_intercom レコード用プロンプト */
export function buildDisplayFieldsPromptForIntercom(raw: IntercomPromptInput): string {
  const lines: string[] = ['## Intercom 問い合わせ'];
  if (raw.account_name) lines.push(`Account : ${raw.account_name}`);
  if (raw.massage_type) lines.push(`Type    : ${raw.massage_type}`);
  lines.push('');
  lines.push('## Body');
  lines.push(raw.body ? raw.body.trim() : '(本文なし)');
  return lines.join('\n');
}

interface CseTicketPromptInput {
  title?:    string | null;
  describe?: string | null;
  body?:     string | null;
  comment?:  string | null;
  product?:  string | null;
}

/** cse_tickets レコード用プロンプト */
export function buildDisplayFieldsPromptForCseTicket(raw: CseTicketPromptInput): string {
  const lines: string[] = ['## CSE チケット'];
  if (raw.product) lines.push(`Product : ${raw.product}`);
  if (raw.title)   lines.push(`Title   : ${raw.title}`);
  if (raw.describe) {
    lines.push('');
    lines.push('## Describe');
    lines.push(raw.describe.trim());
  }
  if (raw.body) {
    lines.push('');
    lines.push('## Body');
    lines.push(raw.body.trim());
  }
  if (raw.comment) {
    lines.push('');
    lines.push('## Comments');
    lines.push(raw.comment.trim());
  }
  if (!raw.describe && !raw.body) {
    lines.push('');
    lines.push('## Body');
    lines.push('(本文なし)');
  }
  return lines.join('\n');
}
