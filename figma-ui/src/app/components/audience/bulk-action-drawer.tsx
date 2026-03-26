import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Separator } from "../ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Edit3, CheckCircle2, Info, Users, Layers, AlertTriangle } from "lucide-react";

interface BulkActionDrawerProps {
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

export function BulkActionDrawer({
  open,
  onOpenChange,
  clusterInfo,
  selectedUsersCount,
  unresolvedUsersCount,
}: BulkActionDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-blue-600" />
            一括Action作成
          </SheetTitle>
          <SheetDescription>
            選択したクラスター「{clusterInfo.name}」の対象に対して、施策の骨組みとなるActionを一括作成します。
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* 対象サマリー */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">作成対象</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Scope</span>
                <Badge variant="outline">{clusterInfo.audienceScope}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">対象Project数</span>
                <span className="font-semibold text-blue-900">
                  {clusterInfo.projectCount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">選択User数</span>
                <span className="font-semibold text-emerald-600">{selectedUsersCount}</span>
              </div>
              {unresolvedUsersCount > 0 && (
                <div className="flex items-center justify-between text-red-600">
                  <span>Unresolved</span>
                  <span className="font-semibold">{unresolvedUsersCount}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Action設定 */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              Action設定
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Action Type
                </label>
                <Select defaultValue="outreach">
                  <SelectTrigger>
                    <SelectValue placeholder="Action Typeを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outreach">Outreach</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="escalation">Escalation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Priority
                </label>
                <Select defaultValue="high">
                  <SelectTrigger>
                    <SelectValue placeholder="優先度を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Due Date
                </label>
                <Select defaultValue="3days">
                  <SelectTrigger>
                    <SelectValue placeholder="期限を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1day">1日以内</SelectItem>
                    <SelectItem value="3days">3日以内</SelectItem>
                    <SelectItem value="1week">1週間以内</SelectItem>
                    <SelectItem value="2weeks">2週間以内</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  担当者割り当て
                </label>
                <Select defaultValue="auto">
                  <SelectTrigger>
                    <SelectValue placeholder="担当者を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自動割り当て（既存担当者）</SelectItem>
                    <SelectItem value="csm_tanaka">CSM田中</SelectItem>
                    <SelectItem value="csm_yamada">CSM山田</SelectItem>
                    <SelectItem value="csm_sato">CSM佐藤</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* 注意事項 */}
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-purple-900 space-y-2">
                  <div className="font-semibold">作成後の流れ</div>
                  <ul className="list-disc list-inside space-y-1">
                    <li>各Project/Userに対してActionが一括作成されます</li>
                    <li>作成されたActionは「Draft」状態で保存されます</li>
                    <li>Action Review画面で内容を確認・調整できます</li>
                    <li>内容確認後、個別にPush/実行できます</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {unresolvedUsersCount > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-amber-900">
                    <div className="font-semibold mb-1">Unresolved Recipientsについて</div>
                    <div>
                      Actionは作成されますが、Unresolved状態のため実行できません。
                      実行前にLinkage解決が必要です。
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              // 実行処理
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Edit3 className="w-4 h-4 mr-2" />
            一括Action作成を実行
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
