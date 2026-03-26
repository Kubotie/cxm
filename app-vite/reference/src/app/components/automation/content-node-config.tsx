import { useState } from "react";
import { NodeConfigSheet, ConfigSection, ConfigField } from "./node-config-sheet";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { FileText, Settings, Sparkles, BarChart3, Eye } from "lucide-react";
import { Button } from "../ui/button";

export interface ContentNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  nodeData?: any;
  onSave: (data: any) => void;
}

export function ContentNodeConfig({ isOpen, onClose, nodeData, onSave }: ContentNodeConfigProps) {
  const [nodeName, setNodeName] = useState(nodeData?.name || "Content");
  const [description, setDescription] = useState(nodeData?.description || "");
  const [enabled, setEnabled] = useState(nodeData?.enabled !== false);
  const [contentMode, setContentMode] = useState(nodeData?.contentMode || "");
  const [contentType, setContentType] = useState(nodeData?.contentType || "");
  const [aiAssistanceMode, setAiAssistanceMode] = useState(nodeData?.aiAssistanceMode || "kocoro-primary");
  const [contentTone, setContentTone] = useState(nodeData?.contentTone || "professional");
  const [contentLength, setContentLength] = useState(nodeData?.contentLength || "medium");
  const [outputFormat, setOutputFormat] = useState(nodeData?.outputFormat || "text");

  const getValidationStatus = () => {
    if (!contentMode || !contentType) return "error";
    if (aiAssistanceMode === "openrouter-only") return "warning";
    return "valid";
  };

  const handleSave = () => {
    onSave({
      name: nodeName,
      description,
      enabled,
      contentMode,
      contentType,
      aiAssistanceMode,
      contentTone,
      contentLength,
      outputFormat,
    });
    onClose();
  };

  return (
    <NodeConfigSheet
      isOpen={isOpen}
      onClose={onClose}
      nodeType="Content"
      nodeName={nodeName}
      validationStatus={getValidationStatus()}
      lastEdited="2026-03-17 14:30"
      onSave={handleSave}
      onTest={() => console.log("Test content")}
      onDelete={() => console.log("Delete content")}
      onDuplicate={() => console.log("Duplicate content")}
    >
      <ConfigSection title="Basic Settings" icon={<Settings className="w-4 h-4 text-slate-600" />}>
        <ConfigField label="Node Name" required>
          <Input value={nodeName} onChange={(e) => setNodeName(e.target.value)} placeholder="例: ウェビナー案内メール生成" />
        </ConfigField>
        <ConfigField label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例: AIでウェビナー案内メールを生成" rows={2} />
        </ConfigField>
        <ConfigField label="Enabled">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm text-slate-600">ノードを有効化</span>
          </div>
        </ConfigField>
      </ConfigSection>

      <ConfigSection title="Configuration" icon={<FileText className="w-4 h-4 text-green-600" />}>
        <ConfigField label="Content Mode" required error={!contentMode ? "Content Mode を選択してください" : undefined}>
          <select value={contentMode} onChange={(e) => setContentMode(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="">選択してください</option>
            <option value="create-new">Create New Content</option>
            <option value="use-existing">Use Existing Content</option>
            <option value="generate-from-template">Generate from Template</option>
            <option value="generate-with-ai">Generate with AI</option>
          </select>
        </ConfigField>

        <ConfigField label="Content Type" required error={!contentType ? "Content Type を選択してください" : undefined}>
          <select value={contentType} onChange={(e) => setContentType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="">選択してください</option>
            <option value="message-draft">Message Draft</option>
            <option value="event-invitation">Event Invitation</option>
            <option value="follow-up-message">Follow-up Message</option>
            <option value="proposal-draft">Proposal Draft</option>
            <option value="summary-draft">Summary Draft</option>
          </select>
        </ConfigField>

        {(contentMode === "generate-with-ai" || contentMode === "create-new") && (
          <>
            <ConfigField label="AI Assistance Mode" warning={aiAssistanceMode === "openrouter-only" ? "Kocoro使用を推奨します" : undefined}>
              <select value={aiAssistanceMode} onChange={(e) => setAiAssistanceMode(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
                <option value="kocoro-primary">Kocoro Primary（推奨）</option>
                <option value="openrouter-fallback">OpenRouter Fallback</option>
                <option value="kocoro-only">Kocoro Only</option>
                <option value="openrouter-only">OpenRouter Only</option>
              </select>
            </ConfigField>

            <ConfigField label="Content Tone">
              <select value={contentTone} onChange={(e) => setContentTone(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
                <option value="formal">Formal（フォーマル）</option>
                <option value="friendly">Friendly（フレンドリー）</option>
                <option value="professional">Professional（プロフェッショナル）</option>
                <option value="casual">Casual（カジュアル）</option>
              </select>
            </ConfigField>

            <ConfigField label="Content Length">
              <select value={contentLength} onChange={(e) => setContentLength(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
                <option value="short">Short（~100 words）</option>
                <option value="medium">Medium（~300 words）</option>
                <option value="long">Long（~500 words）</option>
              </select>
            </ConfigField>
          </>
        )}

        <ConfigField label="Output Format">
          <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="text">Text（テキスト）</option>
            <option value="markdown">Markdown（マークダウン）</option>
            <option value="html">HTML</option>
            <option value="pdf">PDF</option>
          </select>
        </ConfigField>
      </ConfigSection>

      <ConfigSection title="AI Suggestion" icon={<Sparkles className="w-4 h-4 text-purple-600" />}>
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-start gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-purple-900">Content Suggestion</p>
              <p className="text-xs text-purple-700 mt-1">
                類似のEvent案内では 'Friendly + Medium length' が最も効果的でした（開封率: 42%）
              </p>
            </div>
          </div>
          <button className="text-xs text-purple-600 hover:text-purple-700 font-medium">この提案を適用</button>
        </div>
      </ConfigSection>

      <ConfigSection title="Preview & Validation" icon={<BarChart3 className="w-4 h-4 text-slate-600" />}>
        <div className="space-y-3">
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-medium text-slate-700">Preview Output</span>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <p className="font-medium">Subject: 【AI活用セミナー】ご案内</p>
              <p className="mt-2 text-slate-500">ABC Corporation 御中<br /><br />いつもお世話になっております。<br />来る4月15日に開催される...</p>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-2 text-xs h-7">全文を見る</Button>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-xs font-medium text-slate-700 block mb-2">Expected Deliverable</span>
            <div className="space-y-1 text-xs text-slate-600">
              <p>Output Format: {outputFormat}</p>
              <p>Estimated Length: 約 320 words</p>
              <p>AI Mode: {aiAssistanceMode}</p>
            </div>
          </div>
        </div>
      </ConfigSection>
    </NodeConfigSheet>
  );
}