import { useState } from "react";
import { NodeConfigSheet, ConfigSection, ConfigField } from "./node-config-sheet";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Users, Settings, Sparkles, BarChart3, Filter, Eye } from "lucide-react";
import { Button } from "../ui/button";

export interface AudienceNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  nodeData?: any;
  onSave: (data: any) => void;
}

export function AudienceNodeConfig({ isOpen, onClose, nodeData, onSave }: AudienceNodeConfigProps) {
  const [nodeName, setNodeName] = useState(nodeData?.name || "Audience");
  const [description, setDescription] = useState(nodeData?.description || "");
  const [enabled, setEnabled] = useState(nodeData?.enabled !== false);
  const [audienceMode, setAudienceMode] = useState(nodeData?.audienceMode || "");
  const [audienceName, setAudienceName] = useState(nodeData?.audienceName || "");
  const [audienceScope, setAudienceScope] = useState(nodeData?.audienceScope || "contacts");
  const [saveAsAsset, setSaveAsAsset] = useState(nodeData?.saveAsAsset !== false);
  const [excludeRecentlyContacted, setExcludeRecentlyContacted] = useState(
    nodeData?.excludeRecentlyContacted || false
  );

  const targetCount = 342;

  const getValidationStatus = () => {
    if (!audienceMode) return "error";
    if (audienceMode === "create-new" && !audienceName) return "error";
    if (targetCount === 0) return "warning";
    return "valid";
  };

  const handleSave = () => {
    onSave({
      name: nodeName,
      description,
      enabled,
      audienceMode,
      audienceName,
      audienceScope,
      saveAsAsset,
      excludeRecentlyContacted,
    });
    onClose();
  };

  return (
    <NodeConfigSheet
      isOpen={isOpen}
      onClose={onClose}
      nodeType="Audience"
      nodeName={nodeName}
      validationStatus={getValidationStatus()}
      lastEdited="2026-03-17 14:30"
      onSave={handleSave}
      onTest={() => console.log("Test audience")}
      onDelete={() => console.log("Delete audience")}
      onDuplicate={() => console.log("Duplicate audience")}
    >
      {/* Basic Settings */}
      <ConfigSection title="Basic Settings" icon={<Settings className="w-4 h-4 text-slate-600" />}>
        <ConfigField label="Node Name" required>
          <Input
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
            placeholder="例: Enterprise ウェビナー参加者"
          />
        </ConfigField>

        <ConfigField label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例: ウェビナー登録済みのEnterprise顧客"
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
      <ConfigSection title="Configuration" icon={<Users className="w-4 h-4 text-blue-600" />}>
        <ConfigField
          label="Audience Mode"
          required
          error={!audienceMode ? "Audience Mode を選択してください" : undefined}
        >
          <select
            value={audienceMode}
            onChange={(e) => setAudienceMode(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
          >
            <option value="">選択してください</option>
            <option value="use-existing">Use Existing Audience</option>
            <option value="create-new">Create New Audience</option>
            <option value="update-existing">Update Existing Audience</option>
            <option value="dynamic">Dynamic Audience</option>
          </select>
        </ConfigField>

        {audienceMode === "use-existing" && (
          <ConfigField label="Select Audience" required>
            <select className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
              <option value="">選択してください</option>
              <option value="aud-1">Enterprise Active Users</option>
              <option value="aud-2">Premium Trial Users</option>
              <option value="aud-3">Webinar Attendees Q1</option>
            </select>
          </ConfigField>
        )}

        {(audienceMode === "create-new" || audienceMode === "dynamic") && (
          <>
            <ConfigField
              label="Audience Name"
              required
              error={!audienceName ? "Audience Name を入力してください" : undefined}
            >
              <Input
                value={audienceName}
                onChange={(e) => setAudienceName(e.target.value)}
                placeholder="例: ウェビナー参加者 2026-Q2"
              />
            </ConfigField>

            <ConfigField label="Audience Scope">
              <select
                value={audienceScope}
                onChange={(e) => setAudienceScope(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              >
                <option value="companies">Companies（企業単位）</option>
                <option value="contacts">Contacts（担当者単位）</option>
                <option value="projects">Projects（プロジェクト単位）</option>
                <option value="mixed">Mixed（混合）</option>
              </select>
            </ConfigField>

            <ConfigField label="Filters" description="フィルター条件を設定">
              <div className="space-y-2">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-700">Filter 1</span>
                    <button className="text-xs text-red-600 hover:text-red-700">削除</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select className="px-2 py-1 border border-slate-300 rounded text-xs">
                      <option>Company Tier</option>
                      <option>Project Phase</option>
                      <option>Risk Level</option>
                    </select>
                    <select className="px-2 py-1 border border-slate-300 rounded text-xs">
                      <option>Equals</option>
                      <option>Not Equals</option>
                      <option>Contains</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Value"
                      className="px-2 py-1 border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full text-xs h-7">
                  + フィルターを追加
                </Button>
              </div>
            </ConfigField>
          </>
        )}

        <ConfigField label="Exclude Recently Contacted">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={excludeRecentlyContacted}
                onChange={(e) => setExcludeRecentlyContacted(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-600">最近接触した対象を除外</span>
            </div>
            {excludeRecentlyContacted && (
              <div className="ml-6">
                <select className="px-3 py-2 border border-slate-300 rounded-md text-sm">
                  <option value="7">過去7日</option>
                  <option value="14">過去14日</option>
                  <option value="30">過去30日</option>
                </select>
              </div>
            )}
          </div>
        </ConfigField>

        <ConfigField label="Save as Audience Asset">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={saveAsAsset}
              onChange={(e) => setSaveAsAsset(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-slate-600">Audience画面に保存</span>
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
                <p className="text-sm font-medium text-purple-900">Audience Suggestion</p>
                <p className="text-xs text-purple-700 mt-1">
                  このTriggerでは 'Enterprise tier + Active projects' が最も使われています
                </p>
              </div>
            </div>
            <button className="text-xs text-purple-600 hover:text-purple-700 font-medium">
              この提案を適用
            </button>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2 mb-2">
              <Filter className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">Filter Suggestion</p>
                <p className="text-xs text-blue-700 mt-1">
                  最近接触した対象の除外を推奨します（過去7日）
                </p>
              </div>
            </div>
            <button
              onClick={() => setExcludeRecentlyContacted(true)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              この提案を適用
            </button>
          </div>
        </div>
      </ConfigSection>

      {/* Preview & Validation */}
      <ConfigSection title="Preview & Validation" icon={<BarChart3 className="w-4 h-4 text-slate-600" />}>
        <div className="space-y-3">
          {/* Target Count */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-700">Target Count</span>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {targetCount} contacts
              </Badge>
            </div>
            <p className="text-xs text-slate-600">from 156 companies</p>
          </div>

          {/* Audience Preview */}
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-medium text-slate-700">Audience Preview</span>
            </div>
            <div className="space-y-2">
              <div className="text-xs">
                <div className="grid grid-cols-4 gap-2 pb-2 border-b border-slate-200 font-medium text-slate-700">
                  <span>Company</span>
                  <span>Contact</span>
                  <span>Tier</span>
                  <span>Last Contact</span>
                </div>
                {[
                  { company: "ABC Corp", contact: "田中太郎", tier: "Enterprise", lastContact: "2026-03-10" },
                  { company: "XYZ Inc", contact: "佐藤花子", tier: "Premium", lastContact: "2026-03-12" },
                  { company: "DEF Ltd", contact: "鈴木一郎", tier: "Enterprise", lastContact: "2026-03-15" },
                ].map((row, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 py-2 border-b border-slate-100 text-slate-700">
                    <span>{row.company}</span>
                    <span>{row.contact}</span>
                    <span>{row.tier}</span>
                    <span>{row.lastContact}</span>
                  </div>
                ))}
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-2 text-xs h-7">
              全件を見る（{targetCount}件）
            </Button>
          </div>

          {/* Related Summary */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-xs font-medium text-slate-700 block mb-2">Related Summary</span>
            <div className="space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Company Tier:</span>
                <span>Enterprise: 45%, Premium: 30%, Standard: 25%</span>
              </div>
              <div className="flex justify-between">
                <span>Region:</span>
                <span>APAC: 60%, NA: 25%, EU: 15%</span>
              </div>
              <div className="flex justify-between">
                <span>Risk Level:</span>
                <span>High: 10, Medium: 80, Low: 52</span>
              </div>
            </div>
          </div>
        </div>
      </ConfigSection>
    </NodeConfigSheet>
  );
}