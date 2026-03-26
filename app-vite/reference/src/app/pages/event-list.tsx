import { useState } from "react";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  Search,
  Calendar,
  Plus,
  Users,
  FileText,
  Send,
  Target,
  User,
  Copy,
  CalendarDays,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { EventCreateDrawer } from "../components/event/event-create-drawer";

// モックデータ
const mockEvents = [
  {
    id: "evt_1",
    name: "Q2製品アップデート案内",
    type: "Product Update",
    startDate: "2026-04-01",
    endDate: "2026-04-30",
    status: "active",
    targetSummary: "全顧客（300社）",
    owner: "山田 太郎",
    relatedAudience: 3,
    relatedContent: 8,
    relatedOutbound: 5,
    goalSummary: "製品アップデート認知率 80%",
    announcementCount: 245,
  },
  {
    id: "evt_2",
    name: "新規顧客向けWebinar「はじめての活用術」",
    type: "Webinar",
    startDate: "2026-03-20",
    endDate: "2026-03-27",
    status: "active",
    targetSummary: "新規導入企業（Setup Phase）",
    owner: "佐藤 花子",
    relatedAudience: 1,
    relatedContent: 4,
    relatedOutbound: 2,
    goalSummary: "参加率 60%、満足度 4.5/5",
    announcementCount: 82,
  },
  {
    id: "evt_3",
    name: "春の割引キャンペーン（アップセル対象）",
    type: "Discount",
    startDate: "2026-03-15",
    endDate: "2026-03-31",
    status: "active",
    targetSummary: "アップセル候補（50社）",
    owner: "田中 一郎",
    relatedAudience: 2,
    relatedContent: 5,
    relatedOutbound: 3,
    goalSummary: "成約率 20%、追加ARR ¥15M",
    announcementCount: 120,
  },
  {
    id: "evt_4",
    name: "Beta Program: AI機能先行体験",
    type: "Beta Program",
    startDate: "2026-02-15",
    endDate: "2026-04-15",
    status: "active",
    targetSummary: "先進的顧客（20社）",
    owner: "鈴木 次郎",
    relatedAudience: 1,
    relatedContent: 12,
    relatedOutbound: 8,
    goalSummary: "フィードバック収集、製品改善",
    announcementCount: 65,
  },
  {
    id: "evt_5",
    name: "オフラインユーザーカンファレンス 2026",
    type: "Offline Event",
    startDate: "2026-05-10",
    endDate: "2026-05-11",
    status: "scheduled",
    targetSummary: "優良顧客（100社招待）",
    owner: "高橋 三郎",
    relatedAudience: 2,
    relatedContent: 15,
    relatedOutbound: 0,
    goalSummary: "参加率 70%、NPS向上",
    announcementCount: 0,
  },
  {
    id: "evt_6",
    name: "チャーン防止キャンペーン（Q1リスク対象）",
    type: "Campaign",
    startDate: "2026-01-15",
    endDate: "2026-02-28",
    status: "completed",
    targetSummary: "At-Risk顧客（30社）",
    owner: "伊藤 美咲",
    relatedAudience: 1,
    relatedContent: 6,
    relatedOutbound: 4,
    goalSummary: "チャーン回避率 80%",
    announcementCount: 95,
  },
  {
    id: "evt_7",
    name: "PoC共創プログラム：大規模エンタープライズ向け",
    type: "PoC Program",
    startDate: "2026-03-01",
    endDate: "2026-06-30",
    status: "active",
    targetSummary: "エンタープライズ候補（5社）",
    owner: "渡辺 健太",
    relatedAudience: 1,
    relatedContent: 20,
    relatedOutbound: 12,
    goalSummary: "PoC成功率 100%、契約転換率 80%",
    announcementCount: 48,
  },
  {
    id: "evt_8",
    name: "プロモーション：Q2新機能先行案内",
    type: "Promotion",
    startDate: "2026-04-15",
    endDate: "2026-05-15",
    status: "scheduled",
    targetSummary: "全顧客 + リード",
    owner: "小林 愛",
    relatedAudience: 4,
    relatedContent: 10,
    relatedOutbound: 0,
    goalSummary: "リード獲得 500件、商談化率 10%",
    announcementCount: 0,
  },
];

const eventTypeConfig: Record<
  string,
  { label: string; color: string }
> = {
  "Product Update": {
    label: "Product Update",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  Promotion: {
    label: "Promotion",
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  Discount: {
    label: "Discount",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  "Offline Event": {
    label: "Offline Event",
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },
  Webinar: {
    label: "Webinar",
    color: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  "PoC Program": {
    label: "PoC Program",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  "Beta Program": {
    label: "Beta Program",
    color: "bg-pink-50 text-pink-700 border-pink-200",
  },
  "Co-creation": {
    label: "Co-creation",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  Campaign: {
    label: "Campaign",
    color: "bg-violet-50 text-violet-700 border-violet-200",
  },
  Custom: {
    label: "Custom",
    color: "bg-slate-50 text-slate-700 border-slate-200",
  },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  scheduled: {
    label: "予定",
    color: "bg-slate-100 text-slate-700 border-slate-200",
  },
  active: {
    label: "開催中",
    color: "bg-green-100 text-green-800 border-green-200",
  },
  completed: {
    label: "終了",
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  cancelled: {
    label: "中止",
    color: "bg-red-100 text-red-700 border-red-200",
  },
};

export function EventList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);

  const filteredEvents = mockEvents.filter((event) => {
    const matchesSearch =
      event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.targetSummary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.owner.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || event.type === typeFilter;
    const matchesStatus =
      statusFilter === "all" || event.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const activeEventsCount = mockEvents.filter((e) => e.status === "active").length;
  const scheduledEventsCount = mockEvents.filter((e) => e.status === "scheduled").length;

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Event" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1800px] mx-auto p-6">
            {/* Page Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-slate-900 mb-2">Event</h1>
              <p className="text-sm text-slate-600">
                特定期間の施策・企画を管理し、Audience / Content / Outbound と接続します
              </p>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-600">Total Events</span>
                  <Calendar className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{mockEvents.length}</div>
              </div>
              <div className="bg-white border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-green-700">開催中</span>
                  <CalendarDays className="w-4 h-4 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-green-900">{activeEventsCount}</div>
              </div>
              <div className="bg-white border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-blue-700">予定</span>
                  <Target className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-blue-900">{scheduledEventsCount}</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-600">Total Announcements</span>
                  <Send className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {mockEvents.reduce((sum, e) => sum + e.announcementCount, 0)}
                </div>
              </div>
            </div>

            {/* Filters and Actions */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Event名、対象、担当者で検索..."
                    className="pl-9 text-sm"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-48 text-sm">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべてのType</SelectItem>
                    {Object.keys(eventTypeConfig).map((type) => (
                      <SelectItem key={type} value={type}>
                        {eventTypeConfig[type].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべてのStatus</SelectItem>
                    {Object.keys(statusConfig).map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusConfig[status].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => navigate("/events/calendar")}
                  variant="outline"
                  className="text-sm"
                >
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Calendar表示
                </Button>
                <Button onClick={() => setCreateDrawerOpen(true)} className="text-sm">
                  <Plus className="w-4 h-4 mr-2" />
                  新規Event作成
                </Button>
              </div>
            </div>

            {/* Event List Table */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Event名</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>期間</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>対象</TableHead>
                    <TableHead>担当者</TableHead>
                    <TableHead className="text-center">Audience</TableHead>
                    <TableHead className="text-center">Content</TableHead>
                    <TableHead className="text-center">Outbound</TableHead>
                    <TableHead className="text-center">案内数</TableHead>
                    <TableHead>目標</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-12 text-slate-400">
                        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <div className="text-sm">検索条件に一致するEventがありません</div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEvents.map((event) => (
                      <TableRow
                        key={event.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => navigate(`/events/${event.id}`)}
                      >
                        <TableCell>
                          <div className="font-medium text-slate-900 text-sm">
                            {event.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${eventTypeConfig[event.type].color} text-xs`}
                          >
                            {eventTypeConfig[event.type].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-slate-600">
                            {event.startDate} 〜 {event.endDate}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${statusConfig[event.status].color} text-xs`}
                          >
                            {statusConfig[event.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-slate-600">{event.targetSummary}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-slate-400" />
                            <span className="text-xs text-slate-700">{event.owner}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Users className="w-3 h-3 text-purple-600" />
                            <span className="text-xs font-medium text-slate-900">
                              {event.relatedAudience}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <FileText className="w-3 h-3 text-blue-600" />
                            <span className="text-xs font-medium text-slate-900">
                              {event.relatedContent}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Send className="w-3 h-3 text-emerald-600" />
                            <span className="text-xs font-medium text-slate-900">
                              {event.relatedOutbound}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs font-semibold text-slate-900">
                            {event.announcementCount}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-slate-600 max-w-[200px] truncate">
                            {event.goalSummary}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log("複製:", event.id);
                              }}
                            >
                              <Copy className="w-3 h-3 text-slate-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </main>
      </div>

      {/* Create Drawer */}
      <EventCreateDrawer open={createDrawerOpen} onOpenChange={setCreateDrawerOpen} />
    </div>
  );
}
