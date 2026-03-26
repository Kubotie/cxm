import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Card } from "../ui/card";
import { 
  Mail, 
  Send, 
  CheckCircle2, 
  Clock, 
  Edit3, 
  MessageSquare, 
  ArrowRight,
  Users,
  FileText,
  Target,
  AlertCircle,
  Eye,
  Play,
  Database
} from "lucide-react";
import { useNavigate } from "react-router";
import { Link } from "react-router";

interface ActionContentSentProps {
  onPush: () => void;
  onSync: () => void;
}

export function ActionContentSent({ 
  onPush, 
  onSync 
}: ActionContentSentProps) {
  
  const navigate = useNavigate();

  // Mock actions
  const actions = [
    {
      action_id: "act_001",
      action_type: "outreach",
      title: "API連携エラー解消の支援提案",
      status: "draft",
      audience_scope: "User",
      audience_id: "user_003",
      resolved_recipients_count: 1,
      unresolved_recipients: 0,
      due_date: "2024-03-15",
      owner: "CSM田中",
      evidence_count: 3,
      content_job_id: "cj_001",
      created_at: "2024-03-12 10:00",
    },
    {
      action_id: "act_002",
      action_type: "content",
      title: "新機能ベータテスト依頼",
      status: "ready",
      audience_scope: "Project",
      audience_id: "proj_abc123",
      resolved_recipients_count: 2,
      unresolved_recipients: 0,
      due_date: "2024-03-14",
      owner: "CSM佐藤",
      evidence_count: 5,
      content_job_id: "cj_002",
      created_at: "2024-03-12 09:00",
    },
    {
      action_id: "act_003",
      action_type: "sent",
      title: "活用事例ヒアリング依頼",
      status: "pushed",
      audience_scope: "User",
      audience_id: "user_002",
      resolved_recipients_count: 1,
      unresolved_recipients: 0,
      due_date: "2024-03-13",
      owner: "CSM田中",
      evidence_count: 2,
      content_job_id: "cj_003",
      created_at: "2024-03-11 16:00",
      pushed_at: "2024-03-12 09:30",
    },
  ];

  // Mock content jobs
  const contentJobs = [
    {
      content_job_id: "cj_001",
      content_type: "message",
      title: "API連携エラー解消支援メッセージ",
      status: "draft",
      channel: "Intercom",
      target_count: 1,
      created_at: "2024-03-12 10:00",
    },
    {
      content_job_id: "cj_002",
      content_type: "message",
      title: "新機能ベータテスト依頼メッセージ",
      status: "ready",
      channel: "Email",
      target_count: 2,
      created_at: "2024-03-12 09:00",
    },
  ];

  // Mock sent actions
  const sentActions = [
    {
      action_id: "act_003",
      title: "活用事例ヒアリング依頼",
      audience_scope: "User",
      resolved_recipients_count: 1,
      channel: "Intercom",
      sent_at: "2024-03-12 09:30",
      synced_to_salesforce: false,
    },
    {
      action_id: "act_004",
      title: "リエンゲージメントメール",
      audience_scope: "User",
      resolved_recipients_count: 1,
      channel: "Email",
      sent_at: "2024-03-11 14:00",
      synced_to_salesforce: true,
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline" className="text-xs bg-slate-100 text-slate-700">下書き</Badge>;
      case "ready":
        return <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">承認待ち</Badge>;
      case "pushed":
        return <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-700">Push済</Badge>;
      case "sent":
        return <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700">送信済</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const getScopeBadge = (scope: string) => {
    const colors = {
      Company: "bg-purple-100 text-purple-700",
      Project: "bg-blue-100 text-blue-700",
      User: "bg-emerald-100 text-emerald-700",
    };
    return <Badge className={`text-xs ${colors[scope as keyof typeof colors] || "bg-slate-100 text-slate-700"}`}>{scope}</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <Tabs defaultValue="actions" className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="actions">Actions</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="sent">Sent</TabsTrigger>
            </TabsList>
            <Button size="sm" onClick={onPush}>
              <Target className="w-4 h-4 mr-1.5" />
              Action作成
            </Button>
          </div>

          {/* Actions Tab */}
          <TabsContent value="actions" className="flex-1 mt-0">
            <ScrollArea className="h-[700px]">
              <div className="space-y-3 pr-4">
                {actions.map((action) => (
                  <div 
                    key={action.action_id}
                    className="border rounded-lg p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-sm font-medium text-slate-900">
                            {action.title}
                          </h3>
                          {getStatusBadge(action.status)}
                          {getScopeBadge(action.audience_scope)}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-2">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3 h-3" />
                            <span>対象: {action.resolved_recipients_count}名</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3 h-3" />
                            <span>Evidence: {action.evidence_count}件</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            <span>期限: {action.due_date}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Target className="w-3 h-3" />
                            <span>{action.owner}</span>
                          </div>
                        </div>

                        {action.unresolved_recipients > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded">
                            <AlertCircle className="w-3 h-3" />
                            <span>未解決の宛先: {action.unresolved_recipients}件</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" className="text-xs h-7">
                        <Eye className="w-3 h-3 mr-1" />
                        詳細
                      </Button>
                      {action.status === "draft" && (
                        <Button variant="outline" size="sm" className="text-xs h-7">
                          承認へ
                        </Button>
                      )}
                      {action.status === "ready" && (
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="text-xs h-7 bg-blue-600 hover:bg-blue-700"
                          onClick={onPush}
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Push実行
                        </Button>
                      )}
                      {action.status === "pushed" && (
                        <>
                          <Link to={`/outbound/compose?fromProject=${action.action_id}&sourceContext=project&actionType=send&linkedAction=${action.action_id}`}>
                            <Button 
                              variant="default" 
                              size="sm" 
                              className="text-xs h-7"
                            >
                              <ArrowRight className="w-3 h-3 mr-1" />
                              Outboundを起票
                            </Button>
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Content Jobs Tab */}
          <TabsContent value="content" className="flex-1 mt-0">
            <ScrollArea className="h-[700px]">
              <div className="space-y-3 pr-4">
                <div className="mb-3">
                  <Button size="sm" variant="outline" className="w-full">
                    <FileText className="w-4 h-4 mr-1.5" />
                    新規Content作成
                  </Button>
                </div>

                {contentJobs.map((job) => (
                  <div 
                    key={job.content_job_id}
                    className="border rounded-lg p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-sm font-medium text-slate-900">
                            {job.title}
                          </h3>
                          {getStatusBadge(job.status)}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-600 mb-2">
                          <div className="flex items-center gap-1.5">
                            <MessageSquare className="w-3 h-3" />
                            <span>{job.channel}</span>
                          </div>
                          <span className="text-slate-400">•</span>
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3 h-3" />
                            <span>{job.target_count}名</span>
                          </div>
                          <span className="text-slate-400">•</span>
                          <span>{job.created_at}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" className="text-xs h-7">
                        <Eye className="w-3 h-3 mr-1" />
                        編集
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs h-7">
                        プレビュー
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Sent Tab */}
          <TabsContent value="sent" className="flex-1 mt-0">
            <ScrollArea className="h-[700px]">
              <div className="space-y-3 pr-4">
                {sentActions.map((action) => (
                  <div 
                    key={action.action_id}
                    className="border rounded-lg p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-sm font-medium text-slate-900">
                            {action.title}
                          </h3>
                          {getScopeBadge(action.audience_scope)}
                          {action.synced_to_salesforce && (
                            <Badge className="text-xs bg-indigo-100 text-indigo-700">
                              <Database className="w-3 h-3 mr-1" />
                              SF同期済
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-600 mb-2">
                          <div className="flex items-center gap-1.5">
                            <MessageSquare className="w-3 h-3" />
                            <span>{action.channel}</span>
                          </div>
                          <span className="text-slate-400">•</span>
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3 h-3" />
                            <span>{action.resolved_recipients_count}名</span>
                          </div>
                          <span className="text-slate-400">•</span>
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{action.sent_at}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm" className="text-xs h-7">
                        <Eye className="w-3 h-3 mr-1" />
                        履歴
                      </Button>
                      {!action.synced_to_salesforce && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs h-7 text-indigo-700 border-indigo-300"
                          onClick={onSync}
                        >
                          <Database className="w-3 h-3 mr-1" />
                          Salesforce同期
                        </Button>
                      )}
                    </div>
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