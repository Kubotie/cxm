import { useState, useEffect } from "react";
import { Link } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Eye,
  Building,
  Briefcase,
  Ticket,
  BookOpen,
  FileText,
  Target,
  Send,
  MoreVertical,
  Filter,
  Download,
  RefreshCw,
  X,
  ChevronDown,
  Lightbulb,
  Sparkles,
  MessageSquare,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  Flag,
  Trash2,
  AlertCircle,
} from "lucide-react";

// Mock data for Alert Feed
const alerts = [
  {
    id: "alert_1",
    createdAt: "2024-03-17 10:15",
    alertType: "Opportunity",
    priority: "High",
    title: "株式会社テクノロジーイノベーションがプラン上限に到達",
    summary: "Standard Plan（上限50名）で利用ユーザー数48名。追加メンバー招待の問い合わせあり",
    company: "株式会社テクノロジーイノベーション",
    companyId: "1",
    project: null,
    projectId: null,
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
        timestamp: "2024-03-17 10:15",
        user: "田中太郎",
        company: "株式会社テクノロジーイノベーション",
        content: "新しいメンバーを追加したいのですが、「ユーザー数上限に近づいています」という警告が表示されました。現在の契約プランでユーザー数を増やすことはできますか？それとも上位プランへの変更が必要でしょうか？今後も組織拡大予定のため、柔軟に対応できる方法を教えてください。",
        channel: "Intercom",
        caseId: "inq_9",
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
    createdAt: "2024-03-17 09:45",
    alertType: "Opportunity",
    priority: "High",
    title: "グローバルソリューションズが高度な機能への興味を示している",
    summary: "Advanced Analytics機能について3回問い合わせ。導入事例を知りたいとのこと",
    company: "グローバルソリューションズ",
    companyId: "2",
    project: null,
    projectId: null,
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
        timestamp: "2024-03-16 15:30",
        user: "山田花子",
        company: "グローバルソリューションズ",
        content: "Advanced Analytics機能について詳しく教えていただけますでしょうか。現在Basic Planを利用していますが、データ分析の高度化を検討しており、既に導入されている企業様の活用事例があれば知りたいです。特にカスタムダッシュボード機能とAIレコメンデーション機能に興味があります。",
        channel: "Intercom",
        caseId: "inq_8",
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
    createdAt: "2024-03-17 08:30",
    alertType: "Risk",
    priority: "High",
    title: "クラウドインフラサービスのサポート件数が42%急増",
    summary: "先週比で18件増加。API連携とパフォーマンス関連の問い合わせ集中",
    company: "クラウドインフラサービス",
    companyId: "5",
    project: "API統合プロジェクト",
    projectId: "proj_5",
    source: "System",
    linkedCases: 18,
    cseTickets: 2,
    assigned: "Support",
    owner: "佐藤花子",
    status: "In Progress",
    suggestedAction: "ヘルスチェックMTG設定",
    evidence: {
      whyThisMatters: "先週比で18件増加。API連携とパフォーマンス関連の問い合わせが集中しています。顧客満足度低下のリスクがあります。",
      logs: [
        {
          type: "intercom",
          timestamp: "2024-03-17 08:15",
          user: "高橋美咲",
          company: "クラウドインフラサービス",
          content: "API連携処理を実行すると、頻繁にタイムアウトエラーが発生します。特に大量データを扱う処理で顕著です。先週まで問題なく動作していたのですが、何か変更がありましたでしょうか？弊社の業務に支障が出ており、至急対応をお願いします。",
          channel: "Intercom",
          caseId: "inq_15",
        },
        {
          type: "intercom",
          timestamp: "2024-03-16 14:22",
          user: "佐藤太郎",
          company: "クラウドインフラサービス",
          content: "データ同期処理が昨日から極端に遅くなっています。通常5分程度で完了する処理が、現在30分以上かかっています。サーバー側で何か問題が発生していますか？",
          channel: "Intercom",
          caseId: "inq_14",
        },
        {
          type: "intercom",
          timestamp: "2024-03-15 16:45",
          user: "田中次郎",
          company: "クラウドインフラサービス",
          content: "APIのレスポンスが遅く、タイムアウトが頻発しています。特にピーク時間帯（10-12時、14-16時）に顕著です。パフォーマンス改善の予定はありますか？",
          channel: "Intercom",
          caseId: "inq_12",
        },
      ],
      suggestedActions: [
        { type: "action", label: "ヘルスチェックMTGを設定" },
        { type: "content", label: "API連携トラブルシューティングガイドを送付" },
        { type: "outbound", label: "状況説明と対応方針を共有" },
      ],
    },
  },
  {
    id: "alert_4",
    createdAt: "2024-03-17 07:15",
    alertType: "Content Suggestion",
    priority: "Medium",
    title: "「API連携トラブルシューティングガイド」Content作成を推奨",
    summary: "API連携関連の問い合わせが月間45件。詳細ガイドで初回応答時間短縮可能",
    company: null,
    companyId: null,
    project: null,
    projectId: null,
    source: "System (AI)",
    linkedCases: 45,
    cseTickets: 0,
    assigned: "Unassigned",
    owner: null,
    status: "Untriaged",
    suggestedAction: "Content作成",
    evidence: {
      whyThisMatters: "API連携関連の問い合わせが月間45件。詳細ガイドにより初回応答時間を大幅短縮できます",
      aiSummary: "過去30日間で、API連携に関連する問い合わせが45件発生しています。現在の平均解決時間は22.5時間ですが、詳細なトラブルシューティングガイドを作成することで、初回応答時間を50%短縮、解決時間を30%短縮できる見込みです。",
      metrics: {
        relatedCases: 45,
        avgResolutionTime: "22.5h",
        improvementEstimate: "初回応答時間を50%短縮、解決時間を30%短縮見込み",
      },
      suggestedActions: [
        { type: "content", label: "Content作成" },
      ],
    },
  },
  {
    id: "alert_5",
    createdAt: "2024-03-16 22:30",
    alertType: "Waiting on CSE",
    priority: "High",
    title: "CSE-1234 データ同期エラーの調査が48時間超過",
    summary: "クラウドインフラサービスのCSE Ticket待機時間が52h。中間報告が必要",
    company: "クラウドインフラサービス",
    companyId: "5",
    project: "データ同期システム",
    projectId: "proj_5",
    source: "CSE Ticket",
    linkedCases: 1,
    cseTickets: 1,
    assigned: "CSM",
    owner: "鈴木一郎",
    status: "In Progress",
    suggestedAction: "中間報告送付",
    evidence: {
      whyThisMatters: "待機時間が長期化すると、顧客からのエスカレーション率が上昇します",
      log: {
        type: "cse_ticket",
        timestamp: "2024-03-15 10:30",
        user: "エンジニアリングチーム",
        company: "クラウドインフラサービス",
        content: "CSE-1234 更新: ログ調査中。データベース側のクエリパフォーマンス問題の可能性。詳細調査に2-3営業日必要。",
        channel: "CSE Ticket",
        caseId: "cse_1",
      },
      suggestedActions: [
        { type: "outbound", label: "中間報告を送付" },
        { type: "escalation", label: "CSE進捗確認" },
      ],
    },
  },
  {
    id: "alert_6",
    createdAt: "2024-03-16 18:45",
    alertType: "Urgent",
    priority: "Critical",
    title: "高priority案件が8時間以上未対応",
    summary: "API連携タイムアウトエラーで本番環境の業務が停止中。至急対応必要",
    company: "株式会社テクノロジーイノベーション",
    companyId: "1",
    project: null,
    projectId: null,
    source: "Intercom",
    linkedCases: 1,
    cseTickets: 0,
    assigned: "Unassigned",
    owner: null,
    status: "Untriaged",
    suggestedAction: "即座に対応",
    evidence: {
      whyThisMatters: "過去の類似案件では、12時間超過すると顧客満足度が著しく低下します",
      log: {
        type: "intercom",
        timestamp: "2024-03-17 01:30",
        user: "田中太郎",
        company: "株式会社テクノロジーイノベーション",
        content: "API連携処理を実行すると、タイムアウトエラー（504 Gateway Timeout）が発生します。本番環境で顧客データの取り込みができず業務が止まっています。至急対応をお願いします。",
        channel: "Intercom",
        caseId: "inq_1",
      },
      suggestedActions: [
        { type: "action", label: "CSMにアサイン" },
        { type: "escalation", label: "緊急対応を開始" },
      ],
    },
  },
];

// Helper function to get Alert Type badge color
function getAlertTypeBadgeColor(alertType: string): string {
  const colorMap: Record<string, string> = {
    "Urgent": "bg-red-100 border-red-300 text-red-700",
    "Risk": "bg-orange-100 border-orange-300 text-orange-700",
    "Opportunity": "bg-green-100 border-green-300 text-green-700",
    "FAQ Candidate": "bg-blue-100 border-blue-300 text-blue-700",
    "Help Candidate": "bg-blue-100 border-blue-300 text-blue-700",
    "Content Suggestion": "bg-purple-100 border-purple-300 text-purple-700",
    "Action Suggestion": "bg-purple-100 border-purple-300 text-purple-700",
    "Outbound Suggestion": "bg-purple-100 border-purple-300 text-purple-700",
    "Event Suggestion": "bg-purple-100 border-purple-300 text-purple-700",
    "Waiting on CSE": "bg-amber-100 border-amber-300 text-amber-700",
  };
  return colorMap[alertType] || "bg-slate-100 border-slate-300 text-slate-700";
}

// Helper function to get Priority badge color
function getPriorityBadgeColor(priority: string): string {
  const colorMap: Record<string, string> = {
    "Critical": "bg-red-700 text-white",
    "High": "bg-orange-600 text-white",
    "Medium": "bg-amber-500 text-white",
    "Low": "bg-slate-400 text-white",
  };
  return colorMap[priority] || "bg-slate-400 text-white";
}

// Helper function to get Status badge color
function getStatusBadgeColor(status: string): string {
  const colorMap: Record<string, string> = {
    "Untriaged": "bg-red-50 border-red-300 text-red-700",
    "In Progress": "bg-blue-50 border-blue-300 text-blue-700",
    "Resolved": "bg-green-50 border-green-300 text-green-700",
    "Dismissed": "bg-slate-50 border-slate-300 text-slate-700",
  };
  return colorMap[status] || "bg-slate-50 border-slate-300 text-slate-700";
}

export function SupportHomeNew() {
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<string>("All");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  // Detailed Filters
  const [alertTypeFilter, setAlertTypeFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [assignedFilter, setAssignedFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  
  // Dropdown states
  const [showAlertTypeDropdown, setShowAlertTypeDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showAssignedDropdown, setShowAssignedDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Bulk Actions
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [showBulkActionsMenu, setShowBulkActionsMenu] = useState(false);
  
  // Real-time Updates
  const [hasNewAlerts, setHasNewAlerts] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());

  // Simulate real-time updates (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate new alert detection
      const shouldShowNewAlert = Math.random() > 0.7;
      if (shouldShowNewAlert) {
        setHasNewAlerts(true);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Handle refresh to load new alerts
  const handleRefresh = () => {
    setHasNewAlerts(false);
    setLastUpdateTime(new Date());
  };

  // Toggle select all
  const handleSelectAll = () => {
    if (selectedAlerts.size === sortedAlerts.length) {
      setSelectedAlerts(new Set());
    } else {
      setSelectedAlerts(new Set(sortedAlerts.map(a => a.id)));
    }
  };

  // Toggle select individual alert
  const handleSelectAlert = (alertId: string) => {
    const newSelected = new Set(selectedAlerts);
    if (newSelected.has(alertId)) {
      newSelected.delete(alertId);
    } else {
      newSelected.add(alertId);
    }
    setSelectedAlerts(newSelected);
  };

  // Bulk action handlers
  const handleBulkStatusChange = (status: string) => {
    console.log(`Changing status to ${status} for ${selectedAlerts.size} alerts`);
    setSelectedAlerts(new Set());
    setShowBulkActionsMenu(false);
  };

  const handleBulkPriorityChange = (priority: string) => {
    console.log(`Changing priority to ${priority} for ${selectedAlerts.size} alerts`);
    setSelectedAlerts(new Set());
    setShowBulkActionsMenu(false);
  };

  const handleBulkDismiss = () => {
    console.log(`Dismissing ${selectedAlerts.size} alerts`);
    setSelectedAlerts(new Set());
    setShowBulkActionsMenu(false);
  };

  // Filter alerts based on quick filter
  const filteredAlerts = alerts.filter((alert) => {
    // Quick Filter
    let passQuickFilter = true;
    switch (quickFilter) {
      case "Untriaged":
        passQuickFilter = alert.status === "Untriaged";
        break;
      case "Urgent Only":
        passQuickFilter = alert.priority === "Critical" || alert.priority === "High";
        break;
      case "Risk Only":
        passQuickFilter = alert.alertType === "Risk";
        break;
      case "Opportunity Only":
        passQuickFilter = alert.alertType === "Opportunity";
        break;
      case "Linked CSE":
        passQuickFilter = alert.cseTickets > 0;
        break;
      case "All":
      default:
        passQuickFilter = true;
    }
    
    // Detailed Filters
    const passAlertType = alertTypeFilter.length === 0 || alertTypeFilter.includes(alert.alertType);
    const passPriority = priorityFilter.length === 0 || priorityFilter.includes(alert.priority);
    const passSource = sourceFilter.length === 0 || sourceFilter.includes(alert.source);
    const passAssigned = assignedFilter.length === 0 || assignedFilter.includes(alert.assigned);
    const passStatus = statusFilter.length === 0 || statusFilter.includes(alert.status);
    
    return passQuickFilter && passAlertType && passPriority && passSource && passAssigned && passStatus;
  });

  // Sort alerts
  const sortedAlerts = [...filteredAlerts].sort((a, b) => {
    if (!sortField) return 0;

    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case "createdAt":
        aValue = a.createdAt;
        bValue = b.createdAt;
        break;
      case "alertType":
        aValue = a.alertType;
        bValue = b.alertType;
        break;
      case "priority":
        const priorityOrder = { "Critical": 4, "High": 3, "Medium": 2, "Low": 1 };
        aValue = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
        bValue = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
        break;
      case "title":
        aValue = a.title;
        bValue = b.title;
        break;
      case "company":
        aValue = a.company || "";
        bValue = b.company || "";
        break;
      case "linkedCases":
        aValue = a.linkedCases;
        bValue = b.linkedCases;
        break;
      case "cseTickets":
        aValue = a.cseTickets;
        bValue = b.cseTickets;
        break;
      case "status":
        aValue = a.status;
        bValue = b.status;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Handle sort
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Get sort icon
  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 ml-1 inline opacity-0 group-hover:opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3 h-3 ml-1 inline text-blue-600" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1 inline text-blue-600" />
    );
  };

  const selectedAlertData = sortedAlerts.find(a => a.id === selectedAlert);

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Support - Alert Feed" />
        <main className="flex-1 overflow-hidden flex">
          {/* Main Table Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 space-y-4 flex flex-col h-full">
              
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Support - Alert Feed</h1>
                  <p className="text-sm text-slate-600 mt-1">
                    最新のアラート・AI提案から優先対応を判断
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleRefresh}
                    className={hasNewAlerts ? "border-blue-500 text-blue-600" : ""}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${hasNewAlerts ? "animate-spin" : ""}`} />
                    Refresh
                    {hasNewAlerts && (
                      <Badge className="ml-2 bg-blue-600 text-white text-xs">New</Badge>
                    )}
                  </Button>
                </div>
              </div>

              {/* New Alerts Banner */}
              {hasNewAlerts && (
                <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      新しいアラートがあります
                    </span>
                  </div>
                  <Button size="sm" onClick={handleRefresh} className="bg-blue-600 hover:bg-blue-700">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    更新して表示
                  </Button>
                </div>
              )}

              {/* Bulk Actions Toolbar */}
              {selectedAlerts.size > 0 && (
                <div className="bg-slate-100 border border-slate-300 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">
                      {selectedAlerts.size}件選択中
                    </span>
                    <div className="h-4 w-px bg-slate-300" />
                    <div className="flex gap-2">
                      <div className="relative">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setShowBulkActionsMenu(!showBulkActionsMenu)}
                          className="bg-white"
                        >
                          一括アクション
                          <ChevronDown className="w-4 h-4 ml-2" />
                        </Button>
                        {showBulkActionsMenu && (
                          <div className="absolute top-full left-0 mt-2 bg-white border rounded shadow-lg p-2 z-50 min-w-[200px]">
                            <div className="text-xs font-semibold text-slate-700 mb-2 px-2">ステータス変更</div>
                            <button 
                              onClick={() => handleBulkStatusChange("In Progress")}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded flex items-center gap-2"
                            >
                              <Flag className="w-4 h-4 text-blue-600" />
                              In Progressに変更
                            </button>
                            <button 
                              onClick={() => handleBulkStatusChange("Resolved")}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded flex items-center gap-2"
                            >
                              <Flag className="w-4 h-4 text-green-600" />
                              Resolvedに変更
                            </button>
                            <div className="h-px bg-slate-200 my-2" />
                            <button 
                              onClick={handleBulkDismiss}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 rounded flex items-center gap-2 text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                              一括Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => setSelectedAlerts(new Set())}
                  >
                    <X className="w-4 h-4 mr-2" />
                    選択解除
                  </Button>
                </div>
              )}

              {/* Quick Filters (Tabs) */}
              <div className="flex items-center gap-2 border-b">
                {["All", "Untriaged", "Urgent Only", "Risk Only", "Opportunity Only", "Linked CSE"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setQuickFilter(filter)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      quickFilter === filter
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {filter}
                    {filter === "All" && <Badge variant="outline" className="ml-2 text-xs">{alerts.length}</Badge>}
                    {filter === "Untriaged" && <Badge variant="outline" className="ml-2 text-xs bg-red-50 border-red-300 text-red-700">3</Badge>}
                  </button>
                ))}
              </div>

              {/* Detailed Filters */}
              <div className="flex items-center gap-2 relative">
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAlertTypeDropdown(!showAlertTypeDropdown);
                      setShowPriorityDropdown(false);
                      setShowSourceDropdown(false);
                      setShowAssignedDropdown(false);
                      setShowStatusDropdown(false);
                    }}
                    className={alertTypeFilter.length > 0 ? "border-blue-500" : ""}
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Alert Type
                    {alertTypeFilter.length > 0 && (
                      <Badge variant="outline" className="ml-2 bg-blue-100 border-blue-300 text-blue-700 text-xs">
                        {alertTypeFilter.length}
                      </Badge>
                    )}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                  {showAlertTypeDropdown && (
                    <div className="absolute top-full mt-2 bg-white border rounded shadow-lg p-3 z-50 min-w-[250px]">
                      <div className="text-xs font-semibold text-slate-700 mb-2">Alert Type</div>
                      <div className="flex flex-col gap-2">
                        {["Urgent", "Risk", "Opportunity", "Content Suggestion", "Waiting on CSE"].map((type) => (
                          <label key={type} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={alertTypeFilter.includes(type)}
                              onChange={() => {
                                if (alertTypeFilter.includes(type)) {
                                  setAlertTypeFilter(alertTypeFilter.filter((t) => t !== type));
                                } else {
                                  setAlertTypeFilter([...alertTypeFilter, type]);
                                }
                              }}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">{type}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAlertTypeFilter([])}
                          className="flex-1 h-7 text-xs"
                        >
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setShowAlertTypeDropdown(false)}
                          className="flex-1 h-7 text-xs"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowPriorityDropdown(!showPriorityDropdown);
                      setShowAlertTypeDropdown(false);
                      setShowSourceDropdown(false);
                      setShowAssignedDropdown(false);
                      setShowStatusDropdown(false);
                    }}
                    className={priorityFilter.length > 0 ? "border-blue-500" : ""}
                  >
                    Priority
                    {priorityFilter.length > 0 && (
                      <Badge variant="outline" className="ml-2 bg-blue-100 border-blue-300 text-blue-700 text-xs">
                        {priorityFilter.length}
                      </Badge>
                    )}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                  {showPriorityDropdown && (
                    <div className="absolute top-full mt-2 bg-white border rounded shadow-lg p-3 z-50 min-w-[200px]">
                      <div className="text-xs font-semibold text-slate-700 mb-2">Priority</div>
                      <div className="flex flex-col gap-2">
                        {["Critical", "High", "Medium", "Low"].map((priority) => (
                          <label key={priority} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={priorityFilter.includes(priority)}
                              onChange={() => {
                                if (priorityFilter.includes(priority)) {
                                  setPriorityFilter(priorityFilter.filter((p) => p !== priority));
                                } else {
                                  setPriorityFilter([...priorityFilter, priority]);
                                }
                              }}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">{priority}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPriorityFilter([])}
                          className="flex-1 h-7 text-xs"
                        >
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setShowPriorityDropdown(false)}
                          className="flex-1 h-7 text-xs"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowSourceDropdown(!showSourceDropdown);
                      setShowAlertTypeDropdown(false);
                      setShowPriorityDropdown(false);
                      setShowAssignedDropdown(false);
                      setShowStatusDropdown(false);
                    }}
                    className={sourceFilter.length > 0 ? "border-blue-500" : ""}
                  >
                    Source Channel
                    {sourceFilter.length > 0 && (
                      <Badge variant="outline" className="ml-2 bg-blue-100 border-blue-300 text-blue-700 text-xs">
                        {sourceFilter.length}
                      </Badge>
                    )}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                  {showSourceDropdown && (
                    <div className="absolute top-full mt-2 bg-white border rounded shadow-lg p-3 z-50 min-w-[200px]">
                      <div className="text-xs font-semibold text-slate-700 mb-2">Source Channel</div>
                      <div className="flex flex-col gap-2">
                        {["Intercom", "System", "System (AI)", "CSE Ticket"].map((source) => (
                          <label key={source} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={sourceFilter.includes(source)}
                              onChange={() => {
                                if (sourceFilter.includes(source)) {
                                  setSourceFilter(sourceFilter.filter((s) => s !== source));
                                } else {
                                  setSourceFilter([...sourceFilter, source]);
                                }
                              }}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">{source}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSourceFilter([])}
                          className="flex-1 h-7 text-xs"
                        >
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setShowSourceDropdown(false)}
                          className="flex-1 h-7 text-xs"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAssignedDropdown(!showAssignedDropdown);
                      setShowAlertTypeDropdown(false);
                      setShowPriorityDropdown(false);
                      setShowSourceDropdown(false);
                      setShowStatusDropdown(false);
                    }}
                    className={assignedFilter.length > 0 ? "border-blue-500" : ""}
                  >
                    Assigned Team
                    {assignedFilter.length > 0 && (
                      <Badge variant="outline" className="ml-2 bg-blue-100 border-blue-300 text-blue-700 text-xs">
                        {assignedFilter.length}
                      </Badge>
                    )}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                  {showAssignedDropdown && (
                    <div className="absolute top-full mt-2 bg-white border rounded shadow-lg p-3 z-50 min-w-[200px]">
                      <div className="text-xs font-semibold text-slate-700 mb-2">Assigned Team</div>
                      <div className="flex flex-col gap-2">
                        {["Unassigned", "CSM", "Support"].map((assigned) => (
                          <label key={assigned} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={assignedFilter.includes(assigned)}
                              onChange={() => {
                                if (assignedFilter.includes(assigned)) {
                                  setAssignedFilter(assignedFilter.filter((a) => a !== assigned));
                                } else {
                                  setAssignedFilter([...assignedFilter, assigned]);
                                }
                              }}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">{assigned}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAssignedFilter([])}
                          className="flex-1 h-7 text-xs"
                        >
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setShowAssignedDropdown(false)}
                          className="flex-1 h-7 text-xs"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowStatusDropdown(!showStatusDropdown);
                      setShowAlertTypeDropdown(false);
                      setShowPriorityDropdown(false);
                      setShowSourceDropdown(false);
                      setShowAssignedDropdown(false);
                    }}
                    className={statusFilter.length > 0 ? "border-blue-500" : ""}
                  >
                    Status
                    {statusFilter.length > 0 && (
                      <Badge variant="outline" className="ml-2 bg-blue-100 border-blue-300 text-blue-700 text-xs">
                        {statusFilter.length}
                      </Badge>
                    )}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                  {showStatusDropdown && (
                    <div className="absolute top-full mt-2 bg-white border rounded shadow-lg p-3 z-50 min-w-[200px]">
                      <div className="text-xs font-semibold text-slate-700 mb-2">Status</div>
                      <div className="flex flex-col gap-2">
                        {["Untriaged", "In Progress", "Resolved", "Dismissed"].map((status) => (
                          <label key={status} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={statusFilter.includes(status)}
                              onChange={() => {
                                if (statusFilter.includes(status)) {
                                  setStatusFilter(statusFilter.filter((s) => s !== status));
                                } else {
                                  setStatusFilter([...statusFilter, status]);
                                }
                              }}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">{status}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStatusFilter([])}
                          className="flex-1 h-7 text-xs"
                        >
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setShowStatusDropdown(false)}
                          className="flex-1 h-7 text-xs"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Alert Table */}
              <div className="flex-1 overflow-auto border rounded-lg bg-white">
                <table className="w-full text-sm table-fixed">
                  <thead className="bg-slate-50 border-b sticky top-0 z-10">
                    <tr>
                      <th className="text-center p-3 font-semibold text-slate-700 w-[40px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectAll();
                          }}
                          className="w-5 h-5 flex items-center justify-center"
                        >
                          {selectedAlerts.size === sortedAlerts.length && sortedAlerts.length > 0 ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                      </th>
                      <th className="text-left p-3 font-semibold text-slate-700 w-[110px] cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort("createdAt")}>
                        <span className="flex items-center">
                          Created At
                          {getSortIcon("createdAt")}
                        </span>
                      </th>
                      <th className="text-left p-3 font-semibold text-slate-700 w-[140px] cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort("alertType")}>
                        <span className="flex items-center">
                          Alert Type
                          {getSortIcon("alertType")}
                        </span>
                      </th>
                      <th className="text-left p-3 font-semibold text-slate-700 w-[85px] cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort("priority")}>
                        <span className="flex items-center">
                          Priority
                          {getSortIcon("priority")}
                        </span>
                      </th>
                      <th className="text-left p-3 font-semibold text-slate-700 w-[320px] cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort("title")}>
                        <span className="flex items-center">
                          Title
                          {getSortIcon("title")}
                        </span>
                      </th>
                      <th className="text-left p-3 font-semibold text-slate-700 w-[240px]">Summary</th>
                      <th className="text-left p-3 font-semibold text-slate-700 w-[160px] cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort("company")}>
                        <span className="flex items-center">
                          Company
                          {getSortIcon("company")}
                        </span>
                      </th>
                      <th className="text-left p-3 font-semibold text-slate-700 w-[95px]">Source</th>
                      <th className="text-center p-3 font-semibold text-slate-700 w-[65px] cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort("linkedCases")}>
                        <span className="flex items-center justify-center">
                          Cases
                          {getSortIcon("linkedCases")}
                        </span>
                      </th>
                      <th className="text-center p-3 font-semibold text-slate-700 w-[60px] cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort("cseTickets")}>
                        <span className="flex items-center justify-center">
                          CSE
                          {getSortIcon("cseTickets")}
                        </span>
                      </th>
                      <th className="text-left p-3 font-semibold text-slate-700 w-[110px] cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort("status")}>
                        <span className="flex items-center">
                          Status
                          {getSortIcon("status")}
                        </span>
                      </th>
                      <th className="text-left p-3 font-semibold text-slate-700 w-[160px]">Suggested</th>
                      <th className="text-left p-3 font-semibold text-slate-700 w-[130px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAlerts.map((alert) => (
                      <tr
                        key={alert.id}
                        className={`border-b hover:bg-slate-50 transition-colors ${
                          selectedAlert === alert.id ? "bg-blue-50" : ""
                        } ${selectedAlerts.has(alert.id) ? "bg-blue-50" : ""}`}
                      >
                        <td className="p-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectAlert(alert.id);
                            }}
                            className="w-5 h-5 flex items-center justify-center mx-auto"
                          >
                            {selectedAlerts.has(alert.id) ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                            )}
                          </button>
                        </td>
                        <td className="p-3 text-xs text-slate-600 font-mono cursor-pointer" onClick={() => setSelectedAlert(alert.id)}>{alert.createdAt}</td>
                        <td className="p-3 cursor-pointer" onClick={() => setSelectedAlert(alert.id)}>
                          <Badge variant="outline" className={`text-xs ${getAlertTypeBadgeColor(alert.alertType)}`}>
                            {alert.alertType}
                          </Badge>
                        </td>
                        <td className="p-3 cursor-pointer" onClick={() => setSelectedAlert(alert.id)}>
                          <Badge className={`text-xs ${getPriorityBadgeColor(alert.priority)}`}>
                            {alert.priority}
                          </Badge>
                        </td>
                        <td className="p-3 font-medium text-slate-900 cursor-pointer" onClick={() => setSelectedAlert(alert.id)}>{alert.title}</td>
                        <td className="p-3 text-slate-600 text-sm leading-relaxed cursor-pointer" onClick={() => setSelectedAlert(alert.id)}>{alert.summary}</td>
                        <td className="p-3 cursor-pointer" onClick={() => setSelectedAlert(alert.id)}>
                          {alert.company ? (
                            <Link
                              to={`/company/${alert.companyId}`}
                              className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Building className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{alert.company}</span>
                            </Link>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="p-3 text-xs text-slate-600 cursor-pointer" onClick={() => setSelectedAlert(alert.id)}>{alert.source}</td>
                        <td className="p-3 text-xs text-slate-600 text-center font-medium cursor-pointer" onClick={() => setSelectedAlert(alert.id)}>{alert.linkedCases}</td>
                        <td className="p-3 text-xs text-slate-600 text-center font-medium cursor-pointer" onClick={() => setSelectedAlert(alert.id)}>{alert.cseTickets}</td>
                        <td className="p-3 cursor-pointer" onClick={() => setSelectedAlert(alert.id)}>
                          <Badge variant="outline" className={`text-xs ${getStatusBadgeColor(alert.status)}`}>
                            {alert.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs text-slate-700 cursor-pointer" onClick={() => setSelectedAlert(alert.id)}>{alert.suggestedAction}</td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAlert(alert.id);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {alert.company && (
                              <Link to={`/company/${alert.companyId}`} onClick={(e) => e.stopPropagation()}>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <Building className="w-4 h-4" />
                                </Button>
                              </Link>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between text-sm text-slate-600">
                <div>Showing 1-{sortedAlerts.length} of {sortedAlerts.length} alerts</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled>Previous</Button>
                  <Button variant="outline" size="sm" disabled>Next</Button>
                </div>
              </div>
            </div>
          </div>

          {/* Detail Panel (Slide-over) */}
          {selectedAlert && selectedAlertData && (
            <div className="fixed right-0 top-0 h-full w-[600px] bg-white border-l shadow-xl flex flex-col z-50">
              {/* Panel Header */}
              <div className="p-6 border-b bg-slate-50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs ${getAlertTypeBadgeColor(selectedAlertData.alertType)}`}>
                      {selectedAlertData.alertType}
                    </Badge>
                    <Badge className={`text-xs ${getPriorityBadgeColor(selectedAlertData.priority)}`}>
                      {selectedAlertData.priority}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedAlert(null)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">{selectedAlertData.title}</h2>
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span className="font-mono">{selectedAlertData.createdAt}</span>
                  {selectedAlertData.company && (
                    <Link to={`/company/${selectedAlertData.companyId}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                      <Building className="w-3 h-3" />
                      {selectedAlertData.company}
                    </Link>
                  )}
                  <span>{selectedAlertData.source}</span>
                </div>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-auto p-6 space-y-6">
                {/* Why This Matters */}
                {selectedAlertData.evidence.whyThisMatters && (
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-600" />
                      Why This Matters
                    </div>
                    <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded p-3">
                      {selectedAlertData.evidence.whyThisMatters}
                    </p>
                  </div>
                )}

                {/* AI Summary */}
                {selectedAlertData.evidence.aiSummary && (
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      AI Summary
                    </div>
                    <p className="text-sm text-slate-700 bg-blue-50 border border-blue-200 rounded p-3">
                      {selectedAlertData.evidence.aiSummary}
                    </p>
                  </div>
                )}

                {/* Evidence Log (Single) */}
                {selectedAlertData.evidence.log && (
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Evidence Log (実際のログ)
                    </div>
                    <div className={`p-3 border rounded-lg mb-3 ${
                      selectedAlertData.evidence.log.type === 'intercom' ? 'bg-blue-50 border-blue-200' :
                      selectedAlertData.evidence.log.type === 'slack' ? 'bg-purple-50 border-purple-200' :
                      selectedAlertData.evidence.log.type === 'cse_ticket' ? 'bg-amber-50 border-amber-200' :
                      'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${
                            selectedAlertData.evidence.log.type === 'intercom' ? 'bg-blue-100 border-blue-300 text-blue-700' :
                            selectedAlertData.evidence.log.type === 'slack' ? 'bg-purple-100 border-purple-300 text-purple-700' :
                            selectedAlertData.evidence.log.type === 'cse_ticket' ? 'bg-amber-100 border-amber-300 text-amber-700' :
                            'bg-slate-100 border-slate-300 text-slate-700'
                          }`}>
                            {selectedAlertData.evidence.log.channel}
                          </Badge>
                          <span className="text-xs text-slate-600 font-mono">{selectedAlertData.evidence.log.timestamp}</span>
                        </div>
                        <Link to={`/support/${selectedAlertData.evidence.log.caseId}`}>
                          <Button size="sm" variant="ghost" className="h-6 text-xs">
                            Case詳細 →
                          </Button>
                        </Link>
                      </div>
                      <div className="text-xs font-semibold text-slate-900 mb-1">
                        {selectedAlertData.evidence.log.user} {selectedAlertData.evidence.log.company && `(${selectedAlertData.evidence.log.company})`}
                      </div>
                      <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {selectedAlertData.evidence.log.content}
                      </div>
                    </div>
                  </div>
                )}

                {/* Evidence Logs (Multiple) */}
                {selectedAlertData.evidence.logs && (
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Evidence Logs ({selectedAlertData.evidence.logs.length}件のログ)
                    </div>
                    <div className="space-y-3">
                      {selectedAlertData.evidence.logs.map((log, idx) => {
                        const logBgColor = log.type === 'intercom' ? 'bg-blue-50 border-blue-200' :
                          log.type === 'slack' ? 'bg-purple-50 border-purple-200' :
                          log.type === 'cse_ticket' ? 'bg-amber-50 border-amber-200' :
                          'bg-slate-50 border-slate-200';
                        const badgeColor = log.type === 'intercom' ? 'bg-blue-100 border-blue-300 text-blue-700' :
                          log.type === 'slack' ? 'bg-purple-100 border-purple-300 text-purple-700' :
                          log.type === 'cse_ticket' ? 'bg-amber-100 border-amber-300 text-amber-700' :
                          'bg-slate-100 border-slate-300 text-slate-700';
                        
                        return (
                          <div key={idx} className={`p-3 border rounded-lg ${logBgColor}`}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`text-xs ${badgeColor}`}>
                                  {log.channel}
                                </Badge>
                                <span className="text-xs text-slate-600 font-mono">{log.timestamp}</span>
                              </div>
                              <Link to={`/support/${log.caseId}`}>
                                <Button size="sm" variant="ghost" className="h-6 text-xs">
                                  Case詳細 →
                                </Button>
                              </Link>
                            </div>
                            <div className="text-xs font-semibold text-slate-900 mb-1">
                              {log.user} {log.company && `(${log.company})`}
                            </div>
                            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                              {log.content}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Related Issues */}
                {selectedAlertData.evidence.relatedIssues && (
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-2">Related Issues</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedAlertData.evidence.relatedIssues.map((issue, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {issue}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Linked CSE Tickets */}
                {selectedAlertData.evidence.linkedTickets && (
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-2">Linked CSE Tickets</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedAlertData.evidence.linkedTickets.map((ticket, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          <Ticket className="w-3 h-3 mr-1" />
                          {ticket}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metrics */}
                {selectedAlertData.evidence.metrics && (
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-2">Metrics</div>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedAlertData.evidence.metrics.relatedCases !== undefined && (
                        <div className="p-2 bg-slate-50 border rounded">
                          <div className="text-xs text-slate-600">関連案件</div>
                          <div className="font-semibold text-slate-900">{selectedAlertData.evidence.metrics.relatedCases}件</div>
                        </div>
                      )}
                      {selectedAlertData.evidence.metrics.avgResolutionTime && (
                        <div className="p-2 bg-slate-50 border rounded">
                          <div className="text-xs text-slate-600">平均解決時間</div>
                          <div className="font-semibold text-slate-900">{selectedAlertData.evidence.metrics.avgResolutionTime}</div>
                        </div>
                      )}
                      {selectedAlertData.evidence.metrics.improvementEstimate && (
                        <div className="p-2 bg-green-50 border border-green-200 rounded col-span-2">
                          <div className="text-xs text-green-700 mb-1">改善見込み</div>
                          <div className="text-sm text-green-800">{selectedAlertData.evidence.metrics.improvementEstimate}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Suggested Actions */}
                {selectedAlertData.evidence.suggestedActions && (
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-2">Suggested Actions</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedAlertData.evidence.suggestedActions.map((action, idx) => (
                        <Button key={idx} size="sm" variant="outline" className="h-8 text-xs">
                          {action.type === 'content' && <FileText className="w-3 h-3 mr-1" />}
                          {action.type === 'action' && <Target className="w-3 h-3 mr-1" />}
                          {action.type === 'outbound' && <Send className="w-3 h-3 mr-1" />}
                          {action.type === 'escalation' && <Ticket className="w-3 h-3 mr-1" />}
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Panel Footer (Main CTAs) */}
              <div className="p-6 border-t bg-slate-50 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {selectedAlertData.company && (
                    <Link to={`/company/${selectedAlertData.companyId}`}>
                      <Button size="sm" variant="outline" className="w-full">
                        <Building className="w-4 h-4 mr-2" />
                        Company詳細
                      </Button>
                    </Link>
                  )}
                  <Button size="sm" variant="outline" className="w-full">
                    <Target className="w-4 h-4 mr-2" />
                    Action作成
                  </Button>
                  <Button size="sm" variant="outline" className="w-full">
                    <FileText className="w-4 h-4 mr-2" />
                    Content作成
                  </Button>
                  <Button size="sm" variant="outline" className="w-full">
                    <Send className="w-4 h-4 mr-2" />
                    Outbound準備
                  </Button>
                </div>
                <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700">
                  ステータス変更: In Progress
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}