import { useState } from "react";
import { Link } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Input } from "../components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../components/ui/sheet";
import { Separator } from "../components/ui/separator";
import { ViewSwitcher } from "../components/ui/view-switcher";
import { ViewContextHeader } from "../components/ui/view-context-header";
import { ViewEmptyState } from "../components/ui/view-empty-state";
import {
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Database,
  Building2,
  FolderKanban,
  Search,
  Filter,
  Info,
  Reply,
  ExternalLink,
  Send,
  FileText,
  CheckSquare,
  User,
  Eye,
  Archive,
  PauseCircle,
} from "lucide-react";

// モックデータ
const alerts = [
  {
    id: "alert_1",
    type: "risk" as const,
    severity: "high" as const,
    title: "オンボーディング遅延の兆候",
    description: "決裁者の会議欠席が3回連続。技術的な懸念点が未解決の可能性。",
    company: "株式会社テクノロジーイノベーション",
    companyId: "1",
    project: "プロジェクトA",
    projectId: "proj_1",
    phase: "Setup",
    evidenceCount: 4,
    timestamp: "2026-03-10 14:30",
    owner: "佐藤 太郎",
    status: "pending_review" as const,
    scope: "Company",
    aiProposal: "決裁者への個別フォローアップMTGを提案。過去の議事録から、技術的な懸念点が未解決の可能性。",
  },
  {
    id: "alert_2",
    type: "opportunity" as const,
    severity: "high" as const,
    title: "追加ライセンス検討の可能性",
    description: "営業部長から「他部署での導入も検討したい」との発言。",
    company: "グローバルソリューションズ株式会社",
    companyId: "2",
    project: null,
    projectId: null,
    phase: "Engagement",
    evidenceCount: 2,
    timestamp: "2026-03-09 16:00",
    owner: "田中 花子",
    status: "pending_review" as const,
    scope: "Company",
    aiProposal: "追加ライセンスの提案資料を作成し、営業部長との個別商談を設定することを推奨。",
  },
  {
    id: "alert_3",
    type: "risk" as const,
    severity: "high" as const,
    title: "Health Score急落",
    description: "過去14日でHealth Scoreが82から58に低下。",
    company: "クラウドインフラサービス",
    companyId: "5",
    project: "プロジェクトC",
    projectId: "proj_3",
    phase: "Activation",
    evidenceCount: 6,
    timestamp: "2026-03-09 10:15",
    owner: "佐藤 太郎",
    status: "pending_review" as const,
    scope: "Project",
    aiProposal: "利用状況の詳細分析と、ユーザーへのヒアリングを実施することを推奨。",
  },
  {
    id: "alert_4",
    type: "missing_info" as const,
    severity: "medium" as const,
    title: "決裁者情報が不完全",
    description: "経営層の関与状況が不明。決裁フローの確認が必要。",
    company: "エンタープライズシステムズ",
    companyId: "3",
    project: "プロジェクトB",
    projectId: "proj_2",
    phase: "Optimization",
    evidenceCount: 3,
    timestamp: "2026-03-08 11:20",
    owner: "田中 花子",
    status: "unprocessed" as const,
    scope: "Company",
    aiProposal: "次回MTGで組織図の確認と、決裁フローのヒアリングを実施することを推奨。",
  },
  {
    id: "alert_5",
    type: "unprocessed_evidence" as const,
    severity: "low" as const,
    title: "未処理のMTG議事録が3件",
    description: "内容確認と重要情報の抽出が必要。",
    company: "デジタルマーケティング株式会社",
    companyId: "4",
    project: "データ分析基盤構築",
    projectId: "proj_4",
    phase: "Engagement",
    evidenceCount: 3,
    timestamp: "2026-03-07 18:45",
    owner: "佐藤 太郎",
    status: "unprocessed" as const,
    scope: "Project",
    aiProposal: "議事録の内容を確認し、Action ItemとDecisionを抽出することを推奨。",
  },
  {
    id: "alert_6",
    type: "opportunity" as const,
    severity: "medium" as const,
    title: "利用率向上の兆候",
    description: "過去7日でアクティブユーザー数が15%増加。",
    company: "AIソリューションズ株式会社",
    companyId: "6",
    project: "マーケティング施策最適化",
    projectId: "proj_5",
    phase: "Optimization",
    evidenceCount: 5,
    timestamp: "2026-03-07 09:00",
    owner: "田中 花子",
    status: "approved" as const,
    scope: "Project",
    aiProposal: "成功要因の分析と、他Projectへの横展開を検討することを推奨。",
  },
  {
    id: "alert_7",
    type: "inquiry" as const,
    severity: "medium" as const,
    title: "顧客からの問い合わせ",
    description: "顧客からの問い合わせがあり、対応が必要。",
    company: "テクノロジー株式会社",
    companyId: "7",
    project: "プロジェクトD",
    projectId: "proj_6",
    phase: "Activation",
    evidenceCount: 2,
    timestamp: "2026-03-06 15:45",
    owner: "佐藤 太郎",
    status: "pending_review" as const,
    scope: "Project",
    aiProposal: "顧客からの問い合わせ内容を確認し、適切な対応を準備することを推奨。",
  },
];

const alertTypeColors = {
  risk: "border-red-200 bg-red-50 text-red-700",
  opportunity: "border-emerald-200 bg-emerald-50 text-emerald-700",
  missing_info: "border-orange-200 bg-orange-50 text-orange-700",
  unprocessed_evidence: "border-blue-200 bg-blue-50 text-blue-700",
  inquiry: "border-purple-200 bg-purple-50 text-purple-700",
};

const alertTypeIcons = {
  risk: AlertTriangle,
  opportunity: TrendingUp,
  missing_info: Info,
  unprocessed_evidence: Database,
  inquiry: Info,
};

const severityColors = {
  high: "bg-red-500",
  medium: "bg-orange-500",
  low: "bg-yellow-500",
};

const statusColors = {
  pending_review: "bg-amber-100 text-amber-800",
  unprocessed: "bg-slate-100 text-slate-700",
  approved: "bg-green-100 text-green-800",
  dismissed: "bg-slate-100 text-slate-500",
};

export function Inbox() {
  // Queue state (Default: Multiple queues active)
  const [currentQueue, setCurrentQueue] = useState("assigned");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);

  // Mock current user
  const currentUserName = "佐藤 太郎";
  const teamMembers = ["佐藤 太郎", "田中 花子", "鈴木 次郎"];

  // Queue definitions
  const queues = [
    { value: "assigned", label: "Assigned to me", description: "自分に割り当て", isDefault: true },
    { value: "team", label: "My team", description: "チーム対応", isDefault: true },
    { value: "related", label: "Related to my accounts", description: "担当顧客関連", isDefault: true },
    { value: "unassigned", label: "Unassigned", description: "未割り当て", isDefault: true },
  ];

  // Queue configurations
  const queueConfig: Record<string, {
    subtitle: string;
    filter: (alert: typeof alerts[0]) => boolean;
    emptyState: { title: string; description: string; cta: { label: string; action: () => void } | null };
  }> = {
    assigned: {
      subtitle: "自分に割り当てられた受信項目を確認する",
      filter: (alert) => alert.owner === currentUserName,
      emptyState: {
        title: "自分に割り当てられた受信項目はありません",
        description: "項目が割り当てられると、ここに表示されます",
        cta: { label: "Unassigned を見る", action: () => setCurrentQueue("unassigned") },
      },
    },
    team: {
      subtitle: "チームで対応すべき受信項目を確認する",
      filter: (alert) => teamMembers.includes(alert.owner),
      emptyState: {
        title: "チーム対応中の受信項目はありません",
        description: "チーム対応項目が発生すると、ここに表示されます",
        cta: { label: "Assigned to me を見る", action: () => setCurrentQueue("assigned") },
      },
    },
    related: {
      subtitle: "自分の担当顧客に関連する受信項目を確認する",
      filter: (alert) => alert.owner === currentUserName, // Mock: 実際はcompanyIdで判定
      emptyState: {
        title: "担当顧客に関連する受信項目はありません",
        description: "担当顧客からの受信項目が発生すると、ここに表示されます",
        cta: { label: "Assigned to me を見る", action: () => setCurrentQueue("assigned") },
      },
    },
    unassigned: {
      subtitle: "まだ担当が決まっていない受信項目を確認する",
      filter: (alert) => !alert.owner,
      emptyState: {
        title: "未割り当ての受信項目はありません",
        description: "新しい受信項目が発生すると、ここに表示されます",
        cta: null,
      },
    },
  };

  const config = queueConfig[currentQueue];
  const currentQueueLabel = queues.find(q => q.value === currentQueue)?.label || "";

  // Filter by queue first
  const queueFilteredAlerts = alerts.filter(config.filter);

  // Then apply additional filters
  const filteredAlerts = queueFilteredAlerts.filter((alert) => {
    if (typeFilter !== "all" && alert.type !== typeFilter) return false;
    if (severityFilter !== "all" && alert.severity !== severityFilter) return false;
    if (statusFilter !== "all" && alert.status !== statusFilter) return false;
    if (searchQuery && !alert.title.toLowerCase().includes(searchQuery.toLowerCase()) && !alert.company.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Calculate stats based on queue-filtered alerts
  const stats = {
    total: queueFilteredAlerts.length,
    pendingReview: queueFilteredAlerts.filter((a) => a.status === "pending_review").length,
    unprocessed: queueFilteredAlerts.filter((a) => a.status === "unprocessed").length,
    highSeverity: queueFilteredAlerts.filter((a) => a.severity === "high").length,
    risks: queueFilteredAlerts.filter((a) => a.type === "risk").length,
    opportunities: queueFilteredAlerts.filter((a) => a.type === "opportunity").length,
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Mixed" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1800px] mx-auto p-6 space-y-6">
            
            {/* Header with Current Queue */}
            <div className="flex items-center justify-between">
              <ViewContextHeader
                pageName="Inbox"
                currentView={currentQueueLabel}
                subtitle={config.subtitle}
              />
              <ViewSwitcher
                currentView={currentQueue}
                views={queues}
                onViewChange={setCurrentQueue}
              />
            </div>

            {/* Stats Cards - Queue範囲で集計 */}
            <div className="grid grid-cols-6 gap-3">
              <div className="bg-white border rounded-lg p-4">
                <div className="text-xs text-slate-600 mb-1">Total in {currentQueueLabel}</div>
                <div className="text-2xl font-semibold text-slate-900">{stats.total}</div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="text-xs text-slate-600 mb-1">Review待ち</div>
                <div className="text-2xl font-semibold text-amber-600">{stats.pendingReview}</div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="text-xs text-slate-600 mb-1">未処理</div>
                <div className="text-2xl font-semibold text-slate-600">{stats.unprocessed}</div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="text-xs text-slate-600 mb-1">高重要度</div>
                <div className="text-2xl font-semibold text-red-600">{stats.highSeverity}</div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="text-xs text-slate-600 mb-1">Risk</div>
                <div className="text-2xl font-semibold text-red-600">{stats.risks}</div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="text-xs text-slate-600 mb-1">Opportunity</div>
                <div className="text-2xl font-semibold text-emerald-600">{stats.opportunities}</div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white border rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Alert名、Company名で検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Type filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全Type</SelectItem>
                    <SelectItem value="risk">Risk</SelectItem>
                    <SelectItem value="opportunity">Opportunity</SelectItem>
                    <SelectItem value="missing_info">Missing Info</SelectItem>
                    <SelectItem value="unprocessed_evidence">Unprocessed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Severity filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全Severity</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Status filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全Status</SelectItem>
                    <SelectItem value="pending_review">Review待ち</SelectItem>
                    <SelectItem value="unprocessed">未処理</SelectItem>
                    <SelectItem value="approved">承認済み</SelectItem>
                    <SelectItem value="dismissed">却下</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Alert List or Empty State */}
            {filteredAlerts.length === 0 ? (
              <ViewEmptyState
                title={config.emptyState.title}
                description={config.emptyState.description}
                currentView={currentQueueLabel}
                cta={config.emptyState.cta}
              />
            ) : (
              <div className="space-y-3">
                {filteredAlerts.map((alert) => {
                  const Icon = alertTypeIcons[alert.type];
                  return (
                  <div
                    key={alert.id}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${alertTypeColors[alert.type]} ${
                      selectedAlert === alert.id ? "ring-2 ring-blue-500" : ""
                    }`}
                    onClick={() => setSelectedAlert(alert.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Icon className="w-5 h-5" />
                          <h3 className="text-base font-semibold text-slate-900">{alert.title}</h3>
                          <Badge className={`text-xs ${severityColors[alert.severity]} text-white`}>
                            {alert.severity}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${statusColors[alert.status]}`}>
                            {alert.status === "pending_review" && "Review待ち"}
                            {alert.status === "unprocessed" && "未処理"}
                            {alert.status === "approved" && "承認済み"}
                            {alert.status === "dismissed" && "却下"}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-700 mb-3">{alert.description}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-600">
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {alert.company}
                          </div>
                          {alert.project && (
                            <div className="flex items-center gap-1">
                              <FolderKanban className="w-3.5 h-3.5" />
                              {alert.project}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Database className="w-3.5 h-3.5" />
                            Evidence: {alert.evidenceCount}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {alert.timestamp}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAlert(alert.id);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1.5" />
                          詳細
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // 保留処理
                          }}
                        >
                          <PauseCircle className="w-4 h-4 mr-1.5" />
                          保留
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // クローズ処理
                          }}
                        >
                          <Archive className="w-4 h-4 mr-1.5" />
                          クローズ
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Alert詳細Sheet */}
      <Sheet open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <SheetContent className="w-[490px] sm:max-w-[490px] overflow-y-auto p-0">
          {selectedAlert && (() => {
            const alert = alerts.find((a) => a.id === selectedAlert);
            if (!alert) return null;
            const Icon = alertTypeIcons[alert.type];
            
            return (
              <div className="p-6">
                <SheetHeader className="mb-6">
                  <SheetTitle className="flex items-center gap-3 text-xl">
                    <Icon className="w-6 h-6" />
                    {alert.title}
                  </SheetTitle>
                  <SheetDescription className="text-sm">
                    Alert詳細と次アクション判断
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-6">
                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-xs ${severityColors[alert.severity]} text-white`}>
                      {alert.severity}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${statusColors[alert.status]}`}>
                      {alert.status === "pending_review" && "Review待ち"}
                      {alert.status === "unprocessed" && "未処理"}
                      {alert.status === "approved" && "承認済み"}
                      {alert.status === "dismissed" && "却下"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {alert.scope}
                    </Badge>
                  </div>

                  {/* Description */}
                  <div className="bg-slate-50 border-2 border-slate-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      詳細
                    </h3>
                    <p className="text-sm text-slate-700 leading-relaxed">{alert.description}</p>
                  </div>

                  {/* Context Info */}
                  <div>
                    <div className="pb-2 border-b mb-4">
                      <h3 className="text-base font-semibold text-slate-900">文脈情報</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-600 font-medium">Company:</span>
                        <span className="font-semibold text-slate-900">{alert.company}</span>
                      </div>
                      {alert.project && (
                        <div className="flex items-center justify-between py-2 border-b border-slate-100">
                          <span className="text-slate-600 font-medium">Project:</span>
                          <span className="font-semibold text-slate-900">{alert.project}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-600 font-medium">Phase:</span>
                        <span className="font-semibold text-slate-900">{alert.phase}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-600 font-medium">Evidence数:</span>
                        <span className="font-semibold text-slate-900">{alert.evidenceCount}件</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-600 font-medium">Owner:</span>
                        <span className="font-semibold text-slate-900">{alert.owner}</span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-slate-600 font-medium">検出日時:</span>
                        <span className="font-semibold text-slate-900">{alert.timestamp}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* AI Proposal */}
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      AI提案
                    </h3>
                    <p className="text-sm text-blue-800 leading-relaxed">{alert.aiProposal}</p>
                  </div>

                  <Separator />

                  {/* 主CTA（送信準備導線） */}
                  <div>
                    <div className="pb-2 border-b mb-4">
                      <h3 className="text-base font-semibold text-slate-900">次アクション</h3>
                    </div>
                    <div className="space-y-3">
                      {(alert.type === "risk" || alert.type === "opportunity" || alert.type === "inquiry") && (
                        <Link 
                          to={`/outbound/compose?fromInbox=${alert.id}&evidence=${alert.id}&sourceContext=inbox&linkedCompany=${alert.companyId}&linkedProject=${alert.projectId || ''}&summary=${encodeURIComponent(alert.aiProposal || alert.title)}`}
                          className="block"
                        >
                          <Button variant="default" size="sm" className="w-full h-10 justify-start">
                            <Reply className="w-4 h-4 mr-2" />
                            返信/案内を準備
                          </Button>
                        </Link>
                      )}
                      <Link to={`/actions?fromInbox=${alert.id}`} className="block">
                        <Button variant="outline" size="sm" className="w-full h-10 justify-start">
                          <CheckSquare className="w-4 h-4 mr-2" />
                          Actionsに回す
                        </Button>
                      </Link>
                      <Link to={`/content?fromInbox=${alert.id}`} className="block">
                        <Button variant="outline" size="sm" className="w-full h-10 justify-start">
                          <FileText className="w-4 h-4 mr-2" />
                          Contentに回す
                        </Button>
                      </Link>
                    </div>
                  </div>

                  <Separator />

                  {/* 補助CTA（文脈確認） */}
                  <div>
                    <div className="pb-2 border-b mb-4">
                      <h3 className="text-base font-semibold text-slate-900">関連情報</h3>
                    </div>
                    <div className="space-y-3">
                      <Link to={`/company/${alert.companyId}`} className="block">
                        <Button variant="outline" size="sm" className="w-full h-10 justify-start">
                          <Building2 className="w-4 h-4 mr-2" />
                          Company詳細を見る
                        </Button>
                      </Link>
                      {alert.projectId && (
                        <Link to={`/project/${alert.projectId}`} className="block">
                          <Button variant="outline" size="sm" className="w-full h-10 justify-start">
                            <FolderKanban className="w-4 h-4 mr-2" />
                            Project詳細を見る
                          </Button>
                        </Link>
                      )}
                      <Button variant="outline" size="sm" className="w-full h-10 justify-start">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        原文を開く
                      </Button>
                      <Button variant="outline" size="sm" className="w-full h-10 justify-start">
                        <Database className="w-4 h-4 mr-2" />
                        関連Evidenceを見る（{alert.evidenceCount}件）
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* 状態変更CTA */}
                  <div>
                    <div className="pb-2 border-b mb-4">
                      <h3 className="text-base font-semibold text-slate-900">状態変更</h3>
                    </div>
                    <div className="space-y-3">
                      {alert.status === "pending_review" && (
                        <>
                          <Button size="sm" className="w-full h-10 bg-green-600 hover:bg-green-700">
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            AI提案を承認
                          </Button>
                          <Button variant="outline" size="sm" className="w-full h-10 text-red-600 border-red-300">
                            <XCircle className="w-4 h-4 mr-2" />
                            AI提案を却下
                          </Button>
                        </>
                      )}
                      {alert.status === "unprocessed" && (
                        <Button size="sm" className="w-full h-10">
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          処理開始
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="w-full h-10">
                        <User className="w-4 h-4 mr-2" />
                        担当を割り当てる
                      </Button>
                      <Button variant="outline" size="sm" className="w-full h-10">
                        <PauseCircle className="w-4 h-4 mr-2" />
                        保留
                      </Button>
                      <Button variant="outline" size="sm" className="w-full h-10">
                        <Archive className="w-4 h-4 mr-2" />
                        クローズ
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}