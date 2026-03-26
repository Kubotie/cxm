import { useState } from "react";
import { useSearchParams, Link } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import {
  Users,
  Sparkles,
  Target,
  FileText,
  Send,
  Database,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Mail,
  MessageSquare,
  Edit3,
  Layers,
  Filter,
  Info,
  Eye,
  Zap,
  ShieldCheck,
  UserCheck,
  Clock,
  Building2,
  ExternalLink,
} from "lucide-react";
import { BulkActionDrawer } from "../components/audience/bulk-action-drawer";
import { BulkContentDrawer } from "../components/audience/bulk-content-drawer";

// モックデータ - Project Topから流入したクラスター情報
const sourceClusterInfo = {
  id: "cls_1",
  name: "利用低下クラスター",
  projectCount: 1847,
  userCount: 12456,
  type: "risk" as const,
  characteristics: ["l30_active低下", "habituation悪化", "depth_score減少"],
  risks: ["チャーン懸念", "利用停止リスク", "更新拒否可能性"],
  opportunities: [],
  audienceScope: "Project Level" as const,
  recommendedChannels: ["Email", "Slack"],
  priority: 95,
  fromProjectTop: true,
};

const commonInsights = [
  {
    id: "ins_1",
    type: "risk" as const,
    title: "過去30日でアクティビティが急激に低下",
    description: "このクラスターの78%のProjectで、l30_activeが前月比50%以上低下しています。利用停止やチャーンのリスクが高まっています。",
    evidenceCount: 1423,
    affectedProjects: 1439,
    affectedUsers: 8923,
  },
  {
    id: "ins_2",
    type: "risk" as const,
    title: "定着スコアの継続的な悪化傾向",
    description: "habituation_statusが3ヶ月連続で悪化しているProjectが多数確認されています。ユーザーの習慣化が進んでいません。",
    evidenceCount: 987,
    affectedProjects: 1124,
    affectedUsers: 6234,
  },
  {
    id: "ins_3",
    type: "opportunity" as const,
    title: "管理者の関心度は維持されている",
    description: "アクティビティは低下していますが、管理者からの問い合わせや関心は維持されており、適切な支援で回復可能性があります。",
    evidenceCount: 234,
    affectedProjects: 876,
    affectedUsers: 2345,
  },
];

const targetUsers = [
  { 
    id: "u1", 
    name: "田中太郎", 
    email: "tanaka@tech-innov.jp", 
    project: "プロジェクトA", 
    company: "テックイノベーション株式会社",
    permission: "admin", 
    status: "inactive",
    lastActive: "2026-02-15",
    userStage: "At-Risk",
    companyLinked: true,
    unresolvedLinkage: false,
    recommendedSegment: "Churn Prevention",
    l30_active: 2,
  },
  { 
    id: "u2", 
    name: "山田花子", 
    email: "yamada@tech-innov.jp", 
    project: "プロジェクトA", 
    company: "テックイノベーション株式会社",
    permission: "member", 
    status: "active",
    lastActive: "2026-03-10",
    userStage: "Engaged",
    companyLinked: true,
    unresolvedLinkage: false,
    recommendedSegment: "Engagement",
    l30_active: 15,
  },
  { 
    id: "u3", 
    name: "佐藤次郎", 
    email: "sato@digital-mkt.jp", 
    project: "データ分析基盤構築", 
    company: "デジタルマーケティング株式会社",
    permission: "admin", 
    status: "inactive",
    lastActive: "2026-02-20",
    userStage: "At-Risk",
    companyLinked: true,
    unresolvedLinkage: false,
    recommendedSegment: "Churn Prevention",
    l30_active: 1,
  },
  { 
    id: "u4", 
    name: "鈴木三郎", 
    email: "suzuki@cloud-infra.jp", 
    project: "全社DX推進", 
    company: "クラウドインフラ株式会社",
    permission: "admin", 
    status: "inactive",
    lastActive: "2026-02-25",
    userStage: "At-Risk",
    companyLinked: true,
    unresolvedLinkage: false,
    recommendedSegment: "Churn Prevention",
    l30_active: 3,
  },
  { 
    id: "u5", 
    name: "小林四郎", 
    email: "kobayashi@cloud-infra.jp", 
    project: "全社DX推進", 
    company: "クラウドインフラ株式会社",
    permission: "member", 
    status: "active",
    lastActive: "2026-03-11",
    userStage: "Growing",
    companyLinked: true,
    unresolvedLinkage: false,
    recommendedSegment: "Engagement",
    l30_active: 12,
  },
  { 
    id: "u6", 
    name: "伊藤五郎", 
    email: "ito@enterprise.jp", 
    project: "営業支援システム", 
    company: "エンタープライズ株式会社",
    permission: "admin", 
    status: "inactive",
    lastActive: "2026-02-18",
    userStage: "At-Risk",
    companyLinked: true,
    unresolvedLinkage: false,
    recommendedSegment: "Churn Prevention",
    l30_active: 2,
  },
  { 
    id: "u7", 
    name: "渡辺六郎", 
    email: "watanabe@solutions.jp", 
    project: "カスタマーサポート", 
    company: "ソリューションズ株式会社",
    permission: "member", 
    status: "active",
    lastActive: "2026-03-12",
    userStage: "Engaged",
    companyLinked: true,
    unresolvedLinkage: false,
    recommendedSegment: "Engagement",
    l30_active: 18,
  },
  { 
    id: "u8", 
    name: "高橋七郎", 
    email: "", 
    project: "プロジェクトB", 
    company: "",
    permission: "member", 
    status: "inactive",
    lastActive: "2026-01-30",
    userStage: "Dormant",
    companyLinked: false,
    unresolvedLinkage: true,
    recommendedSegment: "Data Quality",
    l30_active: 0,
  },
  { 
    id: "u9", 
    name: "中村八郎", 
    email: "", 
    project: "マーケティングPJ", 
    company: "",
    permission: "admin", 
    status: "inactive",
    lastActive: "2026-02-05",
    userStage: "At-Risk",
    companyLinked: false,
    unresolvedLinkage: true,
    recommendedSegment: "Data Quality",
    l30_active: 1,
  },
];

const resolvedUsers = targetUsers.filter(u => !u.unresolvedLinkage);
const unresolvedUsers = targetUsers.filter(u => u.unresolvedLinkage);

const recommendedActions = [
  {
    id: "act_1",
    title: "利用状況ヒアリングMTGの実施",
    type: "Meeting",
    description: "各Project管理者に対して、利用低下の原因特定と課題把握のためのMTGを実施します。",
    priority: "High",
  },
  {
    id: "act_2",
    title: "緊急ヘルスチェック依頼",
    type: "Email",
    description: "利用状況の確認と、困りごとがないかを確認するメールを送信します。",
    priority: "High",
  },
  {
    id: "act_3",
    title: "再トレーニング提供",
    type: "Training",
    description: "活用が停滞しているユーザーに対して、基本機能の再トレーニングを提供します。",
    priority: "Medium",
  },
];

const recommendedTemplates = [
  {
    id: "tpl_1",
    name: "ヘルスチェック依頼Email",
    channel: "Email",
    useCase: "利用低下時の状況確認",
  },
  {
    id: "tpl_2",
    name: "活用Tips Slack通知",
    channel: "Slack",
    useCase: "活用促進のヒント配信",
  },
  {
    id: "tpl_3",
    name: "再トレーニング案内",
    channel: "Email",
    useCase: "トレーニング再受講の案内",
  },
];

const preExecutionChecks = [
  "管理者連絡先が最新であることを確認",
  "最終活動日が正確に記録されていることを確認",
  "契約更新日を確認し、重要タイミングを把握",
  "Unresolved Recipientsの扱いを決定",
  "送信対象から除外すべきUserがいないか確認",
  "テンプレートの文面が対象に適しているか確認",
];

export function AudienceWorkspace() {
  const [searchParams] = useSearchParams();
  const clusterId = searchParams.get("cluster");

  const [activeTab, setActiveTab] = useState("users");
  const [selectedUsers, setSelectedUsers] = useState<string[]>(resolvedUsers.map(u => u.id));
  
  // 4つの異なるUI制御
  const [bulkActionDrawerOpen, setBulkActionDrawerOpen] = useState(false);
  const [bulkContentDrawerOpen, setBulkContentDrawerOpen] = useState(false);

  const handleToggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Cross-project analytics" />
        
        {/* 施策対象サマリー（上部） */}
        <div className="bg-white border-b">
          <div className="px-6 py-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Link to="/projects">
                  <Button variant="ghost" size="sm" className="h-8">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Project Portfolio
                  </Button>
                </Link>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-600" />
                  <h1 className="text-lg font-semibold text-slate-900">Audience Workspace</h1>
                  <Badge className="bg-purple-600 text-xs">施策設計</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Info className="w-3 h-3" />
                <span>クラスターから流入 → 施策設計 → 実行</span>
              </div>
            </div>

            {/* 選択中クラスター情報 - コンパクト版 */}
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-red-700" />
                    <h2 className="font-semibold text-slate-900">{sourceClusterInfo.name}</h2>
                    <Badge className="bg-red-600 text-white text-xs">P:{sourceClusterInfo.priority}</Badge>
                    <Badge className="bg-red-500 text-white text-xs">RISK</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600">Projects:</span>
                      <span className="font-semibold text-slate-900">{sourceClusterInfo.projectCount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600">Users:</span>
                      <span className="font-semibold text-slate-900">{sourceClusterInfo.userCount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600">Resolved:</span>
                      <span className="font-semibold text-emerald-600">{resolvedUsers.length}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600">Unresolved:</span>
                      <span className="font-semibold text-red-600">{unresolvedUsers.length}</span>
                    </div>
                    <Separator orientation="vertical" className="h-4" />
                    <div className="flex items-center gap-1">
                      <span className="text-slate-600">Scope:</span>
                      <Badge variant="outline" className="text-xs bg-white">{sourceClusterInfo.audienceScope}</Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">特徴:</span>
                    <div className="flex gap-1">
                      {sourceClusterInfo.characteristics.slice(0, 2).map((char, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs bg-white">
                          {char}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-800">Risk:</span>
                    <span className="text-red-900">{sourceClusterInfo.risks[0]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">推奨チャネル:</span>
                    <div className="flex gap-1">
                      {sourceClusterInfo.recommendedChannels.map((ch, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs bg-white">
                          {ch}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <main className="flex-1 overflow-hidden flex">
          {/* Left: Cluster Context & Filters */}
          <div className="w-72 bg-white border-r overflow-auto">
            <div className="p-4">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="w-4 h-4 text-slate-600" />
                  <h3 className="font-semibold text-slate-900">クラスター文脈</h3>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <div className="text-xs text-blue-900 mb-2">
                    <span className="font-semibold">Project Top</span>から選択されたクラスター
                  </div>
                  <div className="text-sm font-medium text-blue-900">
                    {sourceClusterInfo.name}
                  </div>
                </div>
                
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <span className="text-slate-600">Type</span>
                    <Badge className="bg-red-500 text-xs">Risk</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <span className="text-slate-600">Priority</span>
                    <span className="font-semibold text-slate-900">{sourceClusterInfo.priority}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <span className="text-slate-600">Projects</span>
                    <span className="font-semibold text-slate-900">
                      {sourceClusterInfo.projectCount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-slate-600" />
                  <h3 className="font-semibold text-slate-900">対象User絞り込み</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-2 block">User Stage</label>
                    <div className="space-y-1.5">
                      {["At-Risk", "Engaged", "Growing", "Dormant"].map((stage) => (
                        <div key={stage} className="flex items-center gap-2">
                          <Checkbox id={`stage-${stage}`} className="h-3 w-3" defaultChecked={stage === "At-Risk"} />
                          <label htmlFor={`stage-${stage}`} className="text-xs text-slate-700">
                            {stage}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-2 block">Permission</label>
                    <div className="space-y-1.5">
                      {["admin", "member"].map((perm) => (
                        <div key={perm} className="flex items-center gap-2">
                          <Checkbox id={`perm-${perm}`} className="h-3 w-3" defaultChecked />
                          <label htmlFor={`perm-${perm}`} className="text-xs text-slate-700">
                            {perm}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-2 block">Status</label>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Checkbox id="status-active" className="h-3 w-3" defaultChecked />
                        <label htmlFor="status-active" className="text-xs text-slate-700">
                          Active
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="status-inactive" className="h-3 w-3" defaultChecked />
                        <label htmlFor="status-inactive" className="text-xs text-slate-700">
                          Inactive
                        </label>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-2 block">Company Linkage</label>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Checkbox id="linked" className="h-3 w-3" defaultChecked />
                        <label htmlFor="linked" className="text-xs text-slate-700">
                          Linked
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="unresolved" className="h-3 w-3" />
                        <label htmlFor="unresolved" className="text-xs text-slate-700">
                          Unresolved
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-slate-600" />
                  <h3 className="font-semibold text-slate-900">Audience Scope</h3>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-xs text-blue-900 mb-2">
                    <span className="font-semibold">現在のScope</span>
                  </div>
                  <div className="text-sm font-medium text-blue-900 mb-2">
                    {sourceClusterInfo.audienceScope}
                  </div>
                  <div className="text-xs text-blue-800">
                    各Project所属のユーザー集合に施策を実施します
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Center: Target Users & Common Insights */}
          <div className="flex-1 overflow-auto p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="users" className="gap-2">
                  <Users className="w-4 h-4" />
                  対象User群
                </TabsTrigger>
                <TabsTrigger value="insights" className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  共通Insight
                </TabsTrigger>
                <TabsTrigger value="unresolved" className="gap-2">
                  <XCircle className="w-4 h-4" />
                  Unresolved Recipients
                </TabsTrigger>
              </TabsList>

              {/* Target Users Tab */}
              <TabsContent value="users" className="mt-0">
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div className="text-xs text-blue-900">
                      <div className="font-semibold mb-1">このまとまりの中で、誰に打つのか</div>
                      <div>対象Userを確認し、必要に応じて除外や調整を行ってください。チェックを外すと施策対象から除外されます。</div>
                    </div>
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">対象User一覧（Resolved）</CardTitle>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <UserCheck className="w-4 h-4" />
                        <span>{selectedUsers.length} / {resolvedUsers.length} 選択中</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2">
                              <Checkbox 
                                checked={selectedUsers.length === resolvedUsers.length}
                                onCheckedChange={(checked) => {
                                  setSelectedUsers(checked ? resolvedUsers.map(u => u.id) : []);
                                }}
                              />
                            </th>
                            <th className="text-left py-2 px-3 font-semibold text-slate-700">Name</th>
                            <th className="text-left py-2 px-3 font-semibold text-slate-700">Email</th>
                            <th className="text-left py-2 px-3 font-semibold text-slate-700">Project</th>
                            <th className="text-left py-2 px-3 font-semibold text-slate-700">Company</th>
                            <th className="text-center py-2 px-3 font-semibold text-slate-700">Permission</th>
                            <th className="text-center py-2 px-3 font-semibold text-slate-700">Status</th>
                            <th className="text-center py-2 px-3 font-semibold text-slate-700">User Stage</th>
                            <th className="text-center py-2 px-3 font-semibold text-slate-700">Last Active</th>
                            <th className="text-center py-2 px-3 font-semibold text-slate-700">L30 Active</th>
                            <th className="text-left py-2 px-3 font-semibold text-slate-700">Segment</th>
                            <th className="text-center py-2 px-3 font-semibold text-slate-700"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {resolvedUsers.map((user) => (
                            <tr key={user.id} className="border-b hover:bg-slate-50">
                              <td className="py-3 px-2">
                                <Checkbox 
                                  checked={selectedUsers.includes(user.id)}
                                  onCheckedChange={() => handleToggleUser(user.id)}
                                />
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-medium text-slate-900">{user.name}</div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="text-xs text-slate-600">{user.email}</div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="text-xs text-slate-700">{user.project}</div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1 text-xs text-slate-700">
                                  {user.companyLinked && <Building2 className="w-3 h-3 text-emerald-600" />}
                                  {user.company}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <Badge variant="outline" className="text-xs">
                                  {user.permission}
                                </Badge>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <Badge className={`text-xs ${
                                  user.status === "active" ? "bg-emerald-500" : "bg-slate-400"
                                }`}>
                                  {user.status}
                                </Badge>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <Badge variant="outline" className={`text-xs ${
                                  user.userStage === "At-Risk" ? "border-red-300 bg-red-50 text-red-700" :
                                  user.userStage === "Engaged" ? "border-emerald-300 bg-emerald-50 text-emerald-700" :
                                  "border-blue-300 bg-blue-50 text-blue-700"
                                }`}>
                                  {user.userStage}
                                </Badge>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center gap-1 justify-center text-xs text-slate-600">
                                  <Clock className="w-3 h-3" />
                                  {user.lastActive}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className={`font-semibold ${
                                  user.l30_active < 5 ? "text-red-600" :
                                  user.l30_active < 10 ? "text-orange-600" :
                                  "text-emerald-600"
                                }`}>
                                  {user.l30_active}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <Badge variant="outline" className="text-xs">
                                  {user.recommendedSegment}
                                </Badge>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <Link to={`/project/${user.projectId || 'proj_1'}?from=audience&cluster=${sourceClusterInfo.id}`}>
                                  <Button variant="ghost" size="sm" className="h-7 px-2">
                                    <ExternalLink className="w-3 h-3" />
                                  </Button>
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Common Insights Tab */}
              <TabsContent value="insights" className="mt-0">
                <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
                    <div className="text-xs text-purple-900">
                      <div className="font-semibold mb-1">クラスター共通のInsight</div>
                      <div>この対象群に共通して見えているRiskやOpportunityを確認してください。</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {commonInsights.map((insight) => (
                    <Card
                      key={insight.id}
                      className={`${
                        insight.type === "risk"
                          ? "border-l-4 border-l-red-500 bg-red-50"
                          : "border-l-4 border-l-emerald-500 bg-emerald-50"
                      }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {insight.type === "risk" ? (
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            ) : (
                              <Target className="w-5 h-5 text-emerald-600" />
                            )}
                            <CardTitle className="text-base">{insight.title}</CardTitle>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {insight.evidenceCount} Evidence
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {insight.affectedProjects} Projects
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {insight.affectedUsers} Users
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-slate-700">{insight.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Unresolved Recipients Tab */}
              <TabsContent value="unresolved" className="mt-0">
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                    <div className="text-xs text-red-900">
                      <div className="font-semibold mb-1">未解決の宛先があります</div>
                      <div>これらのUserは送信対象に含まれません。実行前に除外するか、手動解決するかを決定してください。</div>
                    </div>
                  </div>
                </div>

                <Card className="border-red-200">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base text-red-900">Unresolved Recipients ({unresolvedUsers.length})</CardTitle>
                      <Button variant="outline" size="sm" className="text-xs">
                        <Edit3 className="w-3 h-3 mr-1" />
                        手動解決
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {unresolvedUsers.map((user) => (
                        <div key={user.id} className="border border-red-200 bg-red-50 rounded p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <XCircle className="w-4 h-4 text-red-600" />
                                <span className="font-medium text-slate-900">{user.name}</span>
                                <Badge variant="outline" className="text-xs">{user.permission}</Badge>
                              </div>
                              <div className="text-xs text-slate-600 ml-6">{user.project}</div>
                              <div className="text-xs text-red-700 ml-6 mt-1">
                                理由: {!user.email ? "Email未設定" : "Company未連携"}
                              </div>
                            </div>
                            <Button variant="outline" size="sm" className="text-xs">
                              除外する
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Action Plan & Pre-Execution Review */}
          <div className="w-[440px] bg-white border-l overflow-auto">
            <ScrollArea className="h-full">
              <div className="p-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-purple-600" />
                      <h2 className="text-lg font-semibold text-slate-900">施策案と実行前確認</h2>
                    </div>
                    <Link to="/projects">
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        <Layers className="w-3 h-3 mr-1" />
                        クラスター分析に戻る
                      </Button>
                    </Link>
                  </div>
                  <p className="text-xs text-slate-600">
                    推奨される施策内容を確認し、実行前のチェックを行います。個別Project確認は対象User表の右端から可能です。
                  </p>
                </div>

                <Separator className="my-4" />

                {/* 推奨Action案 */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    推奨Action案
                  </h3>
                  <div className="space-y-2">
                    {recommendedActions.map((action) => (
                      <Card key={action.id} className="border-blue-200 bg-blue-50">
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="text-sm font-medium text-blue-900">{action.title}</div>
                            <Badge className={`text-xs ${
                              action.priority === "High" ? "bg-red-500" : "bg-orange-500"
                            }`}>
                              {action.priority}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-700 mb-2">{action.description}</div>
                          <Badge variant="outline" className="text-xs">
                            {action.type}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* 推奨Template候補 */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    推奨Template候補
                  </h3>
                  <div className="space-y-2">
                    {recommendedTemplates.map((template) => (
                      <div key={template.id} className="flex items-center justify-between p-3 border rounded bg-slate-50">
                        <div>
                          <div className="text-sm font-medium text-slate-900">{template.name}</div>
                          <div className="text-xs text-slate-600">{template.useCase}</div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {template.channel === "Email" && <Mail className="w-3 h-3 mr-1" />}
                          {template.channel === "Slack" && <MessageSquare className="w-3 h-3 mr-1" />}
                          {template.channel}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* 想定実行内容 */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">想定実行内容</h3>
                  <div className="bg-slate-50 border rounded-lg p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Audience Scope</span>
                      <span className="font-semibold text-slate-900">{sourceClusterInfo.audienceScope}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">対象Project数</span>
                      <span className="font-semibold text-slate-900">
                        {sourceClusterInfo.projectCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">選択User数</span>
                      <span className="font-semibold text-emerald-600">{selectedUsers.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Unresolved</span>
                      <span className="font-semibold text-red-600">{unresolvedUsers.length}</span>
                    </div>
                  </div>
                </div>

                {/* 実行前チェックポイント */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-purple-600" />
                    実行前チェックポイント
                  </h3>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
                    {preExecutionChecks.map((check, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-purple-900">
                        <Checkbox className="h-3 w-3 mt-0.5" />
                        <span>{check}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* 実行オペレーション */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">施策実行</h3>
                  <div className="space-y-2">
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => setBulkActionDrawerOpen(true)}
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      一括Action作成
                    </Button>
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => setBulkContentDrawerOpen(true)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      一括Content作成
                    </Button>
                    <Separator className="my-2" />
                    <div className="text-xs text-slate-600 mb-2">
                      送信準備・配信
                    </div>
                    <Link to={`/outbound/compose?fromAudience=${sourceClusterInfo.id}`} className="w-full">
                      <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        送信レビューへ
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* 注意事項 */}
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                      <div className="text-xs text-amber-900">
                        <div className="font-semibold mb-1">実行前の注意</div>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Push/Send/Syncは実行後取り消せません</li>
                          <li>Unresolved Recipientsは送信対象外です</li>
                          <li>外部送信前に必ずレビューしてください</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </div>
        </main>
      </div>

      {/* Bulk Action Drawer */}
      <BulkActionDrawer
        open={bulkActionDrawerOpen}
        onOpenChange={setBulkActionDrawerOpen}
        clusterInfo={{
          name: sourceClusterInfo.name,
          projectCount: sourceClusterInfo.projectCount,
          audienceScope: sourceClusterInfo.audienceScope,
        }}
        selectedUsersCount={selectedUsers.length}
        unresolvedUsersCount={unresolvedUsers.length}
      />

      {/* Bulk Content Drawer */}
      <BulkContentDrawer
        open={bulkContentDrawerOpen}
        onOpenChange={setBulkContentDrawerOpen}
        clusterInfo={{
          name: sourceClusterInfo.name,
          projectCount: sourceClusterInfo.projectCount,
          audienceScope: sourceClusterInfo.audienceScope,
        }}
        selectedUsersCount={selectedUsers.length}
        unresolvedUsersCount={unresolvedUsers.length}
      />
    </div>
  );
}