// ─── Company Evidence Summary プロンプト定義 ──────────────────────────────────
// このファイルはサーバーサイド専用の API route からのみ import すること。
// OpenAI SDK は import しない。

import type { AppCompany, AppEvidence, AppAlert, AppPerson } from '@/lib/nocodb/types';
import type { ProjectAggregateVM } from '@/lib/company/project-aggregate';
import type { SupportAggregateVM } from '@/lib/nocodb/support-by-company';
import { buildProjectAISummary } from '@/lib/company/project-aggregate';

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
  /** プロンプトに含めた Project 件数（undefined = 取得なし） */
  project_count?:      number;
  /** プロンプトに含めた Intercom + CSE オープン件数合計（undefined = 取得なし） */
  open_support_count?: number;
  // ── 保存関連（save=true 時のみ） ──────────────────────────────────────────
  saved?:         boolean;
  created?:       boolean;
  save_error?:    string;
  // ── Policy 適用情報（policy_id 指定時のみ） ────────────────────────────────
  applied_policy_id?:            string | null;
  applied_policy_name?:          string;
  /** Policy の summary_focus（生成フォーカス説明）。tooltip 表示用。 */
  applied_policy_summary_focus?: string | null;
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
        description: [
          '企業を攻略するための CSM 向けサマリー（3〜5文、日本語）。',
          '以下の順で述べること:',
          '① 直近の変化・現在地（最近何が起きたか、フェーズ・状況の把握）',
          '② 機会・活性化・攻略余地（upsell/拡大/活用促進の余地、プロジェクト稼働）',
          '③ リスク・要注意事項（チャーンリスク、サポート逼迫等）',
          '④ 次の一手（最重要アクション 1つ）',
          '例外: overall_health=critical の場合はリスクを先に述べてよい。',
          '監視レポートではなく「打ち手を判断するための情報」として書く。',
        ].join(' '),
      },
      overall_health: {
        type: 'string' as const,
        enum: ['healthy', 'at_risk', 'critical', 'expanding'] as const,
        description: [
          '総合的な顧客健全性の評価。',
          'healthy=順調に活用中（リスクシグナルが少ない）、',
          'at_risk=複数のリスクシグナルが重なる・複合的に要注意、',
          'critical=緊急対応が必要（support critical / チャーン直前）、',
          'expanding=明確な拡大・upsell機会あり かつ健全。',
          '重要: 単一の懸念（support件数のみ・project停滞のみ・communication空白のみ）だけで at_risk にしない。',
          '複数の異なる懸念が重なる場合、または明確なチャーンシグナルがある場合のみ at_risk とすること。',
        ].join(' '),
      },
      key_opportunities: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            title:       { type: 'string' as const, description: 'オポチュニティのタイトル（15〜30文字）' },
            description: { type: 'string' as const, description: '機会の根拠と期待インパクト（1〜2文）。actionable な観点を含める。' },
          },
          required: ['title', 'description'] as const,
          additionalProperties: false,
        },
        description: '攻略・拡大・活性化の機会リスト（0〜3件）。summary の② で述べた機会をここに詳述する。機会がなければ空配列。無理に機会を作らない。',
      },
      key_risks: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            title:       { type: 'string' as const, description: 'リスクのタイトル（15〜30文字）' },
            description: { type: 'string' as const, description: 'リスクの根拠と影響（1〜2文）' },
          },
          required: ['title', 'description'] as const,
          additionalProperties: false,
        },
        description: '要注意リスクのリスト（0〜3件）。summary の③ で述べたリスクをここに詳述する。リスクがなければ空配列。不安を作らない。',
      },
      recommended_next_action: {
        type: 'string' as const,
        description: [
          'CSM として最優先で取るべきアクション（1文のみ・50〜80字）。',
          '「誰に・何を・どのチャネルで・なぜ」を1文に収める。複数テーマを1文に詰め込まない。',
          '複数候補がある場合は最優先の1つだけを書く。',
          'overall_health=critical または重大リスクがある場合はリスク解消を起点とする。',
          'そうでない場合は機会実現・関係深化・フェーズ推進を起点とする。',
          'summary・key_opportunities・key_risks の内容と矛盾しないこと。',
        ].join(' '),
      },
    },
    required: [
      'summary',
      'overall_health',
      'key_opportunities',
      'key_risks',
      'recommended_next_action',
    ] as const,
    additionalProperties: false,
  },
} as const;

// ── System Prompt ─────────────────────────────────────────────────────────────

export const COMPANY_EVIDENCE_SUMMARY_SYSTEM_PROMPT = `あなたは SaaS 企業の Customer Success Manager (CSM) を支援する AI アシスタントです。
顧客企業に関する Evidence（議事録、メール、サポートチケット等）、アラート、People 情報、Project 利用状況、Support 状況を総合的に分析し、CSM が企業を「攻略」するための Company サマリーを作成してください。

## このサマリーの目的
「監視レポート」ではなく「攻略情報」です。
少人数の CSM チームが動いているため、「何を見るべきか」より「何をすべきか」を優先して伝えてください。
Project / Support / People / Communication の情報を統合し、変化と打ち手を優先的に示してください。

## summary 本文の構成順序
通常ケースでは以下の順で述べること:
1. 直近の変化・現在地（最近何が起きたか、フェーズ・状況）
2. 機会・活性化・攻略余地（upsell/拡大/活用促進の余地、プロジェクト稼働状況）
3. リスク・要注意事項（チャーンリスク、サポート逼迫、コミュニケーション断絶など）
4. 次の一手（最重要アクション 1つ）

例外: overall_health=critical の場合（または重大リスクが明確な場合）は、リスクを先に述べてよい。

**冒頭1文の補助ルール（重要）**: summary の最初の1文は「直近の変化」または「現在フェーズ・状況の説明」で始めること。リスク言及で始めるのは overall_health=critical の場合のみ。

## key_opportunities / key_risks / recommended_next_action との整合
- summary で述べた機会は key_opportunities に、リスクは key_risks にも詳述する
- recommended_next_action は summary・key_opportunities・key_risks の内容から一貫して導く
- 役割分担: summary=概観、key_*=根拠・詳細、action=実行指示

## バランスのルール
- リスクがない企業で無理に不安を作らない
- 重大リスクがある企業で機会だけを前面に出さない
- 「攻略順」だが「現実を歪めない」ことを最優先とする
- 情報不足の項目は推測せず「情報不足」と記載する

## 分析の観点
- Evidence から顧客の現在の状況・課題・期待を把握する
- アラートから潜在的なリスクと拡大機会を識別する
- People 情報から意思決定者とのエンゲージメント状況を評価する
- onboarding / 活用 / 更新 / 拡大などのフェーズを踏まえてコンテキストを解釈する
- Project 利用状況（active/stalled/unused・L30活動量）からチャーン予兆と有償転換・拡張機会を評価する
- Support 負荷（Intercom オープン件数・CSE チケット深刻度・長期待機）から隠れたリスクと対応緊急度を識別する

## データ不足時のルール（重要）
- Evidence が 0〜1件 の場合: summary の冒頭に「Evidence が少ないため Project / Support 情報を中心に分析する」旨を1文追記する
- People が 0件 の場合: 意思決定者・担当者への言及は避ける（存在しない情報から推測しない）
- Evidence / People / Alert の全てが乏しい場合: Project / Support を根拠とし「〜が示唆されるが詳細は Evidence 確認が必要」等の補助表現を使う
- データが薄い項目は推測で補完せず「情報不足」と明記する
- Project 情報のみが充実している場合: key_opportunities の説明が Project 依存になることを避けるため、根拠の出所（「Project 稼働状況より」等）を明示する

## 出力ルール
- 必ず日本語で回答する
- 指定された JSON スキーマに厳密に従う
- key_opportunities と key_risks は Evidence / アラート / Project / Support から根拠のあるものだけを挙げる

## プロジェクトスコアの解釈

各プロジェクトには 3 つのスコアが付与される場合がある（0-100、高いほど良い）:

- Health Score: 直近の利用健全性（PV 消費量・Campaign 稼働数・最近の操作履歴・モジュール閲覧量を時間減衰付きで評価）
- Depth Score: 機能の深度利用（ABTest / Goal / UserGroup / Funnel / Event など高度機能の実運用度）
- Breadth Score: 機能の横断利用（Heatmap / Goal / UserGroup / Segment / Campaign 等を幅広く使えているか）

スコア解釈の目安:
- Health 高・Depth 高・Breadth 高 → 理想的な利活用状態
- Health 高・Depth 低 → 最近は触っているが使い方が浅い → 深度利用の支援機会
- Health 低・Depth 高 → 昔はしっかり設計したが最近活動が鈍い → 再活性化の支援機会
- Breadth のみ低い → 特定機能への偏重 → 機能拡張提案の機会
- スコアが提供されていない場合は言及しない

## FREE プランプロジェクトの扱い（重要）

paid_type = FREE のプロジェクト（FREE未活用として表示）は：
- 「未活用プロジェクトの利活用支援」の opportunity として **挙げない**
- リスク判定・health 評価の対象から **除外**（既にシグナル計算で除外済み）
- FREE未活用件数は参考情報として利用してよいが、CSM アクションを促す根拠にしない`;

// ── Summary Policy を反映したシステムプロンプトビルダー ────────────────────────
//
// SummaryPolicy の summary_focus と output_schema をベースプロンプトに追記する。
// policy が null の場合はベースプロンプトをそのまま返す。

import type { SummaryPolicy, OutputSchemaField } from '@/lib/policy/types';

export function buildSummaryPolicySystemPrompt(
  policy: Partial<SummaryPolicy> | null,
): string {
  if (!policy) return COMPANY_EVIDENCE_SUMMARY_SYSTEM_PROMPT;

  const lines: string[] = [COMPANY_EVIDENCE_SUMMARY_SYSTEM_PROMPT];

  if (policy.summary_focus) {
    lines.push(
      '',
      '## ポリシー指示（最優先・上記のデフォルトルールより優先して従うこと）',
      '以下の指示はデフォルトの構成順・バランスルールを上書きする。必ずこの指示に従うこと。',
      '',
      policy.summary_focus,
    );
  }

  if (policy.output_schema && policy.output_schema.length > 0) {
    const fieldInstructions = policy.output_schema
      .filter((f: OutputSchemaField) => f.instruction)
      .map((f: OutputSchemaField) => `- ${f.key}: ${f.instruction}`)
      .join('\n');
    if (fieldInstructions) {
      lines.push('', '## 各フィールドの出力指示（ポリシー指定・最優先）', fieldInstructions);
    }
  }

  return lines.join('\n');
}

// ── User Prompt ビルダー ──────────────────────────────────────────────────────

export interface CompanyEvidenceSummaryPromptOptions {
  /** Project 利用状況集計（ProjectAggregateVM）。指定時に ## Projects セクションを追加 */
  projects?: ProjectAggregateVM;
  /** Support / CSE 状況集計（SupportAggregateVM）。指定時に ## Support セクションを追加 */
  support?:  SupportAggregateVM;
}

export function buildCompanyEvidenceSummaryPrompt(
  company:   AppCompany,
  evidence:  AppEvidence[],
  alerts:    AppAlert[],
  people:    AppPerson[],
  options?:  CompanyEvidenceSummaryPromptOptions,
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
    // 機会 → リスク → 情報 の順で列挙（summary 本文の構成順序に合わせる）
    alerts.filter(a => a.type === 'opportunity').forEach(a => {
      lines.push(`- [OPP/${a.severity.toUpperCase()}] ${a.title}: ${a.description}`);
    });
    alerts.filter(a => a.type === 'risk').forEach(a => {
      lines.push(`- [RISK/${a.severity.toUpperCase()}] ${a.title}: ${a.description}`);
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

  // ── Projects（オプション）──────────────────────────────────────────────────
  // 利用活動量・停滞状況・upsell 余地を AI に伝える。
  // key_risks（停滞・全未活用）と key_opportunities（有償転換・拡張）の根拠として使用。
  if (options?.projects) {
    lines.push('');
    lines.push(`## Projects (${options.projects.total}件)`);
    lines.push(buildProjectAISummary(options.projects));
  }

  // ── Support / CSE（オプション）────────────────────────────────────────────
  // サポート負荷・CSE 深刻度を AI に伝える。
  // key_risks（サポート逼迫・長期滞留）の根拠として使用。
  if (options?.support) {
    const sv = options.support;
    lines.push('');
    lines.push('## Support / CSE 状況');
    lines.push(
      `Intercom オープン: ${sv.openIntercomCount}件 | CSE オープン: ${sv.openCseCount}件` +
      ` | Critical: ${sv.criticalCount} | High: ${sv.highCount} | CSE待ち: ${sv.waitingCseCount}件`,
    );

    // CSE チケット（上位5件、待機時間付き）
    if (sv.cseTickets.length > 0) {
      const longWaiting = sv.cseTickets.filter(t => (t.waitingHours ?? 0) > 48);
      if (longWaiting.length > 0) {
        lines.push(`長期待機（48h超）: ${longWaiting.length}件`);
      }
      lines.push('');
      lines.push('### 直近 CSE チケット');
      sv.cseTickets.slice(0, 5).forEach(t => {
        const waiting = t.waitingHours ? ` 待機${t.waitingHours}h` : '';
        const title   = t.title && t.title !== '(タイトルなし)'
          ? t.title
          : (t.description ?? '').slice(0, 40) || '(不明)';
        lines.push(`- [${(t.priority ?? 'UNKNOWN').toUpperCase()}] ${title} (${t.status}${waiting})`);
      });
    }

    // Intercom ケース（上位5件）
    if (sv.recentCases.length > 0) {
      lines.push('');
      lines.push('### 直近 Intercom ケース');
      sv.recentCases.slice(0, 5).forEach(c => {
        lines.push(`- [${(c.severity ?? 'UNKNOWN').toUpperCase()}] ${c.title} (${c.routingStatus})`);
      });
    }
  }

  return lines.join('\n');
}
