import { useState } from "react";
import { NodeConfigSheet, ConfigSection, ConfigField } from "./node-config-sheet";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Zap, Settings, Sparkles, BarChart3, Calendar, Clock, AlertCircle } from "lucide-react";

export interface TriggerNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  nodeData?: any;
  onSave: (data: any) => void;
}

export function TriggerNodeConfig({ isOpen, onClose, nodeData, onSave }: TriggerNodeConfigProps) {
  const [nodeName, setNodeName] = useState(nodeData?.name || "Trigger");
  const [description, setDescription] = useState(nodeData?.description || "");
  const [enabled, setEnabled] = useState(nodeData?.enabled !== false);
  const [triggerType, setTriggerType] = useState(nodeData?.triggerType || "");
  const [triggerSource, setTriggerSource] = useState(nodeData?.triggerSource || "");
  const [linkedResource, setLinkedResource] = useState(nodeData?.linkedResource || "");
  const [scheduleType, setScheduleType] = useState(nodeData?.scheduleType || "");
  const [manualRunAllowed, setManualRunAllowed] = useState(nodeData?.manualRunAllowed || true);
  const [debounceWindow, setDebounceWindow] = useState(nodeData?.debounceWindow || "1");
  const [maxRunsPerDay, setMaxRunsPerDay] = useState(nodeData?.maxRunsPerDay || "0");

  const triggerTypes = [
    "Event Started",
    "Event Ending Soon",
    "Audience Matched",
    "Support Alert Created",
    "Risk Alert Created",
    "Opportunity Alert Created",
    "CSE Waiting Too Long",
    "New Inquiry Detected",
    "Product Update Published",
    "Manual Start",
    "Schedule Based",
    "Status Changed",
  ];

  const triggerSources = ["Event", "Support", "Audience", "Company", "Project", "Content", "Product Update", "Manual"];

  const getValidationStatus = () => {
    if (!triggerType || !triggerSource) return "error";
    if (triggerType && triggerSource && !linkedResource && triggerSource !== "Manual") return "warning";
    return "valid";
  };

  const handleSave = () => {
    onSave({
      name: nodeName,
      description,
      enabled,
      triggerType,
      triggerSource,
      linkedResource,
      scheduleType,
      manualRunAllowed,
      debounceWindow,
      maxRunsPerDay,
    });
    onClose();
  };

  return (
    <NodeConfigSheet
      isOpen={isOpen}
      onClose={onClose}
      nodeType="Trigger"
      nodeName={nodeName}
      validationStatus={getValidationStatus()}
      lastEdited="2026-03-17 14:30"
      onSave={handleSave}
      onTest={() => console.log("Test trigger")}
      onDelete={() => console.log("Delete trigger")}
      onDuplicate={() => console.log("Duplicate trigger")}
    >
      {/* Basic Settings */}
      <ConfigSection title="Basic Settings" icon={<Settings className="w-4 h-4 text-slate-600" />}>
        <ConfigField label="Node Name" required>
          <Input
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
            placeholder="例: Event開始時にトリガー"
          />
        </ConfigField>

        <ConfigField label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例: ウェビナー開始1週間前に発動"
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
            <span className="text-sm text-slate-600">トリガーを有効化</span>
          </div>
        </ConfigField>
      </ConfigSection>

      {/* Configuration */}
      <ConfigSection title="Configuration" icon={<Zap className="w-4 h-4 text-purple-600" />}>
        <ConfigField
          label="Trigger Type"
          required
          error={!triggerType ? "Trigger Type を選択してください" : undefined}
        >
          <select
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="">選択してください</option>
            {triggerTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </ConfigField>

        <ConfigField
          label="Trigger Source"
          required
          error={!triggerSource ? "Trigger Source を選択してください" : undefined}
        >
          <select
            value={triggerSource}
            onChange={(e) => setTriggerSource(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="">選択してください</option>
            {triggerSources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </ConfigField>

        {triggerSource === "Event" && (
          <ConfigField
            label="Select Event"
            required
            warning={!linkedResource ? "Event を選択することを推奨します" : undefined}
          >
            <select
              value={linkedResource}
              onChange={(e) => setLinkedResource(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">選択してください</option>
              <option value="event-1">AI活用セミナー #45</option>
              <option value="event-2">製品デモウェビナー #46</option>
              <option value="event-3">導入事例セミナー #47</option>
            </select>
          </ConfigField>
        )}

        {triggerSource === "Support" && (
          <ConfigField label="Alert Type" required>
            <select
              value={linkedResource}
              onChange={(e) => setLinkedResource(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">選択してください</option>
              <option value="unresolved">Unresolved Alert</option>
              <option value="escalation">Escalation Alert</option>
              <option value="no-reply">No Reply Alert</option>
            </select>
          </ConfigField>
        )}

        {triggerType === "Schedule Based" && (
          <>
            <ConfigField label="Schedule Type" required>
              <select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              >
                <option value="">選択してください</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </ConfigField>

            {scheduleType === "weekly" && (
              <ConfigField label="Day of Week">
                <select className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
                  <option value="1">月曜日</option>
                  <option value="2">火曜日</option>
                  <option value="3">水曜日</option>
                  <option value="4">木曜日</option>
                  <option value="5">金曜日</option>
                </select>
              </ConfigField>
            )}

            <ConfigField label="Time">
              <Input type="time" defaultValue="09:00" />
            </ConfigField>
          </>
        )}

        <ConfigField label="Manual Run Allowed">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={manualRunAllowed}
              onChange={(e) => setManualRunAllowed(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-slate-600">手動実行を許可</span>
          </div>
        </ConfigField>

        <ConfigField
          label="Debounce Window"
          description="同一条件での再発動を防ぐ期間"
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={debounceWindow}
              onChange={(e) => setDebounceWindow(e.target.value)}
              className="w-24"
            />
            <select className="px-3 py-2 border border-slate-300 rounded-md text-sm">
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
          </div>
        </ConfigField>

        <ConfigField
          label="Max Runs Per Day"
          description="1日の最大実行回数（0 = 無制限）"
        >
          <Input
            type="number"
            value={maxRunsPerDay}
            onChange={(e) => setMaxRunsPerDay(e.target.value)}
            className="w-32"
          />
        </ConfigField>
      </ConfigSection>

      {/* AI Suggestion */}
      <ConfigSection title="AI Suggestion" icon={<Sparkles className="w-4 h-4 text-purple-600" />}>
        <div className="space-y-3">
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-start gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-900">Trigger Suggestion</p>
                <p className="text-xs text-purple-700 mt-1">
                  このEvent typeでは 'Event開始7日前' が最も使われています（類似Automation 15件）
                </p>
              </div>
            </div>
            <button className="text-xs text-purple-600 hover:text-purple-700 font-medium">
              この提案を適用
            </button>
          </div>

          {triggerType === "Schedule Based" && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2 mb-2">
                <Calendar className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">Timing Suggestion</p>
                  <p className="text-xs text-blue-700 mt-1">
                    過去データから、火曜日10時の送信が最も効果的です（開封率: 42%）
                  </p>
                </div>
              </div>
              <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                この提案を適用
              </button>
            </div>
          )}
        </div>
      </ConfigSection>

      {/* Preview & Validation */}
      <ConfigSection title="Preview & Validation" icon={<BarChart3 className="w-4 h-4 text-slate-600" />}>
        <div className="space-y-3">
          {/* Expected Trigger Count */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-700">Expected Trigger Count</span>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                約 18回/30日
              </Badge>
            </div>
            <p className="text-xs text-slate-600">
              過去30日で15回発動。今後30日で約18回発動の見込み
            </p>
          </div>

          {/* Last Matched Example */}
          {triggerSource === "Event" && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-medium text-slate-700">Last Matched Example</span>
              </div>
              <div className="text-xs text-slate-600">
                <p>最終発動: 2026-03-16 12:00</p>
                <p className="mt-1">Event: AI活用セミナー #45</p>
              </div>
            </div>
          )}

          {/* Validation Messages */}
          {!triggerType && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
              <p className="text-xs text-red-700">
                Trigger Type を選択してください
              </p>
            </div>
          )}

          {!triggerSource && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
              <p className="text-xs text-red-700">
                Trigger Source を選択してください
              </p>
            </div>
          )}
        </div>
      </ConfigSection>
    </NodeConfigSheet>
  );
}