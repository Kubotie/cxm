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
  Download,
  ChevronRight,
  FileText,
  Mail,
} from "lucide-react";

interface LibraryDetailSheetProps {
  item: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LibraryDetailSheet({ item, open, onOpenChange }: LibraryDetailSheetProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // モックデータ
  const usedInContent = [
    { id: "content-1", title: "オンボーディング進捗確認フォローアップメール", usedDate: "2026-03-10" },
  ];

  const usedInOutbounds = [
    { id: "out_1", name: "Q1チャーン防止キャンペーン", sentDate: "2026-03-10" },
  ];

  const formatDate = (dateStr: string) => {
    return dateStr;
  };

  const handleDuplicate = () => {
    alert("Library項目複製機能（未実装）");
  };

  const handleDownload = () => {
    alert("ダウンロード機能（未実装）");
  };

  const handleUseInContent = () => {
    window.location.href = `/content?fromTemplate=${item.id}`;
  };

  const handleUseInOutbound = () => {
    window.location.href = `/outbound/compose?fromTemplate=${item.id}`;
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
            <SheetTitle>{item.category}詳細</SheetTitle>
            <SheetDescription>{item.title}</SheetDescription>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* 基本情報 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">基本情報</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-slate-600">Category</Label>
                  <div className="mt-1">
                    <Badge variant="outline">{item.category}</Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-slate-600">Status</Label>
                  <div className="mt-1">
                    <Badge variant={item.status === "approved" ? "outline" : "secondary"}>
                      {item.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm text-slate-600">Title</Label>
                <p className="font-medium">{item.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-slate-600">Type</Label>
                  <div className="mt-1">
                    <Badge variant="outline">{item.type}</Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-slate-600">Applicable Scope</Label>
                  <div className="mt-1">
                    <Badge variant="outline">{item.applicableScope}</Badge>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm text-slate-600">Tags</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {item.tags.map((tag: string, idx: number) => (
                    <Badge key={idx} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm text-slate-600">Owner</Label>
                <p className="text-sm">{item.owner}</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.reusableFlag}
                  readOnly
                  className="rounded"
                />
                <Label className="text-sm">再利用可能として保存</Label>
              </div>
            </div>

            <Separator />

            {/* 内容プレビュー */}
            {item.category === "Template" && (
              <>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Template内容</h3>

                  <div className="border rounded p-4 bg-slate-50">
                    <p className="text-sm font-medium mb-2">件名:</p>
                    <p className="text-sm text-slate-700 mb-4">
                      【フォローアップ】先日の会議について
                    </p>

                    <p className="text-sm font-medium mb-2">本文:</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {`{{recipient_name}}様\n\nお世話になっております。{{sender_name}}です。\n\n先日の会議では、ご多忙のためご欠席とのことで残念でした。会議では以下の内容を議論いたしました：\n\n- {{topic_1}}\n- {{topic_2}}\n- {{topic_3}}\n\nつきましては、{{next_action}}についてご相談させていただきたく、お時間をいただけますでしょうか。`}
                    </p>
                  </div>
                </div>

                <Separator />
              </>
            )}

            {item.category === "Playbook" && (
              <>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Playbook手順</h3>

                  <div className="border rounded divide-y">
                    <div className="p-3">
                      <p className="font-medium text-sm">1. 事前準備</p>
                      <p className="text-sm text-slate-600 mt-1">
                        過去3ヶ月の利用状況レポートを作成し、主要指標を確認
                      </p>
                    </div>
                    <div className="p-3">
                      <p className="font-medium text-sm">2. 顧客へのアジェンダ送付</p>
                      <p className="text-sm text-slate-600 mt-1">
                        レビュー会議の1週間前までにアジェンダを送付
                      </p>
                    </div>
                    <div className="p-3">
                      <p className="font-medium text-sm">3. QBR実施</p>
                      <p className="text-sm text-slate-600 mt-1">
                        60分の会議で成果確認と次四半期の目標設定
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />
              </>
            )}

            {/* 使用履歴 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">使用履歴</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded p-3">
                  <p className="text-sm text-slate-600">使用回数</p>
                  <p className="text-lg font-semibold">{item.usageCount}回</p>
                </div>

                <div className="border rounded p-3">
                  <p className="text-sm text-slate-600">最終使用日</p>
                  <p className="text-lg font-semibold">
                    {usedInContent.length > 0 ? formatDate(usedInContent[0].usedDate) : "未使用"}
                  </p>
                </div>
              </div>

              <div>
                <Label>使用されたContent</Label>
                <div className="border rounded mt-2">
                  {usedInContent.length > 0 ? (
                    <div className="divide-y">
                      {usedInContent.map((content) => (
                        <Link
                          key={content.id}
                          to={`/content/${content.id}`}
                          className="block p-3 hover:bg-slate-50"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{content.title}</p>
                              <p className="text-sm text-slate-600">
                                使用日: {formatDate(content.usedDate)}
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
              {item.category === "Template" && (
                <>
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleUseInContent}>
                    <FileText className="w-4 h-4 mr-2" />
                    Contentで使う
                  </Button>
                  <Button variant="outline" onClick={handleUseInOutbound}>
                    <Mail className="w-4 h-4 mr-2" />
                    Outboundで使う
                  </Button>
                </>
              )}

              {item.category === "Asset" && (
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  ダウンロード
                </Button>
              )}

              <Button variant="outline" onClick={handleDuplicate}>
                <Copy className="w-4 h-4 mr-2" />
                複製
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
            <DialogTitle>Library項目の削除</DialogTitle>
            <DialogDescription>
              本当に「{item.title}」を削除しますか？この操作は取り消せません。
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
