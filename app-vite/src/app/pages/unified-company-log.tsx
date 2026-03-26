import React, { useState, useEffect } from "react";
import { useParams } from "react-router";
import { fetchCompanyByUid, fetchLogEntries } from "../../services/nocodb";
import type { AppCompany, AppLogEntry } from "../../services/nocodb";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import {
  Building,
  Users,
  User,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Mail,
  MessageSquare,
  Calendar,
  Headphones,
  Activity,
  Database,
  Sparkles,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  ChevronRight,
  Eye,
  UserPlus,
  FolderPlus,
  Plus,
  Zap,
  ArrowUpRight,
  Circle,
  AlertTriangle,
  Award,
  MinusCircle,
  Send,
  Reply
} from "lucide-react";
import { LogActionPanels } from "../components/unified-log/log-action-panels";
import { Link } from "react-router";

type LogStatus = "unprocessed" | "extracted" | "reviewed" | "linked" | "unresolved" | "synced" | "ignored";
type LogSourceType = "slack" | "email" | "meeting_minutes" | "support_ticket" | "product_usage" | "crm_note" | "ai_extracted" | "chatwork" | "intercom";
type ViewMode = "timeline" | "list";

// モックデータ
const companyData = {
  id: "comp-123",
  name: "株式会社テクノロジーイノベーション",
  relatedProjects: ["新規導入プロジェクト", "拡張検討案件"],
  phaseLabel: "5.Growth",
  phaseSource: "CRM Sync",
  accountOwner: "佐藤 太郎",
  lastTouchpoint: "2026-03-11 14:30",
  openAlerts: 2,
  openActions: 5,
  unresolvedEvidenceCount: 3,
  healthScore: 72,
  healthTrend: "down",
};

const mockLogs = [
  {
    id: "log-1",
    timestamp: "2026-03-11 14:30",
    date: "2026-03-11",
    title: "決裁者が3回連続で定例MTGを欠席",
    summary: "山田CTO（決裁者）が過去3回の定例MTGすべてを欠席。プロジェクト進行に影響の可能性。",
    sourceType: "meeting_minutes" as LogSourceType,
    channel: "Zoom Meeting",
    messageType: "risk_signal",
    ownerRole: "CSM",
    linkedProject: "新規導入プロジェクト",
    linkedPeople: ["山田 太郎（CTO）"],
    status: "reviewed" as LogStatus,
    resolverResult: "action_proposed",
    evidenceBadge: true,
    riskBadge: true,
    scope: "Company",
    hasOriginalLink: true,
    confidence: 0.92,
  },
  {
    id: "log-2",
    timestamp: "2026-03-11 11:20",
    date: "2026-03-11",
    title: "製品利用率が前週比25%低下",
    summary: "アクティブユーザー数が前週比25%減。特定機能の利用が停止している可能性。",
    sourceType: "product_usage" as LogSourceType,
    channel: "Product Analytics",
    messageType: "health_signal",
    ownerRole: "Product",
    linkedProject: null,
    linkedPeople: [],
    status: "extracted" as LogStatus,
    resolverResult: "unresolved",
    evidenceBadge: true,
    riskBadge: true,
    scope: "Company",
    hasOriginalLink: true,
    confidence: 0.88,
    missingFields: ["linked_people", "linked_project"],
  },
  {
    id: "log-3",
    timestamp: "2026-03-10 16:45",
    date: "2026-03-10",
    title: "サポートチケット：ログイン問題のエスカレーション",
    summary: "複数ユーザーからログイン不可の報告。Priority: High。技術チームにエスカレーション済み。",
    sourceType: "support_ticket" as LogSourceType,
    channel: "Zendesk #4782",
    messageType: "support_request",
    ownerRole: "Support",
    linkedProject: null,
    linkedPeople: ["田中 花子（担当者）"],
    status: "linked" as LogStatus,
    resolverResult: "resolved",
    evidenceBadge: false,
    riskBadge: false,
    scope: "User",
    hasOriginalLink: true,
    confidence: null,
  },
  {
    id: "log-4",
    timestamp: "2026-03-10 10:15",
    date: "2026-03-10",
    title: "Slackで追加ライセンスの問い合わせ",
    summary: "マーケティング部長から「営業部の成功事例を見て、マーケ部でも導入したい」との発言。",
    sourceType: "slack" as LogSourceType,
    channel: "#customer-techinn",
    messageType: "opportunity_signal",
    ownerRole: "CSM",
    linkedProject: null,
    linkedPeople: ["鈴木 次郎（マーケ部長）"],
    status: "reviewed" as LogStatus,
    resolverResult: "action_proposed",
    evidenceBadge: true,
    opportunityBadge: true,
    scope: "Company",
    hasOriginalLink: true,
    confidence: 0.85,
    missingFields: ["linked_project"],
  },
  {
    id: "log-5",
    timestamp: "2026-03-09 15:00",
    date: "2026-03-09",
    title: "QBR定例MTG議事録",
    summary: "Q1レビュー実施。Health Score: 72、前四半期比-8。課題：一部機能の利用率低下。",
    sourceType: "meeting_minutes" as LogSourceType,
    channel: "Google Meet",
    messageType: "status_update",
    ownerRole: "CSM",
    linkedProject: "新規導入プロジェクト",
    linkedPeople: ["山田 太郎（CTO）", "田中 花子（担当者）"],
    status: "linked" as LogStatus,
    resolverResult: "resolved",
    evidenceBadge: true,
    riskBadge: false,
    scope: "Company",
    hasOriginalLink: true,
    confidence: null,
  },
  {
    id: "log-6",
    timestamp: "2026-03-09 09:30",
    date: "2026-03-09",
    title: "CRM Note: 契約更新120日前",
    summary: "契約更新まで120日。更新プロセス開始のタイミング。現状Health Score考慮要。",
    sourceType: "crm_note" as LogSourceType,
    channel: "Salesforce",
    messageType: "business_event",
    ownerRole: "Sales",
    linkedProject: null,
    linkedPeople: [],
    status: "synced" as LogStatus,
    resolverResult: "resolved",
    evidenceBadge: false,
    riskBadge: false,
    scope: "Company",
    hasOriginalLink: true,
    confidence: null,
  },
  {
    id: "log-7",
    timestamp: "2026-03-08 14:20",
    date: "2026-03-08",
    title: "メール：機能改善要望",
    summary: "担当者から「ダッシュボードのカスタマイズ機能が欲しい」との要望。",
    sourceType: "email" as LogSourceType,
    channel: "customer-support@example.com",
    messageType: "feature_request",
    ownerRole: "CSM",
    linkedProject: null,
    linkedPeople: ["田中 花子（担当者）"],
    status: "unprocessed" as LogStatus,
    resolverResult: null,
    evidenceBadge: false,
    riskBadge: false,
    scope: "User",
    hasOriginalLink: true,
    confidence: null,
  },
  {
    id: "log-8",
    timestamp: "2026-03-07 11:00",
    date: "2026-03-07",
    title: "AI抽出：リスク検知 - 決裁者不在パターン",
    summary: "過去3週間の議事録を分析。決裁者の連続欠席パターンを検出。過去の類似ケースでは契約リスクに繋がる傾向。",
    sourceType: "ai_extracted" as LogSourceType,
    channel: "AI Analysis Engine",
    messageType: "ai_insight",
    ownerRole: "System",
    linkedProject: "新規導入プロジェクト",
    linkedPeople: ["山田 太郎（CTO）"],
    status: "extracted" as LogStatus,
    resolverResult: "action_proposed",
    evidenceBadge: true,
    riskBadge: true,
    scope: "Company",
    hasOriginalLink: false,
    confidence: 0.78,
  },
  {
    id: "log-9",
    timestamp: "2026-03-06 16:30",
    date: "2026-03-06",
    title: "Intercom：トレーニング資料の問い合わせ",
    summary: "新規メンバー向けのオンボーディング資料の提供依頼。",
    sourceType: "intercom" as LogSourceType,
    channel: "Intercom Chat",
    messageType: "support_request",
    ownerRole: "Support",
    linkedProject: null,
    linkedPeople: [],
    status: "unprocessed" as LogStatus,
    resolverResult: "unresolved",
    evidenceBadge: false,
    riskBadge: false,
    scope: "Company",
    hasOriginalLink: true,
    confidence: null,
    missingFields: ["linked_people"],
  },
  {
    id: "log-10",
    timestamp: "2026-03-05 13:45",
    date: "2026-03-05",
    title: "製品利用：新機能の初回利用",
    summary: "ダッシュボードv2機能を5名のユーザーが初めて利用。",
    sourceType: "product_usage" as LogSourceType,
    channel: "Product Analytics",
    messageType: "usage_event",
    ownerRole: "Product",
    linkedProject: null,
    linkedPeople: [],
    status: "ignored" as LogStatus,
    resolverResult: null,
    evidenceBadge: false,
    riskBadge: false,
    scope: "Company",
    hasOriginalLink: true,
    confidence: null,
  },
];

const sourceTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  // モックデータ用キー
  slack: { label: "Slack", icon: MessageSquare, color: "bg-purple-100 text-purple-800" },
  email: { label: "Email", icon: Mail, color: "bg-blue-100 text-blue-800" },
  meeting_minutes: { label: "Meeting Minutes", icon: Calendar, color: "bg-green-100 text-green-800" },
  support_ticket: { label: "Support Ticket", icon: Headphones, color: "bg-orange-100 text-orange-800" },
  product_usage: { label: "Product Usage", icon: Activity, color: "bg-indigo-100 text-indigo-800" },
  crm_note: { label: "CRM Note", icon: Database, color: "bg-slate-100 text-slate-800" },
  ai_extracted: { label: "AI Extracted", icon: Sparkles, color: "bg-purple-100 text-purple-900" },
  chatwork: { label: "Chatwork", icon: MessageSquare, color: "bg-teal-100 text-teal-800" },
  intercom: { label: "Intercom", icon: MessageSquare, color: "bg-blue-100 text-blue-900" },
  // API (AppLogEntry.sourceType) 用キー
  minutes: { label: "Meeting Minutes", icon: Calendar, color: "bg-green-100 text-green-800" },
  mail:    { label: "Mail / Chat", icon: Mail, color: "bg-blue-100 text-blue-800" },
  support: { label: "Support", icon: Headphones, color: "bg-orange-100 text-orange-800" },
  inquiry: { label: "Inquiry", icon: MessageSquare, color: "bg-blue-100 text-blue-800" },
  ticket:  { label: "Ticket", icon: Headphones, color: "bg-orange-100 text-orange-800" },
  log:     { label: "Log / CRM", icon: Database, color: "bg-slate-100 text-slate-800" },
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  unprocessed:       { label: "未処理",   color: "bg-amber-100 text-amber-800",   icon: Clock },
  extracted:         { label: "AI抽出済", color: "bg-purple-100 text-purple-800", icon: Sparkles },
  reviewed:          { label: "レビュー済",color: "bg-blue-100 text-blue-800",    icon: Eye },
  proposal_generated:{ label: "提案生成済",color: "bg-blue-100 text-blue-800",   icon: Eye },
  linked:            { label: "紐付け済", color: "bg-emerald-100 text-emerald-800",icon: LinkIcon },
  unresolved:        { label: "未解決",   color: "bg-red-100 text-red-800",       icon: AlertCircle },
  confirmed:         { label: "確定済",   color: "bg-emerald-100 text-emerald-800",icon: CheckCircle2 },
  synced:            { label: "同期済",   color: "bg-slate-100 text-slate-700",   icon: CheckCircle2 },
  ignored:           { label: "除外",     color: "bg-slate-100 text-slate-500",   icon: MinusCircle },
};

export function UnifiedCompanyLog() {
  const { companyId } = useParams<{ companyId: string }>();

  // ─── NocoDB データ取得 ───────────────────────────────────────────────────
  const [apiCompany,  setApiCompany]  = useState<AppCompany    | null>(null);
  const [apiLogs,     setApiLogs]     = useState<AppLogEntry[] | null>(null);
  const [loadError,   setLoadError]   = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;

    fetchCompanyByUid(companyId)
      .then(c => { if (c) setApiCompany(c); })
      .catch(e => {
        console.warn('[UnifiedLog] company fetch failed:', e);
        setLoadError('会社情報の取得に失敗しました（mock表示中）');
      });

    fetchLogEntries(companyId)
      .then(setApiLogs)
      .catch(e => {
        console.warn('[UnifiedLog] logs fetch failed:', e);
      });
  }, [companyId]);

  // API データがあればそちら、なければ mock にフォールバック
  const displayCompany = apiCompany
    ? { ...companyData, name: apiCompany.name, phaseLabel: apiCompany.phaseLabel,
        accountOwner: apiCompany.owner, lastTouchpoint: apiCompany.lastContact,
        openAlerts: apiCompany.openAlerts, openActions: apiCompany.openActions }
    : companyData;
  const logs = apiLogs ?? mockLogs;

  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSourceType, setFilterSourceType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [savedView, setSavedView] = useState("all");
  
  // Panel states for different CTAs
  const [showOriginalPanel, setShowOriginalPanel] = useState(false);
  const [showAIExtractionPanel, setShowAIExtractionPanel] = useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [showPeopleLinkPanel, setShowPeopleLinkPanel] = useState(false);
  const [showProjectLinkPanel, setShowProjectLinkPanel] = useState(false);
  const [showActionCreatePanel, setShowActionCreatePanel] = useState(false);
  const [showRelatedAlertsPanel, setShowRelatedAlertsPanel] = useState(false);
  const [showRelatedActionsPanel, setShowRelatedActionsPanel] = useState(false);
  const [showResolverDetailPanel, setShowResolverDetailPanel] = useState(false);

  const selectedLogData = logs.find(log => log.id === selectedLog);

  // グループ化
  const groupedLogs = logs.reduce((acc, log) => {
    if (!acc[log.date]) {
      acc[log.date] = [];
    }
    acc[log.date].push(log);
    return acc;
  }, {} as Record<string, typeof logs>);

  const filteredLogs = logs.filter(log => {
    if (searchQuery && !log.title.toLowerCase().includes(searchQuery.toLowerCase()) && !log.summary.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterSourceType !== "all" && log.sourceType !== filterSourceType) return false;
    if (filterStatus !== "all" && log.status !== filterStatus) return false;
    
    // Saved views
    if (savedView === "unprocessed" && log.status !== "unprocessed") return false;
    if (savedView === "review_needed" && log.status !== "extracted" && log.status !== "unprocessed") return false;
    if (savedView === "external" && !log.hasOriginalLink) return false;
    if (savedView === "support" && log.sourceType !== "support_ticket" && log.sourceType !== "intercom") return false;
    if (savedView === "csm" && log.ownerRole !== "CSM") return false;
    
    return true;
  });

  const handleLogClick = (id: string) => {
    setSelectedLog(id);
    setIsDrawerOpen(true);
  };

  const unresolvedCount = logs.filter(log => log.status === "unresolved" || log.resolverResult === "unresolved").length;
  const unprocessedCount = logs.filter(log => log.status === "unprocessed").length;

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Company" />
        
        {/* API エラー時バナー */}
        {loadError && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-1 text-xs text-amber-800">
            ⚠ {loadError}
          </div>
        )}
        {/* Company Summary Header */}
        <div className="bg-white border-b">
          <div className="px-4 py-3">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-lg font-semibold text-slate-900">{displayCompany.name}</h1>
                  <Badge className="bg-blue-500 text-xs">{displayCompany.phaseLabel}</Badge>
                  {displayCompany.healthTrend === "down" && (
                    <div className="flex items-center gap-1 text-orange-700">
                      <TrendingDown className="w-4 h-4" />
                      <span className="text-xs font-medium">Health Score {displayCompany.healthScore}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span>Owner: {displayCompany.accountOwner}</span>
                  <span>•</span>
                  <span>最終接点: {displayCompany.lastTouchpoint}</span>
                  <span>•</span>
                  <span>関連案件: {displayCompany.relatedProjects.join(", ")}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/companies/${companyId}`}>
                  <Button variant="outline" size="sm" className="text-xs h-7">
                    <Eye className="w-3 h-3 mr-1" />
                    Company詳細
                  </Button>
                </Link>
              </div>
            </div>

            {/* Alert Summary Bar */}
            <div className="grid grid-cols-5 gap-3">
              <div className="bg-red-50 border border-red-200 rounded px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-700" />
                    <span className="text-xs font-semibold text-red-900">Open Alerts</span>
                  </div>
                  <span className="text-lg font-bold text-red-700">{displayCompany.openAlerts}</span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-700" />
                    <span className="text-xs font-semibold text-blue-900">Open Actions</span>
                  </div>
                  <span className="text-lg font-bold text-blue-700">{displayCompany.openActions}</span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-semibold text-amber-900">未解決Evidence</span>
                  </div>
                  <span className="text-lg font-bold text-amber-700">{unresolvedCount}</span>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-700" />
                    <span className="text-xs font-semibold text-orange-900">未処理</span>
                  </div>
                  <span className="text-lg font-bold text-orange-700">{unprocessedCount}</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-700" />
                    <span className="text-xs font-semibold text-slate-900">全ログ数</span>
                  </div>
                  <span className="text-lg font-bold text-slate-700">{logs.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-hidden flex">
          {/* Left: Filter / Saved Views */}
          <aside className="w-64 border-r bg-white flex flex-col">
            <div className="p-3 border-b">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Saved Views</h2>
              <div className="space-y-1">
                {[
                  { id: "all", label: "全ログ", icon: FileText },
                  { id: "unprocessed", label: "未処理のみ", icon: Clock, badge: unprocessedCount },
                  { id: "review_needed", label: "要レビューのみ", icon: Eye },
                  { id: "external", label: "外部送信関連", icon: ExternalLink },
                  { id: "support", label: "Support関連", icon: Headphones },
                  { id: "csm", label: "CSM関連", icon: Users },
                ].map((view) => {
                  const Icon = view.icon;
                  return (
                    <button
                      key={view.id}
                      onClick={() => setSavedView(view.id)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${
                        savedView === view.id
                          ? "bg-blue-50 text-blue-900 font-medium"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5" />
                        <span>{view.label}</span>
                      </div>
                      {view.badge !== undefined && view.badge > 0 && (
                        <Badge className="bg-orange-500 text-xs h-4 px-1">{view.badge}</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 border-b">
              <h3 className="text-xs font-semibold text-slate-900 mb-2">Filter</h3>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <Input
                    placeholder="検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-7 h-7 text-xs"
                  />
                </div>

                <Select value={filterSourceType} onValueChange={setFilterSourceType}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Source Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべてのSource</SelectItem>
                    <SelectItem value="slack">Slack</SelectItem>
                    <SelectItem value="chatwork">Chatwork</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="intercom">Intercom</SelectItem>
                    <SelectItem value="meeting_minutes">Meeting Minutes</SelectItem>
                    <SelectItem value="support_ticket">Support Ticket</SelectItem>
                    <SelectItem value="product_usage">Product Usage</SelectItem>
                    <SelectItem value="crm_note">CRM Note</SelectItem>
                    <SelectItem value="ai_extracted">AI Extracted</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべてのStatus</SelectItem>
                    <SelectItem value="unprocessed">未処理</SelectItem>
                    <SelectItem value="extracted">AI抽出済</SelectItem>
                    <SelectItem value="reviewed">レビュー済</SelectItem>
                    <SelectItem value="linked">紐付け済</SelectItem>
                    <SelectItem value="unresolved">未解決</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex-1 p-3">
              <h3 className="text-xs font-semibold text-slate-900 mb-2">Scope</h3>
              <div className="space-y-1">
                {[
                  { label: "Company全体", icon: Building },
                  { label: "Project単位", icon: Users },
                  { label: "User単位", icon: User },
                ].map((scope, idx) => {
                  const Icon = scope.icon;
                  return (
                    <div key={idx} className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700">
                      <Icon className="w-3.5 h-3.5" />
                      <span>{scope.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Center: Timeline / Log List */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Evidence Timeline</h2>
                <Badge variant="outline" className="text-xs">{filteredLogs.length}件</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "timeline" ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => setViewMode("timeline")}
                >
                  Timeline
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => setViewMode("list")}
                >
                  List
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4">
                {viewMode === "timeline" ? (
                  <div className="space-y-6">
                    {Object.entries(groupedLogs)
                      .sort(([a], [b]) => b.localeCompare(a))
                      .map(([date, logs]) => (
                        <div key={date}>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="text-sm font-semibold text-slate-900">{date}</div>
                            <div className="flex-1 border-t border-slate-200"></div>
                            <Badge variant="outline" className="text-xs">{logs.length}件</Badge>
                          </div>
                          <div className="space-y-2 ml-4">
                            {logs.map((log) => {
                              const sourceConfig = sourceTypeConfig[log.sourceType] ?? sourceTypeConfig['log'];
                              const SourceIcon = sourceConfig.icon;
                              const statusCfg = statusConfig[log.status] ?? statusConfig['unprocessed'];
                              const StatusIcon = statusCfg.icon;

                              return (
                                <div
                                  key={log.id}
                                  onClick={() => handleLogClick(log.id)}
                                  className="border rounded-lg p-3 bg-white hover:shadow-md transition-shadow cursor-pointer"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="mt-0.5">
                                      <div className={`w-8 h-8 rounded flex items-center justify-center ${sourceConfig.color}`}>
                                        <SourceIcon className="w-4 h-4" />
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs text-slate-500">{log.timestamp.split(' ')[1]}</span>
                                        <Badge variant="outline" className={`text-xs ${sourceConfig.color}`}>
                                          {sourceConfig.label}
                                        </Badge>
                                        <Badge variant="outline" className={`text-xs ${statusCfg.color}`}>
                                          <StatusIcon className="w-2.5 h-2.5 mr-0.5" />
                                          {statusCfg.label}
                                        </Badge>
                                        {log.riskBadge && (
                                          <Badge className="bg-red-500 text-xs h-4 px-1">
                                            <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                                            Risk
                                          </Badge>
                                        )}
                                        {log.opportunityBadge && (
                                          <Badge className="bg-green-500 text-xs h-4 px-1">
                                            <Award className="w-2.5 h-2.5 mr-0.5" />
                                            Opportunity
                                          </Badge>
                                        )}
                                        {log.evidenceBadge && (
                                          <Badge variant="outline" className="bg-purple-50 text-purple-800 text-xs h-4 px-1">
                                            Evidence
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="font-medium text-sm text-slate-900 mb-1">{log.title}</div>
                                      <div className="text-xs text-slate-600 mb-2 line-clamp-2">{log.summary}</div>
                                      <div className="flex items-center gap-3 text-xs text-slate-500">
                                        {log.linkedProject && (
                                          <div className="flex items-center gap-1">
                                            <Users className="w-3 h-3" />
                                            <span>{log.linkedProject}</span>
                                          </div>
                                        )}
                                        {log.linkedPeople.length > 0 && (
                                          <div className="flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            <span>{log.linkedPeople.length}名</span>
                                          </div>
                                        )}
                                        {log.missingFields && log.missingFields.length > 0 && (
                                          <Badge className="bg-amber-500 text-xs h-4 px-1">
                                            <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                            Missing fields
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredLogs.map((log) => {
                      const sourceConfig = sourceTypeConfig[log.sourceType] ?? sourceTypeConfig['log'];
                      const SourceIcon = sourceConfig.icon;
                      const statusCfg = statusConfig[log.status] ?? statusConfig['unprocessed'];

                      return (
                        <div
                          key={log.id}
                          onClick={() => handleLogClick(log.id)}
                          className="border-b p-3 bg-white hover:bg-slate-50 cursor-pointer flex items-center gap-3"
                        >
                          <div className={`w-6 h-6 rounded flex items-center justify-center ${sourceConfig.color} flex-shrink-0`}>
                            <SourceIcon className="w-3.5 h-3.5" />
                          </div>
                          <div className="text-xs text-slate-500 w-20 flex-shrink-0">{log.timestamp.split(' ')[1]}</div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-slate-900">{log.title}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Badge variant="outline" className={`text-xs ${statusCfg.color}`}>{statusCfg.label}</Badge>
                            {log.riskBadge && <Badge className="bg-red-500 text-xs h-4 px-1">Risk</Badge>}
                            {log.opportunityBadge && <Badge className="bg-green-500 text-xs h-4 px-1">Opportunity</Badge>}
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </main>
      </div>

      {/* Right: Detail Panel */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] p-0">
          {selectedLogData && (
            <>
              <SheetHeader className="p-4 border-b">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <SheetTitle className="text-base">{selectedLogData.title}</SheetTitle>
                    <SheetDescription className="text-xs mt-1">
                      {selectedLogData.timestamp} • {(sourceTypeConfig[selectedLogData.sourceType] ?? sourceTypeConfig['log']).label}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <ScrollArea className="h-[calc(100vh-80px)]">
                <div className="p-4 space-y-4">
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={`text-xs ${(statusConfig[selectedLogData.status] ?? statusConfig['unprocessed']).color}`}>
                      {(statusConfig[selectedLogData.status] ?? statusConfig['unprocessed']).label}
                    </Badge>
                    {selectedLogData.riskBadge && (
                      <Badge className="bg-red-500 text-xs">
                        <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                        Risk Signal
                      </Badge>
                    )}
                    {selectedLogData.opportunityBadge && (
                      <Badge className="bg-green-500 text-xs">
                        <Award className="w-2.5 h-2.5 mr-0.5" />
                        Opportunity
                      </Badge>
                    )}
                    {selectedLogData.evidenceBadge && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-800 text-xs">
                        Evidence
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      Scope: {selectedLogData.scope}
                    </Badge>
                  </div>

                  <Separator />

                  {/* Summary */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">概要</h3>
                    <div className="bg-slate-50 border rounded p-3">
                      <p className="text-sm text-slate-900 leading-relaxed">{selectedLogData.summary}</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Metadata */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">メタデータ</h3>
                    <div className="border rounded">
                      <table className="w-full text-xs">
                        <tbody>
                          <tr className="border-b">
                            <td className="p-2 bg-slate-50 font-semibold w-[120px]">Source Type</td>
                            <td className="p-2">{(sourceTypeConfig[selectedLogData.sourceType] ?? sourceTypeConfig['log']).label}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 bg-slate-50 font-semibold">Channel</td>
                            <td className="p-2">{selectedLogData.channel}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 bg-slate-50 font-semibold">Message Type</td>
                            <td className="p-2">{selectedLogData.messageType}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 bg-slate-50 font-semibold">Owner Role</td>
                            <td className="p-2">{selectedLogData.ownerRole}</td>
                          </tr>
                          {selectedLogData.confidence !== null && (
                            <tr className="border-b">
                              <td className="p-2 bg-slate-50 font-semibold">Confidence</td>
                              <td className="p-2">{(selectedLogData.confidence * 100).toFixed(0)}%</td>
                            </tr>
                          )}
                          <tr>
                            <td className="p-2 bg-slate-50 font-semibold">Resolver Result</td>
                            <td className="p-2">
                              {selectedLogData.resolverResult ? (
                                <Badge variant="outline" className="text-xs">
                                  {selectedLogData.resolverResult}
                                </Badge>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <Separator />

                  {/* Linkage Status */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">紐付け状況</h3>
                    <div className="space-y-2">
                      <div className="border rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-600" />
                            <span className="text-xs font-semibold text-slate-900">Project</span>
                          </div>
                          {selectedLogData.linkedProject ? (
                            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-800">
                              {selectedLogData.linkedProject}
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500 text-xs">未紐付け</Badge>
                          )}
                        </div>
                        {!selectedLogData.linkedProject && (
                          <Button variant="outline" size="sm" className="w-full text-xs">
                            <FolderPlus className="w-3 h-3 mr-1" />
                            Projectに紐付ける
                          </Button>
                        )}
                      </div>

                      <div className="border rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-600" />
                            <span className="text-xs font-semibold text-slate-900">People</span>
                          </div>
                          {selectedLogData.linkedPeople.length > 0 ? (
                            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-800">
                              {selectedLogData.linkedPeople.length}名
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500 text-xs">未紐付け</Badge>
                          )}
                        </div>
                        {selectedLogData.linkedPeople.length > 0 ? (
                          <div className="space-y-1">
                            {selectedLogData.linkedPeople.map((person, idx) => (
                              <div key={idx} className="text-xs text-slate-700 flex items-center gap-1">
                                <Circle className="w-2 h-2 fill-slate-400" />
                                {person}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" className="w-full text-xs">
                            <UserPlus className="w-3 h-3 mr-1" />
                            Peopleに紐付ける
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {selectedLogData.missingFields && selectedLogData.missingFields.length > 0 && (
                    <>
                      <Separator />
                      <div className="bg-amber-50 border border-amber-200 rounded p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-amber-700" />
                          <span className="text-sm font-semibold text-amber-900">Missing Fields</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {selectedLogData.missingFields.map((field, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs bg-amber-100 text-amber-800">
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />

                  {/* Next Actions */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">Next Actions</h3>
                    <div className="space-y-2">
                      {/* 主CTA: 返信/案内を準備 */}
                      {(selectedLogData.messageType === 'inquiry' || 
                        selectedLogData.messageType === 'support_request' || 
                        selectedLogData.messageType === 'feature_request' ||
                        selectedLogData.sourceType === 'support_ticket' ||
                        selectedLogData.sourceType === 'intercom') && (
                        <Link to={`/outbound/compose?fromLog=${selectedLogData.id}&evidence=${selectedLogData.id}&sourceContext=unified_log&linkedCompany=${displayCompany.id}&linkedProject=${selectedLogData.linkedProject || ''}&summary=${encodeURIComponent(selectedLogData.summary)}`}>
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="w-full text-xs"
                          >
                            <Reply className="w-3 h-3 mr-1" />
                            返信/案内を準備
                          </Button>
                        </Link>
                      )}
                      
                      {/* 主CTA: Actionを作成 */}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full text-xs"
                        onClick={() => setShowActionCreatePanel(true)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Actionを作成
                      </Button>

                      <Separator className="my-2" />

                      {/* 補助CTA: 原文を開く */}
                      {selectedLogData.hasOriginalLink && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full text-xs"
                          onClick={() => setShowOriginalPanel(true)}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          原文を開く
                        </Button>
                      )}
                      
                      {/* 補助CTA: Projectに紐付ける */}
                      {!selectedLogData.linkedProject && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full text-xs"
                          onClick={() => setShowProjectLinkPanel(true)}
                        >
                          <FolderPlus className="w-3 h-3 mr-1" />
                          Projectに紐付ける
                        </Button>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs"
                          onClick={() => setShowRelatedAlertsPanel(true)}
                        >
                          <AlertCircle className="w-3 h-3 mr-1" />
                          関連Alert
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs"
                          onClick={() => setShowRelatedActionsPanel(true)}
                        >
                          <Zap className="w-3 h-3 mr-1" />
                          関連Action
                        </Button>
                      </div>
                      {selectedLogData.resolverResult && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full text-xs"
                          onClick={() => setShowResolverDetailPanel(true)}
                        >
                          <Activity className="w-3 h-3 mr-1" />
                          Resolver詳細
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* All Action Panels */}
      <LogActionPanels
        selectedLogData={selectedLogData}
        sourceTypeConfig={sourceTypeConfig}
        companyName={displayCompany.name}
        relatedProjects={displayCompany.relatedProjects}
        showOriginalPanel={showOriginalPanel}
        setShowOriginalPanel={setShowOriginalPanel}
        showAIExtractionPanel={showAIExtractionPanel}
        setShowAIExtractionPanel={setShowAIExtractionPanel}
        showReviewPanel={showReviewPanel}
        setShowReviewPanel={setShowReviewPanel}
        showPeopleLinkPanel={showPeopleLinkPanel}
        setShowPeopleLinkPanel={setShowPeopleLinkPanel}
        showProjectLinkPanel={showProjectLinkPanel}
        setShowProjectLinkPanel={setShowProjectLinkPanel}
        showActionCreatePanel={showActionCreatePanel}
        setShowActionCreatePanel={setShowActionCreatePanel}
        showRelatedAlertsPanel={showRelatedAlertsPanel}
        setShowRelatedAlertsPanel={setShowRelatedAlertsPanel}
        showRelatedActionsPanel={showRelatedActionsPanel}
        setShowRelatedActionsPanel={setShowRelatedActionsPanel}
        showResolverDetailPanel={showResolverDetailPanel}
        setShowResolverDetailPanel={setShowResolverDetailPanel}
      />
    </div>
  );
}