import { useState } from "react";
import { Link } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { Checkbox } from "../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import { ViewSwitcher } from "../components/ui/view-switcher";
import { ViewContextHeader } from "../components/ui/view-context-header";
import { ViewEmptyState } from "../components/ui/view-empty-state";
import { 
  Sparkles, 
  User, 
  Send, 
  Database, 
  CheckCircle2, 
  XCircle, 
  PauseCircle, 
  FileText, 
  Calendar, 
  Building, 
  Users, 
  AlertCircle,
  ExternalLink,
  Clock,
  TrendingUp,
  Edit3,
  Eye,
  ChevronRight,
  AlertTriangle,
  ShieldAlert,
  ArrowUpRight,
  Plus,
  Mail,
  Target,
  Link as LinkIcon
} from "lucide-react";

// モックデータ
const mockActions = [
  {
    id: "action-1",
    title: "オンボーディング進捗確認MTGのフォローアップメール",
    objective: "決裁者の山田氏との再接触を図り、プロジェクト推進の意欲を確認する",
    suggestedNextStep: "山田氏宛に個別MTG設定の提案メールを送信し、技術的な懸念点のヒアリングを実施する",
    actionType: "send_external" as const,
    status: "proposed" as const,
    priority: "high" as const,
    company: "株式会社テクノロジーイノベーション",
    companyId: "1",
    project: "プロジェクトA",
    people: ["山田 太郎", "田中 花子"],
    owner: "佐藤 太郎",
    dueDate: "2026-03-15",
    sourceType: "AI" as const,
    evidenceCount: 4,
    confidence: "high" as const,
    missingFields: [],
    aiRationale: "過去3回の会議で決裁者の山田氏が欠席しており、プロジェクトの優先度低下の兆候が見られます。早期の個別接触により、懸念点を把握し、関係性を再構築することが重要です。",
    relatedEvidence: [
      { id: "ev-1", title: "週次MTG議事録 - 山田氏欠席", date: "2026-03-10", excerpt: "決裁者の山田氏が3週連続で会議を欠席。理由は「他の予定が入った」とのこと。" },
      { id: "ev-2", title: "フォローアップメール未返信", date: "2026-03-08", excerpt: "進捗確認メールを送信したが、3日経過しても返信なし。" },
      { id: "ev-3", title: "技術仕様確認依頼 - 未回答", date: "2026-03-03", excerpt: "APIの仕様について質問したが、1週間経過しても回答がない。" },
      { id: "ev-4", title: "キックオフMTG議事録", date: "2026-02-20", excerpt: "山田氏：「セキュリティ面での懸念があるため、社内で慎重に検討したい」との発言。" },
    ],
    notes: "",
    contentJobId: null,
    scope: "Company",
  },
  {
    id: "action-2",
    title: "追加ライセンス提案資料の作成と商談設定",
    objective: "営業部長からの拡大希望を具体化し、追加ライセンス契約につなげる",
    suggestedNextStep: "他部署導入事例を含む提案資料を作成し、営業部長との商談MTGを設定する",
    actionType: "send_internal" as const,
    status: "reviewed" as const,
    priority: "high" as const,
    company: "グローバルソリューションズ株式会社",
    companyId: "2",
    project: null,
    people: ["鈴木 一郎 (営業長)"],
    owner: "田中 花子",
    dueDate: "2026-03-18",
    sourceType: "AI" as const,
    evidenceCount: 2,
    confidence: "high" as const,
    missingFields: [],
    aiRationale: "四半期レビューMTGで営業部長から「他部署での導入も検討したい」との明確な発言があり、拡大のタイミングとして最適です。",
    relatedEvidence: [
      { id: "ev-5", title: "四半期レビューMTG - 拡大希望", date: "2026-03-09", excerpt: "営業部長：「営業部で効果が出ているので、マーケティング部でも使いたい」" },
      { id: "ev-6", title: "他部署への紹介依頼メール", date: "2026-03-07", excerpt: "「マーケティング部長に紹介したいので、資料を送ってほしい」との依頼。" },
    ],
    notes: "提案資料は既存の成功事例を中心に構成する。価格は別途相談。",
    contentJobId: "content-001",
    scope: "Company",
  },
  {
    id: "action-3",
    title: "Salesforce商談ステージ更新提案",
    objective: "オンボーディング遅延の状況をSalesforceに反映し、営業チームと情報共有する",
    suggestedNextStep: "商談ステージを「At Risk」に変更し、営業担当に状況共有のメールを送信する",
    actionType: "push" as const,
    status: "approved" as const,
    priority: "medium" as const,
    company: "株式会社テクノロジーイノベーション",
    companyId: "1",
    project: "プロジェクトA",
    people: [],
    owner: "佐藤 太郎",
    dueDate: "2026-03-12",
    sourceType: "AI" as const,
    evidenceCount: 5,
    confidence: "medium" as const,
    missingFields: [],
    aiRationale: "オンボーディングが予定より2週間遅延しており、決裁者の関与も減少しています。営業チームとの早期連携が必要です。",
    relatedEvidence: [
      { id: "ev-1", title: "週次MTG議事録 - 山田氏欠席", date: "2026-03-10", excerpt: "決裁者の山田氏が3週連続で会議を欠席。" },
      { id: "ev-7", title: "進捗報告MTG - 遅延発覚", date: "2026-03-05", excerpt: "当初予定より2週間遅れていることが判明。" },
    ],
    notes: "営業担当の山本さんに事前に口頭で共有済み。",
    contentJobId: null,
    scope: "Company",
  },
  {
    id: "action-4",
    title: "追加トレーニングセッションの日程調整",
    objective: "ユーザーの習熟度を向上させ、活用促進を図る",
    suggestedNextStep: "田中様に追加トレーニングの日程候補を提案し、実施する",
    actionType: "send_external" as const,
    status: "approved" as const,
    priority: "high" as const,
    company: "株式会社テクノロジーイノベーション",
    companyId: "1",
    project: null,
    people: ["田中 花子"],
    owner: "佐藤 太郎",
    dueDate: "2026-03-20",
    sourceType: "AI" as const,
    evidenceCount: 3,
    confidence: "high" as const,
    missingFields: [],
    aiRationale: "田中様から追加トレーニングの要望があり、承認済みです。早期に実施することで顧客満足度の向上が見込まれます。",
    relatedEvidence: [
      { id: "ev-3", title: "メール: 追加トレーニング依頼", date: "2026-03-08", excerpt: "管理画面の操作方法について、追加のトレーニングを希望。" },
      { id: "ev-14", title: "週次MTG - トレーニング要望", date: "2026-03-06", excerpt: "複数のユーザーから操作方法の質問が増えている。" },
    ],
    notes: "承認済み。3月20日までに実施予定。",
    contentJobId: null,
    scope: "User",
  },
  {
    id: "action-4b",
    title: "データ移行完了通知とフォローアップ",
    objective: "データ移行完了を顧客に通知し、次のステップを案内する",
    suggestedNextStep: "データ移行完了のメールを送信し、本番環境での利用開始をサポートする",
    actionType: "send_external" as const,
    status: "draft" as const,
    priority: "low" as const,
    company: "グローバルソリューションズ株式会社",
    companyId: "2",
    project: null,
    people: ["鈴木 一郎"],
    owner: "田中 花子",
    dueDate: "2026-03-22",
    sourceType: "human" as const,
    evidenceCount: 1,
    confidence: "high" as const,
    missingFields: ["移行データ詳細"],
    aiRationale: "",
    relatedEvidence: [
      { id: "ev-15", title: "データ移行完了報告", date: "2026-03-11", excerpt: "全データの移行が完了しました。" },
    ],
    notes: "",
    contentJobId: null,
    scope: "Company",
  },
  {
    id: "action-5",
    title: "技術サポート対応状況のSalesforce記録",
    objective: "サポートチケットの対応状況を営業チームと共有する",
    suggestedNextStep: "解決済みチケットの内容をSalesforce Activityに記録する",
    actionType: "push" as const,
    status: "pushed" as const,
    priority: "low" as const,
    company: "株式会社メディカルテック",
    companyId: "8",
    project: null,
    people: [],
    owner: "田中 花子",
    dueDate: "2026-03-11",
    sourceType: "AI" as const,
    evidenceCount: 5,
    confidence: "high" as const,
    missingFields: [],
    aiRationale: "複数のサポートチケットが解決されたため、顧客対応履歴として記録することで、営業チームとの情報共有を図ります。",
    relatedEvidence: [
      { id: "ev-13", title: "サポートチケット #2847 - 解決", date: "2026-03-06", excerpt: "ログインエラーの原因を特定し、解決済み。" },
    ],
    notes: "",
    contentJobId: null,
    scope: "Company",
  },
];

const actionTypeConfig = {
  send_external: { label: "外部送信", color: "bg-red-100 text-red-800 border-red-200", isDangerous: true },
  send_internal: { label: "社内送信", color: "bg-emerald-100 text-emerald-800 border-emerald-200", isDangerous: false },
  push: { label: "Push", color: "bg-blue-100 text-blue-800 border-blue-200", isDangerous: false },
};

const statusConfig = {
  draft: { label: "下書き", color: "bg-slate-100 text-slate-700" },
  proposed: { label: "AI提案", color: "bg-blue-100 text-blue-700" },
  reviewed: { label: "レビュー済", color: "bg-purple-100 text-purple-700" },
  approved: { label: "承認済", color: "bg-emerald-100 text-emerald-700" },
  pushed: { label: "Push済", color: "bg-cyan-100 text-cyan-700" },
  synced: { label: "Sync済", color: "bg-slate-100 text-slate-700" },
  rejected: { label: "却下", color: "bg-red-100 text-red-700" },
};

const priorityColors = {
  high: "text-red-600",
  medium: "text-orange-600",
  low: "text-slate-600",
};

export function ActionReview() {
  // Default View state
  const [currentView, setCurrentView] = useState("my");
  const currentUserId = "user_1"; // Mock current user
  
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [reviewChecklist, setReviewChecklist] = useState({
    evidenceReviewed: false,
    scopeConfirmed: false,
    recipientVerified: false,
    contentApproved: false,
  });
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showHoldDialog, setShowHoldDialog] = useState(false);
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [showEvidencePanel, setShowEvidencePanel] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [syncConfirm, setSyncConfirm] = useState({
    dataConfirmed: false,
    salesforceConfirmed: false,
    understandIrreversible: false,
  });
  const [approvalConfirm, setApprovalConfirm] = useState({
    evidenceConfirmed: false,
    contentConfirmed: false,
    impactConfirmed: false,
  });
  const [pushConfirm, setPushConfirm] = useState({
    targetConfirmed: false,
    evidenceConfirmed: false,
    preconditionsConfirmed: false,
  });

  const [rejectReason, setRejectReason] = useState("");
  const [rejectPoints, setRejectPoints] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [holdReviewDate, setHoldReviewDate] = useState("");

  // View definitions
  const views = [
    { value: "my", label: "My Actions", description: "自分の担当Action", isDefault: true },
    { value: "assigned", label: "Assigned to me", description: "自分にアサインされたAction" },
    { value: "overdue", label: "Overdue", description: "期限超過のAction" },
    { value: "all", label: "All Actions", description: "全Action" },
  ];

  // View configurations
  const viewConfig: Record<string, {
    subtitle: string;
    filter: (action: typeof mockActions[0]) => boolean;
    emptyState: { title: string; description: string; cta: { label: string; action: () => void } | null };
  }> = {
    my: {
      subtitle: "自分の担当Actionの状況と優先度を確認する",
      filter: (action) => action.owner === "佐藤 太郎", // Mock
      emptyState: {
        title: "担当Actionはまだありません",
        description: "Actionが割り当てられると、ここに表示されます",
        cta: { label: "All Actions を見る", action: () => setCurrentView("all") },
      },
    },
    assigned: {
      subtitle: "自分にアサインされたActionを確認する",
      filter: (action) => action.owner === "佐藤 太郎" && (action.status === "proposed" || action.status === "reviewed"),
      emptyState: {
        title: "アサインされたActionはありません",
        description: "新しいActionがアサインされると、ここに表示されます",
        cta: { label: "My Actions を見る", action: () => setCurrentView("my") },
      },
    },
    overdue: {
      subtitle: "期限超過のActionを優先的に確認する",
      filter: (action) => new Date(action.dueDate) < new Date(),
      emptyState: {
        title: "期限超過のActionはありません",
        description: "期限超過が発生すると、ここに表示されます",
        cta: { label: "My Actions を見る", action: () => setCurrentView("my") },
      },
    },
    all: {
      subtitle: "すべてのActionを確認する",
      filter: (action) => true,
      emptyState: {
        title: "Actionがまだ登録されていません",
        description: "Actionが作成されると、ここに表示されます",
        cta: null,
      },
    },
  };

  const config = viewConfig[currentView];
  const currentViewLabel = views.find(v => v.value === currentView)?.label || "";

  // 1st filter: View filter
  const viewFilteredActions = mockActions.filter(config.filter);

  // 2nd filter: Additional filters (status, priority, search)
  const filteredActions = viewFilteredActions.filter(action => {
    if (filterStatus !== "all" && action.status !== filterStatus) return false;
    if (filterPriority !== "all" && action.priority !== filterPriority) return false;
    if (searchQuery && !action.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const selectedActionData = mockActions.find(a => a.id === selectedAction);
  const unreviewedCount = mockActions.filter(a => a.status === "proposed").length;
  const overdueCount = mockActions.filter(a => new Date(a.dueDate) < new Date()).length;
  const approvedCount = mockActions.filter(a => a.status === "approved").length;
  const canSync = selectedActionData?.status === "pushed" && selectedActionData.actionType === "push";
  const canPush = selectedActionData?.status === "approved";
  const canApprove = selectedActionData?.status === "reviewed" || selectedActionData?.status === "proposed";

  const handleRowClick = (actionId: string) => {
    setSelectedAction(actionId);
    setShowEditDrawer(true);
    setIsEditing(false);
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
                  pageName="Actions"
                  currentView={currentViewLabel}
                  subtitle={config.subtitle}
                />
                <div className="flex items-center gap-2">
                  <ViewSwitcher
                    currentView={currentView}
                    views={views}
                    onViewChange={setCurrentView}
                  />
                  <Button size="sm" className="text-xs" onClick={() => {
                    setSelectedAction(null);
                    setShowEditDrawer(true);
                    setIsEditing(true);
                  }}>
                    <Plus className="w-3 h-3 mr-1" />
                    新規Action
                  </Button>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-3.5 h-3.5 text-slate-700" />
                    <span className="text-xs font-semibold text-slate-900">Total in {currentViewLabel}</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{viewFilteredActions.length}</div>
                  <div className="text-xs text-slate-700">件</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                    <span className="text-xs font-semibold text-blue-900">AI提案</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900">
                    {viewFilteredActions.filter(a => a.status === "proposed").length}
                  </div>
                  <div className="text-xs text-blue-700">件</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                    <span className="text-xs font-semibold text-amber-900">期限超過</span>
                  </div>
                  <div className="text-2xl font-bold text-amber-900">
                    {viewFilteredActions.filter(a => new Date(a.dueDate) < new Date()).length}
                  </div>
                  <div className="text-xs text-amber-700">件</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="text-xs font-semibold text-emerald-900">承認済</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-900">
                    {viewFilteredActions.filter(a => a.status === "approved").length}
                  </div>
                  <div className="text-xs text-emerald-700">件</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters & Table */}
          <div className="flex-1 overflow-hidden flex flex-col p-4">
            <div className="max-w-[1800px] mx-auto w-full flex-1 overflow-hidden flex flex-col">
              {/* Filters */}
              <div className="flex items-center gap-3 mb-4">
                <Input
                  placeholder="検索..."
                  className="max-w-xs text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[180px] text-xs">
                    <SelectValue placeholder="ステータス" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべてのステータス</SelectItem>
                    <SelectItem value="proposed">AI提案</SelectItem>
                    <SelectItem value="reviewed">レビュー済</SelectItem>
                    <SelectItem value="approved">承認済</SelectItem>
                    <SelectItem value="pushed">Push済</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-[180px] text-xs">
                    <SelectValue placeholder="優先度" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての優先度</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="low">低</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table or Empty State */}
              {filteredActions.length === 0 ? (
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
                          <TableHead>Action Title</TableHead>
                          <TableHead className="w-[200px]">Company</TableHead>
                          <TableHead className="w-[100px]">Owner</TableHead>
                          <TableHead className="w-[100px]">Due Date</TableHead>
                          <TableHead className="w-[80px]">Priority</TableHead>
                          <TableHead className="w-[80px]">Scope</TableHead>
                          <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredActions.map((action) => {
                          const typeConfig = actionTypeConfig[action.actionType];
                          return (
                            <TableRow 
                              key={action.id}
                              className="cursor-pointer hover:bg-slate-50"
                              onClick={() => handleRowClick(action.id)}
                            >
                              <TableCell>
                                {action.sourceType === "AI" && (
                                  <Sparkles className="w-4 h-4 text-blue-600" />
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-xs ${statusConfig[action.status].color}`}>
                                  {statusConfig[action.status].label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-xs ${typeConfig.color}`}>
                                  {typeConfig.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium text-sm max-w-md">
                                <div className="line-clamp-2">{action.title}</div>
                              </TableCell>
                              <TableCell className="text-sm text-slate-700">
                                {action.company}
                              </TableCell>
                              <TableCell className="text-sm text-slate-700">
                                {action.owner}
                              </TableCell>
                              <TableCell className="text-sm text-slate-700">
                                {action.dueDate}
                              </TableCell>
                              <TableCell>
                                <span className={`text-sm font-medium ${priorityColors[action.priority]}`}>
                                  {action.priority === "high" && "高"}
                                  {action.priority === "medium" && "中"}
                                  {action.priority === "low" && "低"}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-slate-600">
                                {action.scope}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowClick(action.id);
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
                      {filteredActions.length}件を表示中
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Edit Drawer */}
      <Sheet open={showEditDrawer} onOpenChange={setShowEditDrawer}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto p-6">
          <SheetHeader>
            <SheetTitle>
              {selectedActionData ? "Action詳細・編集" : "新規Action作成"}
            </SheetTitle>
            <SheetDescription>
              {selectedActionData 
                ? "Actionの詳細を確認・編集できます" 
                : "新しいActionを作成します"}
            </SheetDescription>
          </SheetHeader>

          {/* 新規作成フォーム */}
          {!selectedActionData && (
            <div className="mt-6 space-y-6">
              {/* Action Type Selection */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">Action Type *</Label>
                <Select defaultValue="send_external">
                  <SelectTrigger className="mt-1 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="send_external">外部送信</SelectItem>
                    <SelectItem value="send_internal">社内送信</SelectItem>
                    <SelectItem value="push">Push (Salesforce等)</SelectItem>
                    <SelectItem value="task">タスク</SelectItem>
                    <SelectItem value="meeting">会議</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Action Title */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">Action Title *</Label>
                <Input
                  placeholder="例: オンボーディング進捗確認MTGのフォローアップメール"
                  className="mt-1 text-sm"
                />
              </div>

              {/* Objective */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">Objective (目的) *</Label>
                <Textarea
                  placeholder="このActionの目的を記入してください"
                  className="mt-1 text-sm"
                  rows={2}
                />
              </div>

              {/* Suggested Next Step */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">Suggested Next Step *</Label>
                <Textarea
                  placeholder="具体的な次のステップを記入してください"
                  className="mt-1 text-sm"
                  rows={3}
                />
              </div>

              <Separator />

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Company *</Label>
                  <Select>
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue placeholder="Companyを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">株式会社テクノロジーイノベーション</SelectItem>
                      <SelectItem value="2">グローバルソリューションズ株式会社</SelectItem>
                      <SelectItem value="3">デジタルマーケティング株式会社</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Project</Label>
                  <Select>
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue placeholder="Project (任意)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proj_1">プロジェクトA</SelectItem>
                      <SelectItem value="proj_2">プロジェクトB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Owner *</Label>
                  <Select defaultValue="佐藤 太郎">
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="佐藤 太郎">佐藤 太郎</SelectItem>
                      <SelectItem value="田中 花子">田中 花子</SelectItem>
                      <SelectItem value="鈴木 次郎">鈴木 次郎</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Due Date *</Label>
                  <Input
                    type="date"
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Priority *</Label>
                  <Select defaultValue="medium">
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">高</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="low">低</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Scope</Label>
                  <Select defaultValue="Company">
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Company">Company</SelectItem>
                      <SelectItem value="Project">Project</SelectItem>
                      <SelectItem value="User">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* People */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">People (対象者)</Label>
                <Input
                  placeholder="対象者の名前（カンマ区切り）"
                  className="mt-1 text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">例: 山田 太郎, 田中 花子</p>
              </div>

              <Separator />

              {/* Notes */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">Notes (メモ)</Label>
                <Textarea
                  placeholder="補足情報やメモを記入してください"
                  className="mt-1 text-sm"
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button size="sm" className="flex-1">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  作成
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => setShowEditDrawer(false)}
                >
                  キャンセル
                </Button>
              </div>
            </div>
          )}

          {/* 既存Action編集フォーム */}
          {selectedActionData && (
            <div className="mt-6 space-y-6">
              {/* Header Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${statusConfig[selectedActionData.status].color}`}>
                    {statusConfig[selectedActionData.status].label}
                  </Badge>
                  <Badge variant="outline" className={`text-xs ${actionTypeConfig[selectedActionData.actionType].color}`}>
                    {actionTypeConfig[selectedActionData.actionType].label}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Scope: {selectedActionData.scope}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={isEditing ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-xs"
                  >
                    {isEditing ? (
                      <>
                        <Eye className="w-3 h-3 mr-1" />
                        表示モード
                      </>
                    ) : (
                      <>
                        <Edit3 className="w-3 h-3 mr-1" />
                        編集モード
                      </>
                    )}
                  </Button>
                  <Link to={`/company/${selectedActionData.companyId}`}>
                    <Button variant="outline" size="sm" className="text-xs">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Company詳細
                    </Button>
                  </Link>
                </div>
              </div>

              <Separator />

              {/* Action Title */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">Action Title</Label>
                {isEditing ? (
                  <Input
                    defaultValue={selectedActionData.title}
                    className="mt-1 text-sm"
                  />
                ) : (
                  <p className="mt-1 text-sm font-medium text-slate-900">{selectedActionData.title}</p>
                )}
              </div>

              {/* Objective */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">Objective (目的)</Label>
                {isEditing ? (
                  <Textarea
                    defaultValue={selectedActionData.objective}
                    className="mt-1 text-sm"
                    rows={2}
                  />
                ) : (
                  <p className="mt-1 text-sm text-slate-700">{selectedActionData.objective}</p>
                )}
              </div>

              {/* Suggested Next Step */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">Suggested Next Step</Label>
                {isEditing ? (
                  <Textarea
                    defaultValue={selectedActionData.suggestedNextStep}
                    className="mt-1 text-sm"
                    rows={3}
                  />
                ) : (
                  <div className="mt-1 text-sm text-slate-700 bg-blue-50 p-3 rounded border border-blue-200">
                    {selectedActionData.suggestedNextStep}
                  </div>
                )}
              </div>

              <Separator />

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Company</Label>
                  <p className="mt-1 text-sm text-slate-900">{selectedActionData.company}</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Owner</Label>
                  {isEditing ? (
                    <Select defaultValue={selectedActionData.owner}>
                      <SelectTrigger className="mt-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="佐藤 太郎">佐藤 太郎</SelectItem>
                        <SelectItem value="田中 花子">田中 花子</SelectItem>
                        <SelectItem value="鈴木 次郎">鈴木 次郎</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="mt-1 text-sm text-slate-900">{selectedActionData.owner}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Due Date</Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      defaultValue={selectedActionData.dueDate}
                      className="mt-1 h-8 text-xs"
                    />
                  ) : (
                    <p className="mt-1 text-sm text-slate-900">{selectedActionData.dueDate}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Priority</Label>
                  {isEditing ? (
                    <Select defaultValue={selectedActionData.priority}>
                      <SelectTrigger className="mt-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">高</SelectItem>
                        <SelectItem value="medium">中</SelectItem>
                        <SelectItem value="low">低</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className={`mt-1 text-sm font-medium ${priorityColors[selectedActionData.priority]}`}>
                      {selectedActionData.priority === "high" && "高"}
                      {selectedActionData.priority === "medium" && "中"}
                      {selectedActionData.priority === "low" && "低"}
                    </p>
                  )}
                </div>
              </div>

              {/* People */}
              {selectedActionData.people.length > 0 && (
                <div>
                  <Label className="text-xs font-semibold text-slate-700">People</Label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedActionData.people.map((person, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {person}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* AI Rationale */}
              {selectedActionData.aiRationale && (
                <div>
                  <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI Rationale
                  </Label>
                  <div className="mt-1 text-sm text-slate-700 bg-blue-50 p-3 rounded border border-blue-200">
                    {selectedActionData.aiRationale}
                  </div>
                </div>
              )}

              {/* Related Evidence */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-2 block">
                  Related Evidence ({selectedActionData.relatedEvidence.length}件)
                </Label>
                <div className="space-y-2">
                  {selectedActionData.relatedEvidence.map((evidence) => (
                    <div key={evidence.id} className="border rounded-lg p-3 bg-slate-50">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="text-xs font-semibold text-slate-900">{evidence.title}</h4>
                        <span className="text-xs text-slate-500">{evidence.date}</span>
                      </div>
                      <p className="text-xs text-slate-600">{evidence.excerpt}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">Notes</Label>
                {isEditing ? (
                  <Textarea
                    defaultValue={selectedActionData.notes}
                    className="mt-1 text-sm"
                    rows={3}
                    placeholder="メモを入力..."
                  />
                ) : (
                  <p className="mt-1 text-sm text-slate-700">
                    {selectedActionData.notes || "なし"}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              {isEditing && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button size="sm" className="flex-1">
                    保存
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setIsEditing(false)}
                  >
                    キャンセル
                  </Button>
                </div>
              )}

              {!isEditing && (
                <div className="flex gap-2 pt-4 border-t">
                  {canApprove && (
                    <>
                      <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {selectedActionData.sourceType === "AI" ? "承認" : "確認完了"}
                      </Button>
                      {selectedActionData.sourceType === "AI" && selectedActionData.status === "reviewed" && (
                        <Button variant="outline" size="sm" className="flex-1">
                          <XCircle className="w-3 h-3 mr-1" />
                          差し戻し
                        </Button>
                      )}
                    </>
                  )}
                  {(canPush || selectedActionData.status === "approved") && selectedActionData.actionType === "send_external" && (
                    <Link to={`/outbound/compose?fromAction=${selectedActionData.id}`} className="flex-1">
                      <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700">
                        <Send className="w-3 h-3 mr-1" />
                        Outbound起票
                      </Button>
                    </Link>
                  )}
                  {selectedActionData.actionType === "push" && canPush && (
                    <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700">
                      <Send className="w-3 h-3 mr-1" />
                      Push実行
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit3 className="w-3 h-3 mr-1" />
                    編集
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}