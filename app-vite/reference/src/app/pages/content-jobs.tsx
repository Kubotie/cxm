import { useState } from "react";
import { Link } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { ViewSwitcher } from "../components/ui/view-switcher";
import { ViewContextHeader } from "../components/ui/view-context-header";
import { ViewEmptyState } from "../components/ui/view-empty-state";
import {
  Sparkles,
  FileText,
  MessageSquare,
  HelpCircle,
  GraduationCap,
  FileSearch,
  Lightbulb,
  Building,
  User,
  Calendar,
  Edit3,
  Database,
  Send,
  Eye,
} from "lucide-react";
import { ContentNewDraftDrawer } from "../components/content/content-new-draft-drawer";
import { ContentEditDrawer } from "../components/content/content-edit-drawer";

// モックデータ
const mockContentDrafts = [
  {
    id: "draft-1",
    name: "オンボーディング進捗確認フォローアップ",
    draftType: "message" as const,
    status: "draft" as const,
    company: "株式会社テクノロジーイノベーション",
    companyId: "1",
    linkedProject: "プロジェクトA",
    linkedUser: "山田 太郎（決裁者）",
    owner: "佐藤 太郎",
    lastEdited: "2026-03-16 14:30",
    aiGenerated: true,
    aiFunction: "generate" as const,
    preview: "山田様、いつもお世話になっております。先日のオンボーディングMTGでは...",
  },
  {
    id: "draft-2",
    name: "追加ライセンス提案資料",
    draftType: "proposal" as const,
    status: "in_review" as const,
    company: "グローバルソリューションズ株式会社",
    companyId: "2",
    linkedProject: "プロジェクトB",
    linkedUser: null,
    owner: "田中 花子",
    lastEdited: "2026-03-15 16:45",
    aiGenerated: true,
    aiFunction: "proposal_convert" as const,
    preview: "【背景】四半期レビューMTGで営業部長の鈴木様から、マーケティング部でも...",
    kocoroOutput: {
      agentName: "Proposal Generator Pro",
      outputType: "mixed" as const,
      textOutput: "【提案概要】\n現在のご利用状況から、マーケティング部門への展開により、以下の効果が期待できます：\n\n1. マーケティング部門の生産性向上\n2. 部門間のデータ連携強化\n3. 統一されたワークフロー導入による効率化\n\n【ライセンス追加プラン】\n- ビジネスプラン: 10ライセンス\n- 月額費用: ¥150,000（税抜）\n- 初期設定サポート: 無料",
      files: [
        {
          id: "file-1",
          name: "追加ライセンス提案書_詳細版.pptx",
          type: "pptx" as const,
          size: "2.4 MB",
          createdAt: "2026-03-15 16:30",
          downloadUrl: "#",
        },
        {
          id: "file-2",
          name: "価格見積書.pdf",
          type: "pdf" as const,
          size: "458 KB",
          createdAt: "2026-03-15 16:30",
          downloadUrl: "#",
        },
      ],
      runInfo: {
        executedAt: "2026-03-15 16:30:00",
        duration: "45.2秒",
        status: "success" as const,
        cost: "¥120",
      },
    },
  },
  {
    id: "draft-3",
    name: "FAQ: ログインエラー対応",
    draftType: "faq" as const,
    status: "approved" as const,
    company: "株式会社メディカルテック",
    companyId: "8",
    linkedProject: null,
    linkedUser: null,
    owner: "鈴木 次郎",
    lastEdited: "2026-03-14 11:20",
    aiGenerated: true,
    aiFunction: "faq_convert" as const,
    preview: "Q: ログインエラーが発生します。A: 特定のブラウザ���境で発生する既知の問題です...",
  },
  {
    id: "draft-4",
    name: "製品アップデート通知文面",
    draftType: "message" as const,
    status: "draft" as const,
    company: "株式会社テクノロジーイノベーション",
    companyId: "1",
    linkedProject: null,
    linkedUser: null,
    owner: "佐藤 太郎",
    lastEdited: "2026-03-16 09:15",
    aiGenerated: false,
    aiFunction: null,
    preview: "【製品アップデートのお知らせ】いつもご利用いただきありがとうございます...",
  },
  {
    id: "draft-5",
    name: "活用促進ガイドの要約版",
    draftType: "summary" as const,
    status: "draft" as const,
    company: "デジタルマーケティング株式会社",
    companyId: "3",
    linkedProject: null,
    linkedUser: null,
    owner: "田中 花子",
    lastEdited: "2026-03-13 15:00",
    aiGenerated: true,
    aiFunction: "summarize" as const,
    preview: "活用ガイドのポイント: 1. ダッシュボードのカスタマイズ 2. レポート自動生成...",
  },
];

const draftTypeConfig = {
  message: { label: "Message", icon: MessageSquare, color: "bg-blue-100 text-blue-800 border-blue-200" },
  proposal: { label: "Proposal", icon: FileText, color: "bg-purple-100 text-purple-800 border-purple-200" },
  faq: { label: "FAQ", icon: HelpCircle, color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  help: { label: "Help", icon: GraduationCap, color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  onboarding: { label: "Onboarding", icon: GraduationCap, color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  summary: { label: "Summary", icon: FileSearch, color: "bg-amber-100 text-amber-800 border-amber-200" },
  custom: { label: "Custom", icon: Lightbulb, color: "bg-slate-100 text-slate-800 border-slate-200" },
};

const statusConfig = {
  draft: { label: "下書き", color: "bg-slate-100 text-slate-700" },
  in_review: { label: "レビュー中", color: "bg-blue-100 text-blue-700" },
  approved: { label: "承認済", color: "bg-emerald-100 text-emerald-700" },
};

const aiFunctionLabels = {
  generate: "AI生成",
  summarize: "AI要約",
  rephrase: "AI言い換え",
  tone: "AIトーン調整",
  faq_convert: "AI FAQ化",
  help_convert: "AI Help化",
  proposal_convert: "AI提案化",
  customize: "AIカスタマイズ",
};

export function ContentJobs() {
  // Default View state
  const [currentView, setCurrentView] = useState("my");
  const currentUserId = "user_1"; // Mock current user
  const currentUserName = "佐藤 太郎"; // Mock

  const [showNewDraftDrawer, setShowNewDraftDrawer] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [selectedContent, setSelectedContent] = useState<typeof mockContentDrafts[0] | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // View definitions
  const views = [
    { value: "my", label: "My Content", description: "自分が作成したContent", isDefault: true },
    { value: "drafts", label: "All Drafts", description: "下書き状態のContent" },
    { value: "review", label: "Review Queue", description: "レビュー待ちのContent" },
    { value: "all", label: "All Content", description: "全Content" },
  ];

  // View configurations
  const viewConfig: Record<string, {
    subtitle: string;
    filter: (draft: typeof mockContentDrafts[0]) => boolean;
    emptyState: { title: string; description: string; cta: { label: string; action: () => void } | null };
  }> = {
    my: {
      subtitle: "自分が作成したContentの作業状況を確認する",
      filter: (draft) => draft.owner === currentUserName,
      emptyState: {
        title: "作成したContentはまだありません",
        description: "AIで新規作成すると、ここに表示されます",
        cta: { label: "All Content を見る", action: () => setCurrentView("all") },
      },
    },
    drafts: {
      subtitle: "下書き状態のContentを確認する",
      filter: (draft) => draft.status === "draft",
      emptyState: {
        title: "下書き状態のContentはありません",
        description: "下書きが作成されると、ここに表示されます",
        cta: { label: "My Content を見る", action: () => setCurrentView("my") },
      },
    },
    review: {
      subtitle: "レビュー待ちのContentを確認する",
      filter: (draft) => draft.status === "in_review",
      emptyState: {
        title: "レビュー待ちのContentはありません",
        description: "レビューが必要なContentが発生すると、ここに表示されます",
        cta: { label: "My Content を見る", action: () => setCurrentView("my") },
      },
    },
    all: {
      subtitle: "すべてのContentを確認する",
      filter: (draft) => true,
      emptyState: {
        title: "Contentがまだ登録されていません",
        description: "Contentが作成されると、ここに表示されます",
        cta: null,
      },
    },
  };

  const config = viewConfig[currentView];
  const currentViewLabel = views.find(v => v.value === currentView)?.label || "";

  // 1st filter: View filter
  const viewFilteredDrafts = mockContentDrafts.filter(config.filter);

  // 2nd filter: Additional filters (status, type, search)
  const filteredDrafts = viewFilteredDrafts.filter(draft => {
    if (filterStatus !== "all" && draft.status !== filterStatus) return false;
    if (filterType !== "all" && draft.draftType !== filterType) return false;
    if (searchQuery && !draft.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Calculate summary (use viewFilteredDrafts)
  const draftCount = viewFilteredDrafts.filter(d => d.status === "draft").length;
  const reviewCount = viewFilteredDrafts.filter(d => d.status === "in_review").length;
  const approvedCount = viewFilteredDrafts.filter(d => d.status === "approved").length;

  const handleRowClick = (draft: typeof mockContentDrafts[0]) => {
    setSelectedContent(draft);
    setShowEditDrawer(true);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Mixed" />
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Page Header */}
          <div className="bg-white border-b p-4">
            <div className="max-w-[1800px] mx-auto">
              <div className="flex items-center justify-between mb-4">
                <ViewContextHeader
                  pageName="Content"
                  currentView={currentViewLabel}
                  subtitle={config.subtitle}
                />
                <div className="flex items-center gap-2">
                  <ViewSwitcher
                    currentView={currentView}
                    views={views}
                    onViewChange={setCurrentView}
                  />
                  <Button 
                    size="sm" 
                    className="text-xs"
                    onClick={() => setShowNewDraftDrawer(true)}
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    AIで新規作成
                  </Button>
                </div>
              </div>

              {/* Role Explanation */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
                    <div>
                      <div className="font-semibold text-purple-900 mb-0.5">Content（ここ）</div>
                      <div className="text-purple-700">AIで作業中の下書きを生成・調整</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Database className="w-4 h-4 text-slate-600 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-900 mb-0.5">Library</div>
                      <div className="text-slate-600">再利用資産を保存・管理</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Send className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div>
                      <div className="font-semibold text-blue-900 mb-0.5">Outbound</div>
                      <div className="text-blue-600">顧客への送信実行・配信管理</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-3.5 h-3.5 text-slate-700" />
                    <span className="text-xs font-semibold text-slate-900">下書き</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{draftCount}</div>
                  <div className="text-xs text-slate-700">件</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="w-3.5 h-3.5 text-blue-700" />
                    <span className="text-xs font-semibold text-blue-900">レビュー中</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900">{reviewCount}</div>
                  <div className="text-xs text-blue-700">件</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="text-xs font-semibold text-emerald-900">承認済</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-900">{approvedCount}</div>
                  <div className="text-xs text-emerald-700">件</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                    <span className="text-xs font-semibold text-purple-900">AI生成済</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-900">
                    {mockContentDrafts.filter(d => d.aiGenerated).length}
                  </div>
                  <div className="text-xs text-purple-700">件</div>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Content検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-xs h-8 text-xs"
                />
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべてのStatus</SelectItem>
                    <SelectItem value="draft">下書き</SelectItem>
                    <SelectItem value="in_review">レビュー中</SelectItem>
                    <SelectItem value="approved">承認済</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべてのType</SelectItem>
                    <SelectItem value="message">Message</SelectItem>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="faq">FAQ</SelectItem>
                    <SelectItem value="help">Help</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="summary">Summary</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {(filterStatus !== "all" || filterType !== "all" || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => {
                      setFilterStatus("all");
                      setFilterType("all");
                      setSearchQuery("");
                    }}
                  >
                    フィルタクリア
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Main Content: Drafts Table */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full max-w-[1800px] mx-auto p-4">
              {filteredDrafts.length === 0 ? (
                <ViewEmptyState
                  title={config.emptyState.title}
                  description={config.emptyState.description}
                  currentView={currentViewLabel}
                  cta={config.emptyState.cta}
                />
              ) : (
                <div className="bg-white border rounded-lg overflow-hidden h-full flex flex-col">
                  <div className="flex-1 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]"></TableHead>
                          <TableHead className="w-[100px]">Status</TableHead>
                          <TableHead className="w-[120px]">Type</TableHead>
                          <TableHead>Draft Name</TableHead>
                          <TableHead className="w-[200px]">Company</TableHead>
                          <TableHead className="w-[140px]">Linked</TableHead>
                          <TableHead className="w-[100px]">Owner</TableHead>
                          <TableHead className="w-[140px]">Last Edited</TableHead>
                          <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDrafts.map((draft) => {
                          const typeConfig = draftTypeConfig[draft.draftType];
                          const TypeIcon = typeConfig.icon;
                          return (
                            <TableRow 
                              key={draft.id}
                              className="cursor-pointer hover:bg-slate-50"
                              onClick={() => handleRowClick(draft)}
                            >
                              <TableCell>
                                {draft.aiGenerated && (
                                  <Sparkles className="w-4 h-4 text-purple-600" />
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-xs ${statusConfig[draft.status].color}`}>
                                  {statusConfig[draft.status].label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-xs ${typeConfig.color}`}>
                                  <TypeIcon className="w-3 h-3 mr-1" />
                                  {typeConfig.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium text-sm">
                                <div className="mb-1">{draft.name}</div>
                                {draft.aiFunction && (
                                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                    {aiFunctionLabels[draft.aiFunction]}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                <Link 
                                  to={`/company/${draft.companyId}`}
                                  className="text-blue-600 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {draft.company}
                                </Link>
                              </TableCell>
                              <TableCell className="text-xs text-slate-600">
                                {draft.linkedProject && (
                                  <div className="flex items-center gap-1 mb-1">
                                    <Building className="w-3 h-3" />
                                    {draft.linkedProject}
                                  </div>
                                )}
                                {draft.linkedUser && (
                                  <div className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {draft.linkedUser}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-slate-700">
                                {draft.owner}
                              </TableCell>
                              <TableCell className="text-sm text-slate-700">
                                {draft.lastEdited}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowClick(draft);
                                  }}
                                >
                                  <Edit3 className="w-3 h-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="p-3 border-t text-center bg-slate-50">
                    <p className="text-sm text-slate-500">
                      {filteredDrafts.length}件を表示中
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* New Draft Drawer */}
      <ContentNewDraftDrawer 
        open={showNewDraftDrawer}
        onOpenChange={setShowNewDraftDrawer}
      />

      {/* Edit Draft Drawer */}
      <ContentEditDrawer
        open={showEditDrawer}
        onOpenChange={setShowEditDrawer}
        content={selectedContent}
      />
    </div>
  );
}