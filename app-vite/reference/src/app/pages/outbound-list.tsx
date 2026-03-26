import { useState } from "react";
import { Link } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { Card, CardContent } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ViewSwitcher } from "../components/ui/view-switcher";
import { ViewContextHeader } from "../components/ui/view-context-header";
import { ViewEmptyState } from "../components/ui/view-empty-state";
import { NewOutboundDrawer } from "../components/outbound/new-outbound-drawer";
import {
  Mail,
  MessageSquare,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  FileText,
  User,
  Building2,
  Filter,
  Search,
  Plus,
  ArrowUpRight,
  Eye,
  Edit3,
  Users,
  TrendingUp,
  Target,
  X,
} from "lucide-react";

// Mock data
const mockOutboundItems = [
  {
    id: "out-1",
    name: "利用低下クラスター向けリエンゲージメントEmail",
    channel: "email" as const,
    audienceScope: "project" as const,
    linkedCluster: "利用低下クラスター",
    linkedSegment: "Churn Prevention",
    linkedProject: null,
    linkedCompany: null,
    linkedUser: null,
    resolvedRecipientsCount: 847,
    unresolvedRecipientsCount: 12,
    reviewState: "review_required" as const,
    deliveryStatus: "draft" as const,
    owner: "佐藤 太郎",
    scheduledTime: null,
    sentTime: null,
    recentReactions: null,
    sourceContext: "Audience Workspace",
  },
  {
    id: "out-2",
    name: "テックイノベーション株式会社 - オンボーディング完了フォローアップ",
    channel: "email" as const,
    audienceScope: "company" as const,
    linkedCluster: null,
    linkedSegment: null,
    linkedProject: "プロジェクトA",
    linkedCompany: "テックイノベーション株式会社",
    linkedUser: null,
    resolvedRecipientsCount: 5,
    unresolvedRecipientsCount: 0,
    reviewState: "approved" as const,
    deliveryStatus: "ready" as const,
    owner: "田中 花子",
    scheduledTime: "2026-03-14 10:00",
    sentTime: null,
    recentReactions: null,
    sourceContext: "Company Detail",
  },
  {
    id: "out-3",
    name: "新機能アナウンス - Intercom",
    channel: "intercom" as const,
    audienceScope: "user" as const,
    linkedCluster: "アクティブユーザー",
    linkedSegment: "Power Users",
    linkedProject: null,
    linkedCompany: null,
    linkedUser: null,
    resolvedRecipientsCount: 2341,
    unresolvedRecipientsCount: 45,
    reviewState: "approved" as const,
    deliveryStatus: "sent" as const,
    owner: "鈴木 次郎",
    scheduledTime: null,
    sentTime: "2026-03-12 14:30",
    recentReactions: {
      opens: 1823,
      clicks: 456,
      replies: 23,
    },
    sourceContext: "Audience Workspace",
  },
  {
    id: "out-4",
    name: "サポート完了通知 - Slack",
    channel: "slack" as const,
    audienceScope: "user" as const,
    linkedCluster: null,
    linkedSegment: null,
    linkedProject: "データ分析基盤構築",
    linkedCompany: "デジタルマーケティング株式会社",
    linkedUser: "佐藤次郎",
    resolvedRecipientsCount: 1,
    unresolvedRecipientsCount: 0,
    reviewState: "approved" as const,
    deliveryStatus: "sent" as const,
    owner: "山田 一郎",
    scheduledTime: null,
    sentTime: "2026-03-13 16:45",
    recentReactions: {
      opens: 1,
      clicks: 0,
      replies: 1,
    },
    sourceContext: "Project Detail",
  },
  {
    id: "out-5",
    name: "契約更新リマインド - Email",
    channel: "email" as const,
    audienceScope: "company" as const,
    linkedCluster: null,
    linkedSegment: "Renewal Approaching",
    linkedProject: null,
    linkedCompany: "グローバルソリューションズ株式会社",
    linkedUser: null,
    resolvedRecipientsCount: 3,
    unresolvedRecipientsCount: 1,
    reviewState: "draft" as const,
    deliveryStatus: "draft" as const,
    owner: "佐藤 太郎",
    scheduledTime: null,
    sentTime: null,
    recentReactions: null,
    sourceContext: "Company Detail",
  },
  {
    id: "out-6",
    name: "四半期レビュー招待 - Email",
    channel: "email" as const,
    audienceScope: "company" as const,
    linkedCluster: null,
    linkedSegment: "High Value",
    linkedProject: null,
    linkedCompany: "エンタープライズシステムズ株式会社",
    linkedUser: null,
    resolvedRecipientsCount: 0,
    unresolvedRecipientsCount: 8,
    reviewState: "draft" as const,
    deliveryStatus: "draft" as const,
    owner: "田中 花子",
    scheduledTime: null,
    sentTime: null,
    recentReactions: null,
    sourceContext: "Audience Workspace",
  },
  {
    id: "out-7",
    name: "アップセル提案 - Email",
    channel: "email" as const,
    audienceScope: "company" as const,
    linkedCluster: "拡張候補クラスター",
    linkedSegment: "Expansion Opportunity",
    linkedProject: null,
    linkedCompany: "テクノロジーパートナーズ株式会社",
    linkedUser: null,
    resolvedRecipientsCount: 2,
    unresolvedRecipientsCount: 0,
    reviewState: "approved" as const,
    deliveryStatus: "scheduled" as const,
    owner: "鈴木 次郎",
    scheduledTime: "2026-03-15 09:00",
    sentTime: null,
    recentReactions: null,
    sourceContext: "Company Detail",
  },
  {
    id: "out-8",
    name: "トレーニングセッション招待 - Intercom",
    channel: "intercom" as const,
    audienceScope: "user" as const,
    linkedCluster: "新規ユーザー",
    linkedSegment: "Onboarding",
    linkedProject: null,
    linkedCompany: null,
    linkedUser: null,
    resolvedRecipientsCount: 423,
    unresolvedRecipientsCount: 7,
    reviewState: "approved" as const,
    deliveryStatus: "failed" as const,
    owner: "山田 一郎",
    scheduledTime: null,
    sentTime: "2026-03-13 11:00",
    recentReactions: null,
    sourceContext: "Audience Workspace",
  },
];

export function OutboundList() {
  // Default View state
  const [currentView, setCurrentView] = useState("drafts");
  const currentUserName = "佐藤 太郎"; // Mock current user

  const [selectedQueue, setSelectedQueue] = useState("all");
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewOutboundDrawer, setShowNewOutboundDrawer] = useState(false);

  // View definitions
  const views = [
    { value: "drafts", label: "Drafts", description: "下書き・レビュー待ちのOutbound", isDefault: true },
    { value: "ready", label: "Ready to Send", description: "送信可能なOutbound" },
    { value: "scheduled", label: "Scheduled", description: "スケジュール済みのOutbound" },
    { value: "sent", label: "Sent", description: "送信完了したOutbound" },
    { value: "failed", label: "Failed", description: "送信失敗したOutbound" },
    { value: "all", label: "All Outbound", description: "全Outbound" },
  ];

  // View configurations
  const viewConfig: Record<string, {
    subtitle: string;
    filter: (item: typeof mockOutboundItems[0]) => boolean;
    emptyState: { title: string; description: string; cta: { label: string; action: () => void } | null };
  }> = {
    drafts: {
      subtitle: "下書き・レビュー待ちのOutboundを確認・編集する",
      filter: (item) => item.deliveryStatus === "draft" || item.reviewState === "review_required",
      emptyState: {
        title: "下書き・レビュー待ちのOutboundはありません",
        description: "新しいOutboundを作成すると、ここに表示されます",
        cta: { label: "All Outbound を見る", action: () => setCurrentView("all") },
      },
    },
    ready: {
      subtitle: "送信可能なOutboundを確認する",
      filter: (item) => item.deliveryStatus === "ready",
      emptyState: {
        title: "送信可能なOutboundはありません",
        description: "承認されたOutboundが発生すると、ここに表示されます",
        cta: { label: "Drafts を見る", action: () => setCurrentView("drafts") },
      },
    },
    scheduled: {
      subtitle: "スケジュール済みのOutboundを確認する",
      filter: (item) => item.deliveryStatus === "scheduled",
      emptyState: {
        title: "スケジュール済みのOutboundはありません",
        description: "スケジュールされたOutboundが発生すると、ここに表示されます",
        cta: { label: "Drafts を見る", action: () => setCurrentView("drafts") },
      },
    },
    sent: {
      subtitle: "送信完了したOutboundと配信結果を確認する",
      filter: (item) => item.deliveryStatus === "sent",
      emptyState: {
        title: "送信完了したOutboundはまだありません",
        description: "Outboundが送信されると、ここに表示されます",
        cta: { label: "Drafts を見る", action: () => setCurrentView("drafts") },
      },
    },
    failed: {
      subtitle: "送信失敗したOutboundを確認・修正する",
      filter: (item) => item.deliveryStatus === "failed",
      emptyState: {
        title: "送信失敗したOutboundはありません",
        description: "送信失敗が発生すると、ここに表示されます",
        cta: null,
      },
    },
    all: {
      subtitle: "すべてのOutboundを確認する",
      filter: (item) => true,
      emptyState: {
        title: "Outboundがまだ登録されていません",
        description: "Outboundが作成されると、ここに表示されます",
        cta: null,
      },
    },
  };

  const config = viewConfig[currentView];
  const currentViewLabel = views.find(v => v.value === currentView)?.label || "";

  // 1st filter: View filter
  const viewFilteredItems = mockOutboundItems.filter(config.filter);

  // 2nd filter: Additional filters (channel, search)
  const filteredItems = viewFilteredItems.filter(item => {
    if (selectedChannel !== "all" && item.channel !== selectedChannel) return false;
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Calculate summary stats (use viewFilteredItems)
  const stats = {
    draft: viewFilteredItems.filter(item => item.deliveryStatus === "draft").length,
    reviewRequired: viewFilteredItems.filter(item => item.reviewState === "review_required").length,
    ready: viewFilteredItems.filter(item => item.deliveryStatus === "ready").length,
    scheduled: viewFilteredItems.filter(item => item.deliveryStatus === "scheduled").length,
    sent: viewFilteredItems.filter(item => item.deliveryStatus === "sent").length,
    unresolved: viewFilteredItems.filter(item => item.unresolvedRecipientsCount > 0).length,
    failed: viewFilteredItems.filter(item => item.deliveryStatus === "failed").length,
    recentReactions: viewFilteredItems.filter(item => item.recentReactions && (item.recentReactions.replies > 0 || item.recentReactions.clicks > 10)).length,
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="w-4 h-4" />;
      case "intercom": return <MessageSquare className="w-4 h-4" />;
      case "slack": return <MessageSquare className="w-4 h-4" />;
      default: return <Send className="w-4 h-4" />;
    }
  };

  const getChannelBadge = (channel: string) => {
    const variants: Record<string, any> = {
      email: "default",
      intercom: "secondary",
      slack: "outline",
    };
    return <Badge variant={variants[channel] || "default"}>{channel}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline" className="text-slate-600"><FileText className="w-3 h-3 mr-1" />Draft</Badge>;
      case "review_required":
        return <Badge variant="outline" className="text-amber-600 border-amber-600"><AlertCircle className="w-3 h-3 mr-1" />Review Required</Badge>;
      case "ready":
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Ready</Badge>;
      case "scheduled":
        return <Badge variant="outline" className="text-blue-600 border-blue-600"><Clock className="w-3 h-3 mr-1" />Scheduled</Badge>;
      case "sent":
        return <Badge variant="outline" className="text-slate-600"><Send className="w-3 h-3 mr-1" />Sent</Badge>;
      case "failed":
        return <Badge variant="outline" className="text-red-600 border-red-600"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const selectedItemData = selectedItem ? mockOutboundItems.find(item => item.id === selectedItem) : null;

  return (
    <div className="flex h-screen bg-white">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Outbound Summary Header */}
          <div className="border-b bg-slate-50 px-8 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Outbound</h1>
                <p className="text-xs text-slate-600">顧客向けアクションの作成・配信・結果管理</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewOutboundDrawer(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Outbound
              </Button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-8 gap-3">
              <Card className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedQueue("draft")}>
                <CardContent className="p-3">
                  <div className="text-xl font-semibold text-slate-900">{stats.draft}</div>
                  <div className="text-xs text-slate-600 mt-0.5">Draft</div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedQueue("review_required")}>
                <CardContent className="p-3">
                  <div className="text-xl font-semibold text-amber-600">{stats.reviewRequired}</div>
                  <div className="text-xs text-slate-600 mt-0.5">Review待ち</div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedQueue("ready")}>
                <CardContent className="p-3">
                  <div className="text-xl font-semibold text-green-600">{stats.ready}</div>
                  <div className="text-xs text-slate-600 mt-0.5">Ready</div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedQueue("scheduled")}>
                <CardContent className="p-3">
                  <div className="text-xl font-semibold text-blue-600">{stats.scheduled}</div>
                  <div className="text-xs text-slate-600 mt-0.5">Scheduled</div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedQueue("sent")}>
                <CardContent className="p-3">
                  <div className="text-xl font-semibold text-slate-900">{stats.sent}</div>
                  <div className="text-xs text-slate-600 mt-0.5">Sent</div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:bg-slate-50 border-orange-200" onClick={() => setSelectedQueue("unresolved")}>
                <CardContent className="p-3">
                  <div className="text-xl font-semibold text-orange-600">{stats.unresolved}</div>
                  <div className="text-xs text-slate-600 mt-0.5">Unresolved有</div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:bg-slate-50 border-red-200" onClick={() => setSelectedQueue("failed")}>
                <CardContent className="p-3">
                  <div className="text-xl font-semibold text-red-600">{stats.failed}</div>
                  <div className="text-xs text-slate-600 mt-0.5">Failed</div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedQueue("reactions")}>
                <CardContent className="p-3">
                  <div className="text-xl font-semibold text-slate-900">{stats.recentReactions}</div>
                  <div className="text-xs text-slate-600 mt-0.5">反応あり</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex min-h-0">
            {/* Left Sidebar: Queue / Filters */}
            <div className="w-64 border-r bg-white overflow-y-auto">
              <div className="p-4">
                <div className="mb-6">
                  <h3 className="text-xs font-medium text-slate-500 uppercase mb-3">Queue</h3>
                  <div className="space-y-1">
                    <Button
                      variant={selectedQueue === "all" ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      size="sm"
                      onClick={() => setSelectedQueue("all")}
                    >
                      すべて
                    </Button>
                    <Button
                      variant={selectedQueue === "draft" ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      size="sm"
                      onClick={() => setSelectedQueue("draft")}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Draft
                    </Button>
                    <Button
                      variant={selectedQueue === "review_required" ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      size="sm"
                      onClick={() => setSelectedQueue("review_required")}
                    >
                      <AlertCircle className="w-4 h-4 mr-2 text-amber-600" />
                      Review Required
                    </Button>
                    <Button
                      variant={selectedQueue === "ready" ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      size="sm"
                      onClick={() => setSelectedQueue("ready")}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                      Ready to Send
                    </Button>
                    <Button
                      variant={selectedQueue === "scheduled" ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      size="sm"
                      onClick={() => setSelectedQueue("scheduled")}
                    >
                      <Clock className="w-4 h-4 mr-2 text-blue-600" />
                      Scheduled
                    </Button>
                    <Button
                      variant={selectedQueue === "sent" ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      size="sm"
                      onClick={() => setSelectedQueue("sent")}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Sent
                    </Button>
                    <Button
                      variant={selectedQueue === "unresolved" ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      size="sm"
                      onClick={() => setSelectedQueue("unresolved")}
                    >
                      <AlertTriangle className="w-4 h-4 mr-2 text-orange-600" />
                      Unresolved有り
                    </Button>
                    <Button
                      variant={selectedQueue === "failed" ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      size="sm"
                      onClick={() => setSelectedQueue("failed")}
                    >
                      <XCircle className="w-4 h-4 mr-2 text-red-600" />
                      Failed有り
                    </Button>
                    <Button
                      variant={selectedQueue === "reactions" ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      size="sm"
                      onClick={() => setSelectedQueue("reactions")}
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Recent Reactions
                    </Button>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="mb-6">
                  <h3 className="text-xs font-medium text-slate-500 uppercase mb-3">Channel</h3>
                  <div className="space-y-1">
                    <Button
                      variant={selectedChannel === "all" ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      size="sm"
                      onClick={() => setSelectedChannel("all")}
                    >
                      All Channels
                    </Button>
                    <Button
                      variant={selectedChannel === "email" ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      size="sm"
                      onClick={() => setSelectedChannel("email")}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Email
                    </Button>
                    <Button
                      variant={selectedChannel === "intercom" ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      size="sm"
                      onClick={() => setSelectedChannel("intercom")}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Intercom
                    </Button>
                    <Button
                      variant={selectedChannel === "slack" ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm"
                      size="sm"
                      onClick={() => setSelectedChannel("slack")}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Slack / Chatwork
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Center: Outbound Items List */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Outbound名で検索..."
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    詳細フィルター
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2">
                  {filteredItems.map((item) => (
                    <Card
                      key={item.id}
                      className={`cursor-pointer transition-colors hover:bg-slate-50 ${selectedItem === item.id ? 'border-slate-900 bg-slate-50' : ''}`}
                      onClick={() => setSelectedItem(item.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              {getChannelIcon(item.channel)}
                              <h3 className="font-medium text-slate-900 truncate">{item.name}</h3>
                            </div>
                            
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              {getChannelBadge(item.channel)}
                              {getStatusBadge(item.deliveryStatus)}
                              <Badge variant="outline" className="text-xs">
                                {item.audienceScope === "project" && <Target className="w-3 h-3 mr-1" />}
                                {item.audienceScope === "company" && <Building2 className="w-3 h-3 mr-1" />}
                                {item.audienceScope === "user" && <User className="w-3 h-3 mr-1" />}
                                {item.audienceScope}
                              </Badge>
                              {item.unresolvedRecipientsCount > 0 && (
                                <Badge variant="outline" className="text-orange-600 border-orange-600">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Unresolved: {item.unresolvedRecipientsCount}
                                </Badge>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                              {item.linkedCluster && (
                                <div>Cluster: {item.linkedCluster}</div>
                              )}
                              {item.linkedCompany && (
                                <div>Company: {item.linkedCompany}</div>
                              )}
                              {item.linkedProject && (
                                <div>Project: {item.linkedProject}</div>
                              )}
                              {item.linkedSegment && (
                                <div>Segment: {item.linkedSegment}</div>
                              )}
                              <div>対象: {item.resolvedRecipientsCount}件</div>
                              <div>Owner: {item.owner}</div>
                              {item.scheduledTime && (
                                <div>配信予定: {item.scheduledTime}</div>
                              )}
                              {item.sentTime && (
                                <div>配信済: {item.sentTime}</div>
                              )}
                              {item.recentReactions && (
                                <div className="col-span-2 flex items-center gap-3 mt-1">
                                  <span className="text-green-600">Opens: {item.recentReactions.opens}</span>
                                  <span className="text-blue-600">Clicks: {item.recentReactions.clicks}</span>
                                  <span className="text-purple-600">Replies: {item.recentReactions.replies}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                              <ArrowUpRight className="w-3 h-3" />
                              From: {item.sourceContext}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <Link to={`/outbound/${item.id}/edit`}>
                              <Button variant="outline" size="sm">
                                <Edit3 className="w-4 h-4 mr-2" />
                                編集
                              </Button>
                            </Link>
                            {item.deliveryStatus === "sent" && (
                              <Link to={`/outbound/${item.id}/result`}>
                                <Button variant="outline" size="sm">
                                  <Eye className="w-4 h-4 mr-2" />
                                  結果
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {filteredItems.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <Send className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>該当するOutboundがありません</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Selected Item Summary */}
            {selectedItemData && (
              <div className="w-80 border-l bg-slate-50 flex flex-col">
                <div className="p-4 border-b bg-white flex items-center justify-between flex-shrink-0">
                  <h3 className="text-sm font-medium text-slate-900">Selected Item</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setSelectedItem(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Name</div>
                      <div className="text-sm text-slate-900">{selectedItemData.name}</div>
                    </div>

                    <Separator />

                    <div>
                      <div className="text-xs text-slate-500 mb-1">Channel</div>
                      <div className="flex items-center gap-2">
                        {getChannelIcon(selectedItemData.channel)}
                        <span className="text-sm text-slate-900 capitalize">{selectedItemData.channel}</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500 mb-1">Audience Scope</div>
                      <Badge variant="outline" className="text-xs">
                        {selectedItemData.audienceScope === "project" && <Target className="w-3 h-3 mr-1" />}
                        {selectedItemData.audienceScope === "company" && <Building2 className="w-3 h-3 mr-1" />}
                        {selectedItemData.audienceScope === "user" && <User className="w-3 h-3 mr-1" />}
                        {selectedItemData.audienceScope}
                      </Badge>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500 mb-1">Recipients</div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">Resolved:</span>
                          <span className="font-medium text-slate-900">{selectedItemData.resolvedRecipientsCount}</span>
                        </div>
                        {selectedItemData.unresolvedRecipientsCount > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-orange-600">Unresolved:</span>
                            <span className="font-medium text-orange-600">{selectedItemData.unresolvedRecipientsCount}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <div className="text-xs text-slate-500 mb-1">Status</div>
                      <div className="space-y-2">
                        {getStatusBadge(selectedItemData.deliveryStatus)}
                        {selectedItemData.reviewState === "review_required" && (
                          <Badge variant="outline" className="text-amber-600 border-amber-600 block w-fit">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Review Required
                          </Badge>
                        )}
                        {selectedItemData.reviewState === "approved" && (
                          <Badge variant="outline" className="text-green-600 border-green-600 block w-fit">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Approved
                          </Badge>
                        )}
                      </div>
                    </div>

                    {selectedItemData.linkedCluster && (
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Linked Cluster</div>
                        <div className="text-sm text-slate-900">{selectedItemData.linkedCluster}</div>
                      </div>
                    )}

                    {selectedItemData.linkedSegment && (
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Linked Segment</div>
                        <div className="text-sm text-slate-900">{selectedItemData.linkedSegment}</div>
                      </div>
                    )}

                    {selectedItemData.linkedCompany && (
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Linked Company</div>
                        <div className="text-sm text-slate-900">{selectedItemData.linkedCompany}</div>
                      </div>
                    )}

                    {selectedItemData.linkedProject && (
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Linked Project</div>
                        <div className="text-sm text-slate-900">{selectedItemData.linkedProject}</div>
                      </div>
                    )}

                    <Separator />

                    <div>
                      <div className="text-xs text-slate-500 mb-1">Owner</div>
                      <div className="text-sm text-slate-900">{selectedItemData.owner}</div>
                    </div>

                    {selectedItemData.scheduledTime && (
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Scheduled Time</div>
                        <div className="text-sm text-slate-900">{selectedItemData.scheduledTime}</div>
                      </div>
                    )}

                    {selectedItemData.sentTime && (
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Sent Time</div>
                        <div className="text-sm text-slate-900">{selectedItemData.sentTime}</div>
                      </div>
                    )}

                    {selectedItemData.recentReactions && (
                      <div>
                        <div className="text-xs text-slate-500 mb-2">Recent Reactions</div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Opens:</span>
                            <span className="font-medium text-green-600">{selectedItemData.recentReactions.opens}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Clicks:</span>
                            <span className="font-medium text-blue-600">{selectedItemData.recentReactions.clicks}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Replies:</span>
                            <span className="font-medium text-purple-600">{selectedItemData.recentReactions.replies}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <Separator />

                    <div>
                      <div className="text-xs text-slate-500 mb-1">Source Context</div>
                      <div className="text-sm text-slate-900">{selectedItemData.sourceContext}</div>
                    </div>

                    <div className="pt-4 space-y-2">
                      <Link to={`/outbound/${selectedItemData.id}/edit`} className="block">
                        <Button variant="default" className="w-full" size="sm">
                          <Edit3 className="w-4 h-4 mr-2" />
                          Editorを開く
                        </Button>
                      </Link>
                      {selectedItemData.deliveryStatus === "sent" && (
                        <Link to={`/outbound/${selectedItemData.id}/result`} className="block">
                          <Button variant="outline" className="w-full" size="sm">
                            <Eye className="w-4 h-4 mr-2" />
                            配信結果を見る
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <NewOutboundDrawer
        open={showNewOutboundDrawer}
        onOpenChange={setShowNewOutboundDrawer}
      />
    </div>
  );
}