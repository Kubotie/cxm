import { useState } from "react";
import { NodeConfigSheet, ConfigSection, ConfigField } from "./node-config-sheet";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Filter, Settings, Sparkles, BarChart3, Plus, X } from "lucide-react";
import { Button } from "../ui/button";

export interface ConditionNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  nodeData?: any;
  onSave: (data: any) => void;
}

interface Condition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export function ConditionNodeConfig({ isOpen, onClose, nodeData, onSave }: ConditionNodeConfigProps) {
  const [nodeName, setNodeName] = useState(nodeData?.name || "Condition");
  const [description, setDescription] = useState(nodeData?.description || "");
  const [enabled, setEnabled] = useState(nodeData?.enabled !== false);
  const [conditionType, setConditionType] = useState(nodeData?.conditionType || "simple");
  const [conditions, setConditions] = useState<Condition[]>(nodeData?.conditions || [
    { id: "1", field: "", operator: "", value: "" }
  ]);
  const [multipleConditionLogic, setMultipleConditionLogic] = useState(nodeData?.multipleConditionLogic || "and");
  const [fallbackEnabled, setFallbackEnabled] = useState(nodeData?.fallbackEnabled || false);
  const [fallbackBehavior, setFallbackBehavior] = useState(nodeData?.fallbackBehavior || "stop-run");

  const matchedRecords = 142;

  const conditionFields = [
    "Company Tier",
    "Project Phase",
    "Support Volume",
    "Linked Event",
    "Linked CSE Ticket",
    "Unresolved Issue",
    "Recent Inquiry",
    "Recent Outbound",
    "Owner Team",
    "Audience Size",
    "Region",
    "Language",
    "Risk Level",
    "Send Policy Eligible",
    "Active Project Count",
    "Last Contact Date",
    "Product Usage",
  ];

  const operators = [
    "Equals",
    "Not Equals",
    "Contains",
    "Not Contains",
    "Greater Than",
    "Less Than",
    "Greater Than or Equal",
    "Less Than or Equal",
    "Exists",
    "Not Exists",
    "In",
    "Not In",
    "Is Empty",
    "Is Not Empty",
  ];

  const getValidationStatus = () => {
    const hasEmptyCondition = conditions.some(c => !c.field || !c.operator);
    if (hasEmptyCondition) return "error";
    if (matchedRecords === 0) return "warning";
    if (!fallbackEnabled) return "warning";
    return "valid";
  };

  const addCondition = () => {
    setConditions([...conditions, { id: Date.now().toString(), field: "", operator: "", value: "" }]);
  };

  const removeCondition = (id: string) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter(c => c.id !== id));
    }
  };

  const updateCondition = (id: string, key: keyof Condition, value: string) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, [key]: value } : c));
  };

  const handleSave = () => {
    onSave({
      name: nodeName,
      description,
      enabled,
      conditionType,
      conditions,
      multipleConditionLogic,
      fallbackEnabled,
      fallbackBehavior,
    });
    onClose();
  };

  return (
    <NodeConfigSheet
      isOpen={isOpen}
      onClose={onClose}
      nodeType="Condition"
      nodeName={nodeName}
      validationStatus={getValidationStatus()}
      lastEdited="2026-03-17 14:30"
      onSave={handleSave}
      onTest={() => console.log("Test condition")}
      onDelete={() => console.log("Delete condition")}
      onDuplicate={() => console.log("Duplicate condition")}
    >
      <ConfigSection title="Basic Settings" icon={<Settings className="w-4 h-4 text-slate-600" />}>
        <ConfigField label="Node Name" required>
          <Input value={nodeName} onChange={(e) => setNodeName(e.target.value)} placeholder="例: Enterprise tier のみ" />
        </ConfigField>
        <ConfigField label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例: EnterpriseとPremiumプランのみ対象" rows={2} />
        </ConfigField>
        <ConfigField label="Enabled">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm text-slate-600">ノードを有効化</span>
          </div>
        </ConfigField>
      </ConfigSection>

      <ConfigSection title="Configuration" icon={<Filter className="w-4 h-4 text-blue-600" />}>
        <ConfigField label="Condition Type" required>
          <select value={conditionType} onChange={(e) => setConditionType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="simple">Simple Condition</option>
            <option value="multiple">Multiple Conditions</option>
            <option value="custom">Custom Expression</option>
          </select>
        </ConfigField>

        <ConfigField label="Conditions" required description="フィルター条件を設定">
          <div className="space-y-3">
            {conditions.map((condition, index) => (
              <div key={condition.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-700">Condition {index + 1}</span>
                  {conditions.length > 1 && (
                    <button
                      onClick={() => removeCondition(condition.id)}
                      className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      削除
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <select
                    value={condition.field}
                    onChange={(e) => updateCondition(condition.id, "field", e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                  >
                    <option value="">Field を選択</option>
                    {conditionFields.map((field) => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>
                  <select
                    value={condition.operator}
                    onChange={(e) => updateCondition(condition.id, "operator", e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                  >
                    <option value="">Operator を選択</option>
                    {operators.map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Value"
                    value={condition.value}
                    onChange={(e) => updateCondition(condition.id, "value", e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={addCondition}>
              <Plus className="w-3 h-3 mr-1" />
              条件を追加
            </Button>
          </div>
        </ConfigField>

        {conditionType === "multiple" && conditions.length > 1 && (
          <ConfigField label="Logic Type" description="複数条件の論理演算">
            <select value={multipleConditionLogic} onChange={(e) => setMultipleConditionLogic(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
              <option value="and">AND（全ての条件を満たす）</option>
              <option value="or">OR（いずれかの条件を満たす）</option>
              <option value="custom">Custom（カスタムロジック）</option>
            </select>
          </ConfigField>
        )}

        <ConfigField label="Fallback Path" warning={!fallbackEnabled ? "Fallback Pathの設定を推奨します" : undefined}>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={fallbackEnabled} onChange={(e) => setFallbackEnabled(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm text-slate-600">条件不一致時の代替パスを有効化</span>
            </div>
            {fallbackEnabled && (
              <div className="ml-6">
                <select value={fallbackBehavior} onChange={(e) => setFallbackBehavior(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
                  <option value="stop-run">Stop Run（実行停止）</option>
                  <option value="continue-default">Continue to Default Branch（デフォルトブランチへ）</option>
                  <option value="skip-to-end">Skip to End（Endへスキップ）</option>
                  <option value="move-to-draft">Move to Draft（Draftへ）</option>
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
                <p className="text-sm font-medium text-purple-900">Condition Suggestion</p>
                <p className="text-xs text-purple-700 mt-1">
                  このTriggerでは 'Company Tier = Enterprise' が最も使われています
                </p>
              </div>
            </div>
            <button className="text-xs text-purple-600 hover:text-purple-700 font-medium">この提案を適用</button>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2 mb-2">
              <Filter className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">Branch Suggestion</p>
                <p className="text-xs text-blue-700 mt-1">
                  Audience Size &gt; 100 の場合、Review Before Send が推奨されます
                </p>
              </div>
            </div>
          </div>
        </div>
      </ConfigSection>

      <ConfigSection title="Preview & Validation" icon={<BarChart3 className="w-4 h-4 text-slate-600" />}>
        <div className="space-y-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-700">Matched Records</span>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {matchedRecords} companies
              </Badge>
            </div>
            <p className="text-xs text-slate-600">現在の条件で {matchedRecords} 件が合致</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-xs font-medium text-slate-700 block mb-2">Estimated Audience</span>
            <p className="text-xs text-slate-600">推定Audience: 約 280 contacts</p>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <span className="text-xs font-medium text-slate-700 block mb-2">Recent Examples</span>
            <div className="text-xs text-slate-600 space-y-1">
              <p>最近の合致例:</p>
              <ul className="list-disc list-inside ml-2 text-slate-500">
                <li>ABC Corp</li>
                <li>XYZ Inc</li>
                <li>DEF Ltd</li>
              </ul>
            </div>
          </div>

          {conditions.some(c => !c.field || !c.operator) && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <X className="w-4 h-4 text-red-600 mt-0.5" />
              <p className="text-xs text-red-700">全ての条件でFieldとOperatorを設定してください</p>
            </div>
          )}

          {matchedRecords === 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <X className="w-4 h-4 text-amber-600 mt-0.5" />
              <p className="text-xs text-amber-700">合致するレコードが0件です。条件を見直してください。</p>
            </div>
          )}
        </div>
      </ConfigSection>
    </NodeConfigSheet>
  );
}