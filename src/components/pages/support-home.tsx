"use client";
import { useState, useEffect } from "react";
import { fetchSupportAlerts } from "@/lib/nocodb-client";
import type { AppSupportAlert } from "@/lib/nocodb-client";
import Link from "next/link";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building,
  Filter,
  RefreshCw,
  X,
  ChevronDown,
  Lightbulb,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  Flag,
  Trash2,
  AlertCircle,
  FileText,
  Play,
  Send,
  AlertTriangle,
} from "lucide-react";

// ── Mock data ────────────────────────────────────────────────────────────────

const ALERTS = [
  {
    id: "alert_1",
    createdAt: "2026-03-17 10:15",
    alertType: "Opportunity",
    priority: "High",
    title: "株式会社テクノロジーイノベーションがプラン上限に到達",
    summary: "Standard Plan（上限50名）で利用ユーザー数48名。追加メンバー招待の問い合わせあり",
    company: "株式会社テクノロジーイノベーション",
    companyId: "1",
    source: "Intercom",
    linkedCases: 1,
    cseTickets: 0,
    assigned: "Unassigned",
    owner: null,
    status: "Untriaged",
    suggestedAction: "アップグレード提案",
    evidence: {
      whyThisMatters: "現在Standard Plan（ユーザー数上限50名）を利用中。利用ユーザー数が48名に達しており、追加メンバーの招待について問い合わせがありました。Enterprise Planへのアップセル好機です。",
      log: {
        type: "intercom",
        timestamp: "2026-03-17 10:15",
        user: "田中太郎",
        company: "株式会社テクノロジーイノベーション",
        content: "新しいメンバーを追加したいのですが、「ユーザー数上限に近づいています」という警告が表示されました。現在の契約プランでユーザー数を増やすことはできますか？",
        channel: "Intercom",
      },
      suggestedActions: [
        { type: "content", label: "Enterprise Planの機能比較表を送付" },
        { type: "action", label: "プランアップグレード相談MTGを設定" },
        { type: "outbound", label: "特別価格の提案を準備" },
      ],
    },
  },
  {
    id: "alert_2",
    createdAt: "2026-03-17 09:45",
    alertType: "Opportunity",
    priority: "High",
    title: "グローバルソリューションズが高度な機能への興味を示している",
    summary: "Advanced Analytics機能について3回問い合わせ。導入事例を知りたいとのこと",
    company: "グローバルソリューションズ株式会社",
    companyId: "2",
    source: "Intercom",
    linkedCases: 3,
    cseTickets: 0,
    assigned: "CSM",
    owner: "山田太郎",
    status: "In Progress",
    suggestedAction: "機能デモMTG設定",
    evidence: {
      whyThisMatters: "現在Basic Planを利用中。Advanced Analytics機能について3回問い合わせがあり、導入企業の事例を知りたいとのこと。利用拡大のチャンスです。",
      log: {
        type: "intercom",
        timestamp: "2026-03-16 15:30",
        user: "山田花子",
        company: "グローバルソリューションズ株式会社",
        content: "Advanced Analytics機能について詳しく教えていただけますでしょうか。導入事例があれば知りたいです。",
        channel: "Intercom",
      },
      suggestedActions: [
        { type: "content", label: "Advanced Analytics導入事例送付" },
        { type: "action", label: "機能デモMTGを設定" },
        { type: "outbound", label: "アップグレード提案を準備" },
      ],
    },
  },
  {
    id: "alert_3",
    createdAt: "2026-03-17 08:30",
    alertType: "Risk",
    priority: "High",
    title: "クラウドインフラサービスのサポート件数が42%急増",
    summary: "先週比で18件増加。API連携とパフォーマンス関連の問い合わせ集中",
    company: "クラウドインフラサービス",
    companyId: "5",
    source: "System",
    linkedCases: 18,
    cseTickets: 2,
    assigned: "Support",
    owner: "佐藤花子",
    status: "In Progress",
    suggestedAction: "ヘルスチェックMTG設定",
    evidence: {
      whyThisMatters: "先週比で18件増加。API連携とパフォーマンス関連の問い合わせが集中しています。顧客満足度低下のリスクがあります。",
      log: {
        type: "intercom",
        timestamp: "2026-03-17 08:15",
        user: "高橋美咲",
        company: "クラウドインフラサービス",
        content: "API連携処理を実行すると、頻繁にタイムアウトエラーが発生します。特に大量データを扱う処理で顕著です。",
        channel: "Intercom",
      },
      suggestedActions: [
        { type: "action", label: "ヘルスチェックMTGを設定" },
        { type: "content", label: "API連携トラブルシューティングガイドを送付" },
        { type: "outbound", label: "状況説明と対応方針を共有" },
      ],
    },
  },
  {
    id: "alert_4",
    createdAt: "2026-03-17 07:15",
    alertType: "Content Suggestion",
    priority: "Medium",
    title: "「API連携トラブルシューティングガイド」Content作成を推奨",
    summary: "API連携関連の問い合わせが月間45件。詳細ガイドで初回応答時間短縮可能",
    company: null,
    companyId: null,
    source: "System (AI)",
    linkedCases: 45,
    cseTickets: 0,
    assigned: "Unassigned",
    owner: null,
    status: "Untriaged",
    suggestedAction: "Content作成",
    evidence: {
      whyThisMatters: "API連携関連の問い合わせが月間45件。詳細ガイドにより初回応答時間を大幅短縮できます",
      suggestedActions: [{ type: "content", label: "Content作成" }],
    },
  },
  {
    id: "alert_5",
    createdAt: "2026-03-16 22:30",
    alertType: "Waiting on CSE",
    priority: "High",
    title: "CSE-1234 データ同期エラーの調査が48時間超過",
    summary: "クラウドインフラサービスのCSE Ticket待機時間が52h。中間報告が必要",
    company: "クラウドインフラサービス",
    companyId: "5",
    source: "CSE Ticket",
    linkedCases: 1,
    cseTickets: 1,
    assigned: "CSM",
    owner: "鈴木一郎",
    status: "In Progress",
    suggestedAction: "中間報告送付",
    evidence: {
      whyThisMatters: "待機時間が長期化すると、顧客からのエスカレーション率が上昇します",
      suggestedActions: [
        { type: "outbound", label: "中間報告を送付" },
        { type: "escalation", label: "CSE進捗確認" },
      ],
    },
  },
  {
    id: "alert_6",
    createdAt: "2026-03-16 18:45",
    alertType: "Urgent",
    priority: "Critical",
    title: "高priority案件が8時間以上未対応",
    summary: "API連携タイムアウトエラーで本番環境の業務が停止中。至急対応必要",
    company: "株式会社テクノロジーイノベーション",
    companyId: "1",
    source: "Intercom",
    linkedCases: 1,
    cseTickets: 0,
    assigned: "Unassigned",
    owner: null,
    status: "Untriaged",
    suggestedAction: "即座に対応",
    evidence: {
      whyThisMatters: "過去の類似案件では、12時間超過すると顧客満足度が著しく低下します",
      suggestedActions: [
        { type: "action", label: "CSMにアサイン" },
        { type: "escalation", label: "緊急対応を開始" },
      ],
    },
  },
];

// ── 定数 ──────────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const ALERT_TYPES = ["Urgent", "Risk", "Opportunity", "Content Suggestion", "Waiting on CSE"] as const;
const PRIORITIES  = ["Critical", "High", "Medium", "Low"] as const;
const STATUSES    = ["Untriaged", "In Progress", "Resolved", "Dismissed"] as const;
const SOURCES     = ["Intercom", "Slack", "Chatwork", "CSE Ticket", "System", "System (AI)"] as const;

// ── Helper functions ──────────────────────────────────────────────────────────

function alertTypeBadge(t: string) {
  const map: Record<string, string> = {
    Urgent: "bg-red-100 border-red-300 text-red-700",
    Risk: "bg-orange-100 border-orange-300 text-orange-700",
    Opportunity: "bg-green-100 border-green-300 text-green-700",
    "Content Suggestion": "bg-purple-100 border-purple-300 text-purple-700",
    "Waiting on CSE": "bg-amber-100 border-amber-300 text-amber-700",
  };
  return map[t] ?? "bg-slate-100 border-slate-300 text-slate-700";
}

function priorityBadge(p: string) {
  const map: Record<string, string> = {
    Critical: "bg-red-700 text-white",
    High: "bg-orange-600 text-white",
    Medium: "bg-amber-500 text-white",
    Low: "bg-slate-400 text-white",
  };
  return map[p] ?? "bg-slate-400 text-white";
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    Untriaged: "bg-red-50 border-red-300 text-red-700",
    "In Progress": "bg-blue-50 border-blue-300 text-blue-700",
    Resolved: "bg-green-50 border-green-300 text-green-700",
    Dismissed: "bg-slate-50 border-slate-300 text-slate-500",
  };
  return map[s] ?? "bg-slate-50 border-slate-300 text-slate-700";
}

function suggestedActionIcon(type: string) {
  if (type === "content") return <FileText className="w-3 h-3 mr-1" />;
  if (type === "action") return <Play className="w-3 h-3 mr-1" />;
  if (type === "outbound") return <Send className="w-3 h-3 mr-1" />;
  return <AlertCircle className="w-3 h-3 mr-1" />;
}

// ── Slide-over panel ─────────────────────────────────────────────────────────

function AlertDetailPanel({
  alert,
  onClose,
}: {
  alert: LocalAlert | null;
  onClose: () => void;
}) {
  if (!alert) return null;
  const { evidence } = alert;

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-2xl border-l z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b flex items-start justify-between">
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge className={`text-xs border ${alertTypeBadge(alert.alertType)}`}>{alert.alertType}</Badge>
            <Badge className={`text-xs ${priorityBadge(alert.priority)}`}>{alert.priority}</Badge>
          </div>
          <h2 className="text-base font-semibold text-slate-900">{alert.title}</h2>
          <p className="text-sm text-slate-500 mt-1">{alert.createdAt}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="p-1">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-5">
        {/* Why This Matters */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2 text-amber-800 font-semibold text-sm">
            <Lightbulb className="w-4 h-4" />
            Why This Matters
          </div>
          <p className="text-sm text-amber-900">{evidence.whyThisMatters}</p>
        </div>

        {/* Log entry */}
        {"log" in evidence && evidence.log && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-800">Evidence Log</div>
            <div className="border rounded-lg p-4 bg-slate-50 space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-700">{(evidence.log as { user: string }).user}</span>
                <span>•</span>
                <span>{(evidence.log as { timestamp: string }).timestamp}</span>
                <span>•</span>
                <span>{(evidence.log as { channel: string }).channel}</span>
              </div>
              {alert.companyId && (
                <Link
                  href={`/companies/${alert.companyId}`}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Building className="w-3 h-3" />
                  {alert.company}
                </Link>
              )}
              <p className="text-sm text-slate-700">{(evidence.log as { content: string }).content}</p>
            </div>
          </div>
        )}

        {/* Suggested Actions */}
        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-800">Suggested Actions</div>
          <div className="space-y-2">
            {evidence.suggestedActions.map((act, idx) => (
              <Button key={idx} variant="outline" size="sm" className="w-full justify-start text-xs">
                {suggestedActionIcon(act.type)}
                {act.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t flex gap-2 flex-wrap">
        {alert.companyId && (
          <Link href={`/companies/${alert.companyId}`} className="flex-1 min-w-[120px]">
            <Button variant="outline" size="sm" className="w-full">
              <Building className="w-4 h-4 mr-2" />
              Company
            </Button>
          </Link>
        )}
        {alert.sourceId && (
          <Link href={`/support/${alert.sourceId}`} className="flex-1 min-w-[120px]">
            <Button variant="outline" size="sm" className="w-full">
              ケースを確認
            </Button>
          </Link>
        )}
        <Link href="/support/queue" className="flex-1 min-w-[120px]">
          <Button size="sm" className="w-full">Queue で確認</Button>
        </Link>
      </div>
    </div>
  );
}

// ── API → local shape の変換 ──────────────────────────────────────────────────

type LocalAlert = (typeof ALERTS)[0] & { sourceId?: string | null };

function apiAlertToLocal(a: AppSupportAlert): LocalAlert {
  const suggestedActions: { type: string; label: string }[] = [];
  if (a.suggestedAction && a.suggestedAction !== '—') {
    const actionType =
      a.alertType === 'Opportunity'        ? 'action'    :
      a.alertType === 'Content Suggestion' ? 'content'   :
      a.alertType === 'Waiting on CSE'     ? 'escalation':
      'action';
    suggestedActions.push({ type: actionType, label: a.suggestedAction });
  }

  return {
    id: a.id,
    createdAt: a.createdAt,
    alertType: a.alertType,
    priority: a.priority,
    title: a.title,
    summary: a.summary,
    company: a.companyName ?? null,
    companyId: a.companyUid ?? null,
    source: a.source,
    linkedCases: a.linkedCases,
    cseTickets: a.cseTickets,
    assigned: a.assignedTo,
    owner: a.ownerName ?? null,
    status: a.status,
    suggestedAction: a.suggestedAction,
    sourceId: a.sourceId ?? null,
    evidence: {
      whyThisMatters: a.whyThisMatters,
      suggestedActions,
    },
  };
}

// ── Main component ────────────────────────────────────────────────────────────

type SortKey = "createdAt" | "priority" | "alertType" | "status";
type SortDir = "asc" | "desc";

const QUICK_FILTERS = [
  { value: "all",         label: "All" },
  { value: "untriaged",   label: "Untriaged" },
  { value: "urgent",      label: "Urgent Only" },
  { value: "risk",        label: "Risk Only" },
  { value: "opportunity", label: "Opportunity Only" },
];

export function SupportHome() {
  const [apiAlerts, setApiAlerts]     = useState<LocalAlert[] | null>(null);
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [refreshing, setRefreshing]   = useState(false);
  const [quickFilter, setQuickFilter] = useState("all");
  const [sortKey, setSortKey]         = useState<SortKey>("priority");
  const [sortDir, setSortDir]         = useState<SortDir>("asc");
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [detailAlert, setDetailAlert] = useState<LocalAlert | null>(null);

  // ── 詳細フィルタ ──────────────────────────────────────────────────────────
  const [showFilters,     setShowFilters]     = useState(false);
  const [filterType,      setFilterType]      = useState("all");
  const [filterPriority,  setFilterPriority]  = useState("all");
  const [filterStatus,    setFilterStatus]    = useState("all");
  const [filterSource,    setFilterSource]    = useState("all");

  const activeFilterCount = [filterType, filterPriority, filterStatus, filterSource].filter(v => v !== "all").length;

  function resetFilters() {
    setQuickFilter("all");
    setFilterType("all");
    setFilterPriority("all");
    setFilterStatus("all");
    setFilterSource("all");
  }

  function loadAlerts() {
    setRefreshing(true);
    setLoadError(null);
    fetchSupportAlerts(100)
      .then(data => {
        if (data.length > 0) setApiAlerts(data.map(apiAlertToLocal));
      })
      .catch(err => {
        console.warn('[SupportHome] alerts fetch failed, using mock:', err);
        setLoadError('データ取得に失敗しました（mock表示中）');
      })
      .finally(() => setRefreshing(false));
  }

  useEffect(() => { loadAlerts(); }, []);

  const alerts = apiAlerts ?? ALERTS;

  // ── フィルタ適用 ──────────────────────────────────────────────────────────
  let filtered = alerts.filter((a) => {
    // Quick filter
    if (quickFilter === "untriaged"   && a.status    !== "Untriaged")  return false;
    if (quickFilter === "urgent"      && a.priority  !== "Critical")   return false;
    if (quickFilter === "risk"        && a.alertType !== "Risk")       return false;
    if (quickFilter === "opportunity" && a.alertType !== "Opportunity") return false;
    // Detail filters
    if (filterType     !== "all" && a.alertType !== filterType)     return false;
    if (filterPriority !== "all" && a.priority  !== filterPriority) return false;
    if (filterStatus   !== "all" && a.status    !== filterStatus)   return false;
    if (filterSource   !== "all" && a.source    !== filterSource)   return false;
    return true;
  });

  // ── ソート: primary = sortKey, secondary = createdAt desc ─────────────────
  filtered = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "createdAt") cmp = a.createdAt.localeCompare(b.createdAt);
    else if (sortKey === "priority") cmp = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    else if (sortKey === "alertType") cmp = a.alertType.localeCompare(b.alertType);
    else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
    if (cmp === 0 && sortKey !== "createdAt") {
      // secondary: 新しい順
      cmp = b.createdAt.localeCompare(a.createdAt);
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "priority" ? "asc" : "desc"); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 ml-1 inline text-slate-400" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 ml-1 inline text-slate-700" />
      : <ArrowDown className="w-3 h-3 ml-1 inline text-slate-700" />;
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((a: LocalAlert) => a.id)));
  }

  const allSelected = selected.size > 0 && selected.size === filtered.length;
  const isFiltered  = quickFilter !== "all" || activeFilterCount > 0;

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Support" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1800px] mx-auto p-6 space-y-5">

            {/* 読み込みエラーバナー */}
            {loadError && (
              <div className="flex items-center gap-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{loadError}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-amber-800 hover:bg-amber-100"
                  onClick={loadAlerts}
                >
                  再試行
                </Button>
              </div>
            )}

            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Support Home</h1>
                <p className="text-sm text-slate-500 mt-0.5">AI検出アラートを確認し、優先度の高い案件にアクションを取る</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(v => !v)}
                  className={showFilters || activeFilterCount > 0 ? "border-blue-300 text-blue-700 bg-blue-50" : ""}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                  {activeFilterCount > 0 && (
                    <span className="ml-1.5 bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showFilters ? "rotate-180" : ""}`} />
                </Button>
                <Button variant="outline" size="sm" onClick={loadAlerts} disabled={refreshing}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  更新
                </Button>
                <Link href="/support/queue">
                  <Button size="sm">Support Queue →</Button>
                </Link>
              </div>
            </div>

            {/* 詳細フィルタパネル */}
            {showFilters && (
              <div className="bg-white border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">詳細フィルタ</span>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={resetFilters}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      すべてリセット
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-48 h-8 text-xs">
                      <SelectValue placeholder="Alert Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Alert Types</SelectItem>
                      {ALERT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterPriority} onValueChange={setFilterPriority}>
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterSource} onValueChange={setFilterSource}>
                    <SelectTrigger className="w-44 h-8 text-xs">
                      <SelectValue placeholder="Source Queue" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Quick filters */}
            <div className="flex items-center gap-2">
              {QUICK_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setQuickFilter(f.value)}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors border ${
                    quickFilter === f.value
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <span className="text-xs text-slate-400 ml-2">
                {filtered.length}件
                {isFiltered && alerts.length !== filtered.length && (
                  <span className="ml-1 text-slate-300">/ {alerts.length}件中</span>
                )}
              </span>
              {isFiltered && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-0.5"
                >
                  <X className="w-3 h-3" />
                  リセット
                </button>
              )}
            </div>

            {/* Bulk actions */}
            {selected.size > 0 && (
              <div className="flex items-center gap-3 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">
                <span>{selected.size}件選択中</span>
                <div className="h-4 w-px bg-slate-600" />
                <Button variant="ghost" size="sm" className="text-white hover:bg-slate-700 h-7 text-xs">
                  <Flag className="w-3 h-3 mr-1" />
                  In Progress に変更
                </Button>
                <Button variant="ghost" size="sm" className="text-white hover:bg-slate-700 h-7 text-xs">
                  <Trash2 className="w-3 h-3 mr-1" />
                  Dismiss
                </Button>
                <button className="ml-auto text-slate-400 hover:text-white" onClick={() => setSelected(new Set())}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Table */}
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="w-10 px-3 py-3 text-left">
                      <button onClick={selectAll} className="text-slate-400 hover:text-slate-700">
                        {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 cursor-pointer" onClick={() => toggleSort("createdAt")}>
                      Created At <SortIcon k="createdAt" />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 cursor-pointer" onClick={() => toggleSort("alertType")}>
                      Alert Type <SortIcon k="alertType" />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 cursor-pointer" onClick={() => toggleSort("priority")}>
                      Priority <SortIcon k="priority" />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600">Title / Summary</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600">Company</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600">Source</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600">Cases</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600">Assigned</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 cursor-pointer" onClick={() => toggleSort("status")}>
                      Status <SortIcon k="status" />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600">Suggested</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                          <Filter className="w-10 h-10 text-slate-200" />
                          <div>
                            <p className="font-medium text-slate-600">
                              {isFiltered ? "条件に一致するアラートがありません" : "アラートがありません"}
                            </p>
                            <p className="text-xs mt-1">
                              {isFiltered
                                ? "フィルタ条件を変更するか、リセットしてください"
                                : "AI アラートが生成されると、ここに表示されます"
                              }
                            </p>
                          </div>
                          {isFiltered && (
                            <button
                              onClick={resetFilters}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              フィルタをリセット
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((alert) => (
                      <tr
                        key={alert.id}
                        className={`hover:bg-slate-50 transition-colors ${selected.has(alert.id) ? "bg-blue-50" : ""}`}
                      >
                        <td className="px-3 py-3">
                          <button onClick={() => toggleSelect(alert.id)} className="text-slate-400 hover:text-slate-700">
                            {selected.has(alert.id) ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{alert.createdAt}</td>
                        <td className="px-3 py-3">
                          <Badge className={`text-xs border ${alertTypeBadge(alert.alertType)}`}>{alert.alertType}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          <Badge className={`text-xs ${priorityBadge(alert.priority)}`}>{alert.priority}</Badge>
                        </td>
                        <td className="px-3 py-3 max-w-[280px]">
                          <button
                            onClick={() => setDetailAlert(alert)}
                            className="font-medium text-slate-900 hover:text-blue-600 text-left"
                          >
                            {alert.title}
                          </button>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{alert.summary}</p>
                        </td>
                        <td className="px-3 py-3">
                          {alert.companyId ? (
                            <Link
                              href={`/companies/${alert.companyId}`}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                              <Building className="w-3 h-3 flex-shrink-0" />
                              <span className="max-w-[120px] truncate">{alert.company}</span>
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className="text-xs">{alert.source}</Badge>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">{alert.linkedCases}</td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          {alert.owner ?? <span className="text-slate-400">Unassigned</span>}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className={`text-xs border ${statusBadge(alert.status)}`}>
                            {alert.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 max-w-[160px]">
                          <span className="text-xs text-slate-600">{alert.suggestedAction}</span>
                        </td>
                        <td className="px-3 py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setDetailAlert(alert)}
                          >
                            詳細
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {filtered.length > 0 && (
                <div className="px-4 py-3 border-t text-sm text-slate-500 text-center">
                  {filtered.length}件を表示中
                  {isFiltered && alerts.length !== filtered.length && (
                    <span className="ml-1 text-slate-400">（全{alerts.length}件中）</span>
                  )}
                </div>
              )}
            </div>

          </div>
        </main>
      </div>

      {/* Slide-over detail */}
      {detailAlert && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setDetailAlert(null)}
          />
          <AlertDetailPanel alert={detailAlert} onClose={() => setDetailAlert(null)} />
        </>
      )}
    </div>
  );
}
