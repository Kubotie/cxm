import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Calendar,
  Users,
  FileText,
  Send,
  Target,
  User,
  Edit,
  Download,
  Link as LinkIcon,
  Building,
  FolderOpen,
  Eye,
  TrendingUp,
  CheckCircle,
  ArrowLeft,
  Sparkles,
  Plus,
} from "lucide-react";
import { EventCreateDrawer } from "../components/event/event-create-drawer";

export function EventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);

  // モックデータ
  const event = {
    id: eventId,
    name: "Q2製品アップデート案内",
    type: "Product Update",
    startDate: "2026-04-01",
    endDate: "2026-04-30",
    status: "active",
    overview:
      "Q2製品アップデートに関する新機能の案内を全顧客に向けて実施します。主要な新機能は3つ（AI機能強化、ダッシュボード改善、モバイル対応）で、各機能の詳細を段階的に案内し、活用を促進します。",
    target: "全顧客（300社）+ 見込み顧客（100社）",
    goal: "製品アップデート認知率 80%、新機能トライアル率 50%、満足度 4.5/5",
    owner: "山田 太郎",
    notes:
      "各Phaseに合わせた案内タイミングを調整。Setup Phase顧客には基本機能中心、Growth Phase以降には高度な活用法も案内。",
    attachments: [
      {
        id: "att_1",
        name: "Q2_製品アップデート_企画書.pdf",
        size: "2.4 MB",
        uploadedAt: "2026-03-15",
      },
      {
        id: "att_2",
        name: "新機能デモ動画.mp4",
        size: "45.8 MB",
        uploadedAt: "2026-03-18",
      },
    ],
    relatedAudience: [
      { id: "aud_1", name: "全顧客（Phase別セグメント）", count: 300 },
      { id: "aud_2", name: "見込み顧客リスト", count: 100 },
      { id: "aud_3", name: "パワーユーザー", count: 45 },
    ],
    relatedContent: [
      { id: "cnt_1", name: "新機能案内メール（Setup Phase向け）", type: "Email" },
      { id: "cnt_2", name: "新機能案内メール（Growth Phase向け）", type: "Email" },
      { id: "cnt_3", name: "AI機能詳細ガイド", type: "Document" },
      { id: "cnt_4", name: "ダッシュボード改善FAQ", type: "FAQ" },
      { id: "cnt_5", name: "モバイル対応プレスリリース", type: "Press Release" },
      { id: "cnt_6", name: "製品アップデート動画スクリプト", type: "Script" },
      { id: "cnt_7", name: "Webinar案内文", type: "Email" },
      { id: "cnt_8", name: "ブログ記事：新機能の活用法", type: "Blog" },
    ],
    relatedOutbound: [
      {
        id: "out_1",
        name: "Phase別メール配信（Setup）",
        channel: "Email",
        status: "sent",
        recipients: 80,
      },
      {
        id: "out_2",
        name: "Phase別メール配信（Growth）",
        channel: "Email",
        status: "sent",
        recipients: 150,
      },
      {
        id: "out_3",
        name: "Phase別メール配信（Expansion）",
        channel: "Email",
        status: "scheduled",
        recipients: 70,
      },
      {
        id: "out_4",
        name: "見込み顧客向けプレスリリース",
        channel: "Email",
        status: "draft",
        recipients: 100,
      },
      {
        id: "out_5",
        name: "Slack通知（パワーユーザー向け）",
        channel: "Slack",
        status: "sent",
        recipients: 45,
      },
    ],
    relatedCompanies: [
      { id: "cmp_1", name: "株式会社テクノロジーイノベーション", phase: "Growth" },
      { id: "cmp_2", name: "グローバルソリューションズ株式会社", phase: "Expansion" },
      { id: "cmp_3", name: "デジタルマーケティング株式会社", phase: "Setup" },
    ],
    relatedProjects: [
      { id: "prj_1", name: "プロジェクトA", company: "株式会社テクノロジーイノベーション" },
      { id: "prj_2", name: "プロジェクトB", company: "グローバルソリューションズ株式会社" },
    ],
    announcementCount: 245,
    reactionSummary: {
      opened: 198,
      clicked: 145,
      replied: 32,
      converted: 18,
    },
    nextActions: [
      "Phase別フォローアップ配信（4/10）",
      "Webinar開催（4/15）",
      "活用状況レポート作成（4/30）",
    ],
  };

  const eventTypeConfig: Record<string, { label: string; color: string }> = {
    "Product Update": {
      label: "Product Update",
      color: "bg-blue-50 text-blue-700 border-blue-200",
    },
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    active: {
      label: "開催中",
      color: "bg-green-100 text-green-800 border-green-200",
    },
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Event" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1400px] mx-auto p-6">
            {/* Back Button */}
            <Button
              variant="ghost"
              onClick={() => navigate("/events")}
              className="mb-4 text-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Event一覧に戻る
            </Button>

            {/* Header */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h1 className="text-2xl font-semibold text-slate-900">{event.name}</h1>
                    <Badge
                      variant="outline"
                      className={`${eventTypeConfig[event.type].color}`}
                    >
                      {eventTypeConfig[event.type].label}
                    </Badge>
                    <Badge variant="outline" className={`${statusConfig[event.status].color}`}>
                      {statusConfig[event.status].label}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">{event.overview}</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">期間</div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900">
                          {event.startDate} 〜 {event.endDate}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">担当者</div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900">{event.owner}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">対象</div>
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900">{event.target}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setEditDrawerOpen(true)}>
                    <Edit className="w-4 h-4 mr-2" />
                    編集
                  </Button>
                </div>
              </div>

              {/* Goal */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-900">目標</span>
                </div>
                <p className="text-sm text-blue-800">{event.goal}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-600">案内数</span>
                  <Send className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {event.announcementCount}
                </div>
              </div>
              <div className="bg-white border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-blue-700">開封率</span>
                  <Eye className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-blue-900">
                  {Math.round((event.reactionSummary.opened / event.announcementCount) * 100)}%
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {event.reactionSummary.opened}件
                </div>
              </div>
              <div className="bg-white border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-emerald-700">クリック率</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-emerald-900">
                  {Math.round((event.reactionSummary.clicked / event.announcementCount) * 100)}%
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {event.reactionSummary.clicked}件
                </div>
              </div>
              <div className="bg-white border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-purple-700">コンバージョン</span>
                  <CheckCircle className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-2xl font-bold text-purple-900">
                  {Math.round((event.reactionSummary.converted / event.announcementCount) * 100)}
                  %
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {event.reactionSummary.converted}件
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">概要</TabsTrigger>
                <TabsTrigger value="audience">
                  Audience ({event.relatedAudience.length})
                </TabsTrigger>
                <TabsTrigger value="content">
                  Content ({event.relatedContent.length})
                </TabsTrigger>
                <TabsTrigger value="outbound">
                  Outbound ({event.relatedOutbound.length})
                </TabsTrigger>
                <TabsTrigger value="companies">
                  Companies ({event.relatedCompanies.length})
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                {/* Notes */}
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">備考</h3>
                  <p className="text-sm text-slate-700">{event.notes}</p>
                </div>

                {/* Attachments */}
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    添付ファイル ({event.attachments.length})
                  </h3>
                  <div className="space-y-2">
                    {event.attachments.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <div>
                            <div className="text-sm font-medium text-slate-900">{file.name}</div>
                            <div className="text-xs text-slate-500">
                              {file.size} • {file.uploadedAt}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            <Eye className="w-3 h-3 mr-1" />
                            Preview
                          </Button>
                          <Button variant="outline" size="sm">
                            <Download className="w-3 h-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Next Actions */}
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">次のアクション</h3>
                  <ul className="space-y-2">
                    {event.nextActions.map((action, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle className="w-4 h-4 text-blue-600" />
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              </TabsContent>

              {/* Audience Tab */}
              <TabsContent value="audience" className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">
                      紐付けられたAudience
                    </h3>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Audienceを紐付ける
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {event.relatedAudience.map((aud) => (
                      <div
                        key={aud.id}
                        className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <Users className="w-5 h-5 text-purple-600" />
                          <div>
                            <div className="text-sm font-medium text-slate-900">{aud.name}</div>
                            <div className="text-xs text-slate-500">{aud.count} entities</div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <LinkIcon className="w-3 h-3 mr-1" />
                          開く
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Content Tab */}
              <TabsContent value="content" className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">関連Content</h3>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Contentを作成
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {event.relatedContent.map((cnt) => (
                      <div
                        key={cnt.id}
                        className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <div>
                            <div className="text-sm font-medium text-slate-900">{cnt.name}</div>
                            <div className="text-xs text-slate-500">{cnt.type}</div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <LinkIcon className="w-3 h-3 mr-1" />
                          開く
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Outbound Tab */}
              <TabsContent value="outbound" className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">関連Outbound</h3>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Outboundを起票
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {event.relatedOutbound.map((out) => (
                      <div
                        key={out.id}
                        className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <Send className="w-5 h-5 text-emerald-600" />
                          <div>
                            <div className="text-sm font-medium text-slate-900">{out.name}</div>
                            <div className="text-xs text-slate-500">
                              {out.channel} • {out.recipients}件 • {out.status}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <LinkIcon className="w-3 h-3 mr-1" />
                          開く
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Companies Tab */}
              <TabsContent value="companies" className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-4">対象Company</h3>
                  <div className="space-y-2">
                    {event.relatedCompanies.map((cmp) => (
                      <div
                        key={cmp.id}
                        className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <Building className="w-5 h-5 text-blue-600" />
                          <div>
                            <div className="text-sm font-medium text-slate-900">{cmp.name}</div>
                            <div className="text-xs text-slate-500">Phase: {cmp.phase}</div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <LinkIcon className="w-3 h-3 mr-1" />
                          開く
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-4">対象Project</h3>
                  <div className="space-y-2">
                    {event.relatedProjects.map((prj) => (
                      <div
                        key={prj.id}
                        className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <FolderOpen className="w-5 h-5 text-purple-600" />
                          <div>
                            <div className="text-sm font-medium text-slate-900">{prj.name}</div>
                            <div className="text-xs text-slate-500">{prj.company}</div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <LinkIcon className="w-3 h-3 mr-1" />
                          開く
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Edit Drawer */}
      <EventCreateDrawer
        open={editDrawerOpen}
        onOpenChange={setEditDrawerOpen}
        mode="edit"
        eventData={event}
      />
    </div>
  );
}
