// ─── Support Case View Model ──────────────────────────────────────────────────
// Single derived representation used by Home / Queue / Detail.
// Merges QueueItem (API data) + CaseStateRecord (local mutations)
// into one flat object — no if-chains needed in components.
//
// Usage:
//   const vm = buildCaseViewModel(item, getCaseRecord(item.id));
//   vm.lifecycleStatus  → "action_created"
//   vm.isDismissed      → false
//   vm.agingText        → "2d 4h"

import type { QueueItem } from "./queue-adapter";
import type { CaseStateRecord } from "./case-state";
import type {
  CaseLifecycleStatus,
  HomeReasonTag,
  PrimaryAction,
  CaseMutationSnapshot,
  DetailPanelMode,
} from "./lifecycle";
import {
  getCaseLifecycleStatus,
  getCaseReasons,
  getCasePriorityScore,
  getCasePrimaryActions,
  getCaseAgingMinutes,
  formatAging,
  isOverdue as calcIsOverdue,
  isHomeWorthy,
  getDetailPanelMode,
} from "./lifecycle";

// ── View Model type ───────────────────────────────────────────────────────────

export interface SupportCaseViewModel {
  // ── Identity ──────────────────────────────────────────────────────────────
  id:               string;
  title:            string;
  companyName:      string;
  companyUid:       string;
  projectName:      string | null;
  caseType:         string;
  sourceType:       string;
  sourceStatus:     string | null;
  routingStatus:    string;
  severity:         string;
  ownerName:        string | null;
  assignedTeam:     string | null;
  linkedCSETicket:  string | null;
  createdAt:        string;
  openDuration:     string;
  waitingDuration:  string | null;
  firstResponseTime: string | null;
  relatedContent:   number;
  triageNote:       string | null;

  // ── Derived: lifecycle ────────────────────────────────────────────────────
  lifecycleStatus:  CaseLifecycleStatus;
  priorityScore:    number;
  homeReasons:      HomeReasonTag[];
  primaryActions:   PrimaryAction[];
  agingMinutes:     number | null;
  agingText:        string | null;
  isOverdue:        boolean;
  isVisibleInHome:  boolean;

  // ── Derived: panel mode ───────────────────────────────────────────────────
  detailPanelMode:   DetailPanelMode;
  // Convenience booleans for UI branching (avoid repeated if-chains in components)
  showDismissBanner: boolean;  // = isDismissed
  showActionPanel:   boolean;  // = hasAction
  showCsePanel:      boolean;  // = hasCseTicket
  isReadOnlyLike:    boolean;  // = lifecycleStatus === 'resolved'

  // ── Raw content (Detail-only, null for Queue/Home) ───────────────────────
  originalMessage: string | null;

  // ── Derived: dismiss ──────────────────────────────────────────────────────
  isDismissed:      boolean;
  dismissedReason:  string | null;
  dismissedAt:      string | null;
  dismissedBy:      string | null;

  // ── Derived: action ───────────────────────────────────────────────────────
  hasAction:        boolean;
  actionStatus:     string | null;
  actionOwner:      string | null;
  actionTitle:      string | null;
  actionCreatedAt:  string | null;

  // ── Derived: cse ticket ───────────────────────────────────────────────────
  hasCseTicket:     boolean;
  cseTicketStatus:  string | null;
  cseTicketOwner:   string | null;
  cseTicketTitle:   string | null;
  cseTicketCreatedAt: string | null;

  // ── Display helpers (null-safe, pre-formatted for UI) ─────────────────────
  // These absorb null-coalescing so components need no inline fallback logic.
  ownerDisplayName:       string;        // ownerName ?? '未アサイン'
  assignedTeamDisplay:    string;        // assignedTeam ?? '—'
  dismissedByDisplay:     string;        // dismissedBy ?? 'Unknown'  (meaningful only when isDismissed)
  dismissedReasonDisplay: string | null; // dismissedReason ?? '理由未入力', null when !isDismissed
  actionOwnerDisplay:     string | null; // actionOwner ?? '未割当', null when !hasAction
  cseTicketOwnerDisplay:  string | null; // cseTicketOwner ?? '未割当', null when !hasCseTicket
}

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildCaseViewModel(
  item: QueueItem,
  stateRecord: CaseStateRecord | null,
): SupportCaseViewModel {
  const dismissed     = stateRecord?.dismiss?.active === true;
  const actionCreated = !!stateRecord?.action;
  const cseCreated    = !!stateRecord?.cseTicket;

  const mutations: CaseMutationSnapshot = { dismissed, actionCreated, cseCreated };

  // Extend item with local action/CSE state so lifecycle rules can use them
  const itemWithState = {
    ...item,
    action: stateRecord?.action
      ? { status: stateRecord.action.status, owner: stateRecord.action.owner, created_at: stateRecord.action.created_at }
      : null,
    cseTicket: stateRecord?.cseTicket
      ? { status: stateRecord.cseTicket.status }
      : null,
  };

  const lifecycleStatus = getCaseLifecycleStatus(itemWithState, dismissed, mutations);
  const homeReasons     = getCaseReasons(itemWithState);
  const priorityScore   = getCasePriorityScore(itemWithState);
  const primaryActions  = getCasePrimaryActions(itemWithState);
  const agingMinutes    = getCaseAgingMinutes(item.createdAt);
  const agingText       = agingMinutes !== null ? formatAging(agingMinutes) : null;

  // originalMessage lives on CaseDetail (extends QueueItem) — graceful fallback for bare QueueItem
  const originalMessage = (item as { originalMessage?: string | null }).originalMessage ?? null;

  return {
    // Identity
    id:                item.id,
    title:             item.title,
    companyName:       item.companyName,
    companyUid:        item.companyUid,
    projectName:       item.projectName,
    caseType:          item.caseType,
    sourceType:        item.source,
    sourceStatus:      item.sourceStatus,
    routingStatus:     item.routingStatus,
    severity:          item.severity,
    ownerName:         item.owner,
    assignedTeam:      item.assignedTeam,
    linkedCSETicket:   item.linkedCSETicket,
    createdAt:         item.createdAt,
    openDuration:      item.openDuration,
    waitingDuration:   item.waitingDuration,
    firstResponseTime: item.firstResponseTime,
    relatedContent:    item.relatedContent,
    triageNote:        item.triageNote,
    originalMessage,

    // Lifecycle
    lifecycleStatus,
    priorityScore,
    homeReasons,
    primaryActions,
    agingMinutes,
    agingText,
    isOverdue:       calcIsOverdue(item),
    isVisibleInHome: isHomeWorthy(itemWithState, dismissed, mutations),

    // Panel mode
    detailPanelMode:   getDetailPanelMode(dismissed, actionCreated, cseCreated),
    showDismissBanner: dismissed,
    showActionPanel:   actionCreated,
    showCsePanel:      cseCreated,
    isReadOnlyLike:    lifecycleStatus === 'resolved',

    // Dismiss
    isDismissed:     dismissed,
    dismissedReason: stateRecord?.dismiss?.dismissed_reason ?? null,
    dismissedAt:     stateRecord?.dismiss?.dismissed_at     ?? null,
    dismissedBy:     stateRecord?.dismiss?.dismissed_by     ?? null,

    // Action
    hasAction:       actionCreated,
    actionStatus:    stateRecord?.action?.status     ?? null,
    actionOwner:     stateRecord?.action?.owner      ?? null,
    actionTitle:     stateRecord?.action?.title      ?? null,
    actionCreatedAt: stateRecord?.action?.created_at ?? null,

    // CSE Ticket
    hasCseTicket:       cseCreated,
    cseTicketStatus:    stateRecord?.cseTicket?.status     ?? null,
    cseTicketOwner:     stateRecord?.cseTicket?.owner      ?? null,
    cseTicketTitle:     stateRecord?.cseTicket?.title      ?? null,
    cseTicketCreatedAt: stateRecord?.cseTicket?.created_at ?? null,

    // Display helpers — null-safe, no component-level coalescing needed
    ownerDisplayName:       item.owner        ?? '未アサイン',
    assignedTeamDisplay:    item.assignedTeam ?? '—',
    dismissedByDisplay:     stateRecord?.dismiss?.dismissed_by ?? 'Unknown',
    dismissedReasonDisplay: dismissed
      ? (stateRecord?.dismiss?.dismissed_reason ?? '理由未入力')
      : null,
    actionOwnerDisplay:    actionCreated
      ? (stateRecord?.action?.owner ?? '未割当')
      : null,
    cseTicketOwnerDisplay: cseCreated
      ? (stateRecord?.cseTicket?.owner ?? '未割当')
      : null,
  };
}

// ── Convenience: build many at once ───────────────────────────────────────────

export function buildCaseViewModels(
  items: QueueItem[],
  getRecord: (id: string) => CaseStateRecord | null,
): SupportCaseViewModel[] {
  return items.map(item => buildCaseViewModel(item, getRecord(item.id)));
}

// ── Action/CSE status label helpers ───────────────────────────────────────────

export const ACTION_STATUS_LABEL: Record<string, string> = {
  draft:       "Draft",
  open:        "Open",
  in_progress: "In Progress",
  done:        "Done",
};

export const ACTION_STATUS_COLOR: Record<string, string> = {
  draft:       "bg-slate-100 text-slate-600 border-slate-200",
  open:        "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  done:        "bg-green-50 text-green-700 border-green-200",
};

export const CSE_STATUS_LABEL: Record<string, string> = {
  open:          "Open",
  waiting:       "Waiting",
  investigating: "Investigating",
  resolved:      "Resolved",
};

export const CSE_STATUS_COLOR: Record<string, string> = {
  open:          "bg-blue-50 text-blue-700 border-blue-200",
  waiting:       "bg-amber-50 text-amber-700 border-amber-200",
  investigating: "bg-orange-50 text-orange-700 border-orange-200",
  resolved:      "bg-green-50 text-green-700 border-green-200",
};
