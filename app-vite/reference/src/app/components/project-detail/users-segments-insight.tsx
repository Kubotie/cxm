import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { 
  Users, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Eye,
  Send,
  Target,
  TrendingUp,
  AlertTriangle
} from "lucide-react";

interface UsersSegmentsInsightProps {
  onSelectUsers: () => void;
  onGenerateInsight: () => void;
  selectedUsers: string[];
}

export function UsersSegmentsInsight({ 
  onSelectUsers, 
  onGenerateInsight,
  selectedUsers 
}: UsersSegmentsInsightProps) {
  
  // Mock user data
  const projectUsers = [
    {
      user_id: "user_001",
      user_name: "田中太郎",
      email: "tanaka@sample.co.jp",
      role: "Champion",
      permission: "Admin",
      active: true,
      last_active: "2024-03-12 15:30",
      paid_status: "Paid",
      company_linked: true,
      l7_events: 145,
      segment: "High Engagement Champion",
    },
    {
      user_id: "user_002",
      user_name: "佐藤花子",
      email: "sato@sample.co.jp",
      role: "User",
      permission: "Member",
      active: true,
      last_active: "2024-03-12 14:00",
      paid_status: "Paid",
      company_linked: true,
      l7_events: 67,
      segment: "Active User",
    },
    {
      user_id: "user_003",
      user_name: "鈴木一郎",
      email: "suzuki@sample.co.jp",
      role: "Champion",
      permission: "Admin",
      active: true,
      last_active: "2024-03-12 16:00",
      paid_status: "Paid",
      company_linked: true,
      l7_events: 98,
      segment: "High Engagement Champion",
    },
    {
      user_id: "user_004",
      user_name: "高橋美咲",
      email: "takahashi@sample.co.jp",
      role: "User",
      permission: "Member",
      active: false,
      last_active: "2024-02-28 10:00",
      paid_status: "Paid",
      company_linked: false,
      l7_events: 2,
      segment: "At-Risk User",
    },
    {
      user_id: "user_005",
      user_name: "伊藤健",
      email: "ito@sample.co.jp",
      role: "User",
      permission: "Member",
      active: true,
      last_active: "2024-03-12 11:30",
      paid_status: "Paid",
      company_linked: true,
      l7_events: 34,
      segment: "Active User",
    },
  ];

  // Mock segment suggestions
  const segmentSuggestions = [
    {
      segment_name: "High Engagement Champions",
      user_count: 2,
      description: "Champion Layerで高頻度利用中のユーザー",
      recommended_action: "新機能のベータテスト依頼",
      user_ids: ["user_001", "user_003"],
    },
    {
      segment_name: "Active Users",
      user_count: 2,
      description: "定期的にアクティブなUser Layer",
      recommended_action: "活用事例のヒアリング",
      user_ids: ["user_002", "user_005"],
    },
    {
      segment_name: "At-Risk Users",
      user_count: 1,
      description: "30日以上非アクティブ",
      recommended_action: "リエンゲージメント施策",
      user_ids: ["user_004"],
    },
  ];

  // Mock AI Insight
  const aiInsight = {
    project_summary: "マーケティングチームでは、Champion Layerの2名が積極的に新機能を活用しており、キャンペーン作成数が通常の3倍に増加しています。一方で、1名のユーザーが30日以上非アクティブとなっており、離脱リスクがあります。",
    key_findings: [
      "Champion Layerでの新機能採用が順調（利用率85%）",
      "API連携エラーが頻発しており、業務効率に影響",
      "1名のユーザーが長期非アクティブ（離脱リスク高）",
    ],
    recommended_actions: [
      "Champion向け：API連携エラーの解消支援（優先度：高）",
      "Active User向け：活用事例のヒアリング実施",
      "At-Risk User向け：リエンゲージメントメール送信",
    ],
  };

  return (
    <div className="space-y-4">
      {/* AI Insight Panel */}
      <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-slate-900">AI Insight</h2>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={onGenerateInsight}
          >
            再生成
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2">Project Summary</h3>
            <p className="text-sm text-slate-900 leading-relaxed">
              {aiInsight.project_summary}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2">主要論点</h3>
            <ul className="space-y-1.5">
              {aiInsight.key_findings.map((finding, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-900">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2">推奨アクション</h3>
            <ul className="space-y-1.5">
              {aiInsight.recommended_actions.map((action, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-900">
                  <Target className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* Segment Suggestions */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">推奨セグメント</h2>
          <Button 
            variant="outline" 
            size="sm"
            onClick={onSelectUsers}
          >
            <Users className="w-4 h-4 mr-1.5" />
            ユーザー選択
          </Button>
        </div>

        <div className="space-y-3">
          {segmentSuggestions.map((segment) => (
            <div 
              key={segment.segment_name}
              className="border rounded-lg p-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-slate-900">
                      {segment.segment_name}
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {segment.user_count}名
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mb-2">
                    {segment.description}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs">
                    <TrendingUp className="w-3 h-3 text-blue-600" />
                    <span className="text-blue-700">{segment.recommended_action}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" className="text-xs h-7">
                  <Eye className="w-3 h-3 mr-1" />
                  詳細
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7">
                  <Send className="w-3 h-3 mr-1" />
                  送付対象に追加
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Project Users List */}
      <Card className="p-4 flex-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Project所属ユーザー</h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{projectUsers.length}名</Badge>
            {selectedUsers.length > 0 && (
              <Badge className="bg-blue-100 text-blue-700">
                {selectedUsers.length}名選択中
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          <div className="space-y-2 pr-4">
            {projectUsers.map((user) => (
              <div 
                key={user.user_id}
                className="border rounded-lg p-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-slate-900">
                        {user.user_name}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {user.role}
                      </Badge>
                      {user.active ? (
                        <Badge className="text-xs bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge className="text-xs bg-red-100 text-red-700">
                          <XCircle className="w-3 h-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 mb-2">{user.email}</p>

                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span>Permission: {user.permission}</span>
                      <span className="text-slate-400">•</span>
                      <span>L7 Events: {user.l7_events}</span>
                      <span className="text-slate-400">•</span>
                      <span>Last: {user.last_active}</span>
                    </div>

                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs">
                        {user.segment}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="sm" className="text-xs h-7">
                      <Eye className="w-3 h-3 mr-1" />
                      詳細
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
