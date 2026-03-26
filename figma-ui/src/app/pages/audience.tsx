import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router";
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
  Users,
  Send,
  Plus,
  CheckCircle2,
  Search,
  Target,
  Database,
  Zap,
} from "lucide-react";
import { AudienceDetailSheet } from "../components/audience/audience-detail-sheet";
import { AudienceCreateSheet } from "../components/audience/audience-create-sheet";

// モックデータ
const mockAudiences = [
  {
    id: "aud_1",
    status: "active" as const,
    name: "At-Riskユーザー（Q1 2026）",
    description: "過去30日でアクティビティが急激に低下したユーザー群",
    scope: "user" as const,
    targetCount: 1234,
    sourceContext: "Project" as const,
    linkedCompany: "テックイノベーション株式会社",
    linkedCompanyId: "1",
    linkedProject: "プロジェクトA",
    linkedProjectId: "proj_1",
    owner: "佐藤 太郎",
    lastUsed: "2026-03-10",
    updatedAt: "2026-03-12",
    reusableFlag: true,
  },
  {
    id: "aud_2",
    status: "active" as const,
    name: "アップセル候補Company",
    description: "利用率90%以上で追加ライセンス提案が有効な企業",
    scope: "company" as const,
    targetCount: 89,
    sourceContext: "Company" as const,
    linkedCompany: null,
    linkedCompanyId: null,
    linkedProject: null,
    linkedProjectId: null,
    owner: "田中 花子",
    lastUsed: "2026-03-11",
    updatedAt: "2026-03-13",
    reusableFlag: true,
  },
  {
    id: "aud_3",
    status: "draft" as const,
    name: "トレーニング要User",
    description: "利用開始後30日経過も習熟スコアが低いユーザー",
    scope: "user" as const,
    targetCount: 567,
    sourceContext: "Cluster" as const,
    linkedCompany: null,
    linkedCompanyId: null,
    linkedProject: null,
    linkedProjectId: null,
    owner: "鈴木 次郎",
    lastUsed: null,
    updatedAt: "2026-03-08",
    reusableFlag: false,
  },
  {
    id: "aud_4",
    status: "active" as const,
    name: "導入フェーズProject群",
    description: "Setup Phaseで進捗が遅延しているProject",
    scope: "project" as const,
    targetCount: 234,
    sourceContext: "Manual" as const,
    linkedCompany: null,
    linkedCompanyId: null,
    linkedProject: null,
    linkedProjectId: null,
    owner: "佐藤 太郎",
    lastUsed: "2026-03-09",
    updatedAt: "2026-03-10",
    reusableFlag: true,
  },
  {
    id: "aud_5",
    status: "archived" as const,
    name: "Q4 2025チャーン防止対象",
    description: "2025年Q4のチャーンリスク高Companyリスト（終了済み）",
    scope: "company" as const,
    targetCount: 45,
    sourceContext: "Company" as const,
    linkedCompany: null,
    linkedCompanyId: null,
    linkedProject: null,
    linkedProjectId: null,
    owner: "田中 花子",
    lastUsed: "2025-12-28",
    updatedAt: "2026-01-05",
    reusableFlag: false,
  },
];

export function Audience() {
  // Default View state
  const [currentView, setCurrentView] = useState("all");
  const currentUserName = "佐藤 太郎"; // Mock current user

  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAudience, setSelectedAudience] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // View definitions
  const views = [
    { value: "all", label: "All Audiences", description: "全Audience", isDefault: true },
    { value: "my", label: "My Audiences", description: "自分が作成したAudience" },
    { value: "recent", label: "Recently Used", description: "最近使用したAudience" },
    { value: "active", label: "Active Only", description: "アクティブなAudience" },
  ];

  // View configurations
  const viewConfig: Record<string, {
    subtitle: string;
    filter: (audience: typeof mockAudiences[0]) => boolean;
    emptyState: { title: string; description: string; cta: { label: string; action: () => void } | null };
  }> = {
    all: {
      subtitle: "すべてのAudienceを確認する",
      filter: (audience) => true,
      emptyState: {
        title: "Audienceがまだ登録されていません",
        description: "Audienceを作成すると、ここに表示されます",
        cta: null,
      },
    },
    my: {
      subtitle: "自分が作成したAudienceを確認する",
      filter: (audience) => audience.owner === currentUserName,
      emptyState: {
        title: "作成したAudienceはまだありません",
        description: "Audienceを作成すると、ここに表示されます",
        cta: { label: "All Audiences を見る", action: () => setCurrentView("all") },
      },
    },
    recent: {
      subtitle: "最近使用したAudienceを確認する",
      filter: (audience) => {
        if (!audience.lastUsed) return false;
        const lastUsedDate = new Date(audience.lastUsed);
        const daysSince = Math.floor((new Date().getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysSince <= 7;
      },
      emptyState: {
        title: "最近使用したAudienceはありません",
        description: "過去7日以内に使用したAudienceが表示されます",
        cta: { label: "All Audiences を見る", action: () => setCurrentView("all") },
      },
    },
    active: {
      subtitle: "アクティブなAudienceのみを確認する",
      filter: (audience) => audience.status === "active",
      emptyState: {
        title: "アクティブなAudienceはありません",
        description: "アクティブなAudienceが作成されると、ここに表示されます",
        cta: { label: "All Audiences を見る", action: () => setCurrentView("all") },
      },
    },
  };

  const config = viewConfig[currentView];
  const currentViewLabel = views.find(v => v.value === currentView)?.label || "";

  // 1st filter: View filter
  const viewFilteredAudiences = mockAudiences.filter(config.filter);

  // 2nd filter: Additional filters (status, scope, search)
  const filteredAudiences = viewFilteredAudiences.filter((audience) => {
    if (statusFilter !== "all" && audience.status !== statusFilter) return false;
    if (scopeFilter !== "all" && audience.scope !== scopeFilter) return false;
    if (searchQuery && !audience.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Calculate summary (use viewFilteredAudiences)
  const activeCount = viewFilteredAudiences.filter((a) => a.status === "active").length;
  const draftCount = viewFilteredAudiences.filter((a) => a.status === "draft").length;
  const totalUsers = viewFilteredAudiences.reduce((sum, a) => sum + a.targetCount, 0);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "未使用";
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "今日";
    if (diffDays === 1) return "昨日";
    if (diffDays < 7) return `${diffDays}日前`;
    return dateStr;
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "draft":
        return "secondary";
      case "archived":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case "user":
        return <Users className="w-4 h-4" />;
      case "company":
        return <Database className="w-4 h-4" />;
      case "project":
        return <Target className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  };

  const openDetail = (audienceId: string) => {
    setSelectedAudience(audienceId);
  };

  const selectedAudienceData = mockAudiences.find((a) => a.id === selectedAudience);

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Cross-scope" />
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Page Header */}
          <div className="bg-white border-b p-4">
            <div className="max-w-[1800px] mx-auto">
              <div className="flex items-center justify-between mb-4">
                <ViewContextHeader
                  pageName="Audience"
                  currentView={currentViewLabel}
                  subtitle={config.subtitle}
                />
                <div className="flex items-center gap-2">
                  <ViewSwitcher
                    currentView={currentView}
                    views={views}
                    onViewChange={setCurrentView}
                  />
                  <Button size="sm" className="text-xs" onClick={() => setCreateOpen(true)}>
                    <Plus className="w-3 h-3 mr-1" />
                    新規Audience作成
                  </Button>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="text-xs font-semibold text-emerald-900">Active</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-900">{activeCount}</div>
                  <div className="text-xs text-emerald-700">件のAudience</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-3.5 h-3.5 text-slate-700" />
                    <span className="text-xs font-semibold text-slate-900">Draft</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{draftCount}</div>
                  <div className="text-xs text-slate-700">件のAudience</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-3.5 h-3.5 text-blue-700" />
                    <span className="text-xs font-semibold text-blue-900">総対象数</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900">{totalUsers.toLocaleString()}</div>
                  <div className="text-xs text-blue-700">名・社</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-3.5 h-3.5 text-slate-700" />
                    <span className="text-xs font-semibold text-slate-900">全Audience</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{mockAudiences.length}</div>
                  <div className="text-xs text-slate-700">件</div>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    placeholder="Audience検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={scopeFilter} onValueChange={setScopeFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Scope</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="cluster">Cluster</SelectItem>
                  </SelectContent>
                </Select>
                {(statusFilter !== "all" || scopeFilter !== "all" || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => {
                      setStatusFilter("all");
                      setScopeFilter("all");
                      setSearchQuery("");
                    }}
                  >
                    フィルタクリア
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Main Content: Audience Table */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full max-w-[1800px] mx-auto p-4">
              <div className="bg-white border rounded-lg overflow-hidden h-full flex flex-col">
                <div className="flex-1 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead>Audience Name</TableHead>
                        <TableHead className="w-[100px]">Scope</TableHead>
                        <TableHead className="w-[120px]">Target Count</TableHead>
                        <TableHead className="w-[100px]">Source</TableHead>
                        <TableHead className="w-[200px]">Company/Project</TableHead>
                        <TableHead className="w-[100px]">Owner</TableHead>
                        <TableHead className="w-[100px]">Last Used</TableHead>
                        <TableHead className="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAudiences.map((audience) => (
                        <TableRow 
                          key={audience.id}
                          className="cursor-pointer hover:bg-slate-50"
                          onClick={() => navigate(`/audience/detail?id=${audience.id}`)}
                        >
                          <TableCell>
                            <Badge variant={getStatusVariant(audience.status)} className="text-xs">
                              {audience.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            <div className="line-clamp-1">{audience.name}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[200px]">
                              {audience.description}
                            </div>
                            {audience.reusableFlag && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                再利用可
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getScopeIcon(audience.scope)}
                              <Badge variant="outline" className="text-xs">{audience.scope}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-blue-600">
                              {audience.targetCount.toLocaleString()}件
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{audience.sourceContext}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {audience.linkedCompany && (
                              <Link
                                to={`/company/${audience.linkedCompanyId}`}
                                className="hover:underline text-blue-600"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {audience.linkedCompany}
                              </Link>
                            )}
                            {audience.linkedProject && (
                              <div className="text-slate-500 text-xs">
                                <Link
                                  to={`/project/${audience.linkedProjectId}`}
                                  className="hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {audience.linkedProject}
                                </Link>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-700">{audience.owner}</TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {formatDate(audience.lastUsed)}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1">
                              <Link 
                                to={`/audience/detail?id=${audience.id}`}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                >
                                  詳細
                                </Button>
                              </Link>
                              {audience.status === "active" && (
                                <Link 
                                  to={`/outbound/compose?fromAudience=${audience.id}`}
                                >
                                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-7 text-xs">
                                    使う
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="p-3 border-t text-center bg-slate-50">
                  <p className="text-sm text-slate-500">
                    {filteredAudiences.length}件を表示中
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Detail Sheet */}
      {selectedAudienceData && (
        <AudienceDetailSheet
          audience={selectedAudienceData}
          open={!!selectedAudience}
          onOpenChange={(open) => !open && setSelectedAudience(null)}
        />
      )}

      {/* Create Sheet */}
      <AudienceCreateSheet open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}