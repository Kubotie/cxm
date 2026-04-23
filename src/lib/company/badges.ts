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

/** Freshness badge のクラス + ラベル（CompanyCard / Sheet など共通利用） */
export const FRESHNESS_BADGE: Record<string, { label: string; className: string }> = {
  missing: { label: '未生成', className: 'bg-slate-100 text-slate-600 border-slate-300' },
  stale:   { label: '要更新', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  fresh:   { label: '最新',   className: 'bg-teal-100 text-teal-700 border-teal-200'   },
  locked:  { label: '承認済', className: 'bg-green-100 text-green-700 border-green-200' },
};

export function getFreshnessBadge(status: string | null | undefined) {
  if (!status) return { label: '—', className: 'bg-gray-100 text-gray-500 border-gray-200' };
  return FRESHNESS_BADGE[status] ?? { label: status, className: 'bg-gray-100 text-gray-500 border-gray-200' };
}

// ── Phase badge ───────────────────────────────────────────────────────────────

/**
 * フェーズバッジのクラスを返す。
 * hasGap / isStagnant / normal の3状態で色を固定し、ad hoc な inline ternary を排除する。
 */
export function getPhaseBadgeClass(opts: {
  hasGap?:    boolean;
  isStagnant?: boolean;
}): string {
  if (opts.hasGap)      return 'bg-amber-50 text-amber-700 border-amber-300';
  if (opts.isStagnant)  return 'bg-orange-50 text-orange-700 border-orange-200';
  return 'bg-indigo-50 text-indigo-700 border-indigo-200';
}

// ── Phase source chip（CSM / CRM）────────────────────────────────────────────

/**
 * Phase の情報源（CSM = NocoDB / CRM = Salesforce）の badge クラス。
 * CSM → indigo（社内情報）、CRM → purple（外部連携）で固定。
 */
export const PHASE_SOURCE_CHIP_CLS: Record<'CSM' | 'CRM', string> = {
  CSM: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  CRM: 'bg-purple-50 text-purple-600 border-purple-200',
};

// ── Priority score 計算用ウェイト ─────────────────────────────────────────────
// priority-score.ts がこれを参照する。変更時は priority-score.ts のコメントも更新。

export const PRIORITY_WEIGHT = {
  // ── Health ────────────────────────────────────────────────────────────────
  // 2026-04 調整: health 単独での支配を緩和（他指標との得点差を縮める）
  // 旧: critical=40, at_risk=20 → 健康状態だけで他指標を全部上回っていた
  // 新: critical=30, at_risk=15 → critical 企業は依然上位だが他指標が効く余地が増える
  health_critical:        30,
  health_at_risk:         15,
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
  // 2026-04 調整: action 系を強化（放置 action の見落とし対策）
  // 旧: overdue=10, many_open=4 → action は軽視されがちだった
  // 新: overdue=12（support_critical と同格）, many_open=8（phase 系と同格）
  action_overdue:         12,  // 期限切れ Action あり
  action_many_open:        8,  // open action >= 5件
  // ── Opportunity / Expansion ───────────────────────────────────────────────
  // 機会系は at_risk(15) より弱く、phase_gap(10) と同格に設定する。
  // スタックしても critical(30) を超えないよう上限を意識した値にする。
  health_expanding:       10,  // overall_health === 'expanding'
  opportunity_signal:      6,  // expansion_project / upsell_signal / new_use_case
  // ── Renewal 接近 ─────────────────────────────────────────────────────────
  // 更新は at_risk(15) と同格。CSM として優先的に動く必要があるため。
  // 30日以内は即対応が必要 → 15、31-90日は予防的 → 5。
  renewal_30:             15,  // renewalBucket === '0-30'
  renewal_90:              5,  // renewalBucket === '31-90'
} as const;
