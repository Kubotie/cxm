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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  Send,
  Copy,
  Download,
  Trash2,
  ChevronRight,
  Archive,
  Edit3,
} from "lucide-react";

interface AudienceDetailSheetProps {
  audience: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AudienceDetailSheet({ audience, open, onOpenChange }: AudienceDetailSheetProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // モックデータ
  const resolvedRecipients = [
    { id: "1", name: "田中太郎", email: "tanaka@example.com", company: "テックイノベーション", lastActive: "2026-03-10" },
    { id: "2", name: "山田花子", email: "yamada@example.com", company: "デジタルソリューション", lastActive: "2026-03-12" },
    { id: "3", name: "佐藤次郎", email: "sato@example.com", company: "グローバルテック", lastActive: "2026-03-08" },
  ];

  const usedInOutbounds = [
    { id: "out_1", name: "Q1チャーン防止キャンペーン", sentDate: "2026-03-10" },
    { id: "out_2", name: "アップセル提案メール", sentDate: "2026-03-05" },
  ];

  const filters = [
    { field: "health_score", operator: "less_than", value: "50" },
    { field: "l30_active", operator: "less_than", value: "5" },
    { field: "user_stage", operator: "equals", value: "At-Risk" },
  ];

  const formatDate = (dateStr: string) => {
    return dateStr;
  };

  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      health_score: "Health Score",
      l30_active: "L30 Active",
      user_stage: "User Stage",
      risk_score: "Risk Score",
    };
    return labels[field] || field;
  };

  const getOperatorLabel = (operator: string) => {
    const labels: Record<string, string> = {
      less_than: "<",
      greater_than: ">",
      equals: "=",
      not_equals: "≠",
    };
    return labels[operator] || operator;
  };

  const handleDuplicate = () => {
    alert("Audience複製機能（未実装）");
  };

  const handleExport = () => {
    alert("Export機能（未実装）");
  };

  const handleArchive = () => {
    alert("Archive機能（未実装）");
    onOpenChange(false);
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
            <SheetTitle>Audience詳細</SheetTitle>
            <SheetDescription>{audience.name}</SheetDescription>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* 基本情報 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">基本情報</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-slate-600">Audience Name</Label>
                  <p className="font-medium">{audience.name}</p>
                </div>

                <div>
                  <Label className="text-sm text-slate-600">Status</Label>
                  <div className="mt-1">
                    <Badge variant={audience.status === "active" ? "default" : "secondary"}>
                      {audience.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm text-slate-600">Description</Label>
                <p className="text-sm">{audience.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-slate-600">Scope</Label>
                  <div className="mt-1">
                    <Badge variant="outline">{audience.scope}</Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-slate-600">Owner</Label>
                  <p className="text-sm">{audience.owner}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={audience.reusableFlag}
                  readOnly
                  className="rounded"
                />
                <Label className="text-sm">再利用可能なAudienceとして保存</Label>
              </div>
            </div>

            <Separator />

            {/* 現在の条件 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">現在の条件</h3>

              {audience.linkedCompany && (
                <div>
                  <Label className="text-sm text-slate-600">Linked Company</Label>
                  <Link
                    to={`/company/${audience.linkedCompanyId}`}
                    className="text-blue-600 hover:underline block"
                  >
                    {audience.linkedCompany}
                  </Link>
                </div>
              )}

              {audience.linkedProject && (
                <div>
                  <Label className="text-sm text-slate-600">Linked Project</Label>
                  <Link
                    to={`/project/${audience.linkedProjectId}`}
                    className="text-blue-600 hover:underline block"
                  >
                    {audience.linkedProject}
                  </Link>
                </div>
              )}

              <div className="bg-slate-50 border rounded p-3">
                <Label className="text-sm font-medium">条件サマリー</Label>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {filters.map((filter, idx) => (
                    <li key={idx}>
                      • {getFieldLabel(filter.field)} {getOperatorLabel(filter.operator)}{" "}
                      {filter.value}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Separator />

            {/* 対象情報 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">対象情報</h3>

              <div className="text-center py-6 bg-blue-50 rounded">
                <p className="text-sm text-slate-600">現在の対象件数</p>
                <p className="text-4xl font-bold text-blue-600">{audience.targetCount}件</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>対象一覧（上位10件）</Label>
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="w-3 h-3 mr-1" />
                    全件Export
                  </Button>
                </div>

                <div className="border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Last Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resolvedRecipients.slice(0, 10).map((recipient) => (
                        <TableRow key={recipient.id}>
                          <TableCell>{recipient.name}</TableCell>
                          <TableCell className="text-sm">{recipient.email}</TableCell>
                          <TableCell className="text-sm">{recipient.company}</TableCell>
                          <TableCell className="text-sm">{formatDate(recipient.lastActive)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <Separator />

            {/* 使用履歴 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">使用履歴</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded p-3">
                  <p className="text-sm text-slate-600">最終使用日</p>
                  <p className="text-lg font-semibold">
                    {audience.lastUsed ? formatDate(audience.lastUsed) : "未使用"}
                  </p>
                </div>

                <div className="border rounded p-3">
                  <p className="text-sm text-slate-600">使用回数</p>
                  <p className="text-lg font-semibold">{usedInOutbounds.length}回</p>
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
              {audience.status === "active" && (
                <Link to={`/outbound/compose?fromAudience=${audience.id}`}>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Send className="w-4 h-4 mr-2" />
                    Outboundで使う
                  </Button>
                </Link>
              )}

              <Button variant="outline" onClick={handleDuplicate}>
                <Copy className="w-4 h-4 mr-2" />
                複製
              </Button>

              <Button variant="outline" onClick={handleArchive}>
                <Archive className="w-4 h-4 mr-2" />
                アーカイブ
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
            <DialogTitle>Audienceの削除</DialogTitle>
            <DialogDescription>
              本当に「{audience.name}」を削除しますか？この操作は取り消せません。
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
