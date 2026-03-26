import { useState } from "react";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import {
  Send,
  Database,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Filter,
  Download,
  ExternalLink,
  Clock,
  Building,
  FileText,
  Mail,
  AlertCircle,
  Shield,
  Eye,
  ChevronRight,
  Target,
  Users,
  Settings,
  Ban,
  Key,
  Zap,
  GitBranch,
  FileCode,
  BookMarked,
} from "lucide-react";
import { Link } from "react-router";

type AuditTab = 
  | "execution" 
  | "delivery_failures" 
  | "unresolved" 
  | "asset_changes" 
  | "audience_changes"
  | "settings_changes"
  | "permission_changes"
  | "high_risk"
  | "review";

type EventType =
  | "outbound_sent"
  | "delivery_failed"
  | "unresolved_recipient"
  | "action_created"
  | "action_updated"
  | "action_completed"
  | "content_created"
  | "content_ai_generated"
  | "content_library_registered"
  | "library_created"
  | "library_updated"
  | "library_applied"
  | "audience_created"
  | "audience_updated"
  | "audience_used"
  | "settings_changed"
  | "permission_changed"
  | "ai_agent_changed"
  | "agent_routing_changed"
  | "fallback_changed"
  | "high_risk_operation"
  | "review_requested"
  | "review_approved"
  | "review_rejected";

type RiskLevel = "low" | "medium" | "high" | "critical";
type ResultStatus = "success" | "failed" | "pending" | "unresolved";

interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  eventType: EventType;
  targetType: string;
  targetName: string;
  targetId: string;
  sourceContext?: string;
  linkedCompany?: string;
  linkedCompanyId?: string;
  linkedProject?: string;
  linkedProjectId?: string;
  linkedUser?: string;
  result: ResultStatus;
  riskLevel: RiskLevel;
  note?: string;
  summary: string;
  channel?: string;
  beforeState?: any;
  afterState?: any;
  failureReason?: string;
  unresolvedReason?: string;
}

// モックデータ
const mockAuditEvents: AuditEvent[] = [
  // Execution Log
  {
    id: "evt-1",
    timestamp: "2026-03-17 15:30:00",
    actor: "佐藤 太郎",
    actorRole: "CSM",
    eventType: "outbound_sent",
    targetType: "Outbound",
    targetName: "四半期レビュー依頼メール",
    targetId: "out-123",
    sourceContext: "Compose",
    linkedCompany: "テックイノベーション株式会社",
    linkedCompanyId: "1",
    linkedProject: "プロジェクトA",
    linkedProjectId: "proj_1",
    result: "success",
    riskLevel: "medium",
    summary: "Email送信が成功しました（3件）",
    channel: "Email",
    note: "決裁者含む3名に送信完了",
  },
  {
    id: "evt-2",
    timestamp: "2026-03-17 14:15:00",
    actor: "田中 花子",
    actorRole: "CSM",
    eventType: "action_created",
    targetType: "Action",
    targetName: "オンボーディング進捗フォロー",
    targetId: "act-456",
    linkedCompany: "グローバルソリューションズ株式会社",
    linkedCompanyId: "2",
    result: "success",
    riskLevel: "low",
    summary: "新規Actionが作成されました",
  },
  // Delivery Failures
  {
    id: "evt-3",
    timestamp: "2026-03-17 13:45:00",
    actor: "鈴木 次郎",
    actorRole: "CSM",
    eventType: "delivery_failed",
    targetType: "Outbound",
    targetName: "契約更新案内メール",
    targetId: "out-789",
    linkedCompany: "デジタルマーケティング株式会社",
    linkedCompanyId: "3",
    result: "failed",
    riskLevel: "high",
    summary: "Email送信が失敗しました",
    channel: "Email",
    failureReason: "Invalid email address: test@invalid-domain.xyz",
  },
  {
    id: "evt-4",
    timestamp: "2026-03-17 12:30:00",
    actor: "山本 一郎",
    actorRole: "Manager",
    eventType: "delivery_failed",
    targetType: "Outbound",
    targetName: "Slack通知送信",
    targetId: "out-234",
    linkedCompany: "テックイノベーション株式会社",
    linkedCompanyId: "1",
    result: "failed",
    riskLevel: "medium",
    summary: "Slack送信が失敗しました",
    channel: "Slack",
    failureReason: "Slack channel not found: #customer-success",
  },
  {
    id: "evt-4b",
    timestamp: "2026-03-17 11:20:00",
    actor: "山本 一郎",
    actorRole: "Manager",
    eventType: "delivery_failed",
    targetType: "Outbound",
    targetName: "Chatwork通知送信",
    targetId: "out-235",
    linkedCompany: "グローバルソリューションズ株式会社",
    linkedCompanyId: "2",
    result: "failed",
    riskLevel: "medium",
    summary: "Chatwork送信が失敗しました",
    channel: "Chatwork",
    failureReason: "Chatwork room not found: rid_12345",
  },
  // Unresolved
  {
    id: "evt-5",
    timestamp: "2026-03-17 11:00:00",
    actor: "高橋 美咲",
    actorRole: "CSM",
    eventType: "unresolved_recipient",
    targetType: "Outbound",
    targetName: "新機能紹介メール",
    targetId: "out-567",
    linkedCompany: "テックイノベーション株式会社",
    linkedCompanyId: "1",
    result: "unresolved",
    riskLevel: "medium",
    summary: "送信先が解決できませんでした",
    unresolvedReason: "Contact email not found for user: 佐藤 次郎",
  },
  // Asset Changes
  {
    id: "evt-6",
    timestamp: "2026-03-17 10:30:00",
    actor: "佐藤 太郎",
    actorRole: "CSM",
    eventType: "library_created",
    targetType: "Library",
    targetName: "オンボーディングメールテンプレート v2",
    targetId: "lib-123",
    result: "success",
    riskLevel: "low",
    summary: "新しいLibrary資産が作成されました",
  },
  {
    id: "evt-7",
    timestamp: "2026-03-17 09:15:00",
    actor: "田中 花子",
    actorRole: "CSM",
    eventType: "content_ai_generated",
    targetType: "Content",
    targetName: "契約更新提案資料",
    targetId: "cnt-789",
    linkedCompany: "グローバルソリューションズ株式会社",
    linkedCompanyId: "2",
    result: "success",
    riskLevel: "low",
    summary: "AIでContentが生成されました（Proposal Draft）",
  },
  // Audience Changes
  {
    id: "evt-8",
    timestamp: "2026-03-16 16:45:00",
    actor: "鈴木 次郎",
    actorRole: "CSM",
    eventType: "audience_created",
    targetType: "Audience",
    targetName: "At-Riskユーザー（Q1 2026）",
    targetId: "aud-1",
    result: "success",
    riskLevel: "low",
    summary: "新しいAudienceが作成されました（対象: 1234件）",
  },
  {
    id: "evt-9",
    timestamp: "2026-03-16 15:30:00",
    actor: "山本 一郎",
    actorRole: "Manager",
    eventType: "audience_used",
    targetType: "Audience",
    targetName: "アップセル候補Company",
    targetId: "aud-2",
    result: "success",
    riskLevel: "medium",
    summary: "AudienceがOutbound送信に使用されました（89件）",
  },
  // Settings Changes
  {
    id: "evt-10",
    timestamp: "2026-03-16 14:00:00",
    actor: "山本 一郎",
    actorRole: "Manager",
    eventType: "settings_changed",
    targetType: "Channel Settings",
    targetName: "Email Channel Configuration",
    targetId: "setting-email",
    result: "success",
    riskLevel: "high",
    summary: "Email channel設定が変更されました",
    beforeState: { sender: "old-sender@example.com" },
    afterState: { sender: "new-sender@example.com" },
  },
  // Permission Changes
  {
    id: "evt-11",
    timestamp: "2026-03-16 13:00:00",
    actor: "山本 一郎",
    actorRole: "Manager",
    eventType: "permission_changed",
    targetType: "User Permission",
    targetName: "高橋 美咲 - 送信権限付与",
    targetId: "perm-123",
    result: "success",
    riskLevel: "high",
    summary: "ユーザー権限が変更されました",
    beforeState: { canSend: false },
    afterState: { canSend: true },
  },
  // High Risk
  {
    id: "evt-12",
    timestamp: "2026-03-16 12:00:00",
    actor: "佐藤 太郎",
    actorRole: "CSM",
    eventType: "high_risk_operation",
    targetType: "Bulk Send",
    targetName: "全顧客向け重要アナウンス",
    targetId: "out-999",
    result: "success",
    riskLevel: "critical",
    summary: "大規模送信が実行されました（500件以上）",
    channel: "Email",
    note: "全顧客500件に一斉送信",
  },
  // Review (Optional)
  {
    id: "evt-13",
    timestamp: "2026-03-16 11:30:00",
    actor: "田中 花子",
    actorRole: "CSM",
    eventType: "review_requested",
    targetType: "Content",
    targetName: "契約更新提案資料",
    targetId: "cnt-789",
    result: "pending",
    riskLevel: "low",
    summary: "レビュー依頼が送信されました",
    note: "マネージャーに確認依頼",
  },
  {
    id: "evt-14",
    timestamp: "2026-03-16 11:45:00",
    actor: "山本 一郎",
    actorRole: "Manager",
    eventType: "review_approved",
    targetType: "Content",
    targetName: "契約更新提案資料",
    targetId: "cnt-789",
    result: "success",
    riskLevel: "low",
    summary: "レビューが承認されました",
  },
  // AI Agent Changes
  {
    id: "evt-15",
    timestamp: "2026-03-15 10:00:00",
    actor: "山本 一郎",
    actorRole: "Manager",
    eventType: "ai_agent_changed",
    targetType: "AI Agent",
    targetName: "Content Drafting (OpenRouter)",
    targetId: "agent-5",
    result: "success",
    riskLevel: "medium",
    summary: "OpenRouter AI Agent設定が変更されました",
    beforeState: { 
      providerType: "openrouter", 
      provider: "OpenAI", 
      model: "gpt-4-0613",
      temperature: 0.7
    },
    afterState: { 
      providerType: "openrouter", 
      provider: "Anthropic", 
      model: "claude-3-opus-20240229",
      temperature: 0.6,
      additionalInstruction: "Maintain professional tone and personalization."
    },
    note: "より高品質な出力のためClaude 3 Opusに変更、追加指示文を設定",
  },
  {
    id: "evt-16",
    timestamp: "2026-03-14 14:30:00",
    actor: "山本 一郎",
    actorRole: "Manager",
    eventType: "agent_routing_changed",
    targetType: "AI Agent",
    targetName: "Proposal Drafting (Kocoro)",
    targetId: "agent-11",
    result: "success",
    riskLevel: "high",
    summary: "Provider TypeをOpenRouterからKocoroに変更",
    beforeState: { 
      providerType: "openrouter",
      assignedAgent: "GPT-4 Turbo", 
      provider: "OpenAI",
      model: "gpt-4-turbo-2024-04-09"
    },
    afterState: { 
      providerType: "kocoro",
      kocoroAgentName: "Proposal Generator Pro",
      agentId: "kocoro-agent-123",
      apiEndpoint: "https://api.kocoro.ai/agents/proposal-gen/execute",
      outputType: "mixed",
      fileOutputEnabled: true,
      fileType: "pptx"
    },
    note: "Kocoro Agent に変更してファイル出力を有効化（PPTX生成）",
  },
  {
    id: "evt-17",
    timestamp: "2026-03-13 16:15:00",
    actor: "田中 花子",
    actorRole: "Manager",
    eventType: "fallback_changed",
    targetType: "AI Agent",
    targetName: "Signal Detection (OpenRouter)",
    targetId: "agent-1",
    result: "success",
    riskLevel: "medium",
    summary: "OpenRouter Fallback Model設定が変更されました",
    beforeState: { 
      providerType: "openrouter",
      fallbackModel: "GPT-4" 
    },
    afterState: { 
      providerType: "openrouter",
      fallbackModel: "Claude 3 Sonnet" 
    },
    note: "GPT-4障害時の代替としてClaude 3 Sonnetを設定",
  },
  {
    id: "evt-18",
    timestamp: "2026-03-12 09:00:00",
    actor: "山本 一郎",
    actorRole: "Manager",
    eventType: "ai_agent_changed",
    targetType: "AI Agent",
    targetName: "Content Drafting (Kocoro)",
    targetId: "agent-11",
    result: "success",
    riskLevel: "medium",
    summary: "Kocoro Agent の出力設定が変更されました",
    beforeState: { 
      providerType: "kocoro",
      outputType: "text",
      fileOutputEnabled: false
    },
    afterState: { 
      providerType: "kocoro",
      outputType: "mixed",
      fileOutputEnabled: true,
      fileType: "pptx"
    },
    note: "ファイル出力を有効化し、PPTX生成に対応",
  },
];

const eventTypeConfig: Record<EventType, { label: string; icon: any; color: string }> = {
  outbound_sent: { label: "送信完了", icon: Send, color: "text-blue-600" },
  delivery_failed: { label: "送信失敗", icon: XCircle, color: "text-red-600" },
  unresolved_recipient: { label: "送信先未解決", icon: AlertCircle, color: "text-orange-600" },
  action_created: { label: "Action作成", icon: Target, color: "text-green-600" },
  action_updated: { label: "Action更新", icon: Target, color: "text-blue-600" },
  action_completed: { label: "Action完了", icon: CheckCircle2, color: "text-green-600" },
  content_created: { label: "Content作成", icon: FileText, color: "text-purple-600" },
  content_ai_generated: { label: "AI生成", icon: Zap, color: "text-purple-600" },
  content_library_registered: { label: "Library登録", icon: Database, color: "text-indigo-600" },
  library_created: { label: "Library作成", icon: BookMarked, color: "text-indigo-600" },
  library_updated: { label: "Library更新", icon: BookMarked, color: "text-blue-600" },
  library_applied: { label: "Library適用", icon: BookMarked, color: "text-green-600" },
  audience_created: { label: "Audience作成", icon: Users, color: "text-cyan-600" },
  audience_updated: { label: "Audience更新", icon: Users, color: "text-blue-600" },
  audience_used: { label: "Audience使用", icon: Users, color: "text-green-600" },
  settings_changed: { label: "Settings変更", icon: Settings, color: "text-orange-600" },
  permission_changed: { label: "権限変更", icon: Key, color: "text-red-600" },
  ai_agent_changed: { label: "AI Agent変更", icon: Zap, color: "text-purple-600" },
  agent_routing_changed: { label: "Agent Routing変更", icon: GitBranch, color: "text-purple-600" },
  fallback_changed: { label: "Fallback変更", icon: GitBranch, color: "text-indigo-600" },
  high_risk_operation: { label: "高リスク操作", icon: AlertTriangle, color: "text-red-600" },
  review_requested: { label: "レビュー依頼", icon: Eye, color: "text-slate-600" },
  review_approved: { label: "レビュー承認", icon: CheckCircle2, color: "text-green-600" },
  review_rejected: { label: "レビュー却下", icon: Ban, color: "text-red-600" },
};

const riskLevelConfig: Record<RiskLevel, { label: string; color: string; bgColor: string }> = {
  low: { label: "低", color: "text-green-700", bgColor: "bg-green-50 border-green-200" },
  medium: { label: "中", color: "text-yellow-700", bgColor: "bg-yellow-50 border-yellow-200" },
  high: { label: "高", color: "text-orange-700", bgColor: "bg-orange-50 border-orange-200" },
  critical: { label: "緊急", color: "text-red-700", bgColor: "bg-red-50 border-red-200" },
};

const resultStatusConfig: Record<ResultStatus, { label: string; color: string; icon: any }> = {
  success: { label: "成功", color: "text-green-600", icon: CheckCircle2 },
  failed: { label: "失敗", color: "text-red-600", icon: XCircle },
  pending: { label: "保留中", color: "text-yellow-600", icon: Clock },
  unresolved: { label: "未解決", color: "text-orange-600", icon: AlertCircle },
};

export function GovernanceAudit() {
  const [activeTab, setActiveTab] = useState<AuditTab>("execution");
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [actorFilter, setActorFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("today");

  const handleEventClick = (event: AuditEvent) => {
    setSelectedEvent(event);
    setIsDrawerOpen(true);
  };

  const getFilteredEvents = () => {
    let filtered = mockAuditEvents;

    // Tab filtering
    switch (activeTab) {
      case "execution":
        filtered = filtered.filter(e => 
          e.eventType === "outbound_sent" || 
          e.eventType === "action_completed"
        );
        break;
      case "delivery_failures":
        filtered = filtered.filter(e => e.eventType === "delivery_failed");
        break;
      case "unresolved":
        filtered = filtered.filter(e => 
          e.eventType === "unresolved_recipient" ||
          e.result === "unresolved"
        );
        break;
      case "asset_changes":
        filtered = filtered.filter(e => 
          e.eventType.includes("library") || 
          e.eventType.includes("content")
        );
        break;
      case "audience_changes":
        filtered = filtered.filter(e => e.eventType.includes("audience"));
        break;
      case "settings_changes":
        filtered = filtered.filter(e => e.eventType === "settings_changed");
        break;
      case "permission_changes":
        filtered = filtered.filter(e => e.eventType === "permission_changed");
        break;
      case "high_risk":
        filtered = filtered.filter(e => 
          e.eventType === "high_risk_operation" || 
          e.riskLevel === "critical" ||
          e.riskLevel === "high"
        );
        break;
      case "review":
        filtered = filtered.filter(e => 
          e.eventType.includes("review")
        );
        break;
    }

    // Search
    if (searchQuery) {
      filtered = filtered.filter(e =>
        e.targetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.summary.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Actor filter
    if (actorFilter !== "all") {
      filtered = filtered.filter(e => e.actor === actorFilter);
    }

    // Risk filter
    if (riskFilter !== "all") {
      filtered = filtered.filter(e => e.riskLevel === riskFilter);
    }

    return filtered;
  };

  const filteredEvents = getFilteredEvents();

  // Summary stats
  const todayExecutions = mockAuditEvents.filter(e => 
    e.eventType === "outbound_sent" && 
    e.timestamp.startsWith("2026-03-17")
  ).length;
  const todayFailures = mockAuditEvents.filter(e => 
    e.eventType === "delivery_failed" && 
    e.timestamp.startsWith("2026-03-17")
  ).length;
  const unresolvedCount = mockAuditEvents.filter(e => 
    e.result === "unresolved" || e.eventType === "unresolved_recipient"
  ).length;
  const highRiskCount = mockAuditEvents.filter(e => 
    e.riskLevel === "high" || e.riskLevel === "critical"
  ).length;

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader />
        <div className="flex-1 overflow-auto">
          <div className="max-w-[1800px] mx-auto">
            {/* Header */}
            <div className="bg-white border-b px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-5 h-5 text-slate-600" />
                    <h1 className="text-xl font-semibold text-slate-900">Audit</h1>
                  </div>
                  <p className="text-sm text-slate-600">
                    送信・失敗・高リスク操作・資産変更の追跡 • 誰が何をしたか確認 • 監査ログ • 実行はOutbound/Actions/Contentで行う
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  監査ログ出力
                </Button>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="bg-white border-b px-6 py-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-blue-900">今日の送信実行</div>
                    <Send className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-blue-900">{todayExecutions}件</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-red-900">送信失敗</div>
                    <XCircle className="w-4 h-4 text-red-600" />
                  </div>
                  <div className="text-2xl font-bold text-red-900">{todayFailures}件</div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-orange-900">未解決</div>
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="text-2xl font-bold text-orange-900">{unresolvedCount}件</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-yellow-900">高リスク操作</div>
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  </div>
                  <div className="text-2xl font-bold text-yellow-900">{highRiskCount}件</div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="検索: 対象名、実行者、概要..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9"
                  />
                </div>
                <Select value={actorFilter} onValueChange={setActorFilter}>
                  <SelectTrigger className="w-48 h-9">
                    <SelectValue placeholder="実行者" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべての実行者</SelectItem>
                    <SelectItem value="佐藤 太郎">佐藤 太郎</SelectItem>
                    <SelectItem value="田中 花子">田中 花子</SelectItem>
                    <SelectItem value="鈴木 次郎">鈴木 次郎</SelectItem>
                    <SelectItem value="山本 一郎">山本 一郎</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue placeholder="リスク" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="low">低</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="critical">緊急</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue placeholder="期間" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">今日</SelectItem>
                    <SelectItem value="week">今週</SelectItem>
                    <SelectItem value="month">今月</SelectItem>
                    <SelectItem value="all">すべて</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white px-6">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AuditTab)}>
                <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                  <TabsTrigger value="execution" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    実行ログ
                  </TabsTrigger>
                  <TabsTrigger value="delivery_failures" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    送信失敗
                  </TabsTrigger>
                  <TabsTrigger value="unresolved" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    未解決
                  </TabsTrigger>
                  <TabsTrigger value="asset_changes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    資産変更
                  </TabsTrigger>
                  <TabsTrigger value="audience_changes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    Audience変更
                  </TabsTrigger>
                  <TabsTrigger value="settings_changes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    Settings変更
                  </TabsTrigger>
                  <TabsTrigger value="permission_changes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    権限変更
                  </TabsTrigger>
                  <TabsTrigger value="high_risk" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    高リスク
                  </TabsTrigger>
                  <TabsTrigger value="review" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent text-slate-400">
                    レビュー（optional）
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-0">
                  <div className="border-t">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="w-40">時刻</TableHead>
                          <TableHead className="w-32">実行者</TableHead>
                          <TableHead className="w-40">操作種別</TableHead>
                          <TableHead className="w-32">対象タイプ</TableHead>
                          <TableHead>対象名</TableHead>
                          <TableHead className="w-32">ソースコンテキスト</TableHead>
                          <TableHead className="w-48">関連レコード</TableHead>
                          <TableHead className="w-24">結果</TableHead>
                          <TableHead className="w-24">リスク</TableHead>
                          <TableHead>サマリー</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEvents.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={11} className="text-center py-12 text-slate-400">
                              該当する監査ログがありません
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredEvents.map((event) => {
                            const typeConfig = eventTypeConfig[event.eventType];
                            const TypeIcon = typeConfig.icon;
                            const riskConfig = riskLevelConfig[event.riskLevel];
                            const resultConfig = resultStatusConfig[event.result];
                            const ResultIcon = resultConfig.icon;

                            return (
                              <TableRow 
                                key={event.id} 
                                className="cursor-pointer hover:bg-slate-50"
                                onClick={() => handleEventClick(event)}
                              >
                                <TableCell className="text-xs text-slate-600">
                                  {event.timestamp}
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm font-medium text-slate-900">
                                    {event.actor}
                                  </div>
                                  <div className="text-xs text-slate-500">{event.actorRole}</div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                                    <span className="text-sm">{typeConfig.label}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">
                                  {event.targetType}
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm font-medium text-slate-900">
                                    {event.targetName}
                                  </div>
                                  {event.channel && (
                                    <div className="text-xs text-slate-500 mt-0.5">
                                      {event.channel}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {event.sourceContext && (
                                    <div className="text-xs text-slate-600">
                                      {event.sourceContext}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {event.linkedCompany && (
                                    <div className="text-xs text-slate-600 mb-0.5">
                                      <Building className="w-3 h-3 inline mr-1" />
                                      {event.linkedCompany}
                                    </div>
                                  )}
                                  {event.linkedProject && (
                                    <div className="text-xs text-slate-600">
                                      <FileText className="w-3 h-3 inline mr-1" />
                                      {event.linkedProject}
                                    </div>
                                  )}
                                  {event.linkedUser && (
                                    <div className="text-xs text-slate-600 mt-0.5">
                                      <User className="w-3 h-3 inline mr-1" />
                                      {event.linkedUser}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1.5">
                                    <ResultIcon className={`w-4 h-4 ${resultConfig.color}`} />
                                    <span className={`text-sm ${resultConfig.color}`}>
                                      {resultConfig.label}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={`${riskConfig.bgColor} ${riskConfig.color} text-xs`}>
                                    {riskConfig.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-slate-600">
                                  {event.summary}
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <ChevronRight className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>

      {/* Event Detail Drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-[1000px] overflow-y-auto p-8">
          {selectedEvent && (
            <>
              <SheetHeader className="mb-8">
                <SheetTitle>監査ログ詳細</SheetTitle>
                <SheetDescription>
                  {selectedEvent.timestamp} • {selectedEvent.actor}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-8">
                {/* Summary */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                  <div className="text-sm font-semibold text-slate-900 mb-3">概要</div>
                  <div className="text-sm text-slate-700 leading-relaxed">{selectedEvent.summary}</div>
                </div>

                {/* Basic Info */}
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-4">基本情報</div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">実行者</div>
                      <div className="text-sm font-medium text-slate-900">
                        {selectedEvent.actor}
                      </div>
                      <div className="text-xs text-slate-600">{selectedEvent.actorRole}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">実行時刻</div>
                      <div className="text-sm text-slate-900">{selectedEvent.timestamp}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">操作種別</div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const config = eventTypeConfig[selectedEvent.eventType];
                          const Icon = config.icon;
                          return (
                            <>
                              <Icon className={`w-4 h-4 ${config.color}`} />
                              <span className="text-sm">{config.label}</span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">結果</div>
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          const config = resultStatusConfig[selectedEvent.result];
                          const Icon = config.icon;
                          return (
                            <>
                              <Icon className={`w-4 h-4 ${config.color}`} />
                              <span className={`text-sm ${config.color}`}>{config.label}</span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">リスクレベル</div>
                      <Badge variant="outline" className={`${riskLevelConfig[selectedEvent.riskLevel].bgColor} ${riskLevelConfig[selectedEvent.riskLevel].color}`}>
                        {riskLevelConfig[selectedEvent.riskLevel].label}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Target */}
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-3">対象</div>
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="text-xs text-slate-500 mb-1">対象タイプ</div>
                    <div className="text-sm text-slate-900 mb-2">{selectedEvent.targetType}</div>
                    <div className="text-xs text-slate-500 mb-1">対象名</div>
                    <div className="text-sm font-medium text-slate-900">{selectedEvent.targetName}</div>
                  </div>
                </div>

                {/* Linked Context */}
                {(selectedEvent.linkedCompany || selectedEvent.linkedProject || selectedEvent.linkedUser) && (
                  <div>
                    <div className="text-sm font-semibold text-slate-900 mb-3">関連文脈</div>
                    <div className="space-y-2">
                      {selectedEvent.linkedCompany && (
                        <div className="flex items-center gap-2 text-sm">
                          <Building className="w-4 h-4 text-slate-600" />
                          <span className="text-slate-600">Company:</span>
                          <Link 
                            to={`/company/${selectedEvent.linkedCompanyId}`}
                            className="text-blue-600 hover:underline"
                          >
                            {selectedEvent.linkedCompany}
                          </Link>
                        </div>
                      )}
                      {selectedEvent.linkedProject && (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="w-4 h-4 text-slate-600" />
                          <span className="text-slate-600">Project:</span>
                          <Link 
                            to={`/project/${selectedEvent.linkedProjectId}`}
                            className="text-blue-600 hover:underline"
                          >
                            {selectedEvent.linkedProject}
                          </Link>
                        </div>
                      )}
                      {selectedEvent.linkedUser && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-slate-600" />
                          <span className="text-slate-600">User:</span>
                          <span className="text-slate-900">{selectedEvent.linkedUser}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Before/After State */}
                {(selectedEvent.beforeState || selectedEvent.afterState) && (
                  <div>
                    <div className="text-sm font-semibold text-slate-900 mb-3">変更内容</div>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedEvent.beforeState && (
                        <div>
                          <div className="text-xs text-slate-500 mb-2">変更前</div>
                          <div className="bg-red-50 border border-red-200 rounded p-3">
                            <pre className="text-xs text-slate-900">
                              {JSON.stringify(selectedEvent.beforeState, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                      {selectedEvent.afterState && (
                        <div>
                          <div className="text-xs text-slate-500 mb-2">変更後</div>
                          <div className="bg-green-50 border border-green-200 rounded p-3">
                            <pre className="text-xs text-slate-900">
                              {JSON.stringify(selectedEvent.afterState, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Failure/Unresolved Reason */}
                {selectedEvent.failureReason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-red-900 mb-1">失敗理由</div>
                        <div className="text-sm text-red-800">{selectedEvent.failureReason}</div>
                      </div>
                    </div>
                  </div>
                )}
                {selectedEvent.unresolvedReason && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-orange-900 mb-1">未解決理由</div>
                        <div className="text-sm text-orange-800">{selectedEvent.unresolvedReason}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Note */}
                {selectedEvent.note && (
                  <div>
                    <div className="text-sm font-semibold text-slate-900 mb-2">メモ</div>
                    <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded p-3">
                      {selectedEvent.note}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4 border-t space-y-2">
                  <Link to={`/${selectedEvent.targetType.toLowerCase()}/${selectedEvent.targetId}`}>
                    <Button variant="outline" className="w-full justify-start">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      対象レコードを開く
                    </Button>
                  </Link>
                  {selectedEvent.linkedCompanyId && (
                    <Link to={`/company/${selectedEvent.linkedCompanyId}`}>
                      <Button variant="outline" className="w-full justify-start">
                        <Building className="w-4 h-4 mr-2" />
                        関連Companyを開く
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}