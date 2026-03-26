import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { Save, Play, History } from "lucide-react";

interface FeedDisplayRule {
  id: string;
  name: string;
  targetFeed: string;
  sortLogic: string;
  groupingLogic: string;
  status: string;
  enabled: boolean;
}

interface FeedDisplayRuleEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: FeedDisplayRule | null;
  mode: "edit" | "create" | "duplicate";
  onSave?: (rule: FeedDisplayRule) => void;
}

export function FeedDisplayRuleEditDialog({
  open,
  onOpenChange,
  rule,
  mode,
  onSave,
}: FeedDisplayRuleEditDialogProps) {
  const [formData, setFormData] = useState<FeedDisplayRule>(
    rule || {
      id: "",
      name: "",
      targetFeed: "All Alerts",
      sortLogic: "Newest first + Priority boost",
      groupingLogic: "Same company (30min window)",
      status: "Enabled",
      enabled: true,
    }
  );

  const handleSave = () => {
    if (onSave) {
      onSave(formData);
    }
    onOpenChange(false);
  };

  const getDialogTitle = () => {
    if (mode === "create") return "新規表示ルール作成";
    if (mode === "duplicate") return "表示ルールを複製";
    return "表示ルールを編集";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>
            Support Home の Alert Feed の表示方法・並び順・グルーピングを制御します。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 有効/無効 Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div className="flex-1">
              <Label htmlFor="enabled" className="font-semibold">
                このルールを有効にする
              </Label>
              <p className="text-sm text-slate-600 mt-1">
                無効にすると、デフォルトの表示ルールが適用されます。
              </p>
            </div>
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, enabled: checked })
              }
            />
          </div>

          {/* Rule Name */}
          <div className="space-y-2">
            <Label htmlFor="name">ルール名 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="例: Default Feed Display"
            />
          </div>

          {/* Target Feed */}
          <div className="space-y-2">
            <Label htmlFor="targetFeed">Target Feed *</Label>
            <Select
              value={formData.targetFeed}
              onValueChange={(value) =>
                setFormData({ ...formData, targetFeed: value })
              }
            >
              <SelectTrigger id="targetFeed">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Alerts">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">All</Badge>
                    <span className="text-sm">All Alerts（すべてのアラート）</span>
                  </div>
                </SelectItem>
                <SelectItem value="Urgent Alerts">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">Urgent</Badge>
                    <span className="text-sm">Urgent Alerts（緊急タブ）</span>
                  </div>
                </SelectItem>
                <SelectItem value="Risk Alerts">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">Risk</Badge>
                    <span className="text-sm">Risk Alerts（リスクタブ）</span>
                  </div>
                </SelectItem>
                <SelectItem value="Opportunity Alerts">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Opportunity</Badge>
                    <span className="text-sm">Opportunity Alerts（オポチュニティタブ）</span>
                  </div>
                </SelectItem>
                <SelectItem value="Risk & Opportunity">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">複合</Badge>
                    <span className="text-sm">Risk & Opportunity（リスク＆オポチュニティ）</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-600">
              このルールを適用する Alert Feed のタブを選択します。
            </p>
          </div>

          {/* Sort Logic */}
          <div className="space-y-2">
            <Label htmlFor="sortLogic">Sort Logic *</Label>
            <Select
              value={formData.sortLogic}
              onValueChange={(value) =>
                setFormData({ ...formData, sortLogic: value })
              }
            >
              <SelectTrigger id="sortLogic">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Newest first">
                  Newest first（新しい順）
                </SelectItem>
                <SelectItem value="Oldest first">
                  Oldest first（古い順）
                </SelectItem>
                <SelectItem value="Newest first + Priority boost">
                  Newest first + Priority boost（新しい順 + 優先度ブースト）
                </SelectItem>
                <SelectItem value="Oldest first + Untriaged boost">
                  Oldest first + Untriaged boost（古い順 + 未対応ブースト）
                </SelectItem>
                <SelectItem value="Company ARR desc">
                  Company ARR desc（企業ARR降順）
                </SelectItem>
                <SelectItem value="Priority only">
                  Priority only（優先度のみ）
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-600">
              Alert Feed でアラートをどの順番で表示するかを設定します。
            </p>
          </div>

          {/* Grouping Logic */}
          <div className="space-y-2">
            <Label htmlFor="groupingLogic">Grouping Logic *</Label>
            <Select
              value={formData.groupingLogic}
              onValueChange={(value) =>
                setFormData({ ...formData, groupingLogic: value })
              }
            >
              <SelectTrigger id="groupingLogic">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="No grouping">
                  No grouping（グルーピングなし）
                </SelectItem>
                <SelectItem value="Same company (30min window)">
                  Same company (30min window)（同一企業・30分窓）
                </SelectItem>
                <SelectItem value="Same company (60min window)">
                  Same company (60min window)（同一企業・60分窓）
                </SelectItem>
                <SelectItem value="Same company + project (60min)">
                  Same company + project (60min)（同一企業＋プロジェクト・60分窓）
                </SelectItem>
                <SelectItem value="Same alert type (24h window)">
                  Same alert type (24h window)（同一アラートタイプ・24時間窓）
                </SelectItem>
                <SelectItem value="Pattern grouping">
                  Pattern grouping（パターン自動グルーピング）
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-600">
              関連するアラートをどのようにグルーピングするかを設定します。
            </p>
          </div>

          {/* プレビュー例 */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-700 mb-3">表示プレビュー例：</p>
            <div className="space-y-2">
              <div className="bg-white border border-slate-200 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">CSE Ticket waiting over 48h</span>
                  <Badge className="bg-red-600 text-white text-xs">Critical</Badge>
                </div>
                <p className="text-xs text-slate-600">Company: テクノロジーイノベーション株式会社</p>
                <p className="text-xs text-slate-500 mt-1">2024-03-17 10:15</p>
              </div>
              <div className="bg-white border border-slate-200 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">High-value customer inquiry</span>
                  <Badge className="bg-blue-600 text-white text-xs">High</Badge>
                </div>
                <p className="text-xs text-slate-600">Company: テクノロジーイノベーション株式会社</p>
                <p className="text-xs text-slate-500 mt-1">2024-03-17 10:10</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              ※ 上記は {formData.sortLogic} / {formData.groupingLogic} が適用された表示例です
            </p>
          </div>

          {/* 影響範囲の説明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">影響範囲：Support Home - Alert Feed</p>
                <p className="text-blue-800">
                  このルールは、Support Home の Alert Feed で<strong>アラートがどの順番で表示されるか</strong>、
                  <strong>どのようにグルーピングされるか</strong>を決定します。
                  Target Feed で指定したタブ（All/Urgent/Riskなど）に適用されます。
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-2">
              {mode === "edit" && (
                <>
                  <Button variant="outline" size="sm">
                    <Play className="w-4 h-4 mr-2" />
                    表示プレビュー
                  </Button>
                  <Button variant="ghost" size="sm">
                    <History className="w-4 h-4 mr-2" />
                    変更履歴
                  </Button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                キャンセル
              </Button>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                保存
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
