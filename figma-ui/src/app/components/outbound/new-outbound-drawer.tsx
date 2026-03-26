import { useState } from "react";
import { useNavigate } from "react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import {
  Reply,
  Send,
  Megaphone,
  TrendingUp,
  Heart,
  FileEdit,
  Mail,
  MessageSquare,
  Slack as SlackIcon,
  Building2,
  FolderKanban,
  User,
  Users,
  ChevronLeft,
  ChevronRight,
  FileText,
  Sparkles,
} from "lucide-react";

interface NewOutboundDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const outboundTypes = [
  {
    value: "reply",
    label: "Reply",
    icon: Reply,
    description: "問い合わせやログに対する返信",
    color: "bg-blue-50 border-blue-200 text-blue-900",
  },
  {
    value: "follow_up",
    label: "Follow-up",
    icon: Send,
    description: "前回接点の続きのフォロー",
    color: "bg-emerald-50 border-emerald-200 text-emerald-900",
  },
  {
    value: "announcement",
    label: "Announcement",
    icon: Megaphone,
    description: "案内・告知",
    color: "bg-purple-50 border-purple-200 text-purple-900",
  },
  {
    value: "nurture",
    label: "Nurture",
    icon: TrendingUp,
    description: "活用促進・教育",
    color: "bg-amber-50 border-amber-200 text-amber-900",
  },
  {
    value: "check_in",
    label: "Check-in",
    icon: Heart,
    description: "様子確認・軽い接触",
    color: "bg-pink-50 border-pink-200 text-pink-900",
  },
  {
    value: "custom",
    label: "Custom",
    icon: FileEdit,
    description: "文脈を持たない手動起票",
    color: "bg-slate-50 border-slate-200 text-slate-900",
  },
];

const channelOptions = [
  { value: "email", label: "Email", icon: Mail },
  { value: "intercom", label: "Intercom", icon: MessageSquare },
  { value: "slack", label: "Slack", icon: SlackIcon },
  { value: "chatwork", label: "Chatwork", icon: MessageSquare },
];

const scopeOptions = [
  { value: "company", label: "Company", icon: Building2 },
  { value: "project", label: "Project", icon: FolderKanban },
  { value: "user", label: "User", icon: User },
  { value: "audience", label: "Audience", icon: Users },
];

export function NewOutboundDrawer({ open, onOpenChange }: NewOutboundDrawerProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [selectedScope, setSelectedScope] = useState<string>("");
  const [linkedContext, setLinkedContext] = useState<string>("");

  // Step 2 fields
  const [outboundName, setOutboundName] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [useTemplate, setUseTemplate] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  const handleReset = () => {
    setStep(1);
    setSelectedType("");
    setSelectedChannel("");
    setSelectedScope("");
    setLinkedContext("");
    setOutboundName("");
    setSubject("");
    setBody("");
    setUseTemplate(false);
    setSelectedTemplate("");
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  const handleSaveDraft = () => {
    // 下書き保存処理
    console.log("Saving draft...");
    handleClose();
  };

  const handleOpenInCompose = () => {
    // Composeで開く処理
    const params = new URLSearchParams({
      type: selectedType,
      channel: selectedChannel,
      scope: selectedScope,
      linkedContext: linkedContext,
      name: outboundName,
      subject: subject,
      body: body,
      template: selectedTemplate,
    });
    navigate(`/outbound/compose?${params.toString()}`);
    handleClose();
  };

  const canProceedToStep2 = selectedType && selectedChannel && selectedScope;
  const canSave = outboundName && (subject || useTemplate);

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-[960px] sm:max-w-[960px] overflow-y-auto p-0">
        <div className="p-6">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl flex items-center gap-2">
              <Send className="w-6 h-6" />
              新規Outbound作成
              <Badge variant="outline" className="ml-2">
                Step {step}/2
              </Badge>
            </SheetTitle>
            <SheetDescription className="text-sm">
              顧客向け接点を起票します。送信実行はCompose画面で行います。
            </SheetDescription>
          </SheetHeader>

          {/* Step 1: Type & Context */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Outbound Type Selection */}
              <div className="space-y-4">
                <div className="pb-2 border-b">
                  <h3 className="text-base font-semibold text-slate-900">送信タイプを選択</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    目的に応じてタイプを選んでください
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {outboundTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        onClick={() => setSelectedType(type.value)}
                        className={`border-2 rounded-lg p-4 text-left transition-all hover:shadow-md ${
                          selectedType === type.value
                            ? `${type.color} ring-2 ring-blue-500`
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm mb-1">{type.label}</div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {type.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Channel Selection */}
              <div className="space-y-4">
                <div className="pb-2 border-b">
                  <h3 className="text-base font-semibold text-slate-900">チャネルを選択</h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {channelOptions.map((channel) => {
                    const Icon = channel.icon;
                    return (
                      <button
                        key={channel.value}
                        onClick={() => setSelectedChannel(channel.value)}
                        className={`border-2 rounded-lg p-4 text-center transition-all hover:shadow-md ${
                          selectedChannel === channel.value
                            ? "bg-blue-50 border-blue-500 ring-2 ring-blue-500"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <Icon className="w-6 h-6 mx-auto mb-2" />
                        <div className="font-semibold text-sm">{channel.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Target Scope Selection */}
              <div className="space-y-4">
                <div className="pb-2 border-b">
                  <h3 className="text-base font-semibold text-slate-900">対象スコープを選択</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {scopeOptions.map((scope) => {
                    const Icon = scope.icon;
                    return (
                      <button
                        key={scope.value}
                        onClick={() => setSelectedScope(scope.value)}
                        className={`border-2 rounded-lg p-4 text-left transition-all hover:shadow-md ${
                          selectedScope === scope.value
                            ? "bg-blue-50 border-blue-500 ring-2 ring-blue-500"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5" />
                          <div className="font-semibold text-sm">{scope.label}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Linked Context */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-700">
                  紐付ける文脈（Company / Project / User / Audience）
                </Label>
                <Input
                  placeholder="例: テクノロジーイノベーション株式会社"
                  value={linkedContext}
                  onChange={(e) => setLinkedContext(e.target.value)}
                  className="h-10"
                />
                <p className="text-xs text-slate-500">
                  任意: 後からCompose画面でも設定できます
                </p>
              </div>

              {/* Step 1 Footer */}
              <div className="flex gap-3 mt-8 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="h-11 px-6"
                >
                  キャンセル
                </Button>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!canProceedToStep2}
                  className="flex-1 h-11"
                >
                  次へ：内容を入力
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Content & Preview */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Selected Context Summary */}
              <div className="bg-slate-50 border-2 border-slate-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">選択した設定</h4>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {outboundTypes.find((t) => t.value === selectedType)?.label}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {channelOptions.find((c) => c.value === selectedChannel)?.label}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {scopeOptions.find((s) => s.value === selectedScope)?.label}
                  </Badge>
                  {linkedContext && (
                    <Badge variant="outline" className="text-xs">
                      {linkedContext}
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              {/* Outbound Name */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-700">
                  Outbound名 *
                </Label>
                <Input
                  placeholder="例: 利用低下クラスター向けリエンゲージメントEmail"
                  value={outboundName}
                  onChange={(e) => setOutboundName(e.target.value)}
                  className="h-10"
                />
              </div>

              {/* Template Toggle */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useTemplate"
                    checked={useTemplate}
                    onChange={(e) => setUseTemplate(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="useTemplate" className="text-sm font-medium cursor-pointer">
                    Templateを使用
                  </Label>
                </div>
                {useTemplate && (
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Templateを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="template-1">リエンゲージメントTemplate</SelectItem>
                      <SelectItem value="template-2">オンボーディングTemplate</SelectItem>
                      <SelectItem value="template-3">新機能案内Template</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Separator />

              {/* Subject */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-700">
                  件名 {!useTemplate && "*"}
                </Label>
                <Input
                  placeholder="例: ご利用状況の確認とサポートのご案内"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={useTemplate}
                  className="h-10"
                />
              </div>

              {/* Body */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-700">
                  本文
                </Label>
                <Textarea
                  placeholder="本文を入力してください..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={useTemplate}
                  className="min-h-[200px] resize-none"
                />
                {!useTemplate && (
                  <p className="text-xs text-slate-500">
                    後からCompose画面でリッチエディタを使用して編集できます
                  </p>
                )}
              </div>

              {/* AI Suggestion */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-blue-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">AI提案</p>
                    <p className="text-sm text-blue-800 leading-relaxed">
                      Compose画面でAIを使って本文を生成・調整できます
                    </p>
                  </div>
                </div>
              </div>

              {/* Preview Section */}
              <div className="space-y-3">
                <div className="pb-2 border-b">
                  <h3 className="text-base font-semibold text-slate-900">受信者プレビュー</h3>
                </div>
                <div className="bg-slate-50 border-2 border-slate-200 rounded-lg p-4 text-sm text-slate-600">
                  <p>Compose画面で対象Audienceを確認できます</p>
                </div>
              </div>

              {/* Step 2 Footer */}
              <div className="flex gap-3 mt-8 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="h-11 px-6"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  戻る
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={!canSave}
                  className="h-11 px-6"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  下書き保存
                </Button>
                <Button
                  onClick={handleOpenInCompose}
                  disabled={!canSave}
                  className="flex-1 h-11"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Composeで開く
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
