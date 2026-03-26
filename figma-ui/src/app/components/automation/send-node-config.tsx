import { useState } from "react";
import { NodeConfigSheet, ConfigSection, ConfigField } from "./node-config-sheet";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import {
  Send,
  Settings,
  Sparkles,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  Shield,
  FileText,
} from "lucide-react";
import { Button } from "../ui/button";

export interface SendNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  nodeData?: any;
  onSave: (data: any) => void;
}

export function SendNodeConfig({ isOpen, onClose, nodeData, onSave }: SendNodeConfigProps) {
  const [nodeName, setNodeName] = useState(nodeData?.name || "Send");
  const [description, setDescription] = useState(nodeData?.description || "");
  const [enabled, setEnabled] = useState(nodeData?.enabled !== false);
  const [sendMode, setSendMode] = useState(nodeData?.sendMode || "");
  const [channel, setChannel] = useState(nodeData?.channel || "");
  const [targetAudience, setTargetAudience] = useState(nodeData?.targetAudience || "upstream");
  const [contentSource, setContentSource] = useState(nodeData?.contentSource || "upstream");
  const [maxRecipientThreshold, setMaxRecipientThreshold] = useState(nodeData?.maxRecipientThreshold || "500");
  const [fallbackBehavior, setFallbackBehavior] = useState(nodeData?.fallbackBehavior || "move-to-draft");
  const [deliveryRetry, setDeliveryRetry] = useState(nodeData?.deliveryRetry !== false);
  const [retryCount, setRetryCount] = useState(nodeData?.retryCount || "3");

  // Mock data for preview
  const recipientCount = 342;
  const highRiskCount = 45;
  const isPolicyEligible = recipientCount <= 500 && highRiskCount < 50;

  const sendModes = [
    { value: "draft-only", label: "Draft Only", color: "slate" },
    { value: "review-before-send", label: "Review Before Send", color: "blue" },
    { value: "auto-send", label: "Auto Send", color: "purple" },
  ];

  const channels = ["Email", "Intercom", "Slack", "Chatwork"];

  const getValidationStatus = () => {
    if (!sendMode || !channel || !targetAudience || !contentSource) return "error";
    if (sendMode === "auto-send" && !isPolicyEligible) return "error";
    if (highRiskCount > 0) return "warning";
    return "valid";
  };

  const getSendModeBadge = (mode: string) => {
    const modeData = sendModes.find((m) => m.value === mode);
    if (!modeData) return null;

    const colorClasses = {
      slate: "bg-slate-100 text-slate-800 border-slate-200",
      blue: "bg-blue-100 text-blue-800 border-blue-200",
      purple: "bg-purple-100 text-purple-800 border-purple-200",
    };

    return (
      <Badge variant="outline" className={colorClasses[modeData.color as keyof typeof colorClasses]}>
        {modeData.label}
        {mode === "auto-send" && <AlertTriangle className="w-3 h-3 ml-1" />}
      </Badge>
    );
  };

  const handleSave = () => {
    onSave({
      name: nodeName,
      description,
      enabled,
      sendMode,
      channel,
      targetAudience,
      contentSource,
      maxRecipientThreshold,
      fallbackBehavior,
      deliveryRetry,
      retryCount,
    });
    onClose();
  };

  return (
    <NodeConfigSheet
      isOpen={isOpen}
      onClose={onClose}
      nodeType="Send"
      nodeName={nodeName}
      validationStatus={getValidationStatus()}
      lastEdited="2026-03-17 14:30"
      onSave={handleSave}
      onTest={() => console.log("Test send")}
      onDelete={() => console.log("Delete send")}
      onDuplicate={() => console.log("Duplicate send")}
    >
      {/* Basic Settings */}
      <ConfigSection title="Basic Settings" icon={<Settings className="w-4 h-4 text-slate-600" />}>
        <ConfigField label="Node Name" required>
          <Input
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
            placeholder="例: Email自動送信（Policy制御）"
          />
        </ConfigField>

        <ConfigField label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例: 条件を満たす場合のみ自動送信"
            rows={2}
          />
        </ConfigField>

        <ConfigField label="Enabled">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-slate-600">ノードを有効化</span>
          </div>
        </ConfigField>
      </ConfigSection>

      {/* Configuration */}
      <ConfigSection title="Configuration" icon={<Send className="w-4 h-4 text-purple-600" />}>
        <ConfigField
          label="Send Mode"
          required
          description="送信モードを選択してください"
          error={!sendMode ? "Send Mode を選択してください" : undefined}
        >
          <div className="space-y-2">
            {sendModes.map((mode) => (
              <label
                key={mode.value}
                className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  sendMode === mode.value
                    ? "border-purple-500 bg-purple-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="sendMode"
                  value={mode.value}
                  checked={sendMode === mode.value}
                  onChange={(e) => setSendMode(e.target.value)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-900">{mode.label}</span>
                    {getSendModeBadge(mode.value)}
                  </div>
                  <p className="text-xs text-slate-600">
                    {mode.value === "draft-only" &&
                      "Composeに下書きとして保存されます。手動で送信が必要です。"}
                    {mode.value === "review-before-send" &&
                      "Review Queueに送られます。承認後に送信されます。"}
                    {mode.value === "auto-send" &&
                      "⚠️ 条件を満たす場合、自動的に送信されます。Send Policyにより厳密に制御されます。"}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </ConfigField>

        {/* Auto Send Warning */}
        {sendMode === "auto-send" && (
          <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-amber-900">⚠️ Auto Send 制限事項</h4>
                <p className="text-xs text-amber-800 mt-1">
                  Auto Send は Settings の Automation Send Policies により厳密に制御されます。
                </p>
              </div>
            </div>
            <div className="space-y-1 text-xs text-amber-800 ml-7">
              <p>以下の条件が適用されます:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>対象件数 &gt; 100: Manager承認必須</li>
                <li>High Risk企業: Draft Onlyに変更</li>
                <li>Enterprise tier: Review必須</li>
                <li>チャネル別上限: Email=500, Slack=200</li>
              </ul>
            </div>
            <Button variant="outline" size="sm" className="mt-3 text-xs h-7">
              Send Policy を確認
            </Button>
          </div>
        )}

        <ConfigField
          label="Channel"
          required
          error={!channel ? "Channel を選択してください" : undefined}
        >
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="">選択してください</option>
            {channels.map((ch) => (
              <option key={ch} value={ch.toLowerCase()}>
                {ch}
              </option>
            ))}
          </select>
        </ConfigField>

        <ConfigField label="Target Audience" required>
          <select
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="upstream">From Upstream Audience Node</option>
            <option value="upstream-outbound">From Upstream Outbound Node</option>
            <option value="custom">Custom Selection</option>
          </select>
        </ConfigField>

        <ConfigField label="Content Source" required>
          <select
            value={contentSource}
            onChange={(e) => setContentSource(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="upstream">From Upstream Content Node</option>
            <option value="upstream-outbound">From Upstream Outbound Node</option>
            <option value="template">From Template</option>
          </select>
        </ConfigField>

        <ConfigField
          label="Max Recipient Threshold"
          description="最大受信者数の閾値"
        >
          <Input
            type="number"
            value={maxRecipientThreshold}
            onChange={(e) => setMaxRecipientThreshold(e.target.value)}
            className="w-32"
          />
        </ConfigField>

        <ConfigField label="Fallback Behavior" description="送信失敗時の動作">
          <select
            value={fallbackBehavior}
            onChange={(e) => setFallbackBehavior(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="move-to-draft">Move to Draft</option>
            <option value="move-to-review">Move to Review Queue</option>
            <option value="skip-send">Skip Send</option>
            <option value="stop-run">Stop Run</option>
            <option value="continue-next">Continue Next Step</option>
          </select>
        </ConfigField>

        <ConfigField label="Delivery Retry">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={deliveryRetry}
                onChange={(e) => setDeliveryRetry(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-600">配信リトライを有効化</span>
            </div>
            {deliveryRetry && (
              <div className="ml-6">
                <ConfigField label="Retry Count">
                  <Input
                    type="number"
                    value={retryCount}
                    onChange={(e) => setRetryCount(e.target.value)}
                    className="w-24"
                  />
                </ConfigField>
              </div>
            )}
          </div>
        </ConfigField>
      </ConfigSection>

      {/* AI Suggestion */}
      <ConfigSection title="AI Suggestion" icon={<Sparkles className="w-4 h-4 text-purple-600" />}>
        <div className="space-y-3">
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-start gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-900">Send Mode Suggestion</p>
                <p className="text-xs text-purple-700 mt-1">
                  このAudienceには 'Review Before Send' が推奨されます（High Risk企業が{highRiskCount}件含まれています）
                </p>
              </div>
            </div>
            <button
              onClick={() => setSendMode("review-before-send")}
              className="text-xs text-purple-600 hover:text-purple-700 font-medium"
            >
              この提案を適用
            </button>
          </div>

          {channel && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2 mb-2">
                <Send className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">Channel Suggestion</p>
                  <p className="text-xs text-blue-700 mt-1">
                    このAudience tierには Email が最も効果的です（過去の開封率: 38%）
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </ConfigSection>

      {/* Preview & Validation */}
      <ConfigSection title="Preview & Validation" icon={<BarChart3 className="w-4 h-4 text-slate-600" />}>
        <div className="space-y-3">
          {/* Recipients Preview */}
          <div className="p-4 bg-white border-2 border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-semibold text-slate-900">Recipients Preview</span>
              </div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {recipientCount} contacts
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="text-xs">
                <div className="grid grid-cols-4 gap-2 pb-2 border-b border-slate-200 font-medium text-slate-700">
                  <span>Company</span>
                  <span>Contact</span>
                  <span>Tier</span>
                  <span>Risk</span>
                </div>
                {[
                  { company: "ABC Corp", contact: "田中太郎", tier: "Enterprise", risk: "Low" },
                  { company: "XYZ Inc", contact: "佐藤花子", tier: "Premium", risk: "Medium" },
                  { company: "DEF Ltd", contact: "鈴木一郎", tier: "Enterprise", risk: "High" },
                ].map((row, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 py-2 border-b border-slate-100">
                    <span className="text-slate-900">{row.company}</span>
                    <span className="text-slate-700">{row.contact}</span>
                    <span className="text-slate-700">{row.tier}</span>
                    <Badge
                      variant="outline"
                      className={
                        row.risk === "High"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : row.risk === "Medium"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-green-50 text-green-700 border-green-200"
                      }
                    >
                      {row.risk}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {highRiskCount > 0 && (
              <div className="mt-3 p-2 bg-amber-50 rounded flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                <p className="text-xs text-amber-700">
                  ⚠️ Warning: {highRiskCount}件の High Risk企業が含まれています
                </p>
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full mt-3 text-xs h-7">
              全件を見る
            </Button>
          </div>

          {/* Send Policy Status */}
          <div
            className={`p-4 border-2 rounded-lg ${
              isPolicyEligible
                ? "bg-green-50 border-green-300"
                : "bg-red-50 border-red-300"
            }`}
          >
            <div className="flex items-start gap-2 mb-3">
              <Shield className="w-5 h-5 text-slate-700 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  {isPolicyEligible ? "✅ Send Policy Status" : "❌ Send Restricted"}
                </h4>
              </div>
            </div>

            {isPolicyEligible ? (
              <div className="space-y-2 text-xs text-slate-700 ml-7">
                <p className="font-medium">このAutomationはAuto Sendが許可されています</p>
                <div className="space-y-1">
                  <p className="font-medium">現在の条件:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li>チャネル: {channel || "未選択"}（最大500件）</li>
                    <li>現在の対象件数: 約{recipientCount}件</li>
                    <li>Risk Level: Medium（自動送信可）</li>
                    <li>Tier: Enterprise（Review推奨、但し許可済み）</li>
                  </ul>
                </div>
                <div className="space-y-1 mt-2">
                  <p className="font-medium">制限事項:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li>対象件数が500件を超える場合、Review必須</li>
                    <li>High Risk企業が含まれる場合、Draft Onlyに変更</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-slate-700 ml-7">
                <p className="font-medium">このAutomationはAuto Sendが制限されています</p>
                <div className="space-y-1">
                  <p className="font-medium">理由:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li>High Risk企業が{highRiskCount}件含まれています</li>
                  </ul>
                </div>
                <div className="space-y-1 mt-2">
                  <p className="font-medium">推奨されるSend Mode:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li>Draft Only または Review Before Send</li>
                  </ul>
                </div>
              </div>
            )}

            <Button variant="outline" size="sm" className="mt-3 text-xs h-7">
              Policy詳細を確認
            </Button>
          </div>

          {/* High Risk Warning */}
          {highRiskCount > 0 && sendMode === "auto-send" && (
            <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
              <div className="flex items-start gap-2 mb-3">
                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-red-900">⚠️ HIGH RISK WARNING</h4>
                </div>
              </div>
              <div className="space-y-2 text-xs text-red-800 ml-7">
                <p>以下のHigh Risk企業が含まれています:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>DEF Ltd（未解決Issue: 5件）</li>
                  <li>GHI Corp（Escalation中: 2件）</li>
                  <li>JKL Inc（Churn Risk: High）</li>
                  <li>... 他{highRiskCount - 3}社</li>
                </ul>
                <p className="mt-2 font-medium">推奨アクション:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>これらの企業は Draft Only に変更されます</li>
                  <li>または Review Before Send に変更してください</li>
                </ul>
              </div>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" className="text-xs h-7">
                  High Risk企業を除外
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setSendMode("draft-only")}
                >
                  Draft Onlyに変更
                </Button>
              </div>
            </div>
          )}

          {/* Content Preview */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-medium text-slate-700">Content Preview</span>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <p className="font-medium">Subject: 【AI活用セミナー】ご案内</p>
              <p className="mt-2">Body:</p>
              <p className="text-slate-500">
                ABC Corporation 御中
                <br />
                <br />
                いつもお世話になっております。
                <br />
                来る4月15日に開催される「AI活用セミナー」...
              </p>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-2 text-xs h-7">
              全文を見る
            </Button>
          </div>

          {/* Validation Errors */}
          {!sendMode && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
              <p className="text-xs text-red-700">Send Mode を選択してください</p>
            </div>
          )}

          {!channel && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
              <p className="text-xs text-red-700">Channel を選択してください</p>
            </div>
          )}
        </div>
      </ConfigSection>
    </NodeConfigSheet>
  );
}