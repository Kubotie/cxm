// ─── Priority reason 自然文変換 ───────────────────────────────────────────────
// priorityBreakdown の先頭 reason を日本語自然文に変換する。
// Home / Companies / 将来的な通知文面で共有する。

import type { PriorityScoreBreakdown } from '@/lib/company/priority-score';

// ── 機会シグナル ───────────────────────────────────────────────────────────────

/** opportunityReason / orderedReasons に渡す最小型 */
export interface OpportunitySignalInput {
  overallHealth?:   string | null;
  projectSummary?:  { active: number; stalled: number; total: number } | null;
}

/**
 * 機会系の理由文を1つ返す。該当なければ null。
 * expanding / プロジェクト全順調 を優先順に評価する。
 */
export function opportunityReason(item: OpportunitySignalInput): string | null {
  if (item.overallHealth === 'expanding') return '拡大・upsell の機会あり';

  if (item.projectSummary) {
    const ps = item.projectSummary;
    if (ps.total > 0 && ps.active > 0 && ps.stalled === 0) {
      return ps.active > 1
        ? `${ps.active}件のプロジェクトが順調に稼働中`
        : 'プロジェクトが順調に稼働中';
    }
  }

  return null;
}

/**
 * 機会理由 → リスク理由の順に最大 limit 件の reason 配列を返す。
 * Company List の2行目表示（最大2件）に使う。
 */
export function orderedReasons(
  item:      OpportunitySignalInput,
  breakdown: PriorityScoreBreakdown[],
  limit = 2,
): string[] {
  const result: string[] = [];

  const opp = opportunityReason(item);
  if (opp) result.push(opp);

  for (const b of breakdown) {
    if (result.length >= limit) break;
    const r = priorityReason([b]);
    if (r) result.push(r);
  }

  return result;
}

/**
 * priorityBreakdown の上位理由を「今見る理由」の自然文に変換する。
 * breakdown が空の場合は '' を返す。
 */
export function priorityReason(breakdown: PriorityScoreBreakdown[]): string {
  if (!breakdown.length) return '';
  const top = breakdown[0].reason;

  if (top === 'health: expanding')              return '拡大中・upsell の機会あり';
  if (top === 'opportunity: 拡大・新規活用シグナルあり') return '拡大・新規活用のシグナルあり';
  if (top === 'health: critical')               return 'Critical リスク状態';
  if (top === 'health: at_risk')                return 'At Risk 状態';
  if (top === 'support: critical case')         return 'Critical サポートケースあり';
  if (top === 'phase: gap')                     return 'フェーズ不整合（CSM vs CRM）';
  if (top === 'phase: stagnation')              return 'フェーズ停滞中';
  if (top === 'summary: missing')               return 'AI Summary 未生成';
  if (top === 'summary: stale')                 return 'AI Summary が古い';
  if (top === 'summary: unreviewed')            return 'AI Summary 未確認';
  if (top === 'projects: all stalled')          return '全プロジェクトが停滞';
  if (top === 'people: 意思決定者未登録')        return '意思決定者未登録';
  if (top === 'people: 意思決定者 90d+ 未接触') return '意思決定者 90日以上未接触';
  if (top === 'action: 期限切れあり')           return '期限切れアクションあり';

  const commMatch = top.match(/^communication blank: (\d+)d$/);
  if (commMatch) return `${commMatch[1]}日間コミュニケーション空白`;

  const supportMatch = top.match(/^support: (\d+) open cases$/);
  if (supportMatch) return `サポートケース ${supportMatch[1]}件未対応`;

  const actionMatch = top.match(/^action: open (\d+)件$/);
  if (actionMatch) return `未完了アクション ${actionMatch[1]}件`;

  return top;
}

/**
 * 上位 N 件の reason を配列で返す（tooltip 展開用）。
 */
export function priorityReasons(
  breakdown: PriorityScoreBreakdown[],
  limit = 3,
): string[] {
  return breakdown.slice(0, limit).map(b => priorityReason([b])).filter(Boolean);
}
