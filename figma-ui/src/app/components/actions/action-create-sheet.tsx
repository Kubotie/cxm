import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Separator } from "../ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Info, Send, FileText, Sparkles } from "lucide-react";

interface ActionCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceContext?: {
    type: string;
    linkedCompany?: string;
    linkedProject?: string;
    linkedEvidence?: any[];
  };
}

export function ActionCreateSheet({ open, onOpenChange, sourceContext }: ActionCreateSheetProps) {
  const [searchParams] = useSearchParams();
  const fromEvidence = searchParams.get("fromEvidence");

  const [title, setTitle] = useState("");
  const [actionType, setActionType] = useState("send_external");
  const [purpose, setPurpose] = useState("");
  const [priority, setPriority] = useState("medium");
  const [owner, setOwner] = useState("佐藤 太郎");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("proposed");
  const [linkedCompany, setLinkedCompany] = useState("");
  const [linkedProject, setLinkedProject] = useState("");
  const [nextStep, setNextStep] = useState("");

  // モックデータ
  const companies = [
    { id: "1", name: "テックイノベーション株式会社" },
    { id: "2", name: "グローバルソリューションズ株式会社" },
  ];

  const projects = [
    { id: "proj_1", name: "プロジェクトA" },
    { id: "proj_2", name: "全社DX推進" },
  ];

  const owners = [
    { id: "1", name: "佐藤 太郎" },
    { id: "2", name: "田中 花子" },
    { id: "3", name: "鈴木 次郎" },
  ];

  const recommendedPlaybook = {
    id: "pb_1",
    title: "決裁者フォローアップPlaybook",
    description: "会議欠席した決裁者への標準的なフォローアップ手順",
  };

  const saveDraft = () => {
    alert("下書き保存しました（モック）");
    onOpenChange(false);
  };

  const saveAndCreateContent = () => {
    alert("Actionを保存してContent作成画面に遷移します（モック）");
    onOpenChange(false);
  };

  const saveAndCreateOutbound = () => {
    alert("Actionを保存してOutbound作成画面に遷移します（モック）");
    onOpenChange(false);
  };

  const applyPlaybook = (playbookId: string) => {
    alert(`Playbook ${playbookId} を適用しました（モック）`);
    setTitle("決裁者への個別フォローアップ");
    setPurpose("会議欠席した決裁者との関係性を再構築し、プロジェクト推進の意欲を確認する");
    setNextStep("個別MTG設定の提案メールを送信し、技術的な懸念点のヒアリングを実施する");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[700px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>新規Action作成</SheetTitle>
          <SheetDescription>顧客に対するアクションを定義します</SheetDescription>
        </SheetHeader>

        {/* Source Context表示 */}
        {(sourceContext || fromEvidence) && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-4">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {sourceContext?.type || "Evidence"}から作成
              </span>
            </div>
            {sourceContext?.linkedEvidence && sourceContext.linkedEvidence.length > 0 && (
              <p className="text-sm text-blue-700 mt-1">
                Evidence {sourceContext.linkedEvidence.length}件の文脈を引き継いでいます
              </p>
            )}
          </div>
        )}

        {/* 推奨Playbook */}
        {recommendedPlaybook && (
          <div className="bg-green-50 border border-green-200 rounded p-3 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">推奨Playbook</span>
            </div>
            <p className="text-sm text-green-700 mb-2">{recommendedPlaybook.title}</p>
            <p className="text-xs text-green-600 mb-2">{recommendedPlaybook.description}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => applyPlaybook(recommendedPlaybook.id)}
            >
              このPlaybookを適用
            </Button>
          </div>
        )}

        <form className="space-y-6 mt-6">
          {/* 基本項目 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">基本項目</h3>

            <div>
              <Label>Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: オンボーディング進捗確認MTGのフォローアップメール"
              />
            </div>

            <div>
              <Label>Action Type *</Label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="send_external">外部送信</SelectItem>
                  <SelectItem value="send_internal">内部送信</SelectItem>
                  <SelectItem value="meeting">会議</SelectItem>
                  <SelectItem value="task">タスク</SelectItem>
                  <SelectItem value="escalation">エスカレーション</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Purpose *</Label>
              <Textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="このActionの目的"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority *</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Owner *</Label>
                <Select value={owner} onValueChange={setOwner}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {owners.map((o) => (
                      <SelectItem key={o.id} value={o.name}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Due Date *</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>

              <div>
                <Label>Status *</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proposed">Proposed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* 文脈項目 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">文脈項目</h3>

            <div>
              <Label>Linked Company</Label>
              <Select value={linkedCompany} onValueChange={setLinkedCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Company選択" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Linked Project</Label>
              <Select value={linkedProject} onValueChange={setLinkedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Project選択" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Next Step</Label>
              <Textarea
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                placeholder="推奨される次の一手"
                rows={3}
              />
            </div>

            {/* 関連文脈サマリー */}
            {(linkedCompany || linkedProject || sourceContext?.linkedEvidence) && (
              <div className="bg-slate-50 border rounded p-3">
                <Label className="text-sm font-medium">関連文脈</Label>
                <div className="mt-2 space-y-1 text-sm">
                  {linkedCompany && <p>• Company: {companies.find((c) => c.id === linkedCompany)?.name}</p>}
                  {linkedProject && <p>• Project: {projects.find((p) => p.id === linkedProject)?.name}</p>}
                  {sourceContext?.linkedEvidence && sourceContext.linkedEvidence.length > 0 && (
                    <p>• Evidence: {sourceContext.linkedEvidence.length}件</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 保存ボタン */}
          <div className="flex gap-2 pt-4">
            <Button type="button" onClick={saveDraft} variant="outline">
              下書き保存
            </Button>
            <Button type="button" onClick={saveAndCreateContent} variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              保存してContent作成
            </Button>
            <Button type="button" onClick={saveAndCreateOutbound} className="bg-blue-600 hover:bg-blue-700">
              <Send className="w-4 h-4 mr-2" />
              保存してOutbound起票
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
