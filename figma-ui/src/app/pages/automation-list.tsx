import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { 
  Plus, 
  Play, 
  Pause, 
  Copy, 
  MoreVertical, 
  Activity, 
  Clock,
  Users,
  GitBranch,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Zap,
  Send,
  FilePenLine,
  Eye,
  Settings,
  BarChart3
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

interface Automation {
  id: string;
  name: string;
  status: "active" | "paused" | "draft" | "error";
  triggerType: string;
  targetSummary: string;
  stepCount: number;
  activeRuns: number;
  lastExecuted: string;
  owner: string;
  goalSummary: string;
  sendMode: "draft_only" | "review_before_send" | "auto_send_allowed";
  performance: {
    entered: number;
    completed: number;
    sent: number;
  };
}

const mockAutomations: Automation[] = [
  {
    id: "auto-1",
    name: "Event案内自動送信（ウェビナー）",
    status: "active",
    triggerType: "Event started",
    targetSummary: "Premium tier, Active phase",
    stepCount: 7,
    activeRuns: 12,
    lastExecuted: "2026-03-17 14:30",
    owner: "山本 一郎",
    goalSummary: "Event開始から対象Audienceへの案内送信",
    sendMode: "auto_send_allowed",
    performance: {
      entered: 145,
      completed: 132,
      sent: 118,
    },
  },
  {
    id: "auto-2",
    name: "High Risk Alert → CSM Follow-up",
    status: "active",
    triggerType: "Risk alert created",
    targetSummary: "Enterprise, High risk",
    stepCount: 5,
    activeRuns: 3,
    lastExecuted: "2026-03-17 13:15",
    owner: "田中 花子",
    goalSummary: "Risk検出時にCSM向けFollow-up Actionを作成",
    sendMode: "draft_only",
    performance: {
      entered: 28,
      completed: 24,
      sent: 0,
    },
  },
  {
    id: "auto-3",
    name: "CSE Waiting → Outreach Draft",
    status: "active",
    triggerType: "CSE waiting too long",
    targetSummary: "CSE waiting > 24h",
    stepCount: 6,
    activeRuns: 5,
    lastExecuted: "2026-03-17 12:00",
    owner: "佐藤 太郎",
    goalSummary: "CSE待機時間超過時にOutreach下書き作成",
    sendMode: "review_before_send",
    performance: {
      entered: 18,
      completed: 16,
      sent: 12,
    },
  },
  {
    id: "auto-4",
    name: "Product Update → Multi-channel Campaign",
    status: "paused",
    triggerType: "Product update published",
    targetSummary: "All active customers",
    stepCount: 9,
    activeRuns: 0,
    lastExecuted: "2026-03-15 10:00",
    owner: "山本 一郎",
    goalSummary: "Product更新を複数チャネルで配信",
    sendMode: "review_before_send",
    performance: {
      entered: 245,
      completed: 238,
      sent: 210,
    },
  },
  {
    id: "auto-5",
    name: "Opportunity Alert → Sales Action",
    status: "active",
    triggerType: "Opportunity alert created",
    targetSummary: "Upsell potential, ARR > 5M",
    stepCount: 4,
    activeRuns: 2,
    lastExecuted: "2026-03-16 16:45",
    owner: "田中 花子",
    goalSummary: "Opportunity検出時にSales向けAction作成",
    sendMode: "draft_only",
    performance: {
      entered: 12,
      completed: 11,
      sent: 0,
    },
  },
  {
    id: "auto-6",
    name: "Event Ending Soon → Follow-up Survey",
    status: "draft",
    triggerType: "Event ending soon",
    targetSummary: "Event participants",
    stepCount: 5,
    activeRuns: 0,
    lastExecuted: "-",
    owner: "佐藤 太郎",
    goalSummary: "Event終了前にフォローアップSurvey送信",
    sendMode: "auto_send_allowed",
    performance: {
      entered: 0,
      completed: 0,
      sent: 0,
    },
  },
  {
    id: "auto-7",
    name: "Recurring Issue → FAQ Draft",
    status: "active",
    triggerType: "Support alert created",
    targetSummary: "Recurring issue detected",
    stepCount: 3,
    activeRuns: 1,
    lastExecuted: "2026-03-17 11:30",
    owner: "山本 一郎",
    goalSummary: "Recurring Issue検出時にFAQ下書き作成",
    sendMode: "draft_only",
    performance: {
      entered: 7,
      completed: 6,
      sent: 0,
    },
  },
  {
    id: "auto-8",
    name: "Inactivity → Re-engagement Campaign",
    status: "error",
    triggerType: "Schedule based",
    targetSummary: "Inactive > 30 days",
    stepCount: 8,
    activeRuns: 0,
    lastExecuted: "2026-03-17 09:00",
    owner: "田中 花子",
    goalSummary: "非アクティブユーザーへの再エンゲージメント",
    sendMode: "review_before_send",
    performance: {
      entered: 56,
      completed: 42,
      sent: 35,
    },
  },
];

export function AutomationList() {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState("all");

  const filteredAutomations = mockAutomations.filter((automation) => {
    if (selectedTab === "all") return true;
    if (selectedTab === "active") return automation.status === "active";
    if (selectedTab === "paused") return automation.status === "paused";
    if (selectedTab === "draft") return automation.status === "draft";
    if (selectedTab === "error") return automation.status === "error";
    return true;
  });

  const getSendModeBadge = (sendMode: Automation["sendMode"]) => {
    if (sendMode === "auto_send_allowed") {
      return (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
          <Send className="w-3 h-3 mr-1" />
          Auto Send
        </Badge>
      );
    }
    if (sendMode === "review_before_send") {
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
          <Eye className="w-3 h-3 mr-1" />
          Review First
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-xs">
        <FilePenLine className="w-3 h-3 mr-1" />
        Draft Only
      </Badge>
    );
  };

  const getStatusBadge = (status: Automation["status"]) => {
    if (status === "active") {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    }
    if (status === "paused") {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
          <Pause className="w-3 h-3 mr-1" />
          Paused
        </Badge>
      );
    }
    if (status === "error") {
      return (
        <Badge variant="default" className="bg-red-100 text-red-800 border-red-200 text-xs">
          <XCircle className="w-3 h-3 mr-1" />
          Error
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-xs">
        Draft
      </Badge>
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1">
        <GlobalHeader />
        
        {/* Page Header */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Automation</h1>
              <p className="text-sm text-slate-600 mt-1">
                Event / Support / Audience / Content / Outbound を条件分岐つきで接続し、業務フローを自動化
              </p>
            </div>
            <Button onClick={() => navigate("/automation/new")} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              New Automation
            </Button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="px-6 py-3 bg-purple-50 border-b border-purple-200">
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 text-purple-600 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-purple-900 mb-1">
                Automation の役割
              </div>
              <div className="text-xs text-purple-800">
                Intercom Series のようなフロービルダーで、Trigger → Condition → Audience → Content → Outbound → Send → Action → Wait → Branch を組み合わせてフローを設計します。送信実行は原則Composeですが、条件を満たすケースではAutomationから実行可能です（Auto Sendはpolicyとroleで厳密に制御されます）。
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="px-6 py-4 bg-slate-50">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Active Automations</span>
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {mockAutomations.filter((a) => a.status === "active").length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Active Runs</span>
                <Activity className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {mockAutomations.reduce((sum, a) => sum + a.activeRuns, 0)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Total Sent (7d)</span>
                <Send className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {mockAutomations.reduce((sum, a) => sum + a.performance.sent, 0)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Errors</span>
                <AlertCircle className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {mockAutomations.filter((a) => a.status === "error").length}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 py-4 bg-white border-b">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList>
              <TabsTrigger value="all">
                All ({mockAutomations.length})
              </TabsTrigger>
              <TabsTrigger value="active">
                Active ({mockAutomations.filter((a) => a.status === "active").length})
              </TabsTrigger>
              <TabsTrigger value="paused">
                Paused ({mockAutomations.filter((a) => a.status === "paused").length})
              </TabsTrigger>
              <TabsTrigger value="draft">
                Draft ({mockAutomations.filter((a) => a.status === "draft").length})
              </TabsTrigger>
              <TabsTrigger value="error">
                Error ({mockAutomations.filter((a) => a.status === "error").length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Table */}
        <div className="px-6 py-4">
          <div className="bg-white rounded-lg border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Automation Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trigger Type</TableHead>
                  <TableHead>Target Summary</TableHead>
                  <TableHead className="text-center">Steps</TableHead>
                  <TableHead className="text-center">Active Runs</TableHead>
                  <TableHead>Send Mode</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead>Last Executed</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAutomations.map((automation) => (
                  <TableRow 
                    key={automation.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => navigate(`/automation/${automation.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <GitBranch className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-slate-900">{automation.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{automation.goalSummary}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(automation.status)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                        {automation.triggerType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 max-w-xs">
                      {automation.targetSummary}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-medium text-slate-900">{automation.stepCount}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {automation.activeRuns > 0 ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {automation.activeRuns}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getSendModeBadge(automation.sendMode)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span className="text-slate-600">{automation.performance.entered}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                          <span className="text-slate-600">{automation.performance.completed}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Send className="w-3 h-3 text-purple-600" />
                          <span className="text-slate-600">{automation.performance.sent}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {automation.lastExecuted}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {automation.owner}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/automation/${automation.id}`)}>
                            <Eye className="w-4 h-4 mr-2" />
                            開く
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/automation/${automation.id}/runs`)}>
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Runs を見る
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="w-4 h-4 mr-2" />
                            複製
                          </DropdownMenuItem>
                          {automation.status === "active" ? (
                            <DropdownMenuItem>
                              <Pause className="w-4 h-4 mr-2" />
                              一時停止
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem>
                              <Play className="w-4 h-4 mr-2" />
                              有効化
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem>
                            <Settings className="w-4 h-4 mr-2" />
                            設定
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}