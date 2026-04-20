"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building,
  RefreshCw,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  AlertTriangle,
  MessageSquare,
  Ticket,
  FolderOpen,
  User,
  Calendar,
  Search,
  X,
  Filter,
  TrendingUp,
} from "lucide-react";
import type { CompanyListItemVM } from "@/lib/company/company-vm";
import {
  getHealthBadge,
  FRESHNESS_SHORT_LABEL,
  COMMUNICATION_RISK_BADGE,
} from "@/lib/company/badges";

// ── 型定義 ────────────────────────────────────────────────────────────────────

type SortKey =
  | "priorityScore"
  | "companyName"
  | "lastContact"
  | "communicationBlankDays"
  | "openSupportCount";

interface Filters {
  search:          string;
  freshness:       string;   // '' | 'missing' | 'stale' | 'fresh' | 'locked'
  review:          string;   // '' | 'pending' | 'reviewed' | 'corrected' | 'approved'
  health:          string;   // '' | 'critical' | 'at_risk' | 'healthy' | 'expanding'
  phaseGap:        string;   // '' | 'yes' | 'no'
  commBlank:       string;   // '' | 'warning' | 'risk'
  supportCritical: string;   // '' | 'yes'
  csAssigned:      string;   // '' | 'yes' | 'no'
}

const DEFAULT_FILTERS: Filters = {
  search:          '',
  freshness:       '',
  review:          '',
  health:          '',
  phaseGap:        '',
  commBlank:       '',
  supportCritical: '',
  csAssigned:      '',
};

// ── ソートヘルパー ──────────────────────────────────────────────────────────────

function SortableHead({
  label,
  sortK,
  currentKey,
  currentDir,
  onSort,
  className,
}: {
  label:      string;
  sortK:      SortKey;
  currentKey: SortKey;
  currentDir: "asc" | "desc";
  onSort:     (k: SortKey) => void;
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
          ? currentDir === "asc"
            ? <ChevronUp className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />
          : <ChevronsUpDown className="w-3 h-3 text-slate-300" />
        }
      </button>
    </TableHead>
  );
}

// ── Badge helpers ──────────────────────────────────────────────────────────────

function FreshnessBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    missing: "bg-red-100 text-red-700 border-red-200",
    stale:   "bg-amber-100 text-amber-700 border-amber-200",
    fresh:   "bg-green-100 text-green-700 border-green-200",
    locked:  "bg-blue-100 text-blue-700 border-blue-200",
  };
  const label = FRESHNESS_SHORT_LABEL[status] ?? status;
  const cls   = map[status] ?? "bg-gray-100 text-gray-500 border-gray-200";
  return (
    <Badge variant="outline" className={`text-xs ${cls}`}>
      {label}
    </Badge>
  );
}

function ReviewBadge({ status }: { status: string | null }) {
  if (!status || status === "pending") {
    return <span className="text-xs text-amber-600">未確認</span>;
  }
  const map: Record<string, { label: string; cls: string }> = {
    reviewed:  { label: "確認済",  cls: "bg-sky-100 text-sky-700 border-sky-200" },
    corrected: { label: "補正済",  cls: "bg-violet-100 text-violet-700 border-violet-200" },
    approved:  { label: "承認済",  cls: "bg-green-100 text-green-700 border-green-200" },
  };
  const cfg = map[status];
  if (!cfg) return null;
  return (
    <Badge variant="outline" className={`text-xs ${cfg.cls}`}>
      {cfg.label}
    </Badge>
  );
}

function PhaseSourceBadge({ source }: { source: "CSM" | "CRM" | null }) {
  if (!source) return null;
  const cls = source === "CSM"
    ? "bg-indigo-50 text-indigo-600 border-indigo-200"
    : "bg-purple-50 text-purple-600 border-purple-200";
  return (
    <Badge variant="outline" className={`text-[10px] py-0 ${cls}`}>
      {source}
    </Badge>
  );
}

function CommBlankCell({ blankDays, riskLevel }: { blankDays: number | null; riskLevel: string }) {
  if (blankDays === null) return <span className="text-slate-400">—</span>;
  const badge = COMMUNICATION_RISK_BADGE[riskLevel as keyof typeof COMMUNICATION_RISK_BADGE];
  if (riskLevel === "none") {
    return <span className="text-xs text-slate-600">{blankDays}d</span>;
  }
  return (
    <span className={`text-xs font-medium ${riskLevel === "risk" ? "text-red-600" : "text-amber-600"}`}>
      {blankDays}d {badge?.label ? `(${badge.label})` : ""}
    </span>
  );
}

function PriorityScoreCell({ score, breakdown }: { score: number; breakdown: { reason: string; weight: number }[] }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`text-sm font-semibold tabular-nums cursor-default ${
            score >= 40 ? "text-red-600" :
            score >= 20 ? "text-amber-600" :
            "text-slate-600"
          }`}>
            {score}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs max-w-[200px]">
          {breakdown.length === 0
            ? <p className="text-slate-500">シグナルなし</p>
            : breakdown.map((b, i) => (
                <div key={i} className="flex justify-between gap-4">
                  <span>{b.reason}</span>
                  <span className="font-medium">+{b.weight}</span>
                </div>
              ))
          }
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── フィルタ適用 ───────────────────────────────────────────────────────────────

function applyFilters(items: CompanyListItemVM[], f: Filters): CompanyListItemVM[] {
  return items.filter(item => {
    if (f.search) {
      const q = f.search.toLowerCase();
      if (!item.companyName.toLowerCase().includes(q) && !item.companyUid.toLowerCase().includes(q)) return false;
    }
    if (f.freshness && item.freshnessStatus !== f.freshness) return false;
    if (f.review) {
      const rev = item.humanReviewStatus ?? "pending";
      if (rev !== f.review) return false;
    }
    if (f.health && item.overallHealth !== f.health) return false;
    if (f.phaseGap === "yes" && !item.phaseGap) return false;
    if (f.phaseGap === "no"  && item.phaseGap)  return false;
    if (f.commBlank === "warning" && item.communicationRiskLevel === "none") return false;
    if (f.commBlank === "risk"    && item.communicationRiskLevel !== "risk")  return false;
    if (f.supportCritical === "yes" && item.criticalSupportCount === 0)       return false;
    if (f.csAssigned === "yes" && !item.owner) return false;
    if (f.csAssigned === "no"  && !!item.owner) return false;
    return true;
  });
}

// ── ソート適用 ────────────────────────────────────────────────────────────────

function applySort(
  items: CompanyListItemVM[],
  key: SortKey,
  dir: "asc" | "desc",
): CompanyListItemVM[] {
  const sorted = [...items].sort((a, b) => {
    let diff = 0;
    switch (key) {
      case "priorityScore":
        diff = (a.priorityScore ?? 0) - (b.priorityScore ?? 0);
        break;
      case "companyName":
        diff = a.companyName.localeCompare(b.companyName, "ja");
        break;
      case "lastContact":
        diff = (a.lastContact ?? "").localeCompare(b.lastContact ?? "");
        break;
      case "communicationBlankDays":
        diff = (a.communicationBlankDays ?? -1) - (b.communicationBlankDays ?? -1);
        break;
      case "openSupportCount":
        diff = (a.openSupportCount ?? 0) - (b.openSupportCount ?? 0);
        break;
    }
    return dir === "asc" ? diff : -diff;
  });
  return sorted;
}

// ── メインコンポーネント ────────────────────────────────────────────────────────

export function CompanyList() {
  const [items, setItems]         = useState<CompanyListItemVM[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters]     = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey]     = useState<SortKey>("priorityScore");
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("desc");

  const load = useCallback((refresh = false) => {
    if (refresh) setRefreshing(true);
    setLoadError(null);
    fetch("/api/company-summary-list?limit=500&sort=priority_desc")
      .then(r => r.ok ? r.json() : r.json().then((e: { error?: string }) => Promise.reject(e.error ?? "取得エラー")))
      .then((data: { items: CompanyListItemVM[] }) => {
        setItems(data.items ?? []);
      })
      .catch((err: unknown) => {
        console.warn("[CompanyList] fetch failed:", err);
        setLoadError(String(err));
      })
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters(f => ({ ...f, [key]: value }));
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => k !== "search" && v !== "");

  const displayed = items
    ? applySort(applyFilters(items, filters), sortKey, sortDir)
    : null;

  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (items === null && !loadError) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <SidebarNav />
        <div className="flex-1 flex flex-col min-h-screen">
          <GlobalHeader />
          <main className="flex-1 p-6">
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <GlobalHeader />
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* ── ヘッダー ── */}
          <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Building className="w-5 h-5 text-slate-500" />
              <h1 className="text-base font-semibold text-slate-800">Company List</h1>
              {displayed !== null && (
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {displayed.length}{items && items.length !== displayed.length ? ` / ${items.length}` : ""} 社
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* 検索 */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  value={filters.search}
                  onChange={e => setFilter("search", e.target.value)}
                  placeholder="企業名で検索..."
                  className="pl-8 h-8 text-sm w-52"
                />
                {filters.search && (
                  <button
                    onClick={() => setFilter("search", "")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* フィルタ toggle */}
              <Button
                variant="outline"
                size="sm"
                className={`h-8 text-xs gap-1.5 ${hasActiveFilters ? "border-indigo-300 text-indigo-700 bg-indigo-50" : ""}`}
                onClick={() => setShowFilters(v => !v)}
              >
                <Filter className="w-3.5 h-3.5" />
                フィルタ
                {hasActiveFilters && (
                  <span className="bg-indigo-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                    {Object.values(filters).filter((v, i) => Object.keys(filters)[i] !== "search" && v !== "").length}
                  </span>
                )}
              </Button>

              {/* 更新 */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => load(true)}
                disabled={refreshing}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                更新
              </Button>
            </div>
          </div>

          {/* ── フィルタパネル ── */}
          {showFilters && (
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-3">
              {/* Freshness */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 whitespace-nowrap">鮮度</span>
                <Select value={filters.freshness || "__all__"} onValueChange={v => setFilter("freshness", v === "__all__" ? "" : v)}>
                  <SelectTrigger className="h-7 text-xs w-28">
                    <SelectValue placeholder="すべて" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">すべて</SelectItem>
                    <SelectItem value="missing">未生成</SelectItem>
                    <SelectItem value="stale">要更新</SelectItem>
                    <SelectItem value="fresh">最新</SelectItem>
                    <SelectItem value="locked">承認済</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Review */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 whitespace-nowrap">レビュー</span>
                <Select value={filters.review || "__all__"} onValueChange={v => setFilter("review", v === "__all__" ? "" : v)}>
                  <SelectTrigger className="h-7 text-xs w-28">
                    <SelectValue placeholder="すべて" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">すべて</SelectItem>
                    <SelectItem value="pending">未確認</SelectItem>
                    <SelectItem value="reviewed">確認済</SelectItem>
                    <SelectItem value="corrected">補正済</SelectItem>
                    <SelectItem value="approved">承認済</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Health */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 whitespace-nowrap">Health</span>
                <Select value={filters.health || "__all__"} onValueChange={v => setFilter("health", v === "__all__" ? "" : v)}>
                  <SelectTrigger className="h-7 text-xs w-32">
                    <SelectValue placeholder="すべて" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">すべて</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="at_risk">At Risk</SelectItem>
                    <SelectItem value="healthy">Healthy</SelectItem>
                    <SelectItem value="expanding">Expanding</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Phase gap */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 whitespace-nowrap">フェーズ差分</span>
                <Select value={filters.phaseGap || "__all__"} onValueChange={v => setFilter("phaseGap", v === "__all__" ? "" : v)}>
                  <SelectTrigger className="h-7 text-xs w-24">
                    <SelectValue placeholder="すべて" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">すべて</SelectItem>
                    <SelectItem value="yes">差分あり</SelectItem>
                    <SelectItem value="no">一致</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Communication blank */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 whitespace-nowrap">コミュニケーション</span>
                <Select value={filters.commBlank || "__all__"} onValueChange={v => setFilter("commBlank", v === "__all__" ? "" : v)}>
                  <SelectTrigger className="h-7 text-xs w-28">
                    <SelectValue placeholder="すべて" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">すべて</SelectItem>
                    <SelectItem value="warning">30日以上</SelectItem>
                    <SelectItem value="risk">60日以上</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Support critical */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 whitespace-nowrap">緊急サポート</span>
                <Select value={filters.supportCritical || "__all__"} onValueChange={v => setFilter("supportCritical", v === "__all__" ? "" : v)}>
                  <SelectTrigger className="h-7 text-xs w-24">
                    <SelectValue placeholder="すべて" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">すべて</SelectItem>
                    <SelectItem value="yes">Criticalあり</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* CS担当 */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 whitespace-nowrap">CS担当</span>
                <Select value={filters.csAssigned || "__all__"} onValueChange={v => setFilter("csAssigned", v === "__all__" ? "" : v)}>
                  <SelectTrigger className="h-7 text-xs w-24">
                    <SelectValue placeholder="すべて" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">すべて</SelectItem>
                    <SelectItem value="yes">担当あり</SelectItem>
                    <SelectItem value="no">担当なし</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-slate-500 gap-1"
                  onClick={resetFilters}
                >
                  <X className="w-3 h-3" />
                  リセット
                </Button>
              )}
            </div>
          )}

          {/* ── エラー ── */}
          {loadError && (
            <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {loadError}
              <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs" onClick={() => load()}>
                再試行
              </Button>
            </div>
          )}

          {/* ── テーブル ── */}
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 text-xs text-slate-500">
                  <SortableHead label="スコア" sortK="priorityScore" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="w-16 text-right pr-3" />
                  <SortableHead label="企業名" sortK="companyName"   currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="min-w-[160px]" />
                  <TableHead className="w-32 text-xs">Health</TableHead>
                  <TableHead className="w-36 text-xs">フェーズ</TableHead>
                  <TableHead className="w-28 text-xs">Summary</TableHead>
                  <SortableHead label="最終連絡" sortK="communicationBlankDays" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="w-24 text-xs" />
                  <SortableHead label="Support" sortK="openSupportCount" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="w-20 text-xs" />
                  <TableHead className="w-28 text-xs">Projects</TableHead>
                  <SortableHead label="担当" sortK="companyName" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="w-28 text-xs" />
                  <SortableHead label="最終接触" sortK="lastContact" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="w-24 text-xs" />
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed === null ? (
                  // ローディング skeleton rows
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 11 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : displayed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-16 text-sm text-slate-400">
                      条件に一致する企業がありません
                    </TableCell>
                  </TableRow>
                ) : (
                  displayed.map(item => (
                    <CompanyRow key={item.companyUid} item={item} />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

        </main>
      </div>
    </div>
  );
}

// ── 行コンポーネント ────────────────────────────────────────────────────────────

function CompanyRow({ item }: { item: CompanyListItemVM }) {
  const healthBadge = getHealthBadge(item.overallHealth);

  // フェーズ差分表示
  const hasGap = item.phaseGap;

  // プロジェクト表示
  const proj = item.projectSummary;

  return (
    <TableRow className="hover:bg-slate-50 cursor-pointer text-sm">
      {/* スコア */}
      <TableCell className="text-right pr-3">
        <PriorityScoreCell score={item.priorityScore ?? 0} breakdown={item.priorityBreakdown ?? []} />
      </TableCell>

      {/* 企業名 */}
      <TableCell>
        <Link
          href={`/companies/${item.companyUid}`}
          className="font-medium text-slate-800 hover:text-indigo-600 hover:underline"
        >
          {item.companyName}
        </Link>
      </TableCell>

      {/* Health */}
      <TableCell>
        <Badge variant="outline" className={`text-xs ${healthBadge.className}`}>
          {healthBadge.label}
        </Badge>
      </TableCell>

      {/* フェーズ */}
      <TableCell>
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.activePhaseLabel
            ? <span className="text-xs text-slate-700">{item.activePhaseLabel}</span>
            : <span className="text-slate-400 text-xs">—</span>
          }
          {item.activePhaseSource && (
            <PhaseSourceBadge source={item.activePhaseSource} />
          )}
          {hasGap && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  {item.phaseGapDescription ?? "フェーズ不整合あり"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {item.phaseStagnationDays !== null && item.phaseStagnationDays >= 90 && (
            <span className="text-[10px] text-red-500">{item.phaseStagnationDays}d停滞</span>
          )}
        </div>
      </TableCell>

      {/* Summary */}
      <TableCell>
        <div className="flex items-center gap-1 flex-wrap">
          <FreshnessBadge status={item.freshnessStatus} />
          <ReviewBadge status={item.humanReviewStatus} />
        </div>
      </TableCell>

      {/* 最終連絡（blank days） */}
      <TableCell>
        <CommBlankCell blankDays={item.communicationBlankDays} riskLevel={item.communicationRiskLevel} />
      </TableCell>

      {/* Support */}
      <TableCell>
        {item.openSupportCount > 0 ? (
          <div className="flex items-center gap-1">
            <Ticket className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs tabular-nums">{item.openSupportCount}</span>
            {item.criticalSupportCount > 0 && (
              <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1 rounded">
                !{item.criticalSupportCount}
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        )}
      </TableCell>

      {/* Projects */}
      <TableCell>
        {proj && proj.total > 0 ? (
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
            <span className="tabular-nums">{proj.active}</span>
            {proj.stalled > 0 && (
              <span className="text-amber-600 tabular-nums">/{proj.stalled}停</span>
            )}
            {proj.unused > 0 && (
              <span className="text-slate-400 tabular-nums">/{proj.unused}未</span>
            )}
          </div>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        )}
      </TableCell>

      {/* 担当 */}
      <TableCell>
        {item.owner ? (
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <User className="w-3 h-3 text-slate-400" />
            <span className="truncate max-w-[88px]" title={item.owner}>{item.owner}</span>
          </div>
        ) : (
          <span className="text-slate-400 text-xs">未設定</span>
        )}
      </TableCell>

      {/* 最終接触 */}
      <TableCell>
        {item.lastContact ? (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Calendar className="w-3 h-3 text-slate-400" />
            {item.lastContact.slice(0, 10)}
          </div>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        )}
      </TableCell>

      {/* 詳細リンク */}
      <TableCell>
        <Link
          href={`/companies/${item.companyUid}`}
          className="text-slate-400 hover:text-indigo-600"
          aria-label={`${item.companyName} の詳細`}
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
      </TableCell>
    </TableRow>
  );
}
