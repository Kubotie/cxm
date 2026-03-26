// ─── Support Draft Reply プロンプト定義 ──────────────────────────────────────
// このファイルはサーバー・クライアント両側で import 可能（副作用なし）。
// OpenAI SDK は import しない。

import type { AppSupportCase, AppSupportCaseAIState } from '@/lib/nocodb/types';
import type { CaseContext } from '@/lib/support/ai-types';

// ── レスポンス型 ─────────────────────────────────────────────────────────────

/** OpenAI が返す構造化データ */
export interface SupportDraftReplyResult {
  draft_reply: string;
  reply_tone: 'formal' | 'friendly' | 'technical';
  key_points: string[];
}

/** API エンドポイントが返すレスポンス全体 */
export interface SupportDraftReplyApiResponse extends SupportDraftReplyResult {
  model: string;
  generated_at: string;
  case_id: string;
  saved?: boolean;
  save_skipped?: boolean;
  save_skip_reason?: string;
}

// ── JSON Schema（Structured Outputs 用）──────────────────────────────────────

export const SUPPORT_DRAFT_REPLY_JSON_SCHEMA = {
  name: 'support_draft_reply',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      draft_reply: {
        type: 'string' as const,
        description: '顧客への返信文面（完全な文章）。宛名・挨拶・本文・締め・署名プレースホルダーを含む',
      },
      reply_tone: {
        type: 'string' as const,
        enum: ['formal', 'friendly', 'technical'] as const,
        description: '返信に使用したトーン',
      },
      key_points: {
        type: 'array' as const,
        items: { type: 'string' as const },
        description: '返信で取り上げた主要ポイント（3〜5件）。担当者が内容を確認しやすくするための箇条書き',
      },
    },
    required: ['draft_reply', 'reply_tone', 'key_points'] as const,
    additionalProperties: false,
  },
} as const;

// ── System Prompt ─────────────────────────────────────────────────────────────

export function buildDraftReplySystemPrompt(
  tone: 'formal' | 'friendly' | 'technical' = 'formal',
  language: 'ja' | 'en' = 'ja',
): string {
  const toneDesc =
    tone === 'formal'     ? '丁寧でフォーマルなビジネス文体' :
    tone === 'friendly'   ? '親しみやすくカジュアルなトーン（ただし礼儀正しく）' :
                            '技術的に正確で詳細な説明を重視した文体';

  const langNote = language === 'en' ? '英語で返信してください。' : '日本語で返信してください。';

  return `あなたは SaaS 企業の Customer Success Manager (CSM) を支援する AI アシスタントです。
顧客からのサポート問い合わせに対する返信ドラフトを作成してください。

文体: ${toneDesc}
言語: ${langNote}

返信作成の指針:
- 顧客の問題・懸念に正面から向き合い、共感を示す
- 次のステップを具体的かつ明確に記述する
- 技術的な詳細は必要に応じて簡潔に説明する
- 追加情報が必要な場合は明示的に依頼する
- 署名部分は「[担当者名]」「[会社名]」等のプレースホルダーで示す

ルール:
- 指定された JSON スキーマに厳密に従う
- draft_reply は送信可能な完全な文章にする（"..." や "[要加筆]" は最小限に留める）
- 情報が不足している場合でも、取得済みの情報で最善のドラフトを作成する`;
}

// ── User Prompt ビルダー ──────────────────────────────────────────────────────

export interface DraftReplyPromptExtras {
  aiState?: AppSupportCaseAIState | null;
  instructions?: string;
  contextHints?: string[];
}

/** AppSupportCase（NocoDB から取得）+ AI state を使ってプロンプトを構築する */
export function buildDraftReplyPrompt(
  c: AppSupportCase,
  extras: DraftReplyPromptExtras = {},
): string {
  const lines: string[] = [
    '## Support Case',
    `Case ID     : ${c.id}`,
    `Title       : ${c.title}`,
    `Company     : ${c.company}`,
    `Source      : ${c.source}`,
    `Severity    : ${c.severity}`,
    `Status      : ${c.routingStatus}`,
    `Open For    : ${c.openDuration}`,
  ];

  if (c.originalMessage) {
    lines.push('', '## 顧客からの問い合わせ（Original Message）');
    lines.push(c.originalMessage);
  }

  if (c.triageNote) {
    lines.push('', '## Triage Note（内部メモ）');
    lines.push(c.triageNote);
  }

  // AI state から summary / triage 情報を補強
  const ai = extras.aiState;
  if (ai) {
    if (ai.summary) {
      lines.push('', '## AI サマリー（参考）');
      lines.push(ai.summary);
    }
    if (ai.triageNote) {
      lines.push('', '## AI トリアージ所見（参考）');
      lines.push(ai.triageNote);
    }
    if (ai.suggestedAction) {
      lines.push('', '## AI 推奨アクション（参考）');
      lines.push(ai.suggestedAction);
    }
    if (ai.category) {
      lines.push(`\nCategory: ${ai.category}`);
    }
  }

  if (extras.instructions) {
    lines.push('', '## 担当者からの追加指示');
    lines.push(extras.instructions);
  }

  if (extras.contextHints && extras.contextHints.length > 0) {
    lines.push('', '## 含めるべきコンテキスト');
    extras.contextHints.forEach(h => lines.push(`- ${h}`));
  }

  return lines.join('\n');
}

/**
 * NocoDB 未設定時のフォールバック。
 * UI から渡された CaseContext を使ってプロンプトを構築する。
 */
export function buildDraftReplyPromptFromContext(
  caseId: string,
  ctx?: CaseContext,
  extras: DraftReplyPromptExtras = {},
): string {
  if (!ctx) {
    return [
      '## Support Case',
      `Case ID: ${caseId}`,
      '',
      '※ NocoDB の support_queue テーブルが未設定のため詳細情報を取得できませんでした。',
      '  Case ID のみを基に返信ドラフトを作成します。',
    ].join('\n');
  }

  const lines = [
    '## Support Case',
    `Case ID     : ${caseId}`,
    ctx.title         ? `Title       : ${ctx.title}`         : '',
    ctx.company       ? `Company     : ${ctx.company}`       : '',
    ctx.source        ? `Source      : ${ctx.source}`        : '',
    ctx.severity      ? `Severity    : ${ctx.severity}`      : '',
    ctx.routingStatus ? `Status      : ${ctx.routingStatus}` : '',
    ctx.openDuration  ? `Open For    : ${ctx.openDuration}`  : '',
  ].filter(Boolean);

  if (ctx.originalMessage) {
    lines.push('', '## 顧客からの問い合わせ（Original Message）', ctx.originalMessage);
  }
  if (ctx.triageNote) {
    lines.push('', '## Triage Note（内部メモ）', ctx.triageNote);
  }

  if (extras.instructions) {
    lines.push('', '## 担当者からの追加指示', extras.instructions);
  }

  return lines.join('\n');
}
