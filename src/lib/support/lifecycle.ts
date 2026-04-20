// ─── Case Lifecycle Helpers ───────────────────────────────────────────────────
// Single source of truth for:
// - Lifecycle status derivation (Home / Queue / Detail all read from here)
// - Home visibility logic (rule-based, priority-ordered)
// - CTA availability (canDismiss, canCreateAction, canCreateCseTicket)
// - Aging/overdue helpers
//
// Rule: add new status concepts here, NOT in individual page components.

// ── Status enum ──────────────────────────────────────────────────────────────

/** Normalized lifecycle status shown in UI and used for filtering. */
export type CaseLifecycleStatus =
  | "new"            // unassigned — no one has taken action yet
  | "reviewing"      // assigned / triaged / in progress / waiting on customer
  | "action_needed"  // high severity, not resolved
  | "action_created" // action was explicitly created from this case
  | "cse_waiting"    // routing_status === 'waiting on CSE'
  | "dismissed"      // user dismissed (no action needed)
  | "resolved"       // routing_status resolved_like
  | "reopened";      // sourceStatus === 'reopened'

export const LIFECYCLE_LABEL: Record<CaseLifecycleStatus, string> = {
  new:            "New",
  reviewing:      "Reviewing",
  action_needed:  "Action Needed",
  action_created: "Action Created",
  cse_waiting:    "Waiting on CSE",
  dismissed:      "Dismissed",
  resolved:       "Resolved",
  reopened:       "Reopened",
};

export const LIFECYCLE_COLOR: Record<CaseLifecycleStatus, string> = {
  new:            "bg-slate-100 text-slate-700 border-slate-200",
  reviewing:      "bg-blue-50 text-blue-700 border-blue-200",
  action_needed:  "bg-red-50 text-red-700 border-red-200",
  action_created: "bg-teal-50 text-teal-700 border-teal-200",
  cse_waiting:    "bg-amber-50 text-amber-700 border-amber-200",
  dismissed:      "bg-slate-50 text-slate-400 border-slate-200",
  resolved:       "bg-green-50 text-green-700 border-green-200",
  reopened:       "bg-orange-50 text-orange-700 border-orange-200",
};

// ── Input type ────────────────────────────────────────────────────────────────

export interface CaseStatusInput {
  routingStatus:    string;
  severity:         string;
  caseType?:        string;
  // Extended (optional — all backward compatible)
  owner?:           string | null;
  linkedCSETicket?: string | null;
  sourceStatus?:    string | null;
  openDuration?:    string | null;
  createdAt?:       string;        // ISO-8601 or YYYY-MM-DD HH:mm
  // Action state — used by re-surfacing rules
  action?:     { status: string; owner: string | null; created_at: string } | null;
  // CSE ticket state — used for resolved exclusion
  cseTicket?:  { status: string } | null;
}

// ── Mutations snapshot passed into derivation ─────────────────────────────────

export interface CaseMutationSnapshot {
  dismissed?:     boolean;
  actionCreated?: boolean;
  cseCreated?:    boolean;
}

// ── Core derivation ───────────────────────────────────────────────────────────

export function getCaseLifecycleStatus(
  item: CaseStatusInput,
  dismissed = false,
  mutations?: CaseMutationSnapshot,
): CaseLifecycleStatus {
  if (dismissed || mutations?.dismissed)     return "dismissed";
  if (item.routingStatus === "resolved_like") return "resolved";
  if (mutations?.actionCreated)              return "action_created";
  if (item.sourceStatus === "reopened")      return "reopened";
  if (item.routingStatus === "waiting on CSE") return "cse_waiting";
  if (item.routingStatus === "unassigned")   return "new";
  if (item.severity === "high")              return "action_needed";
  return "reviewing";
}

// ── Aging helpers ─────────────────────────────────────────────────────────────

/** Returns how many minutes the case has been open, or null if createdAt is missing/invalid. */
export function getCaseAgingMinutes(createdAt: string | undefined | null): number | null {
  if (!createdAt) return null;
  const ts = Date.parse(createdAt);
  if (isNaN(ts)) return null;
  return Math.floor((Date.now() - ts) / 60_000);
}

/** Human-readable aging string, e.g. "3h 15m", "2d 4h", "45m". */
export function formatAging(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

/** True if the case has been open for more than 48 h (2880 min). */
export function isOverdue(item: CaseStatusInput): boolean {
  const mins = getCaseAgingMinutes(item.createdAt);
  if (mins === null) return false;
  return mins > 2880 && item.routingStatus !== "resolved_like";
}

/** True if sourceStatus indicates the case was reopened. */
export function isReopened(item: CaseStatusInput): boolean {
  return item.sourceStatus === "reopened";
}

// ── Priority score ────────────────────────────────────────────────────────────
// Higher = more urgent. Useful for sorting.

export function getCasePriorityScore(item: CaseStatusInput): number {
  let score = 0;
  if (item.severity === "high")                       score += 100;
  if (item.severity === "medium")                     score += 50;
  if (item.routingStatus === "unassigned")            score += 40;
  if (item.routingStatus === "waiting on CSE")        score += 30;
  if (isReopened(item))                               score += 25;
  if (isOverdue(item))                                score += 20;
  if (!item.owner && item.routingStatus !== "unassigned") score += 10;
  return score;
}

// ── Home reason rules ─────────────────────────────────────────────────────────
// Priority-ordered rules. Highest priority = shown first in Home reason badge.
// getCaseReasons returns ALL matching rules; getHomeReason returns the top one.

export interface HomeReasonTag {
  id:        string;
  label:     string;
  className: string;
  priority:  number;
}

interface HomeReasonRule {
  id:        string;
  priority:  number;
  check:     (item: CaseStatusInput) => boolean;
  label:     string;
  className: string;
}

const HOME_REASON_RULES: HomeReasonRule[] = [
  {
    id:        'high_unassigned',
    priority:  100,
    check:     item => item.severity === 'high' && item.routingStatus === 'unassigned',
    label:     'High severity · Unassigned',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  {
    id:        'high_severity',
    priority:  90,
    check:     item => item.severity === 'high' && item.routingStatus !== 'resolved_like',
    label:     'High severity',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  {
    id:        'reopened',
    priority:  85,
    check:     item => isReopened(item) && item.routingStatus !== 'resolved_like',
    label:     'Reopened',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  {
    id:        'cse_waiting',
    priority:  80,
    check:     item => item.routingStatus === 'waiting on CSE',
    label:     'Waiting on CSE',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id:        'unassigned',
    priority:  70,
    check:     item => item.routingStatus === 'unassigned',
    label:     'Unassigned',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  {
    id:        'owner_missing',
    priority:  60,
    check:     item =>
      item.owner === null &&
      item.routingStatus !== 'unassigned' &&
      item.routingStatus !== 'resolved_like',
    label:     'Owner missing',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  {
    id:        'overdue',
    priority:  55,
    check:     item => isOverdue(item),
    label:     'Response overdue',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  // ── Action re-surfacing rules ─────────────────────────────────────────────
  // These fire only when item.action is present (passed in by buildCaseViewModel).
  {
    id:        'action_stalled',
    priority:  52,
    check:     item => {
      if (!item.action) return false;
      const ageMin = getCaseAgingMinutes(item.action.created_at);
      if (ageMin === null) return false;
      if (item.action.status === 'open'        && ageMin > 48 * 60) return true;
      if (item.action.status === 'in_progress' && ageMin > 72 * 60) return true;
      return false;
    },
    label:     'Action stalled',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  {
    id:        'action_owner_missing',
    priority:  50,
    check:     item => !!item.action && !item.action.owner && item.action.status !== 'done',
    label:     'Action · Owner missing',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  {
    id:        'action_done_case_open',
    priority:  48,
    check:     item =>
      !!item.action &&
      item.action.status === 'done' &&
      item.routingStatus !== 'resolved_like',
    label:     'Action done · Case still open',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  // ── Billing unlinked ──────────────────────────────────────────────────────
  {
    id:        'billing_unlinked',
    priority:  45,
    check:     item =>
      item.caseType === 'Billing' &&
      !item.linkedCSETicket &&
      item.routingStatus !== 'resolved_like',
    label:     'Billing · No CSE ticket',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
  },
];

/** Returns all matching Home reason tags, sorted by priority descending. */
export function getCaseReasons(item: CaseStatusInput): HomeReasonTag[] {
  return HOME_REASON_RULES
    .filter(r => r.check(item))
    .sort((a, b) => b.priority - a.priority)
    .map(r => ({ id: r.id, label: r.label, className: r.className, priority: r.priority }));
}

/** Returns the highest-priority Home reason, or a fallback if none match. */
export function getHomeReason(item: CaseStatusInput): HomeReasonTag {
  const reasons = getCaseReasons(item);
  if (reasons.length > 0) return reasons[0];
  return { id: 'needs_attention', label: 'Needs attention', className: 'bg-slate-100 text-slate-600 border-slate-200', priority: 0 };
}

// ── Home filter ───────────────────────────────────────────────────────────────
// Home shows cases that match any rule, unless excluded by status/mutation.
//
// Exclusion rules (in priority order):
//   1. dismissed → always hide
//   2. resolved_like → always hide
//   3. CSE ticket resolved → hide
//   4. action_created → hide UNLESS an action re-surfacing rule fires
//   5. no matching reason rule → hide

const ACTION_RESURFACE_IDS = new Set([
  'action_stalled',
  'action_owner_missing',
  'action_done_case_open',
]);

export function isHomeWorthy(
  item: CaseStatusInput,
  dismissed = false,
  mutations?: CaseMutationSnapshot,
): boolean {
  if (dismissed || mutations?.dismissed)      return false;
  if (item.routingStatus === "resolved_like") return false;
  if (item.cseTicket?.status === 'resolved')  return false;

  const reasons = getCaseReasons(item);
  if (reasons.length === 0) return false;

  // action_created: only resurface if a stall/gap rule fires
  if (mutations?.actionCreated) {
    return reasons.some(r => ACTION_RESURFACE_IDS.has(r.id));
  }

  return true;
}

// ── Primary CTAs for a case ────────────────────────────────────────────────────

export type PrimaryAction = 'view' | 'create_action' | 'create_cse_ticket' | 'reassign';

export function getCasePrimaryActions(item: CaseStatusInput): PrimaryAction[] {
  const actions: PrimaryAction[] = ['view'];
  if (canCreateAction(item)) actions.push('create_action');
  if (canCreateCseTicket(item)) actions.push('create_cse_ticket');
  if (!item.owner) actions.push('reassign');
  return actions;
}

// ── Detail panel mode ─────────────────────────────────────────────────────────
// Determines what the Decision Panel should render.

export type DetailPanelMode =
  | "dismissed"      // show archive banner, undo CTA
  | "action_created" // action exists; show action status, can still add more
  | "cse_created"    // cse ticket exists; show cse status, can still act
  | "active";        // normal CTA state

export function getDetailPanelMode(
  dismissed: boolean,
  actionCreated: boolean,
  cseCreated: boolean,
): DetailPanelMode {
  if (dismissed)      return "dismissed";
  if (actionCreated)  return "action_created";
  if (cseCreated)     return "cse_created";
  return "active";
}

// ── Visibility rules (documented) ────────────────────────────────────────────
//
// HOME:
//   - Show if getCaseReasons().length > 0
//   - Hide if dismissed (active)
//   - Hide if actionCreated (action_created status)
//   - Hide if routingStatus === "resolved_like"
//
// QUEUE:
//   - Show all by default
//   - Dismissed: hide/include/only filter (user choice, default hide)
//   - routingStatus === "resolved_like": include (Queue is archive too)
//
// DETAIL:
//   - Always show regardless of status
//   - Decision Panel mode changes based on getDetailPanelMode()
//   - Dismissed: archive banner + undo
//   - action_created/cse_created: status banners + secondary CTAs

// ── Predicates ────────────────────────────────────────────────────────────────

export function isResolvedLike(status: CaseLifecycleStatus): boolean {
  return status === "resolved";
}

export function isDismissedLike(status: CaseLifecycleStatus): boolean {
  return status === "dismissed";
}

// ── CTA availability ──────────────────────────────────────────────────────────

export function canDismiss(item: CaseStatusInput, dismissed = false): boolean {
  if (dismissed) return false;
  return item.routingStatus !== "resolved_like";
}

export function canCreateAction(_item: CaseStatusInput): boolean {
  return true;
}

export function canCreateCseTicket(item: CaseStatusInput): boolean {
  return item.caseType !== "CSE Ticket" && item.caseType !== "CSE Ticket Linked";
}
