import { useState } from "react";
import { useNavigate } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  ArrowLeft,
  Save,
  Play,
  Plus,
  Sparkles,
  Zap,
  Filter,
  Users,
  FileText,
  Send,
  CheckSquare,
  Clock,
  GitBranch,
  Circle,
  ArrowDown,
  Settings,
  AlertTriangle,
  Eye,
  FilePenLine,
  Mail,
  MessageSquare,
  Target,
  Bell
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { TriggerNodeConfig } from "../components/automation/trigger-node-config";
import { SendNodeConfig } from "../components/automation/send-node-config";
import { AudienceNodeConfig } from "../components/automation/audience-node-config";
import { ContentNodeConfig } from "../components/automation/content-node-config";
import { WaitNodeConfig } from "../components/automation/wait-node-config";
import { BranchNodeConfig } from "../components/automation/branch-node-config";
import { EndNodeConfig } from "../components/automation/end-node-config";
import { ConditionNodeConfig } from "../components/automation/condition-node-config";
import { OutboundNodeConfig } from "../components/automation/outbound-node-config";
import { ActionNodeConfig } from "../components/automation/action-node-config";

type NodeType = 
  | "trigger" 
  | "condition" 
  | "audience" 
  | "content" 
  | "outbound" 
  | "send" 
  | "action" 
  | "wait" 
  | "branch" 
  | "end";

interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  config?: any;
  branches?: FlowNode[][];
}

const initialFlow: FlowNode[] = [
  {
    id: "trigger-1",
    type: "trigger",
    label: "Event started",
    config: {
      eventType: "webinar",
      filters: ["status = scheduled"],
    },
  },
];

export function AutomationBuilder() {
  const navigate = useNavigate();
  const [automationName, setAutomationName] = useState("New Automation");
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>(initialFlow);
  const [showAddNodeDialog, setShowAddNodeDialog] = useState(false);
  const [showAISuggestion, setShowAISuggestion] = useState(false);
  const [selectedNodeType, setSelectedNodeType] = useState<NodeType | null>(null);
  const [editingNode, setEditingNode] = useState<FlowNode | null>(null);

  // Node config states for each type
  const [showTriggerConfig, setShowTriggerConfig] = useState(false);
  const [showSendConfig, setShowSendConfig] = useState(false);
  const [showAudienceConfig, setShowAudienceConfig] = useState(false);
  const [showContentConfig, setShowContentConfig] = useState(false);
  const [showWaitConfig, setShowWaitConfig] = useState(false);
  const [showBranchConfig, setShowBranchConfig] = useState(false);
  const [showEndConfig, setShowEndConfig] = useState(false);
  const [showConditionConfig, setShowConditionConfig] = useState(false);
  const [showOutboundConfig, setShowOutboundConfig] = useState(false);
  const [showActionConfig, setShowActionConfig] = useState(false);

  const openNodeConfig = (node: FlowNode) => {
    setEditingNode(node);
    switch (node.type) {
      case "trigger":
        setShowTriggerConfig(true);
        break;
      case "send":
        setShowSendConfig(true);
        break;
      case "audience":
        setShowAudienceConfig(true);
        break;
      case "content":
        setShowContentConfig(true);
        break;
      case "wait":
        setShowWaitConfig(true);
        break;
      case "branch":
        setShowBranchConfig(true);
        break;
      case "end":
        setShowEndConfig(true);
        break;
      case "condition":
        setShowConditionConfig(true);
        break;
      case "outbound":
        setShowOutboundConfig(true);
        break;
      case "action":
        setShowActionConfig(true);
        break;
      default:
        break;
    }
  };

  const handleNodeSave = (nodeId: string, data: any) => {
    setFlowNodes(flowNodes.map(node => 
      node.id === nodeId ? { ...node, config: data, label: data.name || node.label } : node
    ));
  };

  const getNodeIcon = (type: NodeType) => {
    switch (type) {
      case "trigger":
        return <Zap className="w-5 h-5" />;
      case "condition":
        return <Filter className="w-5 h-5" />;
      case "audience":
        return <Users className="w-5 h-5" />;
      case "content":
        return <FileText className="w-5 h-5" />;
      case "outbound":
        return <Mail className="w-5 h-5" />;
      case "send":
        return <Send className="w-5 h-5" />;
      case "action":
        return <CheckSquare className="w-5 h-5" />;
      case "wait":
        return <Clock className="w-5 h-5" />;
      case "branch":
        return <GitBranch className="w-5 h-5" />;
      case "end":
        return <Circle className="w-5 h-5" />;
      default:
        return <Circle className="w-5 h-5" />;
    }
  };

  const getNodeColor = (type: NodeType) => {
    switch (type) {
      case "trigger":
        return "bg-purple-100 text-purple-700 border-purple-300";
      case "condition":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "audience":
        return "bg-green-100 text-green-700 border-green-300";
      case "content":
        return "bg-amber-100 text-amber-700 border-amber-300";
      case "outbound":
        return "bg-indigo-100 text-indigo-700 border-indigo-300";
      case "send":
        return "bg-pink-100 text-pink-700 border-pink-300";
      case "action":
        return "bg-teal-100 text-teal-700 border-teal-300";
      case "wait":
        return "bg-slate-100 text-slate-700 border-slate-300";
      case "branch":
        return "bg-orange-100 text-orange-700 border-orange-300";
      case "end":
        return "bg-slate-200 text-slate-600 border-slate-400";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  const addNode = (type: NodeType) => {
    const newNode: FlowNode = {
      id: `${type}-${Date.now()}`,
      type,
      label: getDefaultLabel(type),
      config: {},
    };
    setFlowNodes([...flowNodes, newNode]);
    setShowAddNodeDialog(false);
    setEditingNode(newNode);
    openNodeConfig(newNode);
  };

  const getDefaultLabel = (type: NodeType): string => {
    switch (type) {
      case "trigger":
        return "Trigger";
      case "condition":
        return "Check Condition";
      case "audience":
        return "Build Audience";
      case "content":
        return "Generate Content";
      case "outbound":
        return "Create Outbound";
      case "send":
        return "Send Message";
      case "action":
        return "Create Action";
      case "wait":
        return "Wait";
      case "branch":
        return "Branch";
      case "end":
        return "End";
      default:
        return "Node";
    }
  };

  const NodeCard = ({ node, index }: { node: FlowNode; index: number }) => (
    <div className="flex flex-col items-center">
      <div
        className={`w-72 p-4 rounded-lg border-2 ${getNodeColor(node.type)} cursor-pointer hover:shadow-lg transition-shadow`}
        onClick={() => openNodeConfig(node)}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {getNodeIcon(node.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold mb-1">{node.type.toUpperCase()}</div>
            <div className="text-sm font-medium mb-2">{node.label}</div>
            {node.config && Object.keys(node.config).length > 0 && (
              <div className="text-xs opacity-75">
                {JSON.stringify(node.config).substring(0, 50)}...
              </div>
            )}
          </div>
          <Settings className="w-4 h-4 opacity-50" />
        </div>
      </div>
      {index < flowNodes.length - 1 && (
        <div className="flex items-center justify-center py-3">
          <ArrowDown className="w-5 h-5 text-slate-400" />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col">
        <GlobalHeader />
        
        {/* Page Header */}
        <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/automation")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <Input
                value={automationName}
                onChange={(e) => setAutomationName(e.target.value)}
                className="text-lg font-bold border-none px-0 focus-visible:ring-0"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Save className="w-4 h-4 mr-2" />
              下書き保存
            </Button>
            <Button variant="outline" size="sm">
              <Play className="w-4 h-4 mr-2" />
              テスト実行
            </Button>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
              <Save className="w-4 h-4 mr-2" />
              保存して有効化
            </Button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="px-6 py-3 bg-purple-50 border-b border-purple-200">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-purple-900 mb-1">
                Flow Builder のヒント
              </div>
              <div className="text-xs text-purple-800">
                Trigger から始めて、Condition → Audience → Content → Outbound → Send → Action → Wait → Branch を組み合わせてフローを構築します。各ノードをクリックして詳細設定を行ってください。Send ノードでは auto send / review before send / draft only を選択でき、policyとroleに基づいて制御されます。
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-1">
          {/* Left Panel - Node Palette */}
          <div className="w-64 bg-white border-r p-4 overflow-y-auto">
            <div className="text-sm font-semibold text-slate-900 mb-4">ノードを追加</div>
            <div className="space-y-2">
              {[
                { type: "trigger" as NodeType, label: "Trigger", desc: "フロー開始条件" },
                { type: "condition" as NodeType, label: "Condition", desc: "条件分岐" },
                { type: "audience" as NodeType, label: "Audience", desc: "対象者抽出" },
                { type: "content" as NodeType, label: "Content", desc: "コンテンツ生成" },
                { type: "outbound" as NodeType, label: "Outbound", desc: "Outbound起票" },
                { type: "send" as NodeType, label: "Send", desc: "送信実行" },
                { type: "action" as NodeType, label: "Action", desc: "Action作成" },
                { type: "wait" as NodeType, label: "Wait", desc: "待機" },
                { type: "branch" as NodeType, label: "Branch", desc: "分岐" },
                { type: "end" as NodeType, label: "End", desc: "終了" },
              ].map((nodeType) => (
                <button
                  key={nodeType.type}
                  onClick={() => addNode(nodeType.type)}
                  className={`w-full text-left p-3 rounded-lg border-2 ${getNodeColor(nodeType.type)} hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {getNodeIcon(nodeType.type)}
                    <span className="text-sm font-semibold">{nodeType.label}</span>
                  </div>
                  <div className="text-xs opacity-75">{nodeType.desc}</div>
                </button>
              ))}
            </div>

            <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-800">
                  <div className="font-semibold mb-1">Send ノードについて</div>
                  <div>Auto send は policy と role で制御されます。高リスク / 大規模配信は制限されます。</div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Canvas */}
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <div className="text-sm font-semibold text-slate-900 mb-2">Automation Flow</div>
                <div className="text-xs text-slate-600">
                  ノードをクリックして設定を編集 / 下のボタンから新しいノードを追加
                </div>
              </div>

              {/* Flow Visualization */}
              <div className="space-y-0">
                {flowNodes.map((node, index) => (
                  <NodeCard key={node.id} node={node} index={index} />
                ))}

                {/* Add Node Button */}
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setShowAddNodeDialog(true)}
                    className="border-dashed border-2 hover:bg-purple-50 hover:border-purple-300"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    ノードを追加
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Summary */}
          <div className="w-80 bg-white border-l p-4 min-h-screen">
            <div className="text-sm font-semibold text-slate-900 mb-4">Flow Summary</div>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-slate-600 mb-1">Total Steps</div>
                <div className="text-2xl font-bold text-slate-900">{flowNodes.length}</div>
              </div>
              <div>
                <div className="text-xs text-slate-600 mb-2">Node Types</div>
                <div className="space-y-1">
                  {["trigger", "condition", "audience", "content", "outbound", "send", "action", "wait"].map((type) => {
                    const count = flowNodes.filter((n) => n.type === type).length;
                    if (count === 0) return null;
                    return (
                      <div key={type} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 capitalize">{type}</span>
                        <Badge variant="outline" className="text-xs">{count}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="pt-4 border-t">
                <div className="text-xs text-slate-600 mb-2">Send Mode</div>
                <div className="flex flex-col gap-2">
                  <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 justify-start">
                    <FilePenLine className="w-3 h-3 mr-2" />
                    Draft Only
                  </Badge>
                </div>
              </div>
              <div className="pt-4 border-t">
                <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAISuggestion(true)}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Flow Suggestion
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Node Config Sheets - Using custom Sheet components */}
        <TriggerNodeConfig
          isOpen={showTriggerConfig}
          onClose={() => setShowTriggerConfig(false)}
          nodeData={editingNode?.config}
          onSave={(data) => {
            if (editingNode) {
              handleNodeSave(editingNode.id, data);
            }
            setShowTriggerConfig(false);
          }}
        />

        <SendNodeConfig
          isOpen={showSendConfig}
          onClose={() => setShowSendConfig(false)}
          nodeData={editingNode?.config}
          onSave={(data) => {
            if (editingNode) {
              handleNodeSave(editingNode.id, data);
            }
            setShowSendConfig(false);
          }}
        />

        <AudienceNodeConfig
          isOpen={showAudienceConfig}
          onClose={() => setShowAudienceConfig(false)}
          nodeData={editingNode?.config}
          onSave={(data) => {
            if (editingNode) {
              handleNodeSave(editingNode.id, data);
            }
            setShowAudienceConfig(false);
          }}
        />

        <ContentNodeConfig
          isOpen={showContentConfig}
          onClose={() => setShowContentConfig(false)}
          nodeData={editingNode?.config}
          onSave={(data) => {
            if (editingNode) {
              handleNodeSave(editingNode.id, data);
            }
            setShowContentConfig(false);
          }}
        />

        <WaitNodeConfig
          isOpen={showWaitConfig}
          onClose={() => setShowWaitConfig(false)}
          nodeData={editingNode?.config}
          onSave={(data) => {
            if (editingNode) {
              handleNodeSave(editingNode.id, data);
            }
            setShowWaitConfig(false);
          }}
        />

        <BranchNodeConfig
          isOpen={showBranchConfig}
          onClose={() => setShowBranchConfig(false)}
          nodeData={editingNode?.config}
          onSave={(data) => {
            if (editingNode) {
              handleNodeSave(editingNode.id, data);
            }
            setShowBranchConfig(false);
          }}
        />

        <EndNodeConfig
          isOpen={showEndConfig}
          onClose={() => setShowEndConfig(false)}
          nodeData={editingNode?.config}
          onSave={(data) => {
            if (editingNode) {
              handleNodeSave(editingNode.id, data);
            }
            setShowEndConfig(false);
          }}
        />

        <ConditionNodeConfig
          isOpen={showConditionConfig}
          onClose={() => setShowConditionConfig(false)}
          nodeData={editingNode?.config}
          onSave={(data) => {
            if (editingNode) {
              handleNodeSave(editingNode.id, data);
            }
            setShowConditionConfig(false);
          }}
        />

        <OutboundNodeConfig
          isOpen={showOutboundConfig}
          onClose={() => setShowOutboundConfig(false)}
          nodeData={editingNode?.config}
          onSave={(data) => {
            if (editingNode) {
              handleNodeSave(editingNode.id, data);
            }
            setShowOutboundConfig(false);
          }}
        />

        <ActionNodeConfig
          isOpen={showActionConfig}
          onClose={() => setShowActionConfig(false)}
          nodeData={editingNode?.config}
          onSave={(data) => {
            if (editingNode) {
              handleNodeSave(editingNode.id, data);
            }
            setShowActionConfig(false);
          }}
        />

        {/* AI Suggestion Dialog */}
        <Dialog open={showAISuggestion} onOpenChange={setShowAISuggestion}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  AI Flow Suggestion
                </div>
              </DialogTitle>
              <DialogDescription>
                AIがこのフローに最適な次のステップを提案します
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-sm font-semibold text-purple-900 mb-2">推奨フロー</div>
                <div className="text-sm text-purple-800 mb-3">
                  Event started トリガーの場合、以下のフローが推奨されます：
                </div>
                <div className="space-y-2">
                  {[
                    { step: 1, node: "Condition", desc: "Company tier をチェック（Premium以上）" },
                    { step: 2, node: "Audience", desc: "対象Audienceを抽出（Active phase）" },
                    { step: 3, node: "Content", desc: "Event案内コンテンツを生成" },
                    { step: 4, node: "Send", desc: "Email送信（Review before send）" },
                    { step: 5, node: "Wait", desc: "3日間待機" },
                    { step: 6, node: "Branch", desc: "参加登録の有無で分岐" },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-2 text-xs">
                      <Badge variant="outline" className="bg-white text-purple-700 border-purple-200">
                        {item.step}
                      </Badge>
                      <div>
                        <span className="font-semibold">{item.node}</span>: {item.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm font-semibold text-blue-900 mb-2">Send Mode の推奨</div>
                <div className="text-sm text-blue-800">
                  このフローは <strong>Review Before Send</strong> が適切です。理由：Event案内は重要度が高く、Premium顧客が対象のため、送信前に内容を確認することを推奨します。
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAISuggestion(false)}>
                閉じる
              </Button>
              <Button onClick={() => setShowAISuggestion(false)}>
                この提案を適用
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}