import { useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  AlertTriangle,
  Send,
  Copy,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Link as LinkIcon,
  AlertCircle,
  Building,
  FileText,
  ArrowUpRight,
} from "lucide-react";

interface ContentJobData {
  id: string;
  title: string;
  contentType: "email" | "internal_note" | "support_reply" | "proposal_summary" | "slack_chatwork";
  status: "draft" | "in_review" | "approved" | "sent" | "archived";
  linkedAction: string | null;
  linkedActionTitle: string | null;
  company: string;
  companyId: string;
  owner: string;
  lastEdited: string;
  templateId: string;
  templateName: string;
  recipient?: string;
  subject: string;
  body: string;
  evidenceIds: string[];
  missingFields: string[];
}

interface Template {
  id: string;
  name: string;
  channel: string;
  description: string;
}

interface Evidence {
  title: string;
  date: string;
  excerpt: string;
}

interface ContentJobModalsProps {
  selectedJobData: ContentJobData | undefined;
  mockTemplates: Template[];
  mockEvidence: Record<string, Evidence>;
  contentTypeConfig: any;
  
  // Apply Template Drawer
  showApplyTemplateDrawer: boolean;
  setShowApplyTemplateDrawer: (show: boolean) => void;
  
  // AI Draft Drawer
  showAIDraftDrawer: boolean;
  setShowAIDraftDrawer: (show: boolean) => void;
  
  // Review Request Modal
  showReviewRequestModal: boolean;
  setShowReviewRequestModal: (show: boolean) => void;
  
  // Approval Modal
  showApprovalModal: boolean;
  setShowApprovalModal: (show: boolean) => void;
  
  // Internal Send Modal
  showInternalSendModal: boolean;
  setShowInternalSendModal: (show: boolean) => void;
}

export function ContentJobModals({
  selectedJobData,
  mockTemplates,
  mockEvidence,
  contentTypeConfig,
  showApplyTemplateDrawer,
  setShowApplyTemplateDrawer,
  showAIDraftDrawer,
  setShowAIDraftDrawer,
  showReviewRequestModal,
  setShowReviewRequestModal,
  showApprovalModal,
  setShowApprovalModal,
  showInternalSendModal,
  setShowInternalSendModal,
}: ContentJobModalsProps) {
  const [selectedTemplate, setSelectedTemplate] = useState("");

  return (
    <>
      {/* Apply Template Drawer */}
      <Sheet open={showApplyTemplateDrawer} onOpenChange={setShowApplyTemplateDrawer}>
        <SheetContent side="right" className="w-[600px] sm:max-w-[600px] p-0">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle>テンプレートを適用</SheetTitle>
            <SheetDescription>
              利用可能なテンプレートを選択して適用します
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-180px)] p-6">
            <div className="space-y-4">
              {/* Template List */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">テンプレート一覧</h3>
                <div className="space-y-2">
                  {mockTemplates
                    .filter(t => selectedJobData && t.channel === selectedJobData.contentType)
                    .map((template) => (
                      <div
                        key={template.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-all ${
                          selectedTemplate === template.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedTemplate(template.id)}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="text-sm font-semibold text-slate-900">{template.name}</h4>
                          {selectedTemplate === template.id && (
                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                        <p className="text-xs text-slate-600">{template.description}</p>
                      </div>
                    ))}
                </div>
              </div>

              <Separator />

              {/* Applicable Scope */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">適用スコープ</h3>
                <div className="bg-slate-50 border rounded p-3">
                  <div className="space-y-2 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      <span>Company: {selectedJobData?.company}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Content Type: {selectedJobData && contentTypeConfig[selectedJobData.contentType].label}</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Variables */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">利用可能変数</h3>
                <div className="bg-slate-50 border rounded p-3">
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <code className="text-slate-700">{'{{company_name}}'}</code>
                      <Badge variant="outline" className="text-xs">自動入力</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <code className="text-slate-700">{'{{contact_name}}'}</code>
                      <Badge variant="outline" className="text-xs">自動入力</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <code className="text-slate-700">{'{{csm_name}}'}</code>
                      <Badge variant="outline" className="text-xs">自動入力</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Sample Output */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">プレビュー</h3>
                <div className="bg-slate-50 border rounded p-4">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {selectedTemplate ? 
                      `[テンプレート適用後のサンプル]\n\n${selectedJobData?.company}様\n\nいつも大変お世話になっております。\n担当の佐藤です。\n\n...(テンプレート内容が挿入されます)...` 
                      : 'テンプレートを選択してください'}
                  </p>
                </div>
              </div>
            </div>
          </ScrollArea>
          <div className="absolute bottom-0 left-0 right-0 p-6 border-t bg-white flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowApplyTemplateDrawer(false);
                setSelectedTemplate("");
              }}
            >
              キャンセル
            </Button>
            <Button
              className="flex-1"
              disabled={!selectedTemplate}
              onClick={() => {
                setShowApplyTemplateDrawer(false);
                setSelectedTemplate("");
              }}
            >
              <Copy className="w-4 h-4 mr-1" />
              適用
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* AI Draft Generation Drawer */}
      <Sheet open={showAIDraftDrawer} onOpenChange={setShowAIDraftDrawer}>
        <SheetContent side="right" className="w-[700px] sm:max-w-[700px] p-0">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              AIで下書き生成
            </SheetTitle>
            <SheetDescription>
              Evidence とテンプレートを参照して、AI が下書きを生成します
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-180px)] p-6">
            <div className="space-y-4">
              {/* Evidence */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">参照Evidence</h3>
                <div className="space-y-2">
                  {selectedJobData?.evidenceIds.map((evidenceId) => {
                    const evidence = mockEvidence[evidenceId as keyof typeof mockEvidence];
                    return (
                      <div key={evidenceId} className="border rounded p-3 bg-slate-50">
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="text-xs font-semibold text-slate-900">{evidence.title}</h4>
                          <Badge variant="outline" className="text-xs">参照中</Badge>
                        </div>
                        <p className="text-xs text-slate-600 mb-2">{evidence.date}</p>
                        <p className="text-xs text-slate-700 italic bg-white p-2 rounded border">
                          "{evidence.excerpt}"
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Template */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">使用テンプレート</h3>
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-sm font-medium text-blue-900">{selectedJobData?.templateName}</p>
                  <p className="text-xs text-blue-700 mt-1">
                    {mockTemplates.find(t => t.id === selectedJobData?.templateId)?.description}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Draft Preview */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">生成された下書き</h3>
                <div className="bg-slate-50 border rounded p-4 space-y-3">
                  <div>
                    <Label className="text-xs text-slate-600">件名</Label>
                    <p className="text-sm font-semibold text-slate-900 mt-1">
                      {selectedJobData?.subject}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <Label className="text-xs text-slate-600">本文</Label>
                    <div className="text-sm text-slate-900 mt-2 whitespace-pre-wrap leading-relaxed">
                      {selectedJobData?.body}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Missing Variables */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">不足している変数</h3>
                <div className="bg-amber-50 border border-amber-200 rounded p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-900 mb-1">
                        {selectedJobData?.missingFields && selectedJobData.missingFields.length > 0 
                          ? '以下の項目が不足しています' 
                          : 'すべての必須項目が揃っています'}
                      </p>
                      {selectedJobData?.missingFields && selectedJobData.missingFields.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {selectedJobData.missingFields.map((field, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs bg-white">
                              {field}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          <div className="absolute bottom-0 left-0 right-0 p-6 border-t bg-white flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAIDraftDrawer(false)}
            >
              キャンセル
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowAIDraftDrawer(false)}
            >
              保存
            </Button>
            <Button
              onClick={() => {
                setShowAIDraftDrawer(false);
                setShowReviewRequestModal(true);
              }}
            >
              <ArrowRight className="w-4 h-4 mr-1" />
              レビューへ送る
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Review Request Modal */}
      <Dialog open={showReviewRequestModal} onOpenChange={setShowReviewRequestModal}>
        <DialogContent className="sm:max-w-[550px] max-h-[calc(100vh-4rem)] flex flex-col">
          <DialogHeader>
            <DialogTitle>レビュー依頼</DialogTitle>
            <DialogDescription>
              作成したContentをレビュー担当者に送信します
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 overflow-y-auto">
            {/* Content */}
            <div>
              <Label className="text-sm font-semibold text-slate-900">対象文面</Label>
              <div className="bg-slate-50 border rounded p-3 mt-2">
                <p className="text-sm font-medium text-slate-900 mb-1">{selectedJobData?.title}</p>
                <p className="text-xs text-slate-600">{selectedJobData?.subject}</p>
              </div>
            </div>

            {/* Linked Action */}
            {selectedJobData?.linkedAction && (
              <div>
                <Label className="text-sm font-semibold text-slate-900">関連Action</Label>
                <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-2">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-blue-700" />
                    <p className="text-sm text-blue-900">{selectedJobData.linkedActionTitle}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Evidence */}
            <div>
              <Label className="text-sm font-semibold text-slate-900 mb-2">根拠Evidence ({selectedJobData?.evidenceIds.length}件)</Label>
              <div className="mt-2 max-h-[200px] overflow-y-auto space-y-2">
                {selectedJobData?.evidenceIds.map((evidenceId) => {
                  const evidence = mockEvidence[evidenceId as keyof typeof mockEvidence];
                  return (
                    <div key={evidenceId} className="border rounded p-2 bg-slate-50">
                      <p className="text-xs font-semibold text-slate-900">{evidence.title}</p>
                      <p className="text-xs text-slate-600">{evidence.date}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Reviewer */}
            <div>
              <Label className="text-sm font-semibold text-slate-900">依頼先カテゴリ</Label>
              <Select defaultValue="team-lead">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team-lead">チームリーダー</SelectItem>
                  <SelectItem value="manager">マネージャー</SelectItem>
                  <SelectItem value="senior-csm">シニアCSM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReviewRequestModal(false)}
            >
              キャンセル
            </Button>
            <Button
              onClick={() => setShowReviewRequestModal(false)}
            >
              <Send className="w-4 h-4 mr-1" />
              依頼送信
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Modal */}
      <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
        <DialogContent className="sm:max-w-[600px] max-h-[calc(100vh-4rem)] flex flex-col">
          <DialogHeader>
            <DialogTitle>Content承認</DialogTitle>
            <DialogDescription>
              内容を確認して承認・差し戻しを判断してください
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 overflow-y-auto">
            {/* Content Body */}
            <div>
              <Label className="text-sm font-semibold text-slate-900">本文</Label>
              <div className="bg-slate-50 border rounded p-4 mt-2">
                <div className="mb-3 pb-3 border-b">
                  <div className="text-xs text-slate-500 mb-1">件名:</div>
                  <div className="text-sm font-semibold text-slate-900">{selectedJobData?.subject}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-2">本文:</div>
                  <div className="text-sm text-slate-900 whitespace-pre-wrap leading-relaxed">
                    {selectedJobData?.body}
                  </div>
                </div>
              </div>
            </div>

            {/* Recipient Type */}
            {(selectedJobData?.contentType === 'email' || selectedJobData?.contentType === 'support_reply') && (
              <div>
                <Label className="text-sm font-semibold text-slate-900">宛先種別</Label>
                <div className="bg-slate-50 border rounded p-3 mt-2">
                  <p className="text-sm text-slate-900">{selectedJobData.recipient}</p>
                </div>
              </div>
            )}

            {/* Template Used */}
            <div>
              <Label className="text-sm font-semibold text-slate-900">利用テンプレート</Label>
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-2">
                <p className="text-sm font-medium text-blue-900">{selectedJobData?.templateName}</p>
              </div>
            </div>

            {/* Related Evidence */}
            <div>
              <Label className="text-sm font-semibold text-slate-900 mb-2">関連Evidence</Label>
              <div className="mt-2 space-y-2">
                {selectedJobData?.evidenceIds.map((evidenceId) => {
                  const evidence = mockEvidence[evidenceId as keyof typeof mockEvidence];
                  return (
                    <div key={evidenceId} className="border rounded p-2 bg-slate-50">
                      <p className="text-xs font-semibold text-slate-900">{evidence.title}</p>
                      <p className="text-xs text-slate-600 mb-1">{evidence.date}</p>
                      <p className="text-xs text-slate-700 italic">"{evidence.excerpt}"</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowApprovalModal(false)}
            >
              キャンセル
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowApprovalModal(false)}
            >
              差し戻し
            </Button>
            <Button
              onClick={() => setShowApprovalModal(false)}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              承認
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Internal Send Modal */}
      <Dialog open={showInternalSendModal} onOpenChange={setShowInternalSendModal}>
        <DialogContent className="sm:max-w-[500px] max-h-[calc(100vh-4rem)] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-900">
              <ArrowUpRight className="w-5 h-5" />
              社内送信確認
            </DialogTitle>
            <DialogDescription>
              社内チームへの情報共有を実行します
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 overflow-y-auto">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-emerald-900 mb-1">社内送信</p>
              <p className="text-xs text-emerald-800">
                この操作は社内チームへの共有のみです。外部への送信は行われません。
              </p>
            </div>

            {/* Recipient Category */}
            <div>
              <Label className="text-sm font-semibold text-slate-900">宛先カテゴリ</Label>
              <Select defaultValue="csm-team">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csm-team">CSMチーム全体</SelectItem>
                  <SelectItem value="sales-team">営業チーム</SelectItem>
                  <SelectItem value="support-team">サポートチーム</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Content */}
            {selectedJobData && (
              <div>
                <Label className="text-sm font-semibold text-slate-900">本文</Label>
                <div className="bg-slate-50 border rounded p-3 mt-2">
                  <p className="text-sm font-semibold text-slate-900 mb-2">{selectedJobData.subject}</p>
                  <p className="text-xs text-slate-700 line-clamp-3">{selectedJobData.body}</p>
                </div>
              </div>
            )}

            {/* Related Action */}
            {selectedJobData?.linkedAction && (
              <div>
                <Label className="text-sm font-semibold text-slate-900">関連Action</Label>
                <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-2">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-blue-700" />
                    <p className="text-sm text-blue-900">{selectedJobData.linkedActionTitle}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInternalSendModal(false)}
            >
              キャンセル
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setShowInternalSendModal(false)}
            >
              <Send className="w-4 h-4 mr-1" />
              送信
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}