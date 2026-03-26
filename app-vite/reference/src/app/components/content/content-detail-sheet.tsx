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
  Eye,
  BookOpen,
  ChevronRight,
} from "lucide-react";

interface ContentDetailSheetProps {
  content: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContentDetailSheet({ content, open, onOpenChange }: ContentDetailSheetProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // モックデータ
  const usedInOutbounds = [
    { id: "out_1", name: "Q1チャーン防止キャンペーン", sentDate: "2026-03-10" },
  ];

  const formatDate = (dateStr: string) => {
    return dateStr;
  };

  const handleDuplicate = () => {
    alert("Content複製機能（未実装）");
  };

  const handleSaveToLibrary = () => {
    alert("Libraryに登録しました（モック）");
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
            <SheetTitle>Content詳細</SheetTitle>
            <SheetDescription>{content.title}</SheetDescription>
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
                        content.status === "approved"
                          ? "outline"
                          : content.status === "in_review"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {content.status}
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-slate-600">Review State</Label>
                  <div className="mt-1">
                    {content.reviewState !== "not_required" && (
                      <Badge variant={content.reviewState === "approved" ? "outline" : "default"}>
                        {content.reviewState}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm text-slate-600">Title</Label>
                <p className="font-medium">{content.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-slate-600">Content Type</Label>
                  <div className="mt-1">
                    <Badge variant="outline">{content.contentType}</Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-slate-600">Owner</Label>
                  <p className="text-sm">{content.owner}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm text-slate-600">Purpose</Label>
                <p className="text-sm">{content.purpose}</p>
              </div>

              {content.template && (
                <div>
                  <Label className="text-sm text-slate-600">Template</Label>
                  <p className="text-sm">{content.template}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* 関連文脈 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">関連文脈</h3>

              {content.company && (
                <div>
                  <Label className="text-sm text-slate-600">Company</Label>
                  <Link
                    to={`/company/${content.companyId}`}
                    className="text-blue-600 hover:underline block"
                  >
                    {content.company}
                  </Link>
                </div>
              )}

              {content.project && (
                <div>
                  <Label className="text-sm text-slate-600">Project</Label>
                  <Link
                    to={`/project/${content.projectId}`}
                    className="text-blue-600 hover:underline block"
                  >
                    {content.project}
                  </Link>
                </div>
              )}

              {content.linkedAction && (
                <div>
                  <Label className="text-sm text-slate-600">Linked Action</Label>
                  <Link
                    to={`/actions/${content.linkedAction}`}
                    className="text-blue-600 hover:underline block"
                  >
                    Action詳細を見る
                  </Link>
                </div>
              )}
            </div>

            <Separator />

            {/* 本文プレビュー */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">本文プレビュー</h3>

              <div className="border rounded p-4 bg-slate-50">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {content.contentType === "email" && "件名: オンボーディング進捗確認とご懸念点のヒアリングについて\n\n"}
                  山田様
                  {"\n\n"}
                  いつも大変お世話になっております。
                  {"\n"}
                  株式会社○○の佐藤です。
                  {"\n\n"}
                  先日のオンボーディングMTGでは、山田様のご都合がつかずお会いできず残念でした。
                  {"\n\n"}
                  プロジェクトの進捗状況と、技術面でのご懸念点について、改めて個別にお話しさせていただきたく、ご連絡いたしました。
                </p>
              </div>

              <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                <Eye className="w-3 h-3 mr-1" />
                全文プレビュー
              </Button>
            </div>

            <Separator />

            {/* 使用履歴 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">使用履歴</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded p-3">
                  <p className="text-sm text-slate-600">使用回数</p>
                  <p className="text-lg font-semibold">{usedInOutbounds.length}回</p>
                </div>

                <div className="border rounded p-3">
                  <p className="text-sm text-slate-600">最終使用日</p>
                  <p className="text-lg font-semibold">
                    {usedInOutbounds.length > 0 ? formatDate(usedInOutbounds[0].sentDate) : "未使用"}
                  </p>
                </div>
              </div>

              <div>
                <Label>使用されたOutbound</Label>
                <div className="border rounded mt-2">
                  {usedInOutbounds.length > 0 ? (
                    <div className="divide-y">
                      {usedInOutbounds.map((outbound) => (
                        <Link
                          key={outbound.id}
                          to={`/outbound/${outbound.id}/result`}
                          className="block p-3 hover:bg-slate-50"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{outbound.name}</p>
                              <p className="text-sm text-slate-600">
                                送信日: {formatDate(outbound.sentDate)}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="p-3 text-sm text-slate-500">まだ使用されていません</p>
                  )}
                </div>
              </div>
            </div>

            {/* アクションボタン */}
            <div className="flex gap-2 pt-4 flex-wrap">
              {content.status === "approved" && (
                <Link to={`/outbound/compose?fromContent=${content.id}`}>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Send className="w-4 h-4 mr-2" />
                    Outboundで使う
                  </Button>
                </Link>
              )}

              <Button variant="outline" onClick={() => setShowPreview(true)}>
                <Eye className="w-4 h-4 mr-2" />
                プレビュー
              </Button>

              <Button variant="outline" onClick={handleDuplicate}>
                <Copy className="w-4 h-4 mr-2" />
                複製
              </Button>

              <Button variant="outline" onClick={handleSaveToLibrary}>
                <BookOpen className="w-4 h-4 mr-2" />
                Libraryに登録
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

      {/* プレビューモーダル */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Content プレビュー</DialogTitle>
            <DialogDescription>{content.title}</DialogDescription>
          </DialogHeader>
          <div className="border rounded p-4 bg-slate-50 max-h-[500px] overflow-y-auto">
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {content.contentType === "email" && "件名: オンボーディング進捗確認とご懸念点のヒアリングについて\n\n"}
              山田様
              {"\n\n"}
              いつも大変お世話になっております。
              {"\n"}
              株式会社○○の佐藤です。
              {"\n\n"}
              先日のオンボーディングMTGでは、山田様のご都合がつかずお会いできず残念でした。
              {"\n\n"}
              プロジェクトの進捗状況と、技術面でのご懸念点について、改めて個別にお話しさせていただきたく、ご連絡いたしました。
              {"\n\n"}
              下記日程でいかがでしょうか。
              {"\n"}
              - 3月15日(金) 14:00-15:00
              {"\n"}
              - 3月18日(月) 10:00-11:00
              {"\n\n"}
              ご都合の良い日時をお知らせいただけますと幸いです。
              {"\n\n"}
              よろしくお願いいたします。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認モーダル */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contentの削除</DialogTitle>
            <DialogDescription>
              本当に「{content.title}」を削除しますか？この操作は取り消せません。
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
