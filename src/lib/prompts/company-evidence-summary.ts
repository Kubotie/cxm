// ─── Company Evidence Summary プロンプト定義 ──────────────────────────────────
// このファイルはサーバーサイド専用の API route からのみ import すること。
// OpenAI SDK は import しない。

import type { AppCompany, AppEvidence, AppAlert, AppPerson } from '@/lib/nocodb/types';

// ── レスポンス型 ─────────────────────────────────────────────────────────────

export interface RiskItem {
  title:       string;
  description: string;
}

export interface OpportunityItem {
  title:       string;
  description: string;
}

/** OpenAI が返す構造化データ */
export interface CompanyEvidenceSummaryResult {
  summary:                  string;
  overall_health:           'healthy' | 'at_risk' | 'critical' | 'expanding';
  key_risks:                RiskItem[];
  key_opportunities:        OpportunityItem[];
  recommended_next_action:  string;
}

/** API エンドポイントが返すレスポンス全体 */
export interface CompanyEvidenceSummaryApiResponse extends CompanyEvidenceSummaryResult {
  model:          string;
  generated_at:   string;
  company_uid:    string;
  evidence_count: number;
  alert_count:    number;
  people_count:   number;
  // ── 保存関連（save=true 時のみ） ──────────────────────────────────────────
  saved?:         boolean;
  created?:       boolean;
  save_error?:    string;
}

// ── JSON Schema（Structured Outputs 用）──────────────────────────────────────

export const COMPANY_EVIDENCE_SUMMARY_JSON_SCHEMA = {
  name: 'company_evidence_summary',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      summary: {
        type: 'string' as const,
        description: '企業の現状をまとめたサマリー（3〜5文、日本語）。CSM が顧客に次のアクションを取る前に読む概要として機能する内容にする。',
      },
      overall_health: {
        type: 'string' as const,
        enum: ['healthy', 'at_risk', 'critical', 'expanding'] as const,
        description: '総合的な顧客健全性の評価。healthy=順調, at_risk=要注意, critical=要緊急対応, expanding=拡大機会あり',
      },
      key_risks: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            title:       { type: 'string' as const, description: 'リスクのタイトル（15〜30文字）' },
            description: { type: 'string' as const, description: 'リスクの詳細と影響（1〜2文）' },
          },
          required: ['title', 'description'] as const,
          additionalProperties: false,
        },
        description: 'リスク項目のリスト（0〜3件）。リスクがなければ空配列。',
      },
      key_opportunities: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            title:       { type: 'string' as const, description: 'オポチュニティのタイトル（15〜30文字）' },
            description: { type: 'string' as const, description: 'オポチュニティの詳細と期待インパクト（1〜2文）' },
          },
          required: ['title', 'description'] as const,
          additionalProperties: false,
        },
        description: 'オポチュニティ項目のリスト（0〜3件）。オポチュニティがなければ空配列。',
      },
      recommended_next_action: {
        type: 'string' as const,
        description: 'CSM として最優先で取るべきアクション（1〜2文、具体的かつ actionable に記述）。「確認する」ではなく「誰に・何を・どのチャネルで」まで書く。',
      },
    },
    required: [
      'summary',
      'overall_health',
      'key_risks',
      'key_opportunities',
      'recommended_next_action',
    ] as const,
    additionalProperties: false,
  },
} as const;

// ── System Prompt ─────────────────────────────────────────────────────────────

export const COMPANY_EVIDENCE_SUMMARY_SYSTEM_PROMPT = `あなたは SaaS 企業の Customer Success Manager (CSM) を支援する AI アシスタントです。
顧客企業に関する Evidence（議事録、メール、サポートチケット等）、アラート、People 情報を総合的に分析し、CSM が次のアクションを判断するための Company サマリーを作成してください。

分析の観点:
- Evidence から顧客の現在の状況・課題・期待を把握する
- アラートから潜在的なリスクと拡大機会を識別する
- People 情報から意思決定者とのエンゲージメント状況を評価する
- onboarding フェーズ / 活用フェーズ / 更新 / 拡大などの段階を踏まえてコンテキストを解釈する

ルール:
- 必ず日本語で回答する
- 指定された JSON スキーマに厳密に従う
- 情報が不足している項目は推測せず「情報不足」と記載する
- key_risks と key_opportunities は Evidence / アラートから根拠のあるものだけを挙げる`;

// ── User Prompt ビルダー ──────────────────────────────────────────────────────

export function buildCompanyEvidenceSummaryPrompt(
  company:   AppCompany,
  evidence:  AppEvidence[],
  alerts:    AppAlert[],
  people:    AppPerson[],
): string {
  const lines: string[] = [];

  // ── 企業基本情報 ──
  lines.push(
    '## Company',
    `Name        : ${company.name}`,
    `Phase       : ${company.phaseLabel}`,
    `Owner       : ${company.owner}`,
    `Last Contact: ${company.lastContact}`,
    `Open Alerts : ${company.openAlerts}`,
    `Open Actions: ${company.openActions}`,
    '',
  );

  // ── People ──
  const confirmedPeople = people.filter(p => p.status === 'confirmed');
  const proposedPeople  = people.filter(p => p.status === 'proposed');

  if (people.length > 0) {
    lines.push('## People', '');

    if (confirmedPeople.length > 0) {
      lines.push('### Confirmed People');
      confirmedPeople.forEach(p => {
        const dm = p.decisionInfluence === 'high' ? ' [Decision Maker]' : '';
        lines.push(`- ${p.name} (${p.role})${dm} | evidences: ${p.evidenceCount}`);
      });
      lines.push('');
    }

    if (proposedPeople.length > 0) {
      lines.push('### Proposed / Unresolved People');
      proposedPeople.forEach(p => {
        lines.push(`- ${p.name} (${p.role}) | status: ${p.status}`);
      });
      lines.push('');
    }
  }

  // ── Alerts ──
  if (alerts.length > 0) {
    lines.push('## Open Alerts');
    alerts.filter(a => a.type === 'risk').forEach(a => {
      lines.push(`- [RISK/${a.severity.toUpperCase()}] ${a.title}: ${a.description}`);
    });
    alerts.filter(a => a.type === 'opportunity').forEach(a => {
      lines.push(`- [OPP/${a.severity.toUpperCase()}] ${a.title}: ${a.description}`);
    });
    alerts.filter(a => a.type === 'info').forEach(a => {
      lines.push(`- [INFO] ${a.title}: ${a.description}`);
    });
    lines.push('');
  } else {
    lines.push('## Open Alerts', '（なし）', '');
  }

  // ── Evidence ──
  if (evidence.length === 0) {
    lines.push('## Evidence', '（なし）', '');
  } else {
    lines.push(`## Evidence (${evidence.length}件、新しい順)`);

    // 最大 20 件（プロンプトが肥大化しないよう制限）
    const capped = evidence.slice(0, 20);

    capped.forEach(ev => {
      lines.push('');
      lines.push(`### [${ev.date}] ${ev.title}`);
      lines.push(`Source: ${ev.sourceType} | Status: ${ev.status} | Scope: ${ev.scope}`);
      if (ev.excerpt) {
        lines.push(`Excerpt: ${ev.excerpt}`);
      }
    });

    if (evidence.length > 20) {
      lines.push('', `※ 他 ${evidence.length - 20} 件の Evidence は省略されています。`);
    }
  }

  return lines.join('\n');
}
