import { useState } from "react";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  User,
  Users,
  FileText,
  Send,
} from "lucide-react";
import { useNavigate } from "react-router";
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
  },
];

const eventTypeConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  "Product Update": {
    label: "Product Update",
    color: "text-blue-700",
    bgColor: "bg-blue-100 border-blue-300",
  },
  Promotion: {
    label: "Promotion",
    color: "text-purple-700",
    bgColor: "bg-purple-100 border-purple-300",
  },
  Discount: {
    label: "Discount",
    color: "text-emerald-700",
    bgColor: "bg-emerald-100 border-emerald-300",
  },
  "Offline Event": {
    label: "Offline Event",
    color: "text-orange-700",
    bgColor: "bg-orange-100 border-orange-300",
  },
  Webinar: {
    label: "Webinar",
    color: "text-cyan-700",
    bgColor: "bg-cyan-100 border-cyan-300",
  },
  "PoC Program": {
    label: "PoC Program",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100 border-indigo-300",
  },
  "Beta Program": {
    label: "Beta Program",
    color: "text-pink-700",
    bgColor: "bg-pink-100 border-pink-300",
  },
  Campaign: {
    label: "Campaign",
    color: "text-violet-700",
    bgColor: "bg-violet-100 border-violet-300",
  },
};

export function EventCalendar() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 17)); // March 17, 2026
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // カレンダーの日付生成
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    // 前月の日付で埋める
    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevMonthDay = new Date(year, month, -startingDayOfWeek + i + 1);
      days.push({ date: prevMonthDay, isCurrentMonth: false });
    }
    // 当月の日付
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    // 次月の日付で埋める
    const remainingDays = 42 - days.length; // 6週間分
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  };

  // 日付がイベント期間内かチェック
  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return mockEvents.filter((event) => {
      return dateStr >= event.startDate && dateStr <= event.endDate;
    });
  };

  const days = getDaysInMonth(currentDate);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date(2026, 2, 17)); // Today in the mock
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Event" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1800px] mx-auto p-6">
            {/* Page Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-semibold text-slate-900 mb-2">Event Calendar</h1>
                  <p className="text-sm text-slate-600">
                    Eventを期間・種別・担当者で俯瞰できます
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={() => navigate("/events")}>
                    <List className="w-4 h-4 mr-2" />
                    リスト表示
                  </Button>
                  <Button onClick={() => setCreateDrawerOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    新規Event作成
                  </Button>
                </div>
              </div>
            </div>

            {/* Calendar Controls */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="text-lg font-semibold text-slate-900 min-w-[200px] text-center">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </div>
                  <Button variant="outline" size="sm" onClick={goToNextMonth}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    Today
                  </Button>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 mr-2">Event Type:</span>
                  {Object.keys(eventTypeConfig)
                    .slice(0, 5)
                    .map((type) => (
                      <div key={type} className="flex items-center gap-1">
                        <div
                          className={`w-3 h-3 rounded ${eventTypeConfig[type].bgColor}`}
                        ></div>
                        <span className="text-xs text-slate-600">
                          {eventTypeConfig[type].label}
                        </span>
                      </div>
                    ))}
                  <span className="text-xs text-slate-500">...</span>
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              {/* Week Day Headers */}
              <div className="grid grid-cols-7 border-b border-slate-200">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="p-3 text-center text-xs font-semibold text-slate-600 border-r last:border-r-0"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7">
                {days.map((day, idx) => {
                  const events = getEventsForDate(day.date);
                  const isToday =
                    day.date.toISOString().split("T")[0] === "2026-03-17";
                  return (
                    <div
                      key={idx}
                      className={`min-h-[120px] p-2 border-r border-b last:border-r-0 ${
                        !day.isCurrentMonth ? "bg-slate-50" : "bg-white"
                      } ${isToday ? "bg-blue-50" : ""}`}
                    >
                      <div
                        className={`text-xs font-medium mb-2 ${
                          day.isCurrentMonth ? "text-slate-900" : "text-slate-400"
                        } ${isToday ? "text-blue-600 font-bold" : ""}`}
                      >
                        {day.date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {events.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            onClick={() => navigate(`/events/${event.id}`)}
                            className={`
                              px-2 py-1 rounded text-xs cursor-pointer
                              border ${eventTypeConfig[event.type].bgColor}
                              ${eventTypeConfig[event.type].color}
                              hover:shadow-sm transition-all
                            `}
                          >
                            <div className="font-medium truncate">{event.name}</div>
                            <div className="flex items-center gap-1 mt-0.5 text-xs opacity-80">
                              <User className="w-2.5 h-2.5" />
                              <span className="truncate">{event.owner}</span>
                            </div>
                          </div>
                        ))}
                        {events.length > 3 && (
                          <div className="text-xs text-slate-500 pl-2">
                            +{events.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Event Summary */}
            <div className="mt-6 bg-white border border-slate-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">
                {monthNames[currentDate.getMonth()]} のEvent一覧
              </h3>
              <div className="space-y-2">
                {mockEvents
                  .filter((event) => {
                    const eventDate = new Date(event.startDate);
                    return (
                      eventDate.getMonth() === currentDate.getMonth() &&
                      eventDate.getFullYear() === currentDate.getFullYear()
                    );
                  })
                  .map((event) => (
                    <div
                      key={event.id}
                      onClick={() => navigate(`/events/${event.id}`)}
                      className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="text-sm font-medium text-slate-900">{event.name}</div>
                          <div className="text-xs text-slate-500">
                            {event.startDate} 〜 {event.endDate} • {event.owner}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`${eventTypeConfig[event.type].bgColor} ${eventTypeConfig[event.type].color}`}
                      >
                        {eventTypeConfig[event.type].label}
                      </Badge>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Create Drawer */}
      <EventCreateDrawer open={createDrawerOpen} onOpenChange={setCreateDrawerOpen} />
    </div>
  );
}
