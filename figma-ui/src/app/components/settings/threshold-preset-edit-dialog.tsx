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
import { Badge } from "../ui/badge";
import { Save, History, ExternalLink } from "lucide-react";

interface ThresholdPreset {
  id: string;
  name: string;
  metricType: string;
  thresholdValue: string;
  unit: string;
  appliedRules: Array<{ name: string; type: string }>;
}

interface ThresholdPresetEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: ThresholdPreset | null;
  mode: "edit" | "create" | "duplicate";
  onSave?: (preset: ThresholdPreset) => void;
}

export function ThresholdPresetEditDialog({
  open,
  onOpenChange,
  preset,
  mode,
  onSave,
}: ThresholdPresetEditDialogProps) {
  const [formData, setFormData] = useState<ThresholdPreset>(
    preset || {
      id: "",
      name: "",
      metricType: "Waiting Hours",
      thresholdValue: "48",
      unit: "hours",
      appliedRules: [],
    }
  );

  const handleSave = () => {
    if (onSave) {
      onSave(formData);
    }
    onOpenChange(false);
  };

  const getDialogTitle = () => {
    if (mode === "create") return "新規閾値プリセット作成";
    if (mode === "duplicate") return "閾値プリセットを複製";
    return "閾値プリセットを編集";
  };

  const mockAppliedRules = [
    { name: "High Priority CSE Waiting", type: "Alert Rule" },
    { name: "Urgent Queue Priority", type: "Feed Display Rule" },
    { name: "CSE Escalation Check", type: "Alert Rule" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>
            複数のルールで共通利用する閾値を一元管理します。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Preset Name */}
          <div className="space-y-2">
            <Label htmlFor="name">プリセット名 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="例: CSE Waiting Threshold"
            />
          </div>

          {/* Metric Type */}
          <div className="space-y-2">
            <Label htmlFor="metricType">Metric Type *</Label>
            <Select
              value={formData.metricType}
              onValueChange={(value) =>
                setFormData({ ...formData, metricType: value })
              }
            >
              <SelectTrigger id="metricType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Waiting Hours">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">時間</Badge>
                    <span className="text-sm">Waiting Hours（待機時間）</span>
                  </div>
                </SelectItem>
                <SelectItem value="Issue Count">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">回数</Badge>
                    <span className="text-sm">Issue Count（発生回数）</span>
                  </div>
                </SelectItem>
                <SelectItem value="Volume Increase Rate">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">増加率</Badge>
                    <span className="text-sm">Volume Increase Rate（ボリューム増加率）</span>
                  </div>
                </SelectItem>
                <SelectItem value="Inactivity Hours">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">時間</Badge>
                    <span className="text-sm">Inactivity Hours（非アクティブ時間）</span>
                  </div>
                </SelectItem>
                <SelectItem value="ARR Threshold">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">金額</Badge>
                    <span className="text-sm">ARR Threshold（年間経常収益）</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-600">
              この閾値が計測する指標のタイプを選択します。
            </p>
          </div>

          {/* Threshold Value */}
          <div className="space-y-2">
            <Label htmlFor="thresholdValue">Threshold Value *</Label>
            <div className="flex gap-3">
              <Input
                id="thresholdValue"
                value={formData.thresholdValue}
                onChange={(e) =>
                  setFormData({ ...formData, thresholdValue: e.target.value })
                }
                placeholder="例: 48"
                className="flex-1"
                type="number"
              />
              <Select
                value={formData.unit}
                onValueChange={(value) =>
                  setFormData({ ...formData, unit: value })
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formData.metricType === "Waiting Hours" || formData.metricType === "Inactivity Hours" ? (
                    <>
                      <SelectItem value="hours">hours（時間）</SelectItem>
                      <SelectItem value="days">days（日数）</SelectItem>
                    </>
                  ) : formData.metricType === "Issue Count" ? (
                    <>
                      <SelectItem value="times">times（回）</SelectItem>
                      <SelectItem value="times / 7 days">times / 7 days</SelectItem>
                      <SelectItem value="times / 14 days">times / 14 days</SelectItem>
                    </>
                  ) : formData.metricType === "Volume Increase Rate" ? (
                    <>
                      <SelectItem value="% vs previous week">% vs previous week</SelectItem>
                      <SelectItem value="% vs previous month">% vs previous month</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="M yen">M yen（百万円）</SelectItem>
                      <SelectItem value="K USD">K USD（千ドル）</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-slate-600">
              閾値とその単位を設定します。
            </p>
          </div>

          {/* Applied Rules */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>適用中のルール</Label>
              <Button variant="ghost" size="sm" className="h-8">
                <ExternalLink className="w-3 h-3 mr-2" />
                すべて見る
              </Button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              {mockAppliedRules.length > 0 ? (
                <div className="space-y-2">
                  {mockAppliedRules.map((rule, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{rule.name}</p>
                        <p className="text-xs text-slate-500">{rule.type}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">適用中</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600 text-center py-4">
                  まだどのルールにも適用されていません
                </p>
              )}
            </div>
            <p className="text-sm text-slate-600">
              この閾値プリセットを参照しているルールの一覧です。
            </p>
          </div>

          {/* 影響範囲の説明 */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <div className="text-sm text-amber-900">
                <p className="font-semibold mb-1">⚠️ 影響範囲：適用中のすべてのルール</p>
                <p className="text-amber-800">
                  この閾値を変更すると、<strong>適用中のすべてのルールに即座に反映</strong>されます。
                  変更前に「適用中のルール」を確認し、影響範囲を理解してから変更してください。
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-2">
              {mode === "edit" && (
                <Button variant="ghost" size="sm">
                  <History className="w-4 h-4 mr-2" />
                  変更履歴
                </Button>
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
