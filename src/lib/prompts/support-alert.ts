// ─── Support Alert プロンプト定義 ─────────────────────────────────────────────
// このファイルはサーバー・クライアント両側で import 可能（副作用なし）。
// OpenAI SDK は import しない。

import type { AppSupportCase, AppSupportCaseAIState, AppCseTicket } from '@/lib/nocodb/types';
import type { CaseContext } from '@/lib/support/ai-types';

// ── レスポンス型 ─────────────────────────────────────────────────────────────

/** OpenAI が返す構造化データ */
export interface SupportAlertResult {
  alert_type: 'Opportunity' | 'Risk' | 'Content Suggestion' | 'Waiting on CSE' | 'Urgent';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Untriaged';
  title: string;
  summary: string;
  why_this_matters: string;
  suggested_action: string;
  escalation_needed: boolean;
}

/** API エンドポイントが返すレスポンス全体 */
export interface SupportAlertApiResponse extends SupportAlertResult {
  model: string;
  generated_at: string;
  case_id: string;
  saved?: boolean;
  save_skipped?: boolean;
  save_skip_reason?: string;
}

// ── JSON Schema（Structured Outputs 用）──────────────────────────────────────

export const SUPPORT_ALERT_JSON_SCHEMA = {
  name: 'support_alert',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      alert_type: {
        type: 'string' as const,
        enum: ['Opportunity', 'Risk', 'Content Suggestion', 'Waiting on CSE', 'Urgent'] as const,
        description: [
          'アラートの種類:',
          '  Opportunity    — 追加提案・アップセル・成功支援の機会',
          '  Risk           — 解約リスク・顧客満足度低下・SLA 遅延',
          '  Content Suggestion — FAQ/Help/ガイドの追加が有効な問い合わせ',
          '  Waiting on CSE — CSE チケット対応待ちで顧客が止まっている状態',
          '  Urgent         — 本番障害・データ損失・緊急対応が必要な問題',
        ].join('\n'),
      },
      priority: {
        type: 'string' as const,
        enum: ['Critical', 'High', 'Medium', 'Low'] as const,
        description: '優先度。Urgent アラートは Critical または High を選ぶ',
      },
      status: {
        type: 'string' as const,
        enum: ['Untriaged'] as const,
        description: '常に Untriaged で作成する（人間がレビュー後に変更）',
      },
      title: {
        type: 'string' as const,
        description: 'アラートタイトル（15〜40文字、日本語）。何が起きているかを一言で表す',
      },
      summary: {
        type: 'string' as const,
        description: '状況の要約（2〜3文、日本語）',
      },
      why_this_matters: {
        type: 'string' as const,
        description: 'このアラートが重要な理由（1〜2文）。顧客ビジネスへの影響を中心に記述',
      },
      suggested_action: {
        type: 'string' as const,
        description: '担当者が取るべき次のアクション（1〜2文）。誰が・何を・どこでを具体的に',
      },
      escalation_needed: {
        type: 'boolean' as const,
        description: 'CSE または上位チームへのエスカレーションが必要か',
      },
    },
    required: [
      'alert_type',
      'priority',
      'status',
      'title',
      'summary',
      'why_this_matters',
      'suggested_action',
      'escalation_needed',
    ] as const,
    additionalProperties: false,
  },
} as const;

// ── System Prompt ─────────────────────────────────────────────────────────────

export const SUPPORT_ALERT_SYSTEM_PROMPT = `あなたは SaaS 企業の Customer Success Manager (CSM) を支援する AI アシスタントです。
Support Queue の案件を分析し、CSM が素早くアクションを取れるよう、運用アラートを生成してください。

アラート種類の選定基準:
- Urgent        : 本番障害・データ損失・緊急対応が必要（24時間以内の対応が必須）
- Risk          : 解約示唆・長期未解決・SLA 超過・顧客満足度の著しい低下
- Waiting on CSE: CSE チケット起票済みまたは技術エスカレーション待ちで顧客が滞留している
- Opportunity   : 追加機能提案・成功事例の構築・アップセルの文脈がある
- Content Suggestion: 同様の問い合わせが多い、または FAQ/Help 整備で解決できる問題

優先度の基準:
- Critical: 本番停止・データ損失・SLA 重大違反
- High    : 業務に支障あり・24h 以内の対応が必要
- Medium  : 業務への影響があるが代替手段あり
- Low     : 情報収集・改善提案・予防的対応

ルール:
- 必ず日本語で回答する
- 指定された JSON スキーマに厳密に従う
- 1 案件 = 1 アラートを生成する（最も重要なタイプを選ぶ）
- アラートが不要と判断しても必ず 1 件生成する（最もあてはまる type で Low priority）`;

// ── User Prompt ビルダー ──────────────────────────────────────────────────────

export interface AlertPromptExtras {
  cseTickets?: AppCseTicket[];
  aiState?: AppSupportCaseAIState | null;
}

/** AppSupportCase（NocoDB から取得）を使ってプロンプトを構築する */
export function buildSupportAlertPrompt(
  c: AppSupportCase,
  extras: AlertPromptExtras = {},
): string {
  const lines: string[] = [
    '## Support Case',
    `Case ID     : ${c.id}`,
    `Title       : ${c.title}`,
    `Case Type   : ${c.caseType}`,
    `Source      : ${c.source}`,
    `Company     : ${c.company}`,
  ];
  if (c.project) lines.push(`Project     : ${c.project}`);
  lines.push(
    `Severity    : ${c.severity}`,
    `Status      : ${c.routingStatus}`,
    `Team        : ${c.assignedTeam ?? 'Unassigned'}`,
    `Open For    : ${c.openDuration}`,
  );
  if (c.linkedCSETicket) lines.push(`CSE Ticket  : ${c.linkedCSETicket}`);

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
    if (ai.escalationNeeded != null) {
      lines.push(`\nEscalation Needed (triage): ${ai.escalationNeeded}`);
    }
    if (ai.category) {
      lines.push(`Category (triage): ${ai.category}`);
    }
  }

  return lines.join('\n');
}

/**
 * NocoDB 未設定時のフォールバック。
 * UI から渡された CaseContext を使ってプロンプトを構築する。
 */
export function buildSupportAlertPromptFromContext(
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
