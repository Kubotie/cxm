import { useState } from "react";
import { Link } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { ViewSwitcher } from "../components/ui/view-switcher";
import { ViewContextHeader } from "../components/ui/view-context-header";
import { ViewEmptyState } from "../components/ui/view-empty-state";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  AlertTriangle,
  TrendingUp,
  Users,
  Filter,
  ArrowRight,
  Search,
  Send,
  CheckSquare,
  FileText,
  Layers,
  Target,
  Zap,
  Info,
  Calendar,
} from "lucide-react";

// モックデータ
const portfolioSummary = {
  totalProjects: 12847,
  activeProjects: 9234,
  atRiskProjects: 1847,
  opportunityProjects: 3421,
  priorityClusters: 8,
  totalUsers: 127856,
  unresolvedLinkages: 2341,
};

// 開催中Event（全Project横断）
const activeEvents = [
  {
    id: "evt_1",
    name: "Q2製品アップデート案内",
    type: "Product Update",
    startDate: "2026-04-01",
    endDate: "2026-04-30",
    status: "active",
    targetProjectCount: 847,
    unsentCount: 234,
  },
  {
    id: "evt_2",
    name: "新規顧客向けWebinar「はじめての活用術」",
    type: "Webinar",
    startDate: "2026-03-20",
    endDate: "2026-03-27",
    status: "active",
    targetProjectCount: 156,
    unsentCount: 45,
  },
];

const phaseDistribution = [
  { name: "Setup", value: 3421, color: "#3b82f6", id: "phase-setup" },
  { name: "Activation", value: 4123, color: "#10b981", id: "phase-activation" },
  { name: "Engagement", value: 3234, color: "#8b5cf6", id: "phase-engagement" },
  { name: "Optimization", value: 2069, color: "#06b6d4", id: "phase-optimization" },
];

const signalDistribution = [
  { name: "Risk", value: 1847, color: "#ef4444", id: "signal-risk" },
  { name: "Opportunity", value: 3421, color: "#10b981", id: "signal-opportunity" },
  { name: "Stable", value: 7579, color: "#64748b", id: "signal-stable" },
];

const healthScoreDistribution = [
  { range: "0-40", count: 1234, fill: "#ef4444", id: "health-0-40" },
  { range: "41-60", count: 2456, fill: "#f59e0b", id: "health-41-60" },
  { range: "61-80", count: 5678, fill: "#10b981", id: "health-61-80" },
  { range: "81-100", count: 3479, fill: "#3b82f6", id: "health-81-100" },
];

const clusters = [
  {
    id: "cls_1",
    name: "利用低下クラスター",
    count: 1847,
    type: "risk" as const,
    priority: 95,
    characteristics: ["l30_active低下", "habituation悪化", "depth_score減少"],
    userCount: 12456,
    insights: "過去30日でアクティビティが50%以上低下、定着スコアが継続的に悪化",
    recommendedActions: ["緊急ヘルスチェックMTG", "利用状況レビュー", "再トレーニング提供"],
    unresolvedRecipientRate: 15,
  },
  {
    id: "cls_2",
    name: "立ち上がり前進中クラスター",
    count: 2134,
    type: "opportunity" as const,
    priority: 70,
    characteristics: ["Setup/Activation Phase", "breadth_score上昇中", "健全な成長曲線"],
    userCount: 8923,
    insights: "初期トレーニング完了後の活用が順調、管理者の関与度が高い",
    recommendedActions: ["定期フォローアップ", "活用促進ワークショップ", "ベストプラクティス共有"],
    unresolvedRecipientRate: 8,
  },
  {
    id: "cls_3",
    name: "Opportunity高クラスター",
    count: 3421,
    type: "opportunity" as const,
    priority: 85,
    characteristics: ["高healthy_score", "高breadth", "アップセル可能性"],
    userCount: 18734,
    insights: "現在の機能を高度に活用、組織内での満足度が高い",
    recommendedActions: ["アップセル提案", "エグゼクティブレビュー", "拡張導入提案"],
    unresolvedRecipientRate: 5,
  },
  {
    id: "cls_4",
    name: "高価値だが停滞中クラスター",
    count: 1523,
    type: "risk" as const,
    priority: 90,
    characteristics: ["大規模ユーザー数", "高tier", "活性化停滞"],
    userCount: 24567,
    insights: "ユーザー規模は大きいが利用深度が浅い、新機能の認知が低い",
    recommendedActions: ["QBR実施", "活用度診断", "専任CSM配置"],
    unresolvedRecipientRate: 12,
  },
  {
    id: "cls_5",
    name: "健全運用クラスター",
    count: 5234,
    type: "stable" as const,
    priority: 40,
    characteristics: ["安定したhealth", "定着完了", "自律運用"],
    userCount: 31245,
    insights: "安定した活用が継続、問い合わせも少なく自律運用",
    recommendedActions: ["四半期レビュー", "成功事例取材", "コミュニティ招待"],
    unresolvedRecipientRate: 3,
  },
  {
    id: "cls_6",
    name: "Company未解決が多いクラスター",
    count: 2341,
    type: "risk" as const,
    priority: 60,
    characteristics: ["unresolved linkage高", "Company情報不足", "データ品質低"],
    userCount: 9876,
    insights: "Company連携が未解決のため正確な分析ができない",
    recommendedActions: ["データクレンジング", "Company情報補完", "linkage解決"],
    unresolvedRecipientRate: 45,
  },
  {
    id: "cls_7",
    name: "User多数だが活性弱いクラスター",
    count: 1876,
    type: "risk" as const,
    priority: 75,
    characteristics: ["高User数", "低depth_score", "低habituation"],
    userCount: 15234,
    insights: "ユーザー数は多いが一人あたりの活用度が低い",
    recommendedActions: ["活用促進キャンペーン", "部門別トレーニング", "チャンピオン育成"],
    unresolvedRecipientRate: 20,
  },
  {
    id: "cls_8",
    name: "Campaign進行中クラスター",
    count: 1471,
    type: "opportunity" as const,
    priority: 55,
    characteristics: ["running_campaign有", "goal設定済", "施策実行中"],
    userCount: 6543,
    insights: "現在進行中のキャンペーンで改善施策を実行中",
    recommendedActions: ["効果測定", "進捗モニタリング", "ベストプラクティス抽出"],
    unresolvedRecipientRate: 10,
  },
];

// 優先度順にソート
const prioritizedClusters = [...clusters].sort((a, b) => b.priority - a.priority);

const clusterTypeColors = {
  risk: "border-red-200 bg-red-50",
  opportunity: "border-emerald-200 bg-emerald-50",
  stable: "border-blue-200 bg-blue-50",
};

const clusterTypeBadgeColors = {
  risk: "bg-red-500",
  opportunity: "bg-emerald-500",
  stable: "bg-blue-500",
};

// Sample projects for table view
const sampleProjects = [
  {
    id: "proj_1",
    name: "プロジェクトA",
    company: "株式会社テクノロジーイノベーション",
    companyId: "1",
    phase: "Activation",
    healthScore: 58,
    users: 12,
    alerts: 2,
    cluster: "利用低下クラスター",
  },
  {
    id: "proj_2",
    name: "プロジェクトB",
    company: "グローバルソリューションズ株式会社",
    companyId: "2",
    phase: "Optimization",
    healthScore: 88,
    users: 24,
    alerts: 0,
    cluster: "Opportunity高クラスター",
  },
  {
    id: "proj_3",
    name: "プロジェクトC",
    company: "クラウドインフラサービス",
    companyId: "5",
    phase: "Setup",
    healthScore: 45,
    users: 8,
    alerts: 3,
    cluster: "利用低下クラスター",
  },
];

export function Projects() {
  // View state (Default: My Projects)
  const [currentView, setCurrentView] = useState("my");
  
  const [selectedCluster, setSelectedCluster] = useState(prioritizedClusters[0]);
  const [viewMode, setViewMode] = useState<"overview" | "clusters" | "table">("overview");
  const [searchQuery, setSearchQuery] = useState("");

  // Mock current user (ownership判定用)
  const currentUserId = "user_1";

  // View definitions
  const views = [
    { value: "my", label: "My Projects", description: "自分の担当Project", isDefault: true },
    { value: "at-risk", label: "At Risk", description: "リスクが高いProject" },
    { value: "opportunity", label: "Opportunity", description: "機会が大きいProject" },
    { value: "all", label: "All Projects", description: "全Project" },
  ];

  // View configurations
  const viewConfig: Record<string, {
    subtitle: string;
    filterClusters: (cluster: typeof clusters[0]) => boolean;
    filterProjects: (project: typeof sampleProjects[0]) => boolean;
    emptyState: { title: string; description: string; cta: { label: string; action: () => void } | null };
  }> = {
    my: {
      subtitle: "自分の担当Projectの状況と優先度を確認する",
      filterClusters: (cluster) => cluster.type !== "stable", // Mock
      filterProjects: (project) => project.healthScore < 90, // Mock
      emptyState: {
        title: "担当Projectはまだありません",
        description: "Projectが割り当てられると、ここに表示されます",
        cta: { label: "All Projects を見る", action: () => setCurrentView("all") },
      },
    },
    "at-risk": {
      subtitle: "リスクが高いProjectを優先的に確認する",
      filterClusters: (cluster) => cluster.type === "risk",
      filterProjects: (project) => project.healthScore < 60 || project.alerts > 0,
      emptyState: {
        title: "現在、リスクが高いProjectはありません",
        description: "リスク条件に該当するProjectが発生すると、ここに表示されます",
        cta: { label: "My Projects を見る", action: () => setCurrentView("my") },
      },
    },
    opportunity: {
      subtitle: "機会が大きいProject群を把握する",
      filterClusters: (cluster) => cluster.type === "opportunity",
      filterProjects: (project) => project.healthScore >= 80,
      emptyState: {
        title: "現在、大きな機会があるProjectはありません",
        description: "機会条件に該当するProjectが発生すると、ここに表示されます",
        cta: { label: "My Projects を見る", action: () => setCurrentView("my") },
      },
    },
    all: {
      subtitle: "すべてのProjectを横断して確認する",
      filterClusters: (cluster) => true,
      filterProjects: (project) => true,
      emptyState: {
        title: "Projectがまだ登録されていません",
        description: "Projectデータが同期されると、ここに表示されます",
        cta: null,
      },
    },
  };

  const config = viewConfig[currentView];
  const currentViewLabel = views.find(v => v.value === currentView)?.label || "";
  
  // Filter clusters and projects by current view
  const filteredClusters = prioritizedClusters.filter(config.filterClusters);
  const viewFilteredProjects = sampleProjects.filter(config.filterProjects);
  
  // Calculate summary based on filtered clusters
  const viewSummary = {
    totalProjects: filteredClusters.reduce((sum, c) => sum + c.count, 0),
    atRiskProjects: filteredClusters.filter(c => c.type === "risk").reduce((sum, c) => sum + c.count, 0),
    opportunityProjects: filteredClusters.filter(c => c.type === "opportunity").reduce((sum, c) => sum + c.count, 0),
    totalClusters: filteredClusters.length,
    totalUsers: filteredClusters.reduce((sum, c) => sum + c.userCount, 0),
    activeProjects: filteredClusters.reduce((sum, c) => sum + (c.type !== "stable" ? c.count : 0), 0),
  };

  // Calculate dynamic chart data based on filteredClusters
  const viewPhaseDistribution = [
    { 
      name: "Setup", 
      value: filteredClusters.filter(c => c.characteristics.some(ch => ch.includes("Setup"))).reduce((sum, c) => sum + c.count, 0) || 0,
      color: "#3b82f6", 
      id: "phase-setup" 
    },
    { 
      name: "Activation", 
      value: filteredClusters.filter(c => c.characteristics.some(ch => ch.includes("Activation"))).reduce((sum, c) => sum + c.count, 0) || 0,
      color: "#10b981", 
      id: "phase-activation" 
    },
    { 
      name: "Engagement", 
      value: filteredClusters.reduce((sum, c) => sum + Math.floor(c.count * 0.25), 0) || 0, // Mock distribution
      color: "#8b5cf6", 
      id: "phase-engagement" 
    },
    { 
      name: "Optimization", 
      value: filteredClusters.reduce((sum, c) => sum + Math.floor(c.count * 0.15), 0) || 0, // Mock distribution
      color: "#06b6d4", 
      id: "phase-optimization" 
    },
  ].filter(phase => phase.value > 0);

  const viewSignalDistribution = [
    { 
      name: "Risk", 
      value: viewSummary.atRiskProjects, 
      color: "#ef4444", 
      id: "signal-risk" 
    },
    { 
      name: "Opportunity", 
      value: viewSummary.opportunityProjects, 
      color: "#10b981", 
      id: "signal-opportunity" 
    },
    { 
      name: "Stable", 
      value: viewSummary.totalProjects - viewSummary.atRiskProjects - viewSummary.opportunityProjects, 
      color: "#64748b", 
      id: "signal-stable" 
    },
  ].filter(signal => signal.value > 0);

  const viewHealthScoreDistribution = [
    { range: "0-40", count: Math.floor(viewSummary.totalProjects * 0.1), fill: "#ef4444", id: "health-0-40" },
    { range: "41-60", count: Math.floor(viewSummary.totalProjects * 0.2), fill: "#f59e0b", id: "health-41-60" },
    { range: "61-80", count: Math.floor(viewSummary.totalProjects * 0.45), fill: "#10b981", id: "health-61-80" },
    { range: "81-100", count: Math.floor(viewSummary.totalProjects * 0.25), fill: "#3b82f6", id: "health-81-100" },
  ].filter(health => health.count > 0);

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Cross-project analytics" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1800px] mx-auto p-6 space-y-6">
            
            {/* Header with Current View */}
            <div className="flex items-center justify-between">
              <ViewContextHeader
                pageName="Projects"
                currentView={currentViewLabel}
                subtitle={config.subtitle}
              />
              <ViewSwitcher
                currentView={currentView}
                views={views}
                onViewChange={setCurrentView}
              />
            </div>

            {/* Active Events Banner */}
            {activeEvents.length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-6">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <div className="flex-1 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-purple-900">開催中Event:</span>
                      <Badge className="bg-purple-600 text-white text-xs h-4">
                        {activeEvents.length}件
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {activeEvents.map((event) => (
                        <div key={event.id} className="flex items-center gap-2">
                          <Link
                            to={`/events/${event.id}`}
                            className="text-xs font-medium text-purple-700 hover:text-purple-900 hover:underline"
                          >
                            {event.name}
                          </Link>
                          <span className="text-xs text-purple-600">
                            (対象: {event.targetProjectCount}件
                            {event.unsentCount > 0 && (
                              <span className="text-amber-700 font-medium"> • 未配信: {event.unsentCount}件</span>
                            )}
                            )
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Link to="/events">
                    <Button variant="ghost" size="sm" className="text-xs h-6">
                      Event一覧
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Portfolio Summary Cards */}
            <div className="grid grid-cols-7 gap-3 mb-6">
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="w-4 h-4 text-slate-500" />
                  <span className="text-xs text-slate-600">View内Project</span>
                </div>
                <div className="text-2xl font-semibold text-slate-900">
                  {viewSummary.totalProjects.toLocaleString()}
                </div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-slate-600">Active</span>
                </div>
                <div className="text-2xl font-semibold text-blue-600">
                  {viewSummary.activeProjects.toLocaleString()}
                </div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-slate-600">At Risk</span>
                </div>
                <div className="text-2xl font-semibold text-red-600">
                  {viewSummary.atRiskProjects.toLocaleString()}
                </div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-slate-600">Opportunity</span>
                </div>
                <div className="text-2xl font-semibold text-emerald-600">
                  {viewSummary.opportunityProjects.toLocaleString()}
                </div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-purple-500" />
                  <span className="text-xs text-slate-600">Clusters</span>
                </div>
                <div className="text-2xl font-semibold text-purple-600">
                  {viewSummary.totalClusters}
                </div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-slate-500" />
                  <span className="text-xs text-slate-600">Total Users</span>
                </div>
                <div className="text-2xl font-semibold text-slate-900">
                  {viewSummary.totalUsers.toLocaleString()}
                </div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-slate-500" />
                  <span className="text-xs text-slate-600">全体概要</span>
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  全{portfolioSummary.totalProjects.toLocaleString()}件
                </div>
              </div>
            </div>

            {/* View Mode Tabs */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "overview" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("overview")}
                >
                  Overview
                </Button>
                <Button
                  variant={viewMode === "clusters" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("clusters")}
                >
                  Clusters分析
                </Button>
                <Button
                  variant={viewMode === "table" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                >
                  Project一覧
                </Button>
              </div>
              <div className="flex gap-2">
                <Link to="/audience">
                  <Button variant="outline" size="sm">
                    Audience作成
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
                <Link to="/outbound">
                  <Button size="sm">
                    <Send className="w-4 h-4 mr-2" />
                    Outbound起票
                  </Button>
                </Link>
              </div>
            </div>

            {/* Overview View */}
            {viewMode === "overview" && (
              <div className="grid grid-cols-3 gap-6">
                {/* Phase Distribution */}
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">Phase分布</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={viewPhaseDistribution}
                        cx="50%"
                        cy="40%"
                        labelLine={false}
                        label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                        outerRadius={65}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {viewPhaseDistribution.map((entry, index) => (
                          <Cell key={`phase-${entry.name}-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value.toLocaleString()} projects`} />
                      <Legend 
                        verticalAlign="bottom" 
                        height={50}
                        wrapperStyle={{ fontSize: '11px', lineHeight: '1.4' }}
                        formatter={(value, entry: any) => `${value}:${entry.payload.value.toLocaleString()}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Signal Distribution */}
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">Signal分布</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={viewSignalDistribution}
                        cx="50%"
                        cy="40%"
                        labelLine={false}
                        label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                        outerRadius={65}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {viewSignalDistribution.map((entry, index) => (
                          <Cell key={`signal-${entry.name}-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value.toLocaleString()} projects`} />
                      <Legend 
                        verticalAlign="bottom" 
                        height={50}
                        wrapperStyle={{ fontSize: '11px', lineHeight: '1.4' }}
                        formatter={(value, entry: any) => `${value}:${entry.payload.value.toLocaleString()}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Health Score Distribution */}
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">Health Score分布</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={viewHealthScoreDistribution} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="range" 
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis 
                        tick={{ fontSize: 11 }}
                        width={35}
                      />
                      <Tooltip 
                        formatter={(value: number) => [`${value.toLocaleString()} projects`, 'Count']}
                        contentStyle={{ fontSize: '12px' }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {viewHealthScoreDistribution.map((entry, index) => (
                          <Cell key={`health-${entry.range}-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Clusters View */}
            {viewMode === "clusters" && (
              <div className="space-y-4">
                {filteredClusters.map((cluster) => (
                  <div
                    key={cluster.id}
                    className={`border-2 rounded-lg ${clusterTypeColors[cluster.type]}`}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-slate-900">{cluster.name}</h3>
                            <Badge className={`text-xs ${clusterTypeBadgeColors[cluster.type]}`}>
                              {cluster.type === "risk" ? "Risk" : cluster.type === "opportunity" ? "Opportunity" : "Stable"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              優先度: {cluster.priority}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-700">
                            <div className="flex items-center gap-1">
                              <Layers className="w-4 h-4" />
                              <span>{cluster.count.toLocaleString()}件</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              <span>{cluster.userCount.toLocaleString()}名</span>
                            </div>
                            {cluster.unresolvedRecipientRate > 0 && (
                              <div className="flex items-center gap-1 text-orange-600">
                                <Info className="w-4 h-4" />
                                <span>未解決: {cluster.unresolvedRecipientRate}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Characteristics */}
                      <div className="mb-3">
                        <div className="text-xs font-medium text-slate-700 mb-1">特徴:</div>
                        <div className="flex flex-wrap gap-2">
                          {cluster.characteristics.map((char, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {char}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Insights */}
                      <div className="mb-3">
                        <div className="text-xs font-medium text-slate-700 mb-1">インサイト:</div>
                        <p className="text-sm text-slate-600">{cluster.insights}</p>
                      </div>

                      {/* Recommended Actions */}
                      <div className="mb-4">
                        <div className="text-xs font-medium text-slate-700 mb-2">推奨アクション:</div>
                        <div className="flex flex-wrap gap-2">
                          {cluster.recommendedActions.map((action, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs bg-white">
                              {action}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* CTAs */}
                      <div className="flex gap-2 pt-3 border-t">
                        <Link to={`/audience?cluster=${cluster.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            <Users className="w-4 h-4 mr-2" />
                            Audience作成
                          </Button>
                        </Link>
                        <Link to={`/outbound?cluster=${cluster.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            <Send className="w-4 h-4 mr-2" />
                            Outbound起票
                          </Button>
                        </Link>
                        <Link to={`/actions?cluster=${cluster.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            <CheckSquare className="w-4 h-4 mr-2" />
                            Actions作成
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Table View */}
            {viewMode === "table" && (
              <div className="bg-white border rounded-lg">
                <div className="p-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Project名、Company名で検索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select defaultValue="all">
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Cluster filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全Cluster</SelectItem>
                        {prioritizedClusters.map((cluster) => (
                          <SelectItem key={cluster.id} value={cluster.id}>
                            {cluster.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select defaultValue="all_phase">
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Phase filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_phase">全Phase</SelectItem>
                        {phaseDistribution.map((phase) => (
                          <SelectItem key={phase.name} value={phase.name}>
                            {phase.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project名</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Phase</TableHead>
                      <TableHead>Health Score</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Alerts</TableHead>
                      <TableHead>Cluster</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewFilteredProjects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">
                          <Link
                            to={`/project/${project.id}`}
                            className="hover:text-blue-600 hover:underline"
                          >
                            {project.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link
                            to={`/company/${project.companyId}`}
                            className="text-sm text-slate-600 hover:text-blue-600 hover:underline"
                          >
                            {project.company}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {project.phase}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                project.healthScore >= 80
                                  ? "bg-green-500"
                                  : project.healthScore >= 60
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                              }`}
                            ></div>
                            <span className="text-sm">{project.healthScore}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Users className="w-3 h-3" />
                            {project.users}
                          </div>
                        </TableCell>
                        <TableCell>
                          {project.alerts > 0 ? (
                            <Badge className="text-xs bg-red-500">{project.alerts}</Badge>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-600">{project.cluster}</span>
                        </TableCell>
                        <TableCell>
                          <Link to={`/project/${project.id}`}>
                            <Button variant="ghost" size="sm" className="text-xs h-7">
                              詳細
                              <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-4 border-t text-center">
                  <p className="text-sm text-slate-500">
                    {viewFilteredProjects.length.toLocaleString()}件を表示中（全{portfolioSummary.totalProjects.toLocaleString()}件）
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}