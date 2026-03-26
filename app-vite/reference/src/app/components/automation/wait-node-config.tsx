import { useState } from "react";
import { NodeConfigSheet, ConfigSection, ConfigField } from "./node-config-sheet";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Clock, Settings, Sparkles, BarChart3 } from "lucide-react";

export interface WaitNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  nodeData?: any;
  onSave: (data: any) => void;
}

export function WaitNodeConfig({ isOpen, onClose, nodeData, onSave }: WaitNodeConfigProps) {
  const [nodeName, setNodeName] = useState(nodeData?.name || "Wait");
  const [description, setDescription] = useState(nodeData?.description || "");
  const [enabled, setEnabled] = useState(nodeData?.enabled !== false);
  const [waitType, setWaitType] = useState(nodeData?.waitType || "");
  const [duration, setDuration] = useState(nodeData?.duration || "3");
  const [unit, setUnit] = useState(nodeData?.unit || "days");
  const [timeoutHandling, setTimeoutHandling] = useState(nodeData?.timeoutHandling || "continue-next");
  const [businessHoursOnly, setBusinessHoursOnly] = useState(nodeData?.businessHoursOnly || false);

  const getValidationStatus = () => {
    if (!waitType) return "error";
    if (waitType === "fixed-duration" && !duration) return "error";
    if (parseInt(duration) > 30) return "warning";
    return "valid";
  };

  const handleSave = () => {
    onSave({ name: nodeName, description, enabled, waitType, duration, unit, timeoutHandling, businessHoursOnly });
    onClose();
  };

  return (
    <NodeConfigSheet isOpen={isOpen} onClose={onClose} nodeType="Wait" nodeName={nodeName} validationStatus={getValidationStatus()} lastEdited="2026-03-17 14:30" onSave={handleSave}>
      <ConfigSection title="Basic Settings" icon={<Settings className="w-4 h-4 text-slate-600" />}>
        <ConfigField label="Node Name" required>
          <Input value={nodeName} onChange={(e) => setNodeName(e.target.value)} placeholder="例: 3日間待機" />
        </ConfigField>
        <ConfigField label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例: 送信後3日間の反応を待つ" rows={2} />
        </ConfigField>
      </ConfigSection>

      <ConfigSection title="Configuration" icon={<Clock className="w-4 h-4 text-orange-600" />}>
        <ConfigField label="Wait Type" required error={!waitType ? "Wait Type を選択してください" : undefined}>
          <select value={waitType} onChange={(e) => setWaitType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="">選択してください</option>
            <option value="fixed-duration">Fixed Duration</option>
            <option value="until-event">Until Event</option>
            <option value="until-reply">Until Reply</option>
            <option value="until-no-engagement">Until No Engagement</option>
            <option value="until-date">Until Date</option>
          </select>
        </ConfigField>

        {waitType === "fixed-duration" && (
          <ConfigField label="Duration" required error={!duration ? "Duration を入力してください" : undefined} warning={parseInt(duration) > 30 ? "30日を超える待機時間は推奨されません" : undefined}>
            <div className="flex items-center gap-2">
              <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-24" />
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-md text-sm">
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
              </select>
            </div>
          </ConfigField>
        )}

        {(waitType === "until-event" || waitType === "until-reply") && (
          <ConfigField label="Timeout Handling" description="タイムアウト時の動作">
            <select value={timeoutHandling} onChange={(e) => setTimeoutHandling(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
              <option value="continue-next">Continue Next Step</option>
              <option value="branch-fallback">Branch to Fallback</option>
              <option value="stop-run">Stop Run</option>
              <option value="move-to-draft">Move to Draft</option>
            </select>
          </ConfigField>
        )}

        <ConfigField label="Business Hours Only">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={businessHoursOnly} onChange={(e) => setBusinessHoursOnly(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm text-slate-600">営業時間のみ考慮（09:00-18:00）</span>
          </div>
        </ConfigField>
      </ConfigSection>

      <ConfigSection title="AI Suggestion" icon={<Sparkles className="w-4 h-4 text-purple-600" />}>
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-start gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-purple-900">Timing Suggestion</p>
              <p className="text-xs text-purple-700 mt-1">このEvent typeでは '送信後3日' が最も効果的です（返信率: 28%）</p>
            </div>
          </div>
          <button onClick={() => { setDuration("3"); setUnit("days"); }} className="text-xs text-purple-600 hover:text-purple-700 font-medium">この提案を適用</button>
        </div>
      </ConfigSection>

      <ConfigSection title="Preview & Validation" icon={<BarChart3 className="w-4 h-4 text-slate-600" />}>
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <span className="text-xs font-medium text-slate-700 block mb-2">Wait Summary</span>
          <div className="space-y-1 text-xs text-slate-600">
            <p>Wait Type: {waitType || "未選択"}</p>
            {waitType === "fixed-duration" && <p>Duration: {duration} {unit}</p>}
            {businessHoursOnly && <p className="text-amber-600">※ 営業時間外は待機時間に含まれません</p>}
            <p>Expected Resume: 2026-03-20 14:30（予測）</p>
          </div>
        </div>
      </ConfigSection>
    </NodeConfigSheet>
  );
}