import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import {
  Sparkles,
  FileText,
  MessageSquare,
  HelpCircle,
  GraduationCap,
  FileSearch,
  Lightbulb,
  Building,
  FolderOpen,
  User,
  Save,
  Send,
  Database,
  X,
  Plus,
  Trash2,
  FileCode,
  FileType,
  Sheet as SheetIcon,
  Presentation,
  FileJson,
  ChevronRight,
  Wand2,
  Search,
  Target,
  Inbox as InboxIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  BookMarked,
  Users,
  Eye,
  Code,
  Download,
  Info,
  Route,
  Zap,
  Calendar,
} from "lucide-react";
import { useNavigate } from "react-router";

interface ContentNewDraftDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DraftType = "message" | "proposal" | "faq" | "help" | "onboarding" | "summary" | "custom";
type FileFormat = "text" | "markdown" | "pdf" | "pptx" | "docx" | "json" | "txt";

interface EvidenceItem {
  id: string;
  type: "action" | "log" | "inbox" | "library" | "event";
  title: string;
  date: string;
  source?: string;
  status?: string;
  priority?: string;
  sender?: string;
  category?: string;
  contentType?: string;
  author?: string;
  eventType?: string;
  targetCount?: number;
}

const draftTypeConfig: Record<DraftType, { label: string; icon: any; description: string; color: string }> = {
  message: {
    label: "Message Draft",
    icon: MessageSquare,
    description: "顧客向けメッセージの下書き",
    color: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  },
  proposal: {
    label: "Proposal Draft",
    icon: FileText,
    description: "提案資料・セールス資料の素案",
    color: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
  },
  faq: {
    label: "FAQ Draft",
    icon: HelpCircle,
    description: "FAQ記事の下書き",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  },
  help: {
    label: "Help Draft",
    icon: GraduationCap,
    description: "ヘルプ記事の下書き",
    color: "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100",
  },
  onboarding: {
    label: "Onboarding Draft",
    icon: GraduationCap,
    description: "オンボーディング資料の下書き",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100",
  },
  summary: {
    label: "Summary Draft",
    icon: FileSearch,
    description: "要約・レポートの下書き",
    color: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  },
  custom: {
    label: "Custom Draft",
    icon: Lightbulb,
    description: "カスタム下書き",
    color: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
  },
};

const fileFormatConfig: Record<FileFormat, { label: string; icon: any; description: string }> = {
  text: {
    label: "テキスト",
    icon: FileType,
    description: "プレーンテキスト（編集画面内）",
  },
  markdown: {
    label: "Markdown",
    icon: FileCode,
    description: ".mdファイル",
  },
  pdf: {
    label: "PDF",
    icon: FileText,
    description: ".pdfファイル",
  },
  pptx: {
    label: "PowerPoint",
    icon: Presentation,
    description: ".pptxファイル",
  },
  docx: {
    label: "Word",
    icon: FileText,
    description: ".docxファイル",
  },
  json: {
    label: "JSON",
    icon: FileJson,
    description: ".jsonファイル（データ形式）",
  },
  txt: {
    label: "TXT",
    icon: FileType,
    description: ".txtファイル",
  },
};

// モックのAction/Log/Inboxデータ
const mockEvidenceData: EvidenceItem[] = [
  // Actions
  {
    id: "act-1",
    type: "action",
    title: "四半期レビューMTG議事録の作成",
    date: "2026-03-15",
    source: "Actions",
    status: "完了",
    priority: "高",
  },
  {
    id: "act-2",
    type: "action",
    title: "営業部長からの追加ライセンス要望への対応",
    date: "2026-03-14",
    source: "Actions",
    status: "進行中",
    priority: "中",
  },
  {
    id: "act-3",
    type: "action",
    title: "オンボーディングMTG記録の整理",
    date: "2026-03-12",
    source: "Actions",
    status: "完了",
    priority: "高",
  },
  {
    id: "act-4",
    type: "action",
    title: "製品アップデート説明資料の作成",
    date: "2026-03-11",
    source: "Actions",
    status: "進行中",
    priority: "中",
  },
  // Logs
  {
    id: "log-1",
    type: "log",
    title: "ログイン問題のサポートチケット #1234",
    date: "2026-03-13",
    source: "Support Ticket",
    status: "解決済み",
    priority: "低",
  },
  {
    id: "log-2",
    type: "log",
    title: "機能活用状況レポート",
    date: "2026-03-10",
    source: "Analytics",
    status: "確認済み",
    priority: "中",
  },
  {
    id: "log-3",
    type: "log",
    title: "APIエラーログ分析結果",
    date: "2026-03-09",
    source: "System Logs",
    status: "対応中",
    priority: "高",
  },
  // Inbox
  {
    id: "inbox-1",
    type: "inbox",
    title: "Re: 新機能のトライアル期間延長について",
    date: "2026-03-16",
    source: "Email",
    sender: "山田 太郎 (決裁者)",
    category: "Question",
  },
  {
    id: "inbox-2",
    type: "inbox",
    title: "管理画面のUI改善要望",
    date: "2026-03-15",
    source: "Email",
    sender: "佐藤 花子 (担当者)",
    category: "Feature Request",
  },
  {
    id: "inbox-3",
    type: "inbox",
    title: "月次レポートの提出依頼",
    date: "2026-03-14",
    source: "Email",
    sender: "田中 一郎 (CTO)",
    category: "Request",
  },
  {
    id: "inbox-4",
    type: "inbox",
    title: "セキュリティ監査の日程調整",
    date: "2026-03-13",
    source: "Email",
    sender: "鈴木 次郎 (セキュリティ担当)",
    category: "Meeting",
  },
  {
    id: "inbox-5",
    type: "inbox",
    title: "契約更新に関するご相談",
    date: "2026-03-12",
    source: "Email",
    sender: "高橋 三郎 (CFO)",
    category: "Contract",
  },
  // Library
  {
    id: "lib-1",
    type: "library",
    title: "製品紹介スライドテンプレート",
    date: "2026-03-10",
    source: "Library",
    contentType: "Presentation",
    author: "営業チーム",
    category: "Template",
  },
  {
    id: "lib-2",
    type: "library",
    title: "オンボーディングチェックリスト",
    date: "2026-03-08",
    source: "Library",
    contentType: "Document",
    author: "CS チーム",
    category: "Checklist",
  },
  {
    id: "lib-3",
    type: "library",
    title: "FAQ: ログイン・認証関連",
    date: "2026-03-05",
    source: "Library",
    contentType: "FAQ",
    author: "サポートチーム",
    category: "Knowledge Base",
  },
  {
    id: "lib-4",
    type: "library",
    title: "契約更新提案メールテンプレート",
    date: "2026-03-03",
    source: "Library",
    contentType: "Email Template",
    author: "営業チーム",
    category: "Template",
  },
  {
    id: "lib-5",
    type: "library",
    title: "ヘルスチェック診断レポート雛形",
    date: "2026-03-01",
    source: "Library",
    contentType: "Report Template",
    author: "CS チーム",
    category: "Template",
  },
  {
    id: "lib-6",
    type: "library",
    title: "アップセル提案スクリプト",
    date: "2026-02-28",
    source: "Library",
    contentType: "Script",
    author: "営業チーム",
    category: "Sales Enablement",
  },
  // Event
  {
    id: "evt-1",
    type: "event",
    title: "Q2製品アップデート案内",
    date: "2026-04-01",
    source: "Event",
    status: "開催中",
    priority: "高",
    eventType: "Product Update",
    targetCount: 300,
  },
  {
    id: "evt-2",
    type: "event",
    title: "新規顧客向けWebinar「はじめての活用術」",
    date: "2026-03-20",
    source: "Event",
    status: "開催中",
    priority: "高",
    eventType: "Webinar",
    targetCount: 82,
  },
  {
    id: "evt-3",
    type: "event",
    title: "ユーザー会2026春",
    date: "2026-04-15",
    source: "Event",
    status: "準備中",
    priority: "中",
    eventType: "User Conference",
    targetCount: 150,
  },
  {
    id: "evt-4",
    type: "event",
    title: "セキュリティアップデート通知",
    date: "2026-03-25",
    source: "Event",
    status: "完了",
    priority: "高",
    eventType: "Security Update",
    targetCount: 1200,
  },
];

export function ContentNewDraftDrawer({ open, onOpenChange }: ContentNewDraftDrawerProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  
  // Step 1: コンテンツ種別選択
  const [draftType, setDraftType] = useState<DraftType | null>(null);
  const [fileFormat, setFileFormat] = useState<FileFormat>("text");
  
  // Step 2: 文脈紐付け
  const [company, setCompany] = useState("");
  const [project, setProject] = useState("");
  const [linkedUser, setLinkedUser] = useState("");
  const [linkedAudience, setLinkedAudience] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem[]>([]);
  
  // Action/Log search and filter
  const [actionSearchQuery, setActionSearchQuery] = useState("");
  const [actionTypeFilter, setActionTypeFilter] = useState<"all" | "action" | "log" | "inbox" | "library" | "event">("all");
  
  // Step 3: ワークスペース
  const [draftName, setDraftName] = useState("");
  const [adjustmentPrompt, setAdjustmentPrompt] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleClose = () => {
    // Reset all state
    setStep(1);
    setDraftType(null);
    setFileFormat("text");
    setCompany("");
    setProject("");
    setLinkedUser("");
    setLinkedAudience("");
    setSelectedEvidence([]);
    setDraftName("");
    setAdjustmentPrompt("");
    setDraftContent("");
    setIsGenerating(false);
    onOpenChange(false);
  };

  const handleAddEvidence = (evidence: EvidenceItem) => {
    if (!selectedEvidence.find(e => e.id === evidence.id)) {
      setSelectedEvidence([...selectedEvidence, evidence]);
    }
  };

  const handleRemoveEvidence = (evidenceId: string) => {
    setSelectedEvidence(selectedEvidence.filter(e => e.id !== evidenceId));
  };

  const handleGenerateContent = () => {
    setIsGenerating(true);
    // Simulate AI generation
    setTimeout(() => {
      const mockContent = `【${draftType ? draftTypeConfig[draftType].label : "Draft"}】

${company ? `対象企業: ${company}\n` : ""}${project ? `関連プロジェクト: ${project}\n` : ""}${linkedUser ? `宛先: ${linkedUser}\n` : ""}
${selectedEvidence.length > 0 ? `\n参照Evidence: ${selectedEvidence.length}件\n` : ""}
${adjustmentPrompt ? `\n調整指示: ${adjustmentPrompt}\n` : ""}

---

いつもお世話になっております。

${draftType === "proposal" ? "以下、ご提案させていただきます：\n\n" : ""}
この度は、貴社の${project || "プロジェクト"}について、ご連絡させていただきます。

[ここにAI生成されたコンテンツが表示されます]

引き続きよろしくお願いいたします。
`;
      setDraftContent(mockContent);
      setIsGenerating(false);
    }, 1500);
  };

  const handleSaveDraft = () => {
    console.log("下書き保存", { draftType, draftName, company, project, selectedEvidence });
    handleClose();
  };

  const handleSaveToLibrary = () => {
    console.log("Libraryに登録", { draftType, draftName });
    navigate("/library");
    handleClose();
  };

  const handleSendToOutbound = () => {
    console.log("Outboundに渡す", { draftType, draftName });
    navigate("/outbound/compose");
    handleClose();
  };

  const canProceedStep1 = draftType !== null;
  const canProceedStep2 = true; // 文脈は任意
  const canSave = draftName.trim() !== "";

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-[1000px] sm:max-w-[1000px] overflow-y-auto p-0">
        <div className="sticky top-0 bg-white z-10 border-b px-6 py-4">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <SheetTitle>AIで新規作成</SheetTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <SheetDescription>
              AIを使って、顧客文脈つきの作業中コンテンツを作成・調整・カスタマイズできます
            </SheetDescription>
          </SheetHeader>

          {/* Step Indicator */}
          <div className="flex items-center gap-2 mt-4">
            <div className={`flex items-center gap-1.5 ${step >= 1 ? "text-blue-600" : "text-slate-400"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${step >= 1 ? "bg-blue-600 text-white" : "bg-slate-200"}`}>
                1
              </div>
              <span className="text-xs font-medium">種別選択</span>
            </div>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <div className={`flex items-center gap-1.5 ${step >= 2 ? "text-blue-600" : "text-slate-400"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${step >= 2 ? "bg-blue-600 text-white" : "bg-slate-200"}`}>
                2
              </div>
              <span className="text-xs font-medium">文脈紐付け</span>
            </div>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <div className={`flex items-center gap-1.5 ${step >= 3 ? "text-blue-600" : "text-slate-400"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${step >= 3 ? "bg-blue-600 text-white" : "bg-slate-200"}`}>
                3
              </div>
              <span className="text-xs font-medium">ワークスペース</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          {/* Step 1: コンテンツ種別選択 */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Draft Type Selection */}
              <div>
                <Label className="text-sm font-semibold text-slate-900 mb-3 block">
                  作成するコンテンツの種別を選択 *
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(draftTypeConfig) as DraftType[]).map((type) => {
                    const config = draftTypeConfig[type];
                    const Icon = config.icon;
                    const isSelected = draftType === type;
                    return (
                      <button
                        key={type}
                        onClick={() => setDraftType(type)}
                        className={`
                          p-4 rounded-lg border-2 text-left transition-all
                          ${isSelected 
                            ? "border-purple-500 bg-purple-50" 
                            : "border-slate-200 bg-white hover:border-slate-300"
                          }
                        `}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${config.color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-900 mb-1">
                              {config.label}
                            </div>
                            <div className="text-xs text-slate-600">
                              {config.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* File Format Selection */}
              <div>
                <Label className="text-sm font-semibold text-slate-900 mb-2 block">
                  出力形式を選択
                </Label>
                <p className="text-xs text-slate-500 mb-3">
                  ファイル形式を選択できます（デフォルト: テキスト）
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(fileFormatConfig) as FileFormat[]).map((format) => {
                    const config = fileFormatConfig[format];
                    const Icon = config.icon;
                    const isSelected = fileFormat === format;
                    return (
                      <button
                        key={format}
                        onClick={() => setFileFormat(format)}
                        className={`
                          p-3 rounded-lg border text-left transition-all text-xs
                          ${isSelected 
                            ? "border-blue-500 bg-blue-50" 
                            : "border-slate-200 bg-white hover:border-slate-300"
                          }
                        `}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-slate-600" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900">
                              {config.label}
                            </div>
                            <div className="text-slate-500 mt-0.5">
                              {config.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                  className="flex-1"
                >
                  次へ：文脈紐付け
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  キャンセル
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: 文脈紐付け */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Selected Settings Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="text-xs font-semibold text-slate-600 mb-2">選択した設定</div>
                <div className="flex flex-wrap gap-2">
                  {draftType && (
                    <Badge variant="outline" className={draftTypeConfig[draftType].color}>
                      {draftTypeConfig[draftType].label}
                    </Badge>
                  )}
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {fileFormatConfig[fileFormat].label}
                  </Badge>
                </div>
              </div>

              {/* Context: Company / Project / User */}
              <div>
                <Label className="text-sm font-semibold text-slate-900 mb-3 block">
                  文脈の紐付け（任意）
                </Label>
                <p className="text-xs text-slate-500 mb-3">
                  AIがこれらの情報を参照します。すべて任意です。
                </p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-600 mb-1 flex items-center gap-1">
                        <Building className="w-3 h-3" />
                        Company
                      </Label>
                      <Select value={company} onValueChange={setCompany}>
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue placeholder="選択（任意）" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">--- 選択なし ---</SelectItem>
                          <SelectItem value="1">株式会社テクノロジーイノベーション</SelectItem>
                          <SelectItem value="2">グローバルソリューションズ株式会社</SelectItem>
                          <SelectItem value="3">デジタルマーケティング株式会社</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600 mb-1 flex items-center gap-1">
                        <FolderOpen className="w-3 h-3" />
                        Project
                      </Label>
                      <Select value={project} onValueChange={setProject}>
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue placeholder="選択（任意）" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">--- 選択なし ---</SelectItem>
                          <SelectItem value="proj_1">プロジェクトA</SelectItem>
                          <SelectItem value="proj_2">プロジェクトB</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-600 mb-1 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        User（対象者）
                      </Label>
                      <Select value={linkedUser} onValueChange={setLinkedUser}>
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue placeholder="選択（任意）" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">--- 選択なし ---</SelectItem>
                          <SelectItem value="user_1">山田 太郎（決裁者）</SelectItem>
                          <SelectItem value="user_2">佐藤 花子（担当者）</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600 mb-1 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Audience（対象者グループ）
                      </Label>
                      <Select value={linkedAudience} onValueChange={setLinkedAudience}>
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue placeholder="選択（任意）" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">--- 選択なし ---</SelectItem>
                          <SelectItem value="aud_1">At-Riskユーザー（Q1 2026）</SelectItem>
                          <SelectItem value="aud_2">アップセル候補Company</SelectItem>
                          <SelectItem value="aud_3">トレーニング要User</SelectItem>
                          <SelectItem value="aud_4">導入フェーズProject群</SelectItem>
                          <SelectItem value="aud_5">Q4 2025チャーン防止対象</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action / Log Selection */}
              <div>
                <Label className="text-sm font-semibold text-slate-900 mb-2 block">
                  参照するAction/Log（任意・複数可）
                </Label>
                <p className="text-xs text-slate-500 mb-3">
                  AIがこれらのActionやログを参照してコンテンツを生成します
                </p>
                
                {/* Search and Filter */}
                <div className="flex items-center gap-3 mb-2">
                  <Input
                    value={actionSearchQuery}
                    onChange={(e) => setActionSearchQuery(e.target.value)}
                    placeholder="Action/Logを検索"
                    className="text-sm"
                  />
                  <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="タイプを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      <SelectItem value="action">Action</SelectItem>
                      <SelectItem value="log">Log</SelectItem>
                      <SelectItem value="inbox">Inbox</SelectItem>
                      <SelectItem value="library">Library</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Selected Evidence */}
                {selectedEvidence.length > 0 && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-xs font-semibold text-blue-900 mb-2">
                      選択中: {selectedEvidence.length}件
                    </div>
                    <div className="space-y-2">
                      {selectedEvidence.map((ev) => (
                        <div key={ev.id} className="flex items-center justify-between bg-white p-2 rounded border border-blue-200">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-slate-900">{ev.title}</div>
                            <div className="text-xs text-slate-500">{ev.date} • {ev.source}</div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveEvidence(ev.id)}
                            className="h-7 w-7 p-0 ml-2"
                          >
                            <Trash2 className="w-3 h-3 text-red-600" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Available Evidence */}
                <div className="border border-slate-200 rounded-lg max-h-80 overflow-y-auto">
                  {mockEvidenceData
                    .filter(ev => 
                      (actionTypeFilter === "all" || ev.type === actionTypeFilter) &&
                      (ev.title.toLowerCase().includes(actionSearchQuery.toLowerCase()) ||
                       ev.source?.toLowerCase().includes(actionSearchQuery.toLowerCase()) ||
                       ev.sender?.toLowerCase().includes(actionSearchQuery.toLowerCase()))
                    ).length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        <Search className="w-6 h-6 mx-auto mb-2 opacity-50" />
                        検索条件に一致するアイテムがありません
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {mockEvidenceData
                          .filter(ev => 
                            (actionTypeFilter === "all" || ev.type === actionTypeFilter) &&
                            (ev.title.toLowerCase().includes(actionSearchQuery.toLowerCase()) ||
                             ev.source?.toLowerCase().includes(actionSearchQuery.toLowerCase()) ||
                             ev.sender?.toLowerCase().includes(actionSearchQuery.toLowerCase()))
                          )
                          .map((ev) => {
                            const isSelected = selectedEvidence.find(e => e.id === ev.id);
                            
                            // Type-specific styling
                            const getTypeIcon = () => {
                              switch(ev.type) {
                                case 'action': return <Target className="w-4 h-4 text-blue-600" />;
                                case 'log': return <Database className="w-4 h-4 text-emerald-600" />;
                                case 'inbox': return <InboxIcon className="w-4 h-4 text-purple-600" />;
                                case 'library': return <FileJson className="w-4 h-4 text-slate-600" />;
                                case 'event': return <Calendar className="w-4 h-4 text-orange-600" />;
                              }
                            };
                            
                            const getTypeBadge = () => {
                              switch(ev.type) {
                                case 'action': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">Action</Badge>;
                                case 'log': return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Log</Badge>;
                                case 'inbox': return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">Inbox</Badge>;
                                case 'library': return <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-xs">Library</Badge>;
                                case 'event': return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">Event</Badge>;
                              }
                            };
                            
                            const getStatusBadge = () => {
                              if (!ev.status) return null;
                              const statusColors: Record<string, string> = {
                                '完了': 'bg-green-100 text-green-800 border-green-200',
                                '進行中': 'bg-yellow-100 text-yellow-800 border-yellow-200',
                                '解決済み': 'bg-green-100 text-green-800 border-green-200',
                                '確認済み': 'bg-blue-100 text-blue-800 border-blue-200',
                                '対応中': 'bg-orange-100 text-orange-800 border-orange-200',
                                '未解決': 'bg-red-100 text-red-800 border-red-200',
                              };
                              return (
                                <Badge variant="outline" className={`${statusColors[ev.status] || 'bg-slate-100 text-slate-800'} text-xs`}>
                                  {ev.status}
                                </Badge>
                              );
                            };
                            
                            const getPriorityIcon = () => {
                              if (!ev.priority) return null;
                              switch(ev.priority) {
                                case '高': return <AlertCircle className="w-3 h-3 text-red-600" />;
                                case '中': return <Clock className="w-3 h-3 text-yellow-600" />;
                                case '低': return <CheckCircle2 className="w-3 h-3 text-green-600" />;
                              }
                            };
                            
                            return (
                              <button
                                key={ev.id}
                                onClick={() => handleAddEvidence(ev)}
                                disabled={!!isSelected}
                                className={`
                                  w-full p-3 rounded-lg text-left text-xs transition-all
                                  ${isSelected
                                    ? "bg-slate-50 text-slate-400 cursor-not-allowed opacity-60"
                                    : "bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 hover:shadow-sm"
                                  }\n                                `}
                              >
                                <div className="flex items-start gap-3">
                                  {!isSelected && (
                                    <div className="mt-0.5">
                                      {getTypeIcon()}
                                    </div>
                                  )}
                                  {isSelected && (
                                    <CheckCircle2 className="w-4 h-4 text-slate-400 mt-0.5" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start gap-2 mb-1">
                                      <div className="font-semibold text-slate-900 flex-1">{ev.title}</div>
                                      {!isSelected && getPriorityIcon()}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                      {getTypeBadge()}
                                      {getStatusBadge()}
                                    </div>
                                    <div className="text-slate-500 text-xs mt-1">
                                      {ev.date} • {ev.source}
                                      {ev.sender && <> • {ev.sender}</>}
                                      {ev.category && <> • {ev.category}</>}
                                    </div>
                                  </div>
                                  {!isSelected && (
                                    <Plus className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => setStep(3)}
                  className="flex-1"
                >
                  次へ：ワークスペース
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1"
                >
                  戻る
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: ワークスペース */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Selected Settings Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="text-xs font-semibold text-slate-600 mb-2">選択した設定</div>
                <div className="flex flex-wrap gap-2">
                  {draftType && (
                    <Badge variant="outline" className={draftTypeConfig[draftType].color}>
                      {draftTypeConfig[draftType].label}
                    </Badge>
                  )}
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    {fileFormatConfig[fileFormat].label}
                  </Badge>
                  {selectedEvidence.length > 0 && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      Evidence: {selectedEvidence.length}件
                    </Badge>
                  )}
                </div>
              </div>

              {/* Draft Name */}
              <div>
                <Label className="text-sm font-semibold text-slate-900 mb-2 block">
                  Content名 *
                </Label>
                <Input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="例: 顧客向けフォローアップメール"
                  className="text-sm"
                />
              </div>

              {/* Adjustment Prompt (AI機能が選択されている場合) */}
              {draftType && (
                <div>
                  <Label className="text-sm font-semibold text-slate-900 mb-2 block">
                    調整プロンプト（任意）
                  </Label>
                  <p className="text-xs text-slate-500 mb-2">
                    AI出力について補足や指示を追加できます
                  </p>
                  <Textarea
                    value={adjustmentPrompt}
                    onChange={(e) => setAdjustmentPrompt(e.target.value)}
                    placeholder="例: より丁寧なトーンで、製品の具体的な活用例を含めてください"
                    className="text-sm"
                    rows={3}
                  />
                </div>
              )}

              {/* Generate Button (AI機能が選択されている場合) */}
              {draftType && !draftContent && (
                <div>
                  <Button
                    onClick={handleGenerateContent}
                    disabled={isGenerating}
                    className="w-full"
                  >
                    {isGenerating ? (
                      <>
                        <Wand2 className="w-4 h-4 mr-2 animate-spin" />
                        AI生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        AIで生成する
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Draft Content (generated or manual) */}
              <div>
                <Label className="text-sm font-semibold text-slate-900 mb-2 block">
                  {draftType ? "生成されたContent（編集可能）" : "Content内容"}
                </Label>
                
                {/* AI生成コンテンツがある場合：タブ構成で表示 */}
                {draftType && draftContent ? (
                  <Tabs defaultValue="preview" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="preview" className="text-xs">
                        <Eye className="w-3 h-3 mr-1" />
                        Preview
                      </TabsTrigger>
                      <TabsTrigger value="raw" className="text-xs">
                        <Code className="w-3 h-3 mr-1" />
                        Raw Output
                      </TabsTrigger>
                      <TabsTrigger value="files" className="text-xs">
                        <Download className="w-3 h-3 mr-1" />
                        Files
                      </TabsTrigger>
                      <TabsTrigger value="runinfo" className="text-xs">
                        <Info className="w-3 h-3 mr-1" />
                        Run Info
                      </TabsTrigger>
                    </TabsList>

                    {/* Preview Tab */}
                    <TabsContent value="preview" className="mt-3">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-600">メインのプレビュー・編集エリア</span>
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            <Sparkles className="w-3 h-3 mr-1" />
                            再生成
                          </Button>
                        </div>
                        <Textarea
                          value={draftContent}
                          onChange={(e) => setDraftContent(e.target.value)}
                          className="text-sm font-mono"
                          rows={14}
                        />
                        <div className="text-xs text-slate-500">
                          ✓ 生成されたコンテンツを直接編集できます
                        </div>
                      </div>
                    </TabsContent>

                    {/* Raw Output Tab */}
                    <TabsContent value="raw" className="mt-3">
                      <div className="space-y-3">
                        <div className="text-xs text-slate-600 mb-2">
                          AI APIからの生の出力（デバッグ・確認用）
                        </div>
                        <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
                          <pre>{JSON.stringify({
                            primary_route: {
                              type: "kocoro",
                              agent_name: "Content Creator Pro",
                              agent_id: "kocoro-agent-005"
                            },
                            fallback_used: false,
                            execution_time: "2.4秒",
                            output: {
                              type: "text",
                              content: draftContent
                            },
                            context: {
                              company: company || "未設定",
                              project: project || "未設定",
                              evidence_count: selectedEvidence.length,
                              prompt: adjustmentPrompt || "標準生成"
                            }
                          }, null, 2)}</pre>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Files Tab */}
                    <TabsContent value="files" className="mt-3">
                      <div className="space-y-3">
                        <div className="text-xs text-slate-600 mb-2">
                          生成されたファイル一覧
                        </div>
                        {fileFormat !== "text" ? (
                          <div className="border border-slate-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              {fileFormat === "pdf" && <FileText className="w-8 h-8 text-red-600" />}
                              {fileFormat === "pptx" && <Presentation className="w-8 h-8 text-orange-600" />}
                              {fileFormat === "docx" && <FileText className="w-8 h-8 text-blue-600" />}
                              {fileFormat === "markdown" && <FileCode className="w-8 h-8 text-purple-600" />}
                              {fileFormat === "json" && <FileJson className="w-8 h-8 text-emerald-600" />}
                              <div className="flex-1">
                                <div className="font-semibold text-slate-900 text-sm mb-1">
                                  {draftName || "content_draft"}.{fileFormat}
                                </div>
                                <div className="text-xs text-slate-500 mb-2">
                                  生成日時: 2026-03-17 14:30 • サイズ: 1.2 MB
                                </div>
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm" className="h-7 text-xs">
                                    <Eye className="w-3 h-3 mr-1" />
                                    プレビュー
                                  </Button>
                                  <Button variant="outline" size="sm" className="h-7 text-xs">
                                    <Download className="w-3 h-3 mr-1" />
                                    ダウンロード
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-12 text-slate-400 text-xs">
                            <FileType className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            テキスト形式のため、ファイルは生成されません
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* Run Info Tab */}
                    <TabsContent value="runinfo" className="mt-3">
                      <div className="space-y-4">
                        <div className="text-xs text-slate-600 mb-2">
                          AI実行の詳細情報
                        </div>

                        {/* Primary Route */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Route className="w-4 h-4 text-purple-600" />
                            <span className="text-xs font-semibold text-slate-900">Primary Route</span>
                          </div>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Type:</span>
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                Kocoro
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Agent Name:</span>
                              <span className="font-medium text-slate-900">Content Creator Pro</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Agent ID:</span>
                              <span className="font-mono text-slate-700">kocoro-agent-005</span>
                            </div>
                          </div>
                        </div>

                        {/* Fallback Info */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Zap className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-semibold text-slate-900">Fallback</span>
                          </div>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Fallback Used:</span>
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                No
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Fallback Route:</span>
                              <span className="text-slate-500">OpenRouter - Claude 3 Opus</span>
                            </div>
                          </div>
                        </div>

                        {/* Execution Details */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Clock className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-semibold text-slate-900">Execution</span>
                          </div>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Execution Time:</span>
                              <span className="font-medium text-slate-900">2.4秒</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Status:</span>
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Success
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Cost:</span>
                              <span className="font-medium text-slate-900">¥85</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">Timestamp:</span>
                              <span className="text-slate-700">2026-03-17 14:30:15</span>
                            </div>
                          </div>
                        </div>

                        {/* Source Context */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Target className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-semibold text-slate-900">Source Context</span>
                          </div>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-start justify-between">
                              <span className="text-slate-600">Company:</span>
                              <span className="font-medium text-slate-900 text-right">{company || "未設定"}</span>
                            </div>
                            <div className="flex items-start justify-between">
                              <span className="text-slate-600">Project:</span>
                              <span className="font-medium text-slate-900 text-right">{project || "未設定"}</span>
                            </div>
                            <div className="flex items-start justify-between">
                              <span className="text-slate-600">Linked User:</span>
                              <span className="font-medium text-slate-900 text-right">{linkedUser || "未設定"}</span>
                            </div>
                            <div className="flex items-start justify-between">
                              <span className="text-slate-600">Evidence:</span>
                              <span className="font-medium text-slate-900">{selectedEvidence.length} items</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  /* AI生成前：通常のTextarea */
                  <Textarea
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    placeholder={draftType ? "「AIで生成する」ボタンを押すと、ここに生成されたコンテンツが表示されます" : "Content内容を入力してください"}
                    className="text-sm font-mono"
                    rows={16}
                    disabled={draftType && !draftContent}
                  />
                )}
                
                {!draftContent && draftType && (
                  <div className="mt-2 text-xs text-slate-500">
                    💡 AIで生成後、Preview / Raw Output / Files / Run Info のタブで詳細を確認できます
                  </div>
                )}
              </div>

              {/* AI Re-adjustment (AI機能が選択されていて、コンテンツが生成済みの場合) */}
              {draftType && draftContent && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Wand2 className="w-4 h-4 text-purple-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-purple-900 mb-2">
                        AIで再調整
                      </div>
                      <Textarea
                        value={adjustmentPrompt}
                        onChange={(e) => setAdjustmentPrompt(e.target.value)}
                        placeholder="修正の方向性を指示（例: もっとカジュアルなトーンに変更）"
                        className="text-xs mb-2"
                        rows={2}
                      />
                      <Button
                        size="sm"
                        onClick={handleGenerateContent}
                        disabled={isGenerating}
                        className="w-full"
                      >
                        {isGenerating ? "再生成中..." : "AIで再生成"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Next Steps */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="text-xs font-semibold text-slate-900 mb-2">次のステップ（3つの行き先）</div>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Save className="w-3 h-3" />
                    <span><strong>保存:</strong> Content一覧に保存（後で編集可能）</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Database className="w-3 h-3" />
                    <span><strong>保存してLibrary登録:</strong> 再利用資産として保存</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Send className="w-3 h-3" />
                    <span><strong>保存してOutboundに進む:</strong> 送信準備（Composeへ）</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t">
                <Button
                  onClick={handleSaveDraft}
                  disabled={!canSave}
                  variant="default"
                >
                  <Save className="w-4 h-4 mr-2" />
                  保存
                </Button>
                <Button
                  onClick={handleSaveToLibrary}
                  disabled={!canSave}
                  variant="outline"
                >
                  <Database className="w-4 h-4 mr-2" />
                  Library登録
                </Button>
                <Button
                  onClick={handleSendToOutbound}
                  disabled={!canSave}
                  variant="outline"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Outboundへ
                </Button>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setStep(2)}
                  className="flex-1"
                >
                  戻る
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleClose}
                  className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  削除
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}