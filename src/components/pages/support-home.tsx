"use client";
import { useState, useEffect } from "react";
import { fetchSupportCases } from "@/lib/nocodb-client";
import type { QueueItem } from "@/lib/nocodb-client";
import Link from "next/link";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Inbox,
  X,
  Undo2,
  ArrowUpRight,
} from "lucide-react";
import {
  CaseTypeBadge,
  SourceBadge,
  RoutingBadge,
  SeverityBadge,
} from "@/lib/support/badges";
import { useCaseState } from "@/lib/support/case-state";
import { buildCaseViewModels } from "@/lib/support/view-model";
import type { SupportCaseViewModel } from "@/lib/support/view-model";
import type { SupportCaseAiViewModel } from "@/lib/support/support-ai-state-view-model";
import { applyAiDisplayToItem } from "@/lib/support/support-ai-state-merge";

// ── Quick filters ─────────────────────────────────────────────────────────────

const QUICK_FILTERS = [
  { value: 'all',            label: 'All' },
  { value: 'unassigned',     label: 'Unassigned' },
  { value: 'waiting_on_cse', label: 'Waiting on CSE' },
  { value: 'high',           label: 'High Severity' },
] as const;

type QuickFilter = (typeof QUICK_FILTERS)[number]['value'];

function applyFilter(items: SupportCaseViewModel[], filter: QuickFilter): SupportCaseViewModel[] {
  switch (filter) {
    case 'unassigned':     return items.filter(i => i.routingStatus === 'unassigned');
    case 'waiting_on_cse': return items.filter(i => i.routingStatus === 'waiting on CSE');
    case 'high':           return items.filter(i => i.severity === 'high');
    default:               return items;
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function SupportHome() {
  const [apiCases, setApiCases]       = useState<QueueItem[] | null>(null);
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [refreshing, setRefreshing]   = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  // AI state map — keyed by "${source_queue}:${source_record_id}"
  const [aiVmMap, setAiVmMap]         = useState<Record<string, SupportCaseAiViewModel>>({});
  // sourceTable lookup for AI state keying
  const [sourceTableMap, setSourceTableMap] = useState<Record<string, string>>({});

  // UI-level undo tracking (which case was just dismissed in this component)
  const [lastDismissedId, setLastDismissedId] = useState<string | null>(null);

  // Global case state
  const { dismissCase, undismissCase, getCaseRecord, loadCaseStates } = useCaseState();

  function load() {
    setRefreshing(true);
    setLoadError(null);
    fetchSupportCases(200)
      .then(data => {
        setApiCases(data);
        // sourceTable lookup map
        const stMap: Record<string, string> = {};
        for (const c of data) stMap[c.id] = c.sourceTable;
        setSourceTableMap(stMap);
        // 取得したケースの永続化済み state を一括ロード
        loadCaseStates(data.map(c => c.id)).catch(err =>
          console.warn('[SupportHome] state load failed:', err),
        );
        // AI state を一括ロード
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
        }).catch(err => console.warn('[SupportHome] AI state load failed:', err));
      })
      .catch(err => {
        console.warn('[SupportHome] fetch failed:', err);
        setLoadError('データ取得に失敗しました');
        setApiCases([]);
      })
      .finally(() => setRefreshing(false));
  }

  useEffect(() => { load(); }, []);

  function handleDismiss(id: string) {
    dismissCase(id, {});
    setLastDismissedId(id);
  }

  function handleUndoDismiss() {
    if (!lastDismissedId) return;
    undismissCase(lastDismissedId);
    setLastDismissedId(null);
  }

  const isLoading = apiCases === null;

  // Build view models — AI display 値を適用してから buildCaseViewModels に渡す。
  // applyAiDisplayToItem により severity / routingStatus が AI 値で上書きされ、
  // isHomeWorthy / getCaseReasons / priorityScore がすべて AI 値を参照する。
  const adjustedCases = (apiCases ?? []).map(c => {
    const aq = sourceTableMap[c.id] === 'cse_tickets' ? 'cse_ticket' : 'intercom';
    return applyAiDisplayToItem(c, aiVmMap[`${aq}:${c.id}`] ?? null);
  });
  const allVMs = buildCaseViewModels(adjustedCases, getCaseRecord);
  // isVisibleInHome は AI-adjusted QueueItem から算出済み。
  // さらにエスカレーション必要案件（AI判定）は Home に引き上げる。
  const visibleIdSet = new Set(allVMs.filter(vm => vm.isVisibleInHome).map(vm => vm.id));
  for (const [key, aiVm] of Object.entries(aiVmMap)) {
    if (!aiVm.hasAiState || !aiVm.escalationNeeded) continue;
    const sourceRecordId = key.split(':').slice(1).join(':');
    visibleIdSet.add(sourceRecordId);
  }
  const priorityItems = allVMs
    .filter(vm => visibleIdSet.has(vm.id))
    .sort((a, b) => b.priorityScore - a.priorityScore || b.createdAt.localeCompare(a.createdAt));

  const countMap: Record<QuickFilter, number> = {
    all:            priorityItems.length,
    unassigned:     priorityItems.filter(i => i.routingStatus === 'unassigned').length,
    waiting_on_cse: priorityItems.filter(i => i.routingStatus === 'waiting on CSE').length,
    high:           priorityItems.filter(i => i.severity === 'high').length,
  };

  const filtered = applyFilter(priorityItems, quickFilter);

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Support" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1400px] mx-auto p-6 space-y-5">

            {/* エラーバナー */}
            {loadError && (
              <div className="flex items-center gap-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{loadError}</span>
                <Button
                  variant="ghost" size="sm"
                  className="h-7 text-xs text-amber-800 hover:bg-amber-100"
                  onClick={load}
                >
                  再試行
                </Button>
              </div>
            )}

            {/* Undo バナー — dismiss 直後のみ表示 */}
            {lastDismissedId && (
              <div className="flex items-center gap-3 text-sm text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5">
                <span className="flex-1 text-slate-600">案件を Home から除外しました（対応不要）</span>
                <Button
                  variant="ghost" size="sm"
                  className="h-7 text-xs gap-1.5 text-slate-700 hover:text-slate-900"
                  onClick={handleUndoDismiss}
                >
                  <Undo2 className="w-3 h-3" /> 元に戻す
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="h-7 w-7 p-0 text-slate-400"
                  onClick={() => setLastDismissedId(null)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}

            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Support Home</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  未対応・判断待ち・高優先度のケースのみ表示しています。全件は{" "}
                  <Link href="/support/queue" className="text-blue-600 hover:underline">Queue</Link>{" "}
                  で確認できます。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  更新
                </Button>
                <Link href="/support/queue">
                  <Button size="sm">
                    Support Queue <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Quick filter tabs */}
            <div className="flex items-center gap-2">
              {QUICK_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setQuickFilter(f.value)}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors border flex items-center gap-1.5 ${
                    quickFilter === f.value
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                  {!isLoading && (
                    <span className={`text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center ${
                      quickFilter === f.value
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {countMap[f.value]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white border rounded-lg p-4 space-y-3">
                    <Skeleton className="h-5 w-32 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <div className="flex gap-2 pt-1">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-8 flex-1" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white border rounded-lg">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <Inbox className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">
                  {quickFilter !== 'all' ? 'このフィルタに一致する案件はありません' : '優先判断が必要なケースはありません'}
                </h3>
                <p className="text-sm text-slate-500 text-center max-w-sm">
                  {quickFilter !== 'all'
                    ? 'フィルタを解除するか、Support Queue で全件を確認してください'
                    : 'Dismissed・Resolved・CSE済みのケースは Home から除外されています。全件は Queue で確認できます。'
                  }
                </p>
                <div className="flex gap-2 mt-4">
                  {quickFilter !== 'all' && (
                    <Button variant="outline" size="sm" onClick={() => setQuickFilter('all')}>
                      すべて表示
                    </Button>
                  )}
                  <Link href="/support/queue">
                    <Button variant="outline" size="sm">
                      Support Queue を開く <ArrowRight className="w-3 h-3 ml-1.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(vm => {
                  const aiSourceQueue = sourceTableMap[vm.id] === 'cse_tickets' ? 'cse_ticket' : 'intercom';
                  const aiVm = aiVmMap[`${aiSourceQueue}:${vm.id}`] ?? null;
                  return (
                  <div
                    key={vm.id}
                    className="bg-white border rounded-lg p-4 space-y-3 hover:shadow-sm transition-shadow"
                  >
                    {/* Reason tag + createdAt */}
                    <div className="flex items-center justify-between">
                      {vm.homeReasons[0] ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${vm.homeReasons[0].className}`}>
                          {vm.homeReasons[0].label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-slate-100 text-slate-600 border-slate-200">
                          Needs attention
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{vm.createdAt}</span>
                    </div>

                    {/* Company / Project */}
                    <div>
                      {vm.companyUid ? (
                        <Link
                          href={`/companies/${vm.companyUid}`}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <Building className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{vm.companyName}</span>
                        </Link>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Building className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{vm.companyName}</span>
                        </span>
                      )}
                      {vm.projectName && (
                        <span className="text-xs text-slate-400 pl-4">{vm.projectName}</span>
                      )}
                    </div>

                    {/* Title */}
                    <Link
                      href={`/support/${vm.id}`}
                      className="block font-medium text-slate-900 hover:text-blue-600 leading-snug line-clamp-2"
                    >
                      {vm.title}
                    </Link>

                    {/* Badges — vm.severity / vm.routingStatus は applyAiDisplayToItem 適用済み */}
                    <div className="flex flex-wrap gap-1.5">
                      <CaseTypeBadge type={vm.caseType} />
                      <SourceBadge source={vm.sourceType} />
                      <RoutingBadge status={vm.routingStatus} />
                      <SeverityBadge severity={vm.severity} />
                      {aiVm?.hasAiState && (
                        <span className="text-[10px] text-purple-500 font-medium self-center">AI</span>
                      )}
                      {aiVm?.escalationNeeded && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                          <AlertTriangle className="w-2.5 h-2.5" />Esc
                        </span>
                      )}
                    </div>

                    {/* Open duration / aging */}
                    {vm.openDuration && (
                      <p className={`text-xs ${vm.isOverdue ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
                        Open: {vm.openDuration}
                        {vm.waitingDuration && ` · 待機: ${vm.waitingDuration}`}
                        {vm.agingText && ` · ${vm.agingText}`}
                      </p>
                    )}

                    {/* CTAs: 判断する（Detail遷移） + 対応不要（Dismiss） */}
                    <div className="flex gap-2 pt-0.5">
                      <Link href={`/support/${vm.id}`} className="flex-1">
                        <Button
                          variant="outline" size="sm"
                          className="w-full h-8 text-xs gap-1 border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                          対応する <ArrowUpRight className="w-3 h-3" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost" size="sm"
                        className="h-8 px-3 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 gap-1"
                        onClick={() => handleDismiss(vm.id)}
                        title="対応不要としてアーカイブ"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">対応不要</span>
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            {!isLoading && (
              <div className="text-center text-sm text-slate-500 pb-2">
                {filtered.length > 0 ? (
                  <>
                    {filtered.length}件を表示中
                    {quickFilter !== 'all' && (
                      <span className="ml-1 text-slate-400">（全{priorityItems.length}件中）</span>
                    )}
                  </>
                ) : null}
                <Link href="/support/queue" className="ml-3 text-blue-600 hover:underline text-sm">
                  全件は Queue で確認 →
                </Link>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
