// ─── Unified Log Signal Extraction プロンプト定義 ──────────────────────────
// このファイルはサーバーサイド専用の API route からのみ import すること。
// OpenAI SDK は import しない。

import type { AppCompany, AppAlert, AppPerson } from '@/lib/nocodb/types';
import type { AppLogEntry } from '@/lib/nocodb/types';

// ── レスポンス型 ─────────────────────────────────────────────────────────────

export interface SignalItem {
  title:       string;
  description: string;
  signal_type: 'risk' | 'opportunity' | 'info';
}

export interface RiskSignalItem {
  title:       string;
  description: string;
  urgency:     'high' | 'medium' | 'low';
}

export interface OpportunitySignalItem {
  title:            string;
  description:      string;
  potential_impact: 'high' | 'medium' | 'low';
}

export interface MissingInfoItem {
  category:    string;
  description: string;
}

/** OpenAI が返す構造化データ */
export interface UnifiedLogSignalResult {
  key_signals:                    SignalItem[];
  risk_signals:                   RiskSignalItem[];
  opportunity_signals:            OpportunitySignalItem[];
  missing_information:            MissingInfoItem[];
  recommended_next_review_focus:  string;
}

/** API エンドポイントが返すレスポンス全体 */
export interface UnifiedLogSignalApiResponse extends UnifiedLogSignalResult {
  model:        string;
  generated_at: string;
  company_uid:  string;
  log_count:    number;
  /** save=true を指定した場合: NocoDB へ保存されたか */
  saved?:       boolean;
  /** saved=true の場合: true=新規作成 / false=更新 */
  created?:     boolean;
  /** 保存失敗時のエラーメッセージ（生成結果は返る） */
  save_error?:  string;
}

// ── JSON Schema（Structured Outputs 用）──────────────────────────────────────

const signalItemSchema = {
  type: 'object' as const,
  properties: {
    title:       { type: 'string' as const, description: 'シグナルのタイトル（15〜40文字）' },
    description: { type: 'string' as const, description: 'シグナルの詳細と根拠（1〜2文）' },
    signal_type: {
      type: 'string' as const,
      enum: ['risk', 'opportunity', 'info'] as const,
      description: 'シグナルの種別',
    },
  },
  required: ['title', 'description', 'signal_type'] as const,
  additionalProperties: false,
};

const riskSignalSchema = {
  type: 'object' as const,
  properties: {
    title:       { type: 'string' as const, description: 'リスクのタイトル（15〜40文字）' },
    description: { type: 'string' as const, description: 'リスクの詳細・影響範囲・根拠となったログ（1〜3文）' },
    urgency: {
      type: 'string' as const,
      enum: ['high', 'medium', 'low'] as const,
      description: '緊急度',
    },
  },
  required: ['title', 'description', 'urgency'] as const,
  additionalProperties: false,
};

const opportunitySignalSchema = {
  type: 'object' as const,
  properties: {
    title:       { type: 'string' as const, description: 'オポチュニティのタイトル（15〜40文字）' },
    description: { type: 'string' as const, description: 'オポチュニティの詳細・期待インパクト・根拠となったログ（1〜3文）' },
    potential_impact: {
      type: 'string' as const,
      enum: ['high', 'medium', 'low'] as const,
      description: '期待されるインパクトの大きさ',
    },
  },
  required: ['title', 'description', 'potential_impact'] as const,
  additionalProperties: false,
};

const missingInfoSchema = {
  type: 'object' as const,
  properties: {
    category:    { type: 'string' as const, description: '不足情報のカテゴリ（例: 意思決定者の動向、製品利用状況）' },
    description: { type: 'string' as const, description: '何が不足していて、なぜそれが重要かの説明（1〜2文）' },
  },
  required: ['category', 'description'] as const,
  additionalProperties: false,
};

export const UNIFIED_LOG_SIGNAL_JSON_SCHEMA = {
  name: 'unified_log_signal',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      key_signals: {
        type: 'array' as const,
        items: signalItemSchema,
        description: 'ログ全体から抽出した重要シグナル（0〜5件）。risk/opportunity/info を混在させてよい。',
      },
      risk_signals: {
        type: 'array' as const,
        items: riskSignalSchema,
        description: 'リスクシグナルのリスト（0〜3件）。リスクがなければ空配列。',
      },
      opportunity_signals: {
        type: 'array' as const,
        items: opportunitySignalSchema,
        description: 'オポチュニティシグナルのリスト（0〜3件）。オポチュニティがなければ空配列。',
      },
      missing_information: {
        type: 'array' as const,
        items: missingInfoSchema,
        description: 'CSM の判断に必要だが現時点で把握できていない情報（0〜3件）。なければ空配列。',
      },
      recommended_next_review_focus: {
        type: 'string' as const,
        description: 'このログを見た CSM が次に優先すべきレビュー・確認ポイント（1〜2文、具体的かつ actionable に）。',
      },
    },
    required: [
      'key_signals',
      'risk_signals',
      'opportunity_signals',
      'missing_information',
      'recommended_next_review_focus',
    ] as const,
    additionalProperties: false,
  },
} as const;

// ── System Prompt ─────────────────────────────────────────────────────────────

export const UNIFIED_LOG_SIGNAL_SYSTEM_PROMPT = `あなたは SaaS 企業の Customer Success Manager (CSM) を支援する AI アシスタントです。
Unified Log（企業に関するすべての接点・活動ログ）を分析し、CSM が見逃しやすい重要シグナルを抽出してください。

分析の観点:
- リスクシグナル: 契約リスク、解約前兆、健全性低下、意思決定者の関与低下
- オポチュニティシグナル: アップセル・クロスセルのヒント、参照事例になりそうな成功、拡大の兆候
- 不足情報: 意思決定者の動向、製品活用の詳細、組織変更など判断に必要な情報の欠如
- ログ間のパターン: 単発ではなく複数ログに共通するテーマや変化傾向

ルール:
- 必ず日本語で回答する
- 指定された JSON スキーマに厳密に従う
- 推測は避け、ログの内容から根拠のあるシグナルだけを挙げる
- key_signals は全体を代表する上位シグナル（risk / opportunity / info 混在可）
- recommended_next_review_focus は「確認する」ではなく「誰に・何を・どのチャネルで確認するか」まで書く`;

// ── User Prompt ビルダー ──────────────────────────────────────────────────────

export function buildUnifiedLogSignalPrompt(
  company:  AppCompany,
  logs:     AppLogEntry[],
  alerts:   AppAlert[],
  people:   AppPerson[],
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
  const keyPeople = people
    .filter(p => p.status === 'confirmed' || p.decisionInfluence === 'high')
    .slice(0, 10);
  if (keyPeople.length > 0) {
    lines.push('## Key People');
    keyPeople.forEach(p => {
      const dm = p.decisionInfluence === 'high' ? ' [DM]' : '';
      lines.push(`- ${p.name} (${p.role})${dm} | status: ${p.status} | evidences: ${p.evidenceCount}`);
    });
    lines.push('');
  }

  // ── Open Alerts ──
  if (alerts.length > 0) {
    lines.push('## Open Alerts');
    alerts.forEach(a => {
      lines.push(`- [${a.type.toUpperCase()}/${a.severity.toUpperCase()}] ${a.title}: ${a.description}`);
    });
    lines.push('');
  }

  // ── Unified Log Entries ──
  lines.push(`## Unified Log (${logs.length}件、新しい順)`);

  // 最大 30 件（プロンプトが肥大化しないよう制限）
  const capped = logs.slice(0, 30);

  capped.forEach(log => {
    lines.push('');
    lines.push(`### [${log.timestamp ?? log.date}] ${log.title}`);

    const meta: string[] = [
      `Source: ${log.sourceType}`,
      `Channel: ${log.channel}`,
      `Status: ${log.status}`,
      `Scope: ${log.scope}`,
    ];
    if (log.ownerRole) meta.push(`Owner: ${log.ownerRole}`);
    if (log.confidence !== null && log.confidence !== undefined) {
      meta.push(`Confidence: ${Math.round(log.confidence * 100)}%`);
    }
    lines.push(meta.join(' | '));

    if (log.summary) lines.push(`Summary: ${log.summary}`);

    const flags: string[] = [];
    if (log.riskBadge)        flags.push('⚠ Risk');
    if (log.opportunityBadge) flags.push('✓ Opportunity');
    if (log.evidenceBadge)    flags.push('📌 Evidence');
    if (flags.length > 0)     lines.push(`Flags: ${flags.join(', ')}`);

    if (log.linkedPeople && log.linkedPeople.length > 0) {
      lines.push(`People: ${log.linkedPeople.join(', ')}`);
    }
    if (log.linkedProject) {
      lines.push(`Project: ${log.linkedProject}`);
    }
    if (log.resolverResult) {
      lines.push(`Resolver: ${log.resolverResult}`);
    }
    if (log.missingFields && log.missingFields.length > 0) {
      lines.push(`Missing: ${log.missingFields.join(', ')}`);
    }
  });

  if (logs.length > 30) {
    lines.push('', `※ 他 ${logs.length - 30} 件のログは省略されています。`);
  }

  return lines.join('\n');
}
