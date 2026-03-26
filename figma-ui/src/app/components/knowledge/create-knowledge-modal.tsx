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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import {
  FileText,
  BookOpen,
  Sparkles,
  TrendingUp,
  Mail,
  MessageSquare,
  Calendar,
  Bell,
  Building,
  Users,
  User,
  ArrowRight,
  CheckCircle2,
  Send,
  AlertCircle,
} from "lucide-react";

interface CreateKnowledgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type KnowledgeType = "template" | "playbook" | "proposal_pattern" | "knowledge_note" | null;

const knowledgeTypeOptions = [
  {
    value: "template" as const,
    label: "Template",
    icon: FileText,
    description: "再利用する具体フォーマット",
    detail: "Email、MTG議題、サポート回答など、定型的な文面のフォーマットを作成します",
    color: "border-blue-500 bg-blue-50",
  },
  {
    value: "playbook" as const,
    label: "Playbook",
    icon: TrendingUp,
    description: "条件分岐を含む実行ガイド",
    detail: "Health Score低下時の対応手順、エスカレーション基準など、状況に応じた実行手順を作成します",
    color: "border-emerald-500 bg-emerald-50",
  },
  {
    value: "proposal_pattern" as const,
    label: "Proposal Pattern",
    icon: Sparkles,
    description: "提案やアクション生成の型",
    detail: "追加ライセンス提案、契約更新提案など、AIがActionを生成する際の構造を定義します",
    color: "border-purple-500 bg-purple-50",
  },
  {
    value: "knowledge_note" as const,
    label: "Knowledge Note",
    icon: BookOpen,
    description: "運用知識や判断メモ",
    detail: "特定顧客の特性、過去の対応ノウハウ、判断基準など、ナレッジとして残すメモを作成します",
    color: "border-slate-500 bg-slate-50",
  },
];

export function CreateKnowledgeModal({ open, onOpenChange }: CreateKnowledgeModalProps) {
  const [selectedType, setSelectedType] = useState<KnowledgeType>(null);
  const [showCreationDrawer, setShowCreationDrawer] = useState(false);

  const handleTypeSelect = (type: KnowledgeType) => {
    setSelectedType(type);
  };

  const handleProceed = () => {
    if (!selectedType) return;
    onOpenChange(false);
    setShowCreationDrawer(true);
  };

  const handleCloseAll = () => {
    setShowCreationDrawer(false);
    setSelectedType(null);
  };

  return (
    <>
      {/* Type Selection Modal */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[calc(100vh-4rem)] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Knowledge 新規作成
            </DialogTitle>
            <DialogDescription>
              作成する Knowledge の種別を選択してください。今後も再利用する資産として保存されます。
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 overflow-y-auto">
            <div className="space-y-3">
              {knowledgeTypeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <div
                    key={option.value}
                    onClick={() => handleTypeSelect(option.value)}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      selectedType === option.value
                        ? option.color
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${selectedType === option.value ? 'bg-white' : 'bg-slate-100'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-slate-900">{option.label}</h3>
                          {selectedType === option.value && (
                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mb-1">{option.description}</p>
                        <p className="text-xs text-slate-500 italic">{option.detail}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-blue-900 mb-1">
                    再利用資産の作成
                  </p>
                  <p className="text-xs text-blue-800">
                    ここでは今後も使える Knowledge 資産を作成します。今すぐ使う単発の Content を作る場合は、Content Jobs 画面の「新規Content作成」をご利用ください。
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleProceed}
              disabled={!selectedType}
            >
              <ArrowRight className="w-4 h-4 mr-1" />
              作成を開始
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Creation Drawer (type-specific) */}
      {selectedType && (
        <KnowledgeCreationDrawer
          open={showCreationDrawer}
          onOpenChange={handleCloseAll}
          knowledgeType={selectedType}
        />
      )}
    </>
  );
}

interface KnowledgeCreationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  knowledgeType: Exclude<KnowledgeType, null>;
}

function KnowledgeCreationDrawer({ open, onOpenChange, knowledgeType }: KnowledgeCreationDrawerProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [intendedUse, setIntendedUse] = useState("");
  const [applicableScope, setApplicableScope] = useState("Company");
  const [linkedActionType, setLinkedActionType] = useState("");
  const [channel, setChannel] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");

  // Type-specific fields
  const [variables, setVariables] = useState("");
  const [sampleOutput, setSampleOutput] = useState("");
  const [triggerCondition, setTriggerCondition] = useState("");
  const [recommendedSteps, setRecommendedSteps] = useState("");
  const [nonApplicableCase, setNonApplicableCase] = useState("");
  const [patternStructure, setPatternStructure] = useState("");
  const [evidenceRequirement, setEvidenceRequirement] = useState("");
  const [summary, setSummary] = useState("");
  const [relatedObjects, setRelatedObjects] = useState("");
  const [notes, setNotes] = useState("");

  const typeConfig = knowledgeTypeOptions.find(opt => opt.value === knowledgeType);
  const Icon = typeConfig?.icon || FileText;

  const handleSaveDraft = () => {
    console.log("Saving knowledge draft:", {
      knowledgeType,
      title,
      category,
      intendedUse,
      // ... other fields
    });
    onOpenChange();
  };

  const handleRequestReview = () => {
    console.log("Requesting review for knowledge:", {
      knowledgeType,
      title,
    });
    onOpenChange();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[900px] sm:max-w-[900px] p-0">
        <SheetHeader className="p-6 pb-4 border-b bg-slate-50">
          <SheetTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            {typeConfig?.label} 新規作成
          </SheetTitle>
          <SheetDescription>
            {typeConfig?.detail}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="p-6 space-y-5">
            {/* Common Fields */}
            <div>
              <Label htmlFor="title" className="text-sm font-semibold text-slate-900">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: フォローアップメール（決裁者向け）"
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category" className="text-sm font-semibold text-slate-900">
                  Category
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category" className="mt-2">
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {knowledgeType === "template" && (
                      <>
                        <SelectItem value="email_templates">Email Templates</SelectItem>
                        <SelectItem value="support_templates">Support Templates</SelectItem>
                        <SelectItem value="meeting_templates">Meeting Templates</SelectItem>
                        <SelectItem value="notification_templates">Notification Templates</SelectItem>
                      </>
                    )}
                    {knowledgeType === "playbook" && (
                      <>
                        <SelectItem value="playbooks">Playbooks</SelectItem>
                        <SelectItem value="risk_response">Risk Response</SelectItem>
                        <SelectItem value="escalation">Escalation</SelectItem>
                      </>
                    )}
                    {knowledgeType === "proposal_pattern" && (
                      <>
                        <SelectItem value="proposal_patterns">Proposal Patterns</SelectItem>
                        <SelectItem value="expansion">Expansion</SelectItem>
                        <SelectItem value="renewal">Renewal</SelectItem>
                      </>
                    )}
                    {knowledgeType === "knowledge_note" && (
                      <>
                        <SelectItem value="knowledge_notes">Knowledge Notes</SelectItem>
                        <SelectItem value="customer_insights">Customer Insights</SelectItem>
                        <SelectItem value="best_practices">Best Practices</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="scope" className="text-sm font-semibold text-slate-900">
                  Applicable Scope
                </Label>
                <Select value={applicableScope} onValueChange={setApplicableScope}>
                  <SelectTrigger id="scope" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Company">
                      <div className="flex items-center gap-2">
                        <Building className="w-3.5 h-3.5" />
                        Company
                      </div>
                    </SelectItem>
                    <SelectItem value="Project">
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5" />
                        Project
                      </div>
                    </SelectItem>
                    <SelectItem value="User">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5" />
                        User
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="intended-use" className="text-sm font-semibold text-slate-900">
                Intended Use <span className="text-red-500">*</span>
              </Label>
              <Input
                id="intended-use"
                value={intendedUse}
                onChange={(e) => setIntendedUse(e.target.value)}
                placeholder="例: 決裁者が会議を欠席した際の個別フォローアップ"
                className="mt-2"
              />
            </div>

            {knowledgeType === "template" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="action-type" className="text-sm font-semibold text-slate-900">
                    Linked Action Type
                  </Label>
                  <Select value={linkedActionType} onValueChange={setLinkedActionType}>
                    <SelectTrigger id="action-type" className="mt-2">
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="send_external">Send External</SelectItem>
                      <SelectItem value="internal_share">Internal Share</SelectItem>
                      <SelectItem value="propose_action">Propose Action</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="channel" className="text-sm font-semibold text-slate-900">
                    Channel
                  </Label>
                  <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger id="channel" className="mt-2">
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="slack">Slack / Chatwork</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="internal">Internal Note</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="tags" className="text-sm font-semibold text-slate-900">
                Tags
              </Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="カンマ区切りで入力 (例: decision_maker, follow_up, meeting)"
                className="mt-2"
              />
            </div>

            <Separator />

            {/* Template-specific fields */}
            {knowledgeType === "template" && (
              <>
                <div>
                  <Label htmlFor="variables" className="text-sm font-semibold text-slate-900">
                    Variables
                  </Label>
                  <Textarea
                    id="variables"
                    value={variables}
                    onChange={(e) => setVariables(e.target.value)}
                    placeholder="例: {{company_name}}, {{contact_name}}, {{csm_name}}"
                    className="mt-2 min-h-[80px] font-mono text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="text-sm font-semibold text-slate-900">
                    Body / Template Content <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="テンプレート本文を入力してください..."
                    className="mt-2 min-h-[200px] font-mono text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="sample-output" className="text-sm font-semibold text-slate-900">
                    Sample Output
                  </Label>
                  <Textarea
                    id="sample-output"
                    value={sampleOutput}
                    onChange={(e) => setSampleOutput(e.target.value)}
                    placeholder="変数を埋めた場合のサンプル出力..."
                    className="mt-2 min-h-[150px] font-mono text-sm"
                  />
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-900 mb-1">
                        外部送信テンプレート
                      </p>
                      <p className="text-xs text-amber-800">
                        External Send に使用するテンプレートは、承認後にガバナンス承認フローを経る必要があります。
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Playbook-specific fields */}
            {knowledgeType === "playbook" && (
              <>
                <div>
                  <Label htmlFor="trigger-condition" className="text-sm font-semibold text-slate-900">
                    Trigger Condition
                  </Label>
                  <Input
                    id="trigger-condition"
                    value={triggerCondition}
                    onChange={(e) => setTriggerCondition(e.target.value)}
                    placeholder="例: Health Scoreが前週比20%以上低下"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="recommended-steps" className="text-sm font-semibold text-slate-900">
                    Recommended Steps <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="recommended-steps"
                    value={recommendedSteps}
                    onChange={(e) => setRecommendedSteps(e.target.value)}
                    placeholder="実行手順を記述してください...&#10;1. 〇〇を確認&#10;2. 〇〇に連絡&#10;3. ..."
                    className="mt-2 min-h-[200px]"
                  />
                </div>

                <div>
                  <Label htmlFor="non-applicable" className="text-sm font-semibold text-slate-900">
                    Non-applicable Case
                  </Label>
                  <Textarea
                    id="non-applicable"
                    value={nonApplicableCase}
                    onChange={(e) => setNonApplicableCase(e.target.value)}
                    placeholder="このプレイブックが適用できないケースを記述..."
                    className="mt-2 min-h-[80px]"
                  />
                </div>
              </>
            )}

            {/* Proposal Pattern-specific fields */}
            {knowledgeType === "proposal_pattern" && (
              <>
                <div>
                  <Label htmlFor="pattern-structure" className="text-sm font-semibold text-slate-900">
                    Pattern Structure <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="pattern-structure"
                    value={patternStructure}
                    onChange={(e) => setPatternStructure(e.target.value)}
                    placeholder="提案の構造を記述...&#10;■ 現在の利用状況&#10;■ 拡大機会&#10;■ 想定ROI&#10;■ 次のステップ"
                    className="mt-2 min-h-[200px]"
                  />
                </div>

                <div>
                  <Label htmlFor="evidence-requirement" className="text-sm font-semibold text-slate-900">
                    Evidence Requirement
                  </Label>
                  <Input
                    id="evidence-requirement"
                    value={evidenceRequirement}
                    onChange={(e) => setEvidenceRequirement(e.target.value)}
                    placeholder="例: product_usage, meeting_minutes, crm_opportunity"
                    className="mt-2"
                  />
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-700" />
                    <p className="text-xs font-semibold text-purple-900">
                      AI Ready Pattern
                    </p>
                  </div>
                  <p className="text-xs text-purple-800 mt-1">
                    このパターンは AI がActionを生成する際に参照されます
                  </p>
                </div>
              </>
            )}

            {/* Knowledge Note-specific fields */}
            {knowledgeType === "knowledge_note" && (
              <>
                <div>
                  <Label htmlFor="summary" className="text-sm font-semibold text-slate-900">
                    Summary
                  </Label>
                  <Textarea
                    id="summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="要約を入力..."
                    className="mt-2 min-h-[80px]"
                  />
                </div>

                <div>
                  <Label htmlFor="notes" className="text-sm font-semibold text-slate-900">
                    Notes <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="詳細なナレッジ内容を記述..."
                    className="mt-2 min-h-[200px]"
                  />
                </div>

                <div>
                  <Label htmlFor="related-objects" className="text-sm font-semibold text-slate-900">
                    Related Objects
                  </Label>
                  <Input
                    id="related-objects"
                    value={relatedObjects}
                    onChange={(e) => setRelatedObjects(e.target.value)}
                    placeholder="関連するCompany、Project、Actionなど"
                    className="mt-2"
                  />
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t bg-white flex gap-2">
          <Button
            variant="outline"
            onClick={onOpenChange}
          >
            キャンセル
          </Button>
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={!title || !intendedUse}
          >
            <CheckCircle2 className="w-4 h-4 mr-1" />
            下書き保存
          </Button>
          <Button
            onClick={handleRequestReview}
            disabled={!title || !intendedUse}
          >
            <Send className="w-4 h-4 mr-1" />
            レビュー依頼
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}