import { useState } from "react";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { CompanyCard } from "../components/cards/company-card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { ViewSwitcher } from "../components/ui/view-switcher";
import { ViewContextHeader } from "../components/ui/view-context-header";
import { ViewEmptyState } from "../components/ui/view-empty-state";
import { Search, AlertTriangle, Clock, CheckSquare, Send, FileText, Users, Building, Inbox, ArrowRight, Filter, List, LayoutGrid, ArrowUpDown, TrendingUp, Zap, Target } from "lucide-react";
import { Link } from "react-router";
import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// モックデータ
const mockCompanies = [
  {
    id: "1",
    name: "株式会社テクノロジーイノベーション",
    phaseLabel: "Setup",
    unprocessedMinutes: 8,
    riskLevel: "high" as const,
    opportunityLevel: "medium" as const,
    openActions: 5,
    openAlerts: 3,
    lastContact: "2026-03-10",
    renewalDate: "2026-06-10",
    owner: "佐藤 太郎",
    healthScore: 65,
    mrr: "¥12,000,000",
  },
  {
    id: "2",
    name: "グローバルソリューションズ株式会社",
    phaseLabel: "Optimization",
    unprocessedMinutes: 3,
    riskLevel: "low" as const,
    opportunityLevel: "high" as const,
    openActions: 2,
    openAlerts: 0,
    lastContact: "2026-03-09",
    renewalDate: "2026-06-09",
    owner: "田中 花子",
    healthScore: 88,
    mrr: "¥24,000,000",
  },
  {
    id: "3",
    name: "エンタープライズシステムズ",
    phaseLabel: "Engagement",
    unprocessedMinutes: 12,
    riskLevel: "medium" as const,
    opportunityLevel: "low" as const,
    openActions: 7,
    openAlerts: 2,
    lastContact: "2026-03-08",
    renewalDate: "2026-06-08",
    owner: "佐藤 太郎",
    healthScore: 72,
    mrr: "¥18,000,000",
  },
  {
    id: "4",
    name: "デジタルマーケティング株式会社",
    phaseLabel: "Expantion",
    unprocessedMinutes: 0,
    riskLevel: "low" as const,
    opportunityLevel: "medium" as const,
    openActions: 1,
    openAlerts: 0,
    lastContact: "2026-03-11",
    renewalDate: "2026-06-11",
    owner: "鈴木 次郎",
    healthScore: 82,
    mrr: "¥8,400,000",
  },
  {
    id: "5",
    name: "クラウドインフラサービス",
    phaseLabel: "Activation",
    unprocessedMinutes: 15,
    riskLevel: "high" as const,
    opportunityLevel: "high" as const,
    openActions: 9,
    openAlerts: 4,
    lastContact: "2026-03-07",
    renewalDate: "2026-06-07",
    owner: "田中 花子",
    healthScore: 58,
    mrr: "¥15,600,000",
  },
  {
    id: "6",
    name: "AIソリューションズ株式会社",
    phaseLabel: "Optimization",
    unprocessedMinutes: 2,
    riskLevel: "none" as const,
    opportunityLevel: "medium" as const,
    openActions: 3,
    openAlerts: 0,
    lastContact: "2026-03-10",
    renewalDate: "2026-06-10",
    owner: "鈴木 次郎",
    healthScore: 90,
    mrr: "¥20,400,000",
  },
  {
    id: "7",
    name: "株式会社FinTechパートナーズ",
    phaseLabel: "Engagement",
    unprocessedMinutes: 5,
    riskLevel: "medium" as const,
    opportunityLevel: "low" as const,
    openActions: 4,
    openAlerts: 1,
    lastContact: "2026-03-09",
    renewalDate: "2026-06-09",
    owner: "佐藤 太郎",
    healthScore: 75,
    mrr: "¥16,800,000",
  },
  {
    id: "8",
    name: "株式会社メディカルテック",
    phaseLabel: "Setup",
    unprocessedMinutes: 10,
    riskLevel: "high" as const,
    opportunityLevel: "medium" as const,
    openActions: 6,
    openAlerts: 3,
    lastContact: "2026-03-06",
    renewalDate: "2026-06-06",
    owner: "田中 花子",
    healthScore: 62,
    mrr: "¥9,600,000",
  },
];

const riskColors = {
  high: "text-red-700 bg-red-50",
  medium: "text-orange-700 bg-orange-50",
  low: "text-yellow-700 bg-yellow-50",
  none: "text-slate-600 bg-slate-50",
};

const opportunityColors = {
  high: "text-emerald-700 bg-emerald-50",
  medium: "text-blue-700 bg-blue-50",
  low: "text-sky-700 bg-sky-50",
  none: "text-slate-600 bg-slate-50",
};

const getHealthScoreColor = (score: number) => {
  if (score >= 80) return "text-emerald-700 bg-emerald-50";
  if (score >= 70) return "text-blue-700 bg-blue-50";
  if (score >= 60) return "text-orange-700 bg-orange-50";
  return "text-red-700 bg-red-50";
};

export function CSMHome() {
  // View state (Default: My Accounts)
  const [currentView, setCurrentView] = useState("my");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");

  // Mock current user
  const currentUserId = "user_1";
  const currentUserName = "佐藤 太郎";

  // View definitions
  const views = [
    { value: "my", label: "My Accounts", description: "自分の担当顧客", isDefault: true },
    { value: "priority", label: "My Priorities", description: "優先対応が必要な顧客" },
    { value: "team", label: "Team View", description: "チーム全体の担当顧客" },
    { value: "all", label: "All Accounts", description: "全顧客" },
  ];

  // View configurations
  const viewConfig: Record<string, {
    subtitle: string;
    filter: (company: typeof mockCompanies[0]) => boolean;
    emptyState: { title: string; description: string; cta: { label: string; action: () => void } | null };
  }> = {
    my: {
      subtitle: "自分の担当顧客の状況と優先度を俯瞰する",
      filter: (company) => company.owner === currentUserName,
      emptyState: {
        title: "担当顧客はまだありません",
        description: "顧客が割り当てられると、ここに表示されます",
        cta: { label: "All Accounts を見る", action: () => setCurrentView("all") },
      },
    },
    priority: {
      subtitle: "今優先して見るべき顧客と案件を確認する",
      filter: (company) => company.owner === currentUserName && (company.riskLevel === "high" || company.openActions > 5),
      emptyState: {
        title: "現在、優先対応が必要な顧客はありません",
        description: "優先度が高い顧客が発生すると、ここに表示されます",
        cta: { label: "My Accounts を見る", action: () => setCurrentView("my") },
      },
    },
    team: {
      subtitle: "チーム全体で優先対応が必要な顧客を確認する",
      filter: (company) => true, // Mock: 全顧客をチーム対象とする
      emptyState: {
        title: "チーム対象の顧客はまだありません",
        description: "チームに顧客が割り当てられると、ここに表示されます",
        cta: { label: "All Accounts を見る", action: () => setCurrentView("all") },
      },
    },
    all: {
      subtitle: "全顧客を横断して重要な動きを確認する",
      filter: (company) => true,
      emptyState: {
        title: "顧客がまだ登録されていません",
        description: "顧客データが同期されると、ここに表示されます",
        cta: null,
      },
    },
  };

  const config = viewConfig[currentView];
  const currentViewLabel = views.find(v => v.value === currentView)?.label || "";
  
  // Filter companies by current view
  const viewFilteredCompanies = mockCompanies.filter(config.filter);
  
  // Then apply additional filters (search, risk, phase)
  const filteredCompanies = viewFilteredCompanies.filter((company) => {
    const matchesSearch = company.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRisk = riskFilter === "all" || company.riskLevel === riskFilter;
    const matchesPhase = phaseFilter === "all" || company.phaseLabel === phaseFilter;
    return matchesSearch && matchesRisk && matchesPhase;
  });

  // Calculate summary based on view-filtered companies
  const totalCompanies = viewFilteredCompanies.length;
  const totalUnprocessedMinutes = viewFilteredCompanies.reduce((sum, c) => sum + c.unprocessedMinutes, 0);
  const totalOpenActions = viewFilteredCompanies.reduce((sum, c) => sum + c.openActions, 0);
  const highRiskCount = viewFilteredCompanies.filter((c) => c.riskLevel === "high").length;
  const opportunityCount = viewFilteredCompanies.filter((c) => c.opportunityLevel === "high").length;
  const avgHealthScore = totalCompanies > 0 
    ? Math.round(viewFilteredCompanies.reduce((sum, c) => sum + c.healthScore, 0) / totalCompanies) 
    : 0;

  // Calculate distributions for charts
  const phaseDistribution = [
    { 
      name: "Setup", 
      value: viewFilteredCompanies.filter(c => c.phaseLabel === "Setup").length,
      color: "#3b82f6",
      id: "phase-setup"
    },
    { 
      name: "Activation", 
      value: viewFilteredCompanies.filter(c => c.phaseLabel === "Activation").length,
      color: "#10b981",
      id: "phase-activation"
    },
    { 
      name: "Engagement", 
      value: viewFilteredCompanies.filter(c => c.phaseLabel === "Engagement").length,
      color: "#8b5cf6",
      id: "phase-engagement"
    },
    { 
      name: "Optimization", 
      value: viewFilteredCompanies.filter(c => c.phaseLabel === "Optimization").length,
      color: "#06b6d4",
      id: "phase-optimization"
    },
    { 
      name: "Expantion", 
      value: viewFilteredCompanies.filter(c => c.phaseLabel === "Expantion").length,
      color: "#f59e0b",
      id: "phase-expantion"
    },
  ].filter(item => item.value > 0); // Only show phases with data

  const signalDistribution = [
    { 
      name: "Risk", 
      value: viewFilteredCompanies.filter(c => c.riskLevel === "high").length,
      color: "#ef4444",
      id: "signal-risk"
    },
    { 
      name: "Opportunity", 
      value: viewFilteredCompanies.filter(c => c.opportunityLevel === "high").length,
      color: "#10b981",
      id: "signal-opportunity"
    },
    { 
      name: "Stable", 
      value: viewFilteredCompanies.filter(c => c.riskLevel !== "high" && c.opportunityLevel !== "high").length,
      color: "#64748b",
      id: "signal-stable"
    },
  ].filter(item => item.value > 0);

  const healthScoreDistribution = [
    { range: "0-40", count: viewFilteredCompanies.filter(c => c.healthScore <= 40).length, fill: "#ef4444", id: "health-0-40" },
    { range: "41-60", count: viewFilteredCompanies.filter(c => c.healthScore > 40 && c.healthScore <= 60).length, fill: "#f59e0b", id: "health-41-60" },
    { range: "61-80", count: viewFilteredCompanies.filter(c => c.healthScore > 60 && c.healthScore <= 80).length, fill: "#10b981", id: "health-61-80" },
    { range: "81-100", count: viewFilteredCompanies.filter(c => c.healthScore > 80).length, fill: "#3b82f6", id: "health-81-100" },
  ].filter(item => item.count > 0);

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Company" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1800px] mx-auto p-6 space-y-6">
            
            {/* Header with Current View */}
            <div className="flex items-center justify-between">
              <ViewContextHeader
                pageName="Company"
                currentView={currentViewLabel}
                subtitle={config.subtitle}
              />
              <ViewSwitcher
                currentView={currentView}
                views={views}
                onViewChange={setCurrentView}
              />
            </div>

            {/* Summary KPIs - View範囲で集計 */}
            <div className="grid grid-cols-6 gap-3">
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Building className="w-4 h-4 text-slate-500" />
                  <span className="text-xs text-slate-600">View内Company</span>
                </div>
                <div className="text-2xl font-semibold text-slate-900">{totalCompanies}</div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-slate-600">Avg Health</span>
                </div>
                <div className="text-2xl font-semibold text-blue-600">{avgHealthScore}</div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-slate-600">At Risk</span>
                </div>
                <div className="text-2xl font-semibold text-red-600">{highRiskCount}</div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-slate-600">Opportunity</span>
                </div>
                <div className="text-2xl font-semibold text-emerald-600">{opportunityCount}</div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-slate-600">未処理Minutes</span>
                </div>
                <div className="text-2xl font-semibold text-amber-600">{totalUnprocessedMinutes}</div>
              </div>
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckSquare className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-slate-600">未完了Actions</span>
                </div>
                <div className="text-2xl font-semibold text-blue-600">{totalOpenActions}</div>
              </div>
            </div>

            {/* Distribution Charts */}
            {totalCompanies > 0 && (
              <div className="grid grid-cols-3 gap-6">
                {/* M-Phase Distribution */}
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">M-Phase分布</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={phaseDistribution}
                        cx="50%"
                        cy="40%"
                        labelLine={false}
                        label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                        outerRadius={65}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {phaseDistribution.map((entry, index) => (
                          <Cell key={`phase-${entry.name}-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value}社`} />
                      <Legend 
                        verticalAlign="bottom" 
                        height={50}
                        wrapperStyle={{ fontSize: '11px', lineHeight: '1.4' }}
                        formatter={(value, entry: any) => `${value}:${entry.payload.value}`}
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
                        data={signalDistribution}
                        cx="50%"
                        cy="40%"
                        labelLine={false}
                        label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                        outerRadius={65}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {signalDistribution.map((entry, index) => (
                          <Cell key={`signal-${entry.name}-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value}社`} />
                      <Legend 
                        verticalAlign="bottom" 
                        height={50}
                        wrapperStyle={{ fontSize: '11px', lineHeight: '1.4' }}
                        formatter={(value, entry: any) => `${value}:${entry.payload.value}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Health Score Distribution */}
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">Health Score分布</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={healthScoreDistribution} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
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
                        formatter={(value: number) => [`${value}社`, '社数']}
                        contentStyle={{ fontSize: '12px' }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {healthScoreDistribution.map((entry, index) => (
                          <Cell key={`health-${entry.range}-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Search and Filters */}
            <div className="bg-white border rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="会社名で検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  フィルタ
                </Button>
                <div className="flex items-center gap-1 border rounded-md">
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                    className="h-9"
                  >
                    <List className="w-4 h-4 mr-1" />
                    テーブル
                  </Button>
                  <Button
                    variant={viewMode === "card" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("card")}
                    className="h-9"
                  >
                    <LayoutGrid className="w-4 h-4 mr-1" />
                    カード
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Risk:</span>
                  <Select value={riskFilter} onValueChange={setRiskFilter}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Phase:</span>
                  <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      <SelectItem value="unlinked">Unlinked</SelectItem>
                      <SelectItem value="connected">Connected</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="setup">Setup</SelectItem>
                      <SelectItem value="activation">Activation</SelectItem>
                      <SelectItem value="engagement">Engagement</SelectItem>
                      <SelectItem value="optimization">Optimization</SelectItem>
                      <SelectItem value="expantion">Expantion</SelectItem>
                      <SelectItem value="cocreation">CoCreation</SelectItem>
                      <SelectItem value="strategic">Strategic Partner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Badge variant="outline" className="text-xs">未処理Minutes有り</Badge>
                <Badge variant="outline" className="text-xs">未完了Action有り</Badge>
              </div>
            </div>

            {/* Empty State or Data */}
            {filteredCompanies.length === 0 ? (
              <ViewEmptyState
                title={config.emptyState.title}
                description={config.emptyState.description}
                currentView={currentViewLabel}
                cta={config.emptyState.cta}
              />
            ) : (
              <>
              {/* Table View */}
              {viewMode === "table" && (
                <div className="bg-white border rounded-lg overflow-hidden">
                  <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="font-semibold">
                        <div className="flex items-center gap-1">
                          Company名
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">Phase</TableHead>
                      <TableHead className="font-semibold text-center">
                        <div className="flex items-center justify-center gap-1">
                          Health
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">Risk</TableHead>
                      <TableHead className="font-semibold">Opportunity</TableHead>
                      <TableHead className="font-semibold text-center">
                        <div className="flex items-center justify-center gap-1">
                          Alerts
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-center">
                        <div className="flex items-center justify-center gap-1">
                          未処理Minutes
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-center">
                        <div className="flex items-center justify-center gap-1">
                          未完了Action
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center gap-1">
                          最終接点
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">
                        <div className="flex items-center gap-1">
                          契約更新日
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">MRR</TableHead>
                      <TableHead className="font-semibold">担当者</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map((company) => (
                      <TableRow key={company.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium">
                          <Link 
                            to={`/company/${company.id}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {company.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {company.phaseLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center justify-center w-12 h-6 rounded-full text-xs font-semibold ${getHealthScoreColor(company.healthScore)}`}>
                            {company.healthScore}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${riskColors[company.riskLevel]}`}>
                            {company.riskLevel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${opportunityColors[company.opportunityLevel]}`}>
                            {company.opportunityLevel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {company.openAlerts > 0 ? (
                            <Badge className="bg-red-500 text-xs">
                              {company.openAlerts}
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {company.unprocessedMinutes > 0 ? (
                            <Badge className="bg-amber-500 text-xs">
                              {company.unprocessedMinutes}
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {company.openActions > 0 ? (
                            <Badge className="bg-blue-500 text-xs">
                              {company.openActions}
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {company.lastContact}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {company.renewalDate}
                        </TableCell>
                        <TableCell className="text-sm text-slate-900 font-medium">
                          {company.mrr}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {company.owner}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="border-t p-3 bg-slate-50">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>全{mockCompanies.length}件を表示</span>
                    <div className="flex items-center gap-4">
                      <span>平均Health Score: {Math.round(mockCompanies.reduce((sum, c) => sum + c.healthScore, 0) / mockCompanies.length)}</span>
                      <span>総MRR: ¥{(mockCompanies.reduce((sum, c) => sum + parseInt(c.mrr.replace(/[¥,]/g, '')), 0) / 1000000).toFixed(1)}M</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

              {/* Card View */}
              {viewMode === "card" && (
                <div className="grid grid-cols-2 gap-4">
                  {filteredCompanies.map((company) => (
                    <CompanyCard key={company.id} {...company} />
                  ))}
                </div>
              )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}