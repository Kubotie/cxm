import { useState } from "react";
import { useParams, Link } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Building2,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target,
  Activity,
  Send,
  CheckSquare,
  FileText,
  ArrowRight,
  Sparkles,
  Database,
  Calendar,
  Mail,
  Info,
  Search,
} from "lucide-react";

// モックデータ
const projectData = {
  id: "proj_1",
  name: "プロジェクトA",
  company: "株式会社テクノロジーイノベーション",
  companyId: "1",
  phase: "Activation",
  healthScore: 58,
  breadthScore: 42,
  depthScore: 35,
  habituation: "悪化",
  l30_active: 8,
  totalUsers: 24,
  activeUsers: 12,
  adminUsers: 3,
  createdDate: "2025-11-15",
  lastActivityDate: "2026-03-10",
  cluster: "利用低下クラスター",
  clusterType: "risk",
};

const signals = [
  {
    id: "sig_1",
    type: "risk" as const,
    severity: "high" as const,
    title: "アクティビティ急落",
    description: "過去30日でl30_activeが前月比65%低下",
    timestamp: "2026-03-09 14:30",
    evidenceCount: 12,
  },
  {
    id: "sig_2",
    type: "risk" as const,
    severity: "medium" as const,
    title: "定着スコア悪化",
    description: "habituation_statusが3週連続で低下",
    timestamp: "2026-03-08 10:15",
    evidenceCount: 8,
  },
  {
    id: "sig_3",
    type: "opportunity" as const,
    severity: "medium" as const,
    title: "管理者の関心維持",
    description: "Admin権限ユーザーからの問い合わせ継続",
    timestamp: "2026-03-07 16:00",
    evidenceCount: 5,
  },
];

const evidence = [
  {
    id: "ev_1",
    type: "usage" as const,
    title: "ログイン頻度低下",
    description: "週次ログイン回数が5回から2回に減少",
    timestamp: "2026-03-10 09:30",
    source: "Product Analytics",
    impact: "high",
  },
  {
    id: "ev_2",
    type: "support" as const,
    title: "管理者からの問い合わせ",
    description: "「使い方がわからない」という問い合わせが増加",
    timestamp: "2026-03-09 14:20",
    source: "Zendesk",
    impact: "medium",
  },
  {
    id: "ev_3",
    type: "engagement" as const,
    title: "機能利用範囲の縮小",
    description: "利用機能が8つから3つに減少",
    timestamp: "2026-03-08 11:45",
    source: "Product Analytics",
    impact: "high",
  },
];

const users = [
  {
    id: "u1",
    name: "田中太郎",
    email: "tanaka@tech-innov.jp",
    permission: "admin",
    status: "inactive",
    lastActive: "2026-02-15",
    userStage: "At-Risk",
    l30_active: 2,
    habituation: "低",
  },
  {
    id: "u2",
    name: "山田花子",
    email: "yamada@tech-innov.jp",
    permission: "member",
    status: "active",
    lastActive: "2026-03-10",
    userStage: "Engaged",
    l30_active: 15,
    habituation: "中",
  },
  {
    id: "u3",
    name: "佐藤次郎",
    email: "sato@tech-innov.jp",
    permission: "admin",
    status: "inactive",
    lastActive: "2026-02-20",
    userStage: "At-Risk",
    l30_active: 1,
    habituation: "低",
  },
  {
    id: "u4",
    name: "鈴木三郎",
    email: "suzuki@tech-innov.jp",
    permission: "member",
    status: "active",
    lastActive: "2026-03-09",
    userStage: "Active",
    l30_active: 8,
    habituation: "中",
  },
  {
    id: "u5",
    name: "高橋美咲",
    email: "takahashi@tech-innov.jp",
    permission: "member",
    status: "inactive",
    lastActive: "2026-03-01",
    userStage: "At-Risk",
    l30_active: 3,
    habituation: "低",
  },
];

const recommendedActions = [
  {
    id: "act_1",
    type: "urgent",
    title: "緊急ヘルスチェックミーティング",
    description: "Admin権限ユーザーとの1on1で利用状況と課題をヒアリング",
    targetUsers: ["田中太郎", "佐藤次郎"],
    estimatedImpact: "高",
  },
  {
    id: "act_2",
    type: "training",
    title: "再トレーニングセッション実施",
    description: "基本機能の使い方を再度トレーニング",
    targetUsers: ["全メンバー"],
    estimatedImpact: "中",
  },
  {
    id: "act_3",
    type: "engagement",
    title: "活用事例の共有",
    description: "他社の成功事例を共有し、活用イメージを提供",
    targetUsers: ["管理者"],
    estimatedImpact: "中",
  },
];

const recommendedContent = [
  {
    id: "cnt_1",
    channel: "Email",
    title: "利用状況確認と支援提案",
    description: "現在の利用状況をフィードバックし、支援を提案",
    targetUsers: 3,
    status: "draft",
  },
  {
    id: "cnt_2",
    channel: "Slack",
    title: "活用Tipsの定期配信",
    description: "週次で簡単な活用Tipsを配信",
    targetUsers: 24,
    status: "template_available",
  },
];

const activityTimeline = [
  {
    id: "tl_1",
    date: "2026-03-10",
    type: "evidence",
    title: "ログイン頻度低下を検出",
    icon: AlertTriangle,
    color: "text-red-600",
  },
  {
    id: "tl_2",
    date: "2026-03-09",
    type: "support",
    title: "管理者から問い合わせ",
    icon: Mail,
    color: "text-blue-600",
  },
  {
    id: "tl_3",
    date: "2026-03-08",
    type: "signal",
    title: "Risk Signal発生",
    icon: AlertTriangle,
    color: "text-red-600",
  },
  {
    id: "tl_4",
    date: "2026-03-05",
    type: "activity",
    title: "トレーニングセッション実施",
    icon: CheckCircle2,
    color: "text-green-600",
  },
];

export function Project() {
  const { projectId } = useParams();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Project" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1800px] mx-auto p-6">
            {/* Project Header */}
            <div className="bg-white border rounded-lg p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-semibold text-slate-900">{projectData.name}</h1>
                    <Badge
                      className={`${
                        projectData.clusterType === "risk" ? "bg-red-500" : "bg-blue-500"
                      }`}
                    >
                      {projectData.phase}
                    </Badge>
                    {projectData.healthScore < 60 && (
                      <Badge className="bg-red-500">At Risk</Badge>
                    )}
                  </div>
                  <Link
                    to={`/company/${projectData.companyId}`}
                    className="flex items-center gap-2 text-slate-600 hover:text-blue-600 hover:underline"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>{projectData.company}</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="flex gap-2">
                  <Link to={`/audience?project=${projectId}`}>
                    <Button variant="outline" size="sm">
                      <Users className="w-4 h-4 mr-2" />
                      Audience作成
                    </Button>
                  </Link>
                  <Link to={`/outbound?project=${projectId}`}>
                    <Button size="sm">
                      <Send className="w-4 h-4 mr-2" />
                      Outbound起票
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-6 gap-4">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-600 mb-1">Health Score</div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        projectData.healthScore >= 80
                          ? "bg-green-500"
                          : projectData.healthScore >= 60
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                    ></div>
                    <span className="text-xl font-semibold">{projectData.healthScore}</span>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-600 mb-1">Breadth Score</div>
                  <div className="text-xl font-semibold">{projectData.breadthScore}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-600 mb-1">Depth Score</div>
                  <div className="text-xl font-semibold">{projectData.depthScore}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-600 mb-1">L30 Active</div>
                  <div className="text-xl font-semibold">{projectData.l30_active}日</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-600 mb-1">Total Users</div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4 text-slate-500" />
                    <span className="text-xl font-semibold">{projectData.totalUsers}</span>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-600 mb-1">Active Users</div>
                  <div className="flex items-center gap-1">
                    <Activity className="w-4 h-4 text-green-500" />
                    <span className="text-xl font-semibold">{projectData.activeUsers}</span>
                  </div>
                </div>
              </div>

              {/* Cluster Info */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <Database className="w-4 h-4 text-purple-500" />
                  <span className="text-slate-600">所属クラスター:</span>
                  <Link
                    to={`/projects?cluster=${projectData.cluster}`}
                    className="font-medium text-slate-900 hover:text-blue-600 hover:underline"
                  >
                    {projectData.cluster}
                  </Link>
                  <Badge variant="outline" className="text-xs">
                    同クラスター: 1,847件
                  </Badge>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="signals">Signals & Evidence</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="actions">推奨Actions</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview">
                <div className="grid grid-cols-2 gap-6">
                  {/* Signals Summary */}
                  <div className="bg-white border rounded-lg">
                    <div className="p-4 border-b">
                      <h3 className="font-semibold text-slate-900">Signals</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {signals.map((signal) => (
                        <div
                          key={signal.id}
                          className={`border rounded-lg p-3 ${
                            signal.type === "risk"
                              ? "border-red-200 bg-red-50"
                              : "border-emerald-200 bg-emerald-50"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {signal.type === "risk" ? (
                              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <div className="font-medium text-sm text-slate-900 mb-1">
                                {signal.title}
                              </div>
                              <p className="text-xs text-slate-700 mb-2">{signal.description}</p>
                              <div className="flex items-center justify-between text-xs text-slate-600">
                                <span>{signal.timestamp}</span>
                                <span>Evidence: {signal.evidenceCount}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Actions */}
                  <div className="bg-white border rounded-lg">
                    <div className="p-4 border-b">
                      <h3 className="font-semibold text-slate-900">推奨Actions</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {recommendedActions.map((action) => (
                        <div key={action.id} className="border rounded-lg p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="font-medium text-sm text-slate-900 mb-1">
                                {action.title}
                              </div>
                              <p className="text-xs text-slate-600 mb-2">{action.description}</p>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  対象: {action.targetUsers.join(", ")}
                                </Badge>
                                <Badge
                                  className={`text-xs ${
                                    action.estimatedImpact === "高" ? "bg-red-500" : "bg-orange-500"
                                  }`}
                                >
                                  Impact: {action.estimatedImpact}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2 border-t">
                            <Link to="/actions" className="flex-1">
                              <Button variant="outline" size="sm" className="w-full text-xs">
                                <CheckSquare className="w-3 h-3 mr-1" />
                                Actions作成
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Signals & Evidence Tab */}
              <TabsContent value="signals">
                <div className="grid grid-cols-2 gap-6">
                  {/* All Signals */}
                  <div className="bg-white border rounded-lg">
                    <div className="p-4 border-b">
                      <h3 className="font-semibold text-slate-900">Signals</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {signals.map((signal) => (
                        <div
                          key={signal.id}
                          className={`border rounded-lg p-3 ${
                            signal.type === "risk"
                              ? "border-red-200 bg-red-50"
                              : "border-emerald-200 bg-emerald-50"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {signal.type === "risk" ? (
                              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm text-slate-900">
                                  {signal.title}
                                </span>
                                <Badge
                                  className={`text-xs ${
                                    signal.severity === "high" ? "bg-red-500" : "bg-orange-500"
                                  }`}
                                >
                                  {signal.severity}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-700 mb-2">{signal.description}</p>
                              <div className="flex items-center justify-between text-xs text-slate-600">
                                <span>{signal.timestamp}</span>
                                <span>Evidence: {signal.evidenceCount}件</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Evidence */}
                  <div className="bg-white border rounded-lg">
                    <div className="p-4 border-b">
                      <h3 className="font-semibold text-slate-900">Evidence</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {evidence.map((ev) => (
                        <div key={ev.id} className="border rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <Database className="w-4 h-4 text-blue-600 mt-0.5" />
                            <div className="flex-1">
                              <div className="font-medium text-sm text-slate-900 mb-1">
                                {ev.title}
                              </div>
                              <p className="text-xs text-slate-700 mb-2">{ev.description}</p>
                              <div className="flex items-center justify-between text-xs text-slate-600">
                                <span>{ev.source}</span>
                                <span>{ev.timestamp}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Users Tab */}
              <TabsContent value="users">
                <div className="bg-white border rounded-lg">
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-900">Users</h3>
                      <Badge variant="outline" className="text-xs">
                        {users.length}名
                      </Badge>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="名前、Emailで検索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>権限</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>L30活動</TableHead>
                        <TableHead>定着度</TableHead>
                        <TableHead>最終活動</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium text-sm">{user.name}</div>
                              <div className="text-xs text-slate-500">{user.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                user.permission === "admin" ? "bg-purple-50" : ""
                              }`}
                            >
                              {user.permission}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.status === "active" ? (
                              <Badge className="text-xs bg-green-500">Active</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-slate-100">
                                Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-xs ${
                                user.userStage === "At-Risk"
                                  ? "bg-red-500"
                                  : user.userStage === "Engaged"
                                  ? "bg-green-500"
                                  : "bg-blue-500"
                              }`}
                            >
                              {user.userStage}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{user.l30_active}日</TableCell>
                          <TableCell className="text-sm">{user.habituation}</TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {user.lastActive}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Actions Tab */}
              <TabsContent value="actions">
                <div className="grid grid-cols-2 gap-6">
                  {/* Recommended Actions */}
                  <div className="bg-white border rounded-lg">
                    <div className="p-4 border-b">
                      <h3 className="font-semibold text-slate-900">推奨Actions</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {recommendedActions.map((action) => (
                        <div key={action.id} className="border rounded-lg p-3">
                          <div className="font-medium text-sm text-slate-900 mb-1">
                            {action.title}
                          </div>
                          <p className="text-xs text-slate-600 mb-2">{action.description}</p>
                          <div className="flex items-center gap-2 mb-3">
                            <Badge variant="outline" className="text-xs">
                              {action.targetUsers.join(", ")}
                            </Badge>
                            <Badge
                              className={`text-xs ${
                                action.estimatedImpact === "高" ? "bg-red-500" : "bg-orange-500"
                              }`}
                            >
                              Impact: {action.estimatedImpact}
                            </Badge>
                          </div>
                          <Link to="/actions">
                            <Button variant="outline" size="sm" className="w-full text-xs">
                              <CheckSquare className="w-3 h-3 mr-1" />
                              Actions作成
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Content */}
                  <div className="bg-white border rounded-lg">
                    <div className="p-4 border-b">
                      <h3 className="font-semibold text-slate-900">推奨Content</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {recommendedContent.map((content) => (
                        <div key={content.id} className="border rounded-lg p-3">
                          <div className="flex items-start gap-2 mb-2">
                            <FileText className="w-4 h-4 text-blue-600 mt-0.5" />
                            <div className="flex-1">
                              <div className="font-medium text-sm text-slate-900 mb-1">
                                {content.title}
                              </div>
                              <p className="text-xs text-slate-600 mb-2">{content.description}</p>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {content.channel}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {content.targetUsers}名
                                </Badge>
                                {content.status === "draft" && (
                                  <Badge variant="outline" className="text-xs bg-slate-100">
                                    Draft
                                  </Badge>
                                )}
                                {content.status === "template_available" && (
                                  <Badge className="text-xs bg-blue-500">Template有</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Link to="/outbound">
                            <Button variant="outline" size="sm" className="w-full text-xs">
                              <Send className="w-3 h-3 mr-1" />
                              Outbound起票
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Timeline Tab */}
              <TabsContent value="timeline">
                <div className="bg-white border rounded-lg">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold text-slate-900">Activity Timeline</h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {activityTimeline.map((item, index) => (
                        <div key={item.id} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center bg-white ${
                                item.color === "text-red-600"
                                  ? "border-red-200"
                                  : item.color === "text-blue-600"
                                  ? "border-blue-200"
                                  : "border-green-200"
                              }`}
                            >
                              <item.icon className={`w-4 h-4 ${item.color}`} />
                            </div>
                            {index < activityTimeline.length - 1 && (
                              <div className="w-0.5 h-12 bg-slate-200"></div>
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-sm font-medium text-slate-900">
                                {item.title}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {item.type}
                              </Badge>
                            </div>
                            <div className="text-xs text-slate-500">{item.date}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
