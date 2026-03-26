import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Mail,
  MessageSquare,
  Send,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointerClick,
  MessageCircle,
  Clock,
  User,
  Building2,
  Target,
  FileText,
  ExternalLink,
  Plus,
  Edit3,
  Users,
  Calendar,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "../components/ui/breadcrumb";

export function OutboundResult() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Mock data
  const outboundData = {
    id: id || "out-3",
    name: "新機能アナウンス - Intercom",
    channel: "intercom" as const,
    audienceScope: "user" as const,
    linkedCluster: "アクティブユーザー",
    linkedSegment: "Power Users",
    linkedAction: "action-003",
    linkedEvidence: ["ev-10", "ev-11", "ev-12"],
    resolvedRecipientsCount: 2341,
    unresolvedRecipientsCount: 45,
    failedDeliveriesCount: 8,
    sentTime: "2026-03-12 14:30",
    owner: "鈴木 次郎",
    subject: "新機能のご紹介: プロジェクトテンプレート機能",
    body: `{{user_name}}様

いつもご利用いただきありがとうございます。

本日、プロジェクトテンプレート機能をリリースいたしました。

この機能により、よく使うプロジェクト構成をテンプレートとして保存し、
新規プロジェクト作成時に再利用できるようになります。

詳細はこちらをご確認ください:
{{feature_link}}

ご不明点がございましたら、お気軽にお問い合わせください。

{{company_name}}チーム`,
    templateName: "新機能アナウンス",
    sourceContext: "Audience Workspace",
  };

  const deliveryStats = {
    sent: 2341,
    delivered: 2333,
    failed: 8,
    opens: 1823,
    openRate: 78.1,
    clicks: 456,
    clickRate: 19.5,
    replies: 23,
    replyRate: 1.0,
  };

  const mockReactionTimeline = [
    {
      id: "r1",
      timestamp: "2026-03-12 14:35",
      type: "open" as const,
      user: "田中太郎",
      company: "テックイノベーション株式会社",
      project: "プロジェクトA",
    },
    {
      id: "r2",
      timestamp: "2026-03-12 14:42",
      type: "click" as const,
      user: "山田花子",
      company: "テックイノベーション株式会社",
      project: "プロジェクトA",
    },
    {
      id: "r3",
      timestamp: "2026-03-12 15:03",
      type: "reply" as const,
      user: "佐藤次郎",
      company: "デジタルマーケティング株式会社",
      project: "データ分析基盤構築",
      message: "詳しく教えてください",
    },
    {
      id: "r4",
      timestamp: "2026-03-12 15:18",
      type: "open" as const,
      user: "鈴木三郎",
      company: "クラウドインフラ株式会社",
      project: "全社DX推進",
    },
    {
      id: "r5",
      timestamp: "2026-03-12 16:22",
      type: "click" as const,
      user: "高橋一郎",
      company: "エンタープライズシステムズ株式会社",
      project: "営業管理システム刷新",
    },
  ];

  const mockFailedDeliveries = [
    {
      id: "f1",
      user: "伊藤五郎",
      company: "グローバルソリューションズ株式会社",
      project: "マーケティング自動化",
      reason: "Intercom user_id未解決",
      timestamp: "2026-03-12 14:31",
    },
    {
      id: "f2",
      user: "渡辺六郎",
      company: "テクノロジーパートナーズ株式会社",
      project: "カスタマーサポート強化",
      reason: "配信除外リスト",
      timestamp: "2026-03-12 14:31",
    },
  ];

  const mockUnresolvedRecipients = [
    {
      id: "u1",
      name: "営業管理システム刷新",
      company: "エンタープライズシステムズ株式会社",
      reason: "メールアドレス未登録",
      userCount: 15,
    },
    {
      id: "u2",
      name: "マーケティング自動化",
      company: "グローバルソリューションズ株式会社",
      reason: "担当者情報なし",
      userCount: 18,
    },
    {
      id: "u3",
      name: "カスタマーサポート強化",
      company: "テクノロジーパートナーズ株式会社",
      reason: "配信除外リスト",
      userCount: 12,
    },
  ];

  const mockSegmentBreakdown = [
    { segment: "Power Users", sent: 856, opens: 712, clicks: 203, replies: 12, openRate: 83.2 },
    { segment: "Active Users", sent: 1124, opens: 879, clicks: 187, replies: 8, openRate: 78.2 },
    { segment: "Casual Users", sent: 361, opens: 232, clicks: 66, replies: 3, openRate: 64.3 },
  ];

  const mockFollowUpActions = [
    {
      id: "fu1",
      title: "反応なしユーザーへの個別フォローアップ",
      priority: "high" as const,
      affectedUsers: 518,
      type: "follow-up",
    },
    {
      id: "fu2",
      title: "Reply返信への個別対応",
      priority: "high" as const,
      affectedUsers: 23,
      type: "follow-up",
    },
    {
      id: "fu3",
      title: "クリックユーザーへの詳細案内",
      priority: "medium" as const,
      affectedUsers: 456,
      type: "nurture",
    },
  ];

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="w-5 h-5" />;
      case "intercom": return <MessageSquare className="w-5 h-5" />;
      case "slack": return <MessageSquare className="w-5 h-5" />;
      default: return <Send className="w-5 h-5" />;
    }
  };

  const getReactionIcon = (type: string) => {
    switch (type) {
      case "open": return <Eye className="w-4 h-4 text-green-600" />;
      case "click": return <MousePointerClick className="w-4 h-4 text-blue-600" />;
      case "reply": return <MessageCircle className="w-4 h-4 text-purple-600" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getReactionBadge = (type: string) => {
    switch (type) {
      case "open":
        return <Badge variant="outline" className="text-green-600 border-green-600">Open</Badge>;
      case "click":
        return <Badge variant="outline" className="text-blue-600 border-blue-600">Click</Badge>;
      case "reply":
        return <Badge variant="outline" className="text-purple-600 border-purple-600">Reply</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="flex h-screen bg-white">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="border-b bg-white px-8 py-4">
            <Breadcrumb className="mb-4">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/outbound">Outbound</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Result</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  {getChannelIcon(outboundData.channel)}
                  <h1 className="text-xl font-semibold text-slate-900">{outboundData.name}</h1>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <Badge variant="outline" className="capitalize">{outboundData.channel}</Badge>
                  <Badge variant="outline">
                    {outboundData.audienceScope === "project" && <Target className="w-3 h-3 mr-1" />}
                    {outboundData.audienceScope === "company" && <Building2 className="w-3 h-3 mr-1" />}
                    {outboundData.audienceScope === "user" && <User className="w-3 h-3 mr-1" />}
                    {outboundData.audienceScope}
                  </Badge>
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Sent
                  </Badge>
                  {outboundData.unresolvedRecipientsCount > 0 && (
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Unresolved: {outboundData.unresolvedRecipientsCount}
                    </Badge>
                  )}
                  {deliveryStats.failed > 0 && (
                    <Badge variant="outline" className="text-red-600 border-red-600">
                      <XCircle className="w-3 h-3 mr-1" />
                      Failed: {deliveryStats.failed}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-6 text-sm text-slate-600">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    配信済: {outboundData.sentTime}
                  </div>
                  <div>対象: {outboundData.resolvedRecipientsCount}件</div>
                  <div>Owner: {outboundData.owner}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate("/outbound")}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Listに戻る
                </Button>
                {outboundData.sourceContext && (
                  <Button variant="outline" size="sm">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {outboundData.sourceContext}を見る
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/outbound/${id}/edit`}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Editorを開く
                  </Link>
                </Button>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  follow-up Actionを作成
                </Button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-6 gap-4 mt-6">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-semibold text-slate-900">{deliveryStats.delivered}</div>
                  <div className="text-xs text-slate-600 mt-1">配信成功</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-semibold text-green-600">{deliveryStats.opens}</div>
                  <div className="text-xs text-slate-600 mt-1">Opens ({deliveryStats.openRate}%)</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-semibold text-blue-600">{deliveryStats.clicks}</div>
                  <div className="text-xs text-slate-600 mt-1">Clicks ({deliveryStats.clickRate}%)</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-semibold text-purple-600">{deliveryStats.replies}</div>
                  <div className="text-xs text-slate-600 mt-1">Replies ({deliveryStats.replyRate}%)</div>
                </CardContent>
              </Card>
              <Card className="border-orange-200">
                <CardContent className="p-4">
                  <div className="text-2xl font-semibold text-orange-600">{outboundData.unresolvedRecipientsCount}</div>
                  <div className="text-xs text-slate-600 mt-1">Unresolved</div>
                </CardContent>
              </Card>
              <Card className="border-red-200">
                <CardContent className="p-4">
                  <div className="text-2xl font-semibold text-red-600">{deliveryStats.failed}</div>
                  <div className="text-xs text-slate-600 mt-1">Failed</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex min-h-0">
            {/* Left: Delivery Breakdown / Recipient Status */}
            <div className="w-80 border-r bg-slate-50 overflow-y-auto">
              <div className="p-6">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Delivery Breakdown</h2>

                <div className="space-y-4 mb-6">
                  <Card className="bg-white">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-slate-600">配信成功</div>
                        <div className="text-lg font-semibold text-green-600">{deliveryStats.delivered}</div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${(deliveryStats.delivered / deliveryStats.sent) * 100}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-red-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-slate-600">配信失敗</div>
                        <div className="text-lg font-semibold text-red-600">{deliveryStats.failed}</div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-red-600 h-2 rounded-full"
                          style={{ width: `${(deliveryStats.failed / deliveryStats.sent) * 100}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Separator className="my-6" />

                <div className="mb-6">
                  <h3 className="text-sm font-medium text-slate-900 mb-3">Segment別の反応</h3>
                  <div className="space-y-2">
                    {mockSegmentBreakdown.map((segment) => (
                      <Card key={segment.segment} className="bg-white">
                        <CardContent className="p-3">
                          <div className="text-sm font-medium text-slate-900 mb-2">{segment.segment}</div>
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-600">配信:</span>
                              <span className="font-medium">{segment.sent}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-green-600">Opens:</span>
                              <span className="font-medium text-green-600">{segment.opens} ({segment.openRate}%)</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-blue-600">Clicks:</span>
                              <span className="font-medium text-blue-600">{segment.clicks}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-purple-600">Replies:</span>
                              <span className="font-medium text-purple-600">{segment.replies}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <Separator className="my-6" />

                {outboundData.unresolvedRecipientsCount > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-slate-900">Unresolved Recipients</h3>
                      <Badge variant="outline" className="text-orange-600 border-orange-600">
                        {outboundData.unresolvedRecipientsCount}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {mockUnresolvedRecipients.map((recipient) => (
                        <Card key={recipient.id} className="bg-white border-orange-200">
                          <CardContent className="p-3">
                            <div className="text-sm font-medium text-slate-900 mb-1">{recipient.name}</div>
                            <div className="text-xs text-slate-600 mb-2">{recipient.company}</div>
                            <div className="flex items-center gap-1 mb-2">
                              <AlertTriangle className="w-3 h-3 text-orange-600" />
                              <span className="text-xs text-orange-600">{recipient.reason}</span>
                            </div>
                            <div className="text-xs text-slate-500">
                              <Users className="w-3 h-3 inline mr-1" />
                              {recipient.userCount} users
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {deliveryStats.failed > 0 && (
                  <>
                    <Separator className="my-6" />
                    
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-slate-900">Failed Deliveries</h3>
                        <Badge variant="outline" className="text-red-600 border-red-600">
                          {deliveryStats.failed}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {mockFailedDeliveries.map((failed) => (
                          <Card key={failed.id} className="bg-white border-red-200">
                            <CardContent className="p-3">
                              <div className="text-sm font-medium text-slate-900 mb-1">{failed.user}</div>
                              <div className="text-xs text-slate-600 mb-1">{failed.company}</div>
                              <div className="text-xs text-slate-600 mb-2">{failed.project}</div>
                              <div className="flex items-center gap-1 mb-1">
                                <XCircle className="w-3 h-3 text-red-600" />
                                <span className="text-xs text-red-600">{failed.reason}</span>
                              </div>
                              <div className="text-xs text-slate-500">{failed.timestamp}</div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator className="my-6" />

                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to={`/outbound/${id}/edit`}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    Editorに戻る
                  </Link>
                </Button>
              </div>
            </div>

            {/* Center: Result Detail / Reaction Timeline */}
            <div className="flex-1 flex flex-col">
              <Tabs defaultValue="reactions" className="flex-1 flex flex-col min-h-0">
                <div className="border-b px-6 flex-shrink-0">
                  <TabsList>
                    <TabsTrigger value="reactions">Reaction Timeline</TabsTrigger>
                    <TabsTrigger value="content">配信内容</TabsTrigger>
                    <TabsTrigger value="evidence">Evidence</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="reactions" className="flex-1 overflow-y-auto mt-0 p-6">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-slate-900 mb-2">Reaction Timeline</h2>
                    <p className="text-sm text-slate-600">配信後のユーザー反応を時系列で確認できます</p>
                  </div>

                  <div className="space-y-3">
                    {mockReactionTimeline.map((reaction) => (
                      <Card key={reaction.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                              {getReactionIcon(reaction.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                {getReactionBadge(reaction.type)}
                                <span className="text-sm text-slate-600">{reaction.timestamp}</span>
                              </div>
                              <div className="text-sm font-medium text-slate-900 mb-1">{reaction.user}</div>
                              <div className="text-sm text-slate-600 mb-1">{reaction.company}</div>
                              <div className="text-sm text-slate-600">{reaction.project}</div>
                              {reaction.type === "reply" && reaction.message && (
                                <div className="mt-2 bg-purple-50 border border-purple-200 rounded p-3">
                                  <div className="text-xs text-purple-600 mb-1">Reply内容:</div>
                                  <div className="text-sm text-slate-900">{reaction.message}</div>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" asChild>
                                <Link to={`/project/${reaction.project}`}>
                                  <ExternalLink className="w-4 h-4" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="content" className="flex-1 overflow-hidden mt-0">
                  <ScrollArea className="h-full">
                    <div className="p-6">
                      <div className="max-w-3xl mx-auto">
                        <h2 className="text-lg font-semibold text-slate-900 mb-6">実際に配信した内容</h2>

                        <Card className="mb-6">
                          <CardHeader>
                            <CardTitle className="text-base">配信情報</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <div className="text-slate-600">Channel</div>
                                <div className="font-medium text-slate-900 capitalize">{outboundData.channel}</div>
                              </div>
                              <div>
                                <div className="text-slate-600">配信日時</div>
                                <div className="font-medium text-slate-900">{outboundData.sentTime}</div>
                              </div>
                              <div>
                                <div className="text-slate-600">テンプレート</div>
                                <div className="font-medium text-slate-900">{outboundData.templateName}</div>
                              </div>
                              <div>
                                <div className="text-slate-600">対象件数</div>
                                <div className="font-medium text-slate-900">{outboundData.resolvedRecipientsCount}件</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              {outboundData.channel === "email" ? "件名" : "タイトル"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-sm text-slate-900 bg-slate-50 rounded p-3">
                              {outboundData.subject}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="mt-6">
                          <CardHeader>
                            <CardTitle className="text-base">本文</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-sm text-slate-900 bg-slate-50 rounded p-4 whitespace-pre-wrap">
                              {outboundData.body}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="evidence" className="flex-1 overflow-hidden mt-0">
                  <ScrollArea className="h-full">
                    <div className="p-6">
                      <div className="max-w-3xl mx-auto">
                        <h2 className="text-lg font-semibold text-slate-900 mb-2">Linked Evidence</h2>
                        <p className="text-sm text-slate-600 mb-6">この配信の根拠となったEvidence</p>

                        <div className="space-y-3">
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="text-sm font-medium text-slate-900">新機能リリース準備完了</div>
                                <Badge variant="outline" className="text-green-600 border-green-600">完了</Badge>
                              </div>
                              <div className="text-sm text-slate-600 mb-3">
                                プロジェクトテンプレート機能の開発とテストが完了し、本番環境へのデプロイ準備が整いました。
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-slate-500">2026-03-11</div>
                                <Button variant="ghost" size="sm" className="h-7 text-xs">
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  原文を開く
                                </Button>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="text-sm font-medium text-slate-900">ユーザーフィードバック分析</div>
                                <Badge variant="outline">分析</Badge>
                              </div>
                              <div className="text-sm text-slate-600 mb-3">
                                Power Usersから、プロジェクトテンプレート機能へのリクエストが多数寄せられていることを確認。
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-slate-500">2026-03-10</div>
                                <Button variant="ghost" size="sm" className="h-7 text-xs">
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  原文を開く
                                </Button>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="text-sm font-medium text-slate-900">アクティブユーザー分析</div>
                                <Badge variant="outline">Insight</Badge>
                              </div>
                              <div className="text-sm text-slate-600 mb-3">
                                過去30日間でアクティブなPower Usersは2,386名。この層への新機能アナウンスは高い反応率が期待できる。
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-slate-500">2026-03-09</div>
                                <Button variant="ghost" size="sm" className="h-7 text-xs">
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  原文を開く
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right: Follow-up / Next Actions */}
            <div className="w-96 border-l bg-slate-50 overflow-y-auto">
              <div className="p-6">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Follow-up / Next Actions</h2>

                <div className="mb-6">
                  <h3 className="text-sm font-medium text-slate-900 mb-3">推奨フォローアップ</h3>
                  <div className="space-y-2">
                    {mockFollowUpActions.map((action) => (
                      <Card key={action.id} className="bg-white">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3 mb-3">
                            {action.priority === "high" && (
                              <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                            )}
                            {action.priority === "medium" && (
                              <TrendingUp className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-900 mb-2">{action.title}</div>
                              <div className="text-xs text-slate-600 mb-2">
                                対象: {action.affectedUsers}名のユーザー
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {action.type === "follow-up" && "Follow-up"}
                                {action.type === "nurture" && "Nurture"}
                              </Badge>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" className="w-full">
                            <Plus className="w-4 h-4 mr-2" />
                            Actionを作成
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <Separator className="my-6" />

                <div className="mb-6">
                  <h3 className="text-sm font-medium text-slate-900 mb-3">反応別ユーザー群</h3>
                  <div className="space-y-2">
                    <Card className="bg-white border-green-200">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-green-600" />
                            <div className="text-sm font-medium text-slate-900">Openしたユーザー</div>
                          </div>
                          <div className="text-sm font-semibold text-green-600">{deliveryStats.opens}</div>
                        </div>
                        <Button variant="outline" size="sm" className="w-full">
                          <Users className="w-4 h-4 mr-2" />
                          一覧を見る
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="bg-white border-blue-200">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <MousePointerClick className="w-4 h-4 text-blue-600" />
                            <div className="text-sm font-medium text-slate-900">Clickしたユーザー</div>
                          </div>
                          <div className="text-sm font-semibold text-blue-600">{deliveryStats.clicks}</div>
                        </div>
                        <Button variant="outline" size="sm" className="w-full">
                          <Users className="w-4 h-4 mr-2" />
                          一覧を見る
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="bg-white border-purple-200">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-purple-600" />
                            <div className="text-sm font-medium text-slate-900">Replyしたユーザー</div>
                          </div>
                          <div className="text-sm font-semibold text-purple-600">{deliveryStats.replies}</div>
                        </div>
                        <Button variant="outline" size="sm" className="w-full">
                          <Users className="w-4 h-4 mr-2" />
                          一覧を見る
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="bg-white border-slate-200">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-slate-400" />
                            <div className="text-sm font-medium text-slate-900">反応なしユーザー</div>
                          </div>
                          <div className="text-sm font-semibold text-slate-600">
                            {deliveryStats.delivered - deliveryStats.opens}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="w-full">
                          <Users className="w-4 h-4 mr-2" />
                          一覧を見る
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Separator className="my-6" />

                <div>
                  <h3 className="text-sm font-medium text-slate-900 mb-3">関連機能へ移動</h3>
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                      <Link to="/audience">
                        <ArrowUpRight className="w-4 h-4 mr-2" />
                        Audience Workspaceで再設計
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <ArrowUpRight className="w-4 h-4 mr-2" />
                      Project Detailを見る
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <ArrowUpRight className="w-4 h-4 mr-2" />
                      User Detailを見る
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}