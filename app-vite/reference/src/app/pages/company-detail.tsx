import { useState } from "react";
import { useParams, Link } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { EvidenceCard } from "../components/cards/evidence-card";
import { PeopleCard } from "../components/cards/people-card";
import { ActionCard } from "../components/cards/action-card";
import { AlertCard } from "../components/cards/alert-card";
import { PeopleOrgChart } from "../components/org-chart/people-org-chart";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Building, Users, AlertTriangle, CheckSquare, Clock, ExternalLink, Sparkles, Network, ArrowRight, Send, Database, FileText, BookOpen, Calendar, Headphones } from "lucide-react";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";

// モックデータ
const mockCompany = {
  name: "株式会社テクノロジーイノベーション",
  phaseLabel: "Onboarding",
  phaseSource: "Salesforce Opportunity Stage",
  projects: ["プロジェクトA", "プロジェクトB"],
  openAlerts: 3,
  openActions: 5,
  lastContact: "2026-03-10",
};

// このCompanyに関連するEvent
const relatedEvents = [
  {
    id: "evt_1",
    name: "Q2製品アップデート案内",
    type: "Product Update",
    status: "active",
    startDate: "2026-04-01",
    endDate: "2026-04-30",
    sent: true,
    unsentCount: 0,
  },
];

// このCompanyに関連するSupport
const relatedSupport = [
  {
    id: "sup_1",
    title: "レポート出力時のデータ欠損",
    caseType: "Support",
    source: "Slack",
    routingStatus: "in progress",
    severity: "medium",
    createdAt: "2026-03-17 13:45",
  },
  {
    id: "cse_1",
    title: "[CSE-1234] データ同期エラーの調査",
    caseType: "CSE Ticket Linked",
    source: "CSE Ticket",
    routingStatus: "waiting on CSE",
    severity: "high",
    createdAt: "2026-03-17 11:20",
    linkedTicket: "CSE-1234",
  },
];

const mockAlerts = [
  {
    id: "1",
    type: "risk" as const,
    severity: "high" as const,
    title: "オンボーディング遅延の兆候",
    description: "予定より2週間遅れており、決裁者からの反応が減少しています",
    evidenceCount: 4,
    timestamp: "2026-03-10 14:30",
  },
  {
    id: "2",
    type: "opportunity" as const,
    severity: "high" as const,
    title: "追加ライセンス検討の可能性",
    description: "営業部長から「他部署での導入も検討したい」との発言がありました",
    evidenceCount: 2,
    timestamp: "2026-03-09 16:00",
  },
];

const mockEvidence = [
  {
    id: "1",
    date: "2026-03-10",
    title: "週次MTG議事録 - オンボーディング進捗確認",
    sourceType: "minutes" as const,
    messageType: "meeting",
    status: "unprocessed" as const,
    scope: "Company",
    ownerRole: "CSM",
    excerpt: "決裁者の山田氏が会議を欠席。進捗が停滞している可能性について懸念を表明。",
    sourceUrl: "#",
  },
  {
    id: "2",
    date: "2026-03-09",
    title: "お問い合わせ: データ連携機能の詳細について",
    sourceType: "inquiry" as const,
    messageType: "inquiry",
    status: "proposal_generated" as const,
    scope: "Project / プロジェクトA",
    ownerRole: "Engineer",
    excerpt: "既存システとのAPI連携について、技術的な詳細を確認したいとの要望。",
    sourceUrl: "#",
  },
  {
    id: "3",
    date: "2026-03-08",
    title: "メール: 追加トレーニング依頼",
    sourceType: "mail" as const,
    messageType: "request",
    status: "confirmed" as const,
    scope: "User / 田中様",
    ownerRole: "CSM",
    excerpt: "管理画面の操作方法について、追加のトレーニングセッションを希望。",
    sourceUrl: "#",
  },
  {
    id: "4",
    date: "2026-03-07",
    title: "サポートチケット #1234: ログインエラー",
    sourceType: "support" as const,
    messageType: "incident",
    status: "unprocessed" as const,
    scope: "User / 佐藤様",
    ownerRole: "Support",
    excerpt: "特定環境でログインができないとの報告。技術調査が必要。",
    sourceUrl: "#",
  },
];

const mockPeople = [
  {
    id: "p1",
    name: "山田 太郎",
    role: "CTO / 決裁者",
    title: "Chief Technology Officer",
    department: "Engineering",
    roleType: "Decision Maker",
    decisionInfluence: "high" as const,
    contactStatus: "active" as const,
    relationLevel: "executive",
    company: "株式会社テクノロジーイノベーション",
    email: "yamada@techinnov.co.jp",
    phone: "03-1234-5678",
    status: "confirmed" as const,
    confidence: "high",
    evidenceCount: 8,
    lastTouchpoint: "2026-03-10",
    linkedProjects: ["プロジェクトA"],
    linkedActions: 3,
    linkedContentJobs: 1,
    scope: "Company",
    owner: "佐藤 太郎",
    relationshipHypothesis: "最終意思決定者、技術選定責任者",
    missingFields: [],
  },
  {
    id: "p2",
    name: "鈴木 一郎",
    role: "CFO / 予算承認者",
    title: "Chief Financial Officer",
    department: "Finance",
    roleType: "Budget Holder",
    decisionInfluence: "high" as const,
    contactStatus: "contacted" as const,
    relationLevel: "executive",
    company: "株式会社テクノロジーイノベーション",
    email: "suzuki@techinnov.co.jp",
    status: "proposed" as const,
    confidence: "medium",
    evidenceCount: 3,
    lastTouchpoint: "2026-03-08",
    linkedProjects: [],
    linkedActions: 1,
    linkedContentJobs: 0,
    scope: "Company",
    owner: "佐藤 太郎",
    relationshipHypothesis: "予算承認権限保有者",
    missingFields: ["phone"],
  },
  {
    id: "p3",
    name: "田中 花子",
    role: "プロジェクトマネージャー",
    title: "Senior Project Manager",
    department: "Engineering",
    roleType: "Champion",
    decisionInfluence: "medium" as const,
    contactStatus: "active" as const,
    relationLevel: "manager",
    company: "株式会社テクノロジーイノベーション",
    email: "tanaka@techinnov.co.jp",
    status: "confirmed" as const,
    confidence: "high",
    evidenceCount: 12,
    lastTouchpoint: "2026-03-11",
    linkedProjects: ["プロジェクトA", "プロジェクトB"],
    linkedActions: 5,
    linkedContentJobs: 2,
    scope: "Company",
    owner: "佐藤 太郎",
    relationshipHypothesis: "実務推進者、日常的な窓口",
    missingFields: ["phone"],
  },
  {
    id: "p4",
    name: "佐藤 次郎",
    role: "エンジニア",
    title: "Senior Engineer",
    department: "Engineering",
    roleType: "User",
    decisionInfluence: "low" as const,
    contactStatus: "not contacted" as const,
    relationLevel: "individual contributor",
    company: "株式会社テクノロジーイノベーション",
    status: "proposed" as const,
    confidence: "medium",
    evidenceCount: 3,
    lastTouchpoint: null,
    linkedProjects: ["プロジェクトA"],
    linkedActions: 0,
    linkedContentJobs: 0,
    scope: "Project / プロジェクトA",
    owner: "佐藤 太郎",
    missingFields: ["email", "phone"],
    relationshipHypothesis: "技術実装担当者候補",
  },
  {
    id: "p5",
    name: "高橋 美咲",
    role: "システム管理者",
    title: "IT Administrator",
    department: "IT",
    roleType: "Admin",
    decisionInfluence: "low" as const,
    contactStatus: "active" as const,
    relationLevel: "manager",
    company: "株式会社テクノロジーイノベーション",
    email: "takahashi@techinnov.co.jp",
    status: "confirmed" as const,
    confidence: "high",
    evidenceCount: 9,
    lastTouchpoint: "2026-03-08",
    linkedProjects: ["プロジェクトA"],
    linkedActions: 2,
    linkedContentJobs: 1,
    scope: "Company",
    owner: "佐藤 太郎",
    relationshipHypothesis: "技術設定担当、日常的なサポート窓口",
    missingFields: [],
  },
  {
    id: "p6",
    name: "伊藤 健太",
    role: "不明",
    title: "Unknown",
    department: "Unknown",
    roleType: "Unknown",
    decisionInfluence: "unknown" as const,
    contactStatus: "unknown" as const,
    relationLevel: "unknown",
    company: "株式会社テクノロジーイノベーション",
    status: "unresolved" as const,
    confidence: "low",
    evidenceCount: 1,
    lastTouchpoint: null,
    linkedProjects: [],
    linkedActions: 0,
    linkedContentJobs: 0,
    scope: "Company",
    owner: "佐藤 太郎",
    missingFields: ["email", "phone", "role", "department"],
    relationshipHypothesis: "議事録に名前のみ記載、詳細不明",
  },
];

const mockDraftActions = [
  {
    id: "1",
    title: "Salesforce商談フェーズ更新提案",
    type: "push" as const,
    status: "draft" as const,
    targetScope: "Salesforce",
    evidenceCount: 5,
    confidence: "medium" as const,
    missingFields: ["決裁者承認"],
  },
];

const mockPendingActions = [
  {
    id: "2",
    title: "オンボーディング進捗確認MTGのフォローアップメール",
    type: "send_external" as const,
    status: "pending_review" as const,
    targetScope: "山田様、田中様",
    evidenceCount: 3,
    confidence: "high" as const,
  },
];

const mockApprovedActions = [
  {
    id: "3",
    title: "追加トレーニングセッションの日程調整",
    type: "send_internal" as const,
    status: "approved" as const,
    targetScope: "社内CSMチーム",
    evidenceCount: 2,
    confidence: "high" as const,
  },
  {
    id: "4",
    title: "技術サポート対応状況の共有",
    type: "push" as const,
    status: "approved" as const,
    targetScope: "Salesforce Activity",
    evidenceCount: 4,
    confidence: "high" as const,
  },
];

const mockSentActions = [
  {
    id: "5",
    title: "週次レポート送付完了",
    type: "send_external" as const,
    status: "sent" as const,
    targetScope: "山田様、田中様",
    evidenceCount: 6,
  },
];

export function CompanyDetail() {
  const { companyId } = useParams();
  const [evidenceFilter, setEvidenceFilter] = useState("all");
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [showPeopleExtractSheet, setShowPeopleExtractSheet] = useState(false);
  const [showActionGenerateSheet, setShowActionGenerateSheet] = useState(false);
  const [showAIExtractDialog, setShowAIExtractDialog] = useState(false);
  const [showSalesforceSyncSheet, setShowSalesforceSyncSheet] = useState(false);

  const confirmedPeople = mockPeople.filter(p => p.status === "confirmed");
  const canSyncToSalesforce = confirmedPeople.length > 0;

  const handlePeopleExtract = () => {
    setShowPeopleExtractSheet(true);
  };

  const handleActionGenerate = () => {
    setShowActionGenerateSheet(true);
  };

  const handleAIExtractFromSelected = () => {
    if (selectedEvidence.length > 0) {
      setShowAIExtractDialog(true);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Company" />
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Compact Company Summary Header */}
          <div className="bg-white border-b px-4 py-2">
            <div className="max-w-[1800px] mx-auto">
              <div className="flex items-center justify-between">
                {/* Left: Company Info */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-slate-400" />
                    <h1 className="font-semibold text-slate-900">{mockCompany.name}</h1>
                  </div>
                  <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                    {mockCompany.phaseLabel}
                  </Badge>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                      <span className="font-semibold text-red-600">{mockCompany.openAlerts}</span>
                      <span>Alerts</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckSquare className="w-3 h-3 text-blue-500" />
                      <span className="font-semibold text-blue-600">{mockCompany.openActions}</span>
                      <span>Actions</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>最終接点: {mockCompany.lastContact}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-400" />
                      {mockCompany.projects.map((project, idx) => (
                        <Link 
                          key={idx}
                          to={`/project/proj_${idx + 1}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        >
                          {project}{idx < mockCompany.projects.length - 1 ? ',' : ''}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Action Buttons */}
                <div className="flex items-center gap-2">
                  <Link to={`/outbound/compose?fromCompany=${companyId}`}>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <Send className="w-3 h-3 mr-1" />
                      Outbound
                    </Button>
                  </Link>
                  <Link to={`/company/${companyId}/log`}>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <FileText className="w-3 h-3 mr-1" />
                      Unified Log
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Salesforce
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Unified Context Banner (Events + Support) */}
          {(relatedEvents.length > 0 || relatedSupport.length > 0) && (
            <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-orange-50 border-b px-4 py-2">
              <div className="max-w-[1800px] mx-auto">
                <div className="flex items-center gap-6">
                  {/* Related Events */}
                  {relatedEvents.length > 0 && (
                    <div className={`flex items-center gap-2 ${relatedSupport.length > 0 ? 'flex-1' : ''}`}>
                      <Calendar className="w-3 h-3 text-purple-600 flex-shrink-0" />
                      <span className="text-xs font-semibold text-purple-900">Event:</span>
                      <div className="flex items-center gap-3">
                        {relatedEvents.map((event) => (
                          <div key={event.id} className="flex items-center gap-1.5 text-xs">
                            <Link
                              to={`/events/${event.id}`}
                              className="font-medium text-purple-700 hover:text-purple-900 hover:underline"
                            >
                              {event.name}
                            </Link>
                            <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-200 h-4">
                              {event.type}
                            </Badge>
                            {event.sent && (
                              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs h-4">配信済</Badge>
                            )}
                          </div>
                        ))}
                        <Link to="/events">
                          <Button variant="ghost" size="sm" className="h-5 text-xs px-2">
                            全て見る
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}

                  {relatedEvents.length > 0 && relatedSupport.length > 0 && (
                    <div className="h-4 w-px bg-slate-300" />
                  )}

                  {/* Related Support */}
                  {relatedSupport.length > 0 && (
                    <div className={`flex items-center gap-2 ${relatedEvents.length > 0 ? 'flex-1' : ''}`}>
                      <Headphones className="w-3 h-3 text-orange-600 flex-shrink-0" />
                      <span className="text-xs font-semibold text-orange-900">Support:</span>
                      <div className="flex items-center gap-3">
                        {relatedSupport.map((supportCase) => (
                          <div key={supportCase.id} className="flex items-center gap-1.5 text-xs">
                            <Link
                              to={`/support/${supportCase.id}`}
                              className="font-medium text-orange-700 hover:text-orange-900 hover:underline"
                            >
                              {supportCase.title}
                            </Link>
                            {supportCase.severity === "high" && (
                              <Badge className="bg-red-100 text-red-700 border-red-200 text-xs h-4">High</Badge>
                            )}
                            {supportCase.routingStatus === "waiting on CSE" && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs h-4">
                                CSE待ち
                              </Badge>
                            )}
                          </div>
                        ))}
                        <Link to="/support/queue">
                          <Button variant="ghost" size="sm" className="h-5 text-xs px-2">
                            Queue
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3-Lane Layout */}
          <div className="flex-1 overflow-hidden p-4">
            <div className="flex gap-4 h-full" style={{ minWidth: '1360px', overflowX: 'auto' }}>
              {/* Left Lane: Evidence - Fixed Width */}
              <div className="flex flex-col bg-white border rounded-lg w-[380px] flex-shrink-0 h-full">
                <div className="p-4 border-b bg-slate-50 flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-slate-900">Evidence入力</h2>
                    <Badge variant="outline" className="text-xs bg-amber-100">
                      未処理: {mockEvidence.filter(e => e.status === "unprocessed").length}件
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Select value={evidenceFilter} onValueChange={setEvidenceFilter}>
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder="フィルタ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">すべて表示</SelectItem>
                        <SelectItem value="unprocessed">未処理のみ</SelectItem>
                        <SelectItem value="signal">Signal関連のみ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {/* Open Alerts Section */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Open Alerts</h3>
                      <Badge className="text-xs h-5 bg-red-500">{mockAlerts.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {mockAlerts.map((alert) => (
                        <AlertCard key={alert.id} {...alert} />
                      ))}
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Evidence Timeline */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">統合タイムライン</h3>
                      <span className="text-xs text-slate-500">最新順</span>
                    </div>
                    <div className="space-y-3">
                      {mockEvidence.map((evidence) => (
                        <div key={evidence.id} className="relative">
                          <EvidenceCard {...evidence} />
                          {evidence.status === "unprocessed" && (
                            <div className="mt-2 flex gap-2">
                              <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={handlePeopleExtract}>
                                People抽出
                              </Button>
                              <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={handleActionGenerate}>
                                Action生成
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Center Lane: Org / People */}
              <div className="flex flex-col bg-white border rounded-lg flex-1 min-w-[600px] h-full">
                <div className="p-4 border-b bg-slate-50 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-slate-900">People確定</h2>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs bg-emerald-100">
                        確定: {mockPeople.filter(p => p.status === "confirmed").length}名
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-blue-100">
                        候補: {mockPeople.filter(p => p.status === "proposed").length}名
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 overflow-hidden">
                  <Tabs defaultValue="org" className="h-full flex flex-col">
                    <TabsList className="grid grid-cols-2 h-8 flex-shrink-0 mx-4 mt-4">
                      <TabsTrigger value="people" className="text-xs">People List</TabsTrigger>
                      <TabsTrigger value="org" className="text-xs">Org Chart</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="people" className="flex-1 overflow-y-auto mx-4 mt-4 space-y-4">
                      {/* Workflow guidance */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <div className="flex items-start gap-2">
                          <ArrowRight className="w-4 h-4 text-blue-700 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <h4 className="text-xs font-semibold text-blue-900 mb-1">Evidence → People確定の流れ</h4>
                            <p className="text-xs text-blue-800">
                              左レーンのEvidenceから人物情報を抽出し、ここで確定します。確定後、右レーンでAction生成が可能になります。
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Confirmed People */}
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-emerald-700 mb-3">確定済みPeople</h3>
                        <div className="space-y-3">
                          {mockPeople.filter(p => p.status === "confirmed").map((person) => (
                            <PeopleCard key={person.id} {...person} />
                          ))}
                        </div>
                      </div>

                      <Separator className="my-4" />

                      {/* Proposed People */}
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-blue-700 mb-3">People候補 (要確定)</h3>
                        <div className="space-y-3">
                          {mockPeople.filter(p => p.status === "proposed").map((person) => (
                            <PeopleCard key={person.id} {...person} />
                          ))}
                        </div>
                      </div>

                      <Separator className="my-4" />

                      {/* Unresolved People */}
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-amber-700 mb-3">未解決People</h3>
                        <div className="space-y-3">
                          {mockPeople.filter(p => p.status === "unresolved").map((person) => (
                            <PeopleCard key={person.id} {...person} />
                          ))}
                        </div>
                      </div>

                      {/* Missing Information */}
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-amber-900 mb-2">Missing Information</h4>
                        <ul className="text-xs text-amber-800 space-y-1">
                          <li>• 営業責任者の連絡先情報</li>
                          <li>• 経営層の関与状況</li>
                          <li>• 部署間の報告ライン</li>
                        </ul>
                        <Button size="sm" variant="outline" className="w-full mt-3 text-xs h-7">
                          Evidence再確認
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="org" className="mt-0 h-[calc(100vh-310px)]">
                      <PeopleOrgChart people={mockPeople} />
                    </TabsContent>
                  </Tabs>
                </div>
              </div>

              {/* Right Lane: Action Pipeline (Draft → Review → Approved → Sent → Sync) */}
              <div className="flex flex-col bg-white border rounded-lg w-[400px] flex-shrink-0 h-full">
                <div className="p-4 border-b bg-slate-50 flex-shrink-0">
                  <h2 className="font-semibold text-slate-900 mb-3">次アクション判断</h2>
                  <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3">
                    <p className="text-xs text-blue-900">
                      Evidence駆動で組織図を成長 → <span className="font-semibold">Outbound/Actions/Content</span> へ
                    </p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto pb-4">{/* Added pb-4 */}
                  <div className="p-4 space-y-6">
                    {/* Main CTAs */}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">主要CTA</h3>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          {mockCompany.projects.map((project, idx) => (
                            <Link key={idx} to={`/project/proj_${idx + 1}`}>
                              <Button variant="outline" size="sm" className="w-full text-xs h-8">
                                {project}
                              </Button>
                            </Link>
                          ))}
                        </div>
                        <Separator className="my-2" />
                        
                        {/* 主CTA: Company施策導線 */}
                        <div className="space-y-2">
                          <Link to={`/outbound/compose?sourceContext=company&linkedCompany=${mockCompany.id}&companyName=${encodeURIComponent(mockCompany.name)}&phase=${mockCompany.phaseLabel}`}>
                            <Button variant="default" size="sm" className="w-full text-xs h-8 justify-start">
                              <Send className="w-3 h-3 mr-2" />
                              Outboundを起票
                            </Button>
                          </Link>
                        </div>

                        <Separator className="my-2" />

                        {/* 補助CTA: 業務文脈へ */}
                        <div className="space-y-2">
                          <Link to={`/actions?context=company&id=${mockCompany.id}`}>
                            <Button variant="outline" size="sm" className="w-full text-xs h-8 justify-start">
                              <CheckSquare className="w-3 h-3 mr-2" />
                              Actionsに送る
                            </Button>
                          </Link>
                          <Link to={`/content?context=company&id=${mockCompany.id}`}>
                            <Button variant="outline" size="sm" className="w-full text-xs h-8 justify-start">
                              <FileText className="w-3 h-3 mr-2" />
                              Contentに送る
                            </Button>
                          </Link>
                        </div>

                        <Separator className="my-2" />

                        {/* 補助CTA: 参照 */}
                        <div className="space-y-2">
                          <Link to={`/unified-log?company=${mockCompany.id}`}>
                            <Button variant="outline" size="sm" className="w-full text-xs h-8 justify-start">
                              <Database className="w-3 h-3 mr-2" />
                              Unified Logを見る
                            </Button>
                          </Link>
                          <Link to="/library">
                            <Button variant="outline" size="sm" className="w-full text-xs h-8 justify-start">
                              <BookOpen className="w-3 h-3 mr-2" />
                              Libraryを見る
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Action List */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-700">Action候補</h3>
                        <Badge variant="outline" className="text-xs">
                          {mockDraftActions.length + mockPendingActions.length + mockApprovedActions.length}件
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        {[...mockDraftActions, ...mockPendingActions, ...mockApprovedActions].map((action) => (
                          <ActionCard key={action.id} {...action} />
                        ))}
                        {mockDraftActions.length + mockPendingActions.length + mockApprovedActions.length === 0 && (
                          <div className="text-center py-6 text-xs text-slate-400 border-2 border-dashed rounded-lg">
                            <p className="mb-1">Action候補なし</p>
                            <p className="text-xs">Evidenceから生成できます</p>
                          </div>
                        )}
                      </div>
                      {(mockDraftActions.length + mockPendingActions.length + mockApprovedActions.length > 0) && (
                        <Link to="/actions">
                          <Button variant="ghost" size="sm" className="w-full mt-3 text-xs">
                            Actionsで全て見る
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </div>

                    <Separator />

                    {/* Salesforce Sync Section - Main Feature */}
                    <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Network className="w-5 h-5 text-blue-700" />
                        <h3 className="text-sm font-semibold text-blue-900">組織図 → Salesforce</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="text-xs text-blue-800 bg-white rounded border border-blue-200 p-3">
                          <div className="flex justify-between mb-1">
                            <span>確定済みPeople:</span>
                            <span className="font-semibold">{confirmedPeople.length}名</span>
                          </div>
                          <div className="text-xs text-blue-600 mt-2">
                            組織図の情報をSalesforceに同期します
                          </div>
                        </div>
                        
                        {canSyncToSalesforce ? (
                          <Button 
                            size="sm" 
                            className="w-full text-xs h-9 bg-blue-600 hover:bg-blue-700"
                            onClick={() => setShowSalesforceSyncSheet(true)}
                          >
                            <Database className="w-3 h-3 mr-1" />
                            送信準備へ ({confirmedPeople.length}名)
                          </Button>
                        ) : (
                          <div className="text-center py-3 text-xs text-slate-500 bg-slate-100 rounded border border-slate-200">
                            確定済みのPeopleがありません
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* People抽出Sheet */}
      <Sheet open={showPeopleExtractSheet} onOpenChange={setShowPeopleExtractSheet}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>People情報抽出</SheetTitle>
            <SheetDescription>
              EvidenceからPeople情報を抽出しました
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-200px)] mt-6">
            <div className="space-y-4 px-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-blue-900 mb-2">抽出されたPeople</h4>
                <div className="space-y-2">
                  <div className="bg-white border rounded p-2">
                    <p className="text-sm font-medium text-slate-900">佐藤 次郎</p>
                    <p className="text-xs text-slate-600">Role: エンジニア (推定)</p>
                    <p className="text-xs text-slate-600">Department: Technology</p>
                    <p className="text-xs text-slate-500 mt-1">Confidence: Medium</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-900">抽出元Evidence</h4>
                <div className="bg-slate-50 border rounded p-3">
                  <p className="text-xs text-slate-900 font-medium mb-1">
                    週次MTG議事録 - オンボーディング進捗確認
                  </p>
                  <p className="text-xs text-slate-600">
                    議事録内で「佐藤さん」として言及。技術的な実装を担当している模様。
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-900">不足情報</h4>
                <div className="bg-amber-50 border border-amber-200 rounded p-3">
                  <ul className="text-xs text-amber-800 space-y-1">
                    <li>• Email未確定</li>
                    <li>• Phone未確定</li>
                    <li>• 正式な役職名未確定</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-900">補完アクション</h4>
                <Input placeholder="Email (任意)" className="text-sm" />
                <Input placeholder="Phone (任意)" className="text-sm" />
                <Select defaultValue="proposed">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">確定済みとして登録</SelectItem>
                    <SelectItem value="proposed">候補として登録</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ScrollArea>
          <div className="flex gap-2 mt-4">
            <Button
              className="flex-1"
              onClick={() => setShowPeopleExtractSheet(false)}
            >
              Peopleに追加
            </Button>
            <Button variant="outline" onClick={() => setShowPeopleExtractSheet(false)}>
              キャンセル
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Action生成Sheet */}
      <Sheet open={showActionGenerateSheet} onOpenChange={setShowActionGenerateSheet}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>Action提案生成</SheetTitle>
            <SheetDescription>
              EvidenceからAction提案を生成しました
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-200px)] mt-6">
            <div className="space-y-4 px-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-blue-700 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-blue-900 mb-1">AI提案</h4>
                    <p className="text-xs text-blue-800">
                      決裁者の会議欠席とプロジェクト遅延の懸念から、以下のActionを提案します
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-900">Action タイトル</label>
                <Input
                  defaultValue="決裁者との1on1ミーティング設定"
                  className="text-sm"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-900">Action Type</label>
                <Select defaultValue="send_external">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="send_external">Send (外部送信)</SelectItem>
                    <SelectItem value="send_internal">Send (内部)</SelectItem>
                    <SelectItem value="push">Push (内部更新)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-900">詳細</label>
                <textarea
                  className="w-full min-h-[100px] text-sm border rounded-md p-2"
                  defaultValue="プロジェクトの優先度が下がっている懸念があるため、決裁者と直接対話してビジネス価値を再確認する"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-900">対象Scope</label>
                <Input
                  defaultValue="山田様 (CTO)"
                  className="text-sm"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-900">優先度</label>
                <Select defaultValue="high">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-slate-50 border rounded p-3">
                <h4 className="text-xs font-semibold text-slate-700 mb-2">関連Evidence</h4>
                <div className="text-xs text-slate-600 space-y-1">
                  <p>• 週次MTG議事録 - オンボーディング進捗確認</p>
                  <Badge variant="outline" className="text-xs">Evidence Count: 1</Badge>
                </div>
              </div>
            </div>
          </ScrollArea>
          <div className="flex gap-2 mt-4 px-4">
            <Button
              className="flex-1"
              onClick={() => setShowActionGenerateSheet(false)}
            >
              下書きとして保存
            </Button>
            <Button variant="outline" onClick={() => setShowActionGenerateSheet(false)}>
              キャンセル
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Salesforce送信確認Sheet */}
      <Sheet open={showSalesforceSyncSheet} onOpenChange={setShowSalesforceSyncSheet}>
        <SheetContent className="w-[700px] sm:max-w-[700px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              Salesforce同期を準備
            </SheetTitle>
            <SheetDescription>
              以下の確定済みPeople情報をOutbound経由でSalesforceに同期します。Compose画面で最終確認してから実行されます。
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-200px)] mt-6">
            <div className="space-y-4 px-4">
              {/* 情報表示（危険操作警告を削除） */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Database className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold text-blue-900 mb-1">Salesforce同期準備</h4>
                    <p className="text-xs text-blue-800">
                      この操作はCompose画面に遷移します。最終的な送信はCompose画面で確認・承認してから実行されます。
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 送信対象People */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3">
                  同期対象People ({confirmedPeople.length}名)
                </h4>
                <div className="space-y-3">
                  {confirmedPeople.map((person) => (
                    <div key={person.id} className="bg-slate-50 border rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-slate-900">{person.name}</p>
                          <p className="text-xs text-slate-600">{person.role}</p>
                        </div>
                        <Badge className="bg-emerald-500">確定済み</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div>
                          <span className="font-medium">Email:</span> {person.email || "未設定"}
                        </div>
                        <div>
                          <span className="font-medium">Phone:</span> {person.phone || "未設定"}
                        </div>
                        <div>
                          <span className="font-medium">Department:</span> {person.department}
                        </div>
                        <div>
                          <span className="font-medium">Title:</span> {person.title}
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-slate-500">
                          Evidence: {person.evidenceCount}件
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Salesforce送信先情報 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-blue-900 mb-2">同期先情報</h4>
                <div className="space-y-1 text-xs text-blue-800">
                  <p>• Salesforce Account: {mockCompany.name}</p>
                  <p>• 同期タイプ: Contact情報の作成/更新</p>
                  <p>• 同期フィールド: Name, Email, Phone, Title, Department, Role</p>
                </div>
              </div>
            </div>
          </ScrollArea>
          <div className="flex gap-2 mt-4 px-4">
            <Link 
              to={`/outbound/compose?fromCompany=${mockCompany.id}&sync=salesforce&type=org_chart`}
              className="flex-1"
            >
              <Button
                variant="default"
                className="w-full"
                onClick={() => {
                  setShowSalesforceSyncSheet(false);
                }}
              >
                <Database className="w-4 h-4 mr-2" />
                Composeで確認
              </Button>
            </Link>
            <Button variant="outline" onClick={() => setShowSalesforceSyncSheet(false)}>
              キャンセル
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}