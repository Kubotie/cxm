"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchSupportCases, fetchSupportAlerts } from "@/lib/nocodb-client";
import type { QueueItem, AppSupportAlert } from "@/lib/nocodb-client";
import type { SupportCaseAiViewModel } from "@/lib/support/support-ai-state-view-model";
import { getAiFreshnessStatus } from "@/lib/support/support-ai-state-policy";
import type { AiFreshnessStatus } from "@/lib/support/support-ai-state-policy";
import {
  CaseTypeBadge,
  SourceBadge,
  RoutingBadge,
  SourceStatusBadge,
  SeverityBadge,
  LifecycleStatusBadge,
} from "@/lib/support/badges";
import { useCaseState } from "@/lib/support/case-state";
import { buildCaseViewModel, ACTION_STATUS_LABEL, ACTION_STATUS_COLOR, CSE_STATUS_LABEL, CSE_STATUS_COLOR } from "@/lib/support/view-model";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ViewSwitcher } from "@/components/ui/view-switcher";
import { ViewContextHeader } from "@/components/ui/view-context-header";
import { Search, ArrowRight, Ticket, Building, Bell, X, AlertTriangle, Filter, ChevronUp, ChevronDown, ChevronsUpDown, Archive, CheckSquare, Square, RefreshCw, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ── 定数 ──────────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

// ── Alert badge（Support Queue 行用）─────────────────────────────────────────

const ALERT_TYPE_CLASS: Record<string, string> = {
  Urgent:             'bg-red-100 border-red-300 text-red-700',
  Risk:               'bg-orange-100 border-orange-300 text-orange-700',
  Opportunity:        'bg-green-100 border-green-300 text-green-700',
  'Content Suggestion': 'bg-purple-100 border-purple-300 text-purple-700',
  'Waiting on CSE':   'bg-amber-100 border-amber-300 text-amber-700',
};

const PRIORITY_DOT_CLASS: Record<string, string> = {
  Critical: 'bg-red-600',
  High:     'bg-orange-500',
  Medium:   'bg-amber-400',
  Low:      'bg-slate-400',
};

// アラートのある行の左ボーダー色（priority 別）
const ALERT_ROW_BORDER: Record<string, string> = {
  Critical: 'border-l-4 border-l-red-500',
  High:     'border-l-4 border-l-orange-400',
  Medium:   'border-l-4 border-l-amber-400',
  Low:      'border-l-4 border-l-slate-300',
};

function AlertBadge({ alert, caseId }: { alert: AppSupportAlert; caseId: string }) {
  const typeClass = ALERT_TYPE_CLASS[alert.alertType] ?? 'bg-slate-100 border-slate-300 text-slate-700';
  const dotClass  = PRIORITY_DOT_CLASS[alert.priority] ?? 'bg-slate-400';
  return (
    <Link href={`/support/${caseId}`} title={`${alert.alertType} · ${alert.priority}\n${alert.title}`}>
      <Badge variant="outline" className={`text-xs border flex items-center gap-1 ${typeClass}`}>
        <Bell className="w-2.5 h-2.5 flex-shrink-0" />
        <span className="truncate max-w-[80px]">{alert.alertType}</span>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
      </Badge>
    </Link>
  );
}


// ── Main component ────────────────────────────────────────────────────────────

type SupportCase = QueueItem;
type SortKey = 'title' | 'companyName' | 'severity' | 'routingStatus' | 'createdAt';

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const AI_PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function SortableHead({ label, sortK, currentKey, currentDir, onSort, className }: {
  label: string;
  sortK: SortKey;
  currentKey: SortKey;
  currentDir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = currentKey === sortK;
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(sortK)}
        className="flex items-center gap-1 hover:text-slate-900 whitespace-nowrap"
      >
        {label}
        {active
          ? currentDir === 'asc'
            ? <ChevronUp className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />
          : <ChevronsUpDown className="w-3 h-3 text-slate-300" />
        }
      </button>
    </TableHead>
  );
}
type AlertsMap = Record<string, AppSupportAlert>;

export function SupportQueue() {
  const router = useRouter();
  const {
    isDismissed, getCaseRecord,
    loadCaseStates,
    persistBulkDismiss,
    persistBulkAction,
    persistBulkCseTicket,
  } = useCaseState();

  // ── Bulk selection ─────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll(ids: string[]) {
    setSelectedIds(new Set(ids));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // ── Bulk action form ───────────────────────────────────────────────────────
  type BulkFormMode = 'dismiss' | 'action' | 'cse' | null;
  const [bulkFormMode, setBulkFormMode] = useState<BulkFormMode>(null);
  const [bulkTitle,  setBulkTitle]  = useState('');
  const [bulkOwner,  setBulkOwner]  = useState('');
  const [bulkReason, setBulkReason] = useState('');

  function openBulkForm(mode: BulkFormMode) {
    setBulkFormMode(mode);
    setBulkTitle(''); setBulkOwner(''); setBulkReason('');
  }

  function closeBulkForm() { setBulkFormMode(null); }

  // ── Bulk result notification ───────────────────────────────────────────────
  type BulkNotify = { succeeded: number; failed: number; lockedSkipped?: number } | null;
  const [bulkNotify, setBulkNotify] = useState<BulkNotify>(null);
  const [bulkRunning, setBulkRunning] = useState(false);

  // ── Bulk actions (persistent) ──────────────────────────────────────────────
  async function handleBulkDismiss() {
    const ids = [...selectedIds];
    closeBulkForm(); clearSelection();
    setBulkRunning(true);
    const result = await persistBulkDismiss(ids, { reason: bulkReason || undefined }).catch(() => ({ succeeded: [], failed: ids.map(id => ({ id, error: 'unknown' })) }));
    setBulkRunning(false);
    setBulkNotify({ succeeded: result.succeeded.length, failed: result.failed.length });
  }

  async function handleBulkCreateAction() {
    const ids = [...selectedIds];
    closeBulkForm(); clearSelection();
    setBulkRunning(true);
    const result = await persistBulkAction(ids, {
      title: bulkTitle || undefined,
      owner: bulkOwner || undefined,
    }).catch(() => ({ succeeded: [], failed: ids.map(id => ({ id, error: 'unknown' })) }));
    setBulkRunning(false);
    setBulkNotify({ succeeded: result.succeeded.length, failed: result.failed.length });
  }

  async function handleBulkCreateCseTicket() {
    const ids = [...selectedIds];
    closeBulkForm(); clearSelection();
    setBulkRunning(true);
    const result = await persistBulkCseTicket(ids, {
      title: bulkTitle || undefined,
      owner: bulkOwner || undefined,
    }).catch(() => ({ succeeded: [], failed: ids.map(id => ({ id, error: 'unknown' })) }));
    setBulkRunning(false);
    setBulkNotify({ succeeded: result.succeeded.length, failed: result.failed.length });
  }

  // approved confirm ダイアログ用 state
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);

  async function executeBulkAiReview(status: 'reviewed' | 'approved') {
    const ids = [...selectedIds];
    clearSelection();
    setShowApproveConfirm(false);
    setBulkRunning(true);
    const results = await Promise.allSettled(
      ids.map(id => {
        const sc = cases.find(c => c.id === id);
        const sourceQueue = sc?.sourceTable === 'cse_tickets' ? 'cse_ticket' : 'intercom';
        return fetch(`/api/support/cases/${id}/ai-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ human_review_status: status, source_queue: sourceQueue }),
        }).then(r => r.ok ? r.json() : Promise.reject(r));
      })
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed    = results.filter(r => r.status === 'rejected').length;
    setBulkRunning(false);
    setBulkNotify({ succeeded, failed });
  }

  function handleBulkAiReview(status: 'reviewed' | 'approved') {
    if (status === 'approved') {
      // approved は confirm ステップ必須
      setShowApproveConfirm(true);
    } else {
      executeBulkAiReview(status);
    }
  }

  async function handleBulkRegenerate() {
    const ids = [...selectedIds];
    // Pre-filter: approved (locked) ケースは UI 側で除外してカウント表示
    const eligibleIds  = ids.filter(id => {
      const sc   = cases.find(c => c.id === id);
      const aiKey = `${sc?.sourceTable === 'cse_tickets' ? 'cse_ticket' : 'intercom'}:${id}`;
      const aiVm  = aiVmMap[aiKey];
      return aiVm?.humanReviewStatus !== 'approved';
    });
    const lockedCount = ids.length - eligibleIds.length;

    clearSelection();

    if (eligibleIds.length === 0) {
      setBulkNotify({ succeeded: 0, failed: 0, lockedSkipped: lockedCount });
      return;
    }

    setBulkRunning(true);
    try {
      const res  = await fetch('/api/support/cases/bulk-regenerate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ case_ids: eligibleIds }),
      });
      const data = await res.json().catch(() => ({}));
      setBulkNotify({
        succeeded:     data.succeeded     ?? 0,
        failed:        data.failed        ?? 0,
        lockedSkipped: (data.locked_skipped ?? 0) + lockedCount,
      });
    } catch {
      setBulkNotify({ succeeded: 0, failed: eligibleIds.length, lockedSkipped: lockedCount });
    } finally {
      setBulkRunning(false);
    }
  }

  const [apiCases, setApiCases]   = useState<QueueItem[] | null>(null);
  const [alertsMap, setAlertsMap] = useState<AlertsMap>({});
  // AI state map — keyed by "${source_queue}:${source_record_id}"
  const [aiVmMap, setAiVmMap]     = useState<Record<string, SupportCaseAiViewModel>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentView, setCurrentView]       = useState("all");
  const [searchQuery, setSearchQuery]       = useState("");
  const [caseTypeFilter, setCaseTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter]     = useState("all");
  const [statusFilter, setStatusFilter]     = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>('severity');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [titleWidth,   setTitleWidth]   = useState(300);
  const [companyWidth, setCompanyWidth] = useState(200);
  const resizeStartX     = useRef(0);
  const resizeStartWidth = useRef(0);

  function startTitleResize(e: React.MouseEvent) {
    e.preventDefault();
    resizeStartX.current     = e.clientX;
    resizeStartWidth.current = titleWidth;
    const onMove = (ev: MouseEvent) => {
      setTitleWidth(Math.max(120, resizeStartWidth.current + ev.clientX - resizeStartX.current));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function startCompanyResize(e: React.MouseEvent) {
    e.preventDefault();
    resizeStartX.current     = e.clientX;
    resizeStartWidth.current = companyWidth;
    const onMove = (ev: MouseEvent) => {
      setCompanyWidth(Math.max(100, resizeStartWidth.current + ev.clientX - resizeStartX.current));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  // ── Alert 絞り込みフィルタ ────────────────────────────────────────────────
  const [alertPresenceFilter, setAlertPresenceFilter]   = useState("all");   // all / with / without
  const [alertPriorityFilter, setAlertPriorityFilter]   = useState("all");
  const [alertStatusFilter, setAlertStatusFilter]       = useState("all");
  // dismissed: "hide"（default）| "only" | "include"
  const [dismissedFilter, setDismissedFilter] = useState("hide");
  // escalation: "all" | "only"
  const [escalationFilter, setEscalationFilter] = useState("all");
  // AI review status: all / pending / reviewed / corrected / approved / no_ai_state
  const [aiReviewFilter, setAiReviewFilter] = useState("all");
  // AI freshness: all / fresh / stale / missing / locked
  const [aiFreshnessFilter, setAiFreshnessFilter] = useState("all");

  function resetAllFilters() {
    setSearchQuery("");
    setCaseTypeFilter("all");
    setSourceFilter("all");
    setStatusFilter("all");
    setSeverityFilter("all");
    setAlertPresenceFilter("all");
    setAlertPriorityFilter("all");
    setAlertStatusFilter("all");
    setDismissedFilter("hide");
    setEscalationFilter("all");
    setAiReviewFilter("all");
    setAiFreshnessFilter("all");
  }

  const activeFilterCount = [
    caseTypeFilter, sourceFilter, statusFilter, severityFilter,
    alertPresenceFilter, alertPriorityFilter, alertStatusFilter,
    escalationFilter, aiReviewFilter, aiFreshnessFilter,
  ].filter(v => v !== "all").length + (searchQuery ? 1 : 0) + (dismissedFilter !== "hide" ? 1 : 0);

  useEffect(() => {
    Promise.all([
      fetchSupportCases(200).catch(err => {
        console.warn('[SupportQueue] cases fetch failed, using mock:', err);
        setLoadError('データ取得に失敗しました（mock表示中）');
        return null;
      }),
      fetchSupportAlerts(200).catch(() => [] as AppSupportAlert[]),
    ]).then(([cases, alerts]) => {
      // cases === null は fetch 失敗（上の catch で null を返す）を意味する。
      // 空配列 [] はテーブルが空 or フィルタ結果0件 → モックではなく空状態を表示。
      if (cases !== null) {
        setApiCases(cases);
        // 永続化済み case state を一括ロード
        loadCaseStates(cases.map(c => c.id)).catch(err =>
          console.warn('[SupportQueue] state load failed:', err),
        );
        // AI state を一括ロード（intercom + cse_ticket 両方）
        Promise.all([
          fetch('/api/support/ai-states?source_queue=intercom&limit=500').then(r => r.ok ? r.json() : {}),
          fetch('/api/support/ai-states?source_queue=cse_ticket&limit=500').then(r => r.ok ? r.json() : {}),
        ]).then(([intercomData, cseData]) => {
          const merged: Record<string, SupportCaseAiViewModel> = {};
          for (const [id, vm] of Object.entries(intercomData as Record<string, SupportCaseAiViewModel>)) {
            merged[`intercom:${id}`] = vm;
          }
          for (const [id, vm] of Object.entries(cseData as Record<string, SupportCaseAiViewModel>)) {
            merged[`cse_ticket:${id}`] = vm;
          }
          setAiVmMap(merged);
        }).catch(err => console.warn('[SupportQueue] AI state load failed:', err));
      }
      const map: AlertsMap = {};
      for (const a of alerts) {
        if (!a.sourceId) continue;
        const existing = map[a.sourceId];
        if (!existing || (PRIORITY_ORDER[a.priority] ?? 9) < (PRIORITY_ORDER[existing.priority] ?? 9)) {
          map[a.sourceId] = a;
        }
      }
      setAlertsMap(map);
    });
  }, [loadCaseStates]);

  const isLoading = apiCases === null;
  const cases: SupportCase[] = apiCases ?? [];

  const views = [
    { value: "all",       label: "All Cases",   description: "すべての案件",       isDefault: true },
    { value: "unassigned",label: "Unassigned",   description: "未アサインの案件" },
    { value: "my",        label: "My Cases",     description: "自分の担当案件" },
    { value: "inquiry",   label: "Inquiries",    description: "問い合わせのみ" },
    { value: "support",   label: "Support",      description: "サポート案件のみ" },
    { value: "cse",       label: "CSE Linked",   description: "CSE連携案件のみ" },
  ];

  const viewConfig: Record<string, {
    subtitle: string;
    filterCases: (c: SupportCase) => boolean;
    emptyState: { title: string; description: string; cta: { label: string; action: () => void } | null };
  }> = {
    all: {
      subtitle: "全件を管理する運用画面 — 絞り込み・並び替え・一括操作・Detail への入口",
      filterCases: () => true,
      emptyState: { title: "案件がありません", description: "問い合わせやサポート案件が発生すると、ここに表示されます", cta: null },
    },
    unassigned: {
      subtitle: "未アサインの案件を優先的に振り分ける",
      filterCases: (c) => c.routingStatus === "unassigned",
      emptyState: { title: "未アサインの案件はありません", description: "すべての案件が振り分け済みです", cta: { label: "All Cases を見る", action: () => setCurrentView("all") } },
    },
    my: {
      subtitle: "自分が担当している案件を確認する",
      filterCases: (c) => c.owner === "山本 一郎",
      emptyState: { title: "担当している案件はありません", description: "案件が割り当てられると、ここに表示されます", cta: { label: "Unassigned を見る", action: () => setCurrentView("unassigned") } },
    },
    inquiry: {
      subtitle: "新規問い合わせのみを確認する",
      filterCases: (c) => c.caseType === "Inquiry",
      emptyState: { title: "問い合わせはありません", description: "新規問い合わせが発生すると、ここに表示されます", cta: { label: "All Cases を見る", action: () => setCurrentView("all") } },
    },
    support: {
      subtitle: "サポート案件のみを確認する",
      filterCases: (c) => c.caseType === "Support",
      emptyState: { title: "サポート案件はありません", description: "サポート案件が発生すると、ここに表示されます", cta: { label: "All Cases を見る", action: () => setCurrentView("all") } },
    },
    cse: {
      subtitle: "CSE連携案件のみを確認する",
      filterCases: (c) => c.caseType === "CSE Ticket Linked" || c.caseType === "CSE Ticket",
      emptyState: { title: "CSE連携案件はありません", description: "CSE Ticketと連携した案件が発生すると、ここに表示されます", cta: { label: "All Cases を見る", action: () => setCurrentView("all") } },
    },
  };

  const config = viewConfig[currentView];
  const currentViewLabel = views.find((v) => v.value === currentView)?.label ?? "";

  // ── フィルタ適用 ──────────────────────────────────────────────────────────
  let filteredCases = cases.filter(config.filterCases);

  // Dismissed フィルタ（デフォルト: 非表示）
  if (dismissedFilter === "hide") {
    filteredCases = filteredCases.filter(c => !isDismissed(c.id));
  } else if (dismissedFilter === "only") {
    filteredCases = filteredCases.filter(c => isDismissed(c.id));
  }
  // "include" はフィルタなし（全件表示）

  if (searchQuery) {
    filteredCases = filteredCases.filter(
      (c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.companyName.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }
  if (caseTypeFilter !== "all")  filteredCases = filteredCases.filter((c) => c.caseType === caseTypeFilter);
  if (sourceFilter   !== "all")  filteredCases = filteredCases.filter((c) => c.source === sourceFilter);
  // AI-aware フィルタ: severity / routingStatus は AI 値（hasAiState 時）を優先使用
  if (statusFilter !== "all") {
    filteredCases = filteredCases.filter(c => {
      const aiKey = `${c.sourceTable === 'cse_tickets' ? 'cse_ticket' : 'intercom'}:${c.id}`;
      const aiVm = aiVmMap[aiKey];
      const rs = aiVm?.hasAiState ? aiVm.routingStatus : c.routingStatus;
      return rs === statusFilter;
    });
  }
  if (severityFilter !== "all") {
    filteredCases = filteredCases.filter(c => {
      const aiKey = `${c.sourceTable === 'cse_tickets' ? 'cse_ticket' : 'intercom'}:${c.id}`;
      const aiVm = aiVmMap[aiKey];
      const sev = aiVm?.hasAiState ? aiVm.severity : c.severity;
      return sev === severityFilter;
    });
  }
  // エスカレーション絞り込み
  if (escalationFilter === "only") {
    filteredCases = filteredCases.filter(c => {
      const aiKey = `${c.sourceTable === 'cse_tickets' ? 'cse_ticket' : 'intercom'}:${c.id}`;
      return !!aiVmMap[aiKey]?.escalationNeeded;
    });
  }
  // AI Review Status 絞り込み
  if (aiReviewFilter !== "all") {
    filteredCases = filteredCases.filter(c => {
      const aiKey = `${c.sourceTable === 'cse_tickets' ? 'cse_ticket' : 'intercom'}:${c.id}`;
      const aiVm = aiVmMap[aiKey];
      if (aiReviewFilter === "no_ai_state") return !aiVm?.hasAiState;
      return aiVm?.hasAiState && aiVm.humanReviewStatus === aiReviewFilter;
    });
  }
  // AI Freshness 絞り込み
  if (aiFreshnessFilter !== "all") {
    filteredCases = filteredCases.filter(c => {
      const aiKey = `${c.sourceTable === 'cse_tickets' ? 'cse_ticket' : 'intercom'}:${c.id}`;
      const aiVm  = aiVmMap[aiKey];
      const state = aiVm?.hasAiState
        ? { hasAiState: true,  humanReviewStatus: aiVm.humanReviewStatus, lastAiUpdatedAt: aiVm.lastAiUpdatedAt }
        : { hasAiState: false, humanReviewStatus: 'pending' as const,     lastAiUpdatedAt: null };
      return getAiFreshnessStatus(state) === (aiFreshnessFilter as AiFreshnessStatus);
    });
  }

  filteredCases = [...filteredCases].sort((a, b) => {
    const aiKeyA = `${a.sourceTable === 'cse_tickets' ? 'cse_ticket' : 'intercom'}:${a.id}`;
    const aiKeyB = `${b.sourceTable === 'cse_tickets' ? 'cse_ticket' : 'intercom'}:${b.id}`;
    const aiA = aiVmMap[aiKeyA];
    const aiB = aiVmMap[aiKeyB];
    let cmp = 0;
    switch (sortKey) {
      case 'title':         cmp = a.title.localeCompare(b.title, 'ja'); break;
      case 'companyName':   cmp = a.companyName.localeCompare(b.companyName, 'ja'); break;
      case 'severity': {
        // AI-aware severity sort（AI値優先）+ escalation を先頭に
        const escA = aiA?.escalationNeeded ? -1 : 0;
        const escB = aiB?.escalationNeeded ? -1 : 0;
        const sevA = aiA?.hasAiState ? aiA.severity : a.severity;
        const sevB = aiB?.hasAiState ? aiB.severity : b.severity;
        cmp = (escA - escB) || ((SEVERITY_ORDER[sevA] ?? 9) - (SEVERITY_ORDER[sevB] ?? 9));
        break;
      }
      case 'routingStatus': {
        const rsA = aiA?.hasAiState ? aiA.routingStatus : a.routingStatus;
        const rsB = aiB?.hasAiState ? aiB.routingStatus : b.routingStatus;
        cmp = rsA.localeCompare(rsB);
        break;
      }
      case 'createdAt':     cmp = a.createdAt.localeCompare(b.createdAt); break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // Alert 絞り込み
  if (alertPresenceFilter === "with")    filteredCases = filteredCases.filter((c) => !!alertsMap[c.id]);
  if (alertPresenceFilter === "without") filteredCases = filteredCases.filter((c) => !alertsMap[c.id]);
  if (alertPriorityFilter !== "all") {
    filteredCases = filteredCases.filter((c) => alertsMap[c.id]?.priority === alertPriorityFilter);
  }
  if (alertStatusFilter !== "all") {
    filteredCases = filteredCases.filter((c) => alertsMap[c.id]?.status === alertStatusFilter);
  }

  const viewBaseCases = cases.filter(config.filterCases);
  const dismissedCount = cases.filter(c => isDismissed(c.id)).length;
  const isFiltered = activeFilterCount > 0;
  const isViewEmpty = viewBaseCases.filter(c => !isDismissed(c.id)).length === 0 && dismissedFilter === "hide";

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Support Queue" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1800px] mx-auto p-6 space-y-6">

            {/* 読み込みエラーバナー */}
            {loadError && (
              <div className="flex items-center gap-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{loadError}</span>
              </div>
            )}

            {/* 一括操作 結果バナー */}
            {bulkRunning && (
              <div className="flex items-center gap-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
                <span className="animate-pulse">一括操作を実行中...</span>
              </div>
            )}
            {bulkNotify && !bulkRunning && (
              <div className={`flex items-center gap-3 text-sm rounded-lg px-4 py-2.5 border ${
                bulkNotify.failed === 0
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : bulkNotify.succeeded === 0
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                {bulkNotify.failed === 0
                  ? <span className="flex-1">{bulkNotify.succeeded}件の一括操作が完了しました
                      {(bulkNotify.lockedSkipped ?? 0) > 0 && (
                        <span className="ml-2 text-xs opacity-70">（承認済みのため {bulkNotify.lockedSkipped}件スキップ）</span>
                      )}
                    </span>
                  : bulkNotify.succeeded === 0
                    ? <><AlertTriangle className="w-4 h-4 flex-shrink-0" /><span className="flex-1">{bulkNotify.failed}件すべて失敗しました</span></>
                    : <><AlertTriangle className="w-4 h-4 flex-shrink-0" /><span className="flex-1">{bulkNotify.succeeded}件成功・{bulkNotify.failed}件失敗{(bulkNotify.lockedSkipped ?? 0) > 0 ? `・${bulkNotify.lockedSkipped}件スキップ` : ''}</span></>
                }
                <button onClick={() => setBulkNotify(null)} className="ml-2 text-current opacity-60 hover:opacity-100">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
              <ViewContextHeader
                pageName="Support Queue"
                currentView={currentViewLabel}
                subtitle={config.subtitle}
              />
              <ViewSwitcher
                currentView={currentView}
                views={views}
                onViewChange={setCurrentView}
              />
            </div>

            {/* Filters */}
            <div className="bg-white border rounded-lg p-4 space-y-3">
              {/* Row 1: 既存フィルタ */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="タイトル、Company名で検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={caseTypeFilter} onValueChange={setCaseTypeFilter}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Case Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Inquiry">Inquiry</SelectItem>
                    <SelectItem value="Support">Support</SelectItem>
                    <SelectItem value="CSE Ticket Linked">CSE Ticket Linked</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Source" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="Intercom">Intercom</SelectItem>
                    <SelectItem value="Slack">Slack</SelectItem>
                    <SelectItem value="Chatwork">Chatwork</SelectItem>
                    <SelectItem value="CSE Ticket">CSE Ticket</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="ステータス" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべてのステータス</SelectItem>
                    <SelectItem value="unassigned">未アサイン</SelectItem>
                    <SelectItem value="triaged">振り分け済</SelectItem>
                    <SelectItem value="assigned">アサイン済</SelectItem>
                    <SelectItem value="in progress">対応中</SelectItem>
                    <SelectItem value="waiting on customer">顧客待ち</SelectItem>
                    <SelectItem value="waiting on CSE">CSE待ち</SelectItem>
                    <SelectItem value="resolved_like">区切り済み</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="重要度" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての重要度</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="low">低</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Row 2: Alert + AI 絞り込み */}
              <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Bell className="w-3.5 h-3.5" />
                  Alert
                </div>
                <Select value={alertPresenceFilter} onValueChange={setAlertPresenceFilter}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="Alert 有無" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alert: すべて</SelectItem>
                    <SelectItem value="with">Alert あり</SelectItem>
                    <SelectItem value="without">Alert なし</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={alertPriorityFilter} onValueChange={setAlertPriorityFilter}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="Alert Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Priority: すべて</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={alertStatusFilter} onValueChange={setAlertStatusFilter}>
                  <SelectTrigger className="w-44 h-8 text-xs">
                    <SelectValue placeholder="Alert Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Status: すべて</SelectItem>
                    <SelectItem value="Untriaged">Untriaged</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                    <SelectItem value="Dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
                {/* AI: Escalation フィルタ */}
                <Select value={escalationFilter} onValueChange={setEscalationFilter}>
                  <SelectTrigger className={`w-40 h-8 text-xs ${escalationFilter !== "all" ? "border-orange-400 text-orange-700" : ""}`}>
                    <AlertTriangle className="w-3 h-3 mr-1 flex-shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Escalation: すべて</SelectItem>
                    <SelectItem value="only">Escalation のみ</SelectItem>
                  </SelectContent>
                </Select>
                {/* AI Freshness フィルタ */}
                <Select value={aiFreshnessFilter} onValueChange={setAiFreshnessFilter}>
                  <SelectTrigger className={`w-36 h-8 text-xs ${aiFreshnessFilter !== "all" ? "border-teal-400 text-teal-700" : ""}`}>
                    <SelectValue placeholder="AI Freshness" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Freshness: すべて</SelectItem>
                    <SelectItem value="fresh">fresh — 最新</SelectItem>
                    <SelectItem value="stale">stale — 要更新</SelectItem>
                    <SelectItem value="missing">missing — 未生成</SelectItem>
                    <SelectItem value="locked">locked — 承認済み</SelectItem>
                  </SelectContent>
                </Select>
                {/* AI Review Status フィルタ */}
                <Select value={aiReviewFilter} onValueChange={setAiReviewFilter}>
                  <SelectTrigger className={`w-40 h-8 text-xs ${aiReviewFilter !== "all" ? "border-purple-400 text-purple-700" : ""}`}>
                    <SelectValue placeholder="AI Review" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">AI Review: すべて</SelectItem>
                    <SelectItem value="pending">pending — 未確認</SelectItem>
                    <SelectItem value="reviewed">reviewed — 確認済み</SelectItem>
                    <SelectItem value="corrected">corrected — 補正済み</SelectItem>
                    <SelectItem value="approved">approved — 承認済み</SelectItem>
                    <SelectItem value="no_ai_state">AI なし</SelectItem>
                  </SelectContent>
                </Select>

                {/* Dismissed フィルタ */}
                <Select value={dismissedFilter} onValueChange={setDismissedFilter}>
                  <SelectTrigger className={`w-44 h-8 text-xs ${dismissedFilter !== "hide" ? "border-slate-400 text-slate-700" : ""}`}>
                    <Archive className="w-3 h-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hide">Dismissed: 非表示</SelectItem>
                    <SelectItem value="include">Dismissed: 含む</SelectItem>
                    <SelectItem value="only">Dismissed のみ {dismissedCount > 0 ? `(${dismissedCount})` : ''}</SelectItem>
                  </SelectContent>
                </Select>

                {activeFilterCount > 0 && (
                  <button
                    onClick={resetAllFilters}
                    className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                  >
                    <X className="w-3 h-3" />
                    フィルタをリセット
                    <span className="bg-slate-200 text-slate-600 rounded-full px-1.5 py-0.5 text-xs font-medium ml-0.5">
                      {activeFilterCount}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Table / Loading / Empty state */}
            {isLoading ? (
              <div className="bg-white border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <TableHead key={i}><Skeleton className="h-4 w-16" /></TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : isViewEmpty ? (
              /* View 自体に案件がない */
              <div className="flex flex-col items-center justify-center py-16 bg-white border rounded-lg">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <Filter className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{config.emptyState.title}</h3>
                <p className="text-sm text-slate-500 text-center max-w-md">{config.emptyState.description}</p>
                {config.emptyState.cta && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={config.emptyState.cta.action}
                    className="mt-4"
                  >
                    {config.emptyState.cta.label} <ArrowRight className="w-3 h-3 ml-2" />
                  </Button>
                )}
              </div>
            ) : filteredCases.length === 0 ? (
              /* フィルタ結果が0件 */
              <div className="flex flex-col items-center justify-center py-16 bg-white border rounded-lg">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <Filter className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">条件に一致する案件がありません</h3>
                <p className="text-sm text-slate-500 text-center max-w-md">
                  フィルタ条件を変更するか、リセットしてください
                </p>
                <div className="text-xs text-slate-400 mt-1">{currentViewLabel} ・ {activeFilterCount}個のフィルタ適用中</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetAllFilters}
                  className="mt-4"
                >
                  <X className="w-3 h-3 mr-2" />
                  フィルタをリセット
                </Button>
              </div>
            ) : (
              <div className="bg-white border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-8 px-2">
                        <button
                          onClick={() => {
                            if (selectedIds.size === filteredCases.length && filteredCases.length > 0) {
                              clearSelection();
                            } else {
                              selectAll(filteredCases.map(c => c.id));
                            }
                          }}
                          className="flex items-center justify-center text-slate-400 hover:text-slate-600"
                        >
                          {selectedIds.size === filteredCases.length && filteredCases.length > 0
                            ? <CheckSquare className="w-4 h-4" />
                            : <Square className="w-4 h-4" />
                          }
                        </button>
                      </TableHead>
                      <TableHead className="relative select-none" style={{ width: titleWidth, minWidth: 120 }}>
                        <button onClick={() => toggleSort('title')} className="flex items-center gap-1 hover:text-slate-900 whitespace-nowrap pr-3">
                          Case / Ticket Title
                          {sortKey === 'title'
                            ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            : <ChevronsUpDown className="w-3 h-3 text-slate-300" />}
                        </button>
                        <div
                          onMouseDown={startTitleResize}
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors"
                        />
                      </TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="relative select-none" style={{ width: companyWidth, minWidth: 100 }}>
                        <button onClick={() => toggleSort('companyName')} className="flex items-center gap-1 hover:text-slate-900 whitespace-nowrap pr-3">
                          Company / Project
                          {sortKey === 'companyName'
                            ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            : <ChevronsUpDown className="w-3 h-3 text-slate-300" />}
                        </button>
                        <div
                          onMouseDown={startCompanyResize}
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors"
                        />
                      </TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Team</TableHead>
                      <SortableHead label="Routing Status"      sortK="routingStatus" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <TableHead>Source Status</TableHead>
                      <SortableHead label="Severity"            sortK="severity"      currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <SortableHead label="Created"             sortK="createdAt"     currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                      <TableHead>First Response</TableHead>
                      <TableHead>Open Duration</TableHead>
                      <TableHead>Alert</TableHead>
                      <TableHead>Linked</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCases.map((sc) => {
                      const vm = buildCaseViewModel(sc, getCaseRecord(sc.id));
                      const alert = alertsMap[sc.id];
                      const aiSourceQueue = sc.sourceTable === 'cse_tickets' ? 'cse_ticket' : 'intercom';
                      const aiVm = aiVmMap[`${aiSourceQueue}:${sc.id}`] ?? null;
                      const borderClass = alert ? (ALERT_ROW_BORDER[alert.priority] ?? 'border-l-4 border-l-slate-300') : '';
                      return (
                        <TableRow
                          key={sc.id}
                          onClick={() => router.push(`/support/${sc.id}`)}
                          className={`hover:bg-slate-50 cursor-pointer ${borderClass} ${alert ? 'bg-slate-50/60' : ''} ${vm.isDismissed ? 'opacity-50' : ''} ${selectedIds.has(sc.id) ? 'bg-blue-50/60' : ''}`}
                        >
                          {/* Checkbox */}
                          <TableCell className="w-8 px-2" onClick={e => toggleSelect(sc.id, e)}>
                            <button className="flex items-center justify-center text-slate-400 hover:text-slate-600">
                              {selectedIds.has(sc.id)
                                ? <CheckSquare className="w-4 h-4 text-blue-600" />
                                : <Square className="w-4 h-4" />
                              }
                            </button>
                          </TableCell>

                          {/* Title */}
                          <TableCell style={{ maxWidth: titleWidth, width: titleWidth }}>
                            <Link href={`/support/${sc.id}`} className="font-medium text-slate-900 hover:text-blue-600 hover:underline block truncate" title={vm.title}>
                              {vm.title === '(タイトルなし)'
                                ? <span className="text-slate-400 italic">(タイトルなし)</span>
                                : vm.title
                              }
                            </Link>
                          </TableCell>

                          {/* Type / Source */}
                          <TableCell><CaseTypeBadge type={vm.caseType} /></TableCell>
                          <TableCell><SourceBadge source={vm.sourceType} /></TableCell>

                          {/* Company / Project */}
                          <TableCell style={{ maxWidth: companyWidth, width: companyWidth }}>
                            <div className="space-y-1">
                              {vm.companyUid ? (
                                <Link href={`/companies/${vm.companyUid}`} className="text-sm text-slate-700 hover:text-blue-600 hover:underline block truncate" title={vm.companyName}>
                                  <Building className="w-3 h-3 inline mr-1" />{vm.companyName}
                                </Link>
                              ) : (
                                <span className="text-sm text-slate-500 block truncate" title={vm.companyName}>
                                  <Building className="w-3 h-3 inline mr-1" />{vm.companyName}
                                </span>
                              )}
                              {vm.projectName && (
                                <span className="text-xs text-slate-500 block truncate" title={vm.projectName}>{vm.projectName}</span>
                              )}
                            </div>
                          </TableCell>

                          {/* Owner / Team */}
                          <TableCell className="text-sm text-slate-700">
                            {vm.ownerName ?? <span className="text-slate-400 italic text-xs">未アサイン</span>}
                          </TableCell>
                          <TableCell>
                            {vm.assignedTeam
                              ? <Badge variant="outline" className="text-xs">{vm.assignedTeam}</Badge>
                              : <span className="text-xs text-slate-400">-</span>
                            }
                          </TableCell>

                          {/* Routing + Lifecycle */}
                          <TableCell>
                            <div
                              className="flex flex-col gap-1"
                              title={vm.isDismissed && vm.dismissedReason ? `対応不要理由: ${vm.dismissedReason}` : undefined}
                            >
                              <RoutingBadge status={aiVm?.hasAiState ? aiVm.routingStatus : vm.routingStatus} />
                              <LifecycleStatusBadge status={vm.lifecycleStatus} />
                              {aiVm?.escalationNeeded && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                                  <AlertTriangle className="w-2.5 h-2.5" />Esc
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Source Status */}
                          <TableCell><SourceStatusBadge status={vm.sourceStatus} /></TableCell>

                          {/* Severity + AI urgency */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <SeverityBadge severity={aiVm?.hasAiState ? aiVm.severity : vm.severity} />
                              {aiVm?.hasAiState && aiVm.priority === 'urgent' && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 border border-red-200"
                                  title="AI urgency: urgent — 即対応推奨">
                                  緊急
                                </span>
                              )}
                              {aiVm?.hasAiState && aiVm.priority === 'high' && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 border border-orange-200"
                                  title="AI urgency: high — 優先対応">
                                  高優先
                                </span>
                              )}
                              {aiVm?.hasAiState && (aiVm.priority === 'normal' || aiVm.priority === 'low') && (
                                <span className="text-[10px] text-purple-500 font-medium">AI</span>
                              )}
                            </div>
                          </TableCell>

                          {/* Created */}
                          <TableCell className="text-xs text-slate-600 whitespace-nowrap">{vm.createdAt}</TableCell>

                          {/* Aging / Open Duration */}
                          <TableCell className="text-xs text-slate-600">
                            {vm.openDuration ? (
                              <div className="space-y-0.5">
                                <div>{vm.openDuration}</div>
                                {vm.waitingDuration && (
                                  <div className="text-amber-600">待機: {vm.waitingDuration}</div>
                                )}
                                {vm.isOverdue && vm.agingText && (
                                  <div className="text-rose-600 font-medium">{vm.agingText} ⚠</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>

                          {/* Alert */}
                          <TableCell>
                            {alert
                              ? <AlertBadge alert={alert} caseId={sc.id} />
                              : <span className="text-xs text-slate-300">—</span>
                            }
                          </TableCell>

                          {/* Linked: CSE ticket + action/cse record status */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {vm.linkedCSETicket && (
                                <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700">
                                  <Ticket className="w-3 h-3 mr-1" />{vm.linkedCSETicket}
                                </Badge>
                              )}
                              {vm.hasAction && vm.actionStatus && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${ACTION_STATUS_COLOR[vm.actionStatus] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}
                                  title={[
                                    `Action: ${ACTION_STATUS_LABEL[vm.actionStatus] ?? vm.actionStatus}`,
                                    vm.actionOwner ? `担当: ${vm.actionOwner}` : null,
                                  ].filter(Boolean).join(' · ')}
                                >
                                  ▶ {ACTION_STATUS_LABEL[vm.actionStatus] ?? vm.actionStatus}
                                </Badge>
                              )}
                              {vm.hasCseTicket && vm.cseTicketStatus && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${CSE_STATUS_COLOR[vm.cseTicketStatus] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}
                                  title={[
                                    `CSE: ${CSE_STATUS_LABEL[vm.cseTicketStatus] ?? vm.cseTicketStatus}`,
                                    vm.cseTicketOwner ? `担当: ${vm.cseTicketOwner}` : null,
                                    vm.cseTicketCreatedAt ? `作成: ${vm.cseTicketCreatedAt.slice(0, 10)}` : null,
                                  ].filter(Boolean).join(' · ')}
                                >
                                  <Ticket className="w-3 h-3 mr-1" />{CSE_STATUS_LABEL[vm.cseTicketStatus] ?? vm.cseTicketStatus}
                                </Badge>
                              )}
                              {vm.relatedContent > 0 && (
                                <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                                  Content: {vm.relatedContent}
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Detail link */}
                          <TableCell>
                            <Link href={`/support/${sc.id}`}>
                              <Button variant="ghost" size="sm" className="h-7 text-xs">
                                詳細を見る <ArrowRight className="w-3 h-3 ml-1" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="p-4 border-t text-center text-sm text-slate-500">
                  {filteredCases.length}件を表示中
                  {isFiltered && viewBaseCases.length !== filteredCases.length && (
                    <span className="ml-1 text-slate-400">（{currentViewLabel}: {viewBaseCases.length}件中）</span>
                  )}
                </div>
              </div>
            )}

            {/* Bulk action bar — sticky at bottom when items selected */}
            {selectedIds.size > 0 && (
              <div className="sticky bottom-4 z-10 space-y-2">

                {/* Approved confirm ダイアログ */}
                {showApproveConfirm && (
                  <div className="bg-white border border-amber-200 rounded-xl px-5 py-4 shadow-lg space-y-3">
                    <div className="flex items-start gap-2">
                      <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {selectedIds.size}件を「承認済み (approved)」にする
                        </p>
                        <ul className="mt-1.5 space-y-1 text-xs text-slate-600 list-none">
                          <li className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                            approved 後は AI 再生成が不可になります
                          </li>
                          <li className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                            AI 値が effective 値として固定採用されます
                          </li>
                          <li className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                            変更するには downgrade 操作（reviewed に戻す）が必要です
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="text-xs text-slate-500" onClick={() => setShowApproveConfirm(false)}>
                        キャンセル
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
                        onClick={() => executeBulkAiReview('approved')}
                      >
                        <Lock className="w-3 h-3 mr-1" />確認して承認
                      </Button>
                    </div>
                  </div>
                )}

                {/* Inline payload form */}
                {bulkFormMode && (
                  <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-lg space-y-3">
                    <p className="text-sm font-semibold text-slate-800">
                      {bulkFormMode === 'dismiss'  && `${selectedIds.size}件を「対応不要」にする`}
                      {bulkFormMode === 'action'   && `${selectedIds.size}件に Action を作成する`}
                      {bulkFormMode === 'cse'      && `${selectedIds.size}件に CSE Ticket を作成する`}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {bulkFormMode === 'dismiss' ? (
                        <input
                          placeholder="理由（任意）"
                          value={bulkReason}
                          onChange={e => setBulkReason(e.target.value)}
                          className="col-span-2 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                      ) : (
                        <>
                          <input
                            placeholder="タイトル（任意）"
                            value={bulkTitle}
                            onChange={e => setBulkTitle(e.target.value)}
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                          />
                          <input
                            placeholder="担当者（任意）"
                            value={bulkOwner}
                            onChange={e => setBulkOwner(e.target.value)}
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                          />
                        </>
                      )}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="text-xs text-slate-500" onClick={closeBulkForm}>
                        キャンセル
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs bg-slate-900 hover:bg-slate-700 text-white"
                        onClick={
                          bulkFormMode === 'dismiss' ? handleBulkDismiss :
                          bulkFormMode === 'action'  ? handleBulkCreateAction :
                          handleBulkCreateCseTicket
                        }
                      >
                        実行
                      </Button>
                    </div>
                  </div>
                )}

                {/* Action bar */}
                <div className="flex items-center gap-3 bg-slate-900 text-white rounded-xl px-5 py-3 shadow-xl">
                  <span className="text-sm font-medium text-slate-200">
                    {selectedIds.size}件を選択中
                  </span>
                  <div className="flex-1" />
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`text-xs hover:bg-white/10 gap-1.5 ${bulkFormMode === 'dismiss' ? 'bg-white/20 text-white' : 'text-white'}`}
                    onClick={() => bulkFormMode === 'dismiss' ? closeBulkForm() : openBulkForm('dismiss')}
                  >
                    対応不要 (一括)
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`text-xs hover:bg-white/10 gap-1.5 ${bulkFormMode === 'action' ? 'bg-white/20 text-white' : 'text-white'}`}
                    onClick={() => bulkFormMode === 'action' ? closeBulkForm() : openBulkForm('action')}
                  >
                    Action 作成 (一括)
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`text-xs hover:bg-white/10 gap-1.5 ${bulkFormMode === 'cse' ? 'bg-white/20 text-white' : 'text-white'}`}
                    onClick={() => bulkFormMode === 'cse' ? closeBulkForm() : openBulkForm('cse')}
                  >
                    CSE Ticket 作成 (一括)
                  </Button>
                  {/* AI Review 一括 */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs hover:bg-white/10 text-white gap-1.5"
                    onClick={() => handleBulkAiReview('reviewed')}
                    title="選択中のケースを AI確認済みにする（即実行）"
                  >
                    AI確認済み (一括)
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs hover:bg-white/10 text-white gap-1.5"
                    onClick={() => handleBulkAiReview('approved')}
                    title="選択中のケースを AI承認済みにする（確認ステップあり）"
                  >
                    <Lock className="w-3 h-3" />AI承認 (一括)
                  </Button>
                  {/* AI Regenerate 一括 */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs hover:bg-white/10 text-white gap-1.5"
                    onClick={handleBulkRegenerate}
                    title="approved 以外のケースの AI state を再生成する"
                  >
                    <RefreshCw className="w-3 h-3" />AI再生成 (一括)
                  </Button>
                  {/* Assign: not yet implemented */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-slate-500 cursor-not-allowed gap-1.5"
                    disabled
                    title="アサイン一括操作は未実装"
                  >
                    アサイン (一括)
                  </Button>
                  <button
                    onClick={() => { closeBulkForm(); clearSelection(); }}
                    className="ml-2 text-slate-400 hover:text-white"
                    title="選択をクリア"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
