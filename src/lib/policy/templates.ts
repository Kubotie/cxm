// ─── 組み込みポリシーテンプレート ───────────────────────────────────────────────
//
// ユーザーが "テンプレートから作る" モードで選択できる初期テンプレート群。
// 各テンプレートは AlertPolicy / SummaryPolicy の partial を持ち、
// ポリシー作成ダイアログでそのまま初期値として使われる。

import type {
  PolicyTemplate,
  AlertPolicy,
  SummaryPolicy,
} from './types';

// ── Alert Policy テンプレート ─────────────────────────────────────────────────

const ALERT_TEMPLATES: PolicyTemplate[] = [
  {
    id:              'tmpl_churn_risk',
    name:            'チャーンリスク',
    description:     'コミュニケーション途絶・アクティブプロジェクトなし・ヘルス低下の複合条件',
    category:        'alert',
    object_type:     'company',
    signal_category: 'risk',
    icon:            '⚠️',
    policy: {
      object_type:     'company',
      signal_category: 'risk',
      scope:           'per_entity',
      condition_logic: 'AND',
      interpretation_mode: 'structured_only',
      structured_conditions: [
        { id: 'c1', field: 'comm_blank_days', operator: 'gte', value: 45, label: '45日以上コミュニケーションなし' },
        { id: 'c2', field: 'active_project_count', operator: 'eq', value: 0, label: 'アクティブプロジェクトなし' },
      ],
      output: {
        severity:           'high',
        title:              'チャーンリスク: {{company_name}}',
        description:        'コミュニケーション {{blank_days}} 日空白、アクティブプロジェクトなし。',
        recommended_action: 'カスタマーサクセスによる関係強化アクションを検討してください。',
        category_tag:       'churn_risk',
      },
    } as Partial<AlertPolicy>,
  },
  {
    id:              'tmpl_comm_blank',
    name:            'コミュニケーション空白',
    description:     '一定期間コミュニケーションがない企業を検出',
    category:        'alert',
    object_type:     'company',
    signal_category: 'risk',
    icon:            '📭',
    policy: {
      object_type:     'company',
      signal_category: 'risk',
      scope:           'per_entity',
      condition_logic: 'AND',
      interpretation_mode: 'structured_only',
      structured_conditions: [
        { id: 'c1', field: 'comm_blank_days', operator: 'gte', value: 30, label: '30日以上コミュニケーションなし' },
      ],
      output: {
        severity:    'medium',
        title:       '通信空白: {{company_name}} ({{blank_days}}日)',
        description: '最終コミュニケーションから {{blank_days}} 日が経過しています。',
        recommended_action: 'メールまたはチャットで近況確認を行ってください。',
        category_tag: 'communication',
      },
    } as Partial<AlertPolicy>,
  },
  {
    id:              'tmpl_expansion_signal',
    name:            '拡張シグナル',
    description:     'アクティブプロジェクト増加・エンゲージメント向上など拡張の機会を検出',
    category:        'alert',
    object_type:     'company',
    signal_category: 'opportunity',
    icon:            '📈',
    policy: {
      object_type:     'company',
      signal_category: 'opportunity',
      scope:           'per_entity',
      condition_logic: 'AND',
      interpretation_mode: 'ai_assisted',
      structured_conditions: [
        { id: 'c1', field: 'active_project_count', operator: 'gte', value: 2, label: 'アクティブプロジェクト2件以上' },
      ],
      ai_hint: '拡張提案に繋がるポジティブシグナルを重視してください',
      output: {
        severity:    'info',
        title:       '拡張機会: {{company_name}}',
        description: '{{active_project_count}} 件のアクティブプロジェクトが稼働中です。',
        recommended_action: 'アップセル・クロスセルの提案タイミングを検討してください。',
        category_tag: 'expansion',
      },
    } as Partial<AlertPolicy>,
  },
  {
    id:              'tmpl_critical_support',
    name:            'Critical サポートケース',
    description:     'Critical 重要度のサポートケースが未解決の企業をアラート',
    category:        'alert',
    object_type:     'company',
    signal_category: 'risk',
    icon:            '🚨',
    policy: {
      object_type:     'company',
      signal_category: 'risk',
      scope:           'per_entity',
      condition_logic: 'AND',
      interpretation_mode: 'structured_only',
      structured_conditions: [
        { id: 'c1', field: 'open_critical_support_count', operator: 'gte', value: 1, label: 'Critical サポートが1件以上' },
      ],
      output: {
        severity:    'critical',
        title:       '未解決 Critical: {{company_name}} ({{count}}件)',
        description: '{{count}} 件の Critical サポートケースが未解決です。',
        recommended_action: 'サポートチームとエスカレーション状況を確認してください。',
        category_tag: 'support_critical',
      },
    } as Partial<AlertPolicy>,
  },
  {
    id:              'tmpl_support_surge',
    name:            'サポートキュー急増',
    description:     '直近にサポートケースが急増したキューを集計ベースで検出',
    category:        'alert',
    object_type:     'support_queue',
    signal_category: 'risk',
    icon:            '🔥',
    policy: {
      object_type:     'support_queue',
      signal_category: 'risk',
      scope:           'aggregate',
      condition_logic: 'AND',
      interpretation_mode: 'structured_only',
      structured_conditions: [
        { id: 'c1', field: 'new_cases_last_24h', operator: 'gte', value: 10, label: '24時間以内に10件以上新規' },
        { id: 'c2', field: 'open_count', operator: 'gte', value: 30, label: 'オープン件数30件以上' },
      ],
      output: {
        severity:    'high',
        title:       'サポートキュー急増 ({{new_count}}件/24h)',
        description: '直近24時間で {{new_count}} 件の新規ケースが発生し、合計 {{open_count}} 件がオープンです。',
        recommended_action: 'CSE リソースの追加配置を検討してください。',
        category_tag: 'queue_surge',
      },
    } as Partial<AlertPolicy>,
  },
  {
    id:              'tmpl_no_decision_maker',
    name:            '意思決定者未登録',
    description:     '意思決定者（Decision Maker）が登録されていない企業をリスクとして検出',
    category:        'alert',
    object_type:     'company',
    signal_category: 'risk',
    icon:            '👤',
    policy: {
      object_type:     'company',
      signal_category: 'risk',
      scope:           'per_entity',
      condition_logic: 'AND',
      interpretation_mode: 'structured_only',
      structured_conditions: [
        { id: 'c1', field: 'decision_maker_count', operator: 'eq', value: 0, label: '意思決定者 0名' },
      ],
      output: {
        severity:    'medium',
        title:       '意思決定者未登録: {{company_name}}',
        description: '組織内に意思決定者 (high influence) が登録されていません。',
        recommended_action: '担当者リストを見直し、キーパーソンを特定・登録してください。',
        category_tag: 'people_risk',
      },
    } as Partial<AlertPolicy>,
  },
];

// ── Summary Policy テンプレート ───────────────────────────────────────────────

const SUMMARY_TEMPLATES: PolicyTemplate[] = [
  {
    id:       'tmpl_company_summary_default',
    name:     'Company Summary（標準）',
    description: 'Evidence・Alert・People を網羅的に分析し、健全性と推奨アクションを生成',
    category: 'summary',
    icon:     '📋',
    policy: {
      target:             'company_summary',
      generation_trigger: 'on_staleness',
      input_scope:        'all_evidence',
      summary_focus:      '顧客の健全性リスク・拡張機会・推奨ネクストアクションを重点的に分析する',
      output_schema: [
        { key: 'summary',               type: 'text',     required: true,  max_length: 400, instruction: '企業全体の状況を400字以内で要約' },
        { key: 'overall_health',        type: 'severity', required: true },
        { key: 'key_risks',             type: 'list',     required: true,  instruction: '主なリスク要因を3件まで列挙' },
        { key: 'key_opportunities',     type: 'list',     required: false, instruction: '主な拡張・アップセル機会を2件まで列挙' },
        { key: 'recommended_next_action', type: 'text',   required: true,  max_length: 200 },
      ],
      freshness_rule: { stale_after_days: 7, auto_regenerate_on_stale: false, force_on_critical_alert: true },
      approval_rule:  'require_review',
    } as Partial<SummaryPolicy>,
  },
  {
    id:       'tmpl_company_summary_weekly',
    name:     'Company Summary（週次自動）',
    description: '毎週月曜に全企業の Summary を自動再生成し、approved でなければ上書き',
    category: 'summary',
    icon:     '🔄',
    policy: {
      target:             'company_summary',
      generation_trigger: 'scheduled',
      schedule_cron:      '0 9 * * 1',  // 毎週月曜 9:00
      input_scope:        'recent_only',
      input_recent_days:  30,
      summary_focus:      '直近30日の変化・トレンドを中心に分析する',
      output_schema: [
        { key: 'summary',               type: 'text',     required: true,  max_length: 300 },
        { key: 'overall_health',        type: 'severity', required: true },
        { key: 'key_risks',             type: 'list',     required: true },
        { key: 'recommended_next_action', type: 'text',   required: true },
      ],
      freshness_rule: { stale_after_days: 7, auto_regenerate_on_stale: true },
      approval_rule:  'auto_approve',
    } as Partial<SummaryPolicy>,
  },
  {
    id:       'tmpl_support_summary_default',
    name:     'Support Summary（標準）',
    description: 'サポートケースの背景・緊急度・推奨対応を分析',
    category: 'summary',
    icon:     '🎧',
    policy: {
      target:             'support_summary',
      generation_trigger: 'manual',
      input_scope:        'all_evidence',
      summary_focus:      '問題の根本原因・対応優先度・顧客への影響を重点的に分析する',
      output_schema: [
        { key: 'issue_summary',     type: 'text',     required: true,  max_length: 300 },
        { key: 'urgency',           type: 'severity', required: true },
        { key: 'root_cause',        type: 'text',     required: false },
        { key: 'recommended_reply', type: 'text',     required: true,  max_length: 400 },
      ],
      freshness_rule: { stale_after_days: 1, auto_regenerate_on_stale: false },
      approval_rule:  'auto_approve',
    } as Partial<SummaryPolicy>,
  },
];

// ── エクスポート ───────────────────────────────────────────────────────────────

export const POLICY_TEMPLATES: PolicyTemplate[] = [
  ...ALERT_TEMPLATES,
  ...SUMMARY_TEMPLATES,
];

export const ALERT_POLICY_TEMPLATES  = ALERT_TEMPLATES;
export const SUMMARY_POLICY_TEMPLATES = SUMMARY_TEMPLATES;

/** 利用可能なフィールド一覧（条件ビルダーのドロップダウン用） */
export const ALERT_CONDITION_FIELDS: Record<
  string,
  { label: string; type: 'number' | 'string' | 'boolean'; objectTypes: string[] }
> = {
  comm_blank_days:              { label: 'コミュニケーション空白日数',        type: 'number',  objectTypes: ['company'] },
  active_project_count:         { label: 'アクティブプロジェクト数',          type: 'number',  objectTypes: ['company'] },
  open_critical_support_count:  { label: 'Critical サポートオープン数',       type: 'number',  objectTypes: ['company'] },
  open_support_count:           { label: 'サポートオープン総数',               type: 'number',  objectTypes: ['company'] },
  decision_maker_count:         { label: '意思決定者数',                       type: 'number',  objectTypes: ['company'] },
  overall_health:               { label: '健全性（overall_health）',          type: 'string',  objectTypes: ['company'] },
  phase_stagnation_days:        { label: 'フェーズ停滞日数',                   type: 'number',  objectTypes: ['company'] },
  open_alert_count:             { label: 'オープンアラート数',                  type: 'number',  objectTypes: ['company'] },
  open_action_count:            { label: 'オープンアクション数',                type: 'number',  objectTypes: ['company'] },
  case_severity:                { label: 'ケース重要度',                        type: 'string',  objectTypes: ['support_case'] },
  case_status:                  { label: 'ケースステータス',                    type: 'string',  objectTypes: ['support_case'] },
  case_waiting_hours:           { label: 'ケース待機時間（時間）',              type: 'number',  objectTypes: ['support_case'] },
  new_cases_last_24h:           { label: '新規ケース数（24h）',                type: 'number',  objectTypes: ['support_queue'] },
  open_count:                   { label: 'キューオープン件数',                  type: 'number',  objectTypes: ['support_queue'] },
};
