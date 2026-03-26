import { useState } from "react";
import { Link } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Users,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Activity,
  Filter,
  Bookmark,
  BarChart3,
  Layers,
  ChevronDown,
  ChevronUp,
  Mail,
  MessageSquare,
  Edit3,
  Send,
  Zap,
  Info,
  ExternalLink,
} from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";

// モックデータ
const portfolioSummary = {
  totalProjects: 12847,
  activeProjects: 9234,
  highRiskProjects: 1847,
  highOpportunityProjects: 3421,
  priorityClusters: 8,
  recommendedActionTargets: 27856,
  unresolvedLinkages: 2341,
  weakActivityProjects: 1923,
};

const phaseDistribution = [
  { name: "Setup", value: 3421, color: "#3b82f6" },
  { name: "Activation", value: 4123, color: "#10b981" },
  { name: "Engagement", value: 3234, color: "#8b5cf6" },
  { name: "Optimization", value: 2069, color: "#06b6d4" },
];

const healthScoreDistribution = [
  { range: "0-40", count: 1234, fill: "#ef4444", id: "health-0-40" },
  { range: "41-60", count: 2456, fill: "#f59e0b", id: "health-41-60" },
  { range: "61-80", count: 5678, fill: "#10b981", id: "health-61-80" },
  { range: "81-100", count: 3479, fill: "#3b82f6", id: "health-81-100" },
];

const breadthScoreDistribution = [
  { range: "Low", count: 2341 },
  { range: "Medium", count: 6789 },
  { range: "High", count: 3717 },
];

const signalDistribution = [
  { name: "Risk", value: 1847, color: "#ef4444" },
  { name: "Opportunity", value: 3421, color: "#10b981" },
  { name: "Stable", value: 7579, color: "#64748b" },
];

const clusters = [
  {
    id: "cls_1",
    name: "利用低下クラスター",
    count: 1847,
    type: "risk" as const,
    priority: 95,
    characteristics: ["l30_active低下", "habituation悪化", "depth_score減少"],
    risks: ["チャーン懸念", "利用停止リスク", "更新拒否可能性"],
    opportunities: [],
    userCount: 12456,
    insights: ["過去30日でアクティビティが50%以上低下", "定着スコアが継続的に悪化"],
    recommendedActions: ["緊急ヘルスチェックMTG", "利用状況レビュー", "再トレーニング提供"],
    recommendedContent: ["ヘルスチェック依頼Email", "活用Tips Slack通知"],
    audienceScope: "Project Level",
    recommendedChannel: ["Email", "Slack"],
    recommendedActionType: ["Outreach", "Training"],
    unresolvedRecipientRate: 15,
    preExecutionChecks: ["管理者連絡先確認", "最終活動日確認", "契約更新日確認"],
  },
  {
    id: "cls_2",
    name: "立ち上がり前進中クラスター",
    count: 2134,
    type: "opportunity" as const,
    priority: 70,
    characteristics: ["Setup/Activation Phase", "breadth_score上昇中", "健全な成長曲線"],
    risks: [],
    opportunities: ["早期定着支援", "利用拡大促進", "成功事例化"],
    userCount: 8923,
    insights: ["初���トレーニング完了後の活用が順調", "管理者の関与度が高い"],
    recommendedActions: ["定期フォローアップ", "活用促進ワークショップ", "ベストプラクティス共有"],
    recommendedContent: ["活用事例紹介Email", "次ステップ提案資料"],
    audienceScope: "Project + User Level",
    recommendedChannel: ["Email", "In-app"],
    recommendedActionType: ["Education", "Engagement"],
    unresolvedRecipientRate: 8,
    preExecutionChecks: ["トレーニング受講状況確認", "現在のPhase確認"],
  },
  {
    id: "cls_3",
    name: "Opportunity高クラスター",
    count: 3421,
    type: "opportunity" as const,
    priority: 85,
    characteristics: ["高healthy_score", "高breadth", "アップセル可能性"],
    risks: [],
    opportunities: ["機能拡張提案", "上位プラン提案", "他部署展開"],
    userCount: 18734,
    insights: ["現在の機能を高度に活用", "組織内での満足度が高い"],
    recommendedActions: ["アップセル提案", "エグゼクティブレビュー", "拡張導入提案"],
    recommendedContent: ["上位機能紹介Email", "ROI分析資料", "エグゼクティブプレゼン資料"],
    audienceScope: "Company Level",
    recommendedChannel: ["Email", "Meeting"],
    recommendedActionType: ["Sales", "Executive Review"],
    unresolvedRecipientRate: 5,
    preExecutionChecks: ["意思決定者確認", "契約状況確認", "利用状況レポート準備"],
  },
  {
    id: "cls_4",
    name: "高価値だが停滞中クラスター",
    count: 1523,
    type: "risk" as const,
    priority: 90,
    characteristics: ["大規模ユーザー数", "高tier", "活性化停滞"],
    risks: ["潜在的チャーン", "競合切替リスク", "契約縮小"],
    opportunities: ["再活性化", "深掘り活用", "新機能訴求"],
    userCount: 24567,
    insights: ["ユーザー規模は大きいが利用深度が浅い", "新機能の認知が低い"],
    recommendedActions: ["QBR実施", "活用度診断", "専任CSM配置"],
    recommendedContent: ["価値再確認ワークショップ案内", "新機能デモ案内"],
    audienceScope: "Company + Project Level",
    recommendedChannel: ["Email", "Meeting", "Phone"],
    recommendedActionType: ["QBR", "Deep Dive"],
    unresolvedRecipientRate: 12,
    preExecutionChecks: ["CSM担当確認", "契約金額確認", "競合情報確認"],
  },
  {
    id: "cls_5",
    name: "健全運用クラスター",
    count: 5234,
    type: "stable" as const,
    priority: 40,
    characteristics: ["安定したhealth", "定着完了", "自律運用"],
    risks: [],
    opportunities: ["成功事例化", "レファレンス化", "コミュニティ参加"],
    userCount: 31245,
    insights: ["安定した活用が継続", "問い合わせも少なく自律運用"],
    recommendedActions: ["四半期レビュー", "成功事例取材", "コミュニティ招待"],
    recommendedContent: ["四半期レポート", "コミュニティ案内"],
    audienceScope: "Company Level",
    recommendedChannel: ["Email"],
    recommendedActionType: ["Review", "Community"],
    unresolvedRecipientRate: 3,
    preExecutionChecks: ["成功事例化の意向確認"],
  },
  {
    id: "cls_6",
    name: "Company未解決が多いクラスター",
    count: 2341,
    type: "risk" as const,
    priority: 60,
    characteristics: ["unresolved linkage高", "Company情報不足", "データ品質低"],
    risks: ["正確な分析不可", "適切な施策困難", "レポート品質低下"],
    opportunities: ["データクレンジング", "正確な把握", "施策精度向上"],
    userCount: 9876,
    insights: ["Company連携が未解決のため正確な分析ができない"],
    recommendedActions: ["データクレンジング", "Company情報補完", "linkage解決"],
    recommendedContent: ["情報確認依頼Email"],
    audienceScope: "Project Level",
    recommendedChannel: ["Email", "Internal Action"],
    recommendedActionType: ["Data Quality"],
    unresolvedRecipientRate: 45,
    preExecutionChecks: ["データソース確認", "手動補完の可能性確認"],
  },
  {
    id: "cls_7",
    name: "User多数だが活性弱いクラスター",
    count: 1876,
    type: "risk" as const,
    priority: 75,
    characteristics: ["高User数", "低depth_score", "低habituation"],
    risks: ["潜在的不満", "利用定着失敗", "部分利用のみ"],
    opportunities: ["活用深化", "トレーニング強化", "機能横展開"],
    userCount: 15234,
    insights: ["ユーザー数は多いが一人あたりの活用度が低い"],
    recommendedActions: ["活用促進キャンペーン", "部門別トレーニング", "チャンピオン育成"],
    recommendedContent: ["活用促進Email", "トレーニング案内"],
    audienceScope: "User Level",
    recommendedChannel: ["Email", "Slack", "In-app"],
    recommendedActionType: ["Training", "Campaign"],
    unresolvedRecipientRate: 20,
    preExecutionChecks: ["部門別セグメント確認", "トレーニングコンテンツ準備"],
  },
  {
    id: "cls_8",
    name: "Campaign進行中クラスター",
    count: 1471,
    type: "opportunity" as const,
    priority: 55,
    characteristics: ["running_campaign有", "goal設定済", "施策実行中"],
    risks: [],
    opportunities: ["効果測定", "成功パターン抽出", "他クラスター展開"],
    userCount: 6543,
    insights: ["現在進行中のキャンペーンで改善施策を実行中"],
    recommendedActions: ["効果測定", "進捗モニタリング", "ベストプラクティス抽出"],
    recommendedContent: ["進捗レポート", "効果測定サマリー"],
    audienceScope: "Project Level",
    recommendedChannel: ["Email", "Dashboard"],
    recommendedActionType: ["Monitoring", "Analysis"],
    unresolvedRecipientRate: 10,
    preExecutionChecks: ["キャンペーン進捗確認", "目標達成状況確認"],
  },
];

// 優先度順にソート
const prioritizedClusters = [...clusters].sort((a, b) => b.priority - a.priority);

const clusterTypeColors = {
  risk: "border-red-500 bg-red-50",
  opportunity: "border-emerald-500 bg-emerald-50",
  stable: "border-blue-500 bg-blue-50",
};

const clusterTypeBadgeColors = {
  risk: "bg-red-500",
  opportunity: "bg-emerald-500",
  stable: "bg-blue-500",
};

// クラスター比較用データ
const getClusterComparisonData = (clusters: typeof prioritizedClusters) => {
  return clusters.slice(0, 5).map(cluster => ({
    name: cluster.name.split('クラスター')[0],
    priority: cluster.priority,
    count: cluster.count / 100,
    userCount: cluster.userCount / 1000,
    unresolvedRate: cluster.unresolvedRecipientRate,
  }));
};

export function ProjectsPortfolio() {
  // View state (Default: My Projects)
  const [currentView, setCurrentView] = useState("my");
  
  const [selectedCluster, setSelectedCluster] = useState(prioritizedClusters[0]);
  const [activeView, setActiveView] = useState("clusters");
  const [showProjectTable, setShowProjectTable] = useState(false);
  const [clusterViewMode, setClusterViewMode] = useState<"card" | "list">("card");

  // Mock current user (自分の担当判定用)
  const currentUserId = "user_1";

  // View definitions
  const views = [
    { value: "my", label: "My Projects", description: "自分の担当Project", isDefault: true },
    { value: "at-risk", label: "At Risk Projects", description: "リスクが高いProject" },
    { value: "opportunity", label: "Opportunity Projects", description: "機会が大きいProject" },
    { value: "all", label: "All Projects", description: "全Project" },
  ];

  // View configurations
  const viewConfig: Record<string, {
    subtitle: string;
    filterClusters: (cluster: typeof clusters[0]) => boolean;
    emptyState: { title: string; description: string; cta: { label: string; action: () => void } | null };
  }> = {
    my: {
      subtitle: "自分の担当Projectの状況と優先度を確認する",
      filterClusters: (cluster) => cluster.type !== "stable", // Mockフィルタ（実際はownerId等で判定）
      emptyState: {
        title: "担当Projectはまだありません",
        description: "Projectが割り当てられると、ここに表示されます",
        cta: { label: "All Projects を見る", action: () => setCurrentView("all") },
      },
    },
    "at-risk": {
      subtitle: "リスクが高いProjectを優先的に確認する",
      filterClusters: (cluster) => cluster.type === "risk",
      emptyState: {
        title: "現在、リスクが高いProjectはありません",
        description: "リスク条件に該当するProjectが発生すると、ここに表示されます",
        cta: { label: "My Projects を見る", action: () => setCurrentView("my") },
      },
    },
    opportunity: {
      subtitle: "機会が大きいProject群を把握する",
      filterClusters: (cluster) => cluster.type === "opportunity",
      emptyState: {
        title: "現在、大きな機会があるProjectはありません",
        description: "機会条件に該当するProjectが発生すると、ここに表示されます",
        cta: { label: "My Projects を見る", action: () => setCurrentView("my") },
      },
    },
    all: {
      subtitle: "すべてのProjectを横断して確認する",
      filterClusters: (cluster) => true,
      emptyState: {
        title: "Projectがまだ登録されていません",
        description: "Projectデータが同期されると、ここに表示されます",
        cta: null,
      },
    },
  };

  const config = viewConfig[currentView];
  const currentViewLabel = views.find(v => v.value === currentView)?.label || "";
  
  // Filter clusters by current view
  const filteredClusters = prioritizedClusters.filter(config.filterClusters);
  
  // Calculate summary based on filtered clusters
  const viewSummary = {
    totalProjects: filteredClusters.reduce((sum, c) => sum + c.count, 0),
    highRiskProjects: filteredClusters.filter(c => c.type === "risk").reduce((sum, c) => sum + c.count, 0),
    highOpportunityProjects: filteredClusters.filter(c => c.type === "opportunity").reduce((sum, c) => sum + c.count, 0),
    totalClusters: filteredClusters.length,
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Cross-project analytics" />
        
        <ScrollArea className="flex-1">
          <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
            
            {/* Header with Current View */}
            <ViewContextHeader
              pageName="Projects"
              currentView={currentViewLabel}
              subtitle={config.subtitle}
            />
            
            {/* View Switcher */}
            <ViewSwitcher
              currentView={currentView}
              views={views}
              onViewChange={setCurrentView}
            />
            
            {/* Summary Cards - View範囲で集計 */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="shadow-none border-slate-200">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-600">Total in {currentViewLabel}</span>
                  </div>
                  <div className="text-xl font-semibold text-slate-900">
                    {viewSummary.totalProjects.toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-none border-red-200">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-slate-600">At Risk in {currentViewLabel}</span>
                  </div>
                  <div className="text-xl font-semibold text-red-600">
                    {viewSummary.highRiskProjects.toLocaleString()}
                  </div>
                </CardContent>
              </Card>

            <Card className="shadow-none border-emerald-200">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-slate-600">Opportunity in {currentViewLabel}</span>
                </div>
                <div className="text-xl font-semibold text-emerald-600">
                  {viewSummary.highOpportunityProjects.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-none border-purple-200">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-4 h-4 text-purple-500" />
                  <span className="text-xs text-slate-600">Clusters in {currentViewLabel}</span>
                </div>
                <div className="text-xl font-semibold text-purple-600">
                  {viewSummary.totalClusters}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Check if filtered clusters are empty */}
          {filteredClusters.length === 0 ? (
            <ViewEmptyState
              title={config.emptyState.title}
              description={config.emptyState.description}
              currentView={currentViewLabel}
              cta={config.emptyState.cta}
            />
          ) : (
            <>
            {/* Main Content Area */}
            <div className="bg-white border rounded-lg shadow-sm">
          {/* Left: Filters / Cluster Conditions / Saved Views */}
          <div className="w-64 bg-white border-r overflow-auto">
            <div className="p-4">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="w-4 h-4 text-slate-600" />
                  <h3 className="font-semibold text-slate-900">View Selection</h3>
                </div>
                <p className="text-xs text-slate-600 mb-3">
                  傾向分析→クラスター選択→施策設計の流れで進みます
                </p>
                
                <Tabs defaultValue="clusters" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-3">
                    <TabsTrigger value="clusters" className="text-xs">Clusters</TabsTrigger>
                    <TabsTrigger value="filters" className="text-xs">Filters</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="clusters" className="space-y-2 mt-0">
                    <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                      <Bookmark className="w-3 h-3 mr-2" />
                      All Clusters
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                      <AlertTriangle className="w-3 h-3 mr-2 text-red-500" />
                      Risk Clusters
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                      <Target className="w-3 h-3 mr-2 text-emerald-500" />
                      Opportunity Clusters
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start text-xs">
                      <Users className="w-3 h-3 mr-2" />
                      Large Scale Clusters
                    </Button>
                  </TabsContent>
                  
                  <TabsContent value="filters" className="space-y-3 mt-0">
                    <div>
                      <Label className="text-xs font-medium mb-2 block">A-Phase</Label>
                      <div className="space-y-1.5">
                        {["Setup", "Activation", "Engagement", "Optimization"].map((phase) => (
                          <div key={phase} className="flex items-center gap-2">
                            <Checkbox id={`phase-${phase}`} className="h-3 w-3" />
                            <label htmlFor={`phase-${phase}`} className="text-xs text-slate-700">
                              {phase}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-xs font-medium mb-2 block">Signal Type</Label>
                      <div className="space-y-1.5">
                        {["Risk", "Opportunity", "Stable"].map((signal) => (
                          <div key={signal} className="flex items-center gap-2">
                            <Checkbox id={`signal-${signal}`} className="h-3 w-3" />
                            <label htmlFor={`signal-${signal}`} className="text-xs text-slate-700">
                              {signal}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-xs font-medium mb-2 block">Linkage Status</Label>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Checkbox id="linked" className="h-3 w-3" />
                          <label htmlFor="linked" className="text-xs text-slate-700">
                            Company Linked
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox id="unresolved" className="h-3 w-3" />
                          <label htmlFor="unresolved" className="text-xs text-slate-700">
                            Unresolved Linkage
                          </label>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-xs font-medium mb-2 block">Activity Status</Label>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Checkbox id="active" className="h-3 w-3" />
                          <label htmlFor="active" className="text-xs text-slate-700">
                            L30 Active
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox id="inactive" className="h-3 w-3" />
                          <label htmlFor="inactive" className="text-xs text-slate-700">
                            Inactive Users
                          </label>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <Separator className="my-4" />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Bookmark className="w-4 h-4 text-slate-600" />
                  <h3 className="font-semibold text-slate-900">Saved Views</h3>
                </div>
                <div className="space-y-1">
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                    チャーン懸念群
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                    アップセル候補群
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                    未活性化群
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                    高価値安定群
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Center: Distribution / Cluster Analysis / Cluster Comparison */}
          <div className="flex-1 overflow-auto p-6">
            <Tabs value={activeView} onValueChange={setActiveView} className="mb-6">
              <TabsList>
                <TabsTrigger value="distribution">Distribution</TabsTrigger>
                <TabsTrigger value="clusters">Cluster Analysis</TabsTrigger>
                <TabsTrigger value="comparison">Cluster Comparison</TabsTrigger>
              </TabsList>

              {/* Distribution View */}
              <TabsContent value="distribution" className="space-y-6 mt-6">
                {/* Phase Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">A-Phase Distribution</CardTitle>
                    <CardDescription>全Projectの現在フェーズ分布</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-6">
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={phaseDistribution}
                            cx="50%"
                            cy="40%"
                            labelLine={false}
                            label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                            outerRadius={70}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {phaseDistribution.map((entry, index) => (
                              <Cell key={`phase-dist-${entry.name}-${index}`} fill={entry.color} />
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
                      <div className="space-y-2">
                        {phaseDistribution.map((phase) => (
                          <div key={phase.name} className="flex items-center justify-between p-2 border rounded">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: phase.color }}></div>
                              <span className="text-sm font-medium">{phase.name}</span>
                            </div>
                            <span className="text-sm text-slate-600">{phase.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Health Score Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Health Score Distribution</CardTitle>
                    <CardDescription>Project健全性スコアの分布</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={healthScoreDistribution} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="range" 
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis 
                          tick={{ fontSize: 11 }}
                          width={40}
                        />
                        <Tooltip 
                          formatter={(value: number) => [`${value.toLocaleString()} projects`, 'Count']}
                          contentStyle={{ fontSize: '12px' }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {healthScoreDistribution.map((entry, index) => (
                            <Cell key={`health-dist-${entry.range}-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Signal Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Signal Distribution</CardTitle>
                    <CardDescription>Risk / Opportunity / Stable の割合</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-6">
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={signalDistribution}
                            cx="50%"
                            cy="40%"
                            labelLine={false}
                            label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                            outerRadius={70}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {signalDistribution.map((entry, index) => (
                              <Cell key={`signal-dist-${entry.name}-${index}`} fill={entry.color} />
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
                      <div className="space-y-2">
                        {signalDistribution.map((signal) => (
                          <div key={signal.name} className="flex items-center justify-between p-2 border rounded">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: signal.color }}></div>
                              <span className="text-sm font-medium">{signal.name}</span>
                            </div>
                            <span className="text-sm text-slate-600">{signal.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Clusters View */}
              <TabsContent value="clusters" className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex-1 mr-4">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                      <div className="text-xs text-blue-900">
                        <span className="font-semibold">優先度順で表示</span>しています。クラスターを選択→右パネルで推奨施策を確認→Audience Workspaceで詳細設計・実行を行います。
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={clusterViewMode === "card" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setClusterViewMode("card")}
                    >
                      <BarChart3 className="w-4 h-4 mr-1" />
                      Card
                    </Button>
                    <Button
                      variant={clusterViewMode === "list" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setClusterViewMode("list")}
                    >
                      <Layers className="w-4 h-4 mr-1" />
                      List
                    </Button>
                  </div>
                </div>

                {clusterViewMode === "card" ? (
                  <div className="grid grid-cols-2 gap-3">
                    {prioritizedClusters.map((cluster) => (
                      <Card
                        key={cluster.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedCluster.id === cluster.id ? "ring-2 ring-blue-500" : ""
                        }`}
                        onClick={() => setSelectedCluster(cluster)}
                      >
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-1.5 flex-1">
                              <h3 className="text-sm font-semibold text-slate-900 line-clamp-1">{cluster.name}</h3>
                              <Badge variant="outline" className="text-xs shrink-0">P:{cluster.priority}</Badge>
                            </div>
                            <Badge className={`${clusterTypeBadgeColors[cluster.type]} text-xs ml-2 shrink-0`}>
                              {cluster.type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <div className="flex items-center gap-1">
                              <Layers className="w-3 h-3 text-slate-400" />
                              <span className="font-semibold text-slate-900">{cluster.count.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-400" />
                              <span className="font-semibold text-slate-900">{cluster.userCount.toLocaleString()}</span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-2 pb-3 px-3">
                          <div className="space-y-1.5">
                            <div>
                              <div className="text-xs text-slate-600 mb-1">特徴</div>
                              <div className="flex flex-wrap gap-1">
                                {cluster.characteristics.slice(0, 2).map((char, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {char}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            {cluster.risks.length > 0 && (
                              <div>
                                <div className="text-xs text-red-700 mb-0.5">Risk</div>
                                <div className="text-xs text-slate-700 line-clamp-1">{cluster.risks[0]}</div>
                              </div>
                            )}
                            {cluster.opportunities.length > 0 && (
                              <div>
                                <div className="text-xs text-emerald-700 mb-0.5">Opportunity</div>
                                <div className="text-xs text-slate-700 line-clamp-1">{cluster.opportunities[0]}</div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {prioritizedClusters.map((cluster) => (
                          <div
                            key={cluster.id}
                            className={`p-3 cursor-pointer transition-all hover:bg-slate-50 ${
                              selectedCluster.id === cluster.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                            }`}
                            onClick={() => setSelectedCluster(cluster)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2 flex-1">
                                <h3 className="text-sm font-semibold text-slate-900">{cluster.name}</h3>
                                <Badge variant="outline" className="text-xs">P:{cluster.priority}</Badge>
                                <Badge className={`${clusterTypeBadgeColors[cluster.type]} text-xs`}>
                                  {cluster.type}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-1">
                                  <Layers className="w-3 h-3 text-slate-400" />
                                  <span className="font-semibold text-slate-900">{cluster.count.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Users className="w-3 h-3 text-slate-400" />
                                  <span className="font-semibold text-slate-900">{cluster.userCount.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-6 text-xs">
                              <div className="flex-1">
                                <span className="text-slate-600">特徴: </span>
                                <span className="text-slate-700">{cluster.characteristics.slice(0, 2).join(", ")}</span>
                              </div>
                              {cluster.risks.length > 0 && (
                                <div className="flex-1">
                                  <span className="text-red-700">Risk: </span>
                                  <span className="text-slate-700">{cluster.risks[0]}</span>
                                </div>
                              )}
                              {cluster.opportunities.length > 0 && (
                                <div className="flex-1">
                                  <span className="text-emerald-700">Opportunity: </span>
                                  <span className="text-slate-700">{cluster.opportunities[0]}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 個別Projectテーブル（折りたたみ） */}
                <Collapsible open={showProjectTable} onOpenChange={setShowProjectTable} className="mt-8">
                  <Card className="border-slate-200 bg-slate-50">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-slate-600" />
                          <span className="text-sm font-medium text-slate-700">
                            代表Project例（個別深掘り用）
                          </span>
                        </div>
                        {showProjectTable ? (
                          <ChevronUp className="w-4 h-4 text-slate-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-600" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-4 pb-4">
                      <div className="text-xs text-slate-600 mb-3">
                        選択クラスター「{selectedCluster.name}」の代表Project例
                      </div>
                      <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map((idx) => (
                          <Link
                            key={idx}
                            to={`/project/proj_${idx}?from=projects&cluster=${selectedCluster.id}`}
                            className="block p-3 bg-white border rounded hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm font-medium text-blue-600 mb-1">
                                  Project Example {idx}
                                </div>
                                <div className="text-xs text-slate-600">
                                  Health: 65 | Users: 45 | Phase: Setup
                                </div>
                              </div>
                              <ExternalLink className="w-4 h-4 text-slate-400" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </TabsContent>

              {/* Cluster Comparison View */}
              <TabsContent value="comparison" className="mt-6">
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-base">クラスター横断比較</CardTitle>
                    <CardDescription>どのクラスターから先に打つべきかを比較します</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <RadarChart data={getClusterComparisonData(prioritizedClusters)}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis />
                        <Radar name="優先度" dataKey="priority" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                        <Radar name="Project数 (×100)" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                        <Radar name="User数 (×1000)" dataKey="userCount" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                        <Radar name="未解決率 (%)" dataKey="unresolvedRate" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                        <Tooltip />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* 比較テーブル */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">優先度比較テーブル</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3 font-semibold text-slate-700">クラスター名</th>
                            <th className="text-center py-2 px-3 font-semibold text-slate-700">優先度</th>
                            <th className="text-center py-2 px-3 font-semibold text-slate-700">Project数</th>
                            <th className="text-center py-2 px-3 font-semibold text-slate-700">User数</th>
                            <th className="text-center py-2 px-3 font-semibold text-slate-700">Type</th>
                            <th className="text-center py-2 px-3 font-semibold text-slate-700">未解決率</th>
                            <th className="text-left py-2 px-3 font-semibold text-slate-700">推奨施策</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prioritizedClusters.slice(0, 5).map((cluster) => (
                            <tr
                              key={cluster.id}
                              className="border-b hover:bg-slate-50 cursor-pointer"
                              onClick={() => setSelectedCluster(cluster)}
                            >
                              <td className="py-3 px-3">
                                <div className="font-medium text-slate-900">{cluster.name}</div>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                  {cluster.priority}
                                </Badge>
                              </td>
                              <td className="py-3 px-3 text-center text-slate-700">
                                {cluster.count.toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-center text-slate-700">
                                {cluster.userCount.toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <Badge className={`text-xs ${clusterTypeBadgeColors[cluster.type]}`}>
                                  {cluster.type}
                                </Badge>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className={`font-semibold ${
                                  cluster.unresolvedRecipientRate > 20 ? 'text-red-600' :
                                  cluster.unresolvedRecipientRate > 10 ? 'text-orange-600' :
                                  'text-emerald-600'
                                }`}>
                                  {cluster.unresolvedRecipientRate}%
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex flex-wrap gap-1">
                                  {cluster.recommendedActionType.slice(0, 2).map((action, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {action}
                                    </Badge>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Cluster Detail with Action Preparation */}
          <div className="w-[420px] bg-white border-l overflow-auto">
            <ScrollArea className="h-full">
              <div className="p-6">
                {/* クラスター選択状態の明確化 */}
                <div className={`mb-6 p-4 rounded-lg border-2 ${clusterTypeColors[selectedCluster.type]}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-5 h-5 text-slate-700" />
                    <h2 className="text-lg font-semibold text-slate-900">施策準備ワークスペース</h2>
                  </div>
                  <div className="text-xs text-slate-600 mb-3">
                    このクラスターに施策を打つ準備をします
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-1 h-6 rounded ${clusterTypeColors[selectedCluster.type].split(" ")[0]}`}></div>
                    <h3 className="font-semibold text-slate-900">{selectedCluster.name}</h3>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-1">
                      <Layers className="w-4 h-4 text-slate-500" />
                      <span className="font-semibold">{selectedCluster.count.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-slate-500" />
                      <span className="font-semibold">{selectedCluster.userCount.toLocaleString()}</span>
                    </div>
                    <Badge className={`${clusterTypeBadgeColors[selectedCluster.type]}`}>
                      P:{selectedCluster.priority}
                    </Badge>
                  </div>
                </div>

                <Separator className="my-4" />

                {/* 想定Audience Scope */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-600" />
                    想定Audience Scope
                  </h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-sm font-medium text-blue-900 mb-2">
                      {selectedCluster.audienceScope}
                    </div>
                    <div className="text-xs text-blue-700">
                      {selectedCluster.audienceScope === "Project Level" && "各Project単位で施策を実施"}
                      {selectedCluster.audienceScope === "User Level" && "個別User単位で施策を実施"}
                      {selectedCluster.audienceScope === "Company Level" && "Company単位で施策を実施"}
                      {selectedCluster.audienceScope === "Project + User Level" && "Project内のUser群に施策を実施"}
                      {selectedCluster.audienceScope === "Company + Project Level" && "Company配下のProject群に施策を実施"}
                    </div>
                  </div>
                </div>

                {/* 推奨チャネル */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">推奨チャネル</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedCluster.recommendedChannel.map((channel, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs bg-slate-50">
                        {channel === "Email" && <Mail className="w-3 h-3 mr-1" />}
                        {channel === "Slack" && <MessageSquare className="w-3 h-3 mr-1" />}
                        {channel === "Meeting" && <Users className="w-3 h-3 mr-1" />}
                        {channel}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* 推奨Actionタイプ */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">推奨Actionタイプ</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedCluster.recommendedActionType.map((actionType, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                        <Edit3 className="w-3 h-3 mr-1" />
                        {actionType}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Unresolved Recipient懸念 */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <XCircle className={`w-4 h-4 ${
                      selectedCluster.unresolvedRecipientRate > 20 ? 'text-red-600' :
                      selectedCluster.unresolvedRecipientRate > 10 ? 'text-orange-600' :
                      'text-emerald-600'
                    }`} />
                    Unresolved Recipient懸念
                  </h3>
                  <Card className={`${
                    selectedCluster.unresolvedRecipientRate > 20 ? 'border-red-200 bg-red-50' :
                    selectedCluster.unresolvedRecipientRate > 10 ? 'border-orange-200 bg-orange-50' :
                    'border-emerald-200 bg-emerald-50'
                  }`}>
                    <CardContent className="pt-4 pb-3">
                      <div className="text-2xl font-semibold mb-1 ${
                        selectedCluster.unresolvedRecipientRate > 20 ? 'text-red-900' :
                        selectedCluster.unresolvedRecipientRate > 10 ? 'text-orange-900' :
                        'text-emerald-900'
                      }">
                        {selectedCluster.unresolvedRecipientRate}%
                      </div>
                      <div className="text-xs text-slate-700">
                        の宛先が未解決の可能性があります
                      </div>
                      {selectedCluster.unresolvedRecipientRate > 10 && (
                        <div className="mt-2 text-xs text-slate-600">
                          Audience Workspaceで詳細確認が必要です
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* 実行前確認事項 */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4 text-purple-600" />
                    実行前に確認すべきこと
                  </h3>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
                    {selectedCluster.preExecutionChecks.map((check, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-purple-900">
                        <CheckCircle2 className="w-3 h-3 text-purple-600 mt-0.5 flex-shrink-0" />
                        <span>{check}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* 代表特徴 */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">代表特徴</h3>
                  <div className="space-y-1">
                    {selectedCluster.characteristics.map((char, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-3 h-3 text-blue-500" />
                        <span className="text-slate-700">{char}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 主なRisk */}
                {selectedCluster.risks.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      主なRisk
                    </h3>
                    <div className="space-y-1">
                      {selectedCluster.risks.map((risk, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                          <span className="text-slate-700">{risk}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 主なOpportunity */}
                {selectedCluster.opportunities.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-emerald-700 mb-2 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      主なOpportunity
                    </h3>
                    <div className="space-y-1">
                      {selectedCluster.opportunities.map((opp, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                          <span className="text-slate-700">{opp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator className="my-4" />

                {/* 推奨Insight */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    推奨Insight
                  </h3>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
                    {selectedCluster.insights.map((insight, idx) => (
                      <div key={idx} className="text-xs text-purple-900">{insight}</div>
                    ))}
                  </div>
                </div>

                {/* 推奨Action */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">推奨Action</h3>
                  <div className="space-y-2">
                    {selectedCluster.recommendedActions.map((action, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-200 rounded p-2">
                        <CheckCircle2 className="w-3 h-3 text-blue-600 flex-shrink-0" />
                        <span className="text-blue-900">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 推奨Content */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">推奨Content / Template</h3>
                  <div className="space-y-2">
                    {selectedCluster.recommendedContent.map((content, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs bg-slate-50 border rounded p-2">
                        <Send className="w-3 h-3 text-slate-600 flex-shrink-0" />
                        <span className="text-slate-700">{content}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* 次の推奨オペレーション */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">次の推奨オペレーション</h3>
                  <div className="space-y-2">
                    <div className="text-xs text-slate-600 mb-2">
                      ※ 施策の詳細設計・対象確認・実行はAudience Workspaceで行います
                    </div>
                  </div>
                </div>

                {/* Audience Workspaceへ進む */}
                <Link to={`/audience?cluster=${selectedCluster.id}`} className="block">
                  <Button className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-md">
                    <Users className="w-4 h-4 mr-2" />
                    施策設計へ進む（Audience Workspace）
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <div className="text-xs text-slate-600 mt-2 text-center">
                  対象User確認、Insight生成、Action作成、実行レビューを行います
                </div>
              </div>
            </ScrollArea>
          </div>
          
          </>
        )}
        </div>
      </ScrollArea>
      </div>
    </div>
  );
}