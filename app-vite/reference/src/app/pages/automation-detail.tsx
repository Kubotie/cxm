import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  ArrowLeft,
  Edit,
  Copy,
  Play,
  Pause,
  BarChart3,
  Settings,
  Zap,
  Filter,
  Users,
  FileText,
  Send,
  CheckSquare,
  Clock,
  GitBranch,
  ArrowDown,
  CheckCircle2,
  Target,
  TrendingUp,
  AlertCircle,
  Eye,
  FilePenLine,
  Calendar,
  User,
  Activity
} from "lucide-react";

export function AutomationDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [selectedTab, setSelectedTab] = useState("overview");

  // Mock data
  const automation = {
    id: id || "auto-1",
    name: "Event案内自動送信（ウェビナー）",
    status: "active" as const,
    triggerType: "Event started",
    targetSummary: "Premium tier, Active phase",
    stepCount: 7,
    activeRuns: 12,
    lastExecuted: "2026-03-17 14:30",
    owner: "山本 一郎",
    goalSummary: "Event開始から対象Audienceへの案内送信",
    sendMode: "auto_send_allowed" as const,
    performance: {
      entered: 145,
      completed: 132,
      sent: 118,
      dropped: 8,
      failed: 5,
    },
    linkedEvent: "ウェビナー：新機能紹介",
    linkedAudience: "Premium Active Customers",
    linkedContent: "Event案内テンプレート v2.1",
    linkedOutbound: "3件（draft / sent）",
  };

  const flowSteps = [
    {
      id: 1,
      type: "trigger",
      label: "Event started",
      description: "Event type = Webinar, Status = Scheduled",
      icon: <Zap className="w-5 h-5" />,
      color: "bg-purple-100 text-purple-700 border-purple-300",
    },
    {
      id: 2,
      type: "condition",
      label: "Check Company Tier",
      description: "Tier = Premium または Enterprise",
      icon: <Filter className="w-5 h-5" />,
      color: "bg-blue-100 text-blue-700 border-blue-300",
    },
    {
      id: 3,
      type: "audience",
      label: "Build Target Audience",
      description: "Active phase, No unresolved issue",
      icon: <Users className="w-5 h-5" />,
      color: "bg-green-100 text-green-700 border-green-300",
    },
    {
      id: 4,
      type: "content",
      label: "Generate Event Invitation",
      description: "AI生成：Event案内 + 文脈付きパーソナライズ",
      icon: <FileText className="w-5 h-5" />,
      color: "bg-amber-100 text-amber-700 border-amber-300",
    },
    {
      id: 5,
      type: "send",
      label: "Send Email",
      description: "Channel: Email, Mode: Auto Send",
      icon: <Send className="w-5 h-5" />,
      color: "bg-pink-100 text-pink-700 border-pink-300",
    },
    {
      id: 6,
      type: "wait",
      label: "Wait 3 days",
      description: "参加登録を待つ",
      icon: <Clock className="w-5 h-5" />,
      color: "bg-slate-100 text-slate-700 border-slate-300",
    },
    {
      id: 7,
      type: "branch",
      label: "Branch by Registration",
      description: "登録あり → Follow-up Action / 登録なし → End",
      icon: <GitBranch className="w-5 h-5" />,
      color: "bg-orange-100 text-orange-700 border-orange-300",
    },
  ];

  const getSendModeBadge = (sendMode: typeof automation.sendMode) => {
    if (sendMode === "auto_send_allowed") {
      return (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
          <Send className="w-3 h-3 mr-1" />
          Auto Send Allowed
        </Badge>
      );
    }
    if (sendMode === "review_before_send") {
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <Eye className="w-3 h-3 mr-1" />
          Review Before Send
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">
        <FilePenLine className="w-3 h-3 mr-1" />
        Draft Only
      </Badge>
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col">
        <GlobalHeader />
        
        {/* Page Header */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/automation")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Automation List
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate(`/automation/${id}/runs`)}>
                <BarChart3 className="w-4 h-4 mr-2" />
                Runs を見る
              </Button>
              <Button variant="outline" size="sm">
                <Copy className="w-4 h-4 mr-2" />
                複製
              </Button>
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                編集
              </Button>
              {automation.status === "active" ? (
                <Button variant="outline" size="sm">
                  <Pause className="w-4 h-4 mr-2" />
                  一時停止
                </Button>
              ) : (
                <Button variant="outline" size="sm">
                  <Play className="w-4 h-4 mr-2" />
                  有効化
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-slate-900">{automation.name}</h1>
                <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>
              <p className="text-sm text-slate-600">{automation.goalSummary}</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="px-6 py-4 bg-slate-50 border-b">
          <div className="grid grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Steps</span>
                <GitBranch className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{automation.stepCount}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Active Runs</span>
                <Activity className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{automation.activeRuns}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Entered</span>
                <Users className="w-4 h-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{automation.performance.entered}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Completed</span>
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{automation.performance.completed}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Sent</span>
                <Send className="w-4 h-4 text-pink-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{automation.performance.sent}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Failed</span>
                <AlertCircle className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{automation.performance.failed}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 py-4 flex-1 overflow-y-auto">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="flow">Flow</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="linked">Linked Resources</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="bg-white p-6 rounded-lg border border-slate-200">
                  <div className="text-sm font-semibold text-slate-900 mb-4">基本情報</div>
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Trigger Type</div>
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                        {automation.triggerType}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Target Summary</div>
                      <div className="text-sm text-slate-900">{automation.targetSummary}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Send Mode</div>
                      {getSendModeBadge(automation.sendMode)}
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Owner</div>
                      <div className="flex items-center gap-2 text-sm text-slate-900">
                        <User className="w-4 h-4 text-slate-400" />
                        {automation.owner}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Last Executed</div>
                      <div className="flex items-center gap-2 text-sm text-slate-900">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {automation.lastExecuted}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Goal */}
                <div className="bg-white p-6 rounded-lg border border-slate-200">
                  <div className="text-sm font-semibold text-slate-900 mb-4">Goal & Strategy</div>
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Goal Summary</div>
                      <div className="text-sm text-slate-900">{automation.goalSummary}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Strategy</div>
                      <div className="text-sm text-slate-700">
                        Event開始をトリガーに、Premium tier以上のActive顧客に対してEvent案内を自動送信。3日後に参加登録状況で分岐し、未登録者にはFollow-upを実施。
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="flow" className="mt-6">
              <div className="bg-white p-6 rounded-lg border border-slate-200">
                <div className="text-sm font-semibold text-slate-900 mb-6">Flow Visualization</div>
                <div className="space-y-0">
                  {flowSteps.map((step, index) => (
                    <div key={step.id} className="flex flex-col items-center">
                      <div className={`w-full max-w-2xl p-4 rounded-lg border-2 ${step.color}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">{step.icon}</div>
                          <div className="flex-1">
                            <div className="text-xs font-semibold mb-1">{step.type.toUpperCase()}</div>
                            <div className="text-sm font-medium mb-1">{step.label}</div>
                            <div className="text-xs opacity-75">{step.description}</div>
                          </div>
                          <Settings className="w-4 h-4 opacity-50" />
                        </div>
                      </div>
                      {index < flowSteps.length - 1 && (
                        <div className="flex items-center justify-center py-3">
                          <ArrowDown className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="mt-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg border border-slate-200">
                  <div className="text-sm font-semibold text-slate-900 mb-4">Conversion Funnel</div>
                  <div className="space-y-4">
                    {[
                      { label: "Entered", value: automation.performance.entered, color: "bg-blue-500" },
                      { label: "Completed", value: automation.performance.completed, color: "bg-green-500" },
                      { label: "Sent", value: automation.performance.sent, color: "bg-purple-500" },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-600">{item.label}</span>
                          <span className="text-sm font-semibold text-slate-900">{item.value}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className={`${item.color} h-2 rounded-full`}
                            style={{ width: `${(item.value / automation.performance.entered) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-slate-200">
                  <div className="text-sm font-semibold text-slate-900 mb-4">Issues</div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Dropped</span>
                      <span className="text-sm font-semibold text-amber-700">{automation.performance.dropped}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Failed</span>
                      <span className="text-sm font-semibold text-red-700">{automation.performance.failed}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600">Success Rate</span>
                      <span className="text-sm font-semibold text-green-700">
                        {Math.round((automation.performance.sent / automation.performance.entered) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="linked" className="mt-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg border border-slate-200">
                  <div className="text-sm font-semibold text-slate-900 mb-4">Linked Resources</div>
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Event</div>
                      <div className="text-sm text-slate-900">{automation.linkedEvent}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Audience</div>
                      <div className="text-sm text-slate-900">{automation.linkedAudience}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Content</div>
                      <div className="text-sm text-slate-900">{automation.linkedContent}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Outbound</div>
                      <div className="text-sm text-slate-900">{automation.linkedOutbound}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-slate-200">
                  <div className="text-sm font-semibold text-slate-900 mb-4">Send Policy</div>
                  <div className="space-y-3">
                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="text-xs text-purple-900 font-semibold mb-1">Auto Send Allowed</div>
                      <div className="text-xs text-purple-800">
                        このAutomationはAuto Sendが許可されています。Settings の Automation Send Policies により制御されています。
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Channel</div>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Email</Badge>
                    </div>
                    <div>
                      <div className="text-xs text-slate-600 mb-1">Max Recipients (per run)</div>
                      <div className="text-sm text-slate-900">500</div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}