import { useState } from "react";
import { NodeConfigSheet, ConfigSection, ConfigField } from "./node-config-sheet";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { CheckCircle, Settings, Sparkles, BarChart3 } from "lucide-react";

export interface EndNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  nodeData?: any;
  onSave: (data: any) => void;
}

export function EndNodeConfig({ isOpen, onClose, nodeData, onSave }: EndNodeConfigProps) {
  const [nodeName, setNodeName] = useState(nodeData?.name || "End");
  const [description, setDescription] = useState(nodeData?.description || "");
  const [enabled, setEnabled] = useState(nodeData?.enabled !== false);
  const [endLabel, setEndLabel] = useState(nodeData?.endLabel || "");
  const [endReason, setEndReason] = useState(nodeData?.endReason || "");
  const [saveResultSummary, setSaveResultSummary] = useState(nodeData?.saveResultSummary !== false);
  const [notifyOwner, setNotifyOwner] = useState(nodeData?.notifyOwner || false);
  const [archiveRun, setArchiveRun] = useState(nodeData?.archiveRun !== false);

  const getValidationStatus = () => {
    if (!endLabel || !endReason) return "error";
    if (!notifyOwner && endReason === "failed") return "warning";
    return "valid";
  };

  const handleSave = () => {
    onSave({ name: nodeName, description, enabled, endLabel, endReason, saveResultSummary, notifyOwner, archiveRun });
    onClose();
  };

  return (
    <NodeConfigSheet isOpen={isOpen} onClose={onClose} nodeType="End" nodeName={nodeName} validationStatus={getValidationStatus()} lastEdited="2026-03-17 14:30" onSave={handleSave}>
      <ConfigSection title="Basic Settings" icon={<Settings className="w-4 h-4 text-slate-600" />}>
        <ConfigField label="Node Name" required>
          <Input value={nodeName} onChange={(e) => setNodeName(e.target.value)} placeholder="例: 正常終了" />
        </ConfigField>
        <ConfigField label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例: 送信完了後に終了" rows={2} />
        </ConfigField>
      </ConfigSection>

      <ConfigSection title="Configuration" icon={<CheckCircle className="w-4 h-4 text-green-600" />}>
        <ConfigField label="End Label" required error={!endLabel ? "End Label を入力してください" : undefined}>
          <Input value={endLabel} onChange={(e) => setEndLabel(e.target.value)} placeholder="例: ✅ 送信完了" />
        </ConfigField>

        <ConfigField label="End Reason" required error={!endReason ? "End Reason を選択してください" : undefined}>
          <select value={endReason} onChange={(e) => setEndReason(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="">選択してください</option>
            <option value="completed">Completed（正常完了）</option>
            <option value="stopped">Stopped（手動停止）</option>
            <option value="failed">Failed（失敗終了）</option>
            <option value="moved-to-draft">Moved to Draft（Draft移動）</option>
            <option value="moved-to-review">Moved to Review（Review移動）</option>
            <option value="policy-violation">Policy Violation（Policy違反）</option>
          </select>
        </ConfigField>

        <ConfigField label="Save Result Summary">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={saveResultSummary} onChange={(e) => setSaveResultSummary(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm text-slate-600">結果サマリーを保存（推奨）</span>
          </div>
        </ConfigField>

        <ConfigField label="Notify Owner" warning={!notifyOwner && endReason === "failed" ? "失敗時は通知を推奨します" : undefined}>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={notifyOwner} onChange={(e) => setNotifyOwner(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm text-slate-600">オーナーに通知</span>
            </div>
            {notifyOwner && (
              <div className="ml-6">
                <select className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
                  <option value="always">Always（常に）</option>
                  <option value="on-success">On Success Only（成功時のみ）</option>
                  <option value="on-failure">On Failure Only（失敗時のみ）</option>
                </select>
              </div>
            )}
          </div>
        </ConfigField>

        <ConfigField label="Archive Run">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={archiveRun} onChange={(e) => setArchiveRun(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm text-slate-600">30日後にアーカイブ</span>
          </div>
        </ConfigField>
      </ConfigSection>

      <ConfigSection title="AI Suggestion" icon={<Sparkles className="w-4 h-4 text-purple-600" />}>
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-start gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-purple-900">Notification Suggestion</p>
              <p className="text-xs text-purple-700 mt-1">失敗時はオーナーへの通知を推奨します</p>
            </div>
          </div>
          <button onClick={() => setNotifyOwner(true)} className="text-xs text-purple-600 hover:text-purple-700 font-medium">この提案を適用</button>
        </div>
      </ConfigSection>

      <ConfigSection title="Preview & Validation" icon={<BarChart3 className="w-4 h-4 text-slate-600" />}>
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <span className="text-xs font-medium text-slate-700 block mb-2">End Summary</span>
          <div className="space-y-1 text-xs text-slate-600">
            <p>End Label: {endLabel || "未設定"}</p>
            <p>End Reason: {endReason || "未選択"}</p>
            <p>Save Result: {saveResultSummary ? "ON" : "OFF"}</p>
            <p>Notify Owner: {notifyOwner ? "ON" : "OFF"}</p>
            <p>Archive: {archiveRun ? "30日後" : "OFF"}</p>
          </div>
        </div>
      </ConfigSection>
    </NodeConfigSheet>
  );
}