import { useState } from "react";
import { NodeConfigSheet, ConfigSection, ConfigField } from "./node-config-sheet";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { GitBranch, Settings, Sparkles, BarChart3 } from "lucide-react";
import { Button } from "../ui/button";

export interface BranchNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  nodeData?: any;
  onSave: (data: any) => void;
}

export function BranchNodeConfig({ isOpen, onClose, nodeData, onSave }: BranchNodeConfigProps) {
  const [nodeName, setNodeName] = useState(nodeData?.name || "Branch");
  const [description, setDescription] = useState(nodeData?.description || "");
  const [enabled, setEnabled] = useState(nodeData?.enabled !== false);
  const [branchType, setBranchType] = useState(nodeData?.branchType || "");

  const getValidationStatus = () => {
    if (!branchType) return "error";
    return "valid";
  };

  const handleSave = () => {
    onSave({ name: nodeName, description, enabled, branchType });
    onClose();
  };

  return (
    <NodeConfigSheet isOpen={isOpen} onClose={onClose} nodeType="Branch" nodeName={nodeName} validationStatus={getValidationStatus()} lastEdited="2026-03-17 14:30" onSave={handleSave}>
      <ConfigSection title="Basic Settings" icon={<Settings className="w-4 h-4 text-slate-600" />}>
        <ConfigField label="Node Name" required>
          <Input value={nodeName} onChange={(e) => setNodeName(e.target.value)} placeholder="例: 返信有無で分岐" />
        </ConfigField>
        <ConfigField label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例: 返信があればフォローアップ、なければリマインド" rows={2} />
        </ConfigField>
      </ConfigSection>

      <ConfigSection title="Configuration" icon={<GitBranch className="w-4 h-4 text-indigo-600" />}>
        <ConfigField label="Branch Type" required error={!branchType ? "Branch Type を選択してください" : undefined}>
          <select value={branchType} onChange={(e) => setBranchType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="">選択してください</option>
            <option value="condition-based">Condition Based</option>
            <option value="send-result-based">Send Result Based</option>
            <option value="engagement-based">Engagement Based</option>
            <option value="reply-detected">Reply Detected</option>
            <option value="ab-test">A/B Test</option>
            <option value="random-split">Random Split</option>
          </select>
        </ConfigField>

        {branchType === "reply-detected" && (
          <>
            <ConfigField label="Reply Branch" description="返信ありの場合の分岐先">
              <select className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
                <option value="">次のノードを選択</option>
                <option value="node-1">Follow-up Action Node</option>
                <option value="node-2">Thank You Email Node</option>
              </select>
            </ConfigField>
            <ConfigField label="No Reply Branch" description="返信なしの場合の分岐先">
              <select className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
                <option value="">次のノードを選択</option>
                <option value="node-3">Reminder Email Node</option>
                <option value="node-4">End Node</option>
              </select>
            </ConfigField>
            <ConfigField label="Reply Check Period">
              <div className="flex items-center gap-2">
                <Input type="number" defaultValue="5" className="w-24" />
                <span className="text-sm text-slate-600">days</span>
              </div>
            </ConfigField>
          </>
        )}

        {branchType === "ab-test" && (
          <>
            <ConfigField label="Variant A">
              <div className="space-y-2">
                <Input placeholder="Variant A Name" />
                <div className="flex items-center gap-2">
                  <Input type="number" defaultValue="50" className="w-24" />
                  <span className="text-sm text-slate-600">% Split</span>
                </div>
              </div>
            </ConfigField>
            <ConfigField label="Variant B">
              <div className="space-y-2">
                <Input placeholder="Variant B Name" />
                <div className="flex items-center gap-2">
                  <Input type="number" defaultValue="50" className="w-24" />
                  <span className="text-sm text-slate-600">% Split</span>
                </div>
              </div>
            </ConfigField>
          </>
        )}
      </ConfigSection>

      <ConfigSection title="AI Suggestion" icon={<Sparkles className="w-4 h-4 text-purple-600" />}>
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-start gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-purple-900">Branch Suggestion</p>
              <p className="text-xs text-purple-700 mt-1">Email送信後は 'Reply Detected' ブランチが推奨されます（過去の返信率: 32%）</p>
            </div>
          </div>
          <button onClick={() => setBranchType("reply-detected")} className="text-xs text-purple-600 hover:text-purple-700 font-medium">この提案を適用</button>
        </div>
      </ConfigSection>

      <ConfigSection title="Preview & Validation" icon={<BarChart3 className="w-4 h-4 text-slate-600" />}>
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <span className="text-xs font-medium text-slate-700 block mb-2">Branch Preview</span>
          <div className="space-y-2">
            {branchType === "reply-detected" && (
              <>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">Reply Branch:</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">約 120 contacts (35%)</Badge>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600">No Reply Branch:</span>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">約 222 contacts (65%)</Badge>
                </div>
              </>
            )}
            {!branchType && <p className="text-xs text-slate-500">Branch Type を選択すると予測分布が表示されます</p>}
          </div>
        </div>
      </ConfigSection>
    </NodeConfigSheet>
  );
}