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
import { Search, ArrowRight, Ticket, Building } from "lucide-react";

// ── Mock data ────────────────────────────────────────────────────────────────

const supportCases = [
  {
    id: "inq_1",
    title: "API連携時のタイムアウトについて",
    caseType: "Inquiry",
    source: "Intercom",
    company: "株式会社テクノロジーイノベーション",
    companyId: "1",
    project: "プロジェクトA",
    projectId: "proj_1",
    owner: null,
    assignedTeam: null,
    routingStatus: "unassigned",
    sourceStatus: "open",
    severity: "high",
    createdAt: "2026-03-17 14:23",
    firstResponseTime: null,
    openDuration: "2h 54m",
    waitingDuration: null,
    linkedCSETicket: null,
    relatedContent: 0,
  },
  {
    id: "sup_1",
    title: "レポート出力時のデータ欠損",
    caseType: "Support",
    source: "Slack",
    company: "グローバルソリューションズ株式会社",
    companyId: "2",
    project: "プロジェクトB",
    projectId: "proj_2",
    owner: "Support Team",
    assignedTeam: "Support",
    routingStatus: "in progress",
    sourceStatus: null,
    severity: "medium",
    createdAt: "2026-03-17 13:45",
    firstResponseTime: "0h 45m",
    openDuration: "3h 32m",
    waitingDuration: null,
    linkedCSETicket: null,
    relatedContent: 2,
  },
  {
    id: "cse_1",
    title: "[CSE-1234] データ同期エラーの調査",
    caseType: "CSE Ticket Linked",
    source: "CSE Ticket",
    company: "クラウドインフラサービス",
    companyId: "5",
    project: "プロジェクトC",
    projectId: "proj_3",
    owner: "山本 一郎",
    assignedTeam: "CSE",
    routingStatus: "waiting on CSE",
    sourceStatus: "open",
    severity: "high",
    createdAt: "2026-03-17 11:20",
    firstResponseTime: "0h 15m",
    openDuration: "5h 57m",
    waitingDuration: "2h 30m",
    linkedCSETicket: "CSE-1234",
    relatedContent: 1,
  },
  {
    id: "sup_2",
    title: "権限設定の確認方法について",
    caseType: "Support",
    source: "Intercom",
    company: "デジタルマーケティング株式会社",
    companyId: "3",
    project: "プロジェクトD",
    projectId: "proj_4",
    owner: "佐藤 太郎",
    assignedTeam: "CSM",
    routingStatus: "assigned",
    sourceStatus: "open",
    severity: "low",
    createdAt: "2026-03-17 10:15",
    firstResponseTime: "1h 20m",
    openDuration: "7h 2m",
    waitingDuration: null,
    linkedCSETicket: null,
    relatedContent: 3,
  },
  {
    id: "inq_2",
    title: "契約更新時の見積もり依頼",
    caseType: "Inquiry",
    source: "Chatwork",
    company: "エンタープライズソフトウェア",
    companyId: "4",
    project: null,
    projectId: null,
    owner: "山田 花子",
    assignedTeam: "CSM",
    routingStatus: "triaged",
    sourceStatus: null,
    severity: "medium",
    createdAt: "2026-03-17 09:45",
    firstResponseTime: "0h 30m",
    openDuration: "7h 32m",
    waitingDuration: null,
    linkedCSETicket: null,
    relatedContent: 0,
  },
  {
    id: "sup_3",
    title: "ユーザー招待メールが届かない",
    caseType: "Support",
    source: "Intercom",
    company: "株式会社テクノロジーイノベーション",
    companyId: "1",
    project: "プロジェクトA",
    projectId: "proj_1",
    owner: "Support Team",
    assignedTeam: "Support",
    routingStatus: "waiting on customer",
    sourceStatus: "pending",
    severity: "medium",
    createdAt: "2026-03-16 16:30",
    firstResponseTime: "0h 20m",
    openDuration: "1d 0h 47m",
    waitingDuration: "18h 20m",
    linkedCSETicket: null,
    relatedContent: 1,
  },
  {
    id: "cse_2",
    title: "[CSE-1256] パフォーマンス劣化の調査",
    caseType: "CSE Ticket Linked",
    source: "CSE Ticket",
    company: "グローバルソリューションズ株式会社",
    companyId: "2",
    project: "プロジェクトB",
    projectId: "proj_2",
    owner: "田中 次郎",
    assignedTeam: "CSE",
    routingStatus: "waiting on CSE",
    sourceStatus: "in progress",
    severity: "high",
    createdAt: "2026-03-15 14:20",
    firstResponseTime: "0h 10m",
    openDuration: "2d 2h 57m",
    waitingDuration: "1d 4h 30m",
    linkedCSETicket: "CSE-1256",
    relatedContent: 0,
  },
  {
    id: "sup_4",
    title: "エクスポート機能の動作確認",
    caseType: "Support",
    source: "Slack",
    company: "クラウドインフラサービス",
    companyId: "5",
    project: "プロジェクトC",
    projectId: "proj_3",
    owner: "Support Team",
    assignedTeam: "Support",
    routingStatus: "resolved_like",
    sourceStatus: null,
    severity: "low",
    createdAt: "2026-03-15 11:00",
    firstResponseTime: "0h 50m",
    openDuration: "2d 6h 17m",
    waitingDuration: null,
    linkedCSETicket: null,
    relatedContent: 2,
  },
];

// ── Routing status badge ──────────────────────────────────────────────────────

function RoutingBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    unassigned: "bg-slate-100 text-slate-700",
    triaged: "bg-blue-50 text-blue-700 border-blue-200",
    assigned: "bg-purple-50 text-purple-700 border-purple-200",
    "in progress": "bg-green-50 text-green-700 border-green-200",
    "waiting on customer": "bg-amber-50 text-amber-700 border-amber-200",
    "waiting on CSE": "bg-orange-50 text-orange-700 border-orange-200",
    resolved_like: "bg-green-50 text-green-700 border-green-200",
  };
  const labels: Record<string, string> = {
    unassigned: "未アサイン",
    triaged: "振り分け済",
    assigned: "アサイン済",
    "in progress": "対応中",
    "waiting on customer": "顧客待ち",
    "waiting on CSE": "CSE待ち",
    resolved_like: "区切り済み",
  };
  return (
    <Badge variant="outline" className={`text-xs ${map[status] ?? "bg-slate-100 text-slate-700"}`}>
      {labels[status] ?? status}
    </Badge>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type SupportCase = (typeof supportCases)[0];

export function SupportQueue() {
  const [currentView, setCurrentView] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [caseTypeFilter, setCaseTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const views = [
    { value: "all", label: "All Cases", description: "すべての案件", isDefault: true },
    { value: "unassigned", label: "Unassigned", description: "未アサインの案件" },
    { value: "my", label: "My Cases", description: "自分の担当案件" },
    { value: "inquiry", label: "Inquiries", description: "問い合わせのみ" },
    { value: "support", label: "Support", description: "サポート案件のみ" },
    { value: "cse", label: "CSE Linked", description: "CSE連携案件のみ" },
  ];

  const viewConfig: Record<string, {
    subtitle: string;
    filterCases: (c: SupportCase) => boolean;
    emptyState: { title: string; description: string; cta: { label: string; action: () => void } | null };
  }> = {
    all: {
      subtitle: "すべての問い合わせ・サポート・CSE連携案件を横断して確認する",
      filterCases: () => true,
      emptyState: { title: "案件がありません", description: "問い合わせやサポート案件が発生すると、ここに表示されます", cta: null },
    },
    unassigned: {
      subtitle: "未アサインの案件を優先的に振り分ける",
      filterCases: (c) => c.routingStatus === "unassigned",
      emptyState: { title: "未アサインの案件はありません", description: "すべての案件が振り分け済みです", cta: { label: "All Cases を見る", action: () => setCurrentView("all") } },
    },
    my: {
      subtitle: "自分が担当している案件を確認する",
      filterCases: (c) => c.owner === "山本 一郎",
      emptyState: { title: "担当している案件はありません", description: "案件が割り当てられると、ここに表示されます", cta: { label: "Unassigned を見る", action: () => setCurrentView("unassigned") } },
    },
    inquiry: {
      subtitle: "新規問い合わせのみを確認する",
      filterCases: (c) => c.caseType === "Inquiry",
      emptyState: { title: "問い合わせはありません", description: "新規問い合わせが発生すると、ここに表示されます", cta: { label: "All Cases を見る", action: () => setCurrentView("all") } },
    },
    support: {
      subtitle: "サポート案件のみを確認する",
      filterCases: (c) => c.caseType === "Support",
      emptyState: { title: "サポート案件はありません", description: "サポート案件が発生すると、ここに表示されます", cta: { label: "All Cases を見る", action: () => setCurrentView("all") } },
    },
    cse: {
      subtitle: "CSE連携案件のみを確認する",
      filterCases: (c) => c.caseType === "CSE Ticket Linked",
      emptyState: { title: "CSE連携案件はありません", description: "CSE Ticketと連携した案件が発生すると、ここに表示されます", cta: { label: "All Cases を見る", action: () => setCurrentView("all") } },
    },
  };

  const config = viewConfig[currentView];
  const currentViewLabel = views.find((v) => v.value === currentView)?.label ?? "";

  let filteredCases = supportCases.filter(config.filterCases);
  if (searchQuery) {
    filteredCases = filteredCases.filter(
      (c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.company.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }
  if (caseTypeFilter !== "all") filteredCases = filteredCases.filter((c) => c.caseType === caseTypeFilter);
  if (sourceFilter !== "all") filteredCases = filteredCases.filter((c) => c.source === sourceFilter);
  if (statusFilter !== "all") filteredCases = filteredCases.filter((c) => c.routingStatus === statusFilter);
  if (severityFilter !== "all") filteredCases = filteredCases.filter((c) => c.severity === severityFilter);

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Support Queue" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1800px] mx-auto p-6 space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
              <ViewContextHeader
                pageName="Support Queue"
                currentView={currentViewLabel}
                subtitle={config.subtitle}
              />
              <ViewSwitcher
                currentView={currentView}
                views={views}
                onViewChange={setCurrentView}
              />
            </div>

            {/* Filters */}
            <div className="bg-white border rounded-lg p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="タイトル、Company名で検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={caseTypeFilter} onValueChange={setCaseTypeFilter}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Case Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Inquiry">Inquiry</SelectItem>
                    <SelectItem value="Support">Support</SelectItem>
                    <SelectItem value="CSE Ticket Linked">CSE Ticket Linked</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Source" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="Intercom">Intercom</SelectItem>
                    <SelectItem value="Slack">Slack</SelectItem>
                    <SelectItem value="Chatwork">Chatwork</SelectItem>
                    <SelectItem value="CSE Ticket">CSE Ticket</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    <SelectItem value="triaged">Triaged</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in progress">In Progress</SelectItem>
                    <SelectItem value="waiting on customer">Waiting on Customer</SelectItem>
                    <SelectItem value="waiting on CSE">Waiting on CSE</SelectItem>
                    <SelectItem value="resolved_like">Resolved-like</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Severity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table */}
            {filteredCases.length === 0 ? (
              <ViewEmptyState
                title={config.emptyState.title}
                description={config.emptyState.description}
                currentView={currentViewLabel}
                cta={config.emptyState.cta ?? undefined}
              />
            ) : (
              <div className="bg-white border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Case / Ticket Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Company / Project</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Routing Status</TableHead>
                      <TableHead>Source Status</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>First Response</TableHead>
                      <TableHead>Open Duration</TableHead>
                      <TableHead>Linked</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCases.map((sc) => (
                      <TableRow key={sc.id} className="hover:bg-slate-50">
                        <TableCell>
                          <Link to={`/support/${sc.id}`} className="font-medium text-slate-900 hover:text-blue-600 hover:underline">
                            {sc.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{sc.caseType}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{sc.source}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Link to={`/companies/${sc.companyId}`} className="text-sm text-slate-700 hover:text-blue-600 hover:underline block">
                              <Building className="w-3 h-3 inline mr-1" />{sc.company}
                            </Link>
                            {sc.project && (
                              <span className="text-xs text-slate-500 block">{sc.project}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">
                          {sc.owner ?? <span className="text-slate-400">-</span>}
                        </TableCell>
                        <TableCell>
                          {sc.assignedTeam ? (
                            <Badge variant="outline" className="text-xs">{sc.assignedTeam}</Badge>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <RoutingBadge status={sc.routingStatus} />
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {sc.sourceStatus ?? <span className="text-slate-400">-</span>}
                        </TableCell>
                        <TableCell>
                          {sc.severity === "high" && <Badge className="bg-red-600 text-white text-xs">High</Badge>}
                          {sc.severity === "medium" && <Badge className="bg-amber-600 text-white text-xs">Medium</Badge>}
                          {sc.severity === "low" && <Badge className="bg-slate-600 text-white text-xs">Low</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">{sc.createdAt}</TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {sc.firstResponseTime ?? <span className="text-slate-400">-</span>}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {sc.openDuration}
                          {sc.waitingDuration && (
                            <div className="text-xs text-amber-600 mt-0.5">待機: {sc.waitingDuration}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {sc.linkedCSETicket && (
                              <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700">
                                <Ticket className="w-3 h-3 mr-1" />{sc.linkedCSETicket}
                              </Badge>
                            )}
                            {sc.relatedContent > 0 && (
                              <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                                Content: {sc.relatedContent}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Link to={`/support/${sc.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                              詳細 <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-4 border-t text-center text-sm text-slate-500">
                  {filteredCases.length}件を表示中
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
