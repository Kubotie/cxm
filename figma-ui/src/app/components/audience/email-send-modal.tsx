import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
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
import { Send, AlertTriangle, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";

interface EmailSendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clusterInfo: {
    name: string;
    projectCount: number;
    audienceScope: string;
  };
  selectedUsersCount: number;
  unresolvedUsersCount: number;
}

export function EmailSendModal({
  open,
  onOpenChange,
  clusterInfo,
  selectedUsersCount,
  unresolvedUsersCount,
}: EmailSendModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[calc(100vh-4rem)] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            Email送信確認（危険操作）
          </DialogTitle>
          <DialogDescription>
            この操作は取り消すことができません。送信内容を十分に確認してから実行してください。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto">
          {/* 危険操作警告 */}
          <Card className="border-red-300 bg-red-50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <div className="font-semibold text-red-900">外部送信の危険性</div>
                  <ul className="text-xs text-red-800 space-y-1 list-disc list-inside">
                    <li>送信後は取り消すことができません</li>
                    <li>誤った内容の送信は顧客との信頼関係を損なう可能性があります</li>
                    <li>必ずContent Jobsで送信内容を事前確認してください</li>
                    <li>Unresolved RecipientsにはEmail が送信されません</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* 送信サマリー */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-slate-200">
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-slate-600 mb-1">送信クラスター</div>
                <div className="font-semibold text-slate-900">{clusterInfo.name}</div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-slate-600 mb-1">Audience Scope</div>
                <Badge variant="outline" className="text-xs">{clusterInfo.audienceScope}</Badge>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-blue-700 mb-1">対象Project数</div>
                <div className="font-semibold text-blue-900">
                  {clusterInfo.projectCount.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="pt-4 pb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-700 mb-1">送信User数</div>
                  <div className="font-semibold text-emerald-900">{selectedUsersCount}</div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </CardContent>
            </Card>
          </div>

          {unresolvedUsersCount > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-red-900">
                    <div className="font-semibold mb-1">
                      {unresolvedUsersCount}名のUnresolved Recipientsは送信対象外です
                    </div>
                    <div>
                      これらのUserにはEmailが送信されません。必要に応じてLinkage解決後に個別送信してください。
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* 確認チェックリスト */}
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="pt-4 pb-3">
              <div className="font-semibold text-purple-900 mb-3 text-sm">送信前の最終確認</div>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2">
                  <Checkbox id="check1" className="mt-0.5" />
                  <label htmlFor="check1" className="text-xs text-purple-900 cursor-pointer">
                    Content Jobsで送信内容を確認し、誤りがないことを確認しました
                  </label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="check2" className="mt-0.5" />
                  <label htmlFor="check2" className="text-xs text-purple-900 cursor-pointer">
                    対象Userが適切であることを確認しました
                  </label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="check3" className="mt-0.5" />
                  <label htmlFor="check3" className="text-xs text-purple-900 cursor-pointer">
                    送信タイミングが適切であることを確認しました
                  </label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="check4" className="mt-0.5" />
                  <label htmlFor="check4" className="text-xs text-purple-900 cursor-pointer">
                    送信後は取り消せないことを理解しました
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 実行後の状態 */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-blue-900 space-y-1.5">
                <div className="font-semibold">実行後の状態</div>
                <div>• 選択した{selectedUsersCount}名のUserに即座にEmailが送信されます</div>
                <div>• 送信状況はContent Jobs画面の「Sent」タブで確認できます</div>
                <div>• 送信履歴はGovernance / Audit画面で記録されます</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              // 実行処理
            }}
            className="bg-red-600 hover:bg-red-700"
          >
            <Send className="w-4 h-4 mr-2" />
            確認してEmail送信を実行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}