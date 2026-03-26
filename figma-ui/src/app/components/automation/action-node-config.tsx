import { useState } from "react";
import { NodeConfigSheet, ConfigSection, ConfigField } from "./node-config-sheet";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { CheckSquare, Settings, Sparkles, BarChart3, Calendar, Users } from "lucide-react";

export interface ActionNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  nodeData?: any;
  onSave: (data: any) => void;
}

export function ActionNodeConfig({ isOpen, onClose, nodeData, onSave }: ActionNodeConfigProps) {
  const [nodeName, setNodeName] = useState(nodeData?.name || "Action");
  const [description, setDescription] = useState(nodeData?.description || "");
  const [enabled, setEnabled] = useState(nodeData?.enabled !== false);
  const [actionType, setActionType] = useState(nodeData?.actionType || "");
  const [title, setTitle] = useState(nodeData?.title || "");
  const [purpose, setPurpose] = useState(nodeData?.purpose || "");
  const [priority, setPriority] = useState(nodeData?.priority || "medium");
  const [ownerRule, setOwnerRule] = useState(nodeData?.ownerRule || "");
  const [dueRule, setDueRule] = useState(nodeData?.dueRule || "");
  const [dueDays, setDueDays] = useState(nodeData?.dueDays || "3");
  const [followUpType, setFollowUpType] = useState(nodeData?.followUpType || "");
  const [saveAsAction, setSaveAsAction] = useState(nodeData?.saveAsAction !== false);

  const getValidationStatus = () => {
    if (!actionType || !title || !ownerRule || !dueRule) return "error";
    if (!purpose) return "warning";
    return "valid";
  };

  const handleSave = () => {
    onSave({
      name: nodeName,
      description,
      enabled,
      actionType,
      title,
      purpose,
      priority,
      ownerRule,
      dueRule,
      dueDays,
      followUpType,
      saveAsAction,
    });
    onClose();
  };

  return (
    <NodeConfigSheet
      isOpen={isOpen}
      onClose={onClose}
      nodeType="Action"
      nodeName={nodeName}
      validationStatus={getValidationStatus()}
      lastEdited="2026-03-17 14:30"
      onSave={handleSave}
      onTest={() => console.log("Test action")}
      onDelete={() => console.log("Delete action")}
      onDuplicate={() => console.log("Duplicate action")}
    >
      <ConfigSection title="Basic Settings" icon={<Settings className="w-4 h-4 text-slate-600" />}>
        <ConfigField label="Node Name" required>
          <Input value={nodeName} onChange={(e) => setNodeName(e.target.value)} placeholder="例: フォローアップAction作成" />
        </ConfigField>
        <ConfigField label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例: 送信後2日でフォローアップAction作成" rows={2} />
        </ConfigField>
        <ConfigField label="Enabled">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm text-slate-600">ノードを有効化</span>
          </div>
        </ConfigField>
      </ConfigSection>

      <ConfigSection title="Configuration" icon={<CheckSquare className="w-4 h-4 text-teal-600" />}>
        <ConfigField label="Action Type" required error={!actionType ? "Action Type を選択してください" : undefined}>
          <select value={actionType} onChange={(e) => setActionType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="">選択してください</option>
            <option value="follow-up">Follow-up</option>
            <option value="support-follow-up">Support Follow-up</option>
            <option value="csm-action">CSM Action</option>
            <option value="gtm-action">GTM Action</option>
            <option value="crm-action">CRM Action</option>
            <option value="escalation-follow-up">Escalation Follow-up</option>
            <option value="custom">Custom Action</option>
          </select>
        </ConfigField>

        <ConfigField label="Title Template" required error={!title ? "Title を入力してください" : undefined} description="変数を使用できます: {{company_name}}, {{event_name}}, etc.">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: {{company_name}} - {{event_name}} フォローアップ"
          />
        </ConfigField>

        <ConfigField label="Purpose" warning={!purpose ? "Purpose の入力を推奨します" : undefined}>
          <Textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="例: ウェビナー参加後のフォローアップを行う"
            rows={3}
          />
        </ConfigField>

        <ConfigField label="Priority">
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="high">High（高）</option>
            <option value="medium">Medium（中）</option>
            <option value="low">Low（低）</option>
            <option value="auto">Auto（自動判定）</option>
          </select>
        </ConfigField>

        <ConfigField label="Owner Rule" required error={!ownerRule ? "Owner Rule を選択してください" : undefined}>
          <select value={ownerRule} onChange={(e) => setOwnerRule(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="">選択してください</option>
            <option value="specific-user">Specific User（特定のユーザー）</option>
            <option value="company-owner">From Company Owner（Companyの担当CSM）</option>
            <option value="project-owner">From Project Owner（Projectの担当者）</option>
            <option value="trigger-context">From Trigger Context（Trigger元のコンテキスト）</option>
            <option value="round-robin">Round Robin（ラウンドロビン）</option>
            <option value="auto-by-tier">Auto Assign by Tier（Tierに応じて自動割り当て）</option>
          </select>
        </ConfigField>

        {ownerRule === "specific-user" && (
          <ConfigField label="Select User">
            <select className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
              <option value="">ユーザーを選択</option>
              <option value="user-1">田中太郎（Senior CSM）</option>
              <option value="user-2">佐藤花子（CSM）</option>
              <option value="user-3">鈴木一郎（CSM Lead）</option>
            </select>
          </ConfigField>
        )}

        <ConfigField label="Due Rule" required error={!dueRule ? "Due Rule を選択してください" : undefined}>
          <select value={dueRule} onChange={(e) => setDueRule(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="">選択してください</option>
            <option value="immediately">Immediately（即時）</option>
            <option value="after-wait">After Wait（Wait nodeの後）</option>
            <option value="fixed-days">Fixed Days Later（固定日数後）</option>
            <option value="trigger-date">Based on Trigger Date（Trigger日時基準）</option>
            <option value="event-date">Based on Event Date（Event日時基準）</option>
            <option value="custom">Custom Date（カスタム日付）</option>
          </select>
        </ConfigField>

        {(dueRule === "fixed-days" || dueRule === "trigger-date" || dueRule === "event-date") && (
          <ConfigField label="Days" description="何日後にActionを作成するか">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={dueDays}
                onChange={(e) => setDueDays(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-slate-600">days {dueRule === "event-date" && "before event"}</span>
            </div>
          </ConfigField>
        )}

        <ConfigField label="Due Time" description="期限時刻">
          <Input type="time" defaultValue="17:00" />
        </ConfigField>

        <ConfigField label="Follow-up Type">
          <select value={followUpType} onChange={(e) => setFollowUpType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="">選択してください</option>
            <option value="email">Email Follow-up</option>
            <option value="call">Call Follow-up</option>
            <option value="meeting">Meeting Follow-up</option>
            <option value="in-app">In-app Follow-up</option>
            <option value="custom">Custom</option>
          </select>
        </ConfigField>

        <ConfigField label="Follow-up Content Hint" description="フォローアップ内容のヒント">
          <Textarea
            placeholder="例: ウェビナー参加御礼と次回案内を含める"
            rows={2}
          />
        </ConfigField>

        <ConfigField label="Save as Action">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={saveAsAction} onChange={(e) => setSaveAsAction(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm text-slate-600">Action画面に保存</span>
          </div>
        </ConfigField>
      </ConfigSection>

      <ConfigSection title="AI Suggestion" icon={<Sparkles className="w-4 h-4 text-purple-600" />}>
        <div className="space-y-3">
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-start gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-900">Follow-up Suggestion</p>
                <p className="text-xs text-purple-700 mt-1">
                  このEvent typeでは '参加御礼 + 資料送付 + 個別MTG提案' が効果的です
                </p>
              </div>
            </div>
            <button className="text-xs text-purple-600 hover:text-purple-700 font-medium">この提案を適用</button>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2 mb-2">
              <Calendar className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">Due Date Suggestion</p>
                <p className="text-xs text-blue-700 mt-1">
                  Event終了後2日以内のフォローアップが推奨されます
                </p>
              </div>
            </div>
            <button onClick={() => { setDueRule("fixed-days"); setDueDays("2"); }} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              この提案を適用
            </button>
          </div>

          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-2 mb-2">
              <Users className="w-4 h-4 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">Owner Suggestion</p>
                <p className="text-xs text-green-700 mt-1">
                  このCompanyには 田中CSM が最適です（過去の関係性から）
                </p>
              </div>
            </div>
          </div>
        </div>
      </ConfigSection>

      <ConfigSection title="Preview & Validation" icon={<BarChart3 className="w-4 h-4 text-slate-600" />}>
        <div className="space-y-3">
          {/* Action Preview */}
          <div className="p-4 bg-white border-2 border-slate-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <CheckSquare className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-semibold text-slate-900">Action Preview</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Title:</span>
                <span className="text-slate-900 font-medium">ABC Corp - AI活用セミナー フォローアップ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Type:</span>
                <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">Follow-up</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Priority:</span>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Medium</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Owner:</span>
                <span className="text-slate-900">田中太郎（CSM）</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Due:</span>
                <span className="text-slate-900">2026-04-17 17:00</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200">
              <p className="text-xs text-slate-600 mb-1">Purpose:</p>
              <p className="text-xs text-slate-700">ウェビナー参加後のフォローアップを行う。参加御礼と次回案内を含める。</p>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200">
              <p className="text-xs text-slate-600 mb-1">Linked Resources:</p>
              <ul className="text-xs text-slate-700 space-y-0.5">
                <li>• Company: ABC Corp</li>
                <li>• Event: AI活用セミナー #45</li>
                <li>• Outbound: Email Draft #1234</li>
              </ul>
            </div>
          </div>

          {/* Due Date Preview */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-xs font-medium text-slate-700 block mb-2">Due Date Preview</span>
            <p className="text-xs text-slate-600">
              Due: 2026-04-17 17:00 ({dueRule === "fixed-days" ? `${dueDays} days after trigger` : dueRule})
            </p>
          </div>

          {/* Owner Rule Summary */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-xs font-medium text-slate-700 block mb-2">Owner Rule Summary</span>
            <p className="text-xs text-slate-600">
              {ownerRule === "company-owner" && "From Company Owner → 田中太郎（Senior CSM）"}
              {ownerRule === "auto-by-tier" && "Auto Assign by Tier → Enterprise tier: Senior CSM"}
              {ownerRule === "specific-user" && "Specific User: 選択されたユーザー"}
              {!ownerRule && "未設定"}
            </p>
          </div>
        </div>
      </ConfigSection>
    </NodeConfigSheet>
  );
}