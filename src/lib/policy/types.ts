// ─── Policy / Rules 型定義 ─────────────────────────────────────────────────────
//
// Alert Policy:  会社・サポートに対する alert 生成条件を構造化して保存する。
// Summary Policy: AI Summary の生成ルール（トリガー・入力範囲・出力仕様）を保存する。
//
// 設計方針:
//   - 構造化条件 (structured_conditions) + 自然言語意図 (nl_condition) の併用
//   - interpretation_mode で "構造のみ" / "AI 補助" / "NL 主体" を切り替え
//   - output はテンプレート変数 {{variable}} 対応
//   - status は draft → active → paused のライフサイクル

// ── 共通 ──────────────────────────────────────────────────────────────────────

export type PolicyStatus = 'draft' | 'active' | 'paused';

// ── Alert Policy ──────────────────────────────────────────────────────────────

export type AlertObjectType =
  | 'company'
  | 'support_case'
  | 'support_queue';

export type AlertSignalCategory = 'risk' | 'opportunity';

/** per_entity: 1社/1件ずつ評価。aggregate: キュー全体・企業群を集計して評価 */
export type AlertScope = 'per_entity' | 'aggregate';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** 構造条件の比較演算子 */
export type ConditionOperator =
  | 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'
  | 'in' | 'not_in'
  | 'contains' | 'not_contains'
  | 'is_null' | 'is_not_null'
  | 'regex';

/** AI 解釈モード */
export type InterpretationMode =
  | 'structured_only'   // 構造条件のみで判定
  | 'ai_assisted'       // 構造条件 + AI が曖昧部分を補完
  | 'nl_primary';       // 自然言語をAIが直接評価（構造条件は参考）

/** 1つの構造化条件 */
export interface StructuredCondition {
  id:       string;
  field:    string;             // e.g. "open_support_count", "comm_blank_days"
  operator: ConditionOperator;
  value:    number | string | string[] | boolean | null;
  /** 人間向けの説明（例: "直近30日間通信なし"） */
  label?:   string;
}

/** セグメント絞り込み（対象を特定の顧客群に限定） */
export interface SegmentFilter {
  id:       string;
  field:    string;             // e.g. "plan", "owner_email", "phase"
  operator: 'in' | 'not_in' | 'eq' | 'neq' | 'contains';
  value:    string[];
  label?:   string;
}

/** Alert の出力仕様（テンプレート変数 {{field}} 対応） */
export interface AlertPolicyOutput {
  severity:           AlertSeverity;
  title:              string;   // e.g. "{{company_name}}: コミュニケーション空白 {{blank_days}}日"
  description:        string;
  recommended_action?: string;
  /** Alert のカテゴリ分類（UI 表示グループ用） */
  category_tag?:      string;
}

export interface AlertPolicy {
  id:          string;
  name:        string;
  description?: string;

  // 対象
  object_type:      AlertObjectType;
  signal_category:  AlertSignalCategory;
  scope:            AlertScope;

  // 条件
  structured_conditions: StructuredCondition[];
  /** 複数条件の結合方法 */
  condition_logic:  'AND' | 'OR';
  segment_filter?:  SegmentFilter[];

  // 自然言語 / AI
  nl_condition?:         string;  // 元の自然言語意図
  interpretation_mode:   InterpretationMode;
  ai_hint?:              string;  // AI に渡す追加コンテキスト

  // 出力
  output: AlertPolicyOutput;

  // ライフサイクル
  status:      PolicyStatus;
  version:     number;
  created_at:  string;
  updated_at:  string;
  created_by?: string;

  // 運用トラッキング
  last_preview_at?:        string;
  last_preview_hit_count?: number;
  /** このポリシーから生成された alert の実数（運用中） */
  live_alert_count?:       number;
}

// ── Summary Policy ────────────────────────────────────────────────────────────

export type SummaryTarget =
  | 'company_summary'
  | 'support_summary';

export type GenerationTrigger =
  | 'manual'        // 手動のみ
  | 'scheduled'     // cron
  | 'on_staleness'  // freshness が stale になったとき
  | 'on_event';     // 特定イベント発生時（alert 生成・support オープン等）

export type ApprovalRule =
  | 'auto_approve'     // 生成後自動で approved
  | 'require_review'   // reviewed が必要
  | 'require_approval' // approved が必要（CSM リード等）
  | 'locked';          // 外部でロック

export type InputScope =
  | 'all_evidence'       // すべての evidence
  | 'recent_only'        // 直近 N 日
  | 'high_signal_only'   // スコアが高い evidence のみ
  | 'custom';            // カスタム絞り込み

export interface FreshnessRule {
  /** この日数を超えると stale になる */
  stale_after_days:         number;
  /** stale になったとき自動再生成するか */
  auto_regenerate_on_stale: boolean;
  /** critical アラートがある場合は即時再生成 */
  force_on_critical_alert?: boolean;
}

export interface OutputSchemaField {
  key:           string;   // e.g. "summary", "key_risks", "overall_health"
  type:          'text' | 'list' | 'severity' | 'score' | 'date';
  required:      boolean;
  max_length?:   number;
  /** このフィールドに対する追加生成指示 */
  instruction?:  string;
}

export interface SummaryPolicy {
  id:          string;
  name:        string;
  description?: string;

  // 対象
  target: SummaryTarget;

  // 生成トリガー
  generation_trigger: GenerationTrigger;
  schedule_cron?:     string;   // trigger = 'scheduled' 時のみ

  // 入力範囲
  input_scope:          InputScope;
  input_recent_days?:   number;        // scope = 'recent_only' 時
  evidence_types?:      string[];      // 含める evidence タイプ
  min_evidence_count?:  number;        // これ未満ならスキップ

  // フォーカス・出力
  summary_focus:          string;           // 生成に重点を置く観点（NL）
  output_schema:          OutputSchemaField[];
  system_prompt_override?: string;          // ベースプロンプトを上書き（上級者向け）
  model?:                 string;           // 使用モデル（省略時はデフォルト）

  // 品質管理
  freshness_rule: FreshnessRule;
  approval_rule:  ApprovalRule;

  // ライフサイクル
  status:      PolicyStatus;
  version:     number;
  created_at:  string;
  updated_at:  string;
  created_by?: string;

  // 運用トラッキング
  last_run_at?:          string;
  last_run_success_count?: number;
  last_run_fail_count?:    number;
}

// ── NL パース API の I/O ───────────────────────────────────────────────────────

export interface NlParseRequest {
  nl_input:       string;
  object_type:    AlertObjectType;
  signal_category: AlertSignalCategory;
}

export interface NlParseResponse {
  proposed_conditions: StructuredCondition[];
  proposed_output:     AlertPolicyOutput;
  condition_logic:     'AND' | 'OR';
  interpretation_note: string;  // AI の判断根拠説明
  confidence:          'high' | 'medium' | 'low';
}

// ── Preview API の I/O ────────────────────────────────────────────────────────

export interface PolicyPreviewRequest {
  policy: Partial<AlertPolicy>;
  limit?: number;
}

export interface PolicyPreviewHit {
  entity_id:    string;
  entity_name:  string;
  entity_type:  AlertObjectType;
  match_reason: string[];         // どの条件にマッチしたか
  would_severity: AlertSeverity;
  would_title:    string;
  current_alerts: number;         // 現在の alert 数
}

export interface PolicyPreviewResponse {
  hit_count:           number;
  total_evaluated:     number;
  match_rate_pct:      number;
  top_hits:            PolicyPreviewHit[];
  new_alerts_count:    number;   // 現在存在しない → 新規生成される数
  removed_alerts_count: number; // 既存にあるが条件外 → 解除される数
  preview_at:          string;
}

// ── テンプレート ──────────────────────────────────────────────────────────────

export interface PolicyTemplate {
  id:              string;
  name:            string;
  description:     string;
  category:        'alert' | 'summary';
  object_type?:    AlertObjectType;
  signal_category?: AlertSignalCategory;
  icon:            string;              // emoji or icon name
  policy:          Partial<AlertPolicy> | Partial<SummaryPolicy>;
}
