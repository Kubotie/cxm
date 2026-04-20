// ─── Support Alert プロンプト定義 ─────────────────────────────────────────────
// このファイルはサーバー・クライアント両側で import 可能（副作用なし）。
// OpenAI SDK は import しない。

import type { AppSupportCase, AppSupportCaseAIState, AppCseTicket } from '@/lib/nocodb/types';
import type { CaseContext } from '@/lib/support/ai-types';

// ── レスポンス型 ─────────────────────────────────────────────────────────────

/** 運用アラートの種別 */
export type AlertType =
  | 'response_delay'
  | 'high_severity_case'
  | 'escalation_risk'
  | 'cse_required'
  | 'repeated_issue'
  | 'churn_risk'
  | 'vip_customer_issue'
  | 'content_suggestion';

/** OpenAI が返す構造化データ */
export interface SupportAlertResult {
  alert_type: AlertType;
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
        enum: [
          'response_delay',
          'high_severity_case',
          'escalation_risk',
          'cse_required',
          'repeated_issue',
          'churn_risk',
          'vip_customer_issue',
          'content_suggestion',
        ] as const,
        description: [
          '運用アラートの種別（優先度が高い順）:',
          '  response_delay     — 返信・対応が遅延しており顧客が待機中',
          '  high_severity_case — 本番障害・データ損失・業務停止など重大インシデント',
          '  escalation_risk    — このまま放置するとエスカレーションが必要になるリスク',
          '  cse_required       — CSE への技術エスカレーションが必要な問題',
          '  repeated_issue     — 同じ問題が繰り返し発生している',
          '  churn_risk         — 解約示唆・不満表明・長期未解決による解約リスク',
          '  vip_customer_issue — 重要顧客・大口顧客の問題（通常より優先対応が必要）',
          '  content_suggestion — FAQ/Help 整備で解決できる問い合わせ（最低優先度。他に該当なし時のみ選択）',
        ].join('\n'),
      },
      priority: {
        type: 'string' as const,
        enum: ['Critical', 'High', 'Medium', 'Low'] as const,
        description: [
          '優先度:',
          '  Critical — 本番停止・データ損失・即時対応が必須（1時間以内）',
          '  High     — 業務に直接支障あり、24時間以内の対応が必要',
          '  Medium   — 業務影響あり・代替手段はあるが早期対応を推奨（3日以内）',
          '  Low      — 情報収集・改善提案のみで緊急性なし。content_suggestion はほぼ Low',
        ].join('\n'),
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
Support Queue の案件を分析し、CSM が優先対応すべき「運用アラート」を 1 件生成してください。

## alert_type の選定優先順（上から順に評価し、最初に該当したものを選ぶ）

1. high_severity_case
   - 本番環境の停止・データ損失・重大なバグで業務停止が発生している
   - 顧客が「緊急」「すぐ対応してほしい」「使えない」と明示している

2. response_delay
   - 前回の顧客メッセージから 24 時間以上が経過しているのに未返信
   - 顧客が複数回フォローアップしている
   - 返信待ちで顧客の業務が止まっている

3. churn_risk
   - 解約・退会・他社への乗り換えを示唆する発言がある
   - 強い不満・失望・不信感を表明している
   - 長期（7日以上）未解決で顧客が明らかに苛立っている

4. escalation_risk
   - 現在の担当では解決できず上位への対応依頼が必要になる見込み
   - 複数部署・複数担当者の調整が必要
   - 技術的に複雑で CSE なしには解決できない（まだ CSE 未起票）

5. cse_required
   - CSE チケットが起票済みまたは技術エスカレーション中で顧客が待機している
   - API・インフラ・バグ修正など開発チームの対応が必要

6. repeated_issue
   - 同じ顧客から同種の問い合わせが 2 回以上来ている
   - 既知の問題・バグが再発している

7. vip_customer_issue
   - 重要顧客・大口顧客・エグゼクティブからの問い合わせ
   - SLA が厳しい契約の顧客

8. content_suggestion
   - 上記 1〜7 のいずれにも該当しない場合のみ選択
   - FAQ や Help ドキュメントで解決できる一般的な問い合わせ
   - 「タイトルが短い」「情報が少ない」だけでは content_suggestion にしない

## 優先度の判定

- Critical : 本番停止・データ損失・即時対応が必須。high_severity_case かつ業務停止時のみ
- High     : 業務に直接支障あり・24h 以内の対応が必要（response_delay / churn_risk / cse_required 等）
- Medium   : 業務影響あり・早期対応推奨（3 日以内）
- Low      : content_suggestion は原則 Low。緊急性のない改善提案のみ

content_suggestion の場合でも、単なる「情報不足」ではなく具体的な改善提案を記述すること。

## 出力ルール
- 必ず日本語で回答する
- 指定された JSON スキーマに厳密に従う
- 1 案件 = 1 アラートを生成する（上記優先順で最初に該当したものを選ぶ）
- title は Original Message の内容を読んで「何が・誰に・どんな状態か」を 20〜40 文字で具体的に記述する
  - ケース名やタイトルが提供されていない場合でも、body の内容を要約して適切なタイトルを生成すること
  - 「タイトルなし」「タイトルが未設定」「情報不足」などをそのまま title にしてはならない
- summary は状況の事実を 2〜3 文で記述する（主観的評価ではなく事実ベース）
- suggested_action は「誰が・何を・いつまでに」を具体的に記述する`;

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
  ];
  // title が空の場合は省略（Original Message の body から内容を判断させる）
  if (c.title && c.title.trim()) {
    lines.push(`Title       : ${c.title}`);
  }
  lines.push(
    `Case Type   : ${c.caseType}`,
    `Source      : ${c.source}`,
    `Company     : ${c.company}`,
  );
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
