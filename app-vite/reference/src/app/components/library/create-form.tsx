import { useState } from "react";
import { Checkbox } from "../ui/checkbox";
import { FileManager } from "./file-manager";
import { RichTextEditor } from "../outbound/rich-text-editor";
import { DocumentEditor } from "./document-editor";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Separator } from "../ui/separator";
import { Plus, Trash2, X, Upload, FileText, Image, File } from "lucide-react";

type Variable = {
  name: string;
  label: string;
  required: boolean;
  defaultValue: string;
  description: string;
  sampleValue: string;
};

interface CreateFormProps {
  type: "template" | "playbook" | "knowledge" | "asset";
  onClose: () => void;
}

export function CreateForm({ type, onClose }: CreateFormProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedExistingFiles, setSelectedExistingFiles] = useState<string[]>([]);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [bodyText, setBodyText] = useState("");
  const [channel, setChannel] = useState<"email" | "slack" | "chatwork" | "intercom">("email");
  const [playbookText, setPlaybookText] = useState("");
  const [knowledgeText, setKnowledgeText] = useState("");

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setUploadedFiles([...uploadedFiles, ...Array.from(files)]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const addVariable = () => {
    setVariables([
      ...variables,
      {
        name: "",
        label: "",
        required: false,
        defaultValue: "",
        description: "",
        sampleValue: "",
      },
    ]);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const updateVariable = (index: number, field: keyof Variable, value: string | boolean) => {
    const updatedVariables = [...variables];
    updatedVariables[index] = { ...updatedVariables[index], [field]: value };
    setVariables(updatedVariables);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) {
      return <Image className="w-4 h-4 text-blue-500" />;
    } else if (file.type === "application/pdf") {
      return <FileText className="w-4 h-4 text-red-500" />;
    } else {
      return <File className="w-4 h-4 text-slate-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-xs ${
              type === "template"
                ? "bg-blue-100 text-blue-800"
                : type === "playbook"
                ? "bg-purple-100 text-purple-800"
                : type === "knowledge"
                ? "bg-amber-100 text-amber-800"
                : "bg-green-100 text-green-800"
            }`}
          >
            {type === "template" && "Template"}
            {type === "playbook" && "Playbook"}
            {type === "knowledge" && "Knowledge"}
            {type === "asset" && "Asset"}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Common Fields */}
      <div>
        <Label className="text-xs font-semibold text-slate-700">タイトル</Label>
        <Input placeholder="例: フォローアップメール（決裁者向け）" className="mt-1 text-sm" />
      </div>

      <div>
        <Label className="text-xs font-semibold text-slate-700">カテゴリー</Label>
        <Select defaultValue="">
          <SelectTrigger className="mt-1 text-sm">
            <SelectValue placeholder="カテゴリーを選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="slack">Slack</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="playbook">Playbook</SelectItem>
            <SelectItem value="knowledge">Knowledge</SelectItem>
            <SelectItem value="asset">Asset</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs font-semibold text-slate-700">説明</Label>
        <Textarea
          placeholder="このテンプレートの用途や目的を記載してください"
          className="mt-1 text-sm"
          rows={3}
        />
      </div>

      {/* Applicable Scope */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="text-xs font-semibold text-slate-700">適用スコープ</Label>
          <Select defaultValue="company">
            <SelectTrigger className="mt-1 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="company">Company</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-slate-700">Owner</Label>
          <Select defaultValue="tanaka">
            <SelectTrigger className="mt-1 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tanaka">田中 花子</SelectItem>
              <SelectItem value="sato">佐藤 太郎</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-slate-700">ステータス</Label>
          <Select defaultValue="draft">
            <SelectTrigger className="mt-1 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending_review">Review待ち</SelectItem>
              <SelectItem value="approved">承認済み</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Template Specific Fields */}
      {type === "template" && (
        <>
          <div>
            <Label className="text-xs font-semibold text-slate-700">件名（Subject）</Label>
            <Input placeholder="例: 【フォローアップ】先日の会議について" className="mt-1 text-sm" />
          </div>

          <RichTextEditor
            value={bodyText}
            onChange={setBodyText}
            channel={channel}
            placeholder="{{variable_name}}形式で変数を使用できます"
            rows={10}
          />

          <div>
            <Label className="text-xs font-semibold text-slate-700">配信チャネル</Label>
            <Select value={channel} onValueChange={(value) => setChannel(value as typeof channel)}>
              <SelectTrigger className="mt-1 text-sm">
                <SelectValue placeholder="チャネルを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="slack">Slack</SelectItem>
                <SelectItem value="chatwork">Chatwork</SelectItem>
                <SelectItem value="intercom">Intercom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Variables Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold text-slate-700">変数設定</Label>
              <Button size="sm" variant="outline" onClick={addVariable} className="text-xs h-7">
                <Plus className="w-3 h-3 mr-1" />
                変数を追加
              </Button>
            </div>
            {variables.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center border-2 border-dashed rounded-lg">
                変数を追加して、テンプレート内で動的な値を使用できます
              </div>
            ) : (
              <div className="space-y-3">
                {variables.map((variable, index) => (
                  <div key={index} className="p-3 border rounded-lg bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">変数 #{index + 1}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeVariable(index)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-slate-600">変数名</Label>
                        <Input
                          placeholder="company_name"
                          value={variable.name}
                          onChange={(e) => updateVariable(index, "name", e.target.value)}
                          className="mt-1 text-xs h-7"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">ラベル</Label>
                        <Input
                          placeholder="会社名"
                          value={variable.label}
                          onChange={(e) => updateVariable(index, "label", e.target.value)}
                          className="mt-1 text-xs h-7"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-slate-600">デフォルト値</Label>
                        <Input
                          placeholder="株式会社サンプル"
                          value={variable.defaultValue}
                          onChange={(e) => updateVariable(index, "defaultValue", e.target.value)}
                          className="mt-1 text-xs h-7"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">サンプル値</Label>
                        <Input
                          placeholder="株式会社テスト"
                          value={variable.sampleValue}
                          onChange={(e) => updateVariable(index, "sampleValue", e.target.value)}
                          className="mt-1 text-xs h-7"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">説明</Label>
                      <Input
                        placeholder="顧客の会社名を入力してください"
                        value={variable.description}
                        onChange={(e) => updateVariable(index, "description", e.target.value)}
                        className="mt-1 text-xs h-7"
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-1">
                      <Checkbox
                        id={`required-${index}`}
                        checked={variable.required}
                        onCheckedChange={(checked) =>
                          updateVariable(index, "required", checked === true)
                        }
                      />
                      <label
                        htmlFor={`required-${index}`}
                        className="text-xs text-slate-600 cursor-pointer"
                      >
                        必須項目
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">承認メモ</Label>
            <Textarea
              placeholder="承認者向けのメモや注意事項"
              className="mt-1 text-sm"
              rows={2}
            />
          </div>

          <Separator />

          {/* File Attachments for Template */}
          <FileManager
            selectedFiles={selectedExistingFiles}
            onFilesChange={setSelectedExistingFiles}
            newFiles={uploadedFiles}
            onNewFilesChange={setUploadedFiles}
          />
        </>
      )}

      {/* Playbook Specific Fields */}
      {type === "playbook" && (
        <>
          <div>
            <Label className="text-xs font-semibold text-slate-700">トリガー条件</Label>
            <Textarea
              placeholder="このPlaybookを実行する条件を記載してください"
              className="mt-1 text-sm"
              rows={3}
            />
          </div>

          <DocumentEditor
            value={playbookText}
            onChange={setPlaybookText}
            label="推奨手順"
            placeholder="ステップバイステップの手順を記載してください"
            rows={12}
          />

          <div>
            <Label className="text-xs font-semibold text-slate-700">非適用ケース</Label>
            <Textarea
              placeholder="このPlaybookを適用すべきでないケースを記載してください"
              className="mt-1 text-sm"
              rows={3}
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">エスカレーションルール</Label>
            <Textarea
              placeholder="エスカレーションが必要な条件とルートを記載してください"
              className="mt-1 text-sm"
              rows={3}
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">必要なEvidence</Label>
            <Textarea
              placeholder="実行に必要なEvidenceや情報を記載してください"
              className="mt-1 text-sm"
              rows={2}
            />
          </div>

          <Separator />

          {/* File Attachments for Playbook */}
          <FileManager
            selectedFiles={selectedExistingFiles}
            onFilesChange={setSelectedExistingFiles}
            newFiles={uploadedFiles}
            onNewFilesChange={setUploadedFiles}
          />
        </>
      )}

      {/* Knowledge Specific Fields */}
      {type === "knowledge" && (
        <>
          <div>
            <Label className="text-xs font-semibold text-slate-700">サマリー</Label>
            <Textarea
              placeholder="知見の概要を簡潔に記載してください"
              className="mt-1 text-sm"
              rows={2}
            />
          </div>

          <DocumentEditor
            value={knowledgeText}
            onChange={setKnowledgeText}
            label="詳細内容"
            placeholder="知見の詳細を記載してください"
            rows={12}
          />

          <div>
            <Label className="text-xs font-semibold text-slate-700">関連課題</Label>
            <Textarea
              placeholder="この知見が関連する課題やシーンを記載してください"
              className="mt-1 text-sm"
              rows={3}
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">推奨事項</Label>
            <Textarea
              placeholder="この知見に基づく推奨事項やアクションを記載してください"
              className="mt-1 text-sm"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="reusable-insight" />
            <label htmlFor="reusable-insight" className="text-xs text-slate-600 cursor-pointer">
              再利用可能な知見としてマーク
            </label>
          </div>

          <Separator />

          {/* File Attachments for Knowledge */}
          <FileManager
            selectedFiles={selectedExistingFiles}
            onFilesChange={setSelectedExistingFiles}
            newFiles={uploadedFiles}
            onNewFilesChange={setUploadedFiles}
          />
        </>
      )}

      {/* Asset Specific Fields */}
      {type === "asset" && (
        <>
          <div>
            <Label className="text-xs font-semibold text-slate-700 mb-2 block">
              ファイルアップロード
            </Label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                id="file-upload"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600 mb-1">
                  クリックしてファイルを選択、またはドラッグ&ドロップ
                </p>
                <p className="text-xs text-slate-500">PDF, PPTX, DOCX, 画像ファイルなど</p>
              </label>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                <Label className="text-xs font-semibold text-slate-700">
                  アップロードファイル（{uploadedFiles.length}件）
                </Label>
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 border rounded-lg bg-slate-50"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getFileIcon(file)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-900 truncate">{file.name}</p>
                        <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveFile(index)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">ファイル種類</Label>
            <Select defaultValue="">
              <SelectTrigger className="mt-1 text-sm">
                <SelectValue placeholder="ファイルの種類を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="presentation">プレゼンテーション</SelectItem>
                <SelectItem value="document">ドキュメント</SelectItem>
                <SelectItem value="spreadsheet">スプレッドシート</SelectItem>
                <SelectItem value="image">画像</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="other">その他</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Asset用途</Label>
            <Textarea
              placeholder="このAssetの用途や使用シーンを記載してください"
              className="mt-1 text-sm"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="attachment-usable" />
            <label htmlFor="attachment-usable" className="text-xs text-slate-600 cursor-pointer">
              送信時の添付ファイルとして使用可能
            </label>
          </div>
        </>
      )}

      <Separator />

      {/* Linked Context */}
      <div>
        <Label className="text-xs font-semibold text-slate-700 mb-2 block">連携コンテキスト</Label>
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-slate-600">Linked Company</Label>
            <Select defaultValue="">
              <SelectTrigger className="mt-1 text-sm">
                <SelectValue placeholder="Companyを選択（任意）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="acme">株式会社ACME</SelectItem>
                <SelectItem value="techcorp">TechCorp Inc.</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-600">Linked Project</Label>
            <Select defaultValue="">
              <SelectTrigger className="mt-1 text-sm">
                <SelectValue placeholder="Projectを選択（任意）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="proj1">プロジェクトA</SelectItem>
                <SelectItem value="proj2">プロジェクトB</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-600">Linked User</Label>
            <Select defaultValue="">
              <SelectTrigger className="mt-1 text-sm">
                <SelectValue placeholder="Userを選択（任意）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user1">山田 太郎</SelectItem>
                <SelectItem value="user2">佐藤 花子</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-600">Linked Event</Label>
            <Select defaultValue="">
              <SelectTrigger className="mt-1 text-sm">
                <SelectValue placeholder="Eventを選択（任意）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="evt_1">Q2製品アップデート案内</SelectItem>
                <SelectItem value="evt_2">新規顧客向けWebinar「はじめての活用術」</SelectItem>
                <SelectItem value="evt_3">ユーザー会2026春</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-600">Linked Evidence</Label>
            <Input placeholder="Evidence IDまたは参照" className="mt-1 text-xs" />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Linked Action</Label>
            <Input placeholder="Action IDまたは参照" className="mt-1 text-xs" />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Linked Content</Label>
            <Input placeholder="Content IDまたは参照" className="mt-1 text-xs" />
          </div>
        </div>
      </div>

      <Separator />

      {/* Tags */}
      <div>
        <Label className="text-xs font-semibold text-slate-700 mb-2 block">タグ</Label>
        <div className="flex gap-2 mb-2">
          <Input
            placeholder="タグを追加..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddTag();
              }
            }}
            className="text-xs flex-1"
          />
          <Button size="sm" onClick={handleAddTag} className="text-xs h-8">
            追加
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs pr-1">
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Source Context */}
      <div>
        <Label className="text-xs font-semibold text-slate-700">作成元コンテキスト</Label>
        <Select defaultValue="">
          <SelectTrigger className="mt-1 text-sm">
            <SelectValue placeholder="作成元を選択（任意）" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="evidence">Evidence</SelectItem>
            <SelectItem value="action">Actions</SelectItem>
            <SelectItem value="content">Content</SelectItem>
            <SelectItem value="manual">手動作成</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Version */}
      <div>
        <Label className="text-xs font-semibold text-slate-700">バージョン</Label>
        <Input placeholder="v1.0" defaultValue="v1.0" className="mt-1 text-sm" />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4 border-t">
        <Button size="sm" className="flex-1">
          ライブラリに追加
        </Button>
        <Button size="sm" variant="outline" className="flex-1">
          下書き保存
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>
          キャンセル
        </Button>
      </div>
    </div>
  );
}