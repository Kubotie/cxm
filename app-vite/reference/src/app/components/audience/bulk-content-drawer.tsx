import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Separator } from "../ui/separator";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { FileText, Mail, MessageSquare, Info, AlertTriangle, Sparkles } from "lucide-react";

interface BulkContentDrawerProps {
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

export function BulkContentDrawer({
  open,
  onOpenChange,
  clusterInfo,
  selectedUsersCount,
  unresolvedUsersCount,
}: BulkContentDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            一括Content Job作成
          </SheetTitle>
          <SheetDescription>
            選択したクラスター「{clusterInfo.name}」の対象に対して、文面・コンテンツを一括作成します。
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* 対象サマリー */}
          <Card className="border-emerald-200 bg-emerald-50">
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
                <span className="font-semibold text-emerald-900">
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

          {/* Content設定 */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              Content設定
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Content Channel
                </label>
                <Select defaultValue="email">
                  <SelectTrigger>
                    <SelectValue placeholder="チャネルを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </div>
                    </SelectItem>
                    <SelectItem value="slack">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Slack / Chatwork
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  テンプレート選択
                </label>
                <Select defaultValue="template1">
                  <SelectTrigger>
                    <SelectValue placeholder="テンプレートを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blank">テンプレートなし（新規作成）</SelectItem>
                    <SelectItem value="template1">ヘルスチェック依頼Email</SelectItem>
                    <SelectItem value="template2">活用Tips配信</SelectItem>
                    <SelectItem value="template3">再トレーニング案内</SelectItem>
                    <SelectItem value="template4">契約更新リマインダー</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  AI生成オプション
                </label>
                <Select defaultValue="auto">
                  <SelectTrigger>
                    <SelectValue placeholder="AI生成方法を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">AI自動生成（個別最適化）</SelectItem>
                    <SelectItem value="template">テンプレートベース（軽微調整）</SelectItem>
                    <SelectItem value="manual">手動作成（AI補助なし）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  送信タイミング
                </label>
                <Select defaultValue="manual">
                  <SelectTrigger>
                    <SelectValue placeholder="送信タイミングを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">手動送信（作成のみ）</SelectItem>
                    <SelectItem value="schedule">スケジュール送信</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  共通指示・補足事項（オプション）
                </label>
                <Textarea 
                  placeholder="例: 契約更新日が近いユーザーには更新案内も含める、など"
                  className="h-20 text-sm"
                />
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
                    <li>Content Jobが一括作成され「Draft」状態で保存されます</li>
                    <li>Content Jobs画面で各Content文面を確認・編集できます</li>
                    <li>レビュー後、個別またはまとめて送信実行できます</li>
                    <li>送信前に必ず内容を確認してください</li>
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
                      Content Jobは作成されますが、Unresolved状態のため送信できません。
                      送信前にLinkage解決が必要です。
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
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <FileText className="w-4 h-4 mr-2" />
            一括Content作成を実行
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
