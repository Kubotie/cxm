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
import { Save, Play, History } from "lucide-react";

interface SummaryRule {
  id: string;
  name: string;
  summaryType: string;
  targetScope: string;
  styleSettings: string;
  aiPromptTemplate: string;
  status: string;
  enabled: boolean;
}

interface SummaryRuleEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: SummaryRule | null;
  mode: "edit" | "create" | "duplicate";
  onSave?: (rule: SummaryRule) => void;
}

export function SummaryRuleEditDialog({
  open,
  onOpenChange,
  rule,
  mode,
  onSave,
}: SummaryRuleEditDialogProps) {
  const [formData, setFormData] = useState<SummaryRule>(
    rule || {
      id: "",
      name: "",
      summaryType: "AI Summary",
      targetScope: "All",
      styleSettings: "Medium / Business Impact / Japanese",
      aiPromptTemplate: "",
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
    if (mode === "create") return "新規サマリールール作成";
    if (mode === "duplicate") return "サマリールールを複製";
    return "サマリールールを編集";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>
            Alert Detail / Support Detail で表示される AI Summary のスタイルと内容を定義します。
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
                無効にすると、このスタイルのサマリーは生成されなくなります。
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
              placeholder="例: Default AI Summary"
            />
          </div>

          {/* Summary Type */}
          <div className="space-y-2">
            <Label htmlFor="summaryType">Summary Type *</Label>
            <Select
              value={formData.summaryType}
              onValueChange={(value) =>
                setFormData({ ...formData, summaryType: value })
              }
            >
              <SelectTrigger id="summaryType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AI Summary">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                      AI Summary
                    </Badge>
                    <span className="text-sm text-slate-600">全体サマリー</span>
                  </div>
                </SelectItem>
                <SelectItem value="Why This Matters">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      Why This Matters
                    </Badge>
                    <span className="text-sm text-slate-600">重要性の説明</span>
                  </div>
                </SelectItem>
                <SelectItem value="Suggested Next Step">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      Suggested Next Step
                    </Badge>
                    <span className="text-sm text-slate-600">次のアクション提案</span>
                  </div>
                </SelectItem>
                <SelectItem value="Similar Case Summary">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      Similar Case Summary
                    </Badge>
                    <span className="text-sm text-slate-600">類似ケース分析</span>
                  </div>
                </SelectItem>
                <SelectItem value="CSE Waiting Summary">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                      CSE Waiting Summary
                    </Badge>
                    <span className="text-sm text-slate-600">CSE待機状況</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-600">
              Alert Detail / Support Detail で表示されるサマリーのタイプを選択します。
            </p>
          </div>

          {/* Target Scope */}
          <div className="space-y-2">
            <Label htmlFor="targetScope">Target Scope *</Label>
            <Select
              value={formData.targetScope}
              onValueChange={(value) =>
                setFormData({ ...formData, targetScope: value })
              }
            >
              <SelectTrigger id="targetScope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All（すべてのアラート）</SelectItem>
                <SelectItem value="Urgent Alerts">Urgent Alerts（緊急アラートのみ）</SelectItem>
                <SelectItem value="Risk Alerts">Risk Alerts（リスクアラートのみ）</SelectItem>
                <SelectItem value="Opportunity Alerts">Opportunity Alerts（オポチュニティのみ）</SelectItem>
                <SelectItem value="Recurring Issues">Recurring Issues（繰り返し発生のみ）</SelectItem>
                <SelectItem value="CSE Tickets">CSE Tickets（CSEチケットのみ）</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-600">
              このサマリールールを適用する対象範囲を指定します。
            </p>
          </div>

          {/* Style Settings */}
          <div className="space-y-2">
            <Label>Style Settings *</Label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="length" className="text-xs text-slate-600">Length</Label>
                <Select defaultValue="Medium">
                  <SelectTrigger id="length" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Short">Short（1-2文）</SelectItem>
                    <SelectItem value="Medium">Medium（3-5文）</SelectItem>
                    <SelectItem value="Long">Long（段落形式）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="emphasis" className="text-xs text-slate-600">Emphasis</Label>
                <Select defaultValue="Business Impact">
                  <SelectTrigger id="emphasis" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Business Impact">Business Impact</SelectItem>
                    <SelectItem value="CX Emphasis">CX Emphasis</SelectItem>
                    <SelectItem value="CSE dependency">CSE dependency</SelectItem>
                    <SelectItem value="Action-focused">Action-focused</SelectItem>
                    <SelectItem value="Context-aware">Context-aware</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="language" className="text-xs text-slate-600">Language</Label>
                <Select defaultValue="Japanese">
                  <SelectTrigger id="language" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Japanese">日本語</SelectItem>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Auto">Auto（自動判定）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-sm text-slate-600 mt-2">
              サマリーの長さ、強調ポイント、言語を設定します。
            </p>
          </div>

          {/* AI Prompt Template */}
          <div className="space-y-2">
            <Label htmlFor="aiPromptTemplate">AI Prompt Template</Label>
            <Textarea
              id="aiPromptTemplate"
              value={formData.aiPromptTemplate}
              onChange={(e) =>
                setFormData({ ...formData, aiPromptTemplate: e.target.value })
              }
              placeholder="例: 以下のアラート情報をビジネスインパクトを重視して要約してください。&#10;&#10;アラートタイプ: {alert_type}&#10;顧客: {company_name}&#10;詳細: {alert_details}&#10;&#10;3-5文で、経営層が理解しやすい形で要約してください。"
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-sm text-slate-600">
              AIに渡すプロンプトテンプレート。{"{変数名}"}でデータを埋め込めます。
            </p>
          </div>

          {/* 影響範囲の説明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">影響範囲：Alert Detail / Support Detail - AI Summary</p>
                <p className="text-blue-800">
                  このルールに一致したアラートやサポートケースに対して、<strong>AI Summary セクションに指定スタイルのサマリーが自動生成</strong>されます。
                  Summary Type により、表示される<strong>サマリーのタイプと見出し</strong>が決定されます。
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
                    出力例を生成
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
