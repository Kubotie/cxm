// ─── Support Queue 共通 Badge コンポーネント ───────────────────────────────────
// Home / Queue / Detail で同一の badge を使うことで、
// 色・文言・意味のズレを防ぐ。
// ロジック（色マップ）は labels.ts に集約し、lifecycle.ts に状態判定を集約。

import { Badge } from "@/components/ui/badge";
import {
  routingLabel, routingColor,
  sourceStatusLabel, sourceStatusColor,
  severityLabel, severityBg,
} from "./labels";
import {
  getHomeReason, isHomeWorthy,
  LIFECYCLE_LABEL, LIFECYCLE_COLOR,
  type CaseLifecycleStatus, type CaseStatusInput, type HomeReasonTag,
} from "./lifecycle";

// Re-export lifecycle types / helpers for convenience
export type { CaseLifecycleStatus, CaseStatusInput, HomeReasonTag };
export { isHomeWorthy, getHomeReason, LIFECYCLE_LABEL, LIFECYCLE_COLOR };

// ── Case Type ─────────────────────────────────────────────────────────────────

const CASE_TYPE_COLOR: Record<string, string> = {
  'Inquiry':           'bg-blue-50 text-blue-700 border-blue-200',
  'Support':           'bg-green-50 text-green-700 border-green-200',
  'Billing':           'bg-purple-50 text-purple-700 border-purple-200',
  'CSE Ticket':        'bg-amber-50 text-amber-700 border-amber-200',
  'CSE Ticket Linked': 'bg-orange-50 text-orange-700 border-orange-200',
};

export function CaseTypeBadge({ type }: { type: string }) {
  const cls = CASE_TYPE_COLOR[type] ?? 'bg-slate-50 text-slate-600 border-slate-200';
  return <Badge variant="outline" className={`text-xs ${cls}`}>{type}</Badge>;
}

// ── Source ────────────────────────────────────────────────────────────────────

const SOURCE_COLOR: Record<string, string> = {
  'Intercom':   'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Slack':      'bg-violet-50 text-violet-700 border-violet-200',
  'CSE Ticket': 'bg-amber-50 text-amber-700 border-amber-200',
  'Chatwork':   'bg-slate-50 text-slate-600 border-slate-200',
};

export function SourceBadge({ source }: { source: string }) {
  const cls = SOURCE_COLOR[source] ?? 'bg-slate-50 text-slate-600 border-slate-200';
  return <Badge variant="outline" className={`text-xs ${cls}`}>{source}</Badge>;
}

// ── Routing Status ────────────────────────────────────────────────────────────

export function RoutingBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`text-xs ${routingColor(status)}`}>
      {routingLabel(status)}
    </Badge>
  );
}

// ── Source Status ─────────────────────────────────────────────────────────────

export function SourceStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-xs text-slate-400">—</span>;
  return (
    <Badge variant="outline" className={`text-xs ${sourceStatusColor(status)}`}>
      {sourceStatusLabel(status)}
    </Badge>
  );
}

// ── Severity ──────────────────────────────────────────────────────────────────

export function SeverityBadge({ severity }: { severity: string }) {
  if (['high', 'medium', 'low'].includes(severity)) {
    return (
      <Badge className={`${severityBg(severity)} text-white text-xs`}>
        {severityLabel(severity)}
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-xs text-slate-500">{severity}</Badge>;
}

// ── Lifecycle Status ──────────────────────────────────────────────────────────

export function LifecycleStatusBadge({ status }: { status: CaseLifecycleStatus }) {
  const label = LIFECYCLE_LABEL[status];
  const cls   = LIFECYCLE_COLOR[status];
  return <Badge variant="outline" className={`text-xs border ${cls}`}>{label}</Badge>;
}

// ── Home Reason ───────────────────────────────────────────────────────────────
// Queue item が Support Home に表示される「理由」バッジ。

/** @deprecated Use HomeReasonTag from lifecycle.ts */
export type ReasonTag = HomeReasonTag;

/** @deprecated Use getHomeReason from lifecycle.ts */
export function homeReason(item: CaseStatusInput): HomeReasonTag {
  return getHomeReason(item);
}

export function HomeReasonBadge({ item }: { item: CaseStatusInput }) {
  const reason = getHomeReason(item);
  return (
    <Badge variant="outline" className={`text-xs border ${reason.className}`}>
      {reason.label}
    </Badge>
  );
}

// ── Home worthy check ─────────────────────────────────────────────────────────
// Support Home に表示すべき案件かどうか判定する。
// isHomeWorthy は lifecycle.ts から re-export しているため、ここでは重複定義しない。
