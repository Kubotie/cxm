import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Separator } from "../ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Info, Send, Eye, Sparkles } from "lucide-react";

interface ContentCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceContext?: {
    type: string;
    linkedAction?: string;
    linkedCompany?: string;
    linkedProject?: string;
    suggestedSubject?: string;
    suggestedBody?: string;
  };
}

export function ContentCreateSheet({ open, onOpenChange, sourceContext }: ContentCreateSheetProps) {
  const [searchParams] = useSearchParams();
  const fromAction = searchParams.get("fromAction");

  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState("email");
  const [purpose, setPurpose] = useState("");
  const [owner, setOwner] = useState("佐藤 太郎");
  const [status, setStatus] = useState("draft");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [template, setTemplate] = useState("");
  const [linkedCompany, setLinkedCompany] = useState("");
  const [linkedProject, setLinkedProject] = useState("");

  // モックデータ
  const companies = [
    { id: "1", name: "テックイノベーション株式会社" },
    { id: "2", name: "グローバルソリューションズ株式会社" },
  ];

  const projects = [
    { id: "proj_1", name: "プロジェクトA" },
    { id: "proj_2", name: "全社DX推進" },
  ];

  const owners = [
    { id: "1", name: "佐藤 太郎" },
    { id: "2", name: "田中 花子" },
    { id: "3", name: "鈴木 次郎" },
  ];

  const templates = [
    { id: "tmpl_1", name: "フォローアップメール（決裁者向け）" },
    { id: "tmpl_2", name: "オンボーディング進捗確認" },
    { id: "tmpl_3", name: "サポート回答テンプレート" },
  ];

  const saveDraft = () => {
    alert("下書き保存しました（モック）");
    onOpenChange(false);
  };

  const saveAndCreateOutbound = () => {
    alert("Contentを保存してOutbound作成画面に遷移します（モック）");
    onOpenChange(false);
  };

  const requestReview = () => {
    alert("レビュー依頼を送信しました（モック）");
  };

  const applyTemplate = (templateId: string) => {
    alert(`Template ${templateId} を適用しました（モック）`);
    setSubject("オンボーディング進捗確認とご懸念点のヒアリングについて");
    setBody(
      "{{recipient_name}}様\n\nいつも大変お世話になっております。\n株式会社○○の{{sender_name}}です。\n\n先日のオンボーディングMTGでは、{{recipient_name}}様のご都合がつかずお会いできず残念でした。\n\nプロジェクトの進捗状況と、技術面でのご懸念点について、改めて個別にお話しさせていただきたく、ご連絡いたしました。"
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[800px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>新規Content作成</SheetTitle>
          <SheetDescription>送信コンテンツを作成します</SheetDescription>
        </SheetHeader>

        {/* Source Context表示 */}
        {(sourceContext || fromAction) && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-4">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {sourceContext?.type || "Action"}から作成
              </span>
            </div>
            {sourceContext?.linkedAction && (
              <p className="text-sm text-blue-700 mt-1">
                Action: {sourceContext.linkedAction} の文脈を引き継いでいます
              </p>
            )}
          </div>
        )}

        {/* AI提案 */}
        {sourceContext?.suggestedSubject && (
          <div className="bg-green-50 border border-green-200 rounded p-3 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">AI提案</span>
            </div>
            <p className="text-sm text-green-700 mb-2">
              件名: {sourceContext.suggestedSubject}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSubject(sourceContext.suggestedSubject || "");
                setBody(sourceContext.suggestedBody || "");
              }}
            >
              この提案を適用
            </Button>
          </div>
        )}

        <form className="space-y-6 mt-6">
          {/* 基本項目 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">基本項目</h3>

            <div>
              <Label>Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: オンボーディング進捗確認フォローアップメール"
              />
            </div>

            <div>
              <Label>Content Type *</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="internal_note">社内メモ</SelectItem>
                  <SelectItem value="support_reply">サポート回答</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Purpose *</Label>
              <Textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="このContentの目的"
                rows={2}
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
                    <SelectItem value="in_review">In Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* 本文項目 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">本文</h3>

            <div>
              <Label>Template</Label>
              <div className="flex gap-2">
                <Select value={template} onValueChange={setTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Template選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {template && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate(template)}
                  >
                    適用
                  </Button>
                )}
              </div>
            </div>

            {contentType === "email" && (
              <div>
                <Label>Subject *</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="件名"
                />
              </div>
            )}

            <div>
              <Label>Body *</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="本文を入力してください"
                rows={12}
              />
            </div>
          </div>

          <Separator />

          {/* 文脈項目 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">文脈項目</h3>

            <div>
              <Label>Linked Company</Label>
              <Select value={linkedCompany} onValueChange={setLinkedCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Company選択" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Linked Project</Label>
              <Select value={linkedProject} onValueChange={setLinkedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Project選択" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 保存ボタン */}
          <div className="flex gap-2 pt-4">
            <Button type="button" onClick={saveDraft} variant="outline">
              下書き保存
            </Button>
            <Button type="button" onClick={requestReview} variant="outline">
              レビュー依頼
            </Button>
            <Button
              type="button"
              onClick={saveAndCreateOutbound}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-4 h-4 mr-2" />
              保存してOutboundで使う
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
