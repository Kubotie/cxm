import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Separator } from "../ui/separator";
import { Checkbox } from "../ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Badge } from "../ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { X, Plus, Upload } from "lucide-react";

interface LibraryCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: string | null;
}

export function LibraryCreateSheet({ open, onOpenChange, category }: LibraryCreateSheetProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("佐藤 太郎");
  const [status, setStatus] = useState("draft");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [applicableScope, setApplicableScope] = useState("Company");
  const [reusableFlag, setReusableFlag] = useState(true);

  // Template固有
  const [templateType, setTemplateType] = useState("external");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Playbook固有
  const [triggerCondition, setTriggerCondition] = useState("");
  const [steps, setSteps] = useState<string[]>(["", "", ""]);

  // Knowledge固有
  const [summary, setSummary] = useState("");
  const [recommendation, setRecommendation] = useState("");

  // モックデータ
  const owners = [
    { id: "1", name: "佐藤 太郎" },
    { id: "2", name: "田中 花子" },
    { id: "3", name: "鈴木 次郎" },
  ];

  const addTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const updateStep = (idx: number, value: string) => {
    const newSteps = [...steps];
    newSteps[idx] = value;
    setSteps(newSteps);
  };

  const addStep = () => {
    setSteps([...steps, ""]);
  };

  const removeStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const saveDraft = () => {
    alert("下書き保存しました（モック）");
    onOpenChange(false);
  };

  const saveAndApprove = () => {
    alert("承認済みとして保存しました（モック）");
    onOpenChange(false);
  };

  const getCategoryLabel = () => {
    switch (category) {
      case "Template":
        return "Template";
      case "Playbook":
        return "Playbook";
      case "Knowledge":
        return "Knowledge";
      case "Asset":
        return "Asset";
      default:
        return "Library項目";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[800px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>新規{getCategoryLabel()}作成</SheetTitle>
          <SheetDescription>
            {category === "Template" && "再利用可能なTemplateを作成します"}
            {category === "Playbook" && "標準的な手順・プロセスを定義します"}
            {category === "Knowledge" && "ナレッジを登録します"}
            {category === "Asset" && "ファイル・資料を登録します"}
          </SheetDescription>
        </SheetHeader>

        <form className="space-y-6 mt-6">
          {/* 共通項目 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">基本項目</h3>

            <div>
              <Label>Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${getCategoryLabel()}の名前`}
              />
            </div>

            <div>
              <Label>Description *</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="説明"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Owner *</Label>
                <Select value={owner} onValueChange={setOwner}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {owners.map((o) => (
                      <SelectItem key={o.id} value={o.name}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="review_required">Review Required</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Tags</Label>
              <div className="flex gap-2 mb-2 flex-wrap">
                {tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary">
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1"
                      type="button"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="タグを追加"
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                />
                <Button variant="outline" size="sm" onClick={addTag} type="button">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label>Applicable Scope</Label>
              <Select value={applicableScope} onValueChange={setApplicableScope}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Company">Company</SelectItem>
                  <SelectItem value="Project">Project</SelectItem>
                  <SelectItem value="User">User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="reusable"
                checked={reusableFlag}
                onCheckedChange={(checked) => setReusableFlag(!!checked)}
              />
              <Label htmlFor="reusable" className="font-normal cursor-pointer">
                再利用可能として保存する
              </Label>
            </div>
          </div>

          <Separator />

          {/* Template固有項目 */}
          {category === "Template" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Template内容</h3>

              <div>
                <Label>Type</Label>
                <Select value={templateType} onValueChange={setTemplateType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="external">External（顧客向け）</SelectItem>
                    <SelectItem value="internal">Internal（社内向け）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="件名（変数使用可: {{variable_name}}）"
                />
              </div>

              <div>
                <Label>Body *</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="本文（変数使用可: {{variable_name}}）"
                  rows={12}
                />
              </div>
            </div>
          )}

          {/* Playbook固有項目 */}
          {category === "Playbook" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Playbook内容</h3>

              <div>
                <Label>Trigger Condition</Label>
                <Textarea
                  value={triggerCondition}
                  onChange={(e) => setTriggerCondition(e.target.value)}
                  placeholder="このPlaybookを適用すべき条件"
                  rows={3}
                />
              </div>

              <div>
                <Label>Recommended Steps</Label>
                <div className="space-y-3">
                  {steps.map((step, idx) => (
                    <div key={idx} className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          value={step}
                          onChange={(e) => updateStep(idx, e.target.value)}
                          placeholder={`ステップ ${idx + 1}`}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStep(idx)}
                        type="button"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={addStep} type="button" className="mt-2">
                  <Plus className="w-4 h-4 mr-2" />
                  ステップを追加
                </Button>
              </div>
            </div>
          )}

          {/* Knowledge固有項目 */}
          {category === "Knowledge" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Knowledge内容</h3>

              <div>
                <Label>Summary *</Label>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="要約"
                  rows={4}
                />
              </div>

              <div>
                <Label>Body *</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="詳細内容"
                  rows={8}
                />
              </div>

              <div>
                <Label>Recommendation</Label>
                <Textarea
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  placeholder="推奨事項"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Asset固有項目 */}
          {category === "Asset" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Asset内容</h3>

              <div>
                <Label>File Upload</Label>
                <div className="border-2 border-dashed rounded p-6 text-center">
                  <Upload className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p className="text-sm text-slate-600">
                    ファイルをドラッグ＆ドロップまたはクリックしてアップロード
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" type="button">
                    ファイルを選択
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 保存ボタン */}
          <div className="flex gap-2 pt-4">
            <Button type="button" onClick={saveDraft} variant="outline">
              下書き保存
            </Button>
            <Button
              type="button"
              onClick={saveAndApprove}
              className="bg-blue-600 hover:bg-blue-700"
            >
              承認済みで保存
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
