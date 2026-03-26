import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Send,
  AlertCircle,
  Eye,
  Play,
  Pause,
  TrendingUp,
  Activity,
  Filter
} from "lucide-react";

interface AutomationRun {
  id: string;
  runId: string;
  startedAt: string;
  completedAt: string | null;
  currentStep: string;
  status: "running" | "completed" | "failed" | "paused";
  entered: number;
  completed: number;
  dropped: number;
  failed: number;
  waiting: number;
  sent: number;
  sendFailure: number;
  reviewPending: number;
}

const mockRuns: AutomationRun[] = [
  {
    id: "run-1",
    runId: "RUN-2026031714",
    startedAt: "2026-03-17 14:30",
    completedAt: null,
    currentStep: "Step 5: Send Email",
    status: "running",
    entered: 24,
    completed: 18,
    dropped: 2,
    failed: 1,
    waiting: 3,
    sent: 16,
    sendFailure: 2,
    reviewPending: 0,
  },
  {
    id: "run-2",
    runId: "RUN-2026031612",
    startedAt: "2026-03-16 12:00",
    completedAt: "2026-03-16 18:45",
    currentStep: "Completed",
    status: "completed",
    entered: 32,
    completed: 30,
    dropped: 1,
    failed: 1,
    waiting: 0,
    sent: 28,
    sendFailure: 2,
    reviewPending: 0,
  },
  {
    id: "run-3",
    runId: "RUN-2026031509",
    startedAt: "2026-03-15 09:15",
    completedAt: "2026-03-15 16:20",
    currentStep: "Completed",
    status: "completed",
    entered: 28,
    completed: 26,
    dropped: 2,
    failed: 0,
    waiting: 0,
    sent: 24,
    sendFailure: 0,
    reviewPending: 0,
  },
  {
    id: "run-4",
    runId: "RUN-2026031410",
    startedAt: "2026-03-14 10:30",
    completedAt: "2026-03-14 11:15",
    currentStep: "Step 3: Build Audience",
    status: "failed",
    entered: 18,
    completed: 8,
    dropped: 5,
    failed: 5,
    waiting: 0,
    sent: 6,
    sendFailure: 2,
    reviewPending: 0,
  },
  {
    id: "run-5",
    runId: "RUN-2026031315",
    startedAt: "2026-03-13 15:00",
    completedAt: "2026-03-13 22:30",
    currentStep: "Completed",
    status: "completed",
    entered: 35,
    completed: 34,
    dropped: 0,
    failed: 1,
    waiting: 0,
    sent: 32,
    sendFailure: 1,
    reviewPending: 0,
  },
  {
    id: "run-6",
    runId: "RUN-2026031211",
    startedAt: "2026-03-12 11:00",
    completedAt: null,
    currentStep: "Step 6: Wait 3 days",
    status: "paused",
    entered: 22,
    completed: 15,
    dropped: 1,
    failed: 0,
    waiting: 6,
    sent: 14,
    sendFailure: 0,
    reviewPending: 0,
  },
];

export function AutomationRuns() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [selectedTab, setSelectedTab] = useState("all");

  const filteredRuns = mockRuns.filter((run) => {
    if (selectedTab === "all") return true;
    if (selectedTab === "running") return run.status === "running";
    if (selectedTab === "completed") return run.status === "completed";
    if (selectedTab === "failed") return run.status === "failed";
    return true;
  });

  const getStatusBadge = (status: AutomationRun["status"]) => {
    switch (status) {
      case "running":
        return (
          <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
            <Activity className="w-3 h-3 mr-1" />
            Running
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="default" className="bg-red-100 text-red-800 border-red-200 text-xs">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case "paused":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
            <Pause className="w-3 h-3 mr-1" />
            Paused
          </Badge>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col">
        <GlobalHeader />
        
        {/* Page Header */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/automation/${id}`)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Automation Detail
              </Button>
              <h1 className="text-2xl font-bold text-slate-900 mt-3">Automation Runs</h1>
              <p className="text-sm text-slate-600 mt-1">
                Event案内自動送信（ウェビナー） - 実行履歴と結果
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="px-6 py-4 bg-slate-50 border-b">
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Total Runs</span>
                <Activity className="w-4 h-4 text-slate-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{mockRuns.length}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Running</span>
                <Play className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {mockRuns.filter((r) => r.status === "running").length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Total Sent</span>
                <Send className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {mockRuns.reduce((sum, r) => sum + r.sent, 0)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Send Failures</span>
                <XCircle className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {mockRuns.reduce((sum, r) => sum + r.sendFailure, 0)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Avg Success Rate</span>
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {Math.round(
                  (mockRuns.reduce((sum, r) => sum + r.completed, 0) /
                    mockRuns.reduce((sum, r) => sum + r.entered, 0)) *
                    100
                )}
                %
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 py-4 bg-white border-b">
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList>
              <TabsTrigger value="all">All ({mockRuns.length})</TabsTrigger>
              <TabsTrigger value="running">
                Running ({mockRuns.filter((r) => r.status === "running").length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({mockRuns.filter((r) => r.status === "completed").length})
              </TabsTrigger>
              <TabsTrigger value="failed">
                Failed ({mockRuns.filter((r) => r.status === "failed").length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content Area - scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Table */}
          <div className="px-6 py-4">
            <div className="bg-white rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Run ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started At</TableHead>
                    <TableHead>Completed At</TableHead>
                    <TableHead>Current Step</TableHead>
                    <TableHead className="text-center">Entered</TableHead>
                    <TableHead className="text-center">Completed</TableHead>
                    <TableHead className="text-center">Dropped</TableHead>
                    <TableHead className="text-center">Failed</TableHead>
                    <TableHead className="text-center">Waiting</TableHead>
                    <TableHead className="text-center">Sent</TableHead>
                    <TableHead className="text-center">Send Failure</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRuns.map((run) => (
                    <TableRow key={run.id} className="cursor-pointer hover:bg-slate-50">
                      <TableCell>
                        <span className="font-mono text-sm text-slate-900">{run.runId}</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(run.status)}</TableCell>
                      <TableCell className="text-xs text-slate-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {run.startedAt}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {run.completedAt ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                            {run.completedAt}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">{run.currentStep}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                          {run.entered}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {run.completed}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {run.dropped > 0 ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            {run.dropped}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {run.failed > 0 ? (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            {run.failed}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {run.waiting > 0 ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {run.waiting}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {run.sent > 0 ? (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            {run.sent}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {run.sendFailure > 0 ? (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            {run.sendFailure}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Detailed Run Analysis */}
          <div className="px-6 py-4 pb-8">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="text-sm font-semibold text-slate-900 mb-4">Run Analysis（直近5回）</div>
              <div className="space-y-4">
                {mockRuns.slice(0, 5).map((run) => (
                  <div key={run.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-semibold text-slate-900">{run.runId}</span>
                        {getStatusBadge(run.status)}
                      </div>
                      <span className="text-xs text-slate-600">{run.startedAt}</span>
                    </div>
                    <div className="grid grid-cols-6 gap-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="text-xs text-slate-600">Entered</div>
                          <div className="text-sm font-semibold text-slate-900">{run.entered}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <div>
                          <div className="text-xs text-slate-600">Completed</div>
                          <div className="text-sm font-semibold text-slate-900">{run.completed}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Send className="w-4 h-4 text-purple-600" />
                        <div>
                          <div className="text-xs text-slate-600">Sent</div>
                          <div className="text-sm font-semibold text-slate-900">{run.sent}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <div>
                          <div className="text-xs text-slate-600">Dropped</div>
                          <div className="text-sm font-semibold text-slate-900">{run.dropped}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-600" />
                        <div>
                          <div className="text-xs text-slate-600">Failed</div>
                          <div className="text-sm font-semibold text-slate-900">{run.failed}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <div>
                          <div className="text-xs text-slate-600">Waiting</div>
                          <div className="text-sm font-semibold text-slate-900">{run.waiting}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}