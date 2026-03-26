import { useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
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
  Mail,
  MessageSquare,
  Calendar,
  Building,
  User,
  Link as LinkIcon,
  AlertCircle,
  Copy,
  CheckCircle2,
} from "lucide-react";

interface CreateContentJobDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 文脈から初期化する値
  linkedCompanyId?: string;
  linkedCompanyName?: string;
  linkedActionId?: string;
  linkedActionTitle?: string;
}

const contentTypeOptions = [
  { value: "email", label: "Email", icon: Mail, description: "顧客への連絡メール" },
  { value: "slack_chatwork", label: "Slack / Chatwork", icon: MessageSquare, description: "Slack/Chatwork通知メッセージ" },
  { value: "internal_note", label: "Internal Note", icon: FileText, description: "社内共有メモ" },
  { value: "support_reply", label: "Support Reply", icon: MessageSquare, description: "サポート返信" },
];

const mockTemplates = [
  { id: "template-follow-up", name: "フォローアップメール（決裁者向け）", channel: "email", description: "決裁者への個別フォローアップ用" },
  { id: "template-internal-memo", name: "社内共有メモ", channel: "internal_note", description: "CSMチーム内での情報共有用" },
  { id: "template-support-response", name: "サポート回答テンプレート", channel: "support_reply", description: "技術サポートの定型回答用" },
  { id: "template-slack-notification", name: "Slack/Chatwork通知テンプレート", channel: "slack_chatwork", description: "製品アップデートや重要通知用" },
];

const mockEvidenceCandidates = [
  { id: "ev-1", title: "週次MTG議事録 - 山田氏欠席", date: "2026-03-10", type: "meeting_minutes" },
  { id: "ev-2", title: "フォローアップメール未返信", date: "2026-03-08", type: "email_thread" },
  { id: "ev-4", title: "技術仕様確認依頼 - 未回答", date: "2026-03-03", type: "support_ticket" },
  { id: "ev-5", title: "四半期レビューMTG - 拡大希望", date: "2026-03-09", type: "meeting_minutes" },
];

export function CreateContentJobDrawer({
  open,
  onOpenChange,
  linkedCompanyId,
  linkedCompanyName,
  linkedActionId,
  linkedActionTitle,
}: CreateContentJobDrawerProps) {
  const [contentType, setContentType] = useState("email");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [recipient, setRecipient] = useState("");

  const selectedContentTypeConfig = contentTypeOptions.find(opt => opt.value === contentType);
  const availableTemplates = mockTemplates.filter(t => t.channel === contentType);

  const handleAIGenerate = () => {
    // AI下書き生成のロジック（モック）
    console.log("AI generating draft with:", {
      contentType,
      template: selectedTemplate,
      evidence: selectedEvidence,
    });
  };

  const handleSaveDraft = () => {
    console.log("Saving draft:", {
      contentType,
      draftTitle,
      draftBody,
      linkedAction: linkedActionId,
      linkedCompany: linkedCompanyId,
      template: selectedTemplate,
      evidence: selectedEvidence,
    });
    onOpenChange(false);
  };

  const toggleEvidence = (evidenceId: string) => {
    setSelectedEvidence(prev => 
      prev.includes(evidenceId) 
        ? prev.filter(id => id !== evidenceId)
        : [...prev, evidenceId]
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[800px] sm:max-w-[800px] p-0">
        <SheetHeader className="p-6 pb-4 border-b bg-slate-50">
          <SheetTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            新規Content作成（実行用）
          </SheetTitle>
          <SheetDescription>
            今この業務で使う単発のContent Jobを作成します。ActionやEvidenceに紐づけて実行用の文面を準備できます。
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="p-6 space-y-5">
            {/* Content Type */}
            <div>
              <Label className="text-sm font-semibold text-slate-900 mb-2 block">Content Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {contentTypeOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <div
                      key={option.value}
                      onClick={() => setContentType(option.value)}
                      className={`border rounded-lg p-3 cursor-pointer transition-all ${
                        contentType === option.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-semibold text-slate-900">{option.label}</span>
                      </div>
                      <p className="text-xs text-slate-600">{option.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Linked Context */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-blue-900">
                <LinkIcon className="w-4 h-4" />
                <span className="text-sm font-semibold">紐付け情報（自動入力）</span>
              </div>
              <div className="space-y-2">
                {linkedCompanyName && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="w-3.5 h-3.5 text-blue-700" />
                    <span className="text-blue-900">Company: <span className="font-medium">{linkedCompanyName}</span></span>
                  </div>
                )}
                {linkedActionTitle && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-3.5 h-3.5 text-blue-700" />
                    <span className="text-blue-900">Action: <span className="font-medium">{linkedActionTitle}</span></span>
                  </div>
                )}
                {!linkedCompanyName && !linkedActionTitle && (
                  <p className="text-xs text-blue-800 italic">画面文脈から自動で紐付けされます</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Template Candidates */}
            <div>
              <Label className="text-sm font-semibold text-slate-900 mb-2 block">
                テンプレート候補
                <span className="ml-2 text-xs font-normal text-slate-600">（任意）</span>
              </Label>
              <div className="space-y-2">
                {availableTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id === selectedTemplate ? "" : template.id)}
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${
                      selectedTemplate === template.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-slate-900">{template.name}</h4>
                        <p className="text-xs text-slate-600 mt-0.5">{template.description}</p>
                      </div>
                      {selectedTemplate === template.id && (
                        <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 ml-2" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Evidence Candidates */}
            <div>
              <Label className="text-sm font-semibold text-slate-900 mb-2 block">
                Evidence候補
                <span className="ml-2 text-xs font-normal text-slate-600">（参照する根拠を選択）</span>
              </Label>
              <div className="space-y-2">
                {mockEvidenceCandidates.map((evidence) => (
                  <div
                    key={evidence.id}
                    onClick={() => toggleEvidence(evidence.id)}
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${
                      selectedEvidence.includes(evidence.id)
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-xs font-semibold text-slate-900">{evidence.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{evidence.type}</Badge>
                          <span className="text-xs text-slate-600">{evidence.date}</span>
                        </div>
                      </div>
                      {selectedEvidence.includes(evidence.id) && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 ml-2" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Recipient (for email/support) */}
            {(contentType === "email" || contentType === "support_reply") && (
              <div>
                <Label htmlFor="recipient" className="text-sm font-semibold text-slate-900">
                  宛先 / 対象者
                </Label>
                <Input
                  id="recipient"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="山田 太郎様"
                  className="mt-2"
                />
              </div>
            )}

            {/* Draft Title */}
            <div>
              <Label htmlFor="draft-title" className="text-sm font-semibold text-slate-900">
                Draft タイトル
              </Label>
              <Input
                id="draft-title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="例: オンボーディング進捗確認フォローアップメール"
                className="mt-2"
              />
            </div>

            {/* Draft Body */}
            <div>
              <Label htmlFor="draft-body" className="text-sm font-semibold text-slate-900">
                下書き本文（初期入力）
              </Label>
              <Textarea
                id="draft-body"
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                placeholder="本文を入力するか、AIで下書き生成を利用してください..."
                className="mt-2 min-h-[200px] font-mono text-sm"
              />
            </div>

            {/* Note */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-900 mb-1">
                    今使うための作成
                  </p>
                  <p className="text-xs text-amber-800">
                    このCTAは、今の業務で使う単発のContent Jobを作成します。再利用可能なテンプレート資産を作る場合は、Knowledge / Templates 画面の「新規作成」をご利用ください。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t bg-white flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            キャンセル
          </Button>
          <Button
            variant="outline"
            onClick={handleAIGenerate}
            disabled={!contentType}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            AIで下書き生成
          </Button>
          <Button
            onClick={handleSaveDraft}
            disabled={!draftTitle || !contentType}
          >
            <CheckCircle2 className="w-4 h-4 mr-1" />
            下書き保存
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}