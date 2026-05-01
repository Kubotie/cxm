// ─── Action計画生成プロンプト（Claude API 用）────────────────────────────────
// 新規アクション作成時にAIが目的・手順・達成条件を整理する。

export interface ActionPlanResult {
  purpose: string;         // 目的（1〜2文）
  approach: string;        // 実行方法（1〜2文）
  steps: string[];         // 手順（箇条書き、3〜6項目）
  success_criteria: string[]; // 達成条件（2〜4項目）
  md_content: string;      // 上記をまとめたMDフォーマット全文
}

export const ACTION_PLAN_TOOL = {
  type: 'function' as const,
  function: {
    name: 'generate_action_plan',
    description: 'CSMアクションの計画（目的・手順・達成条件）を生成する',
    parameters: {
      type: 'object',
      properties: {
        purpose: {
          type: 'string',
          description: 'このアクションの目的（1〜2文、なぜやるか）',
        },
        approach: {
          type: 'string',
          description: '実行方法（どのようにやるか、1〜2文）',
        },
        steps: {
          type: 'array',
          items: { type: 'string' },
          minItems: 3,
          maxItems: 6,
          description: '手順（箇条書き、3〜6項目）',
        },
        success_criteria: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 4,
          description: '達成条件（完了したとみなせる状態、2〜4項目）',
        },
        md_content: {
          type: 'string',
          description: '全内容をまとめたMarkdown形式の全文',
        },
      },
      required: ['purpose', 'approach', 'steps', 'success_criteria', 'md_content'],
    },
  },
};

export function buildActionPlanPrompt(
  title: string,
  companyName: string | undefined,
  actionPurpose: string | undefined,
  context: string | undefined,
): string {
  return `あなたはCSM（カスタマーサクセスマネージャー）のコーチAIです。
以下のアクション情報をもとに、具体的な計画を generate_action_plan ツールを使って生成してください。

## アクション情報
- 件名: ${title}
${companyName ? `- 会社名: ${companyName}` : ''}
${actionPurpose ? `- 行動目的: ${actionPurpose}` : ''}
${context ? `- 追加コンテキスト: ${context}` : ''}

## 生成の指針
- 目的: なぜこのアクションを行うのか（顧客・自社双方の視点）
- 手順: 実際に何をするか、具体的かつ実行可能なステップ
- 達成条件: アクション完了後にどうなっていれば成功か（定量・定性）
- md_content: 上記を## セクション形式でまとめたMarkdown全文

md_content の例:
\`\`\`
# ${title}

## 目的
（目的の文章）

## 実行方法
（実行方法の文章）

## 手順
1. ...
2. ...

## 達成条件
- [ ] ...
- [ ] ...
\`\`\``;
}
