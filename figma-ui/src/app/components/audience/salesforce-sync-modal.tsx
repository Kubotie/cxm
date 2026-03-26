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
import { Database, AlertTriangle, Info, CheckCircle2 } from "lucide-react";

interface SalesforceSyncModalProps {
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

export function SalesforceSyncModal({
  open,
  onOpenChange,
  clusterInfo,
  selectedUsersCount,
  unresolvedUsersCount,
}: SalesforceSyncModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[calc(100vh-4rem)] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-orange-600" />
            Salesforce同期確認
          </DialogTitle>
          <DialogDescription>
            CXM基盤のデータをSalesforceに同期します。実行前に同期内容を確認してください。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto">
          {/* 同期警告 */}
          <Card className="border-orange-300 bg-orange-50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <div className="font-semibold text-orange-900">Salesforce同期の注意事項</div>
                  <ul className="text-xs text-orange-800 space-y-1 list-disc list-inside">
                    <li>Salesforceの既存データが更新されます</li>
                    <li>同期後の手動巻き戻しはできません</li>
                    <li>Salesforce側の権限により一部データが同期できない場合があります</li>
                    <li>同期完了まで数分かかる場合があります</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* 同期サマリー */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-slate-200">
              <CardContent className="pt-4 pb-3">
                <div className="text-xs text-slate-600 mb-1">同期クラスター</div>
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
                  <div className="text-xs text-emerald-700 mb-1">同期User数</div>
                  <div className="font-semibold text-emerald-900">{selectedUsersCount}</div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </CardContent>
            </Card>
          </div>

          {unresolvedUsersCount > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-amber-900">
                    <div className="font-semibold mb-1">
                      {unresolvedUsersCount}名のUnresolved Recipientsは参考情報として同期されます
                    </div>
                    <div>
                      Linkage未解決のUserもSalesforceには記録されますが、完全なデータ連携はできていません。
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* 同期内容 */}
          <Card className="border-slate-200">
            <CardContent className="pt-4 pb-3">
              <div className="font-semibold text-slate-900 mb-3 text-sm">同期されるデータ</div>
              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span>Project情報（健全性スコア、Phase等）</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span>User情報（Activity、Stage等）</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span>Action/Content実行履歴</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span>Risk/Opportunity Signal</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 確認チェックリスト */}
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="pt-4 pb-3">
              <div className="font-semibold text-purple-900 mb-3 text-sm">同期前の最終確認</div>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2">
                  <Checkbox id="sf-check1" className="mt-0.5" />
                  <label htmlFor="sf-check1" className="text-xs text-purple-900 cursor-pointer">
                    同期対象のProject/Userが適切であることを確認しました
                  </label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="sf-check2" className="mt-0.5" />
                  <label htmlFor="sf-check2" className="text-xs text-purple-900 cursor-pointer">
                    Salesforce側の既存データが上書きされることを理解しました
                  </label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="sf-check3" className="mt-0.5" />
                  <label htmlFor="sf-check3" className="text-xs text-purple-900 cursor-pointer">
                    同期タイミングが適切であることを確認しました
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
                <div>• Salesforceにデータが同期され、営業チームが参照できるようになります</div>
                <div>• 同期状況はGovernance / Audit画面で確認できます</div>
                <div>• 同期エラーが発生した場合は通知されます</div>
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
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Database className="w-4 h-4 mr-2" />
            確認してSalesforce同期を実行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}