import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { ViewSwitcher } from "../components/ui/view-switcher";
import { ViewContextHeader } from "../components/ui/view-context-header";
import { AlertTriangle, Clock, CheckSquare, Send, FileText, Users, Building, Inbox as InboxIcon, ArrowRight, TrendingUp, Database, Calendar, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { useState, useEffect } from "react";
import { fetchAllCompanies, fetchAlerts } from "../../services/nocodb";
import type { AppCompany, AppAlert } from "../../services/nocodb";

// モックデータ - 全Company（ownerフィールド追加）
const allCompanies = [
  {
    id: "1",
    name: "株式会社テクノロジーイノベーション",
    phaseLabel: "Setup",
    openAlerts: 3,
    unprocessedMinutes: 8,
    openActions: 5,
    riskLevel: "high" as const,
    lastContact: "2026-03-10",
    priority: "urgent",
    reason: "決裁者会議欠席・遅延懸念",
    owner: "佐藤 太郎",
  },
  {
    id: "5",
    name: "クラウドインフラサービス",
    phaseLabel: "Activation",
    openAlerts: 4,
    unprocessedMinutes: 15,
    openActions: 9,
    riskLevel: "high" as const,
    lastContact: "2026-03-07",
    priority: "urgent",
    reason: "Health Score低下・接点減少",
    owner: "田中 花子",
  },
  {
    id: "3",
    name: "エンタープライズシステムズ",
    phaseLabel: "Engagement",
    openAlerts: 2,
    unprocessedMinutes: 12,
    openActions: 7,
    riskLevel: "medium" as const,
    lastContact: "2026-03-08",
    priority: "high",
    reason: "未処理Minutes蓄積",
    owner: "佐藤 太郎",
  },
  {
    id: "2",
    name: "グローバルソリューションズ株式会社",
    phaseLabel: "Optimization",
    openAlerts: 0,
    unprocessedMinutes: 3,
    openActions: 2,
    riskLevel: "low" as const,
    lastContact: "2026-03-09",
    priority: "normal",
    reason: "定期フォローアップ",
    owner: "田中 花子",
  },
  {
    id: "7",
    name: "株式会社FinTechパートナーズ",
    phaseLabel: "Engagement",
    openAlerts: 1,
    unprocessedMinutes: 5,
    openActions: 4,
    riskLevel: "medium" as const,
    lastContact: "2026-03-09",
    priority: "normal",
    reason: "Phase進捗確認",
    owner: "佐藤 太郎",
  },
  {
    id: "4",
    name: "デジタルマーケティング株式会社",
    phaseLabel: "Expantion",
    openAlerts: 0,
    unprocessedMinutes: 0,
    openActions: 1,
    riskLevel: "low" as const,
    lastContact: "2026-03-11",
    priority: "normal",
    reason: "Expansion機会検討",
    owner: "鈴木 次郎",
  },
  {
    id: "6",
    name: "AIソリューションズ株式会社",
    phaseLabel: "Optimization",
    openAlerts: 0,
    unprocessedMinutes: 2,
    openActions: 3,
    riskLevel: "none" as const,
    lastContact: "2026-03-10",
    priority: "normal",
    reason: "定期レビュー",
    owner: "鈴木 次郎",
  },
  {
    id: "8",
    name: "株式会社メディカルテック",
    phaseLabel: "Setup",
    openAlerts: 3,
    unprocessedMinutes: 10,
    openActions: 6,
    riskLevel: "high" as const,
    lastContact: "2026-03-06",
    priority: "high",
    reason: "Setup遅延リスク",
    owner: "田中 花子",
  },
];

const priorityProjects = [
  {
    id: "proj_1",
    name: "プロジェクトA",
    company: "株式会社テクノロジーイノベーション",
    companyId: "1",
    phase: "A-Phase: Adoption",
    alerts: 2,
    status: "at_risk",
    users: 12,
  },
  {
    id: "proj_3",
    name: "プロジェクトC",
    company: "クラウドインフラサービス",
    companyId: "5",
    phase: "A-Phase: Activation",
    alerts: 3,
    status: "at_risk",
    users: 8,
  },
  {
    id: "proj_5",
    name: "プロジェクトE",
    company: "グローバルソリューションズ株式会社",
    companyId: "2",
    phase: "A-Phase: Expansion",
    alerts: 0,
    status: "opportunity",
    users: 24,
  },
];

const criticalAlerts = [
  {
    id: "alert_1",
    type: "risk" as const,
    severity: "high" as const,
    title: "オンボーディング遅延の兆候",
    company: "株式会社テクノロジーイノベーション",
    companyId: "1",
    timestamp: "2026-03-10 14:30",
  },
  {
    id: "alert_2",
    type: "risk" as const,
    severity: "high" as const,
    title: "Health Score急落",
    company: "クラウドインフラサービス",
    companyId: "5",
    timestamp: "2026-03-09 10:15",
  },
  {
    id: "alert_3",
    type: "opportunity" as const,
    severity: "high" as const,
    title: "追加ライセンス検討の可能性",
    company: "グローバルソリューションズ株式会社",
    companyId: "2",
    timestamp: "2026-03-09 16:00",
  },
];

const outboundCandidates = [
  {
    id: "outbound_1",
    name: "週次レポート配信",
    channel: "Email",
    audience: "アクティブ顧客全体",
    recipients: 45,
    status: "draft",
  },
  {
    id: "outbound_2",
    name: "オンボーディング遅延フォローアップ",
    channel: "Slack",
    audience: "Setup Phase顧客",
    recipients: 8,
    status: "review_required",
  },
];

const workflowCandidates = [
  {
    id: "action_1",
    type: "action",
    title: "決裁者との1on1ミーティング設定",
    company: "株式会社テクノロジーイノベーション",
    companyId: "1",
    priority: "high",
  },
  {
    id: "action_2",
    type: "action",
    title: "追加トレーニングセッション実施",
    company: "クラウドインフラサービス",
    companyId: "5",
    priority: "high",
  },
  {
    id: "content_1",
    type: "content",
    title: "新機能紹介資料作成",
    company: "グローバルソリューションズ株式会社",
    companyId: "2",
    priority: "medium",
  },
];

// 開催中Event（自分の担当顧客に関連するもの）
const activeEvents = [
  {
    id: "evt_1",
    name: "Q2製品アップデート案内",
    type: "Product Update",
    startDate: "2026-04-01",
    endDate: "2026-04-30",
    status: "active",
    myCustomerCount: 15,
    totalTargetCount: 300,
    unsentCount: 8,
  },
  {
    id: "evt_2",
    name: "新規顧客向けWebinar「はじめての活用術」",
    type: "Webinar",
    startDate: "2026-03-20",
    endDate: "2026-03-27",
    status: "active",
    myCustomerCount: 3,
    totalTargetCount: 82,
    unsentCount: 3,
  },
];

const riskColors = {
  high: "text-red-700 bg-red-50 border-red-200",
  medium: "text-orange-700 bg-orange-50 border-orange-200",
  low: "text-yellow-700 bg-yellow-50 border-yellow-200",
  none: "text-gray-700 bg-gray-50 border-gray-200",
};

const alertTypeColors = {
  risk: "text-red-700 bg-red-50 border-red-200",
  opportunity: "text-emerald-700 bg-emerald-50 border-emerald-200",
};

export function Console() {
  // ─── NocoDB データ取得 ───────────────────────────────────────────────────
  // 取得成功時は API データ、失敗時はファイル内 mock データにフォールバックします。
  const [apiCompanies, setApiCompanies] = useState<AppCompany[] | null>(null);
  const [apiAlerts, setApiAlerts]       = useState<AppAlert[]   | null>(null);
  const [loadError, setLoadError]       = useState<string | null>(null);

  useEffect(() => {
    fetchAllCompanies(50)
      .then(setApiCompanies)
      .catch(err => {
        console.warn('[Console] companies fetch failed, using mock:', err);
        setLoadError('データ取得に失敗しました（mock表示中）');
      });

    fetchAlerts()
      .then(setApiAlerts)
      .catch(err => {
        console.warn('[Console] alerts fetch failed, using mock:', err);
      });
  }, []);

  // View state (Default: My View)
  const [currentView, setCurrentView] = useState("my");

  // Mock current user
  const currentUserName = "佐藤 太郎";

  // View definitions
  const views = [
    { value: "my", label: "My View", description: "自分の担当顧客と優先タスク", isDefault: true },
    { value: "priority", label: "My Priorities", description: "優先対応が必要な業務" },
    { value: "team", label: "Team View", description: "チーム全体の状況" },
    { value: "all", label: "All", description: "全体俯瞰" },
  ];

  // View configurations
  const viewConfig: Record<string, {
    subtitle: string;
    filter: (company: typeof allCompanies[0]) => boolean;
  }> = {
    my: {
      subtitle: "自分の担当顧客と優先タスクを確認する",
      filter: (company) => company.owner === currentUserName,
    },
    priority: {
      subtitle: "優先対応が必要な業務を確認する",
      filter: (company) => company.owner === currentUserName && (company.riskLevel === "high" || company.priority === "urgent" || company.openActions > 5),
    },
    team: {
      subtitle: "チーム全体の状況を確認する",
      filter: (company) => true, // Mock: 全顧客をチーム対象とする
    },
    all: {
      subtitle: "全顧客・全案件・全業務を横断して確認する",
      filter: (company) => true,
    },
  };

  const config = viewConfig[currentView];
  const currentViewLabel = views.find(v => v.value === currentView)?.label || "";

  // API データがあればそちらを使い、なければ mock にフォールバック
  // API 時: is_csm_managed=true の96社のみ取得済み（NocoDB側でフィルタ済み）
  const companiesSource = apiCompanies ?? allCompanies;

  // My View / Priority View フィルタ:
  //   API 使用時は owner_name が入っているが、認証未実装のため currentUserName と一致しない。
  //   マッチしない場合は全 CSM 管理企業を表示する（ゼロ件表示を避ける）。
  const apiOwnerFilter = (c: typeof allCompanies[0]) => c.owner === currentUserName;
  const anyOwnerMatch = apiCompanies != null && apiCompanies.some(apiOwnerFilter);

  const effectiveFilter = apiCompanies != null
    ? (currentView === 'my' || currentView === 'priority')
      ? anyOwnerMatch ? apiOwnerFilter : (_c: typeof allCompanies[0]) => true
      : config.filter
    : config.filter;

  const todayCompanies = companiesSource
    .filter(effectiveFilter)
    .sort((a, b) => {
      // API データはすでに open_alert_count 降順でソート済み。
      // モック時は priority 順でソート。
      const priorityOrder = { urgent: 3, high: 2, normal: 1 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
      return bPriority - aPriority;
    })
    .slice(0, 5);

  const alertsSource = apiAlerts ?? criticalAlerts;

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Console" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1800px] mx-auto p-6">
            {/* API エラー時バナー */}
            {loadError && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-800">
                ⚠ {loadError}
              </div>
            )}
            {/* Header with Current View */}
            <div className="mb-6 flex items-center justify-between">
              <ViewContextHeader
                pageName="Console"
                currentView={currentViewLabel}
                subtitle={config.subtitle}
              />
              <ViewSwitcher
                currentView={currentView}
                views={views}
                onViewChange={setCurrentView}
              />
            </div>

            {/* Active Events Banner */}
            {activeEvents.length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-6">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <div className="flex-1 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-purple-900">開催中Event:</span>
                      <Badge className="bg-purple-600 text-white text-xs h-4">
                        {activeEvents.length}件
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {activeEvents.map((event) => (
                        <div key={event.id} className="flex items-center gap-2">
                          <Link
                            to={`/events/${event.id}`}
                            className="text-xs font-medium text-purple-700 hover:text-purple-900 hover:underline"
                          >
                            {event.name}
                          </Link>
                          <span className="text-xs text-purple-600">
                            (自分: {event.myCustomerCount}社
                            {event.unsentCount > 0 && (
                              <span className="text-amber-700 font-medium"> • 未配信: {event.unsentCount}</span>
                            )}
                            )
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link to="/events">
                      <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
                        一覧
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Navigation CTAs */}
            <div className="grid grid-cols-6 gap-3 mb-6">
              <Link to="/companies/1">
                <Button variant="outline" className="w-full justify-start h-12">
                  <Building className="w-4 h-4 mr-2" />
                  Company
                </Button>
              </Link>
              <Link to="/projects">
                <Button variant="outline" className="w-full justify-start h-12">
                  <Users className="w-4 h-4 mr-2" />
                  Projects
                </Button>
              </Link>
              <Link to="/inbox">
                <Button variant="outline" className="w-full justify-start h-12">
                  <InboxIcon className="w-4 h-4 mr-2" />
                  Inbox
                </Button>
              </Link>
              <Link to="/actions">
                <Button variant="outline" className="w-full justify-start h-12">
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Actions
                </Button>
              </Link>
              <Link to="/content">
                <Button variant="outline" className="w-full justify-start h-12">
                  <FileText className="w-4 h-4 mr-2" />
                  Content
                </Button>
              </Link>
              <Link to="/outbound">
                <Button variant="outline" className="w-full justify-start h-12">
                  <Send className="w-4 h-4 mr-2" />
                  Outbound
                </Button>
              </Link>
            </div>

            {/* 2-Column Layout */}
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                {/* 今日見るべきCompany */}
                <div className="bg-white border rounded-lg">
                  <div className="p-4 border-b bg-slate-50">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-slate-900">今日見るべきCompany</h2>
                      <Badge variant="outline" className="text-xs bg-red-100">
                        優先: {todayCompanies.filter(c => c.priority === "urgent").length}件
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {todayCompanies.map((company) => (
                      <div key={company.id} className={`border rounded-lg p-3 ${riskColors[company.riskLevel]}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <Link 
                              to={`/companies/${company.id}`}
                              className="font-medium text-slate-900 hover:text-blue-600 hover:underline"
                            >
                              {company.name}
                            </Link>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {company.phaseLabel}
                              </Badge>
                              {company.priority === "urgent" && (
                                <Badge className="text-xs bg-red-500">緊急</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-slate-700 mb-2">
                          <span className="font-medium">理由:</span> {company.reason}
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Alerts: {company.openAlerts}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Minutes: {company.unprocessedMinutes}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <CheckSquare className="w-3 h-3" />
                            <span>Actions: {company.openActions}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Link to="/companies/1">
                      <Button variant="ghost" size="sm" className="w-full">
                        全Company一覧を見る
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* 優先Project群 */}
                <div className="bg-white border rounded-lg">
                  <div className="p-4 border-b bg-slate-50">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-slate-900">優先Project群</h2>
                      <Badge variant="outline" className="text-xs">
                        {priorityProjects.length}件
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {priorityProjects.map((project) => (
                      <div key={project.id} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <Link 
                              to={`/project/${project.id}`}
                              className="font-medium text-slate-900 hover:text-blue-600 hover:underline"
                            >
                              {project.name}
                            </Link>
                            <div className="text-xs text-slate-600 mt-1">
                              <Link 
                                to={`/companies/${project.companyId}`}
                                className="hover:text-blue-600 hover:underline"
                              >
                                {project.company}
                              </Link>
                            </div>
                          </div>
                          {project.status === "at_risk" && (
                            <Badge className="text-xs bg-red-500">At Risk</Badge>
                          )}
                          {project.status === "opportunity" && (
                            <Badge className="text-xs bg-emerald-500">Opportunity</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          <span>{project.phase}</span>
                          {project.alerts > 0 && (
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-red-500" />
                              <span>{project.alerts}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>{project.users}名</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Link to="/projects">
                      <Button variant="ghost" size="sm" className="w-full">
                        Projects横断分析を見る
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Outbound候補 */}
                <div className="bg-white border rounded-lg">
                  <div className="p-4 border-b bg-slate-50">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-slate-900">Outbound候補</h2>
                      <Badge variant="outline" className="text-xs">
                        {outboundCandidates.length}件
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {outboundCandidates.map((outbound) => (
                      <div key={outbound.id} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-slate-900">{outbound.name}</div>
                            <div className="text-xs text-slate-600 mt-1">
                              {outbound.channel} → {outbound.audience}
                            </div>
                          </div>
                          {outbound.status === "draft" && (
                            <Badge variant="outline" className="text-xs bg-slate-100">Draft</Badge>
                          )}
                          {outbound.status === "review_required" && (
                            <Badge variant="outline" className="text-xs bg-amber-100">Review要</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-slate-600">
                            <Users className="w-3 h-3 inline mr-1" />
                            {outbound.recipients}名
                          </div>
                          <Link to={`/outbound/compose?id=${outbound.id}`}>
                            <Button variant="ghost" size="sm" className="text-xs h-7">
                              Composeで開く
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                    <Link to="/outbound">
                      <Button variant="ghost" size="sm" className="w-full">
                        Outbound一覧を見る
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* 重要Alert */}
                <div className="bg-white border rounded-lg">
                  <div className="p-4 border-b bg-slate-50">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-slate-900">重要Alert</h2>
                      <Badge className="text-xs bg-red-500">
                        {alertsSource.filter(a => a.type === "risk").length}件
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {alertsSource.map((alert) => (
                      <div key={alert.id} className={`border rounded-lg p-3 ${alertTypeColors[alert.type]}`}>
                        <div className="flex items-start gap-2 mb-2">
                          <AlertTriangle className={`w-4 h-4 mt-0.5 ${alert.type === "risk" ? "text-red-600" : "text-emerald-600"}`} />
                          <div className="flex-1">
                            <div className="font-medium text-slate-900">{alert.title}</div>
                            <div className="text-xs text-slate-600 mt-1">
                              <Link 
                                to={`/companies/${alert.companyId}`}
                                className="hover:text-blue-600 hover:underline"
                              >
                                {alert.company}
                              </Link>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">
                          {alert.timestamp}
                        </div>
                      </div>
                    ))}
                    <Link to="/inbox">
                      <Button variant="ghost" size="sm" className="w-full">
                        Inboxで全て見る
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Workflow候補 (Actions / Content) */}
                <div className="bg-white border rounded-lg">
                  <div className="p-4 border-b bg-slate-50">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-slate-900">Workflow候補</h2>
                      <Badge variant="outline" className="text-xs">
                        {workflowCandidates.length}件
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {workflowCandidates.map((item) => (
                      <div key={item.id} className="border rounded-lg p-3">
                        <div className="flex items-start gap-2 mb-2">
                          {item.type === "action" && <CheckSquare className="w-4 h-4 text-blue-600 mt-0.5" />}
                          {item.type === "content" && <FileText className="w-4 h-4 text-purple-600 mt-0.5" />}
                          <div className="flex-1">
                            <div className="font-medium text-slate-900">{item.title}</div>
                            <div className="text-xs text-slate-600 mt-1">
                              <Link 
                                to={`/companies/${item.companyId}`}
                                className="hover:text-blue-600 hover:underline"
                              >
                                {item.company}
                              </Link>
                            </div>
                          </div>
                          {item.priority === "high" && (
                            <Badge className="text-xs bg-orange-500">High</Badge>
                          )}
                          {item.priority === "medium" && (
                            <Badge variant="outline" className="text-xs">Medium</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-end">
                          <Link to={item.type === "action" ? "/actions" : "/content"}>
                            <Button variant="ghost" size="sm" className="text-xs h-7">
                              {item.type === "action" ? "Actions" : "Content"}で開く
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Link to="/actions" className="flex-1">
                        <Button variant="ghost" size="sm" className="w-full">
                          Actions
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>
                      <Link to="/content" className="flex-1">
                        <Button variant="ghost" size="sm" className="w-full">
                          Content
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-3">今日の概況</h3>
                  <div className="space-y-2 text-sm text-blue-800">
                    <div className="flex items-center justify-between">
                      <span>緊急対応Company:</span>
                      <span className="font-semibold">{todayCompanies.filter(c => c.priority === "urgent").length}件</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>At Risk Projects:</span>
                      <span className="font-semibold">{priorityProjects.filter(p => p.status === "at_risk").length}件</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Critical Alerts:</span>
                      <span className="font-semibold">{alertsSource.filter(a => a.type === "risk").length}件</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Outbound Review待ち:</span>
                      <span className="font-semibold">{outboundCandidates.filter(o => o.status === "review_required").length}件</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}