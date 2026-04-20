// ─── Company UI 定数・badge クラス ────────────────────────────────────────────
//
// Company 管理画面全体で使う badge スタイル・閾値定数を一元管理する。
// UI コンポーネントから直接参照するため、副作用なし・サーバー/クライアント両対応。

// ── Health ────────────────────────────────────────────────────────────────────

export type OverallHealth = 'critical' | 'at_risk' | 'healthy' | 'expanding';

export const HEALTH_BADGE: Record<
  OverallHealth,
  { label: string; className: string }
> = {
  critical:  { label: 'Critical',  className: 'bg-red-100 text-red-700 border-red-200' },
  at_risk:   { label: 'At Risk',   className: 'bg-amber-100 text-amber-700 border-amber-200' },
  healthy:   { label: 'Healthy',   className: 'bg-green-100 text-green-700 border-green-200' },
  expanding: { label: 'Expanding', className: 'bg-blue-100 text-blue-700 border-blue-200' },
};

export const HEALTH_BADGE_FALLBACK = {
  label:     '—',
  className: 'bg-gray-100 text-gray-500 border-gray-200',
};

export function getHealthBadge(health: string | null | undefined) {
  if (!health) return HEALTH_BADGE_FALLBACK;
  return HEALTH_BADGE[health as OverallHealth] ?? HEALTH_BADGE_FALLBACK;
}

// ── Risk severity ─────────────────────────────────────────────────────────────

export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';

export const RISK_SEVERITY_BADGE: Record<
  RiskSeverity,
  { label: string; className: string; dotClass: string }
> = {
  critical: { label: 'Critical', className: 'bg-red-50 text-red-700 border-red-200',     dotClass: 'bg-red-500' },
  high:     { label: 'High',     className: 'bg-orange-50 text-orange-700 border-orange-200', dotClass: 'bg-orange-500' },
  medium:   { label: 'Medium',   className: 'bg-amber-50 text-amber-700 border-amber-200',   dotClass: 'bg-amber-400' },
  low:      { label: 'Low',      className: 'bg-gray-50 text-gray-600 border-gray-200',       dotClass: 'bg-gray-400' },
};

// ── Phase ─────────────────────────────────────────────────────────────────────

/** フェーズ停滞とみなす日数 */
export const PHASE_STAGNATION_THRESHOLD_DAYS = 90;

/** CSM vs CRM でフェーズ差分があるとき表示するアイコン・文言 */
export const PHASE_GAP_WARNING = '⚠️ フェーズ不整合';

// ── Communication blank ───────────────────────────────────────────────────────

/** この日数以上コミュニケーションがなければ warning */
export const COMMUNICATION_BLANK_WARNING_DAYS = 30;
/** この日数以上なければ risk */
export const COMMUNICATION_BLANK_RISK_DAYS    = 60;

export function getCommunicationRiskLevel(
  blankDays: number | null,
): 'none' | 'warning' | 'risk' {
  if (blankDays === null) return 'none';
  if (blankDays >= COMMUNICATION_BLANK_RISK_DAYS)    return 'risk';
  if (blankDays >= COMMUNICATION_BLANK_WARNING_DAYS) return 'warning';
  return 'none';
}

export const COMMUNICATION_RISK_BADGE = {
  none:    { label: null,           className: '' },
  warning: { label: '通信 30d+',    className: 'bg-amber-50 text-amber-700 border-amber-200' },
  risk:    { label: '通信 60d+',    className: 'bg-red-50 text-red-700 border-red-200' },
};

// ── Project status ────────────────────────────────────────────────────────────

export type ProjectStatus = 'active' | 'stalled' | 'unused' | 'inactive';

export const PROJECT_STATUS_BADGE: Record<
  ProjectStatus,
  { label: string; className: string }
> = {
  active:   { label: 'Active',   className: 'bg-green-100 text-green-700 border-green-200' },
  stalled:  { label: 'Stalled',  className: 'bg-amber-100 text-amber-700 border-amber-200' },
  unused:   { label: 'Unused',   className: 'bg-gray-100 text-gray-500 border-gray-200' },
  inactive: { label: 'Inactive', className: 'bg-gray-100 text-gray-400 border-gray-200' },
};

/** プロジェクトが停滞とみなす最終更新からの経過日数 */
export const PROJECT_STALLED_THRESHOLD_DAYS = 60;

// ── Summary freshness（company-summary-state-policy.ts との対応）────────────

// company-summary-state-policy.ts の SUMMARY_FRESHNESS_CONFIG と重複させない。
// ここでは List 列の短い badge label のみ追加する。
export const FRESHNESS_SHORT_LABEL: Record<string, string> = {
  missing: '未生成',
  stale:   '要更新',
  fresh:   '最新',
  locked:  '承認済',
};

// ── Priority score 計算用ウェイト ─────────────────────────────────────────────
// priority-score.ts がこれを参照する。変更時は priority-score.ts のコメントも更新。

export const PRIORITY_WEIGHT = {
  health_critical:        40,
  health_at_risk:         20,
  summary_missing:        15,
  summary_stale:           8,
  summary_unreviewed:      5,
  comm_blank_risk:        15,  // blank >= 60d
  comm_blank_warning:      8,  // blank >= 30d
  phase_gap:              10,
  phase_stagnation:       10,
  support_critical:       12,
  support_high_count:      6,  // open >= 5件
  project_all_stalled:     8,
  // ── People / Action signals ───────────────────────────────────────────────
  people_no_dm:           12,  // 意思決定者が未登録
  people_stale_dm:        10,  // 意思決定者が 90d+ 未接触
  action_overdue:         10,  // 期限切れ Action あり
  action_many_open:        4,  // open action >= 5件
} as const;
