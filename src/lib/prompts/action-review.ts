// ─── Action実施後レビュープロンプト（Claude API 用）─────────────────────────
// アクション完了後にCSMが記録したレビューをAIが整理・資産化する。

export interface ActionReviewResult {
  summary: string;             // レビュー要約（2〜3文）
  learning_points: string[];   // 学んだこと（2〜4項目）
  next_suggestions: string[];  // 次回への提案（1〜3項目）
  md_content: string;          // 資産保存用MD全文
}

export const ACTION_REVIEW_TOOL = {
  type: 'function' as const,
  function: {
    name: 'summarize_action_review',
    description: 'CSMアクションのレビューを整理して学習ポイントと次回提案を生成する',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'アクション実施の要約（2〜3文）',
        },
        learning_points: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 4,
          description: 'このアクションから学んだこと（2〜4項目）',
        },
        next_suggestions: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 3,
          description: '次回同様のアクション時への改善提案（1〜3項目）',
        },
        md_content: {
          type: 'string',
          description: '資産ライブラリに保存するMarkdown全文',
        },
      },
      required: ['summary', 'learning_points', 'next_suggestions', 'md_content'],
    },
  },
};

export function buildActionReviewPrompt(
  actionTitle: string,
  companyName: string | undefined,
  originalPlan: string | undefined,
  reviewText: string,
): string {
  return `あなたはCSMのコーチAIです。
以下のアクション実施後のレビューをもとに、学習ポイントを整理して資産化してください。
summarize_action_review ツールを使ってください。

## アクション情報
- 件名: ${actionTitle}
${companyName ? `- 会社名: ${companyName}` : ''}

${originalPlan ? `## 当初の計画\n${originalPlan}\n` : ''}

## CSMによるレビュー記録
${reviewText}

## 指示
- 何がうまくいって、何がうまくいかなかったかを客観的に整理してください
- 学んだことは再現性のある形で表現してください
- 次回への提案は具体的かつ実行可能な内容にしてください
- md_content は他のCSMが参照したときに役立つように記述してください`;
}
