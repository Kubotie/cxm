import { useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { 
  AlertTriangle, 
  TrendingUp, 
  ExternalLink, 
  Sparkles, 
  Eye, 
  UserPlus,
  Target,
  MessageSquare,
  Mail,
  FileText,
  Ticket
} from "lucide-react";
import { AlertCard } from "../cards/alert-card";

interface SignalsEvidenceTimelineProps {
  onGenerateInsight: () => void;
}

export function SignalsEvidenceTimeline({ onGenerateInsight }: SignalsEvidenceTimelineProps) {
  const [selectedEvidence, setSelectedEvidence] = useState<string | null>(null);

  // Mock alerts
  const alerts = [
    {
      id: "alert_1",
      type: "risk" as const,
      severity: "high" as const,
      title: "アクティブユーザー数が急減",
      description: "過去7日間でアクティブユーザーが40%減少しています",
      evidenceCount: 5,
      timestamp: "2時間前",
    },
    {
      id: "alert_2",
      type: "opportunity" as const,
      severity: "medium" as const,
      title: "新機能の利用率が向上",
      description: "Champion Layerで新機能の採用が進んでいます",
      evidenceCount: 3,
      timestamp: "5時間前",
    },
  ];

  // Mock evidence timeline
  const evidenceTimeline = [
    {
      id: "ev_1",
      source_type: "Slack",
      message_type: "Message",
      timestamp: "2024-03-12 14:30",
      owner_name: "田中太郎",
      owner_role: "Champion",
      status: "unresolved",
      summary: "新機能のUIが分かりづらいとの報告",
      evidence_refs: ["slack_msg_001"],
      scope: "User",
    },
    {
      id: "ev_2",
      source_type: "Intercom",
      message_type: "Inquiry",
      timestamp: "2024-03-12 13:15",
      owner_name: "佐藤花子",
      owner_role: "User",
      status: "unresolved",
      summary: "データエクスポート機能の使い方について質問",
      evidence_refs: ["intercom_conv_045"],
      scope: "User",
    },
    {
      id: "ev_3",
      source_type: "Product Usage",
      message_type: "Event",
      timestamp: "2024-03-12 11:00",
      owner_name: "System",
      owner_role: "-",
      status: "resolved",
      summary: "キャンペーン作成数が通常の3倍に増加",
      evidence_refs: ["usage_event_789"],
      scope: "Project",
    },
    {
      id: "ev_4",
      source_type: "CSE Ticket",
      message_type: "Ticket",
      timestamp: "2024-03-12 09:45",
      owner_name: "鈴木一郎",
      owner_role: "Champion",
      status: "unresolved",
      summary: "API連携のエラーが頻発している",
      evidence_refs: ["ticket_234", "ticket_235"],
      scope: "Project",
    },
    {
      id: "ev_5",
      source_type: "Minutes",
      message_type: "Meeting",
      timestamp: "2024-03-11 16:00",
      owner_name: "田中太郎",
      owner_role: "Champion",
      status: "resolved",
      summary: "次四半期の展開計画についてディスカッション",
      evidence_refs: ["meeting_note_012"],
      scope: "Company",
    },
  ];

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "Slack": return <MessageSquare className="w-4 h-4" />;
      case "Intercom": return <MessageSquare className="w-4 h-4" />;
      case "Product Usage": return <TrendingUp className="w-4 h-4" />;
      case "CSE Ticket": return <Ticket className="w-4 h-4" />;
      case "Minutes": return <FileText className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getScopeBadgeColor = (scope: string) => {
    switch (scope) {
      case "Company": return "bg-purple-100 text-purple-700";
      case "Project": return "bg-blue-100 text-blue-700";
      case "User": return "bg-emerald-100 text-emerald-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Signals & Alerts</h2>
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            {alerts.length}件
          </Badge>
        </div>

        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} {...alert} />
          ))}
        </div>
      </Card>

      <Card className="p-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Evidence Timeline</h2>
          <Button 
            variant="outline" 
            size="sm"
            onClick={onGenerateInsight}
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            AIでInsight生成
          </Button>
        </div>

        <Tabs defaultValue="all" className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-3 mb-3">
            <TabsTrigger value="all">全て</TabsTrigger>
            <TabsTrigger value="unresolved">未解決</TabsTrigger>
            <TabsTrigger value="resolved">解決済</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="flex-1 mt-0">
            <ScrollArea className="h-[600px]">
              <div className="space-y-3 pr-4">
                {evidenceTimeline.map((evidence) => (
                  <div 
                    key={evidence.id}
                    className={`border rounded-lg p-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                      selectedEvidence === evidence.id ? "ring-2 ring-blue-500 bg-blue-50" : ""
                    }`}
                    onClick={() => setSelectedEvidence(evidence.id)}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <div className="mt-0.5 text-slate-600">
                        {getSourceIcon(evidence.source_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {evidence.source_type}
                          </Badge>
                          <Badge className={`text-xs ${getScopeBadgeColor(evidence.scope)}`}>
                            {evidence.scope}
                          </Badge>
                          {evidence.status === "unresolved" && (
                            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                              未解決
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-slate-900 mb-2">
                          {evidence.summary}
                        </p>

                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          <span>{evidence.owner_name}</span>
                          {evidence.owner_role !== "-" && (
                            <>
                              <span className="text-slate-400">•</span>
                              <span>{evidence.owner_role}</span>
                            </>
                          )}
                          <span className="text-slate-400">•</span>
                          <span>{evidence.timestamp}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-blue-600">Evidence {evidence.evidence_refs.length}件</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" className="text-xs h-7">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        原文
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs h-7">
                        <Eye className="w-3 h-3 mr-1" />
                        レビュー
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs h-7">
                        <UserPlus className="w-3 h-3 mr-1" />
                        User紐付け
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs h-7">
                        <Target className="w-3 h-3 mr-1" />
                        Action作成
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="unresolved" className="flex-1 mt-0">
            <ScrollArea className="h-[600px]">
              <div className="space-y-3 pr-4">
                {evidenceTimeline
                  .filter((e) => e.status === "unresolved")
                  .map((evidence) => (
                    <div key={evidence.id} className="border rounded-lg p-3">
                      <p className="text-sm text-slate-900">{evidence.summary}</p>
                      <p className="text-xs text-slate-600 mt-1">{evidence.timestamp}</p>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="resolved" className="flex-1 mt-0">
            <ScrollArea className="h-[600px]">
              <div className="space-y-3 pr-4">
                {evidenceTimeline
                  .filter((e) => e.status === "resolved")
                  .map((evidence) => (
                    <div key={evidence.id} className="border rounded-lg p-3 opacity-60">
                      <p className="text-sm text-slate-900">{evidence.summary}</p>
                      <p className="text-xs text-slate-600 mt-1">{evidence.timestamp}</p>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
