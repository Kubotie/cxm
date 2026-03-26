import { useState } from "react";
import { Link } from "react-router";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Send,
  Copy,
  Trash2,
  CheckCircle2,
  FileText,
  BookOpen,
  ChevronRight,
  Mail,
  MessageSquare,
} from "lucide-react";

interface ActionDetailSheetProps {
  action: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActionDetailSheet({ action, open, onOpenChange }: ActionDetailSheetProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // モックデータ
  const relatedEvidence = [
    { id: "ev-1", title: "週次MTG議事録 - 山田氏欠席", date: "2026-03-10", excerpt: "決裁者の山田氏が3週連続で会議を欠席。" },
    { id: "ev-2", title: "フォローアップメール未返信", date: "2026-03-08", excerpt: "進捗確認メールを送信したが、3日経過しても返信なし。" },
  ];

  const statusHistory = [
    { date: "2026-03-12 10:30", status: "proposed", user: "AI提案" },
    { date: "2026-03-11 15:20", status: "draft", user: "佐藤 太郎" },
  ];

  const linkedContent = {
    id: "content-1",
    title: "オンボーディング進捗確認フォローアップメール",
    status: "draft",
  };

  const formatDate = (dateStr: string) => {
    return dateStr;
  };

  const handleComplete = () => {
    alert("Actionを完了にしました（モック）");
    onOpenChange(false);
  };

  const handlePause = () => {
    alert("Actionを保留にしました（モック）");
  };

  const handleDuplicate = () => {
    alert("Action複製機能（未実装）");
  };

  const handleCreateContent = () => {
    window.location.href = `/content?fromAction=${action.id}`;
  };

  const handleCreateOutbound = () => {
    window.location.href = `/outbound/compose?fromAction=${action.id}`;
  };

  const handleCreatePlaybook = () => {
    alert("Playbook化機能（未実装）");
  };

  const handleDelete = () => {
    alert("削除しました（モック）");
    setShowDeleteConfirm(false);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[800px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Action詳細</SheetTitle>
            <SheetDescription>{action.title}</SheetDescription>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* 基本情報 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">基本情報</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-slate-600">Status</Label>
                  <div className="mt-1">
                    <Badge
                      variant={
                        action.status === "in_progress"
                          ? "default"
                          : action.status === "completed"
                          ? "outline"
                          : "secondary"
                      }
                    >
                      {action.status}
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-slate-600">Priority</Label>
                  <div className="mt-1">
                    <Badge
                      variant={
                        action.priority === "high"
                          ? "destructive"
                          : action.priority === "medium"
                          ? "default"
                          : "outline"
                      }
                    >
                      {action.priority}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm text-slate-600">Action Title</Label>
                <p className="font-medium">{action.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-slate-600">Action Type</Label>
                  <div className="mt-1">
                    <Badge variant="outline">{action.actionType}</Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-slate-600">Owner</Label>
                  <p className="text-sm">{action.owner}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-slate-600">Due Date</Label>
                  <p className={`text-sm ${action.isOverdue ? "text-red-600 font-semibold" : ""}`}>
                    {formatDate(action.dueDate)}
                    {action.isOverdue && " (期限切れ)"}
                  </p>
                </div>

                <div>
                  <Label className="text-sm text-slate-600">Evidence</Label>
                  <p className="text-sm">{action.evidenceCount}件</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* 関連文脈 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">関連文脈</h3>

              {action.company && (
                <div>
                  <Label className="text-sm text-slate-600">Company</Label>
                  <Link
                    to={`/company/${action.companyId}`}
                    className="text-blue-600 hover:underline block"
                  >
                    {action.company}
                  </Link>
                </div>
              )}

              {action.project && (
                <div>
                  <Label className="text-sm text-slate-600">Project</Label>
                  <Link
                    to={`/project/${action.projectId}`}
                    className="text-blue-600 hover:underline block"
                  >
                    {action.project}
                  </Link>
                </div>
              )}

              <div>
                <Label className="text-sm mb-2 block">関連Evidence</Label>
                <div className="border rounded divide-y">
                  {relatedEvidence.map((ev) => (
                    <div key={ev.id} className="p-3">
                      <p className="font-medium text-sm">{ev.title}</p>
                      <p className="text-xs text-slate-500">{ev.date}</p>
                      <p className="text-sm text-slate-700 mt-1">{ev.excerpt}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            {/* リンク済みContent */}
            {linkedContent && (
              <>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">リンク済みContent</h3>

                  <div className="border rounded p-3 hover:bg-slate-50">
                    <Link to={`/content/${linkedContent.id}`} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{linkedContent.title}</p>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {linkedContent.status}
                        </Badge>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </Link>
                  </div>
                </div>

                <Separator />
              </>
            )}

            {/* Status履歴 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Status履歴</h3>

              <div className="border rounded">
                <div className="divide-y">
                  {statusHistory.map((history, idx) => (
                    <div key={idx} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Badge variant="outline" className="text-xs">
                            {history.status}
                          </Badge>
                          <p className="text-xs text-slate-500 mt-1">{history.user}</p>
                        </div>
                        <p className="text-xs text-slate-600">{history.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* アクションボタン */}
            <div className="flex gap-2 pt-4 flex-wrap">
              {action.status !== "completed" && (
                <>
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleCreateOutbound}>
                    <Send className="w-4 h-4 mr-2" />
                    Outbound起票
                  </Button>

                  <Button variant="outline" onClick={handleCreateContent}>
                    <FileText className="w-4 h-4 mr-2" />
                    Content作成
                  </Button>

                  <Button variant="outline" onClick={handleComplete}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    完了にする
                  </Button>
                </>
              )}

              <Button variant="outline" onClick={handleDuplicate}>
                <Copy className="w-4 h-4 mr-2" />
                Follow-up作成
              </Button>

              <Button variant="outline" onClick={handleCreatePlaybook}>
                <BookOpen className="w-4 h-4 mr-2" />
                Playbook化
              </Button>

              <Button
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                削除
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 削除確認モーダル */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actionの削除</DialogTitle>
            <DialogDescription>
              本当に「{action.title}」を削除しますか？この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              キャンセル
            </Button>
            <Button
              variant="default"
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
            >
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
