import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
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
  Save,
  Send,
  Database,
  X,
  Trash2,
  Wand2,
  Building,
  User,
  FolderOpen,
  Edit3,
} from "lucide-react";
import { useNavigate } from "react-router";
import { KocoroOutputViewer } from "./kocoro-output-viewer";

interface ContentEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: ContentDraft | null;
}

interface ContentDraft {
  id: string;
  name: string;
  draftType: string;
  status: string;
  company: string;
  companyId: string;
  linkedProject: string | null;
  linkedUser: string | null;
  owner: string;
  lastEdited: string;
  aiGenerated: boolean;
  aiFunction: string | null;
  preview: string;
  kocoroOutput?: {
    agentName: string;
    outputType: "text" | "markdown" | "json" | "file" | "mixed";
    textOutput?: string;
    files?: Array<{
      id: string;
      name: string;
      type: "pdf" | "pptx" | "docx" | "md" | "other";
      size: string;
      createdAt: string;
      downloadUrl: string;
    }>;
    runInfo?: {
      executedAt: string;
      duration: string;
      status: "success" | "failed" | "running";
      cost?: string;
    };
  };
}

const draftTypeConfig = {
  message: { label: "Message", icon: MessageSquare, color: "bg-blue-100 text-blue-800 border-blue-200" },
  proposal: { label: "Proposal", icon: FileText, color: "bg-purple-100 text-purple-800 border-purple-200" },
  faq: { label: "FAQ", icon: HelpCircle, color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  help: { label: "Help", icon: GraduationCap, color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  onboarding: { label: "Onboarding", icon: GraduationCap, color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  summary: { label: "Summary", icon: FileSearch, color: "bg-amber-100 text-amber-800 border-amber-200" },
  custom: { label: "Custom", icon: Lightbulb, color: "bg-slate-100 text-slate-800 border-slate-200" },
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

export function ContentEditDrawer({ open, onOpenChange, content }: ContentEditDrawerProps) {
  const navigate = useNavigate();
  const [draftName, setDraftName] = useState(content?.name || "");
  const [draftContent, setDraftContent] = useState(content?.preview || "");
  const [adjustmentPrompt, setAdjustmentPrompt] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);

  // Update state when content changes
  useEffect(() => {
    if (content) {
      setDraftName(content.name);
      setDraftContent(content.preview);
    }
  }, [content]);

  const handleClose = () => {
    setAdjustmentPrompt("");
    setIsRegenerating(false);
    setShowAIPanel(false);
    onOpenChange(false);
  };

  const handleSave = () => {
    console.log("Content保存", { id: content?.id, draftName, draftContent });
    handleClose();
  };

  const handleSaveToLibrary = () => {
    console.log("Libraryに登録", { id: content?.id, draftName });
    navigate("/library");
    handleClose();
  };

  const handleSendToOutbound = () => {
    console.log("Outboundに渡す", { id: content?.id, draftName });
    navigate("/outbound/compose");
    handleClose();
  };

  const handleDelete = () => {
    if (confirm("このContentを削除しますか？")) {
      console.log("Content削除", { id: content?.id });
      handleClose();
    }
  };

  const handleAIRegenerate = () => {
    setIsRegenerating(true);
    // Simulate AI regeneration
    setTimeout(() => {
      const updatedContent = draftContent + "\n\n[AIによる調整が適用されました]\n" + 
        (adjustmentPrompt ? `調整内容: ${adjustmentPrompt}` : "");
      setDraftContent(updatedContent);
      setIsRegenerating(false);
      setAdjustmentPrompt("");
    }, 1500);
  };

  if (!content) return null;

  const typeConfig = draftTypeConfig[content.draftType as keyof typeof draftTypeConfig];
  const TypeIcon = typeConfig?.icon || FileText;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-[900px] sm:max-w-[900px] overflow-y-auto p-0">
        <div className="sticky top-0 bg-white z-10 border-b px-6 py-4">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-slate-600" />
                <SheetTitle>Content編集</SheetTitle>
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
              Contentの内容を編集できます。AIによる調整も可能です。
            </SheetDescription>
          </SheetHeader>

          {/* Content Info */}
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              {typeConfig && (
                <Badge variant="outline" className={`text-xs ${typeConfig.color}`}>
                  <TypeIcon className="w-3 h-3 mr-1" />
                  {typeConfig.label}
                </Badge>
              )}
              {content.aiGenerated && content.aiFunction && (
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {aiFunctionLabels[content.aiFunction as keyof typeof aiFunctionLabels] || content.aiFunction}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <div className="flex items-center gap-1">
                <Building className="w-3 h-3" />
                <span>{content.company}</span>
              </div>
              {content.linkedProject && (
                <div className="flex items-center gap-1">
                  <FolderOpen className="w-3 h-3" />
                  <span>{content.linkedProject}</span>
                </div>
              )}
              {content.linkedUser && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{content.linkedUser}</span>
                </div>
              )}
            </div>
            <div className="text-xs text-slate-500">
              最終更新: {content.lastEdited} • 作成者: {content.owner}
            </div>
          </div>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Draft Name */}
          <div>
            <Label className="text-sm font-semibold text-slate-900 mb-2 block">
              Content名 *
            </Label>
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Content名を入力"
              className="text-sm"
            />
          </div>

          {/* Kocoro Output Viewer (if available) */}
          {content.kocoroOutput && (
            <div>
              <Label className="text-sm font-semibold text-slate-900 mb-3 block">
                Kocoro Agent 出力
              </Label>
              <KocoroOutputViewer
                agentName={content.kocoroOutput.agentName}
                outputType={content.kocoroOutput.outputType}
                textOutput={content.kocoroOutput.textOutput}
                files={content.kocoroOutput.files}
                runInfo={content.kocoroOutput.runInfo}
                onReExecute={() => {
                  console.log("Kocoro Agent を再実行");
                }}
              />
            </div>
          )}

          {/* Draft Content */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold text-slate-900">
                Content内容 *
              </Label>
              {content.aiGenerated && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAIPanel(!showAIPanel)}
                  className="text-xs h-7"
                >
                  <Wand2 className="w-3 h-3 mr-1" />
                  {showAIPanel ? "AI調整パネルを閉じる" : "AIで調整"}
                </Button>
              )}
            </div>
            <Textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              placeholder="Content内容を入力"
              className="text-sm font-mono"
              rows={20}
            />
          </div>

          {/* AI Adjustment Panel */}
          {showAIPanel && content.aiGenerated && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Wand2 className="w-5 h-5 text-purple-600 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-purple-900 mb-2">
                    AIで調整・再生成
                  </div>
                  <p className="text-xs text-purple-700 mb-3">
                    修正の方向性を指示して、AIにコンテンツを調整させることができます
                  </p>
                  <Textarea
                    value={adjustmentPrompt}
                    onChange={(e) => setAdjustmentPrompt(e.target.value)}
                    placeholder="例: もっとカジュアルなトーンに変更、具体的な数値を追加、簡潔にまとめる など"
                    className="text-xs mb-3 bg-white"
                    rows={3}
                  />
                  <Button
                    size="sm"
                    onClick={handleAIRegenerate}
                    disabled={isRegenerating || !adjustmentPrompt.trim()}
                    className="w-full"
                  >
                    {isRegenerating ? (
                      <>
                        <Wand2 className="w-4 h-4 mr-2 animate-spin" />
                        AI調整中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        AIで調整実行
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Action Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-slate-900 mb-2">次のステップ</div>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Save className="w-3 h-3" />
                <span><strong>保存:</strong> 変更内容をContent一覧に保存</span>
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
              onClick={handleSave}
              disabled={!draftName.trim() || !draftContent.trim()}
              variant="default"
            >
              <Save className="w-4 h-4 mr-2" />
              保存
            </Button>
            <Button
              onClick={handleSaveToLibrary}
              disabled={!draftName.trim() || !draftContent.trim()}
              variant="outline"
            >
              <Database className="w-4 h-4 mr-2" />
              Library登録
            </Button>
            <Button
              onClick={handleSendToOutbound}
              disabled={!draftName.trim() || !draftContent.trim()}
              variant="outline"
            >
              <Send className="w-4 h-4 mr-2" />
              Outboundへ
            </Button>
          </div>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={handleClose}
              className="flex-1"
            >
              キャンセル
            </Button>
            <Button
              variant="ghost"
              onClick={handleDelete}
              className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              削除
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}