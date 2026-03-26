import { useState } from "react";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { RuleActionButtons } from "../components/settings/rule-action-buttons";
import { AlertRuleEditDialog } from "../components/settings/alert-rule-edit-dialog";
import { AlertRuleTestDialog } from "../components/settings/alert-rule-test-dialog";
import { RuleChangeHistorySheet } from "../components/settings/rule-change-history-sheet";
import { SuggestionRuleEditDialog } from "../components/settings/suggestion-rule-edit-dialog";
import { SummaryRuleEditDialog } from "../components/settings/summary-rule-edit-dialog";
import { ThresholdPresetEditDialog } from "../components/settings/threshold-preset-edit-dialog";
import { FeedDisplayRuleEditDialog } from "../components/settings/feed-display-rule-edit-dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Checkbox } from "../components/ui/checkbox";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Settings as SettingsIcon,
  Users,
  Shield,
  Key,
  Mail,
  MessageSquare,
  Sliders,
  Eye,
  Filter,
  Plus,
  Edit3,
  Save,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  UserPlus,
  Building,
  FileText,
  Target,
  Database,
  ChevronRight,
  Copy,
  Trash2,
  ExternalLink,
  Zap,
  Bot,
  GitBranch,
  Play,
  History,
  Sparkles,
  Bell,
  Lightbulb,
  TrendingUp,
  MoreVertical,
} from "lucide-react";

type SettingsTab = 
  | "users" 
  | "roles" 
  | "channels"
  | "destinations"
  | "ai_agents"
  | "support_intelligence"
  | "policy" 
  | "default_views" 
  | "general"
  | "automation_rules"
  | "automation_ai"
  | "automation_triggers"
  | "automation_run_policies"
  | "automation_send_policies";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
  status: "active" | "inactive";
  lastActive: string;
  createdAt: string;
  ownedItemsCount: number;
  assignedItemsCount: number;
  defaultViewScope?: string;
  permissionSummary?: string;
}

interface Role {
  id: string;
  name: string;
  memberCount: number;
  canViewCompany: boolean;
  canViewProject: boolean;
  canCreateAction: boolean;
  canCreateContent: boolean;
  canCreateLibrary: boolean;
  canCreateAudience: boolean;
  canCreateOutbound: boolean;
  canSend: boolean;
  canReview: boolean;
  canViewAudit: boolean;
  canEditSettings: boolean;
  lastUpdated: string;
}

interface Channel {
  id: string;
  name: string;
  type: "email" | "slack" | "chatwork" | "intercom";
  status: "active" | "error" | "inactive";
  defaultSender: string;
  lastChecked: string;
  hasFailure: boolean;
  destinationSummary?: string;
  resolverStatus?: string;
}

interface Destination {
  id: string;
  resolverName: string;
  targetType: string;
  status: "active" | "inactive" | "error";
  fallbackRule: string;
  lastChecked: string;
  failureCount: number;
  updatedAt: string;
  matchingRule?: string;
  retryBehavior?: string;
  unresolvedHandling?: string;
}

interface Policy {
  id: string;
  name: string;
  description?: string;
  targetScope: string;
  channel: string;
  triggerCondition: string;
  reviewRequired: boolean;
  approvalRequired: boolean;
  enabled: boolean;
  updatedAt: string;
  applicableRoles?: string[];
  exceptionRule?: string;
  notificationRule?: string;
  riskCondition?: string;
}

interface DefaultView {
  id: string;
  name: string;
  targetScreen: string;
  filterCondition: string;
  scope: "personal" | "team" | "workspace" | "role-based";
  owner: string;
  isDefault: boolean;
  updatedAt: string;
  updatedBy?: string;
  enabled: boolean;
  defaultSort?: string;
  applicableRoles?: string[];
  visibilityScope?: string;
  
  // ���期表示制御
  currentViewLabel: string;
  subtitle: string;
  defaultDisplayMode?: string; // "overview" | "table" | "kanban" | "clusters" etc.
  defaultGrouping?: string;
  defaultDensity?: string;
  
  // Summary Cards 制御
  summaryCardsTargetScope?: string;
  summaryCardTitlePresets?: string[];
  
  // Empty State 制御
  emptyStateTitle?: string;
  emptyStateBody?: string;
  emptyStateCtaLabel?: string;
  emptyStateCtaDestination?: string;
  
  // Filter Chips 制御
  filterChipsPreview?: string[];
  
  // Priority for conflict resolution
  priority?: number;
}

interface AIAgent {
  id: string;
  functionName: string;
  description: string;
  
  // Routing configuration
  primaryRouteType: "kocoro" | "openrouter";
  primaryRouteName: string;
  fallbackRouteType?: "kocoro" | "openrouter" | "none";
  fallbackRouteName?: string;
  fallbackCondition?: "primary_failure" | "timeout" | "unavailable" | "manual_switch_only";
  
  // Primary Route - Kocoro specific
  kocoro?: {
    agentName: string;
    agentId: string;
    apiEndpoint: string;
    authSetting: string;
    inputMapping: string;
    outputMapping: string;
  };
  
  // Primary Route - OpenRouter specific
  openrouter?: {
    model: string;
    provider: string;
    systemInstruction: string;
    additionalInstruction?: string;
    temperature: number;
    maxTokens: number;
    structuredOutputSchema?: string;
  };
  
  // Fallback Route - Kocoro specific
  fallbackKocoro?: {
    agentName: string;
    agentId: string;
    apiEndpoint: string;
    authSetting: string;
  };
  
  // Fallback Route - OpenRouter specific
  fallbackOpenrouter?: {
    model: string;
    provider: string;
    systemInstruction: string;
    temperature: number;
    maxTokens: number;
  };
  
  // Output configuration
  outputType: "text" | "markdown" | "json" | "file" | "mixed";
  fileOutputEnabled: boolean;
  fileType?: "pdf" | "pptx" | "docx" | "md" | "csv" | "xlsx" | "html" | "other";
  
  // Common settings
  timeout: number;
  retryPolicy: string;
  environment: "production" | "staging" | "development";
  enabled: boolean;
  status: "active" | "inactive" | "error";
  lastUpdated: string;
  updatedBy: string;
}

// モックデータ
const mockUsers: User[] = [
  {
    id: "user-1",
    name: "佐藤 太郎",
    email: "t.sato@example.com",
    role: "CSM",
    team: "Customer Success",
    status: "active",
    lastActive: "2026-03-17 15:30",
    createdAt: "2025-01-15",
    ownedItemsCount: 45,
    assignedItemsCount: 32,
  },
  {
    id: "user-2",
    name: "田中 花子",
    email: "h.tanaka@example.com",
    role: "CSM",
    team: "Customer Success",
    status: "active",
    lastActive: "2026-03-17 14:20",
    createdAt: "2025-02-01",
    ownedItemsCount: 38,
    assignedItemsCount: 28,
  },
  {
    id: "user-3",
    name: "山本 一郎",
    email: "i.yamamoto@example.com",
    role: "Manager",
    team: "Customer Success",
    status: "active",
    lastActive: "2026-03-17 16:00",
    createdAt: "2024-11-10",
    ownedItemsCount: 12,
    assignedItemsCount: 65,
  },
  {
    id: "user-4",
    name: "鈴木 次郎",
    email: "j.suzuki@example.com",
    role: "Support",
    team: "Support",
    status: "active",
    lastActive: "2026-03-17 13:45",
    createdAt: "2025-03-01",
    ownedItemsCount: 28,
    assignedItemsCount: 18,
  },
  {
    id: "user-5",
    name: "高橋 美咲",
    email: "m.takahashi@example.com",
    role: "CSM",
    team: "Customer Success",
    status: "inactive",
    lastActive: "2026-02-28 10:00",
    createdAt: "2025-01-20",
    ownedItemsCount: 5,
    assignedItemsCount: 2,
  },
];

const mockRoles: Role[] = [
  {
    id: "role-1",
    name: "Admin",
    memberCount: 2,
    canViewCompany: true,
    canViewProject: true,
    canCreateAction: true,
    canCreateContent: true,
    canCreateLibrary: true,
    canCreateAudience: true,
    canCreateOutbound: true,
    canSend: true,
    canReview: true,
    canViewAudit: true,
    canEditSettings: true,
    lastUpdated: "2026-01-15",
  },
  {
    id: "role-2",
    name: "Manager",
    memberCount: 3,
    canViewCompany: true,
    canViewProject: true,
    canCreateAction: true,
    canCreateContent: true,
    canCreateLibrary: true,
    canCreateAudience: true,
    canCreateOutbound: true,
    canSend: true,
    canReview: true,
    canViewAudit: true,
    canEditSettings: false,
    lastUpdated: "2026-02-10",
  },
  {
    id: "role-3",
    name: "CSM",
    memberCount: 8,
    canViewCompany: true,
    canViewProject: true,
    canCreateAction: true,
    canCreateContent: true,
    canCreateLibrary: true,
    canCreateAudience: true,
    canCreateOutbound: true,
    canSend: true,
    canReview: false,
    canViewAudit: false,
    canEditSettings: false,
    lastUpdated: "2026-03-01",
  },
  {
    id: "role-4",
    name: "Support",
    memberCount: 5,
    canViewCompany: true,
    canViewProject: true,
    canCreateAction: true,
    canCreateContent: true,
    canCreateLibrary: false,
    canCreateAudience: false,
    canCreateOutbound: false,
    canSend: false,
    canReview: false,
    canViewAudit: false,
    canEditSettings: false,
    lastUpdated: "2026-02-15",
  },
];

const mockChannels: Channel[] = [
  {
    id: "ch-1",
    name: "Primary Email",
    type: "email",
    status: "active",
    defaultSender: "cs@example.com",
    lastChecked: "2026-03-17 16:00",
    hasFailure: false,
    destinationSummary: "3 resolvers configured",
    resolverStatus: "active",
  },
  {
    id: "ch-2",
    name: "Customer Slack Workspace",
    type: "slack",
    status: "active",
    defaultSender: "CS Bot",
    lastChecked: "2026-03-17 15:30",
    hasFailure: false,
    destinationSummary: "2 resolvers configured",
    resolverStatus: "active",
  },
  {
    id: "ch-3",
    name: "Customer Chatwork Group",
    type: "chatwork",
    status: "active",
    defaultSender: "CS Bot",
    lastChecked: "2026-03-17 14:45",
    hasFailure: false,
    destinationSummary: "1 resolver configured",
    resolverStatus: "active",
  },
  {
    id: "ch-4",
    name: "Intercom Integration",
    type: "intercom",
    status: "error",
    defaultSender: "Support Team",
    lastChecked: "2026-03-17 12:00",
    hasFailure: true,
    destinationSummary: "1 resolver configured",
    resolverStatus: "error",
  },
];

const mockDestinations: Destination[] = [
  {
    id: "dest-1",
    resolverName: "Email Address Resolver",
    targetType: "Email",
    status: "active",
    fallbackRule: "Use default contact email",
    lastChecked: "2026-03-17 16:00",
    failureCount: 0,
    updatedAt: "2026-03-10",
    matchingRule: "Primary email from Company Contact",
    retryBehavior: "Retry 3 times with 5min interval",
    unresolvedHandling: "Mark as unresolved and notify owner",
  },
  {
    id: "dest-2",
    resolverName: "Slack Channel Resolver",
    targetType: "Slack",
    status: "active",
    fallbackRule: "Use #general channel",
    lastChecked: "2026-03-17 15:45",
    failureCount: 2,
    updatedAt: "2026-03-12",
    matchingRule: "Project-specific channel or Company channel",
    retryBehavior: "Retry 2 times immediately",
    unresolvedHandling: "Fallback to Email",
  },
  {
    id: "dest-3",
    resolverName: "Chatwork Room Resolver",
    targetType: "Chatwork",
    status: "active",
    fallbackRule: "Use default room",
    lastChecked: "2026-03-17 14:45",
    failureCount: 1,
    updatedAt: "2026-03-15",
    matchingRule: "Project-specific room or Company room",
    retryBehavior: "Retry 2 times with 1min interval",
    unresolvedHandling: "Fallback to Email",
  },
  {
    id: "dest-4",
    resolverName: "Intercom User Resolver",
    targetType: "Intercom",
    status: "error",
    fallbackRule: "Skip sending",
    lastChecked: "2026-03-17 12:00",
    failureCount: 15,
    updatedAt: "2026-03-08",
    matchingRule: "Match by email address",
    retryBehavior: "No retry",
    unresolvedHandling: "Log and skip",
  },
];

const mockPolicies: Policy[] = [
  {
    id: "policy-1",
    name: "大規模送信時のレビュー必須",
    description: "100件以上の大規模送信時には必ずレビュー・承認を経由",
    targetScope: "Outbound",
    channel: "Email",
    triggerCondition: "送信先 >= 100件",
    reviewRequired: true,
    approvalRequired: true,
    enabled: true,
    updatedAt: "2026-02-15",
    applicableRoles: ["CSM", "Manager", "Admin"],
    exceptionRule: "Manager以上は承認をスキップ可能",
    notificationRule: "Manager と Admin に通知",
    riskCondition: "High",
  },
  {
    id: "policy-2",
    name: "契約更新関連の承認フロー",
    description: "契約更新に関するプロポーザルは承認必須",
    targetScope: "Content",
    channel: "Email",
    triggerCondition: "タイプ = Proposal AND カテゴリ = 契約更新",
    reviewRequired: false,
    approvalRequired: true,
    enabled: false,
    updatedAt: "2026-02-20",
    applicableRoles: ["CSM", "Sales"],
    exceptionRule: "なし",
    notificationRule: "直属Manager に通知",
    riskCondition: "Medium",
  },
  {
    id: "policy-3",
    name: "外部API連携時の確認",
    description: "Salesforce等の外部システムへのPush操作は確認必須",
    targetScope: "Action",
    channel: "Salesforce",
    triggerCondition: "Push操作",
    reviewRequired: true,
    approvalRequired: false,
    enabled: true,
    updatedAt: "2026-03-10",
    applicableRoles: ["All"],
    exceptionRule: "Admin は確認スキップ可能",
    notificationRule: "実行者本人と Admin に通知",
    riskCondition: "Medium",
  },
];

const mockDefaultViews: DefaultView[] = [
  // Console
  {
    id: "view-console-1",
    name: "My Accounts",
    targetScreen: "Console",
    filterCondition: "owner = 自分",
    scope: "workspace",
    owner: "System",
    isDefault: true,
    updatedAt: "2026-01-20",
    updatedBy: "System",
    enabled: true,
    defaultSort: "Last Activity Desc",
    applicableRoles: ["CSM", "Manager", "Admin"],
    visibilityScope: "All roles",
    currentViewLabel: "My Accounts",
    subtitle: "自分が担当する顧客のみを表示する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by owner = 自分",
    emptyStateTitle: "担当顧客はまだありません",
    emptyStateBody: "顧客が割り当てられると、ここに表示されます",
    emptyStateCtaLabel: "All Accounts を見る",
    emptyStateCtaDestination: "all",
    filterChipsPreview: ["owner: 自分"],
    priority: 10,
  },
  {
    id: "view-console-2",
    name: "My Priorities",
    targetScreen: "Console",
    filterCondition: "priority = high AND owner = 自分",
    scope: "role-based",
    owner: "System",
    isDefault: false,
    updatedAt: "2026-02-15",
    updatedBy: "System",
    enabled: true,
    defaultSort: "Priority Desc",
    applicableRoles: ["CSM", "Manager"],
    visibilityScope: "CSM, Manager",
    currentViewLabel: "My Priorities",
    subtitle: "優先度の高い担当顧客を確認する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by priority = high AND owner = 自分",
    emptyStateTitle: "優先度の���い顧客はありません",
    emptyStateBody: "優先度が高い顧客が発生すると、ここに表示されます",
    emptyStateCtaLabel: "My Accounts を見る",
    emptyStateCtaDestination: "my",
    filterChipsPreview: ["priority: high", "owner: 自分"],
    priority: 20,
  },
  
  // Company
  {
    id: "view-company-1",
    name: "My Companies",
    targetScreen: "Company",
    filterCondition: "owner = 自分",
    scope: "workspace",
    owner: "System",
    isDefault: true,
    updatedAt: "2026-01-20",
    updatedBy: "System",
    enabled: true,
    defaultSort: "Last Activity Desc",
    applicableRoles: ["CSM", "Manager", "Admin"],
    visibilityScope: "All roles",
    currentViewLabel: "My Companies",
    subtitle: "自分が担当する企業のみを表示する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by owner = 自分",
    emptyStateTitle: "担当企業はまだありません",
    emptyStateBody: "企業が割り当てられると、ここに表示されます",
    emptyStateCtaLabel: "All Companies を見る",
    emptyStateCtaDestination: "all",
    filterChipsPreview: ["owner: 自分"],
    priority: 10,
  },
  {
    id: "view-company-2",
    name: "At Risk Companies",
    targetScreen: "Company",
    filterCondition: "signal = risk",
    scope: "workspace",
    owner: "System",
    isDefault: false,
    updatedAt: "2026-02-10",
    updatedBy: "System",
    enabled: true,
    defaultSort: "Health Score Asc",
    applicableRoles: ["CSM", "Manager", "Admin"],
    visibilityScope: "All roles",
    currentViewLabel: "At Risk",
    subtitle: "リスクシグナルが発生している企業を確認する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by signal = risk",
    emptyStateTitle: "リスク企業はありません",
    emptyStateBody: "リスクシグナルが発生すると、ここに表示されます",
    emptyStateCtaLabel: "My Companies を見る",
    emptyStateCtaDestination: "my",
    filterChipsPreview: ["signal: risk"],
    priority: 20,
  },
  
  // Projects
  {
    id: "view-projects-1",
    name: "My Projects",
    targetScreen: "Projects",
    filterCondition: "owner = 自分",
    scope: "workspace",
    owner: "System",
    isDefault: true,
    updatedAt: "2026-01-20",
    updatedBy: "System",
    enabled: true,
    defaultSort: "Health Score Asc",
    applicableRoles: ["CSM", "Manager", "Admin"],
    visibilityScope: "All roles",
    currentViewLabel: "My Projects",
    subtitle: "自分の担当Projectの状況と優先度を確認する",
    defaultDisplayMode: "overview",
    summaryCardsTargetScope: "Filtered by owner = 自分",
    emptyStateTitle: "担当Projectはまだありません",
    emptyStateBody: "Projectが割り当てられると、ここに表示されます",
    emptyStateCtaLabel: "All Projects を見る",
    emptyStateCtaDestination: "all",
    filterChipsPreview: ["owner: 自分"],
    priority: 10,
  },
  {
    id: "view-projects-2",
    name: "At Risk Projects",
    targetScreen: "Projects",
    filterCondition: "signal = risk",
    scope: "workspace",
    owner: "System",
    isDefault: false,
    updatedAt: "2026-02-15",
    updatedBy: "System",
    enabled: true,
    defaultSort: "Health Score Asc",
    applicableRoles: ["CSM", "Manager", "Admin"],
    visibilityScope: "All roles",
    currentViewLabel: "At Risk",
    subtitle: "リスクが高いProjectを優先的に確認する",
    defaultDisplayMode: "clusters",
    summaryCardsTargetScope: "Filtered by signal = risk",
    emptyStateTitle: "現在、リスクが高いProjectはありません",
    emptyStateBody: "リスク条件に該当するProjectが発生すると、ここに表示されます",
    emptyStateCtaLabel: "My Projects を見る",
    emptyStateCtaDestination: "my",
    filterChipsPreview: ["signal: risk"],
    priority: 20,
  },
  
  // Actions
  {
    id: "view-actions-1",
    name: "Assigned to me",
    targetScreen: "Actions",
    filterCondition: "assigned_to = 自分",
    scope: "workspace",
    owner: "System",
    isDefault: true,
    updatedAt: "2026-01-20",
    updatedBy: "System",
    enabled: true,
    defaultSort: "Due Date Asc",
    applicableRoles: ["CSM", "Manager", "Admin"],
    visibilityScope: "All roles",
    currentViewLabel: "Assigned to me",
    subtitle: "自分にアサインされたActionを確認する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by assigned_to = 自分",
    emptyStateTitle: "アサインされたActionはありません",
    emptyStateBody: "Actionが割り当てられると、ここに表示されます",
    emptyStateCtaLabel: "All Actions を見る",
    emptyStateCtaDestination: "all",
    filterChipsPreview: ["assigned_to: 自分"],
    priority: 10,
  },
  {
    id: "view-actions-2",
    name: "Overdue Actions",
    targetScreen: "Actions",
    filterCondition: "status = overdue",
    scope: "team",
    owner: "System",
    isDefault: false,
    updatedAt: "2026-02-20",
    updatedBy: "System",
    enabled: true,
    defaultSort: "Due Date Asc",
    applicableRoles: ["Manager", "Admin"],
    visibilityScope: "Manager, Admin",
    currentViewLabel: "Overdue",
    subtitle: "期限切れのActionを優先的に確認する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by status = overdue",
    emptyStateTitle: "期限切れのActionはありません",
    emptyStateBody: "すべてのActionが期限内です",
    emptyStateCtaLabel: "Assigned to me を見る",
    emptyStateCtaDestination: "my",
    filterChipsPreview: ["status: overdue"],
    priority: 30,
  },
  
  // Content
  {
    id: "view-content-1",
    name: "My Content",
    targetScreen: "Content",
    filterCondition: "owner = 自分",
    scope: "workspace",
    owner: "System",
    isDefault: true,
    updatedAt: "2026-01-20",
    updatedBy: "System",
    enabled: true,
    defaultSort: "Updated At Desc",
    applicableRoles: ["CSM", "Manager", "Admin"],
    visibilityScope: "All roles",
    currentViewLabel: "My Content",
    subtitle: "自分が作成したContentを確認する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by owner = 自分",
    emptyStateTitle: "作成したContentはまだありません",
    emptyStateBody: "Contentを作成すると、ここに表示されます",
    emptyStateCtaLabel: "All Content を見る",
    emptyStateCtaDestination: "all",
    filterChipsPreview: ["owner: 自分"],
    priority: 10,
  },
  {
    id: "view-content-2",
    name: "My Drafts",
    targetScreen: "Content",
    filterCondition: "owner = 自分 AND status = draft",
    scope: "personal",
    owner: "佐藤 太郎",
    isDefault: false,
    updatedAt: "2026-03-01",
    updatedBy: "佐藤 太郎",
    enabled: true,
    defaultSort: "Updated At Desc",
    applicableRoles: ["CSM", "Manager", "Admin"],
    visibilityScope: "All roles",
    currentViewLabel: "My Drafts",
    subtitle: "下書き状態のContentを確認する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by owner = 自分 AND status = draft",
    emptyStateTitle: "下書きはありません",
    emptyStateBody: "下書きを保存すると、ここに表示されます",
    emptyStateCtaLabel: "My Content を見る",
    emptyStateCtaDestination: "my",
    filterChipsPreview: ["owner: 自分", "status: draft"],
    priority: 15,
  },
  
  // Outbound
  {
    id: "view-outbound-1",
    name: "My Outbound",
    targetScreen: "Outbound",
    filterCondition: "owner = 自分",
    scope: "workspace",
    owner: "System",
    isDefault: true,
    updatedAt: "2026-01-20",
    updatedBy: "System",
    enabled: true,
    defaultSort: "Updated At Desc",
    applicableRoles: ["CSM", "Manager", "Admin"],
    visibilityScope: "All roles",
    currentViewLabel: "My Outbound",
    subtitle: "自分が作成したOutboundを確認する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by owner = 自分",
    emptyStateTitle: "作成したOutboundはまだありません",
    emptyStateBody: "Outboundを作成すると、ここに表示されます",
    emptyStateCtaLabel: "All Outbound を見る",
    emptyStateCtaDestination: "all",
    filterChipsPreview: ["owner: 自分"],
    priority: 10,
  },
  {
    id: "view-outbound-2",
    name: "Drafts",
    targetScreen: "Outbound",
    filterCondition: "status = draft",
    scope: "workspace",
    owner: "System",
    isDefault: false,
    updatedAt: "2026-02-10",
    updatedBy: "System",
    enabled: true,
    defaultSort: "Updated At Desc",
    applicableRoles: ["CSM", "Manager", "Admin"],
    visibilityScope: "All roles",
    currentViewLabel: "Drafts",
    subtitle: "下書き状態のOutboundを確認する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by status = draft",
    emptyStateTitle: "下書きはありません",
    emptyStateBody: "下書きを保存すると、ここに表示されます",
    emptyStateCtaLabel: "My Outbound を見る",
    emptyStateCtaDestination: "my",
    filterChipsPreview: ["status: draft"],
    priority: 20,
  },
  {
    id: "view-outbound-3",
    name: "Ready to Send",
    targetScreen: "Outbound",
    filterCondition: "status = ready",
    scope: "team",
    owner: "System",
    isDefault: false,
    updatedAt: "2026-02-15",
    updatedBy: "System",
    enabled: true,
    defaultSort: "Priority Desc",
    applicableRoles: ["CSM", "Manager", "Admin"],
    visibilityScope: "All roles",
    currentViewLabel: "Ready to Send",
    subtitle: "送信準備が完了したOutboundを確認する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by status = ready",
    emptyStateTitle: "送信準備が完了したOutboundはありません",
    emptyStateBody: "Outboundの準備が完了すると、ここに表示されます",
    emptyStateCtaLabel: "My Outbound を見る",
    emptyStateCtaDestination: "my",
    filterChipsPreview: ["status: ready"],
    priority: 25,
  },
  
  // Audience
  {
    id: "view-audience-1",
    name: "My Audiences",
    targetScreen: "Audience",
    filterCondition: "owner = 自分",
    scope: "workspace",
    owner: "System",
    isDefault: true,
    updatedAt: "2026-01-20",
    updatedBy: "System",
    enabled: true,
    defaultSort: "Updated At Desc",
    applicableRoles: ["CSM", "Manager", "Admin"],
    visibilityScope: "All roles",
    currentViewLabel: "My Audiences",
    subtitle: "自分が作成したAudienceを確認する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by owner = 自分",
    emptyStateTitle: "作成したAudienceはまだありません",
    emptyStateBody: "Audienceを作成すると、ここに表示されます",
    emptyStateCtaLabel: "All Audiences を見る",
    emptyStateCtaDestination: "all",
    filterChipsPreview: ["owner: 自分"],
    priority: 10,
  },
  {
    id: "view-audience-2",
    name: "Recently Used",
    targetScreen: "Audience",
    filterCondition: "last_used_at > 7days_ago",
    scope: "personal",
    owner: "佐藤 太郎",
    isDefault: false,
    updatedAt: "2026-02-28",
    updatedBy: "佐藤 太郎",
    enabled: true,
    defaultSort: "Last Used Desc",
    applicableRoles: ["CSM", "Manager", "Admin"],
    visibilityScope: "All roles",
    currentViewLabel: "Recently Used",
    subtitle: "最近使用したAudienceを確認する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by last_used_at > 7days_ago",
    emptyStateTitle: "最近使用したAudienceはありません",
    emptyStateBody: "Audienceを使用すると、ここに表示されます",
    emptyStateCtaLabel: "My Audiences を見る",
    emptyStateCtaDestination: "my",
    filterChipsPreview: ["last_used: 7日以内"],
    priority: 15,
  },
  
  // Inbox
  {
    id: "view-inbox-1",
    name: "Assigned to me",
    targetScreen: "Inbox",
    filterCondition: "assigned_to = 自分",
    scope: "workspace",
    owner: "System",
    isDefault: true,
    updatedAt: "2026-01-20",
    updatedBy: "System",
    enabled: true,
    defaultSort: "Created At Desc",
    applicableRoles: ["CSM", "Manager", "Admin"],
    visibilityScope: "All roles",
    currentViewLabel: "Assigned to me",
    subtitle: "自分にアサインされたInboxアイテムを確認する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by assigned_to = 自分",
    emptyStateTitle: "アサインされたアイテムはありません",
    emptyStateBody: "アイテムが割り当てられると、ここに表示されます",
    emptyStateCtaLabel: "My team を見る",
    emptyStateCtaDestination: "team",
    filterChipsPreview: ["assigned_to: 自分"],
    priority: 10,
  },
  {
    id: "view-inbox-2",
    name: "My team",
    targetScreen: "Inbox",
    filterCondition: "team = 自分のチーム",
    scope: "team",
    owner: "山本 一郎",
    isDefault: false,
    updatedAt: "2026-02-10",
    updatedBy: "山本 一郎",
    enabled: true,
    defaultSort: "Created At Desc",
    applicableRoles: ["CSM", "Manager", "Admin"],
    visibilityScope: "All roles",
    currentViewLabel: "My team",
    subtitle: "チームのInboxアイテムを確認する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by team = 自分のチーム",
    emptyStateTitle: "チームのアイテムはありません",
    emptyStateBody: "チームにアイテムが届くと、ここに表示されます",
    emptyStateCtaLabel: "Assigned to me を見る",
    emptyStateCtaDestination: "my",
    filterChipsPreview: ["team: 自分のチーム"],
    priority: 20,
  },
  {
    id: "view-inbox-3",
    name: "Unassigned",
    targetScreen: "Inbox",
    filterCondition: "assigned_to = null",
    scope: "team",
    owner: "System",
    isDefault: false,
    updatedAt: "2026-02-15",
    updatedBy: "System",
    enabled: true,
    defaultSort: "Created At Desc",
    applicableRoles: ["Manager", "Admin"],
    visibilityScope: "Manager, Admin",
    currentViewLabel: "Unassigned",
    subtitle: "未アサインのInboxアイテムを確認する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by assigned_to = null",
    emptyStateTitle: "未アサインのアイテムはありません",
    emptyStateBody: "すべてのアイテムがアサイン済みです",
    emptyStateCtaLabel: "My team を見る",
    emptyStateCtaDestination: "team",
    filterChipsPreview: ["assigned_to: 未アサイン"],
    priority: 30,
  },
  
  // Support
  {
    id: "view-support-1",
    name: "All Cases",
    targetScreen: "Support",
    filterCondition: "(none)",
    scope: "workspace",
    owner: "System",
    isDefault: true,
    updatedAt: "2026-01-20",
    updatedBy: "System",
    enabled: true,
    defaultSort: "Created At Desc",
    applicableRoles: ["CSM", "Support", "Manager", "Admin"],
    visibilityScope: "All roles",
    currentViewLabel: "All Cases",
    subtitle: "すべての問い合わせ・サポート・CSE連携案件を横断して確認する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "All cases",
    emptyStateTitle: "案件がありません",
    emptyStateBody: "問い合わせやサポート案件が発生すると、ここに表示されます",
    emptyStateCtaLabel: null,
    emptyStateCtaDestination: null,
    filterChipsPreview: [],
    priority: 10,
  },
  {
    id: "view-support-2",
    name: "Unassigned",
    targetScreen: "Support",
    filterCondition: "routing_status = unassigned",
    scope: "workspace",
    owner: "System",
    isDefault: false,
    updatedAt: "2026-02-01",
    updatedBy: "System",
    enabled: true,
    defaultSort: "Created At Asc",
    applicableRoles: ["Support", "Manager", "Admin"],
    visibilityScope: "Support, Manager, Admin",
    currentViewLabel: "Unassigned",
    subtitle: "未アサインの案件を優先的に振り分ける",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by routing_status = unassigned",
    emptyStateTitle: "未アサインの案件はありません",
    emptyStateBody: "すべての案件が振り分け済みです",
    emptyStateCtaLabel: "All Cases を見る",
    emptyStateCtaDestination: "all",
    filterChipsPreview: ["routing_status: unassigned"],
    priority: 15,
  },
  {
    id: "view-support-3",
    name: "My Cases",
    targetScreen: "Support",
    filterCondition: "owner = 自分",
    scope: "personal",
    owner: "山本 一郎",
    isDefault: false,
    updatedAt: "2026-02-15",
    updatedBy: "山本 一郎",
    enabled: true,
    defaultSort: "Created At Desc",
    applicableRoles: ["CSM", "Support", "Manager", "Admin"],
    visibilityScope: "All roles",
    currentViewLabel: "My Cases",
    subtitle: "自分が担当している案件を確認する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by owner = 自分",
    emptyStateTitle: "担当している案件はありません",
    emptyStateBody: "案件が割り当てられると、ここに表示されます",
    emptyStateCtaLabel: "Unassigned を見る",
    emptyStateCtaDestination: "unassigned",
    filterChipsPreview: ["owner: 自分"],
    priority: 12,
  },
  {
    id: "view-support-4",
    name: "CSE Linked",
    targetScreen: "Support",
    filterCondition: "case_type = CSE Ticket Linked",
    scope: "team",
    owner: "System",
    isDefault: false,
    updatedAt: "2026-02-20",
    updatedBy: "System",
    enabled: true,
    defaultSort: "Created At Desc",
    applicableRoles: ["Support", "CSE", "Manager", "Admin"],
    visibilityScope: "Support, CSE, Manager, Admin",
    currentViewLabel: "CSE Linked",
    subtitle: "CSE連携案件のみを確認する",
    defaultDisplayMode: "table",
    summaryCardsTargetScope: "Filtered by case_type = CSE Ticket Linked",
    emptyStateTitle: "CSE連携案件はありません",
    emptyStateBody: "CSE Ticketと連携した案件が発生すると、ここに表示されます",
    emptyStateCtaLabel: "All Cases を見る",
    emptyStateCtaDestination: "all",
    filterChipsPreview: ["case_type: CSE Ticket Linked"],
    priority: 20,
  },
];

const mockAIAgents: AIAgent[] = [
  {
    id: "agent-1",
    functionName: "Signal Detection",
    description: "顧客データからHealth/Risk/Opportunityシグナルを抽出",
    primaryRouteType: "openrouter",
    primaryRouteName: "GPT-4 Turbo",
    fallbackRouteType: "none",
    fallbackCondition: "primary_failure",
    openrouter: {
      model: "gpt-4-turbo-2024-04-09",
      provider: "OpenAI",
      systemInstruction: "Analyze customer data and extract Health/Risk/Opportunity signals.",
      additionalInstruction: "Focus on health, risk, and opportunity signals with high precision.",
      temperature: 0.3,
      maxTokens: 2000,
    },
    outputType: "json",
    fileOutputEnabled: false,
    timeout: 30,
    retryPolicy: "3回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-15",
    updatedBy: "山本 一郎",
  },
  {
    id: "agent-2",
    functionName: "Evidence Extraction",
    description: "ログ・コミュニケーションからEvidenceを抽出",
    primaryRouteType: "openrouter",
    primaryRouteName: "Claude 3 Opus",
    fallbackRouteType: "none",
    fallbackCondition: "primary_failure",
    openrouter: {
      model: "claude-3-opus-20240229",
      provider: "Anthropic",
      systemInstruction: "Extract structured evidence from logs and communications.",
      temperature: 0.2,
      maxTokens: 3000,
    },
    outputType: "json",
    fileOutputEnabled: false,
    timeout: 45,
    retryPolicy: "3回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-14",
    updatedBy: "山本 一郎",
  },
  {
    id: "agent-3",
    functionName: "Alert Generation",
    description: "シグナルとフェーズからAlert/次アクション提案",
    primaryRouteType: "openrouter",
    primaryRouteName: "GPT-4 Turbo",
    fallbackRouteType: "none",
    fallbackCondition: "primary_failure",
    openrouter: {
      model: "gpt-4-turbo-2024-04-09",
      provider: "OpenAI",
      systemInstruction: "Generate contextual alerts and action proposals based on signals and phase.",
      temperature: 0.4,
      maxTokens: 1500,
    },
    outputType: "json",
    fileOutputEnabled: false,
    timeout: 20,
    retryPolicy: "2回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-16",
    updatedBy: "山本 一郎",
  },
  {
    id: "agent-4",
    functionName: "Action Drafting",
    description: "文脈からAction下書きを生成",
    primaryRouteType: "kocoro",
    primaryRouteName: "Action Drafter Pro",
    fallbackRouteType: "openrouter",
    fallbackRouteName: "GPT-4",
    fallbackCondition: "primary_failure",
    kocoro: {
      agentName: "Action Drafter Pro",
      agentId: "kocoro-agent-004",
      apiEndpoint: "https://api.kocoro.ai/agents/action-draft/execute",
      authSetting: "Bearer token configured",
      inputMapping: "company, project, evidence → context",
      outputMapping: "action_text, priority, timeline",
    },
    fallbackOpenrouter: {
      model: "gpt-4-0613",
      provider: "OpenAI",
      systemInstruction: "Draft action items based on customer context.",
      temperature: 0.5,
      maxTokens: 2000,
    },
    outputType: "text",
    fileOutputEnabled: false,
    timeout: 30,
    retryPolicy: "3回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-10",
    updatedBy: "田中 花子",
  },
  {
    id: "agent-5",
    functionName: "Content Drafting",
    description: "顧客文脈つきコンテンツ作成",
    primaryRouteType: "kocoro",
    primaryRouteName: "Content Creator Pro",
    fallbackRouteType: "openrouter",
    fallbackRouteName: "Claude 3 Opus",
    fallbackCondition: "primary_failure",
    kocoro: {
      agentName: "Content Creator Pro",
      agentId: "kocoro-agent-005",
      apiEndpoint: "https://api.kocoro.ai/agents/content-draft/execute",
      authSetting: "Bearer token configured",
      inputMapping: "company, project, user, evidence → context",
      outputMapping: "content_text, subject_line, cta, attachments",
    },
    fallbackOpenrouter: {
      model: "claude-3-opus-20240229",
      provider: "Anthropic",
      systemInstruction: "Create customer-context content drafts with professional tone.",
      additionalInstruction: "Maintain personalization and relevance to customer context.",
      temperature: 0.6,
      maxTokens: 4000,
    },
    outputType: "mixed",
    fileOutputEnabled: true,
    fileType: "docx",
    timeout: 60,
    retryPolicy: "3回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-15",
    updatedBy: "山本 一郎",
  },
  {
    id: "agent-6",
    functionName: "Cluster Detection",
    description: "類似パターンのクラスター抽出",
    primaryRouteType: "kocoro",
    primaryRouteName: "Cluster Analyzer Pro",
    fallbackRouteType: "openrouter",
    fallbackRouteName: "GPT-4 Turbo",
    fallbackCondition: "primary_failure",
    kocoro: {
      agentName: "Cluster Analyzer Pro",
      agentId: "kocoro-agent-006",
      apiEndpoint: "https://api.kocoro.ai/agents/cluster-detect/execute",
      authSetting: "Bearer token configured",
      inputMapping: "signals, evidence, logs → dataset",
      outputMapping: "clusters, patterns, insights, report_file",
    },
    fallbackOpenrouter: {
      model: "gpt-4-turbo-2024-04-09",
      provider: "OpenAI",
      systemInstruction: "Detect patterns and clusters in customer data.",
      temperature: 0.3,
      maxTokens: 2500,
    },
    outputType: "mixed",
    fileOutputEnabled: true,
    fileType: "xlsx",
    timeout: 45,
    retryPolicy: "2回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-12",
    updatedBy: "佐藤 太郎",
  },
  {
    id: "agent-7",
    functionName: "Log Extraction",
    description: "ログからイベント・インサイト抽出",
    primaryRouteType: "kocoro",
    primaryRouteName: "Log Extractor Pro",
    fallbackRouteType: "openrouter",
    fallbackRouteName: "Claude 3 Sonnet",
    fallbackCondition: "primary_failure",
    kocoro: {
      agentName: "Log Extractor Pro",
      agentId: "kocoro-agent-007",
      apiEndpoint: "https://api.kocoro.ai/agents/log-extract/execute",
      authSetting: "Bearer token configured",
      inputMapping: "log_data, timestamp, user → input",
      outputMapping: "events, insights, metrics",
    },
    fallbackOpenrouter: {
      model: "claude-3-sonnet-20240229",
      provider: "Anthropic",
      systemInstruction: "Extract events and insights from log data.",
      temperature: 0.2,
      maxTokens: 3000,
    },
    outputType: "json",
    fileOutputEnabled: false,
    timeout: 30,
    retryPolicy: "3回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-11",
    updatedBy: "山本 一郎",
  },
  {
    id: "agent-8",
    functionName: "Log Summarization",
    description: "長文ログを要約",
    primaryRouteType: "kocoro",
    primaryRouteName: "Log Summarizer Pro",
    fallbackRouteType: "openrouter",
    fallbackRouteName: "GPT-4",
    fallbackCondition: "primary_failure",
    kocoro: {
      agentName: "Log Summarizer Pro",
      agentId: "kocoro-agent-008",
      apiEndpoint: "https://api.kocoro.ai/agents/log-summarize/execute",
      authSetting: "Bearer token configured",
      inputMapping: "log_text, filters → input",
      outputMapping: "summary, key_points, recommendations",
    },
    fallbackOpenrouter: {
      model: "gpt-4-0613",
      provider: "OpenAI",
      systemInstruction: "Summarize long logs concisely with key insights.",
      temperature: 0.4,
      maxTokens: 1000,
    },
    outputType: "text",
    fileOutputEnabled: false,
    timeout: 25,
    retryPolicy: "2回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-09",
    updatedBy: "田中 花子",
  },
  {
    id: "agent-9",
    functionName: "FAQ Drafting",
    description: "FAQ記事の下書き生成",
    primaryRouteType: "kocoro",
    primaryRouteName: "FAQ Generator Pro",
    fallbackRouteType: "openrouter",
    fallbackRouteName: "Claude 3 Sonnet",
    fallbackCondition: "primary_failure",
    kocoro: {
      agentName: "FAQ Generator Pro",
      agentId: "kocoro-agent-009",
      apiEndpoint: "https://api.kocoro.ai/agents/faq-draft/execute",
      authSetting: "Bearer token configured",
      inputMapping: "topic, context, examples → input",
      outputMapping: "faq_items, categories, metadata, markdown_file",
    },
    fallbackOpenrouter: {
      model: "claude-3-sonnet-20240229",
      provider: "Anthropic",
      systemInstruction: "Draft comprehensive FAQ articles.",
      temperature: 0.5,
      maxTokens: 2000,
    },
    outputType: "mixed",
    fileOutputEnabled: true,
    fileType: "md",
    timeout: 40,
    retryPolicy: "3回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-08",
    updatedBy: "佐藤 太郎",
  },
  {
    id: "agent-10",
    functionName: "Help Drafting",
    description: "ヘルプ記事の下書き生成",
    primaryRouteType: "kocoro",
    primaryRouteName: "Help Article Pro",
    fallbackRouteType: "openrouter",
    fallbackRouteName: "Claude 3 Opus",
    fallbackCondition: "primary_failure",
    kocoro: {
      agentName: "Help Article Pro",
      agentId: "kocoro-agent-010",
      apiEndpoint: "https://api.kocoro.ai/agents/help-draft/execute",
      authSetting: "Bearer token configured",
      inputMapping: "topic, steps, screenshots → input",
      outputMapping: "article_text, title, tags, html_file",
    },
    fallbackOpenrouter: {
      model: "claude-3-opus-20240229",
      provider: "Anthropic",
      systemInstruction: "Draft detailed help articles with step-by-step guidance.",
      temperature: 0.5,
      maxTokens: 2500,
    },
    outputType: "mixed",
    fileOutputEnabled: true,
    fileType: "html",
    timeout: 50,
    retryPolicy: "3回リトライ",
    environment: "production",
    enabled: false,
    status: "inactive",
    lastUpdated: "2026-02-28",
    updatedBy: "山本 一郎",
  },
  {
    id: "agent-11",
    functionName: "Proposal Drafting",
    description: "提案文・セールス資料の下書き生成",
    primaryRouteType: "kocoro",
    primaryRouteName: "Proposal Generator Pro",
    fallbackRouteType: "openrouter",
    fallbackRouteName: "GPT-4 Turbo",
    fallbackCondition: "primary_failure",
    kocoro: {
      agentName: "Proposal Generator Pro",
      agentId: "kocoro-agent-123",
      apiEndpoint: "https://api.kocoro.ai/agents/proposal-gen/execute",
      authSetting: "Bearer token configured",
      inputMapping: "company, project, evidence → context",
      outputMapping: "proposal_text, executive_summary, pricing, presentation_file",
    },
    fallbackOpenrouter: {
      model: "gpt-4-turbo-2024-04-09",
      provider: "OpenAI",
      systemInstruction: "Draft comprehensive sales proposals with executive summary and pricing.",
      temperature: 0.6,
      maxTokens: 4000,
    },
    outputType: "mixed",
    fileOutputEnabled: true,
    fileType: "pptx",
    timeout: 60,
    retryPolicy: "3回リト��イ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-14",
    updatedBy: "山本 一郎",
  },
  {
    id: "agent-12",
    functionName: "Audience Generation",
    description: "セグメント条件から対象Audience生成",
    primaryRouteType: "kocoro",
    primaryRouteName: "Audience Builder Pro",
    fallbackRouteType: "openrouter",
    fallbackRouteName: "Claude 3 Sonnet",
    fallbackCondition: "primary_failure",
    kocoro: {
      agentName: "Audience Builder Pro",
      agentId: "kocoro-agent-012",
      apiEndpoint: "https://api.kocoro.ai/agents/audience-gen/execute",
      authSetting: "Bearer token configured",
      inputMapping: "segment_rules, filters → criteria",
      outputMapping: "audience_list, size, attributes, export_file",
    },
    fallbackOpenrouter: {
      model: "claude-3-sonnet-20240229",
      provider: "Anthropic",
      systemInstruction: "Generate audience segments from filtering criteria.",
      temperature: 0.3,
      maxTokens: 2000,
    },
    outputType: "mixed",
    fileOutputEnabled: true,
    fileType: "csv",
    timeout: 35,
    retryPolicy: "2回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-13",
    updatedBy: "佐藤 太郎",
  },
  {
    id: "agent-13",
    functionName: "Event Structuring",
    description: "企画メモ・添付資料からEvent情報を整理",
    primaryRouteType: "kocoro",
    primaryRouteName: "Event Structurer Pro",
    fallbackRouteType: "openrouter",
    fallbackRouteName: "GPT-4 Turbo",
    fallbackCondition: "primary_failure",
    kocoro: {
      agentName: "Event Structurer Pro",
      agentId: "kocoro-agent-013",
      apiEndpoint: "https://api.kocoro.ai/agents/event-structure/execute",
      authSetting: "Bearer token configured",
      inputMapping: "event_docs, attachments, notes → input",
      outputMapping: "structured_event, title, overview, target, goal",
    },
    fallbackOpenrouter: {
      model: "gpt-4-turbo-2024-04-09",
      provider: "OpenAI",
      systemInstruction: "Structure event planning documents into organized event information.",
      temperature: 0.4,
      maxTokens: 2500,
    },
    outputType: "json",
    fileOutputEnabled: false,
    timeout: 40,
    retryPolicy: "3回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-16",
    updatedBy: "山本 一郎",
  },
  {
    id: "agent-14",
    functionName: "Event Summary",
    description: "Event概要の要約生成",
    primaryRouteType: "kocoro",
    primaryRouteName: "Event Summarizer Pro",
    fallbackRouteType: "openrouter",
    fallbackRouteName: "Claude 3 Sonnet",
    fallbackCondition: "primary_failure",
    kocoro: {
      agentName: "Event Summarizer Pro",
      agentId: "kocoro-agent-014",
      apiEndpoint: "https://api.kocoro.ai/agents/event-summary/execute",
      authSetting: "Bearer token configured",
      inputMapping: "event_details, objectives → input",
      outputMapping: "summary_text, key_points, timeline",
    },
    fallbackOpenrouter: {
      model: "claude-3-sonnet-20240229",
      provider: "Anthropic",
      systemInstruction: "Summarize event details concisely with key objectives.",
      temperature: 0.4,
      maxTokens: 1500,
    },
    outputType: "text",
    fileOutputEnabled: false,
    timeout: 25,
    retryPolicy: "2回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-15",
    updatedBy: "田中 花子",
  },
  {
    id: "agent-15",
    functionName: "Event Target Suggestion",
    description: "Event目的から対象Audience提案",
    primaryRouteType: "kocoro",
    primaryRouteName: "Target Suggester Pro",
    fallbackRouteType: "openrouter",
    fallbackRouteName: "GPT-4 Turbo",
    fallbackCondition: "primary_failure",
    kocoro: {
      agentName: "Target Suggester Pro",
      agentId: "kocoro-agent-015",
      apiEndpoint: "https://api.kocoro.ai/agents/event-target/execute",
      authSetting: "Bearer token configured",
      inputMapping: "event_type, objectives, customer_data → context",
      outputMapping: "suggested_audiences, targeting_criteria, estimated_size",
    },
    fallbackOpenrouter: {
      model: "gpt-4-turbo-2024-04-09",
      provider: "OpenAI",
      systemInstruction: "Suggest target audiences for events based on objectives and customer data.",
      temperature: 0.5,
      maxTokens: 2000,
    },
    outputType: "json",
    fileOutputEnabled: false,
    timeout: 35,
    retryPolicy: "3回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-14",
    updatedBy: "佐藤 太郎",
  },
  {
    id: "agent-16",
    functionName: "Event Content Suggestion",
    description: "Event向けContent案を提案",
    primaryRouteType: "kocoro",
    primaryRouteName: "Content Suggester Pro",
    fallbackRouteType: "openrouter",
    fallbackRouteName: "Claude 3 Opus",
    fallbackCondition: "primary_failure",
    kocoro: {
      agentName: "Content Suggester Pro",
      agentId: "kocoro-agent-016",
      apiEndpoint: "https://api.kocoro.ai/agents/event-content/execute",
      authSetting: "Bearer token configured",
      inputMapping: "event_details, target_audience → context",
      outputMapping: "content_ideas, formats, channels, timeline",
    },
    fallbackOpenrouter: {
      model: "claude-3-opus-20240229",
      provider: "Anthropic",
      systemInstruction: "Suggest content ideas and formats for event campaigns.",
      temperature: 0.6,
      maxTokens: 3000,
    },
    outputType: "json",
    fileOutputEnabled: false,
    timeout: 45,
    retryPolicy: "3回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-13",
    updatedBy: "山本 一郎",
  },
  {
    id: "agent-17",
    functionName: "Support Intelligence",
    description: "Support Intelligence設定に基づくアラート検出・AI提案・サマリー生成",
    primaryRouteType: "kocoro",
    primaryRouteName: "Support Intelligence Pro",
    fallbackRouteType: "openrouter",
    fallbackRouteName: "GPT-4 Turbo",
    fallbackCondition: "primary_failure",
    kocoro: {
      agentName: "Support Intelligence Pro",
      agentId: "kocoro-agent-017",
      apiEndpoint: "https://api.kocoro.ai/agents/support-intelligence/execute",
      authSetting: "Bearer token configured",
      inputMapping: "alert_rules, suggestion_rules, summary_rules, threshold_presets, cse_tickets → context",
      outputMapping: "alerts, ai_suggestions, summaries, priority_queue, evidence_summary",
    },
    fallbackOpenrouter: {
      model: "gpt-4-turbo-2024-04-09",
      provider: "OpenAI",
      systemInstruction: "Execute Support Intelligence rules to detect alerts, generate AI suggestions, and create summaries based on configured rules and thresholds.",
      additionalInstruction: "Apply Alert Rules for detection, Suggestion Rules for AI proposals, Summary Rules for evidence summaries, and Threshold Presets for condition evaluation. Output structured alerts with priority, context-aware suggestions, and concise summaries.",
      temperature: 0.4,
      maxTokens: 3500,
    },
    outputType: "mixed",
    fileOutputEnabled: true,
    fileType: "json",
    timeout: 50,
    retryPolicy: "3回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-17",
    updatedBy: "山本 一郎",
  },
  {
    id: "agent-18",
    functionName: "Automation Flow Suggestion",
    description: "Triggerに基づいて最適なAutomationフローを提案",
    primaryRouteType: "kocoro",
    primaryRouteName: "Automation Flow Suggester Pro",
    fallbackRouteType: "openrouter",
    fallbackRouteName: "GPT-4 Turbo",
    fallbackCondition: "primary_failure",
    kocoro: {
      agentName: "Automation Flow Suggester Pro",
      agentId: "kocoro-agent-018",
      apiEndpoint: "https://api.kocoro.ai/agents/automation-flow/execute",
      authSetting: "Bearer token configured",
      inputMapping: "trigger_type, context, constraints → input",
      outputMapping: "suggested_flow, steps, branches, rationale",
    },
    fallbackOpenrouter: {
      model: "gpt-4-turbo-2024-04-09",
      provider: "OpenAI",
      systemInstruction: "Suggest optimal automation flow based on trigger type and business context.",
      additionalInstruction: "Consider best practices for customer engagement, timing, and resource efficiency. Recommend appropriate send modes based on risk and volume.",
      temperature: 0.5,
      maxTokens: 3000,
    },
    outputType: "json",
    fileOutputEnabled: false,
    timeout: 40,
    retryPolicy: "3回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-17",
    updatedBy: "山本 一郎",
  },
  {
    id: "agent-19",
    functionName: "Automation Audience Suggestion",
    description: "Event/Trigger文脈から対象Audienceを提案",
    primaryRouteType: "kocoro",
    primaryRouteName: "Automation Audience Suggester Pro",
    fallbackRouteType: "openrouter",
    fallbackRouteName: "Claude 3 Opus",
    fallbackCondition: "primary_failure",
    kocoro: {
      agentName: "Automation Audience Suggester Pro",
      agentId: "kocoro-agent-019",
      apiEndpoint: "https://api.kocoro.ai/agents/automation-audience/execute",
      authSetting: "Bearer token configured",
      inputMapping: "event_details, trigger_context, customer_data → input",
      outputMapping: "suggested_audiences, filters, size_estimates, targeting_criteria",
    },
    fallbackOpenrouter: {
      model: "claude-3-opus-20240229",
      provider: "Anthropic",
      systemInstruction: "Suggest target audiences for automation based on event and trigger context.",
      temperature: 0.4,
      maxTokens: 2500,
    },
    outputType: "json",
    fileOutputEnabled: false,
    timeout: 35,
    retryPolicy: "3回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-17",
    updatedBy: "田中 花子",
  },
  {
    id: "agent-20",
    functionName: "Automation Branch Suggestion",
    description: "条件に応じた分岐ロジックを提案",
    primaryRouteType: "kocoro",
    primaryRouteName: "Automation Branch Suggester Pro",
    fallbackRouteType: "openrouter",
    fallbackRouteName: "GPT-4 Turbo",
    fallbackCondition: "primary_failure",
    kocoro: {
      agentName: "Automation Branch Suggester Pro",
      agentId: "kocoro-agent-020",
      apiEndpoint: "https://api.kocoro.ai/agents/automation-branch/execute",
      authSetting: "Bearer token configured",
      inputMapping: "flow_context, previous_steps, business_logic → input",
      outputMapping: "branch_conditions, paths, recommendations, fallback_logic",
    },
    fallbackOpenrouter: {
      model: "gpt-4-turbo-2024-04-09",
      provider: "OpenAI",
      systemInstruction: "Suggest branching logic for automation flows based on business conditions.",
      temperature: 0.4,
      maxTokens: 2000,
    },
    outputType: "json",
    fileOutputEnabled: false,
    timeout: 30,
    retryPolicy: "2回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-17",
    updatedBy: "佐藤 太郎",
  },
  {
    id: "agent-21",
    functionName: "Automation Send Policy Suggestion",
    description: "フロー内容からSend Modeを提案",
    primaryRouteType: "kocoro",
    primaryRouteName: "Automation Send Policy Suggester Pro",
    fallbackRouteType: "openrouter",
    fallbackRouteName: "Claude 3 Sonnet",
    fallbackCondition: "primary_failure",
    kocoro: {
      agentName: "Automation Send Policy Suggester Pro",
      agentId: "kocoro-agent-021",
      apiEndpoint: "https://api.kocoro.ai/agents/automation-send-policy/execute",
      authSetting: "Bearer token configured",
      inputMapping: "flow_details, target_audience, risk_factors → input",
      outputMapping: "recommended_send_mode, restrictions, rationale, policy_compliance",
    },
    fallbackOpenrouter: {
      model: "claude-3-sonnet-20240229",
      provider: "Anthropic",
      systemInstruction: "Recommend send mode (draft only / review before send / auto send) based on flow content, audience size, and risk factors.",
      temperature: 0.3,
      maxTokens: 2000,
    },
    outputType: "json",
    fileOutputEnabled: false,
    timeout: 25,
    retryPolicy: "2回リトライ",
    environment: "production",
    enabled: true,
    status: "active",
    lastUpdated: "2026-03-17",
    updatedBy: "山本 一郎",
  },
];

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("users");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [selectedView, setSelectedView] = useState<DefaultView | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Support Intelligence States
  const [alertRuleEditOpen, setAlertRuleEditOpen] = useState(false);
  const [suggestionRuleEditOpen, setSuggestionRuleEditOpen] = useState(false);
  const [summaryRuleEditOpen, setSummaryRuleEditOpen] = useState(false);
  const [thresholdPresetEditOpen, setThresholdPresetEditOpen] = useState(false);
  const [feedDisplayRuleEditOpen, setFeedDisplayRuleEditOpen] = useState(false);
  const [alertRuleTestOpen, setAlertRuleTestOpen] = useState(false);
  const [ruleHistoryOpen, setRuleHistoryOpen] = useState(false);
  const [selectedAlertRule, setSelectedAlertRule] = useState<any>(null);
  const [alertRuleEditMode, setAlertRuleEditMode] = useState<"edit" | "create" | "duplicate">("edit");
  const [currentRuleName, setCurrentRuleName] = useState("");
  const [currentRuleType, setCurrentRuleType] = useState<"alert" | "suggestion" | "summary" | "threshold" | "feed">("alert");

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    setIsDrawerOpen(true);
  };

  const handleRoleClick = (role: Role) => {
    setSelectedRole(role);
    setIsDrawerOpen(true);
  };

  const handleInviteUser = () => {
    setIsDialogOpen(true);
  };

  // Support Intelligence Handlers
  const handleAlertRuleEdit = (ruleName: string, ruleType: "alert" | "suggestion" | "summary" | "threshold" | "feed" = "alert", ruleData?: any) => {
    setCurrentRuleName(ruleName);
    setCurrentRuleType(ruleType);
    setSelectedAlertRule(ruleData || {
      id: "1",
      name: ruleName,
      alertType: "Urgent",
      sourceScope: "CSE Ticket",
      triggerCondition: "Waiting > 48h",
      priority: "Critical",
      status: "Enabled",
      lastUpdated: "2024-03-15",
      updatedBy: "佐藤 Manager",
      enabled: true,
    });
    setAlertRuleEditMode("edit");
    
    // Open the appropriate modal based on rule type
    if (ruleType === "suggestion") {
      setSuggestionRuleEditOpen(true);
    } else if (ruleType === "summary") {
      setSummaryRuleEditOpen(true);
    } else if (ruleType === "threshold") {
      setThresholdPresetEditOpen(true);
    } else if (ruleType === "feed") {
      setFeedDisplayRuleEditOpen(true);
    } else {
      setAlertRuleEditOpen(true);
    }
  };

  const handleAlertRuleTest = (ruleName: string) => {
    setCurrentRuleName(ruleName);
    setAlertRuleTestOpen(true);
  };

  const handleAlertRuleCopy = (ruleName: string, ruleType: "alert" | "suggestion" | "summary" | "threshold" | "feed" = "alert", ruleData?: any) => {
    setCurrentRuleName(ruleName + " (コピー)");
    setCurrentRuleType(ruleType);
    setSelectedAlertRule(ruleData || {
      id: "",
      name: ruleName + " (コピー)",
      alertType: "Urgent",
      sourceScope: "CSE Ticket",
      triggerCondition: "Waiting > 48h",
      priority: "Critical",
      status: "Enabled",
      lastUpdated: new Date().toISOString().split("T")[0],
      updatedBy: "Current User",
      enabled: true,
    });
    setAlertRuleEditMode("duplicate");
    
    // Open the appropriate modal based on rule type
    if (ruleType === "suggestion") {
      setSuggestionRuleEditOpen(true);
    } else if (ruleType === "summary") {
      setSummaryRuleEditOpen(true);
    } else if (ruleType === "threshold") {
      setThresholdPresetEditOpen(true);
    } else if (ruleType === "feed") {
      setFeedDisplayRuleEditOpen(true);
    } else {
      setAlertRuleEditOpen(true);
    }
  };

  const handleRuleHistory = (ruleName: string) => {
    setCurrentRuleName(ruleName);
    setRuleHistoryOpen(true);
  };

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
                    <SettingsIcon className="w-5 h-5 text-slate-600" />
                    <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
                  </div>
                  <p className="text-sm text-slate-600">
                    ユーザー管理・権限設定・チャネル設定・ポリシー管理・デフォルトビュー設定 • 運用基盤の管理
                  </p>
                </div>
                {activeTab === "users" && (
                  <Button onClick={handleInviteUser}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    ユーザーを招待
                  </Button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white px-6">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SettingsTab)}>
                <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                  <TabsTrigger value="users" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    <Users className="w-4 h-4 mr-2" />
                    ユーザー管理
                  </TabsTrigger>
                  <TabsTrigger value="roles" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    <Shield className="w-4 h-4 mr-2" />
                    ロール・権限
                  </TabsTrigger>
                  <TabsTrigger value="channels" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    チャネル設定
                  </TabsTrigger>
                  <TabsTrigger value="destinations" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    <Target className="w-4 h-4 mr-2" />
                    送信先・Resolver
                  </TabsTrigger>
                  <TabsTrigger value="ai_agents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    <Bot className="w-4 h-4 mr-2" />
                    AIエージェント
                  </TabsTrigger>
                  <TabsTrigger value="support_intelligence" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Support Intelligence
                  </TabsTrigger>
                  <TabsTrigger value="automation_rules" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    <GitBranch className="w-4 h-4 mr-2" />
                    Automation Rules
                  </TabsTrigger>
                  <TabsTrigger value="automation_ai" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    <Zap className="w-4 h-4 mr-2" />
                    Automation AI
                  </TabsTrigger>
                  <TabsTrigger value="automation_triggers" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    <Play className="w-4 h-4 mr-2" />
                    Automation Triggers
                  </TabsTrigger>
                  <TabsTrigger value="automation_run_policies" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    <Shield className="w-4 h-4 mr-2" />
                    Automation Run Policies
                  </TabsTrigger>
                  <TabsTrigger value="automation_send_policies" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    <Mail className="w-4 h-4 mr-2" />
                    Automation Send Policies
                  </TabsTrigger>
                  <TabsTrigger value="policy" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    レビュー・承認ポリシー
                  </TabsTrigger>
                  <TabsTrigger value="default_views" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    <Filter className="w-4 h-4 mr-2" />
                    デフォルトビュー
                  </TabsTrigger>
                  <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent">
                    <Sliders className="w-4 h-4 mr-2" />
                    一般設定
                  </TabsTrigger>
                </TabsList>

                {/* User Management Tab */}
                <TabsContent value="users" className="mt-0">
                  <div className="border-t">
                    <div className="p-4 bg-slate-50 border-b">
                      <Input
                        placeholder="ユーザーを検索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="max-w-md"
                      />
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>ユーザー名</TableHead>
                          <TableHead>メールアドレス</TableHead>
                          <TableHead>ロール</TableHead>
                          <TableHead>チーム</TableHead>
                          <TableHead>ステータス</TableHead>
                          <TableHead>最終アクティブ</TableHead>
                          <TableHead>作成日</TableHead>
                          <TableHead>所有アイテム</TableHead>
                          <TableHead>アサインアイテム</TableHead>
                          <TableHead>権限サマリー</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockUsers
                          .filter(user => 
                            user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            user.email.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map((user) => (
                            <TableRow 
                              key={user.id}
                              className="cursor-pointer hover:bg-slate-50"
                              onClick={() => handleUserClick(user)}
                            >
                              <TableCell>
                                <div className="font-medium text-slate-900">{user.name}</div>
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {user.email}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{user.role}</Badge>
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {user.team}
                              </TableCell>
                              <TableCell>
                                {user.status === "active" ? (
                                  <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                                    Active
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-slate-100 text-slate-600">
                                    Inactive
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-slate-600">
                                {user.lastActive}
                              </TableCell>
                              <TableCell className="text-xs text-slate-600">
                                {user.createdAt}
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {user.ownedItemsCount}件
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {user.assignedItemsCount}件
                              </TableCell>
                              <TableCell className="text-xs text-slate-500">
                                {user.permissionSummary || "標準権限"}
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <ChevronRight className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Roles & Permissions Tab */}
                <TabsContent value="roles" className="mt-0">
                  <div className="border-t">
                    <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
                      <div className="text-sm text-slate-600">
                        ロールごとの権限を管理します
                      </div>
                      <Button variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        ロールを作成
                      </Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>ロール名</TableHead>
                          <TableHead>メンバー数</TableHead>
                          <TableHead>権限サマリー</TableHead>
                          <TableHead>最終更新</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockRoles.map((role) => {
                          const permissions = [
                            role.canSend && "送信",
                            role.canReview && "レビュー",
                            role.canViewAudit && "Audit閲覧",
                            role.canEditSettings && "Settings編集",
                          ].filter(Boolean);

                          return (
                            <TableRow 
                              key={role.id}
                              className="cursor-pointer hover:bg-slate-50"
                              onClick={() => handleRoleClick(role)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Shield className="w-4 h-4 text-slate-600" />
                                  <span className="font-medium text-slate-900">{role.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {role.memberCount}人
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {permissions.map((perm, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {perm}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-slate-600">
                                {role.lastUpdated}
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <ChevronRight className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Channel Settings Tab */}
                <TabsContent value="channels" className="mt-0">
                  <div className="border-t">
                    <div className="p-4 bg-slate-50 border-b">
                      <div className="text-sm text-slate-600">
                        Email / Slack / Chatwork / Intercom などの送信チャネルを設定します
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>チャネル名</TableHead>
                          <TableHead>タイプ</TableHead>
                          <TableHead>ステータス</TableHead>
                          <TableHead>デフォルト送信者</TableHead>
                          <TableHead>送信先設定</TableHead>
                          <TableHead>Resolverステータス</TableHead>
                          <TableHead>最終チェック</TableHead>
                          <TableHead className="w-32">アクション</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockChannels.map((channel) => (
                          <TableRow key={channel.id}>
                            <TableCell>
                              <div className="font-medium text-slate-900">{channel.name}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {channel.type === "email" && <Mail className="w-4 h-4 text-blue-600" />}
                                {channel.type === "slack" && <MessageSquare className="w-4 h-4 text-purple-600" />}
                                {channel.type === "chatwork" && <MessageSquare className="w-4 h-4 text-teal-600" />}
                                {channel.type === "intercom" && <MessageSquare className="w-4 h-4 text-indigo-600" />}
                                <span className="text-sm capitalize">{channel.type}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {channel.status === "active" && (
                                <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Active
                                </Badge>
                              )}
                              {channel.status === "error" && (
                                <Badge variant="default" className="bg-red-100 text-red-800 border-red-200">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Error
                                </Badge>
                              )}
                              {channel.status === "inactive" && (
                                <Badge variant="outline" className="bg-slate-100 text-slate-600">
                                  Inactive
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {channel.defaultSender}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">
                              {channel.destinationSummary || "未設定"}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">
                              {channel.resolverStatus === "active" ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                  Active
                                </Badge>
                              ) : channel.resolverStatus === "error" ? (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                                  Error
                                </Badge>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {channel.lastChecked}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm">
                                  <Edit3 className="w-3 h-3 mr-1" />
                                  編集
                                </Button>
                                <Button variant="outline" size="sm">
                                  テスト
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Destination / Resolver Settings Tab */}
                <TabsContent value="destinations" className="mt-0">
                  <div className="border-t">
                    <div className="p-4 bg-slate-50 border-b">
                      <div className="text-sm text-slate-600">
                        送信先の解決ルール（Resolver）とフォールバック設定を管理します
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>Resolver名</TableHead>
                          <TableHead>対象タイプ</TableHead>
                          <TableHead>ステータス</TableHead>
                          <TableHead>フォールバックルール</TableHead>
                          <TableHead>失敗回数</TableHead>
                          <TableHead>最終チェック</TableHead>
                          <TableHead className="w-32">アクション</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockDestinations.map((dest) => (
                          <TableRow key={dest.id} className="cursor-pointer hover:bg-slate-50">
                            <TableCell>
                              <div className="font-medium text-slate-900">{dest.resolverName}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{dest.targetType}</Badge>
                            </TableCell>
                            <TableCell>
                              {dest.status === "active" && (
                                <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Active
                                </Badge>
                              )}
                              {dest.status === "error" && (
                                <Badge variant="default" className="bg-red-100 text-red-800 border-red-200">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Error
                                </Badge>
                              )}
                              {dest.status === "inactive" && (
                                <Badge variant="outline" className="bg-slate-100 text-slate-600">
                                  Inactive
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {dest.fallbackRule}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {dest.failureCount > 0 ? (
                                <span className="text-red-600 font-medium">{dest.failureCount}件</span>
                              ) : (
                                <span className="text-green-600">0件</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {dest.lastChecked}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm">
                                  <Edit3 className="w-3 h-3 mr-1" />
                                  編集
                                </Button>
                                <Button variant="outline" size="sm">
                                  テスト
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* AI Agents Tab */}
                <TabsContent value="ai_agents" className="mt-0">
                  <div className="border-t">
                    <div className="p-4 bg-purple-50 border-b border-purple-200">
                      <div className="flex items-start gap-2">
                        <Bot className="w-4 h-4 text-purple-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-purple-900 mb-1">
                            AI Agent Routing 設定（Manager / Admin のみ）
                          </div>
                          <div className="text-xs text-purple-800">
                            各AI機能がどのAgent API / Provider / Modelを使うか管理します。一般ユーザーには非表示です。
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 border-b">
                      <div className="text-sm text-slate-600">
                        どの機能がどのAgent APIを使っているか一目で確認できます
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>Function Name</TableHead>
                          <TableHead>説明</TableHead>
                          <TableHead>Provider Type</TableHead>
                          <TableHead>Agent / Model</TableHead>
                          <TableHead>Output Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>更新者</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockAIAgents.map((agent) => (
                          <TableRow 
                            key={agent.id} 
                            className="cursor-pointer hover:bg-slate-50"
                            onClick={() => {
                              setSelectedAgent(agent);
                              setIsDrawerOpen(true);
                            }}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-purple-600" />
                                <span className="font-medium text-slate-900">{agent.functionName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600 max-w-xs truncate">
                              {agent.description}
                            </TableCell>
                            <TableCell>
                              {agent.providerType === "openrouter" ? (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                                  OpenRouter
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                                  Kocoro
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {agent.providerType === "openrouter" 
                                ? `${agent.provider} / ${agent.model}` 
                                : agent.kocoroAgentName}
                            </TableCell>
                            <TableCell>
                              {agent.providerType === "kocoro" && agent.fileOutputEnabled ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                                  {agent.outputType} + {agent.fileType}
                                </Badge>
                              ) : (
                                <span className="text-xs text-slate-500">
                                  {agent.providerType === "kocoro" ? agent.outputType : "text"}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {agent.status === "active" && agent.enabled && (
                                <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 text-xs">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Active
                                </Badge>
                              )}
                              {agent.status === "error" && (
                                <Badge variant="default" className="bg-red-100 text-red-800 border-red-200 text-xs">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Error
                                </Badge>
                              )}
                              {(agent.status === "inactive" || !agent.enabled) && (
                                <Badge variant="outline" className="bg-slate-100 text-slate-600 text-xs">
                                  Disabled
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {agent.updatedBy}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Support Intelligence Tab */}
                <TabsContent value="support_intelligence" className="mt-0">
                  <div className="border-t">
                    <div className="p-4 bg-indigo-50 border-b border-indigo-200">
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-600 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-indigo-900">Support Intelligence Settings</h3>
                          <p className="text-sm text-indigo-700 mt-1">
                            Support - Alert Feed の運用に必要な Alert / Suggestion / Summary のルールを管理します。
                            <strong>AIエージェント設定（別タブ）</strong>は「どのagentを使うか」、<strong>Support Intelligence（このタブ）</strong>は「どんなalert/suggestion/summaryを出すか」を制御します。
                          </p>
                        </div>
                      </div>
                    </div>

                    <Tabs defaultValue="alert_rules" className="w-full">
                      <div className="border-b bg-slate-50 px-4">
                        <TabsList className="bg-transparent h-12 gap-4">
                          <TabsTrigger 
                            value="alert_rules" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                          >
                            <Bell className="w-4 h-4 mr-2" />
                            Alert Rules
                          </TabsTrigger>
                          <TabsTrigger 
                            value="suggestion_rules" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                          >
                            <Lightbulb className="w-4 h-4 mr-2" />
                            Suggestion Rules
                          </TabsTrigger>
                          <TabsTrigger 
                            value="summary_rules" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Evidence Summary Rules
                          </TabsTrigger>
                          <TabsTrigger 
                            value="feed_settings" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                          >
                            <Sliders className="w-4 h-4 mr-2" />
                            Thresholds & Feed
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      {/* Alert Rules Sub-tab */}
                      <TabsContent value="alert_rules" className="mt-0">
                        <div className="p-6">
                          <div className="mb-6">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h3 className="font-semibold text-slate-900">Support Alert Rules</h3>
                                <p className="text-sm text-slate-600 mt-1">
                                  どの条件でどのタイプのアラートを生成するかを定義します。
                                </p>
                              </div>
                              <Button size="sm">
                                <Plus className="w-4 h-4 mr-2" />
                                新規ルール作成
                              </Button>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <div className="flex items-start gap-2">
                                <Target className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-blue-900">
                                  <p className="font-semibold mb-1">影響範囲：Support Home - Alert Feed</p>
                                  <p className="text-blue-800">
                                    ここで定義したルールに一致したログやイベントが、Support Home の Alert Feed に<strong>新しい行（アラート）として追加</strong>されます。
                                    Alert Type（Urgent / Risk / Opportunity など）が行の<strong>Type列</strong>に表示され、Priority が<strong>優先度列</strong>に反映されます。
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Rule Name</TableHead>
                                <TableHead>Alert Type</TableHead>
                                <TableHead>Source Scope</TableHead>
                                <TableHead>Trigger Condition</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Last Updated</TableHead>
                                <TableHead>Updated By</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell className="font-medium">High Priority CSE Waiting</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                    Urgent
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">CSE Ticket</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Waiting &gt; 48h</span>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-red-600 text-white">Critical</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">2024-03-15</TableCell>
                                <TableCell className="text-sm text-slate-600">佐藤 Manager</TableCell>
                                <TableCell>
                                  <RuleActionButtons 
                                    onEdit={() => handleAlertRuleEdit("High Priority CSE Waiting")}
                                    onTest={() => handleAlertRuleTest("High Priority CSE Waiting")}
                                    onCopy={() => handleAlertRuleCopy("High Priority CSE Waiting")}
                                    onHistory={() => handleRuleHistory("High Priority CSE Waiting")}
                                  />
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">Recurring Issue Detection</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                    Risk
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Intercom, Slack</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Same issue &gt; 5 times / 7 days</span>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-orange-500 text-white">High</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">2024-03-14</TableCell>
                                <TableCell className="text-sm text-slate-600">田中 Admin</TableCell>
                                <TableCell>
                                  <RuleActionButtons 
                                    onEdit={() => handleAlertRuleEdit("Recurring Issue Detection")}
                                    onTest={() => handleAlertRuleTest("Recurring Issue Detection")}
                                    onCopy={() => handleAlertRuleCopy("Recurring Issue Detection")}
                                    onHistory={() => handleRuleHistory("Recurring Issue Detection")}
                                  />
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">High-Value Customer Inquiry</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    Opportunity
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Intercom, Chatwork</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">ARR &gt; 10M yen</span>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-blue-600 text-white">High</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">2024-03-13</TableCell>
                                <TableCell className="text-sm text-slate-600">佐藤 Manager</TableCell>
                                <TableCell>
                                  <RuleActionButtons 
                                    onEdit={() => handleAlertRuleEdit("High-Value Customer Inquiry")}
                                    onTest={() => handleAlertRuleTest("High-Value Customer Inquiry")}
                                    onCopy={() => handleAlertRuleCopy("High-Value Customer Inquiry")}
                                    onHistory={() => handleRuleHistory("High-Value Customer Inquiry")}
                                  />
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">FAQ Candidate Detection</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                    FAQ Candidate
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Intercom</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Repeated Q &gt; 3 times / 14 days</span>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-slate-500 text-white">Medium</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">2024-03-12</TableCell>
                                <TableCell className="text-sm text-slate-600">山田 Manager</TableCell>
                                <TableCell>
                                  <RuleActionButtons 
                                    onEdit={() => handleAlertRuleEdit("FAQ Candidate Detection")}
                                    onTest={() => handleAlertRuleTest("FAQ Candidate Detection")}
                                    onCopy={() => handleAlertRuleCopy("FAQ Candidate Detection")}
                                    onHistory={() => handleRuleHistory("FAQ Candidate Detection")}
                                  />
                                </TableCell>
                              </TableRow>
                              <TableRow className="bg-slate-50">
                                <TableCell className="font-medium text-slate-500">Inactivity Alert (Draft)</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-300">
                                    Action Suggestion
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-500">Mixed</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-500">No activity &gt; 14 days</span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-slate-100 text-slate-600">Low</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-slate-100 text-slate-600">Disabled</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-500">2024-03-10</TableCell>
                                <TableCell className="text-sm text-slate-500">佐藤 Manager</TableCell>
                                <TableCell>
                                  <RuleActionButtons 
                                    onEdit={() => handleAlertRuleEdit("Inactivity Alert (Draft)")}
                                    onTest={() => handleAlertRuleTest("Inactivity Alert (Draft)")}
                                    onCopy={() => handleAlertRuleCopy("Inactivity Alert (Draft)")}
                                    onHistory={() => handleRuleHistory("Inactivity Alert (Draft)")}
                                  />
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>

                      {/* Suggestion Rules Sub-tab */}
                      <TabsContent value="suggestion_rules" className="mt-0">
                        <div className="p-6">
                          <div className="mb-6">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h3 className="font-semibold text-slate-900">Support Suggestion Rules</h3>
                                <p className="text-sm text-slate-600 mt-1">
                                  AIがどのタイプの提案をどの条件で生成するかを定義します。
                                </p>
                              </div>
                              <Button size="sm">
                                <Plus className="w-4 h-4 mr-2" />
                                新規ルール作成
                              </Button>
                            </div>
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                              <div className="flex items-start gap-2">
                                <Lightbulb className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-purple-900">
                                  <p className="font-semibold mb-1">影響範囲：Support Home の AI Suggestion 列 / Alert Detail の提案セクション</p>
                                  <p className="text-purple-800">
                                    ここで定義したルールに基づいて、AIが提案（FAQ作成 / Help作成 / アウトバウンド提案 / イベント提案など）を生成します。
                                    Support Home の各アラート行の<strong>AI Suggestion 列</strong>や、Alert Detail ページ内の<strong>AI提案カード</strong>に表示されます。
                                    Output Target（Content / Actions / Outbound など）で、提案がどの画面・機能に連携されるかが決まります。
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Rule Name</TableHead>
                                <TableHead>Suggestion Type</TableHead>
                                <TableHead>Trigger Condition</TableHead>
                                <TableHead>Output Target</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Last Updated</TableHead>
                                <TableHead>Updated By</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell className="font-medium">FAQ Auto-Generation</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                    FAQ Draft
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Recurring Q &gt; 5 times</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Content</span>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-orange-500 text-white">High</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">2024-03-15</TableCell>
                                <TableCell className="text-sm text-slate-600">山田 Manager</TableCell>
                                <TableCell>
                                  <RuleActionButtons 
                                    onEdit={() => handleAlertRuleEdit("FAQ Auto-Generation", "suggestion")}
                                    onTest={() => handleAlertRuleTest("FAQ Auto-Generation")}
                                    onCopy={() => handleAlertRuleCopy("FAQ Auto-Generation", "suggestion")}
                                    onHistory={() => handleRuleHistory("FAQ Auto-Generation")}
                                  />
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">Proactive Outbound Suggestion</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    Outbound Suggestion
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">High-value + multiple inquiries</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Outbound</span>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-blue-600 text-white">High</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">2024-03-14</TableCell>
                                <TableCell className="text-sm text-slate-600">佐藤 Manager</TableCell>
                                <TableCell>
                                  <RuleActionButtons 
                                    onEdit={() => handleAlertRuleEdit("Proactive Outbound Suggestion", "suggestion")}
                                    onTest={() => handleAlertRuleTest("Proactive Outbound Suggestion")}
                                    onCopy={() => handleAlertRuleCopy("Proactive Outbound Suggestion", "suggestion")}
                                    onHistory={() => handleRuleHistory("Proactive Outbound Suggestion")}
                                  />
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">Help Content Suggestion</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Help Draft
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Complex issue + CSE resolved</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Content</span>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-slate-500 text-white">Medium</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">2024-03-13</TableCell>
                                <TableCell className="text-sm text-slate-600">田中 Admin</TableCell>
                                <TableCell>
                                  <RuleActionButtons 
                                    onEdit={() => handleAlertRuleEdit("Help Content Suggestion", "suggestion")}
                                    onTest={() => handleAlertRuleTest("Help Content Suggestion")}
                                    onCopy={() => handleAlertRuleCopy("Help Content Suggestion", "suggestion")}
                                    onHistory={() => handleRuleHistory("Help Content Suggestion")}
                                  />
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">Event Follow-up Suggestion</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                    Event Suggestion
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Post-event inquiries</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Event, Actions</span>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-slate-500 text-white">Medium</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">2024-03-12</TableCell>
                                <TableCell className="text-sm text-slate-600">山田 Manager</TableCell>
                                <TableCell>
                                  <RuleActionButtons 
                                    onEdit={() => handleAlertRuleEdit("Event Follow-up Suggestion", "suggestion")}
                                    onTest={() => handleAlertRuleTest("Event Follow-up Suggestion")}
                                    onCopy={() => handleAlertRuleCopy("Event Follow-up Suggestion", "suggestion")}
                                    onHistory={() => handleRuleHistory("Event Follow-up Suggestion")}
                                  />
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">Product Feedback Extraction</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                    Product Feedback
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Feature request keywords</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Library, Actions</span>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-slate-500 text-white">Medium</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">2024-03-11</TableCell>
                                <TableCell className="text-sm text-slate-600">佐藤 Manager</TableCell>
                                <TableCell>
                                  <RuleActionButtons 
                                    onEdit={() => handleAlertRuleEdit("Product Feedback Extraction", "suggestion")}
                                    onTest={() => handleAlertRuleTest("Product Feedback Extraction")}
                                    onCopy={() => handleAlertRuleCopy("Product Feedback Extraction", "suggestion")}
                                    onHistory={() => handleRuleHistory("Product Feedback Extraction")}
                                  />
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>

                      {/* Evidence Summary Rules Sub-tab */}
                      <TabsContent value="summary_rules" className="mt-0">
                        <div className="p-6">
                          <div className="mb-6">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h3 className="font-semibold text-slate-900">Evidence Summary Rules</h3>
                                <p className="text-sm text-slate-600 mt-1">
                                  Alert Detail / Support Detail で表示される AI Summary のスタイルと内容を定義します。
                                </p>
                              </div>
                              <Button size="sm">
                                <Plus className="w-4 h-4 mr-2" />
                                新規ルール作成
                              </Button>
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                              <div className="flex items-start gap-2">
                                <FileText className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-green-900">
                                  <p className="font-semibold mb-1">影響範囲：Alert Detail / Support Detail の各サマリーセクション</p>
                                  <p className="text-green-800">
                                    ここで定義したルールに基づいて、Alert Detail や Support Detail ページの各種サマリーが生成されます。
                                    <strong>AI Summary</strong>（アラート概要）、<strong>Why This Matters</strong>（なぜ重要か）、<strong>Suggested Next Step</strong>（推奨次アクション）、
                                    <strong>Similar Case Summary</strong>（類似ケース）、<strong>CSE Waiting Summary</strong>（CSE待機状況）など、
                                    各サマリーのスタイル（長さ・強調ポイント・トーン）を制御します。
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Rule Name</TableHead>
                                <TableHead>Summary Type</TableHead>
                                <TableHead>Source Scope</TableHead>
                                <TableHead>Style Summary</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Last Updated</TableHead>
                                <TableHead>Updated By</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell className="font-medium">Default AI Summary</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                    AI Summary
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">All</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Medium / Business Impact / Japanese</span>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">2024-03-15</TableCell>
                                <TableCell className="text-sm text-slate-600">田中 Admin</TableCell>
                                <TableCell>
                                  <RuleActionButtons 
                                    testLabel="出力例を生成"
                                    onEdit={() => handleAlertRuleEdit("Default AI Summary", "summary")}
                                    onTest={() => handleAlertRuleTest("Default AI Summary")}
                                    onCopy={() => handleAlertRuleCopy("Default AI Summary", "summary")}
                                    onHistory={() => handleRuleHistory("Default AI Summary")}
                                  />
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">Why This Matters - Urgent</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                    Why This Matters
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Urgent Alerts</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Short / CX Emphasis / Business Impact</span>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">2024-03-14</TableCell>
                                <TableCell className="text-sm text-slate-600">佐藤 Manager</TableCell>
                                <TableCell>
                                  <RuleActionButtons 
                                    testLabel="出力例を生成"
                                    onEdit={() => handleAlertRuleEdit("Why This Matters - Urgent", "summary")}
                                    onTest={() => handleAlertRuleTest("Why This Matters - Urgent")}
                                    onCopy={() => handleAlertRuleCopy("Why This Matters - Urgent", "summary")}
                                    onHistory={() => handleRuleHistory("Why This Matters - Urgent")}
                                  />
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">Suggested Next Step</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    Suggested Next Step
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">All</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Action-focused / Context-aware</span>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">2024-03-13</TableCell>
                                <TableCell className="text-sm text-slate-600">山田 Manager</TableCell>
                                <TableCell>
                                  <RuleActionButtons 
                                    testLabel="出力例を生成"
                                    onEdit={() => handleAlertRuleEdit("Suggested Next Step", "summary")}
                                    onTest={() => handleAlertRuleTest("Suggested Next Step")}
                                    onCopy={() => handleAlertRuleCopy("Suggested Next Step", "summary")}
                                    onHistory={() => handleRuleHistory("Suggested Next Step")}
                                  />
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">Similar Case Summary</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                    Similar Case Summary
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Recurring Issues</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Long / Include resolution pattern</span>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">2024-03-12</TableCell>
                                <TableCell className="text-sm text-slate-600">佐藤 Manager</TableCell>
                                <TableCell>
                                  <RuleActionButtons 
                                    testLabel="出力例を生成"
                                    onEdit={() => handleAlertRuleEdit("Similar Case Summary", "summary")}
                                    onTest={() => handleAlertRuleTest("Similar Case Summary")}
                                    onCopy={() => handleAlertRuleCopy("Similar Case Summary", "summary")}
                                    onHistory={() => handleRuleHistory("Similar Case Summary")}
                                  />
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">CSE Waiting Context</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                    CSE Waiting Summary
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">CSE Tickets</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-slate-600">Medium / CSE dependency emphasis</span>
                                </TableCell>
                                <TableCell>
                                  <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">2024-03-11</TableCell>
                                <TableCell className="text-sm text-slate-600">田中 Admin</TableCell>
                                <TableCell>
                                  <RuleActionButtons 
                                    testLabel="出力例を生成"
                                    onEdit={() => handleAlertRuleEdit("CSE Waiting Context", "summary")}
                                    onTest={() => handleAlertRuleTest("CSE Waiting Context")}
                                    onCopy={() => handleAlertRuleCopy("CSE Waiting Context", "summary")}
                                    onHistory={() => handleRuleHistory("CSE Waiting Context")}
                                  />
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>

                      {/* Thresholds & Feed Settings Sub-tab */}
                      <TabsContent value="feed_settings" className="mt-0">
                        <div className="p-6">
                          <div className="space-y-8">
                            {/* Threshold Presets Section */}
                            <div>
                              <div className="mb-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-slate-900">Threshold Presets</h3>
                                    <p className="text-sm text-slate-600 mt-1">
                                      複数のルールで共通利用する閾値を一元管理します。
                                    </p>
                                  </div>
                                  <Button size="sm" variant="outline">
                                    <Plus className="w-4 h-4 mr-2" />
                                    新規プリセット作成
                                  </Button>
                                </div>
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                  <div className="flex items-start gap-2">
                                    <TrendingUp className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm text-amber-900">
                                      <p className="font-semibold mb-1">影響範囲：Alert Rules / Suggestion Rules の Trigger Condition</p>
                                      <p className="text-amber-800">
                                        ここで定義した閾値（CSE待機時間、繰り返し回数、ボリューム増加率など）が、
                                        <strong>Alert Rules</strong> や <strong>Suggestion Rules</strong> の Trigger Condition で参照されます。
                                        閾値を変更すると、それを使用している全てのルールの動作に影響します。Applied Rules 列で影響範囲を確認できます。
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Preset Name</TableHead>
                                    <TableHead>Threshold Type</TableHead>
                                    <TableHead>Value</TableHead>
                                    <TableHead>Applied Rules</TableHead>
                                    <TableHead>Last Updated</TableHead>
                                    <TableHead>Updated By</TableHead>
                                    <TableHead className="w-[80px]">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  <TableRow>
                                    <TableCell className="font-medium">CSE Waiting Threshold</TableCell>
                                    <TableCell>
                                      <span className="text-sm text-slate-600">Waiting Hours</span>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline">48 hours</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm text-slate-600">3 rules</span>
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">2024-03-15</TableCell>
                                    <TableCell className="text-sm text-slate-600">田中 Admin</TableCell>
                                    <TableCell>
                                      <RuleActionButtons 
                                        showTest={false} 
                                        menuItems={[{ icon: ExternalLink, label: "適用中のルールを見る" }]}
                                        onEdit={() => handleAlertRuleEdit("CSE Waiting Threshold", "threshold")}
                                        onCopy={() => handleAlertRuleCopy("CSE Waiting Threshold", "threshold")}
                                        onHistory={() => handleRuleHistory("CSE Waiting Threshold")}
                                      />
                                    </TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell className="font-medium">Recurring Issue Count</TableCell>
                                    <TableCell>
                                      <span className="text-sm text-slate-600">Issue Count</span>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline">5 times / 7 days</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm text-slate-600">2 rules</span>
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">2024-03-14</TableCell>
                                    <TableCell className="text-sm text-slate-600">佐藤 Manager</TableCell>
                                    <TableCell>
                                      <RuleActionButtons 
                                        showTest={false} 
                                        menuItems={[{ icon: ExternalLink, label: "適用中のルールを見る" }]}
                                        onEdit={() => handleAlertRuleEdit("Recurring Issue Count", "threshold")}
                                        onCopy={() => handleAlertRuleCopy("Recurring Issue Count", "threshold")}
                                        onHistory={() => handleRuleHistory("Recurring Issue Count")}
                                      />
                                    </TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell className="font-medium">High Volume Threshold</TableCell>
                                    <TableCell>
                                      <span className="text-sm text-slate-600">Volume Increase Rate</span>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline">+50% vs previous week</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm text-slate-600">1 rule</span>
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">2024-03-13</TableCell>
                                    <TableCell className="text-sm text-slate-600">山田 Manager</TableCell>
                                    <TableCell>
                                      <RuleActionButtons 
                                        showTest={false} 
                                        menuItems={[{ icon: ExternalLink, label: "適用中のルールを見る" }]}
                                        onEdit={() => handleAlertRuleEdit("High Volume Threshold", "threshold")}
                                        onCopy={() => handleAlertRuleCopy("High Volume Threshold", "threshold")}
                                        onHistory={() => handleRuleHistory("High Volume Threshold")}
                                      />
                                    </TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell className="font-medium">Inactivity Alert</TableCell>
                                    <TableCell>
                                      <span className="text-sm text-slate-600">Inactivity Hours</span>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline">336 hours (14 days)</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm text-slate-600">1 rule</span>
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">2024-03-12</TableCell>
                                    <TableCell className="text-sm text-slate-600">佐藤 Manager</TableCell>
                                    <TableCell>
                                      <RuleActionButtons 
                                        showTest={false} 
                                        menuItems={[{ icon: ExternalLink, label: "適用中のルールを見る" }]}
                                        onEdit={() => handleAlertRuleEdit("Inactivity Alert", "threshold")}
                                        onCopy={() => handleAlertRuleCopy("Inactivity Alert", "threshold")}
                                        onHistory={() => handleRuleHistory("Inactivity Alert")}
                                      />
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </div>

                            <div className="h-px bg-slate-200" />

                            {/* Feed Display Rules Section */}
                            <div>
                              <div className="mb-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-slate-900">Feed Display Rules</h3>
                                    <p className="text-sm text-slate-600 mt-1">
                                      Support Home の Alert Feed の表示方法・並び順・グルーピングを制御します。
                                    </p>
                                  </div>
                                  <Button size="sm" variant="outline">
                                    <Plus className="w-4 h-4 mr-2" />
                                    新規ルール作成
                                  </Button>
                                </div>
                                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                  <div className="flex items-start gap-2">
                                    <Eye className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm text-indigo-900">
                                      <p className="font-semibold mb-1">影響範囲：Support Home の Alert Feed の並び順とグルーピング</p>
                                      <p className="text-indigo-800">
                                        ここで定義したルールが、Support Home の Alert Feed で<strong>アラートがどの順番で表示されるか</strong>、
                                        <strong>どのようにグルーピングされるか</strong>を決定します。
                                        Sort Logic（新しい順 / 古い順 / 優先度ブースト）や Grouping Logic（同一企業 / 同一プロジェクト / 時間窓）を設定でき、
                                        タブフィルター（All / Urgent / Risk など）ごとに異なる表示ルールを適用できます。
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Rule Name</TableHead>
                                    <TableHead>Target Feed</TableHead>
                                    <TableHead>Sort Logic</TableHead>
                                    <TableHead>Grouping Logic</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Last Updated</TableHead>
                                    <TableHead className="w-[80px]">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  <TableRow>
                                    <TableCell className="font-medium">Default Feed Display</TableCell>
                                    <TableCell>
                                      <span className="text-sm text-slate-600">All Alerts</span>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm text-slate-600">Newest first + Priority boost</span>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm text-slate-600">Same company (30min window)</span>
                                    </TableCell>
                                    <TableCell>
                                      <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">2024-03-15</TableCell>
                                    <TableCell>
                                      <RuleActionButtons 
                                        testLabel="表示プレビュー"
                                        onEdit={() => handleAlertRuleEdit("Default Feed Display", "feed")}
                                        onTest={() => handleAlertRuleTest("Default Feed Display")}
                                        onCopy={() => handleAlertRuleCopy("Default Feed Display", "feed")}
                                        onHistory={() => handleRuleHistory("Default Feed Display")}
                                      />
                                    </TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell className="font-medium">Urgent Queue Priority</TableCell>
                                    <TableCell>
                                      <span className="text-sm text-slate-600">Urgent Alerts</span>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm text-slate-600">Oldest first + Untriaged boost</span>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm text-slate-600">No grouping</span>
                                    </TableCell>
                                    <TableCell>
                                      <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">2024-03-14</TableCell>
                                    <TableCell>
                                      <RuleActionButtons 
                                        testLabel="表示プレビュー"
                                        onEdit={() => handleAlertRuleEdit("Urgent Queue Priority", "feed")}
                                        onTest={() => handleAlertRuleTest("Urgent Queue Priority")}
                                        onCopy={() => handleAlertRuleCopy("Urgent Queue Priority", "feed")}
                                        onHistory={() => handleRuleHistory("Urgent Queue Priority")}
                                      />
                                    </TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell className="font-medium">Company-Centric View</TableCell>
                                    <TableCell>
                                      <span className="text-sm text-slate-600">Risk & Opportunity</span>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm text-slate-600">Company ARR desc</span>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm text-slate-600">Same company + project (60min)</span>
                                    </TableCell>
                                    <TableCell>
                                      <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">2024-03-13</TableCell>
                                    <TableCell>
                                      <RuleActionButtons 
                                        testLabel="表示プレビュー"
                                        onEdit={() => handleAlertRuleEdit("Company-Centric View", "feed")}
                                        onTest={() => handleAlertRuleTest("Company-Centric View")}
                                        onCopy={() => handleAlertRuleCopy("Company-Centric View", "feed")}
                                        onHistory={() => handleRuleHistory("Company-Centric View")}
                                      />
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </TabsContent>

                {/* Review & Approval Policy Tab */}
                <TabsContent value="policy" className="mt-0">
                  <div className="border-t">
                    <div className="p-4 bg-yellow-50 border-b border-yellow-200">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-yellow-900 mb-1">
                            レビュー・承認はOptional機能です
                          </div>
                          <div className="text-xs text-yellow-800">
                            標準運用では「自分で確認して送る」が基本です。大規模送信や特定条件時のみ、レビュー・承認フローを要求できます。
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
                      <div className="text-sm text-slate-600">
                        レビュー・承認が必要なケースを定義します
                      </div>
                      <Button variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        ポリシーを作成
                      </Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>ポリシー名</TableHead>
                          <TableHead>対象</TableHead>
                          <TableHead>チャネル</TableHead>
                          <TableHead>トリガー条件</TableHead>
                          <TableHead>レビュー</TableHead>
                          <TableHead>承認</TableHead>
                          <TableHead>ステータス</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockPolicies.map((policy) => (
                          <TableRow key={policy.id} className="cursor-pointer hover:bg-slate-50">
                            <TableCell>
                              <div className="font-medium text-slate-900">{policy.name}</div>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {policy.targetScope}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {policy.channel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {policy.triggerCondition}
                            </TableCell>
                            <TableCell>
                              {policy.reviewRequired ? (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                                  必須
                                </Badge>
                              ) : (
                                <span className="text-xs text-slate-400">不要</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {policy.approvalRequired ? (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                                  必須
                                </Badge>
                              ) : (
                                <span className="text-xs text-slate-400">不要</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {policy.enabled ? (
                                <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 text-xs">
                                  有効
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-slate-100 text-slate-600 text-xs">
                                  無効
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <Edit3 className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Default Views Tab */}
                <TabsContent value="default_views" className="mt-0">
                  <div className="border-t">
                    <div className="p-4 bg-blue-50 border-b border-blue-200">
                      <div className="flex items-start gap-2">
                        <Filter className="w-4 h-4 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-blue-900 mb-1">
                            Default Views: 各画面の初期体験を定義する
                          </div>
                          <div className="text-xs text-blue-800 space-y-1">
                            <div>各画面の Current View Label、subtitle、summary cards、empty state、初期フィルタ・ソート・表示モードを一括管理</div>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="font-medium">優先順位:</span>
                              <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">1. Personal</span>
                              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs">2. Role-based</span>
                              <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs">3. Team</span>
                              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">4. Workspace</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
                      <div className="text-sm text-slate-600">
                        各画面の初期表示・フィルタ・文言をスコープ別に設定できます
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedView({
                          id: "new",
                          name: "",
                          targetScreen: "Console",
                          filterCondition: "",
                          scope: "personal",
                          owner: "Current User",
                          isDefault: false,
                          updatedAt: new Date().toISOString().split('T')[0],
                          enabled: true,
                          currentViewLabel: "",
                          subtitle: "",
                        })}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Default View を作成
                      </Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>ビュー名</TableHead>
                          <TableHead>対象画面</TableHead>
                          <TableHead>スコープ</TableHead>
                          <TableHead>オーナー/ロール</TableHead>
                          <TableHead>Current View Label</TableHead>
                          <TableHead>Subtitle</TableHead>
                          <TableHead>有効/無効</TableHead>
                          <TableHead>最終更新</TableHead>
                          <TableHead>更新者</TableHead>
                          <TableHead className="w-24"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockDefaultViews.map((view) => (
                          <TableRow key={view.id} className="cursor-pointer hover:bg-slate-50">
                            <TableCell>
                              <div className="font-medium text-slate-900">{view.name}</div>
                              {view.isDefault && (
                                <Badge className="bg-blue-600 text-white text-xs mt-1 h-4">
                                  Default
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {view.targetScreen}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {view.scope === "workspace" && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                                  Workspace
                                </Badge>
                              )}
                              {view.scope === "team" && (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                                  Team
                                </Badge>
                              )}
                              {view.scope === "personal" && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                  Personal
                                </Badge>
                              )}
                              {view.scope === "role-based" && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                                  Role-based
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {view.owner}
                              {view.applicableRoles && (
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {view.applicableRoles.join(", ")}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-slate-700 font-medium max-w-[150px] truncate">
                              {view.currentViewLabel}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600 max-w-[200px] truncate">
                              {view.subtitle}
                            </TableCell>
                            <TableCell>
                              {view.enabled ? (
                                <Badge className="bg-green-600 text-white text-xs h-4">
                                  有効
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-slate-100 text-slate-600 text-xs h-4">
                                  無効
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {view.updatedAt}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {view.updatedBy || "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 w-7 p-0" 
                                  title="プレビュー"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // TODO: Preview modal
                                  }}
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 w-7 p-0" 
                                  title="編集"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedView(view);
                                  }}
                                >
                                  <Edit3 className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Automation Rules Tab */}
                <TabsContent value="automation_rules" className="mt-0">
                  <div className="border-t">
                    <div className="p-4 bg-purple-50 border-b border-purple-200">
                      <div className="flex items-start gap-2">
                        <GitBranch className="w-4 h-4 text-purple-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-purple-900 mb-1">
                            Automation Rules（Manager / Admin のみ）
                          </div>
                          <div className="text-xs text-purple-800">
                            Automationフロー全体に適用されるルールを管理します。各Automationがどのような条件で実行され、どのように制御されるかを定義します。
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="space-y-6">
                        {/* Flow Execution Rules */}
                        <div>
                          <div className="text-sm font-semibold text-slate-900 mb-4">Flow Execution Rules</div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">同時実行数制限</div>
                                <div className="text-xs text-slate-600">1つのAutomationが同時に実行できるRunの最大数</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Input type="number" defaultValue="5" className="w-20" />
                                <Button variant="outline" size="sm">
                                  <Save className="w-4 h-4 mr-1" />
                                  保存
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">Run タイムアウト</div>
                                <div className="text-xs text-slate-600">1つのRunが完了するまでの最大時間（分）</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Input type="number" defaultValue="60" className="w-20" />
                                <Button variant="outline" size="sm">
                                  <Save className="w-4 h-4 mr-1" />
                                  保存
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">ステップ間待機時間（最小）</div>
                                <div className="text-xs text-slate-600">各ステップ間の最小待機時間（秒）</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Input type="number" defaultValue="5" className="w-20" />
                                <Button variant="outline" size="sm">
                                  <Save className="w-4 h-4 mr-1" />
                                  保存
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Retry Rules */}
                        <div className="pt-6 border-t">
                          <div className="text-sm font-semibold text-slate-900 mb-4">Retry & Error Handling Rules</div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">自動リトライ回数</div>
                                <div className="text-xs text-slate-600">ステップ失敗時の自動リトライ回数</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Input type="number" defaultValue="3" className="w-20" />
                                <Button variant="outline" size="sm">
                                  <Save className="w-4 h-4 mr-1" />
                                  保存
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">エラー時の動作</div>
                                <div className="text-xs text-slate-600">ステップ失敗時の動作</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Select defaultValue="pause">
                                  <SelectTrigger className="w-48">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pause">Run を一時停止</SelectItem>
                                    <SelectItem value="skip">ステップをスキップ</SelectItem>
                                    <SelectItem value="fail">Run を失敗</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button variant="outline" size="sm">
                                  <Save className="w-4 h-4 mr-1" />
                                  保存
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Resource Limits */}
                        <div className="pt-6 border-t">
                          <div className="text-sm font-semibold text-slate-900 mb-4">Resource Limits</div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">1Run あたりの最大対象件数</div>
                                <div className="text-xs text-slate-600">1つのRunで処理できる最大の対象件数</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Input type="number" defaultValue="1000" className="w-24" />
                                <Button variant="outline" size="sm">
                                  <Save className="w-4 h-4 mr-1" />
                                  保存
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">1日あたりのRun実行上限</div>
                                <div className="text-xs text-slate-600">1つのAutomationが1日に実行できるRun数</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Input type="number" defaultValue="50" className="w-20" />
                                <Button variant="outline" size="sm">
                                  <Save className="w-4 h-4 mr-1" />
                                  保存
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Automation AI Settings Tab */}
                <TabsContent value="automation_ai" className="mt-0">
                  <div className="border-t">
                    <div className="p-4 bg-indigo-50 border-b border-indigo-200">
                      <div className="flex items-start gap-2">
                        <Zap className="w-4 h-4 text-indigo-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-indigo-900 mb-1">
                            Automation AI Settings（Manager / Admin のみ）
                          </div>
                          <div className="text-xs text-indigo-800">
                            Automation Builder でAIが提案する内容を制御します。Flow / Audience / Content / Branch / Send Policy の提案に関する設定を管理します。
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="space-y-6">
                        {/* AI Suggestion Settings */}
                        <div>
                          <div className="text-sm font-semibold text-slate-900 mb-4">AI Suggestion Settings</div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">Flow Suggestion を有効化</div>
                                <div className="text-xs text-slate-600">Trigger に基づいて最適なフローを提案</div>
                              </div>
                              <Checkbox defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">Audience Suggestion を有効化</div>
                                <div className="text-xs text-slate-600">Event / Trigger 文脈から対象Audienceを提案</div>
                              </div>
                              <Checkbox defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">Content Suggestion を有効化</div>
                                <div className="text-xs text-slate-600">文脈に応じたContent生成を提案</div>
                              </div>
                              <Checkbox defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">Branch Suggestion を有効化</div>
                                <div className="text-xs text-slate-600">条件に応じた分岐ロジックを提案</div>
                              </div>
                              <Checkbox defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">Send Policy Suggestion を有効化</div>
                                <div className="text-xs text-slate-600">フロー内容からSend Modeを提案</div>
                              </div>
                              <Checkbox defaultChecked />
                            </div>
                          </div>
                        </div>

                        {/* AI Agent Routing */}
                        <div className="pt-6 border-t">
                          <div className="text-sm font-semibold text-slate-900 mb-4">AI Agent Routing</div>
                          <div className="space-y-3">
                            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                              <div className="text-xs text-purple-900 font-semibold mb-2">使用するAI Agent</div>
                              <div className="text-xs text-purple-800 mb-3">
                                Settings &gt; AI Agents タブで設定された Agent を使用します。以下の機能が利用可能です：
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-xs text-purple-800">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Automation Flow Suggestion（新規追加予定）</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-purple-800">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Automation Audience Suggestion（新規追加予定）</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-purple-800">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Automation Content Suggestion（新規追加予定）</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-purple-800">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Automation Branch Suggestion（新規追加予定）</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-purple-800">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Automation Send Policy Suggestion（新規追加予定）</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Automation Triggers Tab */}
                <TabsContent value="automation_triggers" className="mt-0">
                  <div className="border-t">
                    <div className="p-4 bg-green-50 border-b border-green-200">
                      <div className="flex items-start gap-2">
                        <Play className="w-4 h-4 text-green-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-green-900 mb-1">
                            Automation Trigger Settings（Manager / Admin のみ）
                          </div>
                          <div className="text-xs text-green-800">
                            Automationをトリガーする条件を管理します。各Trigger Typeの有効化・無効化、条件、優先度を設定できます。
                          </div>
                        </div>
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>Trigger Type</TableHead>
                          <TableHead>説明</TableHead>
                          <TableHead>デフォルト条件</TableHead>
                          <TableHead>優先度</TableHead>
                          <TableHead>有効</TableHead>
                          <TableHead className="w-32"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          { type: "Event started", desc: "Eventが開始された", condition: "status = scheduled", priority: "High", enabled: true },
                          { type: "Event ending soon", desc: "Event終了が近づいている", condition: "days_until_end <= 3", priority: "Medium", enabled: true },
                          { type: "Support alert created", desc: "Support alertが作成された", condition: "priority >= medium", priority: "High", enabled: true },
                          { type: "Risk alert created", desc: "Risk alertが作成された", condition: "risk_level >= high", priority: "Critical", enabled: true },
                          { type: "Opportunity alert created", desc: "Opportunity alertが作成された", condition: "potential_value &gt; threshold", priority: "High", enabled: true },
                          { type: "CSE waiting too long", desc: "CSEの待機時間が長い", condition: "waiting_time &gt; 24h", priority: "High", enabled: true },
                          { type: "New inquiry detected", desc: "新しい問い合わせが検出された", condition: "type = inquiry", priority: "Medium", enabled: true },
                          { type: "Product update published", desc: "Product更新が公開された", condition: "visibility = public", priority: "Medium", enabled: true },
                          { type: "Schedule based", desc: "スケジュールベース", condition: "cron expression", priority: "Low", enabled: true },
                          { type: "Manual start", desc: "手動開始", condition: "user triggered", priority: "Medium", enabled: true },
                        ].map((trigger, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Play className="w-4 h-4 text-green-600" />
                                <span className="font-medium text-slate-900">{trigger.type}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">{trigger.desc}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-xs">
                                {trigger.condition}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={
                                  trigger.priority === "Critical" 
                                    ? "bg-red-50 text-red-700 border-red-200 text-xs"
                                    : trigger.priority === "High"
                                    ? "bg-orange-50 text-orange-700 border-orange-200 text-xs"
                                    : trigger.priority === "Medium"
                                    ? "bg-blue-50 text-blue-700 border-blue-200 text-xs"
                                    : "bg-slate-50 text-slate-700 border-slate-200 text-xs"
                                }
                              >
                                {trigger.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Checkbox defaultChecked={trigger.enabled} />
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm">
                                <Edit3 className="w-4 h-4 mr-1" />
                                編集
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Automation Run Policies Tab */}
                <TabsContent value="automation_run_policies" className="mt-0">
                  <div className="border-t">
                    <div className="p-4 bg-blue-50 border-b border-blue-200">
                      <div className="flex items-start gap-2">
                        <Shield className="w-4 h-4 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-blue-900 mb-1">
                            Automation Run Policies（Manager / Admin のみ）
                          </div>
                          <div className="text-xs text-blue-800">
                            Automationの実行に関するポリシーを管理します。誰がどのAutomationを実行できるか、どのような条件で実行されるかを制御します。
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="space-y-6">
                        {/* Execution Permissions */}
                        <div>
                          <div className="text-sm font-semibold text-slate-900 mb-4">Execution Permissions</div>
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50">
                                <TableHead>Role</TableHead>
                                <TableHead>Automation作成</TableHead>
                                <TableHead>Automation編集</TableHead>
                                <TableHead>Automation実行</TableHead>
                                <TableHead>Run一時停止</TableHead>
                                <TableHead>Run強制停止</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell className="font-medium">Admin</TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">Manager</TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell><XCircle className="w-4 h-4 text-red-600" /></TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">CSM</TableCell>
                                <TableCell><XCircle className="w-4 h-4 text-red-600" /></TableCell>
                                <TableCell><XCircle className="w-4 h-4 text-red-600" /></TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell><XCircle className="w-4 h-4 text-red-600" /></TableCell>
                                <TableCell><XCircle className="w-4 h-4 text-red-600" /></TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>

                        {/* Run Control Policies */}
                        <div className="pt-6 border-t">
                          <div className="text-sm font-semibold text-slate-900 mb-4">Run Control Policies</div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">高リスク条件での自動実行制限</div>
                                <div className="text-xs text-slate-600">Enterprise tier / High risk の場合、自動実行を制限</div>
                              </div>
                              <Checkbox defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">大規模配信での承認必須</div>
                                <div className="text-xs text-slate-600">対象件数 &gt; 100 の場合、Manager承認を必須にする</div>
                              </div>
                              <Checkbox defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">営業時間外の実行制限</div>
                                <div className="text-xs text-slate-600">営業時間外（18:00-09:00）の自動実行を制限</div>
                              </div>
                              <Checkbox />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Automation Send Policies Tab */}
                <TabsContent value="automation_send_policies" className="mt-0">
                  <div className="border-t">
                    <div className="p-4 bg-pink-50 border-b border-pink-200">
                      <div className="flex items-start gap-2">
                        <Mail className="w-4 h-4 text-pink-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-pink-900 mb-1">
                            Automation Send Policies（Manager / Admin のみ）
                          </div>
                          <div className="text-xs text-pink-800">
                            Automation内のSendノードで送信実行する際のポリシーを管理します。どのchannelでauto sendを許可するか、対象件数・リスク条件による制限、roleごとの権限を設定します。
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="space-y-6">
                        {/* Channel-based Send Policies */}
                        <div>
                          <div className="text-sm font-semibold text-slate-900 mb-4">Channel-based Send Policies</div>
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50">
                                <TableHead>Channel</TableHead>
                                <TableHead>Auto Send 許可</TableHead>
                                <TableHead>最大対象件数</TableHead>
                                <TableHead>Review必須条件</TableHead>
                                <TableHead>有効</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-blue-600" />
                                    <span className="font-medium">Email</span>
                                  </div>
                                </TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell>
                                  <Input type="number" defaultValue="500" className="w-24" />
                                </TableCell>
                                <TableCell className="text-xs text-slate-600">件数 &gt; 100 または tier = Enterprise</TableCell>
                                <TableCell><Checkbox defaultChecked /></TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-purple-600" />
                                    <span className="font-medium">Slack</span>
                                  </div>
                                </TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell>
                                  <Input type="number" defaultValue="200" className="w-24" />
                                </TableCell>
                                <TableCell className="text-xs text-slate-600">件数 &gt; 50</TableCell>
                                <TableCell><Checkbox defaultChecked /></TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-teal-600" />
                                    <span className="font-medium">Chatwork</span>
                                  </div>
                                </TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell>
                                  <Input type="number" defaultValue="200" className="w-24" />
                                </TableCell>
                                <TableCell className="text-xs text-slate-600">件数 &gt; 50</TableCell>
                                <TableCell><Checkbox defaultChecked /></TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Bell className="w-4 h-4 text-amber-600" />
                                    <span className="font-medium">In-app notification</span>
                                  </div>
                                </TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell>
                                  <Input type="number" defaultValue="1000" className="w-24" />
                                </TableCell>
                                <TableCell className="text-xs text-slate-600">なし</TableCell>
                                <TableCell><Checkbox defaultChecked /></TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>

                        {/* Risk-based Restrictions */}
                        <div className="pt-6 border-t">
                          <div className="text-sm font-semibold text-slate-900 mb-4">Risk-based Restrictions</div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">High Risk 企業への Auto Send 制限</div>
                                <div className="text-xs text-slate-600">Risk level = High の場合、Auto Send を Draft Only に変更</div>
                              </div>
                              <Checkbox defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">Enterprise tier への Review 必須化</div>
                                <div className="text-xs text-slate-600">Tier = Enterprise の場合、Review Before Send を必須にする</div>
                              </div>
                              <Checkbox defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">Unresolved Issue 保持時の送信制限</div>
                                <div className="text-xs text-slate-600">Unresolved issue がある場合、送信を Draft Only に変更</div>
                              </div>
                              <Checkbox />
                            </div>
                          </div>
                        </div>

                        {/* Role-based Send Permissions */}
                        <div className="pt-6 border-t">
                          <div className="text-sm font-semibold text-slate-900 mb-4">Role-based Send Permissions</div>
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50">
                                <TableHead>Role</TableHead>
                                <TableHead>Draft Only</TableHead>
                                <TableHead>Review Before Send</TableHead>
                                <TableHead>Auto Send</TableHead>
                                <TableHead>最大対象件数</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell className="font-medium">Admin</TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell>1000</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">Manager</TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell>500</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium">CSM</TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell><CheckCircle2 className="w-4 h-4 text-green-600" /></TableCell>
                                <TableCell><XCircle className="w-4 h-4 text-red-600" /></TableCell>
                                <TableCell>-</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>

                        {/* Fallback Behavior */}
                        <div className="pt-6 border-t">
                          <div className="text-sm font-semibold text-slate-900 mb-4">Fallback Behavior</div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">Auto Send 制限時の動作</div>
                                <div className="text-xs text-slate-600">policyによりAuto Sendが制限された場合の動作</div>
                              </div>
                              <Select defaultValue="review_queue">
                                <SelectTrigger className="w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="review_queue">Review Queue に送る</SelectItem>
                                  <SelectItem value="draft">Draft として保存</SelectItem>
                                  <SelectItem value="compose">Compose に送る</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">送信失敗時の動作</div>
                                <div className="text-xs text-slate-600">送信が失敗した場合の動作</div>
                              </div>
                              <Select defaultValue="retry">
                                <SelectTrigger className="w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="retry">自動リトライ</SelectItem>
                                  <SelectItem value="pause">Run を一時停止</SelectItem>
                                  <SelectItem value="skip">スキップして次へ</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* General Settings Tab */}
                <TabsContent value="general" className="mt-0">
                  <div className="border-t p-6">
                    <div className="max-w-2xl space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">ワークスペース設定</h3>
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm font-medium text-slate-700">ワークスペース名</Label>
                            <Input defaultValue="Acme CS Team" className="mt-2" />
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-slate-700">タイムゾーン</Label>
                            <Select defaultValue="asia_tokyo">
                              <SelectTrigger className="mt-2">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="asia_tokyo">Asia/Tokyo (JST)</SelectItem>
                                <SelectItem value="utc">UTC</SelectItem>
                                <SelectItem value="america_new_york">America/New_York (EST)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-slate-700">言語</Label>
                            <Select defaultValue="ja">
                              <SelectTrigger className="mt-2">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ja">日本語</SelectItem>
                                <SelectItem value="en">English</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">監査ログ保持期間</h3>
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm font-medium text-slate-700">保持期間</Label>
                            <Select defaultValue="90">
                              <SelectTrigger className="mt-2">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="30">30日</SelectItem>
                                <SelectItem value="90">90日</SelectItem>
                                <SelectItem value="180">180日</SelectItem>
                                <SelectItem value="365">1年</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4">
                        <Button>
                          <Save className="w-4 h-4 mr-2" />
                          設定を保存
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>

      {/* User Detail Drawer */}
      <Sheet open={isDrawerOpen && selectedUser !== null} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-[800px] overflow-y-auto p-8">
          {selectedUser && (
            <>
              <SheetHeader className="mb-8">
                <SheetTitle>ユーザー詳細</SheetTitle>
                <SheetDescription>{selectedUser.name}</SheetDescription>
              </SheetHeader>

              <div className="space-y-8">
                {/* Profile */}
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-4">プロフィール</div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-slate-500">名前</Label>
                      <div className="text-sm text-slate-900 mt-1">{selectedUser.name}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">メールアドレス</Label>
                      <div className="text-sm text-slate-900 mt-1">{selectedUser.email}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">ロール</Label>
                      <div className="mt-1">
                        <Badge variant="outline">{selectedUser.role}</Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">チーム</Label>
                      <div className="text-sm text-slate-900 mt-1">{selectedUser.team}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">ステータス</Label>
                      <div className="mt-1">
                        {selectedUser.status === "active" ? (
                          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-100 text-slate-600">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Activity */}
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-3">アクティビティ</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">最終アクティブ</span>
                      <span className="text-slate-900">{selectedUser.lastActive}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">作成日</span>
                      <span className="text-slate-900">{selectedUser.createdAt}</span>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-3">アイテム</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-xs text-blue-700 mb-1">所有アイテム</div>
                      <div className="text-xl font-bold text-blue-900">{selectedUser.ownedItemsCount}件</div>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="text-xs text-purple-700 mb-1">割当アイテム</div>
                      <div className="text-xl font-bold text-purple-900">{selectedUser.assignedItemsCount}件</div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <Edit3 className="w-4 h-4 mr-2" />
                    ロールを変更
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Key className="w-4 h-4 mr-2" />
                    権限を確認
                  </Button>
                  {selectedUser.status === "active" ? (
                    <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700">
                      <XCircle className="w-4 h-4 mr-2" />
                      無効化
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full justify-start text-green-600 hover:text-green-700">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      再有効化
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Role Detail Drawer */}
      <Sheet open={isDrawerOpen && selectedRole !== null} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-[800px] overflow-y-auto p-8">
          {selectedRole && (
            <>
              <SheetHeader className="mb-8">
                <SheetTitle>ロール詳細</SheetTitle>
                <SheetDescription>{selectedRole.name}</SheetDescription>
              </SheetHeader>

              <div className="space-y-8">
                {/* Basic Info */}
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-4">基本情報</div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">メンバー数</span>
                      <span className="text-slate-900">{selectedRole.memberCount}人</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">最終更新</span>
                      <span className="text-slate-900">{selectedRole.lastUpdated}</span>
                    </div>
                  </div>
                </div>

                {/* Permissions */}
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-3">権限マトリクス</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-slate-700">Company閲覧</span>
                      {selectedRole.canViewCompany ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-slate-700">Project閲覧</span>
                      {selectedRole.canViewProject ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-slate-700">Actions作成・編集</span>
                      {selectedRole.canCreateAction ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-slate-700">Content作成・編集</span>
                      {selectedRole.canCreateContent ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-slate-700">Library作成・編集</span>
                      {selectedRole.canCreateLibrary ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-slate-700">Audience作成・編集</span>
                      {selectedRole.canCreateAudience ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-slate-700">Outbound起票</span>
                      {selectedRole.canCreateOutbound ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm font-semibold text-slate-900">送信実行</span>
                      {selectedRole.canSend ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-slate-700">レビュー・承認（optional）</span>
                      {selectedRole.canReview ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-slate-700">Audit閲覧</span>
                      {selectedRole.canViewAudit ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-slate-700">Settings編集</span>
                      {selectedRole.canEditSettings ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <Edit3 className="w-4 h-4 mr-2" />
                    権限を編集
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Copy className="w-4 h-4 mr-2" />
                    複製
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Users className="w-4 h-4 mr-2" />
                    メンバーを見る
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* AI Agent Detail Drawer */}
      <Sheet open={isDrawerOpen && selectedAgent !== null} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-[900px] overflow-y-auto p-8">
          {selectedAgent && (
            <>
              <SheetHeader className="mb-8">
                <SheetTitle>AI Agent 設定詳細</SheetTitle>
                <SheetDescription>{selectedAgent.functionName}</SheetDescription>
              </SheetHeader>

              <div className="space-y-8">
                {/* Basic Info */}
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-4">基本情報</div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-slate-500">Function Name</Label>
                      <div className="text-sm font-medium text-slate-900 mt-1">{selectedAgent.functionName}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Description</Label>
                      <div className="text-sm text-slate-700 mt-1">{selectedAgent.description}</div>
                    </div>
                  </div>
                </div>

                {/* Provider Type */}
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-4">Provider Type</div>
                  <div>
                    {selectedAgent.providerType === "openrouter" ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        OpenRouter
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                        Kocoro
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Agent Configuration - OpenRouter */}
                {selectedAgent.providerType === "openrouter" && (
                  <div>
                    <div className="text-sm font-semibold text-slate-900 mb-4">OpenRouter 設定</div>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs text-slate-500">Model</Label>
                        <div className="text-sm text-slate-900 mt-1">{selectedAgent.model}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-slate-500">Provider</Label>
                          <div className="text-sm text-slate-900 mt-1">{selectedAgent.provider}</div>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Assigned Agent</Label>
                          <div className="text-sm text-slate-900 mt-1">{selectedAgent.assignedAgent}</div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">System Instruction</Label>
                        <div className="text-sm text-slate-700 mt-1 bg-slate-50 p-2 rounded border">
                          {selectedAgent.systemInstruction || "未設定"}
                        </div>
                      </div>
                      {selectedAgent.additionalInstruction && (
                        <div>
                          <Label className="text-xs text-slate-500">Additional Instruction</Label>
                          <div className="text-sm text-slate-700 mt-1 bg-slate-50 p-2 rounded border">
                            {selectedAgent.additionalInstruction}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-slate-500">Temperature</Label>
                          <div className="text-sm text-slate-900 mt-1">{selectedAgent.temperature ?? "0.7"}</div>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Max Tokens</Label>
                          <div className="text-sm text-slate-900 mt-1">{selectedAgent.maxTokens ?? "2000"}</div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Fallback Model</Label>
                        <div className="text-sm text-slate-700 mt-1">
                          {selectedAgent.fallbackModel || "設定なし"}
                        </div>
                      </div>
                      {selectedAgent.structuredOutputSchema && (
                        <div>
                          <Label className="text-xs text-slate-500">Structured Output Schema</Label>
                          <div className="text-xs text-slate-600 mt-1 font-mono bg-slate-50 p-2 rounded border">
                            {selectedAgent.structuredOutputSchema}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Agent Configuration - Kocoro */}
                {selectedAgent.providerType === "kocoro" && (
                  <div>
                    <div className="text-sm font-semibold text-slate-900 mb-4">Kocoro Agent 設定</div>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs text-slate-500">Kocoro Agent Name</Label>
                        <div className="text-sm font-medium text-slate-900 mt-1">{selectedAgent.kocoroAgentName}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-slate-500">Agent ID</Label>
                          <div className="text-xs text-slate-600 mt-1 font-mono">{selectedAgent.agentId}</div>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Auth Setting</Label>
                          <div className="text-xs text-slate-600 mt-1">{selectedAgent.authSetting}</div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">API Endpoint</Label>
                        <div className="text-xs text-slate-600 mt-1 font-mono bg-slate-50 p-2 rounded border">
                          {selectedAgent.apiEndpoint}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-slate-500">Input Mapping</Label>
                          <div className="text-xs text-slate-600 mt-1 bg-slate-50 p-2 rounded border">
                            {selectedAgent.inputMapping || "-"}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Output Mapping</Label>
                          <div className="text-xs text-slate-600 mt-1 bg-slate-50 p-2 rounded border">
                            {selectedAgent.outputMapping || "-"}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-slate-500">Output Type</Label>
                          <div className="mt-1">
                            <Badge variant="outline">{selectedAgent.outputType}</Badge>
                          </div>
                        </div>
                        {selectedAgent.fileOutputEnabled && (
                          <div>
                            <Label className="text-xs text-slate-500">File Type</Label>
                            <div className="mt-1">
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                {selectedAgent.fileType}
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Fallback Behavior</Label>
                        <div className="text-sm text-slate-700 mt-1">
                          {selectedAgent.fallbackBehavior || "設定なし"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Execution Policy */}
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-3">実行ポリシー</div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-500">Timeout</Label>
                        <div className="text-sm text-slate-900 mt-1">{selectedAgent.timeout}秒</div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Retry Policy</Label>
                        <div className="text-sm text-slate-900 mt-1">{selectedAgent.retryPolicy}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-3">ステータス</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Status</span>
                      <div>
                        {selectedAgent.status === "active" && selectedAgent.enabled && (
                          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                            Active
                          </Badge>
                        )}
                        {selectedAgent.status === "error" && (
                          <Badge variant="default" className="bg-red-100 text-red-800 border-red-200">
                            Error
                          </Badge>
                        )}
                        {(selectedAgent.status === "inactive" || !selectedAgent.enabled) && (
                          <Badge variant="outline" className="bg-slate-100 text-slate-600">
                            Disabled
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Enabled</span>
                      <span className="text-slate-900">
                        {selectedAgent.enabled ? "有効" : "無効"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Update Info */}
                <div>
                  <div className="text-sm font-semibold text-slate-900 mb-3">更新情報</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">最終更新日</span>
                      <span className="text-slate-900">{selectedAgent.lastUpdated}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">更新者</span>
                      <span className="text-slate-900">{selectedAgent.updatedBy}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <Edit3 className="w-4 h-4 mr-2" />
                    設定を編集
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Play className="w-4 h-4 mr-2" />
                    テスト実行
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <GitBranch className="w-4 h-4 mr-2" />
                    Fallbackを設定
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <History className="w-4 h-4 mr-2" />
                    変更履歴を見る
                  </Button>
                  {selectedAgent.enabled ? (
                    <Button variant="outline" className="w-full justify-start text-orange-600 hover:text-orange-700">
                      <XCircle className="w-4 h-4 mr-2" />
                      無効化
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full justify-start text-green-600 hover:text-green-700">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      有効化
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Default View Edit/Create Drawer */}
      <Sheet open={selectedView !== null && activeTab === "default_views"} onOpenChange={(open) => !open && setSelectedView(null)}>
        <SheetContent className="w-[800px] max-w-[90vw] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedView?.id?.startsWith("view-") ? "Default View を編集" : "Default View を作成"}
            </SheetTitle>
            <SheetDescription>
              各画面の初期体験（Current View Label、subtitle、summary、empty state、フィルタ、ソート）を定義します
            </SheetDescription>
          </SheetHeader>

          {selectedView && (
            <div className="space-y-6 py-6">
              {/* Section A: 基本情報 */}
              <div className="border-b pb-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">A. 基本情報</h3>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">View Name *</Label>
                    <Input defaultValue={selectedView.name} placeholder="例: My Projects" className="mt-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Target Screen *</Label>
                      <Select defaultValue={selectedView.targetScreen}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Console">Console</SelectItem>
                          <SelectItem value="Company">Company</SelectItem>
                          <SelectItem value="Projects">Projects</SelectItem>
                          <SelectItem value="Actions">Actions</SelectItem>
                          <SelectItem value="Content">Content</SelectItem>
                          <SelectItem value="Outbound">Outbound</SelectItem>
                          <SelectItem value="Audience">Audience</SelectItem>
                          <SelectItem value="Inbox">Inbox</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Scope Type *</Label>
                      <Select defaultValue={selectedView.scope}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="personal">Personal (優先度: 1)</SelectItem>
                          <SelectItem value="role-based">Role-based (優先度: 2)</SelectItem>
                          <SelectItem value="team">Team (優先度: 3)</SelectItem>
                          <SelectItem value="workspace">Workspace (優先度: 4)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Applicable Roles</Label>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox id="role-csm" defaultChecked={selectedView.applicableRoles?.includes("CSM")} />
                        <label htmlFor="role-csm" className="text-sm text-slate-700">CSM</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="role-manager" defaultChecked={selectedView.applicableRoles?.includes("Manager")} />
                        <label htmlFor="role-manager" className="text-sm text-slate-700">Manager</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="role-admin" defaultChecked={selectedView.applicableRoles?.includes("Admin")} />
                        <label htmlFor="role-admin" className="text-sm text-slate-700">Admin</label>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="is-default" defaultChecked={selectedView.isDefault} />
                    <label htmlFor="is-default" className="text-sm font-medium text-slate-700">
                      このスコープのデフォルトViewとして設定
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="is-enabled" defaultChecked={selectedView.enabled} />
                    <label htmlFor="is-enabled" className="text-sm font-medium text-slate-700">
                      有効化
                    </label>
                  </div>
                </div>
              </div>

              {/* Section B: 初期表示条件 */}
              <div className="border-b pb-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">B. 初期表示条件</h3>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Default Filter Condition *</Label>
                    <Textarea 
                      defaultValue={selectedView.filterCondition} 
                      placeholder="例: owner = 自分 AND status = active" 
                      className="mt-2 font-mono text-xs" 
                      rows={2}
                    />
                    <p className="text-xs text-slate-500 mt-1">フィルタ条件を定義します（AND/OR論理式）</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Default Sort</Label>
                      <Input 
                        defaultValue={selectedView.defaultSort} 
                        placeholder="例: Last Activity Desc" 
                        className="mt-2" 
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Default Display Mode</Label>
                      <Select defaultValue={selectedView.defaultDisplayMode || "table"}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="table">Table</SelectItem>
                          <SelectItem value="overview">Overview</SelectItem>
                          <SelectItem value="clusters">Clusters</SelectItem>
                          <SelectItem value="kanban">Kanban</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Default Grouping</Label>
                      <Input 
                        defaultValue={selectedView.defaultGrouping} 
                        placeholder="例: Phase" 
                        className="mt-2" 
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Default Density</Label>
                      <Select defaultValue={selectedView.defaultDensity || "comfortable"}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="compact">Compact</SelectItem>
                          <SelectItem value="comfortable">Comfortable</SelectItem>
                          <SelectItem value="spacious">Spacious</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section C: 表示文言 */}
              <div className="border-b pb-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">C. 表示文言</h3>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Current View Label *</Label>
                    <Input 
                      defaultValue={selectedView.currentViewLabel} 
                      placeholder="例: My Projects" 
                      className="mt-2" 
                    />
                    <p className="text-xs text-slate-500 mt-1">ページタイトルに表示される View 名</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Subtitle *</Label>
                    <Input 
                      defaultValue={selectedView.subtitle} 
                      placeholder="例: 自分の担当Projectの状況と優先度を確認する" 
                      className="mt-2" 
                    />
                    <p className="text-xs text-slate-500 mt-1">Current View Label の下に表示される説明文</p>
                  </div>
                  <div className="bg-slate-50 border rounded-lg p-4">
                    <div className="text-xs font-semibold text-slate-700 mb-3">Empty State 設定</div>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs font-medium text-slate-700">Empty State Title</Label>
                        <Input 
                          defaultValue={selectedView.emptyStateTitle} 
                          placeholder="例: 担当Projectはまだありません" 
                          className="mt-1 text-sm" 
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-700">Empty State Body</Label>
                        <Textarea 
                          defaultValue={selectedView.emptyStateBody} 
                          placeholder="例: Projectが割り当てられると、ここに表示されます" 
                          className="mt-1 text-sm" 
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-medium text-slate-700">CTA Label</Label>
                          <Input 
                            defaultValue={selectedView.emptyStateCtaLabel} 
                            placeholder="例: All Projects を見る" 
                            className="mt-1 text-sm" 
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-slate-700">CTA Destination (View ID)</Label>
                          <Input 
                            defaultValue={selectedView.emptyStateCtaDestination} 
                            placeholder="例: all" 
                            className="mt-1 text-sm" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section D: サマリー連動 */}
              <div className="pb-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">D. サマリー連動</h3>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Summary Cards Target Scope</Label>
                    <Textarea 
                      defaultValue={selectedView.summaryCardsTargetScope} 
                      placeholder="例: Filtered by owner = 自分" 
                      className="mt-2 text-xs font-mono" 
                      rows={2}
                    />
                    <p className="text-xs text-slate-500 mt-1">サマリーカードの集計対象範囲を説明</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Filter Chips Preview</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedView.filterChipsPreview?.map((chip, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {chip}
                        </Badge>
                      ))}
                    </div>
                    <Input 
                      placeholder="カンマ区切りで���ップを追加: owner: 自分, status: active" 
                      className="mt-2 text-xs" 
                    />
                    <p className="text-xs text-slate-500 mt-1">適用されるフィルタチップのプレビュー</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-2" />
                    プレビュー
                  </Button>
                  <Button variant="outline" size="sm">
                    <Copy className="w-4 h-4 mr-2" />
                    複製
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelectedView(null)}>
                    キャンセル
                  </Button>
                  <Button variant="outline">
                    <Save className="w-4 h-4 mr-2" />
                    下書き保存
                  </Button>
                  <Button>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    保存して適用
                  </Button>
                </div>
              </div>

              {/* Metadata */}
              <div className="text-xs text-slate-500 pt-4 border-t space-y-1">
                <div>最終更新: {selectedView.updatedAt}</div>
                <div>更新者: {selectedView.updatedBy || "-"}</div>
                <div>優先度: {selectedView.priority || "未設定"}</div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Invite User Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>ユーザーを招待</DialogTitle>
            <DialogDescription>
              新しいユーザーを招待してチームに追加します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">ユーザー名 *</Label>
                <Input placeholder="山田 太郎" className="mt-2" />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">メールアドレス *</Label>
                <Input type="email" placeholder="t.yamada@example.com" className="mt-2" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">ロール *</Label>
                <Select defaultValue="csm">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="csm">CSM</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">チーム *</Label>
                <Select defaultValue="cs">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cs">Customer Success</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">ステータス</Label>
                <Select defaultValue="active">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">デフォルトビュースコープ</Label>
                <Select defaultValue="my_accounts">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="my_accounts">My Accounts (自分が担当)</SelectItem>
                    <SelectItem value="my_team">My Team (チーム全体)</SelectItem>
                    <SelectItem value="all">All (すべて)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">招待メッセージ（任意）</Label>
              <Textarea 
                placeholder="チームへようこそ！一緒にお客様の成功を支援していきましょう。" 
                className="mt-2" 
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={() => setIsDialogOpen(false)}>
              <UserPlus className="w-4 h-4 mr-2" />
              招待して作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Rule Edit Dialog */}
      <AlertRuleEditDialog
        open={alertRuleEditOpen}
        onOpenChange={setAlertRuleEditOpen}
        rule={selectedAlertRule}
        mode={alertRuleEditMode}
      />

      {/* Alert Rule Test Dialog */}
      <AlertRuleTestDialog
        open={alertRuleTestOpen}
        onOpenChange={setAlertRuleTestOpen}
        ruleName={currentRuleName}
      />

      {/* Rule Change History Sheet */}
      <RuleChangeHistorySheet
        open={ruleHistoryOpen}
        onOpenChange={setRuleHistoryOpen}
        ruleName={currentRuleName}
      />

      {/* Suggestion Rule Edit Dialog */}
      <SuggestionRuleEditDialog
        open={suggestionRuleEditOpen}
        onOpenChange={setSuggestionRuleEditOpen}
        rule={selectedAlertRule}
        mode={alertRuleEditMode}
      />

      {/* Summary Rule Edit Dialog */}
      <SummaryRuleEditDialog
        open={summaryRuleEditOpen}
        onOpenChange={setSummaryRuleEditOpen}
        rule={selectedAlertRule}
        mode={alertRuleEditMode}
      />

      {/* Threshold Preset Edit Dialog */}
      <ThresholdPresetEditDialog
        open={thresholdPresetEditOpen}
        onOpenChange={setThresholdPresetEditOpen}
        preset={selectedAlertRule}
        mode={alertRuleEditMode}
      />

      {/* Feed Display Rule Edit Dialog */}
      <FeedDisplayRuleEditDialog
        open={feedDisplayRuleEditOpen}
        onOpenChange={setFeedDisplayRuleEditOpen}
        rule={selectedAlertRule}
        mode={alertRuleEditMode}
      />
    </div>
  );
}