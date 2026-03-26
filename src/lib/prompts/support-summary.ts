// ─── Support Summary プロンプト定義 ──────────────────────────────────────────
// このファイルはサーバー・クライアント両側で import 可能（副作用なし）。
// OpenAI SDK は import しない。

import type { AppSupportCase, AppCseTicket } from '@/lib/nocodb/types';
import type { CaseContext } from '@/lib/support/ai-types';

// ── レスポンス型 ─────────────────────────────────────────────────────────────

/** OpenAI が返す構造化データ */
export interface SupportSummaryResult {
  ai_summary: string;
  customer_intent: string;
  product_area: string;
  severity: 'high' | 'medium' | 'low';
  suggested_next_steps: string[];
  urgency_reasoning: string;
}

/** API エンドポイントが返すレスポンス全体 */
export interface SupportSummaryApiResponse extends SupportSummaryResult {
  model: string;
  generated_at: string;
  case_id: string;
  /** save=true を指定した場合に NocoDB へ保存されたか */
  saved?: boolean;
  /** 保存をスキップした場合 true */
  save_skipped?: boolean;
  /** スキップ理由（human_review_status が保護されている等） */
  save_skip_reason?: string;
}

// ── JSON Schema（Structured Outputs 用）──────────────────────────────────────
// gpt-4o-mini-2024-07-18 以降でサポートされる strict JSON schema

export const SUPPORT_SUMMARY_JSON_SCHEMA = {
  name: 'support_summary',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      ai_summary: {
        type: 'string' as const,
        description: '案件の簡潔なサマリー（2〜4文、日本語）',
      },
      customer_intent: {
        type: 'string' as const,
        description: '顧客が何を達成したいか、または何に困っているか（1〜2文）',
      },
      product_area: {
        type: 'string' as const,
        description: '関連する製品領域（例: レポート機能、API連携、権限管理、請求）',
      },
      severity: {
        type: 'string' as const,
        enum: ['high', 'medium', 'low'] as const,
        description: '緊急度',
      },
      suggested_next_steps: {
        type: 'array' as const,
        items: { type: 'string' as const },
        description: '推奨アクション（3〜5件、具体的かつ actionable に記述）',
      },
      urgency_reasoning: {
        type: 'string' as const,
        description: 'その緊急度と判断した根拠（1〜2文）',
      },
    },
    required: [
      'ai_summary',
      'customer_intent',
      'product_area',
      'severity',
      'suggested_next_steps',
      'urgency_reasoning',
    ] as const,
    additionalProperties: false,
  },
} as const;

// ── System Prompt ─────────────────────────────────────────────────────────────

export const SUPPORT_SUMMARY_SYSTEM_PROMPT = `あなたは SaaS 企業の Customer Success Manager (CSM) を支援する AI アシスタントです。
Support Queue の案件情報を分析し、CSM が素早く状況を把握してアクションを取れるよう、構造化されたサマリーを作成してください。

分析の観点:
- 顧客が何を達成したいか（ゴール）と、何に困っているか（ペイン）を分けて考える
- 製品の技術的な問題 / 利用方法の質問 / 契約・運用上の要件を区別する
- CSE チケットや過去の対応情報がある場合はその内容も考慮する
- suggested_next_steps は「確認する」ではなく「何を・どこで・どうやって確認するか」まで書く

ルール:
- 必ず日本語で回答する
- 指定された JSON スキーマに厳密に従う
- 情報が不足している項目は「情報不足」と記載する（推測で補完しない）`;

// ── User Prompt ビルダー ──────────────────────────────────────────────────────

/** AppSupportCase（NocoDB から取得）を使ってプロンプトを構築する */
export function buildSupportSummaryPrompt(
  c: AppSupportCase,
  extras: { cseTickets?: AppCseTicket[] } = {},
): string {
  const lines: string[] = [
    '## Support Case',
    `Case ID     : ${c.id}`,
    `Title       : ${c.title}`,
    `Case Type   : ${c.caseType}`,
    `Source      : ${c.source}`,
    `Company     : ${c.company}`,
  ];
  if (c.project)           lines.push(`Project     : ${c.project}`);
  lines.push(
    `Severity    : ${c.severity}`,
    `Status      : ${c.routingStatus}`,
    `Team        : ${c.assignedTeam ?? 'Unassigned'}`,
    `Open For    : ${c.openDuration}`,
  );
  if (c.linkedCSETicket)   lines.push(`CSE Ticket  : ${c.linkedCSETicket}`);
  if (c.originalMessage) {
    lines.push('', '## Original Message');
    lines.push(c.originalMessage);
  }
  if (c.triageNote) {
    lines.push('', '## Triage Note');
    lines.push(c.triageNote);
  }
  if (extras.cseTickets && extras.cseTickets.length > 0) {
    lines.push('', '## Linked CSE Tickets');
    extras.cseTickets.forEach(t => {
      lines.push(`- [${t.id}] ${t.title} | status: ${t.status} | priority: ${t.priority}`);
      if (t.description) lines.push(`  ${t.description}`);
    });
  }
  return lines.join('\n');
}

/**
 * NocoDB 未設定時のフォールバック。
 * UI から渡された CaseContext を使ってプロンプトを構築する。
 */
export function buildSupportSummaryPromptFromContext(
  caseId: string,
  ctx?: CaseContext,
): string {
  if (!ctx) {
    return [
      '## Support Case',
      `Case ID: ${caseId}`,
      '',
      '※ NocoDB の support_queue テーブルが未設定のため詳細情報を取得できませんでした。',
      '  Case ID のみを基に分析します。',
    ].join('\n');
  }

  const lines = [
    '## Support Case',
    `Case ID     : ${caseId}`,
    ctx.title         ? `Title       : ${ctx.title}`         : '',
    ctx.caseType      ? `Case Type   : ${ctx.caseType}`      : '',
    ctx.source        ? `Source      : ${ctx.source}`        : '',
    ctx.company       ? `Company     : ${ctx.company}`       : '',
    ctx.severity      ? `Severity    : ${ctx.severity}`      : '',
    ctx.routingStatus ? `Status      : ${ctx.routingStatus}` : '',
    ctx.assignedTeam  ? `Team        : ${ctx.assignedTeam}`  : '',
    ctx.openDuration  ? `Open For    : ${ctx.openDuration}`  : '',
    ctx.linkedCSETicket ? `CSE Ticket  : ${ctx.linkedCSETicket}` : '',
  ].filter(Boolean);

  if (ctx.originalMessage) {
    lines.push('', '## Original Message', ctx.originalMessage);
  }
  if (ctx.triageNote) {
    lines.push('', '## Triage Note', ctx.triageNote);
  }
  return lines.join('\n');
}
