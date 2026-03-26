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
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { Save, Play, Copy, History, X } from "lucide-react";

interface AlertRule {
  id: string;
  name: string;
  alertType: string;
  sourceScope: string;
  triggerCondition: string;
  priority: string;
  status: string;
  lastUpdated: string;
  updatedBy: string;
  enabled: boolean;
}

interface AlertRuleEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: AlertRule | null;
  mode: "edit" | "create" | "duplicate";
  onSave?: (rule: AlertRule) => void;
}

export function AlertRuleEditDialog({
  open,
  onOpenChange,
  rule,
  mode,
  onSave,
}: AlertRuleEditDialogProps) {
  const [formData, setFormData] = useState<AlertRule>(
    rule || {
      id: "",
      name: "",
      alertType: "Urgent",
      sourceScope: "",
      triggerCondition: "",
      priority: "Critical",
      status: "Enabled",
      lastUpdated: new Date().toISOString().split("T")[0],
      updatedBy: "Current User",
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
    if (mode === "create") return "新規アラートルール作成";
    if (mode === "duplicate") return "アラートルールを複製";
    return "アラートルールを編集";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>
            Support Home の Alert Feed に表示されるアラートの生成条件を設定します。
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
                無効にすると、新しいアラートは生成されなくなります。
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
              placeholder="例: High Priority CSE Waiting"
            />
          </div>

          {/* Alert Type */}
          <div className="space-y-2">
            <Label htmlFor="alertType">Alert Type *</Label>
            <Select
              value={formData.alertType}
              onValueChange={(value) =>
                setFormData({ ...formData, alertType: value })
              }
            >
              <SelectTrigger id="alertType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Urgent">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      Urgent
                    </Badge>
                    <span className="text-sm text-slate-600">緊急対応が必要</span>
                  </div>
                </SelectItem>
                <SelectItem value="Risk">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                      Risk
                    </Badge>
                    <span className="text-sm text-slate-600">利用低下・解約リスク</span>
                  </div>
                </SelectItem>
                <SelectItem value="Opportunity">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Opportunity
                    </Badge>
                    <span className="text-sm text-slate-600">利用拡大・アップセル</span>
                  </div>
                </SelectItem>
                <SelectItem value="FAQ Candidate">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      FAQ Candidate
                    </Badge>
                    <span className="text-sm text-slate-600">FAQ化推奨</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-600">
              Support Home の Alert Feed で Type列に表示されます。
            </p>
          </div>

          {/* Source Scope */}
          <div className="space-y-2">
            <Label htmlFor="sourceScope">Source Scope *</Label>
            <Input
              id="sourceScope"
              value={formData.sourceScope}
              onChange={(e) =>
                setFormData({ ...formData, sourceScope: e.target.value })
              }
              placeholder="例: CSE Ticket, Intercom, Slack"
            />
            <p className="text-sm text-slate-600">
              このルールが監視する対象チャネルを指定します。
            </p>
          </div>

          {/* Trigger Condition */}
          <div className="space-y-2">
            <Label htmlFor="triggerCondition">Trigger Condition *</Label>
            <Textarea
              id="triggerCondition"
              value={formData.triggerCondition}
              onChange={(e) =>
                setFormData({ ...formData, triggerCondition: e.target.value })
              }
              placeholder="例: Waiting > 48h"
              rows={3}
            />
            <p className="text-sm text-slate-600">
              アラートを生成する条件を記述します。
            </p>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority *</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) =>
                setFormData({ ...formData, priority: value })
              }
            >
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Critical">
                  <Badge className="bg-red-600 text-white">Critical</Badge>
                </SelectItem>
                <SelectItem value="High">
                  <Badge className="bg-orange-500 text-white">High</Badge>
                </SelectItem>
                <SelectItem value="Medium">
                  <Badge className="bg-yellow-500 text-white">Medium</Badge>
                </SelectItem>
                <SelectItem value="Low">
                  <Badge className="bg-slate-400 text-white">Low</Badge>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-600">
              Support Home の Alert Feed で優先度列に表示されます。
            </p>
          </div>

          {/* 影響範囲の説明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">影響範囲：Support Home - Alert Feed</p>
                <p className="text-blue-800">
                  このルールに一致したログやイベントが、Support Home の Alert Feed に<strong>新しい行（アラート）として追加</strong>されます。
                  Alert Type が行の<strong>Type列</strong>に、Priority が<strong>優先度列</strong>に反映されます。
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
                    ルールをテスト
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
