import { useState } from "react";
import { NodeConfigSheet, ConfigSection, ConfigField } from "./node-config-sheet";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Mail, Settings, Sparkles, BarChart3, Users, FileText, AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";

export interface OutboundNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  nodeData?: any;
  onSave: (data: any) => void;
}

export function OutboundNodeConfig({ isOpen, onClose, nodeData, onSave }: OutboundNodeConfigProps) {
  const [nodeName, setNodeName] = useState(nodeData?.name || "Outbound");
  const [description, setDescription] = useState(nodeData?.description || "");
  const [enabled, setEnabled] = useState(nodeData?.enabled !== false);
  const [outboundMode, setOutboundMode] = useState(nodeData?.outboundMode || "");
  const [channel, setChannel] = useState(nodeData?.channel || "");
  const [audienceSource, setAudienceSource] = useState(nodeData?.audienceSource || "upstream");
  const [contentSource, setContentSource] = useState(nodeData?.contentSource || "upstream");
  const [subjectTemplate, setSubjectTemplate] = useState(nodeData?.subjectTemplate || "");
  const [draftSave, setDraftSave] = useState(nodeData?.draftSave !== false);
  const [reviewQueue, setReviewQueue] = useState(nodeData?.reviewQueue || false);
  const [composeHandoff, setComposeHandoff] = useState(nodeData?.composeHandoff !== false);

  const recipientCount = 342;
  const unresolvedVariables = 0;

  const getValidationStatus = () => {
    if (!outboundMode || !channel || !audienceSource || !contentSource) return "error";
    if (channel === "email" && !subjectTemplate) return "error";
    if (unresolvedVariables > 0) return "warning";
    if (recipientCount > 500) return "warning";
    return "valid";
  };

  const handleSave = () => {
    onSave({
      name: nodeName,
      description,
      enabled,
      outboundMode,
      channel,
      audienceSource,
      contentSource,
      subjectTemplate,
      draftSave,
      reviewQueue,
      composeHandoff,
    });
    onClose();
  };

  return (
    <NodeConfigSheet
      isOpen={isOpen}
      onClose={onClose}
      nodeType="Outbound"
      nodeName={nodeName}
      validationStatus={getValidationStatus()}
      lastEdited="2026-03-17 14:30"
      onSave={handleSave}
      onTest={() => console.log("Test outbound")}
      onDelete={() => console.log("Delete outbound")}
      onDuplicate={() => console.log("Duplicate outbound")}
    >
      <ConfigSection title="Basic Settings" icon={<Settings className="w-4 h-4 text-slate-600" />}>
        <ConfigField label="Node Name" required>
          <Input value={nodeName} onChange={(e) => setNodeName(e.target.value)} placeholder="例: Compose に送信Draft作成" />
        </ConfigField>
        <ConfigField label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例: Composeで最終確認後に送信" rows={2} />
        </ConfigField>
        <ConfigField label="Enabled">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm text-slate-600">ノードを有効化</span>
          </div>
        </ConfigField>
      </ConfigSection>

      <ConfigSection title="Configuration" icon={<Mail className="w-4 h-4 text-indigo-600" />}>
        <ConfigField label="Outbound Mode" required error={!outboundMode ? "Outbound Mode を選択してください" : undefined}>
          <select value={outboundMode} onChange={(e) => setOutboundMode(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="">選択してください</option>
            <option value="create-draft">Create Outbound Draft</option>
            <option value="send-to-compose">Send to Compose</option>
            <option value="review-queue">Review Queue Only</option>
            <option value="direct-handoff">Direct Handoff</option>
          </select>
        </ConfigField>

        <ConfigField label="Channel" required error={!channel ? "Channel を選択してください" : undefined}>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="">選択してください</option>
            <option value="email">Email</option>
            <option value="intercom">Intercom</option>
            <option value="slack">Slack</option>
            <option value="chatwork">Chatwork</option>
          </select>
        </ConfigField>

        <ConfigField label="Audience Source" required>
          <select value={audienceSource} onChange={(e) => setAudienceSource(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="upstream">From Upstream Audience Node</option>
            <option value="trigger">From Trigger</option>
            <option value="custom">Custom Selection</option>
          </select>
        </ConfigField>

        <ConfigField label="Content Source" required>
          <select value={contentSource} onChange={(e) => setContentSource(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="upstream">From Upstream Content Node</option>
            <option value="library">From Library Template</option>
            <option value="custom">Custom Input</option>
          </select>
        </ConfigField>

        {channel === "email" && (
          <ConfigField label="Subject Template" required error={channel === "email" && !subjectTemplate ? "Subject を入力してください" : undefined}>
            <Input
              value={subjectTemplate}
              onChange={(e) => setSubjectTemplate(e.target.value)}
              placeholder="例: 【{{event_name}}】ご案内"
            />
            <p className="text-xs text-slate-500 mt-1">変数: {"{{"}<span className="text-purple-600">event_name</span>{"}} {{"}<span className="text-purple-600">company_name</span>{"}} {{"}<span className="text-purple-600">date</span>{"}}"}</p>
          </ConfigField>
        )}

        <ConfigField label="Draft Save">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={draftSave} onChange={(e) => setDraftSave(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm text-slate-600">下書きとして保存</span>
          </div>
        </ConfigField>

        <ConfigField label="Review Queue">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={reviewQueue} onChange={(e) => setReviewQueue(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm text-slate-600">Review Queueに送る</span>
            </div>
            {reviewQueue && (
              <div className="ml-6 space-y-2">
                <ConfigField label="Reviewer">
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
                    <option value="">レビュアーを選択</option>
                    <option value="user-1">田中太郎（Manager）</option>
                    <option value="user-2">佐藤花子（CSM Lead）</option>
                  </select>
                </ConfigField>
                <ConfigField label="Review Deadline">
                  <div className="flex items-center gap-2">
                    <Input type="number" defaultValue="2" className="w-20" />
                    <span className="text-sm text-slate-600">days</span>
                  </div>
                </ConfigField>
              </div>
            )}
          </div>
        </ConfigField>

        <ConfigField label="Compose Handoff">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={composeHandoff} onChange={(e) => setComposeHandoff(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm text-slate-600">Composeに渡す</span>
            </div>
            {composeHandoff && (
              <div className="ml-6">
                <select className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
                  <option value="edit">Edit Mode（編集可能）</option>
                  <option value="review">Review Mode（確認のみ）</option>
                  <option value="ready">Send Ready（送信準備完了）</option>
                </select>
              </div>
            )}
          </div>
        </ConfigField>
      </ConfigSection>

      <ConfigSection title="AI Suggestion" icon={<Sparkles className="w-4 h-4 text-purple-600" />}>
        <div className="space-y-3">
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-start gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-900">Channel Suggestion</p>
                <p className="text-xs text-purple-700 mt-1">
                  このAudience tierには Email が最も効果的です（過去の開封率: 38%）
                </p>
              </div>
            </div>
            <button onClick={() => setChannel("email")} className="text-xs text-purple-600 hover:text-purple-700 font-medium">
              この提案を適用
            </button>
          </div>

          {channel && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2 mb-2">
                <Mail className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">Template Suggestion</p>
                  <p className="text-xs text-blue-700 mt-1">
                    類似のEvent案内では 'Template v3' が最も使われています
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </ConfigSection>

      <ConfigSection title="Preview & Validation" icon={<BarChart3 className="w-4 h-4 text-slate-600" />}>
        <div className="space-y-3">
          {/* Recipients Preview */}
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-medium text-slate-700">Recipient Preview</span>
              </div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {recipientCount} recipients
              </Badge>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <div className="grid grid-cols-3 gap-2 pb-1 border-b border-slate-200 font-medium">
                <span>Company</span>
                <span>Contact</span>
                <span>Tier</span>
              </div>
              {[
                { company: "ABC Corp", contact: "田中太郎", tier: "Enterprise" },
                { company: "XYZ Inc", contact: "佐藤花子", tier: "Premium" },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 py-1 text-slate-700">
                  <span>{row.company}</span>
                  <span>{row.contact}</span>
                  <span>{row.tier}</span>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full mt-2 text-xs h-7">
              全件を見る（{recipientCount}件）
            </Button>
          </div>

          {/* Content Preview */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-medium text-slate-700">Content Preview</span>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <p className="font-medium">Subject: 【AI活用セミナー】ご案内</p>
              <p className="mt-2 text-slate-500">
                ABC Corporation 御中
                <br />
                <br />
                いつもお世話になっております。
                <br />
                来る4月15日に開催される...
              </p>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-2 text-xs h-7">
              全文を見る
            </Button>
          </div>

          {/* Unresolved Variables */}
          {unresolvedVariables > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-amber-900">Unresolved Variables</p>
                  <p className="text-xs text-amber-700 mt-1">
                    ⚠️ {"{{"}<span className="text-purple-600">event_location</span>{"}"} が 45件で未解決
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="mt-2 text-xs h-7">
                変数を解決
              </Button>
            </div>
          )}

          {/* Warnings */}
          {recipientCount > 500 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
              <p className="text-xs text-amber-700">
                受信者数が500件を超えています。Send Policy確認を推奨します。
              </p>
            </div>
          )}

          {!reviewQueue && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5" />
              <p className="text-xs text-blue-700">
                Review Queue の有効化を推奨します（品質確保のため）
              </p>
            </div>
          )}
        </div>
      </ConfigSection>
    </NodeConfigSheet>
  );
}