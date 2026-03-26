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

interface SuggestionRule {
  id: string;
  name: string;
  suggestionType: string;
  triggerCondition: string;
  targetOutput: string;
  aiPromptTemplate: string;
  priority: string;
  status: string;
  enabled: boolean;
}

interface SuggestionRuleEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: SuggestionRule | null;
  mode: "edit" | "create" | "duplicate";
  onSave?: (rule: SuggestionRule) => void;
}

export function SuggestionRuleEditDialog({
  open,
  onOpenChange,
  rule,
  mode,
  onSave,
}: SuggestionRuleEditDialogProps) {
  const [formData, setFormData] = useState<SuggestionRule>(
    rule || {
      id: "",
      name: "",
      suggestionType: "FAQ Draft",
      triggerCondition: "",
      targetOutput: "Content",
      aiPromptTemplate: "",
      priority: "High",
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
    if (mode === "create") return "新規AI提案ルール作成";
    if (mode === "duplicate") return "AI提案ルールを複製";
    return "AI提案ルールを編集";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>
            Alert Feed のアラートに対して AI が自動生成する提案内容を設定します。
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
                無効にすると、新しいAI提案は生成されなくなります。
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
              placeholder="例: FAQ Auto-Generation"
            />
          </div>

          {/* Suggestion Type */}
          <div className="space-y-2">
            <Label htmlFor="suggestionType">Suggestion Type *</Label>
            <Select
              value={formData.suggestionType}
              onValueChange={(value) =>
                setFormData({ ...formData, suggestionType: value })
              }
            >
              <SelectTrigger id="suggestionType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FAQ Draft">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                      FAQ Draft
                    </Badge>
                    <span className="text-sm text-slate-600">FAQ下書きを生成</span>
                  </div>
                </SelectItem>
                <SelectItem value="Outbound Suggestion">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      Outbound Suggestion
                    </Badge>
                    <span className="text-sm text-slate-600">能動的な外部送信を提案</span>
                  </div>
                </SelectItem>
                <SelectItem value="Help Draft">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Help Draft
                    </Badge>
                    <span className="text-sm text-slate-600">ヘルプ記事下書きを生成</span>
                  </div>
                </SelectItem>
                <SelectItem value="Event Suggestion">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                      Event Suggestion
                    </Badge>
                    <span className="text-sm text-slate-600">イベントフォローアップを提案</span>
                  </div>
                </SelectItem>
                <SelectItem value="Product Feedback">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      Product Feedback
                    </Badge>
                    <span className="text-sm text-slate-600">プロダクトフィードバックを抽出</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-600">
              Alert Detail で生成されるAI提案のタイプを選択します。
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
              placeholder="例: Recurring Q > 5 times"
              rows={3}
            />
            <p className="text-sm text-slate-600">
              このAI提案を生成する条件を記述します。
            </p>
          </div>

          {/* Target Output */}
          <div className="space-y-2">
            <Label htmlFor="targetOutput">Target Output *</Label>
            <Select
              value={formData.targetOutput}
              onValueChange={(value) =>
                setFormData({ ...formData, targetOutput: value })
              }
            >
              <SelectTrigger id="targetOutput">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Content">Content（FAQ/Help記事）</SelectItem>
                <SelectItem value="Outbound">Outbound（メール/Slack送信）</SelectItem>
                <SelectItem value="Event">Event（イベントフォローアップ）</SelectItem>
                <SelectItem value="Actions">Actions（アクション作成）</SelectItem>
                <SelectItem value="Library">Library（ナレッジ蓄積）</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-600">
              AI提案の出力先・作成対象を指定します。
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
              placeholder="例: 以下のサポート問い合わせから、よくある質問（FAQ）を作成してください。&#10;&#10;問い合わせ内容:&#10;{inquiry_summary}&#10;&#10;解決方法:&#10;{resolution_pattern}"
              rows={6}
              className="font-mono text-sm"
            />
            <p className="text-sm text-slate-600">
              AIに渡すプロンプトテンプレート。{"{変数名}"}でデータを埋め込めます。
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
                <SelectItem value="High">
                  <Badge className="bg-orange-500 text-white">High</Badge>
                </SelectItem>
                <SelectItem value="Medium">
                  <Badge className="bg-slate-500 text-white">Medium</Badge>
                </SelectItem>
                <SelectItem value="Low">
                  <Badge className="bg-slate-400 text-white">Low</Badge>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-600">
              Alert Detail でのAI提案の表示優先度です。
            </p>
          </div>

          {/* 影響範囲の説明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">影響範囲：Alert Detail - AI Suggestions</p>
                <p className="text-blue-800">
                  このルールに一致したアラートに対して、Alert Detail 画面で<strong>「AI Suggestions」セクションに提案が自動生成</strong>されます。
                  Suggestion Type が提案の<strong>タイプ</strong>に、Target Output が<strong>出力先</strong>に反映されます。
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
