import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Badge } from "../ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import {
  Calendar,
  Sparkles,
  Save,
  X,
  Upload,
  FileText,
  Trash2,
  Eye,
  Download,
  Users,
  Building,
  FolderOpen,
  User,
  Target,
  Lightbulb,
  Image as ImageIcon,
  File,
  Type,
  Paperclip,
  Send,
  MessageSquare,
  TrendingUp,
  Plus,
  ExternalLink,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface EventCreateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "create" | "edit";
  eventData?: any;
}

type EventType =
  | "Product Update"
  | "Promotion"
  | "Discount"
  | "Offline Event"
  | "Webinar"
  | "PoC Program"
  | "Beta Program"
  | "Co-creation"
  | "Campaign"
  | "Custom";

interface AudienceSuggestion {
  id: string;
  name: string;
  scope: string;
  conditions: string;
  count: string;
  reason: string;
  isPriority?: boolean;
}

interface ContentSuggestion {
  id: string;
  name: string;
  contentType: string;
  description: string;
  tone?: string;
  reason: string;
  isPriority?: boolean;
}

interface OutboundSuggestion {
  id: string;
  type: "channel" | "timing" | "method" | "followup";
  name: string;
  description: string;
}

const eventTypeConfig: Record<EventType, { label: string; color: string; icon: any }> = {
  "Product Update": {
    label: "Product Update",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Sparkles,
  },
  Promotion: {
    label: "Promotion",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    icon: Target,
  },
  Discount: {
    label: "Discount",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: Target,
  },
  "Offline Event": {
    label: "Offline Event",
    color: "bg-orange-50 text-orange-700 border-orange-200",
    icon: Calendar,
  },
  Webinar: {
    label: "Webinar",
    color: "bg-cyan-50 text-cyan-700 border-cyan-200",
    icon: Users,
  },
  "PoC Program": {
    label: "PoC Program",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    icon: Lightbulb,
  },
  "Beta Program": {
    label: "Beta Program",
    color: "bg-pink-50 text-pink-700 border-pink-200",
    icon: Sparkles,
  },
  "Co-creation": {
    label: "Co-creation",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Lightbulb,
  },
  Campaign: {
    label: "Campaign",
    color: "bg-violet-50 text-violet-700 border-violet-200",
    icon: Target,
  },
  Custom: {
    label: "Custom",
    color: "bg-slate-50 text-slate-700 border-slate-200",
    icon: FileText,
  },
};

export function EventCreateDrawer({
  open,
  onOpenChange,
  mode = "create",
  eventData,
}: EventCreateDrawerProps) {
  const [eventName, setEventName] = useState(eventData?.name || "");
  const [eventType, setEventType] = useState<EventType | "">(eventData?.type || "");
  const [startDate, setStartDate] = useState(eventData?.startDate || "");
  const [endDate, setEndDate] = useState(eventData?.endDate || "");
  const [overview, setOverview] = useState(eventData?.overview || "");
  const [target, setTarget] = useState(eventData?.target || "");
  const [goal, setGoal] = useState(eventData?.goal || "");
  const [owner, setOwner] = useState(eventData?.owner || "");
  const [notes, setNotes] = useState(eventData?.notes || "");
  const [status, setStatus] = useState(eventData?.status || "scheduled");
  const [selectedAudience, setSelectedAudience] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<any[]>(eventData?.attachments || []);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSourceFiles, setAiSourceFiles] = useState<any[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<"text" | "file">("text");
  const [textInput, setTextInput] = useState("");
  
  // AI支援（施策提案）の状態管理
  const [aiSuggestionDialogOpen, setAiSuggestionDialogOpen] = useState(false);
  const [suggestionType, setSuggestionType] = useState<"audience" | "content" | "outbound" | null>(null);
  const [generatingSuggestion, setGeneratingSuggestion] = useState(false);
  
  // 採用した提案の管理
  const [adoptedAudienceSuggestions, setAdoptedAudienceSuggestions] = useState<AudienceSuggestion[]>([]);
  const [adoptedContentSuggestions, setAdoptedContentSuggestions] = useState<ContentSuggestion[]>([]);
  const [adoptedOutboundSuggestions, setAdoptedOutboundSuggestions] = useState<OutboundSuggestion[]>([]);

  const handleClose = () => {
    // リセット処理
    if (mode === "create") {
      setEventName("");
      setEventType("");
      setStartDate("");
      setEndDate("");
      setOverview("");
      setTarget("");
      setGoal("");
      setOwner("");
      setNotes("");
      setStatus("scheduled");
      setSelectedAudience([]);
      setSelectedCompanies([]);
      setSelectedProjects([]);
      setAttachments([]);
      setAiSourceFiles([]);
      setAdoptedAudienceSuggestions([]);
      setAdoptedContentSuggestions([]);
      setAdoptedOutboundSuggestions([]);
    }
    onOpenChange(false);
  };

  const handleAiStructure = () => {
    setAiGenerating(true);
    // AIによる整理シミュレーション
    setTimeout(() => {
      setEventName(eventName || "Q2製品アップデート案内");
      setOverview(
        overview ||
          "Q2製品アップデートに関する新機能の案内を全顧客に向けて実施します。主要な新機能は3つ（AI機能強化、ダッシュボード改善、モバイル対応）で、各機能の詳細を段階的に案内し、活用を促進します。"
      );
      setTarget(target || "全顧客（300社）+ 見込み顧客（100社）");
      setGoal(
        goal || "製品アップデート認知率 80%、新機能トライアル率 50%、満足度 4.5/5"
      );
      setAiGenerating(false);
    }, 1500);
  };

  const handleAiSourceFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: formatFileSize(file.size),
      type: getFileType(file.name),
      file: file,
    }));

    setAiSourceFiles([...aiSourceFiles, ...newFiles]);
  };

  const removeAiSourceFile = (fileId: string) => {
    setAiSourceFiles(aiSourceFiles.filter((f) => f.id !== fileId));
  };

  // AI支援（施策提案）のハンドラ
  const handleOpenAiSuggestion = (type: "audience" | "content" | "outbound") => {
    setSuggestionType(type);
    setGeneratingSuggestion(true);
    setAiSuggestionDialogOpen(true);
    
    // AIによる提案生成をシミュレーション
    setTimeout(() => {
      setGeneratingSuggestion(false);
    }, 1500);
  };

  // Audience提案を採用
  const handleAdoptAudienceSuggestion = (suggestion: AudienceSuggestion) => {
    // 既に採用済みかチェック
    if (adoptedAudienceSuggestions.find(s => s.id === suggestion.id)) {
      toast.info("この提案は既に採用されています");
      return;
    }
    
    setAdoptedAudienceSuggestions([...adoptedAudienceSuggestions, suggestion]);
    toast.success(`Audienceにこの提案を追加しました：${suggestion.name}`);
  };

  // Content提案を採用
  const handleAdoptContentSuggestion = (suggestion: ContentSuggestion) => {
    // 既に採用済みかチェック
    if (adoptedContentSuggestions.find(s => s.id === suggestion.id)) {
      toast.info("この提案は既に採用されています");
      return;
    }
    
    setAdoptedContentSuggestions([...adoptedContentSuggestions, suggestion]);
    toast.success(`Contentにこの提案を追加しました：${suggestion.name}`);
  };

  // Outbound提案を採用
  const handleAdoptOutboundSuggestion = (suggestion: OutboundSuggestion) => {
    // 既に採用済みかチェック
    if (adoptedOutboundSuggestions.find(s => s.id === suggestion.id)) {
      toast.info("この提案は既に採用されています");
      return;
    }
    
    setAdoptedOutboundSuggestions([...adoptedOutboundSuggestions, suggestion]);
    toast.success(`Outboundにこの提案を追加しました：${suggestion.name}`);
  };

  // 採用した提案を削除
  const handleRemoveAdoptedAudience = (id: string) => {
    setAdoptedAudienceSuggestions(adoptedAudienceSuggestions.filter(s => s.id !== id));
    toast.info("採用した提案を削除しました");
  };

  const handleRemoveAdoptedContent = (id: string) => {
    setAdoptedContentSuggestions(adoptedContentSuggestions.filter(s => s.id !== id));
    toast.info("採用した提案を削除しました");
  };

  const handleRemoveAdoptedOutbound = (id: string) => {
    setAdoptedOutboundSuggestions(adoptedOutboundSuggestions.filter(s => s.id !== id));
    toast.info("採用した提案を削除しました");
  };

  const getFileType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (['txt', 'md', 'doc', 'docx'].includes(ext || '')) return 'document';
    return 'file';
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'image':
        return ImageIcon;
      case 'pdf':
        return FileText;
      case 'document':
        return FileText;
      default:
        return File;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleAddSourceContent = () => {
    if (uploadMode === "text" && textInput.trim()) {
      // テキスト入力として追加
      const newTextItem = {
        id: Math.random().toString(36).substr(2, 9),
        name: `テキスト入力 ${aiSourceFiles.filter(f => f.type === 'text').length + 1}`,
        size: `${textInput.length} 文字`,
        type: 'text',
        content: textInput,
      };
      setAiSourceFiles([...aiSourceFiles, newTextItem]);
      setTextInput("");
      setUploadModalOpen(false);
    } else if (uploadMode === "file") {
      // ファイル選択トリガー
      const fileInput = document.getElementById("modal-file-upload") as HTMLInputElement;
      fileInput?.click();
    }
  };

  const handleModalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: formatFileSize(file.size),
      type: getFileType(file.name),
      file: file,
    }));

    setAiSourceFiles([...aiSourceFiles, ...newFiles]);
    setUploadModalOpen(false);
    
    // ファイル入力をリセット
    e.target.value = "";
  };

  const handleSave = () => {
    console.log("Event保存:", {
      eventName,
      eventType,
      startDate,
      endDate,
      overview,
      target,
      goal,
      owner,
      notes,
      status,
      selectedAudience,
      selectedCompanies,
      selectedProjects,
      attachments,
      adoptedAudienceSuggestions,
      adoptedContentSuggestions,
      adoptedOutboundSuggestions,
    });
    handleClose();
  };

  const canSave =
    eventName.trim() !== "" &&
    eventType !== "" &&
    startDate !== "" &&
    endDate !== "" &&
    overview.trim() !== "";

  // モックAudience提案データ
  const audienceSuggestions: AudienceSuggestion[] = [
    {
      id: "aud_sugg_1",
      name: "全既存顧客（Product Update対象）",
      scope: "Company（全顧客）",
      conditions: "契約ステータス: Active、プラン: All",
      count: "約300社",
      reason: "Product Updateは全顧客に影響するため、全社配信が推奨されます",
      isPriority: true,
    },
    {
      id: "aud_sugg_2",
      name: "アクティブユーザーセグメント",
      scope: "User（ログイン実績あり）",
      conditions: "直近30日以内にログイン実績あり",
      count: "約1,200名",
      reason: "アクティブユーザーは新機能の早期導入者になりやすい",
    },
    {
      id: "aud_sugg_3",
      name: "見込み顧客（トライアル中）",
      scope: "Company（トライアル）",
      conditions: "契約ステータス: Trial、残日数: 7日以上",
      count: "約80社",
      reason: "新機能訴求により、契約転換率を向上できる可能性あり",
    },
  ];

  // モックContent提案データ
  const contentSuggestions: ContentSuggestion[] = [
    {
      id: "cnt_sugg_1",
      name: "Event案内メール（全顧客向け）",
      contentType: "Message Draft（Email）",
      description: "Q2製品アップデートの概要、新機能3つのハイライト、詳細情報へのリンク",
      tone: "フォーマル、エキサイティング",
      reason: "初回接点として、全顧客に一斉配信する案内メールが必須",
      isPriority: true,
    },
    {
      id: "cnt_sugg_2",
      name: "FAQ記事（新機能Q&A）",
      contentType: "FAQ Draft",
      description: "新機能に関するよくある質問10問、トラブルシューティング",
      reason: "サポート負荷軽減と、セルフサーブ導線の確保",
    },
    {
      id: "cnt_sugg_3",
      name: "製品説明スライド（営業・CS向け）",
      contentType: "Proposal Draft（PowerPoint）",
      description: "新機能デモ用スライド、ユースケース、ROI説明",
      reason: "営業・CSチームが顧客説明に使える資料が必要",
    },
    {
      id: "cnt_sugg_4",
      name: "リマインドメール（未開封者向け）",
      contentType: "Message Draft（Email）",
      description: "初回案内の要点まとめ、今すぐ試せるリンク、締切情報",
      reason: "初回メール未開封者へのフォローアップ",
    },
    {
      id: "cnt_sugg_5",
      name: "トライアル顧客向け訴求メール",
      contentType: "Message Draft（Email）",
      description: "新機能によるベネフィット、契約転換への誘導、限定特典案内",
      reason: "トライアル中の見込み顧客の契約転換率向上",
    },
  ];

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-[800px] sm:max-w-[800px] overflow-y-auto p-0">
        <div className="sticky top-0 bg-white z-10 border-b px-6 py-4">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <SheetTitle>
                  {mode === "create" ? "新規Event作成" : "Event編集"}
                </SheetTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClose} className="h-8 w-8 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <SheetDescription>
              施策・企画を定義し、Audience / Content / Outbound と接続します
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Event Name */}
          <div>
            <Label className="text-sm font-semibold text-slate-900 mb-2 block">
              Event名 *
            </Label>
            <Input
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="例: Q2製品アップデート案内"
              className="text-sm"
            />
          </div>

          {/* Event Type */}
          <div>
            <Label className="text-sm font-semibold text-slate-900 mb-2 block">
              Event種別 *
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(eventTypeConfig) as EventType[]).map((type) => {
                const config = eventTypeConfig[type];
                const Icon = config.icon;
                const isSelected = eventType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setEventType(type)}
                    className={`
                      p-3 rounded-lg border text-left transition-all
                      ${
                        isSelected
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded ${config.color}`}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <span className="text-sm font-medium text-slate-900">
                        {config.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold text-slate-900 mb-2 block">
                開始日 *
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold text-slate-900 mb-2 block">
                終了日 *
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          {/* AI Structure Button */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-purple-900 mb-1">
                  AIで整理
                </div>
                <p className="text-xs text-purple-700 mb-3">
                  添付資料や企画メモをもとに、AIが概要・対象・目標を整理します
                </p>
                
                {/* File Upload Area */}
                <div className="mb-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setUploadMode("text");
                      setTextInput("");
                      setUploadModalOpen(true);
                    }}
                    className="w-full border-2 border-dashed border-purple-300 hover:border-purple-400 hover:bg-purple-100/50 h-auto py-3"
                  >
                    <Upload className="w-4 h-4 mr-2 text-purple-600" />
                    <span className="text-xs font-medium text-purple-700">
                      画像・PDF・テキストをアップロード
                    </span>
                  </Button>
                </div>

                {/* Uploaded Files List */}
                {aiSourceFiles.length > 0 && (
                  <div className="mb-3 space-y-2 max-h-40 overflow-y-auto">
                    {aiSourceFiles.map((file) => {
                      const FileIcon = getFileIcon(file.type);
                      return (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-2 bg-white border border-purple-200 rounded-lg"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="p-1.5 bg-purple-100 rounded">
                              <FileIcon className="w-3 h-3 text-purple-700" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-slate-900 truncate">
                                {file.name}
                              </div>
                              <div className="text-xs text-slate-500">{file.size}</div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-red-100"
                            onClick={() => removeAiSourceFile(file.id)}
                          >
                            <X className="w-3 h-3 text-red-600" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button
                  size="sm"
                  onClick={handleAiStructure}
                  disabled={aiGenerating || aiSourceFiles.length === 0}
                  className="w-full"
                >
                  {aiGenerating ? (
                    <>
                      <Sparkles className="w-3 h-3 mr-2 animate-spin" />
                      AI整理中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 mr-2" />
                      {aiSourceFiles.length > 0
                        ? `${aiSourceFiles.length}件のファイルからAIで整理`
                        : "AIで整理する"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Overview */}
          <div>
            <Label className="text-sm font-semibold text-slate-900 mb-2 block">概要 *</Label>
            <Textarea
              value={overview}
              onChange={(e) => setOverview(e.target.value)}
              placeholder="Eventの概要を記述してください"
              className="text-sm"
              rows={4}
            />
          </div>

          {/* Target */}
          <div>
            <Label className="text-sm font-semibold text-slate-900 mb-2 block">対象</Label>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="例: 全顧客（300社）"
              className="text-sm"
            />
          </div>

          {/* Goal */}
          <div>
            <Label className="text-sm font-semibold text-slate-900 mb-2 block">目標</Label>
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="例: 製品アップデート認知率 80%、新機能トライアル率 50%"
              className="text-sm"
              rows={2}
            />
          </div>

          {/* Owner */}
          <div>
            <Label className="text-sm font-semibold text-slate-900 mb-2 block">担当者</Label>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="担当者を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="山田 太郎">山田 太郎</SelectItem>
                <SelectItem value="佐藤 花子">佐藤 花子</SelectItem>
                <SelectItem value="田中 一郎">田中 一郎</SelectItem>
                <SelectItem value="鈴木 次郎">鈴木 次郎</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div>
            <Label className="text-sm font-semibold text-slate-900 mb-2 block">ステータス</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="ステータスを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">予定</SelectItem>
                <SelectItem value="active">開催中</SelectItem>
                <SelectItem value="completed">終了</SelectItem>
                <SelectItem value="cancelled">中止</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Related Entities */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold text-slate-900 mb-2 block">
                関連Audience（任意）
              </Label>
              <Button variant="outline" size="sm" className="w-full">
                <Users className="w-4 h-4 mr-2" />
                Audienceを選択
              </Button>
            </div>
            <div>
              <Label className="text-sm font-semibold text-slate-900 mb-2 block">
                関連Company（任意）
              </Label>
              <Button variant="outline" size="sm" className="w-full">
                <Building className="w-4 h-4 mr-2" />
                Companyを選択
              </Button>
            </div>
            <div>
              <Label className="text-sm font-semibold text-slate-900 mb-2 block">
                関連Project（任意）
              </Label>
              <Button variant="outline" size="sm" className="w-full">
                <FolderOpen className="w-4 h-4 mr-2" />
                Projectを選択
              </Button>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <Label className="text-sm font-semibold text-slate-900 mb-2 block">
              添付ファイル
            </Label>
            <Button variant="outline" size="sm" className="w-full">
              <Upload className="w-4 h-4 mr-2" />
              ファイルをアップロード
            </Button>
            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachments.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 border border-slate-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <div>
                        <div className="text-xs font-medium text-slate-900">{file.name}</div>
                        <div className="text-xs text-slate-500">{file.size}</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <Trash2 className="w-3 h-3 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm font-semibold text-slate-900 mb-2 block">備考</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="補足情報やメモ"
              className="text-sm"
              rows={3}
            />
          </div>

          {/* AI支援（施策提案） */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-blue-600" />
              <div className="text-sm font-semibold text-blue-900">AI支援（施策提案）</div>
            </div>
            <p className="text-xs text-blue-700 mb-4">
              Event情報をもとに、AIが推奨Audience・Content案・Outbound方針を提案します
            </p>
            
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenAiSuggestion("audience")}
                disabled={!eventName || !overview}
                className="bg-white hover:bg-blue-100 border-blue-300 text-blue-700 hover:text-blue-800"
              >
                <Users className="w-3 h-3 mr-1.5" />
                <span className="text-xs">Audience提案</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenAiSuggestion("content")}
                disabled={!eventName || !overview}
                className="bg-white hover:bg-blue-100 border-blue-300 text-blue-700 hover:text-blue-800"
              >
                <MessageSquare className="w-3 h-3 mr-1.5" />
                <span className="text-xs">Content案</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenAiSuggestion("outbound")}
                disabled={!eventName || !overview}
                className="bg-white hover:bg-blue-100 border-blue-300 text-blue-700 hover:text-blue-800"
              >
                <Send className="w-3 h-3 mr-1.5" />
                <span className="text-xs">Outbound方針</span>
              </Button>
            </div>
            
            {(!eventName || !overview) && (
              <div className="mt-3 text-xs text-blue-600 bg-blue-100 border border-blue-200 rounded p-2">
                💡 Event名と概要を入力すると、AI支援が利用可能になります
              </div>
            )}
          </div>

          {/* 採用した提案の表示 */}
          {(adoptedAudienceSuggestions.length > 0 || 
            adoptedContentSuggestions.length > 0 || 
            adoptedOutboundSuggestions.length > 0) && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <div className="text-sm font-semibold text-green-900">採用した提案</div>
              </div>
              
              <div className="space-y-3">
                {/* Audience提案 */}
                {adoptedAudienceSuggestions.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Audience（{adoptedAudienceSuggestions.length}件）
                    </div>
                    <div className="space-y-2">
                      {adoptedAudienceSuggestions.map((suggestion) => (
                        <div
                          key={suggestion.id}
                          className="bg-white border border-green-200 rounded-lg p-2 flex items-start justify-between"
                        >
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-slate-900">
                              {suggestion.name}
                            </div>
                            <div className="text-xs text-slate-600">
                              想定件数: {suggestion.count}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-red-100"
                            onClick={() => handleRemoveAdoptedAudience(suggestion.id)}
                          >
                            <X className="w-3 h-3 text-red-600" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Content提案 */}
                {adoptedContentSuggestions.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      Content（{adoptedContentSuggestions.length}件）
                    </div>
                    <div className="space-y-2">
                      {adoptedContentSuggestions.map((suggestion) => (
                        <div
                          key={suggestion.id}
                          className="bg-white border border-green-200 rounded-lg p-2 flex items-start justify-between"
                        >
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-slate-900">
                              {suggestion.name}
                            </div>
                            <div className="text-xs text-slate-600">
                              {suggestion.contentType}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-red-100"
                            onClick={() => handleRemoveAdoptedContent(suggestion.id)}
                          >
                            <X className="w-3 h-3 text-red-600" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Outbound提案 */}
                {adoptedOutboundSuggestions.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1">
                      <Send className="w-3 h-3" />
                      Outbound（{adoptedOutboundSuggestions.length}件）
                    </div>
                    <div className="space-y-2">
                      {adoptedOutboundSuggestions.map((suggestion) => (
                        <div
                          key={suggestion.id}
                          className="bg-white border border-green-200 rounded-lg p-2 flex items-start justify-between"
                        >
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-slate-900">
                              {suggestion.name}
                            </div>
                            <div className="text-xs text-slate-600">
                              {suggestion.description}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-red-100"
                            onClick={() => handleRemoveAdoptedOutbound(suggestion.id)}
                          >
                            <X className="w-3 h-3 text-red-600" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button onClick={handleSave} disabled={!canSave} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              {mode === "create" ? "Eventを作成" : "変更を保存"}
            </Button>
            <Button variant="outline" onClick={handleClose} className="flex-1">
              キャンセル
            </Button>
          </div>
        </div>
      </SheetContent>

      {/* Upload Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>資料・メモを追加</DialogTitle>
            <DialogDescription>
              テキスト入力またはファイルアップロードを選択してください
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Mode Selection */}
            <div className="flex gap-2">
              <button
                onClick={() => setUploadMode("text")}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all
                  ${
                    uploadMode === "text"
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }
                `}
              >
                <Type className="w-4 h-4" />
                <span className="text-sm font-medium">テキスト入力</span>
              </button>
              <button
                onClick={() => setUploadMode("file")}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all
                  ${
                    uploadMode === "file"
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }
                `}
              >
                <Paperclip className="w-4 h-4" />
                <span className="text-sm font-medium">ファイル</span>
              </button>
            </div>

            {/* Content Area */}
            {uploadMode === "text" ? (
              <div>
                <Label className="text-sm font-semibold text-slate-900 mb-2 block">
                  企画メモ・資料テキスト
                </Label>
                <Textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="イベントの企画メモや資料の内容をペーストしてください&#10;&#10;例：&#10;・新製品リリース記念キャンペーン&#10;・期間：4月1日〜4月30日&#10;・対象：全顧客&#10;・目標：新製品認知率80%"
                  className="text-sm h-[300px] resize-y overflow-y-auto"
                  onKeyDown={(e) => {
                    // ショートカットキーのイベント伝播を許可
                    e.stopPropagation();
                  }}
                />
                <div className="text-xs text-slate-500 mt-2">
                  {textInput.length} 文字
                </div>
              </div>
            ) : (
              <div>
                <Label className="text-sm font-semibold text-slate-900 mb-2 block">
                  ファイルを選択
                </Label>
                <input
                  type="file"
                  id="modal-file-upload"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx,.md"
                  onChange={handleModalFileUpload}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-600 mb-1">
                    クリックしてファイルを選択
                  </p>
                  <p className="text-xs text-slate-500">
                    PDF、画像、テキストファイル対応
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadModalOpen(false);
                setTextInput("");
              }}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleAddSourceContent}
              disabled={uploadMode === "text" && !textInput.trim()}
            >
              {uploadMode === "text" ? "テキストを追加" : "ファイルを選択"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI支援（施策提案）Dialog */}
      <Dialog open={aiSuggestionDialogOpen} onOpenChange={setAiSuggestionDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-blue-600" />
              {suggestionType === "audience" && "推奨Audience提案"}
              {suggestionType === "content" && "推奨Content案"}
              {suggestionType === "outbound" && "推奨Outbound方針"}
            </DialogTitle>
            <DialogDescription>
              Event情報をもとに、AIが最適な施策を提案します（ページ遷移はしません）
            </DialogDescription>
          </DialogHeader>

          {generatingSuggestion ? (
            <div className="py-12 text-center">
              <Sparkles className="w-8 h-8 mx-auto mb-3 text-blue-600 animate-spin" />
              <p className="text-sm text-slate-600">AI提案を生成中...</p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* Audience提案 */}
              {suggestionType === "audience" && (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="text-xs font-semibold text-slate-600 mb-2">参照したEvent情報</div>
                    <div className="text-xs text-slate-700">
                      <div><strong>Event名:</strong> {eventName}</div>
                      <div><strong>種別:</strong> {eventType}</div>
                      <div className="mt-1"><strong>概要:</strong> {overview}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-slate-900">推奨Audience（3件）</div>
                    
                    {audienceSuggestions.map((suggestion) => {
                      const isAdopted = adoptedAudienceSuggestions.find(s => s.id === suggestion.id);
                      return (
                        <div
                          key={suggestion.id}
                          className={`border rounded-lg p-4 transition-all ${
                            isAdopted
                              ? "border-2 border-green-300 bg-green-50"
                              : suggestion.isPriority
                              ? "border-2 border-blue-200 bg-blue-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isAdopted && (
                                <Badge className="bg-green-600 text-white flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  採用済み
                                </Badge>
                              )}
                              {!isAdopted && suggestion.isPriority && (
                                <Badge className="bg-blue-600 text-white">推奨</Badge>
                              )}
                              <div
                                className={`text-sm font-semibold ${
                                  isAdopted
                                    ? "text-green-900"
                                    : suggestion.isPriority
                                    ? "text-blue-900"
                                    : "text-slate-900"
                                }`}
                              >
                                {suggestion.name}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-start gap-2">
                              <span className="text-slate-600 min-w-[80px]">Scope:</span>
                              <span className="text-slate-900">{suggestion.scope}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-slate-600 min-w-[80px]">対象条件:</span>
                              <span className="text-slate-900">{suggestion.conditions}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-slate-600 min-w-[80px]">想定件数:</span>
                              <span className="text-slate-900 font-semibold">{suggestion.count}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-slate-600 min-w-[80px]">理由:</span>
                              <span className="text-slate-900">{suggestion.reason}</span>
                            </div>
                          </div>
                          <div className="mt-3">
                            <Button
                              size="sm"
                              className={`text-xs h-8 ${
                                isAdopted
                                  ? "bg-green-600 hover:bg-green-700"
                                  : ""
                              }`}
                              onClick={() => handleAdoptAudienceSuggestion(suggestion)}
                              disabled={!!isAdopted}
                            >
                              {isAdopted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  採用済み
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3 mr-1" />
                                  提案を採用してこのAudienceを追加
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Content案 */}
              {suggestionType === "content" && (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="text-xs font-semibold text-slate-600 mb-2">参照したEvent情報</div>
                    <div className="text-xs text-slate-700">
                      <div><strong>Event名:</strong> {eventName}</div>
                      <div><strong>種別:</strong> {eventType}</div>
                      <div className="mt-1"><strong>概要:</strong> {overview}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-slate-900">推奨Content案（5件）</div>
                    
                    {contentSuggestions.map((suggestion) => {
                      const isAdopted = adoptedContentSuggestions.find(s => s.id === suggestion.id);
                      return (
                        <div
                          key={suggestion.id}
                          className={`border rounded-lg p-4 transition-all ${
                            isAdopted
                              ? "border-2 border-green-300 bg-green-50"
                              : suggestion.isPriority
                              ? "border-2 border-purple-200 bg-purple-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isAdopted && (
                                <Badge className="bg-green-600 text-white flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  採用済み
                                </Badge>
                              )}
                              {!isAdopted && suggestion.isPriority && (
                                <Badge className="bg-purple-600 text-white">優先度高</Badge>
                              )}
                              <div
                                className={`text-sm font-semibold ${
                                  isAdopted
                                    ? "text-green-900"
                                    : suggestion.isPriority
                                    ? "text-purple-900"
                                    : "text-slate-900"
                                }`}
                              >
                                {suggestion.name}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-start gap-2">
                              <span className="text-slate-600 min-w-[80px]">種別:</span>
                              <span className="text-slate-900">{suggestion.contentType}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-slate-600 min-w-[80px]">内容:</span>
                              <span className="text-slate-900">{suggestion.description}</span>
                            </div>
                            {suggestion.tone && (
                              <div className="flex items-start gap-2">
                                <span className="text-slate-600 min-w-[80px]">トーン:</span>
                                <span className="text-slate-900">{suggestion.tone}</span>
                              </div>
                            )}
                            <div className="flex items-start gap-2">
                              <span className="text-slate-600 min-w-[80px]">推奨理由:</span>
                              <span className="text-slate-900">{suggestion.reason}</span>
                            </div>
                          </div>
                          <div className="mt-3">
                            <Button
                              size="sm"
                              className={`text-xs h-8 ${
                                isAdopted
                                  ? "bg-green-600 hover:bg-green-700"
                                  : ""
                              }`}
                              onClick={() => handleAdoptContentSuggestion(suggestion)}
                              disabled={!!isAdopted}
                            >
                              {isAdopted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  採用済み
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3 mr-1" />
                                  提案を採用してこのContentを追加
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Outbound方針 */}
              {suggestionType === "outbound" && (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="text-xs font-semibold text-slate-600 mb-2">参照したEvent情報</div>
                    <div className="text-xs text-slate-700">
                      <div><strong>Event名:</strong> {eventName}</div>
                      <div><strong>種別:</strong> {eventType}</div>
                      <div className="mt-1"><strong>概要:</strong> {overview}</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-slate-900">推奨Outbound方針</div>
                    
                    {/* Channel推奨 */}
                    <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge className="bg-green-600 text-white">Channel推奨</Badge>
                        <div className="text-sm font-semibold text-green-900">マルチチャネル戦略</div>
                      </div>
                      <div className="space-y-3">
                        <div className="bg-white border border-green-200 rounded p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-semibold text-slate-900">1. Email（優先度: 高）</span>
                          </div>
                          <div className="text-xs text-slate-700 ml-6">
                            全顧客への確実な到達。開封率・クリック率の測定が容易。
                          </div>
                        </div>
                        <div className="bg-white border border-green-200 rounded p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-semibold text-slate-900">2. In-App通知（優先度: 高）</span>
                          </div>
                          <div className="text-xs text-slate-700 ml-6">
                            アクティブユーザーへのリアルタイム訴求。新機能への直接誘導。
                          </div>
                        </div>
                        <div className="bg-white border border-green-200 rounded p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-semibold text-slate-900">3. Messaging（Slack/Chatwork）（優先度: 中）</span>
                          </div>
                          <div className="text-xs text-slate-700 ml-6">
                            既存の連携チャネルを使った追加リマインド（オプション）。
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        {(() => {
                          const isAdopted = adoptedOutboundSuggestions.find(s => s.id === "out_sugg_channel");
                          return (
                            <Button
                              size="sm"
                              className={`text-xs h-8 ${isAdopted ? "bg-green-600 hover:bg-green-700" : ""}`}
                              onClick={() => handleAdoptOutboundSuggestion({
                                id: "out_sugg_channel",
                                type: "channel",
                                name: "マルチチャネル戦略（Email + In-App + Messaging）",
                                description: "Email、In-App通知、Messaging（Slack/Chatwork）の3チャネル戦略"
                              })}
                              disabled={!!isAdopted}
                            >
                              {isAdopted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  採用済み
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3 mr-1" />
                                  提案を採用してこのOutboundを追加
                                </>
                              )}
                            </Button>
                          );
                        })()}
                      </div>
                    </div>

                    {/* タイミング・送信順 */}
                    <div className="border border-slate-200 bg-white rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        <div className="text-sm font-semibold text-slate-900">推奨送信タイミング・順序</div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex-shrink-0">
                            1
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-slate-900 mb-1">D-Day（配信日）</div>
                            <div className="text-xs text-slate-700">
                              全顧客向けEmail一斉配信（AM 10:00推奨）+ In-App通知
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex-shrink-0">
                            2
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-slate-900 mb-1">D+3日</div>
                            <div className="text-xs text-slate-700">
                              未開封者向けリマインドEmail（AM 11:00推奨）
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex-shrink-0">
                            3
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-slate-900 mb-1">D+7日</div>
                            <div className="text-xs text-slate-700">
                              トライアル顧客向け訴求Email（契約転換促進）
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex-shrink-0">
                            4
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-slate-900 mb-1">継続的</div>
                            <div className="text-xs text-slate-700">
                              In-App通知（新機能トライアル未実施ユーザーへ）
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        {(() => {
                          const isAdopted = adoptedOutboundSuggestions.find(s => s.id === "out_sugg_timing");
                          return (
                            <Button
                              size="sm"
                              variant={isAdopted ? "default" : "outline"}
                              className={`text-xs h-8 ${isAdopted ? "bg-green-600 hover:bg-green-700" : ""}`}
                              onClick={() => handleAdoptOutboundSuggestion({
                                id: "out_sugg_timing",
                                type: "timing",
                                name: "4段階送信タイミング計画",
                                description: "D-Day、D+3、D+7、継続的配信の4段階構成"
                              })}
                              disabled={!!isAdopted}
                            >
                              {isAdopted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  採用済み
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3 mr-1" />
                                  提案を採用してこのOutboundを追加
                                </>
                              )}
                            </Button>
                          );
                        })()}
                      </div>
                    </div>

                    {/* 配信方式 */}
                    <div className="border border-slate-200 bg-white rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Send className="w-4 h-4 text-purple-600" />
                        <div className="text-sm font-semibold text-slate-900">推奨配信方式</div>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-start gap-2">
                          <span className="text-slate-600 min-w-[100px]">初回配信:</span>
                          <span className="text-slate-900">一括配信（Audience指定）</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-slate-600 min-w-[100px]">リマインド:</span>
                          <span className="text-slate-900">セグメント配信（未開封者に絞る）</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-slate-600 min-w-[100px]">トライアル向け:</span>
                          <span className="text-slate-900">個別配信（パーソナライズ推奨）</span>
                        </div>
                      </div>
                      <div className="mt-3">
                        {(() => {
                          const isAdopted = adoptedOutboundSuggestions.find(s => s.id === "out_sugg_method");
                          return (
                            <Button
                              size="sm"
                              variant={isAdopted ? "default" : "outline"}
                              className={`text-xs h-8 ${isAdopted ? "bg-green-600 hover:bg-green-700" : ""}`}
                              onClick={() => handleAdoptOutboundSuggestion({
                                id: "out_sugg_method",
                                type: "method",
                                name: "配信方式（一括→セグメント→個別）",
                                description: "段階的に配信方式を変える戦略"
                              })}
                              disabled={!!isAdopted}
                            >
                              {isAdopted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  採用済み
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3 mr-1" />
                                  提案を採用してこのOutboundを追加
                                </>
                              )}
                            </Button>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Follow-up方針 */}
                    <div className="border border-slate-200 bg-white rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <ArrowRight className="w-4 h-4 text-orange-600" />
                        <div className="text-sm font-semibold text-slate-900">Follow-up方針</div>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700">開封したが未クリック → さらなる価値訴求メール送信</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700">クリック済み → CSチームから個別フォローアップ（オプション）</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700">新機能トライアル実施 → サンクスメール + 追加活用ガイド送信</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700">未反応 → 2週間後に別角度からの訴求メール</span>
                        </div>
                      </div>
                      <div className="mt-3">
                        {(() => {
                          const isAdopted = adoptedOutboundSuggestions.find(s => s.id === "out_sugg_followup");
                          return (
                            <Button
                              size="sm"
                              variant={isAdopted ? "default" : "outline"}
                              className={`text-xs h-8 ${isAdopted ? "bg-green-600 hover:bg-green-700" : ""}`}
                              onClick={() => handleAdoptOutboundSuggestion({
                                id: "out_sugg_followup",
                                type: "followup",
                                name: "反応別Follow-up方針",
                                description: "顧客の反応に応じた4パターンのフォローアップ"
                              })}
                              disabled={!!isAdopted}
                            >
                              {isAdopted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  採用済み
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3 mr-1" />
                                  提案を採用してこのOutboundを追加
                                </>
                              )}
                            </Button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAiSuggestionDialogOpen(false)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
