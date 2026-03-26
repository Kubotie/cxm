// ─── Support Triage プロンプト定義 ────────────────────────────────────────────
// このファイルはサーバー・クライアント両側で import 可能（副作用なし）。
// OpenAI SDK は import しない。

import type { AppSupportCase, AppCseTicket } from '@/lib/nocodb/types';
import type { CaseContext } from '@/lib/support/ai-types';

// ── レスポンス型 ─────────────────────────────────────────────────────────────

/** OpenAI が返す構造化データ */
export interface SupportTriageResult {
  triage_note: string;
  suggested_action: string;
  escalation_needed: boolean;
  category: string;
  severity: 'high' | 'medium' | 'low';
  suggested_team: 'CSM' | 'Support' | 'CSE';
  routing_reason: string;
}

/** API エンドポイントが返すレスポンス全体 */
export interface SupportTriageApiResponse extends SupportTriageResult {
  model: string;
  generated_at: string;
  case_id: string;
  saved?: boolean;
  save_skipped?: boolean;
  save_skip_reason?: string;
}

// ── JSON Schema（Structured Outputs 用）──────────────────────────────────────

export const SUPPORT_TRIAGE_JSON_SCHEMA = {
  name: 'support_triage',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      triage_note: {
        type: 'string' as const,
        description: 'トリアージ所見（2〜3文、日本語）。問題の性質・緊急度・背景を簡潔にまとめる',
      },
      suggested_action: {
        type: 'string' as const,
        description: '直近で取るべきアクション（1〜2文）。誰が・何を・どこで行うかを具体的に記述する',
      },
      escalation_needed: {
        type: 'boolean' as const,
        description: 'CSE や上位チームへのエスカレーションが必要か',
      },
      category: {
        type: 'string' as const,
        description: '問い合わせカテゴリ（例: "技術的問題", "機能リクエスト", "請求・契約", "利用方法の質問", "パフォーマンス問題", "権限・アクセス"）',
      },
      severity: {
        type: 'string' as const,
        enum: ['high', 'medium', 'low'] as const,
        description: '深刻度',
      },
      suggested_team: {
        type: 'string' as const,
        enum: ['CSM', 'Support', 'CSE'] as const,
        description: '対応を主導すべきチーム',
      },
      routing_reason: {
        type: 'string' as const,
        description: 'そのチームを推奨した根拠（1〜2文）',
      },
    },
    required: [
      'triage_note',
      'suggested_action',
      'escalation_needed',
      'category',
      'severity',
      'suggested_team',
      'routing_reason',
    ] as const,
    additionalProperties: false,
  },
} as const;

// ── System Prompt ─────────────────────────────────────────────────────────────

export const SUPPORT_TRIAGE_SYSTEM_PROMPT = `あなたは SaaS 企業の Customer Success Manager (CSM) を支援する AI アシスタントです。
Support Queue の案件をトリアージし、適切なチームへのルーティングと緊急度の判定を行ってください。

トリアージの基準:
- severity: 顧客ビジネスへの影響度を重視する（本番障害 → high、機能制限 → medium、質問 → low）
- suggested_team:
  - CSM: 契約・更新・顧客関係に関わる案件、あるいはリレーション強化が必要な場合
  - Support: 一般的な技術的問題・利用方法の質問・設定サポート
  - CSE: 深刻なバグ・データ問題・API 連携の技術的不具合・パフォーマンス問題
- escalation_needed: severity が high または CSE への引き継ぎが必要な場合 true

ルール:
- 必ず日本語で回答する
- 指定された JSON スキーマに厳密に従う
- 情報が不足している項目は「情報不足」と記載する（推測で補完しない）`;

// ── User Prompt ビルダー ──────────────────────────────────────────────────────

/** AppSupportCase（NocoDB から取得）を使ってプロンプトを構築する */
export function buildSupportTriagePrompt(
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
    lines.push('', '## Existing Triage Note');
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
export function buildSupportTriagePromptFromContext(
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
    lines.push('', '## Existing Triage Note', ctx.triageNote);
  }
  return lines.join('\n');
}
