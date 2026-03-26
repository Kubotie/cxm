import { useState } from "react";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
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
  BookOpen,
  FileText,
  Mail,
  MessageSquare,
  Calendar,
  TrendingUp,
  Shield,
  ExternalLink,
  Search,
  Filter,
  Plus,
  ChevronRight,
  Copy,
  Edit3,
  Eye,
  CheckCircle2,
  Clock,
  Archive,
  AlertCircle,
  Users,
  Building,
  User,
  Sparkles,
  Send,
  ArrowUpRight,
  History,
  Link as LinkIcon,
  Download,
  MoreVertical,
  Bell
} from "lucide-react";
import { Link } from "react-router";
import { CreateKnowledgeModal } from "../components/knowledge/create-knowledge-modal";

type KnowledgeCategory = 
  | "all"
  | "templates"
  | "playbooks"
  | "proposal_patterns"
  | "email_templates"
  | "support_templates"
  | "meeting_templates"
  | "notification_templates"
  | "governance_approved"
  | "drafts"
  | "archived";

// モックデータ
const mockKnowledge = [
  {
    id: "tmpl-1",
    title: "フォローアップメール（決裁者向け）",
    category: "email_templates",
    type: "email_template",
    intendedUse: "決裁者が会議を欠席した際の個別フォローアップ",
    linkedActionType: "send_external",
    linkedChannel: "email",
    status: "approved" as const,
    approvalState: "governance_approved" as const,
    owner: "田中 花子",
    lastUpdated: "2026-03-05",
    usageCount: 127,
    scope: "Company" as const,
    tags: ["decision_maker", "follow_up", "meeting"],
    isExternal: true,
    variables: ["{{company_name}}", "{{contact_name}}", "{{csm_name}}", "{{meeting_date}}", "{{next_action}}"],
    body: "{{contact_name}}様\n\nいつも大変お世話になっております。\n{{csm_name}}です。\n\n先日の{{meeting_date}}のMTGでは、ご都合がつかずお会いできず残念でした。\n\nプロジェクトの進捗状況と、ご懸念点について、改めて個別にお話しさせていただきたく、ご連絡いたしました。\n\n{{next_action}}\n\nよろしくお願いいたします。",
    applicableCondition: "決裁者が2回以上会議を欠席",
    nonApplicableCase: "初回欠席、担当者レベルの欠席",
    relatedEvidencePattern: "meeting_minutes, email_thread",
    exampleOutput: "山田様\n\nいつも大変お世話になっております。\n佐藤です。\n\n先日の3月10日のMTGでは、ご都合がつかずお会いできず残念でした。\n\nプロジェクトの進捗状況と、ご懸念点について、改めて個別にお話しさせていただきたく、ご連絡いたしました。\n\n下記日程でいかがでしょうか。\n- 3月15日(金) 14:00-15:00\n- 3月18日(月) 10:00-11:00\n\nよろしくお願いいたします。",
  },
  {
    id: "tmpl-2",
    title: "製品アップデート通知（Slack/Chatwork）",
    category: "notification_templates",
    type: "notification_template",
    intendedUse: "新機能リリースや重要なアップデート情報の顧客通知",
    linkedActionType: "send_external",
    linkedChannel: "slack/chatwork",
    status: "approved" as const,
    approvalState: "governance_approved" as const,
    owner: "山本 一郎",
    lastUpdated: "2026-02-28",
    usageCount: 342,
    scope: "Company" as const,
    tags: ["product_update", "notification", "customer_facing"],
    isExternal: true,
    variables: ["{{company_name}}", "{{update_title}}", "{{update_summary}}", "{{benefit}}", "{{documentation_link}}", "{{csm_name}}"],
    body: "【製品アップデートのお知らせ】\n\n{{company_name}}様\n\nいつもご利用いただきありがとうございます。\n{{csm_name}}です。\n\n■ アップデート内容\n{{update_title}}\n\n■ 概要\n{{update_summary}}\n\n■ お客様へのメリット\n{{benefit}}\n\n■ 詳細ドキュメント\n{{documentation_link}}\n\nご不明点がございましたら、お気軽にお声がけください。",
    applicableCondition: "新機能リリース、重要な仕様変更",
    nonApplicableCase: "軽微な修正、内部変更のみ",
    relatedEvidencePattern: "product_release, changelog",
    exampleOutput: "【製品アップデートのお知らせ】\n\n株式会社テクノロジーイノベーション様\n\nいつもご利用いただきありがとうございます。\n佐藤です。\n\n■ アップデート内容\nダッシュボード機能の大幅強化\n\n■ 概要\nリアルタイムデータ表示、カスタマイズ可能なウィジェット、CSVエクスポート機能を追加しました。\n\n■ お客様へのメリット\n・データ分析の効率が約30%向上\n・レポート作成時間の短縮\n\n■ 詳細ドキュメント\nhttps://docs.example.com/updates/dashboard-v2\n\nご不明点がございましたら、お気軽にお声がけください。",
  },
  {
    id: "play-1",
    title: "Health Score低下対応プレイブック",
    category: "playbooks",
    type: "risk_response_playbook",
    intendedUse: "Health Scoreが急激に低下した際の対応手順",
    linkedActionType: "multiple",
    linkedChannel: "multiple",
    status: "approved" as const,
    approvalState: "governance_approved" as const,
    owner: "佐藤 太郎",
    lastUpdated: "2026-03-01",
    usageCount: 45,
    scope: "Company" as const,
    tags: ["health_score", "risk", "playbook", "escalation"],
    isExternal: false,
    variables: [],
    body: "1. Health Score低下原因の特定\n2. 製品利用ログ確認\n3. 最近のサポートチケット確認\n4. 顧客担当者へのヒアリング\n5. 必要に応じてマネージャーへエスカレーション\n6. 改善アクションプランの作成\n7. 営業チームへの状況共有",
    applicableCondition: "Health Scoreが前週比20%以上低下",
    nonApplicableCase: "季節要因による一時的な低下",
    relatedEvidencePattern: "health_score, product_usage, support_ticket, meeting_minutes",
    exampleOutput: "N/A (手順書のため)",
  },
  {
    id: "tmpl-3",
    title: "サポート回答テンプレート（技術問題）",
    category: "support_templates",
    type: "support_reply_template",
    intendedUse: "技術的な問い合わせへの定型回答",
    linkedActionType: "send_external",
    linkedChannel: "email",
    status: "active" as const,
    approvalState: "approved" as const,
    owner: "鈴木 次郎",
    lastUpdated: "2026-02-20",
    usageCount: 234,
    scope: "User" as const,
    tags: ["support", "technical", "email"],
    isExternal: true,
    variables: ["{{contact_name}}", "{{ticket_id}}", "{{issue_summary}}", "{{solution}}", "{{support_name}}"],
    body: "{{contact_name}}様\n\nお世話になっております。\nサポート担当の{{support_name}}です。\n\nお問い合わせいただいた件（チケット#{{ticket_id}}）について、ご連絡いたします。\n\n【問題内容】\n{{issue_summary}}\n\n【解決方法】\n{{solution}}\n\n引き続きご不明点等ございましたら、お気軽にお問い合わせください。",
    applicableCondition: "技術的な問題への回答",
    nonApplicableCase: "契約・請求に関する問い合わせ",
    relatedEvidencePattern: "support_ticket",
    exampleOutput: "田中様\n\nお世話になっております。\nサポート担当の鈴木です。\n\nお問い合わせいただいた件（チケット#2847）について、ご連絡いたします。\n\n【問題内容】\nログイン時にエラーが発生する\n\n【解決方法】\n1. ブラウザのキャッシュをクリアする\n2. 別のブラウザ（Chrome推奨）で再度お試しください\n\n引き続きご不明点等ございましたら、お気軽にお問い合わせください。",
  },
  {
    id: "prop-1",
    title: "追加ライセンス提案パターン",
    category: "proposal_patterns",
    type: "proposal_pattern",
    intendedUse: "既存顧客への追加ライセンス提案時の構造",
    linkedActionType: "propose_action",
    linkedChannel: "email",
    status: "approved" as const,
    approvalState: "governance_approved" as const,
    owner: "田中 花子",
    lastUpdated: "2026-03-08",
    usageCount: 89,
    scope: "Company" as const,
    tags: ["expansion", "proposal", "upsell", "ai_ready"],
    isExternal: true,
    variables: ["{{company_name}}", "{{current_usage}}", "{{expansion_opportunity}}", "{{roi_estimation}}", "{{next_step}}"],
    body: "■ 現在の利用状況\n{{current_usage}}\n\n■ 拡大機会\n{{expansion_opportunity}}\n\n■ 想定ROI\n{{roi_estimation}}\n\n■ 次のステップ\n{{next_step}}",
    applicableCondition: "既存部署での高利用率、他部署からの問い合わせ",
    nonApplicableCase: "導入後3ヶ月未満、利用率50%未満",
    relatedEvidencePattern: "product_usage, meeting_minutes, crm_opportunity",
    exampleOutput: "■ 現在の利用状況\n営業部15名で活用中、月間アクティブ率95%\n\n■ 拡大機会\nマーケティング部長から「営業部の事例を見て導入したい」との発言\n\n■ 想定ROI\nマーケティング部20名導入で、月間XX時間の業務効率化\n\n■ 次のステップ\nマーケティング部長との個別商談設定",
  },
  {
    id: "tmpl-4",
    title: "QBRミーティング議題テンプレート",
    category: "meeting_templates",
    type: "meeting_summary_template",
    intendedUse: "四半期ビジネスレビューの議題作成",
    linkedActionType: "send_external",
    linkedChannel: "email",
    status: "draft" as const,
    approvalState: "in_review" as const,
    owner: "山本 一郎",
    lastUpdated: "2026-03-11",
    usageCount: 12,
    scope: "Company" as const,
    tags: ["qbr", "meeting", "review", "draft"],
    isExternal: true,
    variables: ["{{company_name}}", "{{quarter}}", "{{key_metrics}}", "{{achievements}}", "{{challenges}}", "{{next_quarter_goals}}"],
    body: "【{{quarter}} QBR議題】{{company_name}}様\n\n1. 前四半期の振り返り\n{{key_metrics}}\n\n2. 達成事項\n{{achievements}}\n\n3. 課題と対策\n{{challenges}}\n\n4. 次四半期の目標\n{{next_quarter_goals}}",
    applicableCondition: "四半期終了後1週間以内",
    nonApplicableCase: "契約後3ヶ月未満",
    relatedEvidencePattern: "product_usage, health_score, support_ticket, meeting_minutes",
    exampleOutput: "【Q1 QBR議題】株式会社テクノロジーイノベーション様\n\n1. 前四半期の振り返り\n・アクティブユーザー率: 85%\n・平均Health Score: 78\n\n2. 達成事項\n・営業部での定着完了\n・サポートチケット解決率98%\n\n3. 課題と対策\n・一部機能の利用率が低い → トレーニング実施\n\n4. 次四半期の目標\n・マーケティング部への展開検討",
  },
  {
    id: "tmpl-5",
    title: "契約更新提案メールテンプレート",
    category: "email_templates",
    type: "email_template",
    intendedUse: "契約更新90日前の提案メール",
    linkedActionType: "send_external",
    linkedChannel: "email",
    status: "approved" as const,
    approvalState: "governance_approved" as const,
    owner: "佐藤 太郎",
    lastUpdated: "2026-02-15",
    usageCount: 67,
    scope: "Company" as const,
    tags: ["renewal", "contract", "email", "governance"],
    isExternal: true,
    variables: ["{{company_name}}", "{{contact_name}}", "{{renewal_date}}", "{{current_plan}}", "{{achievements}}", "{{csm_name}}"],
    body: "{{contact_name}}様\n\nいつもご利用いただきありがとうございます。\n{{csm_name}}です。\n\nご契約が{{renewal_date}}に更新時期を迎えます。\n\n現在のご利用状況：\n{{achievements}}\n\n引き続き{{company_name}}様の成功をサポートさせていただきたく、更新のご検討をお願いできますと幸いです。\n\nご不明点やご要望がございましたら、お気軽にご連絡ください。",
    applicableCondition: "契約更新90日前",
    nonApplicableCase: "契約更新180日以上前、30日未満",
    relatedEvidencePattern: "crm_contract, health_score, product_usage",
    exampleOutput: "山田様\n\nいつもご利用いただきありがとうございます。\n佐藤です。\n\nご契約が2026年6月15日に更新時期を迎えます。\n\n現在のご利用状況：\n・アクティブユーザー率90%\n・業務効率化により月間120時間の削減を達成\n\n引き続き株式会社テクノロジーイノベーション様の成功をサポートさせていただきたく、更新のご検討をお願いできますと幸いです。\n\nご不明点やご要望がございましたら、お気軽にご連絡ください。",
  },
  {
    id: "tmpl-6",
    title: "サービス障害報告（Slack/Chatwork）",
    category: "notification_templates",
    type: "notification_template",
    intendedUse: "サービス障害発生時の顧客への迅速な状況報告",
    linkedActionType: "send_external",
    linkedChannel: "slack/chatwork",
    status: "approved" as const,
    approvalState: "governance_approved" as const,
    owner: "鈴木 次郎",
    lastUpdated: "2026-01-30",
    usageCount: 28,
    scope: "Company" as const,
    tags: ["incident", "notification", "urgent", "customer_facing"],
    isExternal: true,
    variables: ["{{company_name}}", "{{incident_title}}", "{{impact}}", "{{current_status}}", "{{eta}}", "{{csm_name}}"],
    body: "【重要】サービス障害のご報告\n\n{{company_name}}様\n\nいつもご利用いただきありがとうございます。\n{{csm_name}}です。\n\n現在、以下の障害が発生しております。\n\n■ 障害内容\n{{incident_title}}\n\n■ 影響範囲\n{{impact}}\n\n■ 現在の状況\n{{current_status}}\n\n■ 復旧見込み\n{{eta}}\n\n引き続き状況を監視し、進展があり次第ご連絡いたします。\nご迷惑をおかけし、誠に申し訳ございません。",
    applicableCondition: "サービス障害発生、顧客影響が確認された場合",
    nonApplicableCase: "計画メンテナンス、影響範囲が限定的な場合",
    relatedEvidencePattern: "incident_report, system_status",
    exampleOutput: "【重要】サービス障害のご報告\n\n株式会社テクノロジーイノベーション様\n\nいつもご利用いただきありがとうございます。\n鈴木です。\n\n現在、以下の障害が発生しております。\n\n■ 障害内容\nログイン機能の一時的な障害\n\n■ 影響範囲\n一部のユーザー様がログインできない状態\n\n■ 現在の状況\n原因を特定し、復旧作業中です\n\n■ 復旧見込み\n30分以内（15:30頃）\n\n引き続き状況を監視し、進展があり次第ご連絡いたします。\nご迷惑をおかけし、誠に申し訳ございません。",
  },
];

const categoryConfig: Record<KnowledgeCategory, { label: string; icon: any; count?: number }> = {
  all: { label: "All Knowledge", icon: BookOpen },
  templates: { label: "Templates", icon: FileText, count: 5 },
  playbooks: { label: "Playbooks", icon: TrendingUp, count: 1 },
  proposal_patterns: { label: "Proposal Patterns", icon: Sparkles, count: 1 },
  email_templates: { label: "Email Templates", icon: Mail, count: 2 },
  support_templates: { label: "Support Reply", icon: MessageSquare, count: 1 },
  meeting_templates: { label: "Meeting Templates", icon: Calendar, count: 1 },
  notification_templates: { label: "Notification Templates", icon: Bell, count: 2 },
  governance_approved: { label: "Governance Approved", icon: Shield, count: 5 },
  drafts: { label: "Drafts", icon: Edit3, count: 1 },
  archived: { label: "Archived", icon: Archive, count: 0 },
};

const statusConfig = {
  draft: { label: "Draft", color: "bg-slate-100 text-slate-700" },
  in_review: { label: "In Review", color: "bg-blue-100 text-blue-700" },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-700" },
  active: { label: "Active", color: "bg-emerald-100 text-emerald-700" },
  deprecated: { label: "Deprecated", color: "bg-orange-100 text-orange-700" },
  archived: { label: "Archived", color: "bg-slate-100 text-slate-500" },
};

const scopeIcons = {
  Company: Building,
  Project: Users,
  User: User,
};

export function Knowledge() {
  const [activeCategory, setActiveCategory] = useState<KnowledgeCategory>("all");
  const [selectedKnowledge, setSelectedKnowledge] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterScope, setFilterScope] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const selectedKnowledgeData = mockKnowledge.find(k => k.id === selectedKnowledge);

  const filteredKnowledge = mockKnowledge.filter(k => {
    if (activeCategory === "governance_approved" && k.approvalState !== "governance_approved") return false;
    if (activeCategory === "drafts" && k.status !== "draft") return false;
    if (activeCategory === "archived" && k.status !== "archived") return false;
    if (activeCategory !== "all" && activeCategory !== "governance_approved" && activeCategory !== "drafts" && activeCategory !== "archived") {
      if (k.category !== activeCategory) return false;
    }
    if (filterStatus !== "all" && k.status !== filterStatus) return false;
    if (filterScope !== "all" && k.scope !== filterScope) return false;
    if (searchQuery && !k.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleRowClick = (id: string) => {
    setSelectedKnowledge(id);
    setIsDrawerOpen(true);
  };

  const draftCount = mockKnowledge.filter(k => k.status === "draft").length;
  const reviewCount = mockKnowledge.filter(k => k.approvalState === "in_review").length;

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Cross-scope" />
        <main className="flex-1 overflow-hidden flex">
          {/* Left Navigation */}
          <aside className="w-56 border-r bg-white flex flex-col">
            <div className="p-3 border-b">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Knowledge
              </h2>
            </div>
            <nav className="flex-1 p-2">
              <ScrollArea className="h-full">
                <ul className="space-y-0.5">
                  {Object.entries(categoryConfig).map(([key, config]) => {
                    const Icon = config.icon;
                    const category = key as KnowledgeCategory;
                    return (
                      <li key={key}>
                        <button
                          onClick={() => setActiveCategory(category)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                            activeCategory === category
                              ? "bg-blue-50 text-blue-900 font-medium"
                              : "text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span className="flex-1 text-left">{config.label}</span>
                          {config.count !== undefined && config.count > 0 && (
                            <Badge variant="outline" className="text-xs h-4 px-1">
                              {config.count}
                            </Badge>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            </nav>
          </aside>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-white border-b p-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h1 className="text-base font-semibold text-slate-900">Knowledge / Templates</h1>
                  <p className="text-xs text-slate-600 mt-0.5">
                    再利用可能なナレッジ・テンプレート・プレイブック
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {draftCount > 0 && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs">
                      下書き: {draftCount}件
                    </Badge>
                  )}
                  {reviewCount > 0 && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-xs">
                      承認待ち: {reviewCount}件
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setShowCreateModal(true)}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    新規作成
                  </Button>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    placeholder="テンプレート・ナレッジを検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-7 text-xs"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[130px] h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべてのStatus</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterScope} onValueChange={setFilterScope}>
                  <SelectTrigger className="w-[120px] h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべてのScope</SelectItem>
                    <SelectItem value="Company">Company</SelectItem>
                    <SelectItem value="Project">Project</SelectItem>
                    <SelectItem value="User">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table with horizontal scroll */}
            <div className="flex-1 overflow-auto">
              <div className="min-w-[1400px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50 z-10">
                    <TableRow>
                      <TableHead className="text-xs font-semibold min-w-[280px]">Title / Intended Use</TableHead>
                      <TableHead className="text-xs font-semibold w-[120px]">Category</TableHead>
                      <TableHead className="text-xs font-semibold w-[140px]">Type</TableHead>
                      <TableHead className="text-xs font-semibold w-[100px]">Scope</TableHead>
                      <TableHead className="text-xs font-semibold w-[120px]">Action Type</TableHead>
                      <TableHead className="text-xs font-semibold w-[80px]">Status</TableHead>
                      <TableHead className="text-xs font-semibold w-[80px]">Approval</TableHead>
                      <TableHead className="text-xs font-semibold w-[100px]">Owner</TableHead>
                      <TableHead className="text-xs font-semibold w-[80px] text-right">使用数</TableHead>
                      <TableHead className="text-xs font-semibold w-[100px]">最終更新</TableHead>
                      <TableHead className="text-xs font-semibold w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredKnowledge.map((item) => {
                      const ScopeIcon = scopeIcons[item.scope];
                      return (
                        <TableRow
                          key={item.id}
                          onClick={() => handleRowClick(item.id)}
                          className="cursor-pointer hover:bg-slate-50 text-xs"
                        >
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-900">{item.title}</span>
                                <div className="flex items-center gap-1">
                                  {item.isExternal && (
                                    <Badge className="bg-red-500 text-xs h-4 px-1">
                                      <ExternalLink className="w-2.5 h-2.5 mr-0.5" />
                                      External
                                    </Badge>
                                  )}
                                  {!item.isExternal && (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-800 text-xs h-4 px-1">
                                      Internal
                                    </Badge>
                                  )}
                                  {item.approvalState === "governance_approved" && (
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-xs h-4 px-1">
                                      <Shield className="w-2.5 h-2.5 mr-0.5" />
                                      Governance
                                    </Badge>
                                  )}
                                  {item.tags.includes("ai_ready") && (
                                    <Badge variant="outline" className="bg-purple-50 text-purple-800 text-xs h-4 px-1">
                                      <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                                      AI Ready
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs text-slate-600">{item.intendedUse}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-700 capitalize">
                            {item.category.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="text-slate-700">
                            <Badge variant="outline" className="text-xs">
                              {item.type.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <ScopeIcon className="w-3 h-3 text-slate-600" />
                              <span className="text-slate-700">{item.scope}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-700">
                            {item.linkedActionType === "multiple" ? (
                              <Badge variant="outline" className="text-xs">Multiple</Badge>
                            ) : (
                              <span>{item.linkedActionType}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${statusConfig[item.status].color}`}>
                              {statusConfig[item.status].label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.approvalState === "governance_approved" && (
                              <div className="flex items-center gap-1 text-emerald-700">
                                <CheckCircle2 className="w-3 h-3" />
                                <span className="text-xs">Approved</span>
                              </div>
                            )}
                            {item.approvalState === "approved" && (
                              <div className="flex items-center gap-1 text-blue-700">
                                <CheckCircle2 className="w-3 h-3" />
                                <span className="text-xs">Approved</span>
                              </div>
                            )}
                            {item.approvalState === "in_review" && (
                              <div className="flex items-center gap-1 text-amber-700">
                                <Clock className="w-3 h-3" />
                                <span className="text-xs">Review</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-700">{item.owner}</TableCell>
                          <TableCell className="text-right text-slate-700 font-medium">
                            {item.usageCount}
                          </TableCell>
                          <TableCell className="text-slate-600">{item.lastUpdated}</TableCell>
                          <TableCell>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Detail Drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-[700px] sm:max-w-[700px] p-0">
          {selectedKnowledgeData && (
            <>
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="text-base">{selectedKnowledgeData.title}</SheetTitle>
                <SheetDescription className="text-xs">
                  {selectedKnowledgeData.type.replace(/_/g, " ")} • ID: {selectedKnowledge}
                </SheetDescription>
              </SheetHeader>

              <ScrollArea className="h-[calc(100vh-80px)]">
                <div className="p-4 space-y-4">
                  {/* Badges & Meta */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={`text-xs ${statusConfig[selectedKnowledgeData.status].color}`}>
                      {statusConfig[selectedKnowledgeData.status].label}
                    </Badge>
                    {selectedKnowledgeData.isExternal ? (
                      <Badge className="bg-red-500 text-xs">
                        <ExternalLink className="w-2.5 h-2.5 mr-0.5" />
                        External Send
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-50 text-blue-800 text-xs">
                        Internal Only
                      </Badge>
                    )}
                    {selectedKnowledgeData.approvalState === "governance_approved" && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-xs">
                        <Shield className="w-2.5 h-2.5 mr-0.5" />
                        Governance Approved
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      {selectedKnowledgeData.scope === "Company" && <Building className="w-2.5 h-2.5" />}
                      {selectedKnowledgeData.scope === "Project" && <Users className="w-2.5 h-2.5" />}
                      {selectedKnowledgeData.scope === "User" && <User className="w-2.5 h-2.5" />}
                      <span>Scope: {selectedKnowledgeData.scope}</span>
                    </Badge>
                    {selectedKnowledgeData.tags.includes("ai_ready") && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-800 text-xs">
                        <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                        AI Ready
                      </Badge>
                    )}
                  </div>

                  <Separator />

                  {/* Basic Info Table */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">基本情報</h3>
                    <div className="border rounded">
                      <table className="w-full text-xs">
                        <tbody>
                          <tr className="border-b">
                            <td className="p-2 bg-slate-50 font-semibold w-[140px]">Intended Use</td>
                            <td className="p-2">{selectedKnowledgeData.intendedUse}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 bg-slate-50 font-semibold">Category</td>
                            <td className="p-2 capitalize">{selectedKnowledgeData.category.replace(/_/g, " ")}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 bg-slate-50 font-semibold">Type</td>
                            <td className="p-2">{selectedKnowledgeData.type.replace(/_/g, " ")}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 bg-slate-50 font-semibold">Linked Action Type</td>
                            <td className="p-2">{selectedKnowledgeData.linkedActionType}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 bg-slate-50 font-semibold">Linked Channel</td>
                            <td className="p-2">{selectedKnowledgeData.linkedChannel}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 bg-slate-50 font-semibold">Owner</td>
                            <td className="p-2">{selectedKnowledgeData.owner}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 bg-slate-50 font-semibold">使用回数</td>
                            <td className="p-2 font-medium">{selectedKnowledgeData.usageCount}回</td>
                          </tr>
                          <tr>
                            <td className="p-2 bg-slate-50 font-semibold">最終更新</td>
                            <td className="p-2">{selectedKnowledgeData.lastUpdated}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <Separator />

                  {/* Applicable Conditions */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">適用条件</h3>
                    <div className="border rounded">
                      <table className="w-full text-xs">
                        <tbody>
                          <tr className="border-b">
                            <td className="p-2 bg-slate-50 font-semibold w-[140px]">適用条件</td>
                            <td className="p-2">{selectedKnowledgeData.applicableCondition}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2 bg-slate-50 font-semibold">適用不可ケース</td>
                            <td className="p-2 text-slate-600">{selectedKnowledgeData.nonApplicableCase}</td>
                          </tr>
                          <tr>
                            <td className="p-2 bg-slate-50 font-semibold">関連Evidenceパターン</td>
                            <td className="p-2">
                              <div className="flex flex-wrap gap-1">
                                {selectedKnowledgeData.relatedEvidencePattern.split(", ").map((pattern, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {pattern}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <Separator />

                  {/* Variables */}
                  {selectedKnowledgeData.variables.length > 0 && (
                    <>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-2">利用可能変数</h3>
                        <div className="bg-slate-50 border rounded p-3">
                          <div className="grid grid-cols-2 gap-2">
                            {selectedKnowledgeData.variables.map((variable, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-white border rounded px-2 py-1">
                                <code className="text-xs text-slate-900">{variable}</code>
                                <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <Separator />
                    </>
                  )}

                  {/* Template Body */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">テンプレート本文</h3>
                    <div className="bg-slate-50 border rounded p-3">
                      <pre className="text-xs text-slate-900 whitespace-pre-wrap font-mono leading-relaxed">
{selectedKnowledgeData.body}
                      </pre>
                    </div>
                  </div>

                  <Separator />

                  {/* Example Output */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">出力例</h3>
                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                      <pre className="text-xs text-slate-900 whitespace-pre-wrap leading-relaxed">
{selectedKnowledgeData.exampleOutput}
                      </pre>
                    </div>
                  </div>

                  <Separator />

                  {/* Tags */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-1">
                      {selectedKnowledgeData.tags.map((tag, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Actions */}
                  <div className="space-y-2">
                    <Button className="w-full text-xs">
                      <Copy className="w-3 h-3 mr-1" />
                      テンプレートを適用
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="text-xs">
                        <Edit3 className="w-3 h-3 mr-1" />
                        編集
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs">
                        <Eye className="w-3 h-3 mr-1" />
                        プレビュー
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="text-xs">
                        <History className="w-3 h-3 mr-1" />
                        使用履歴
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs">
                        <LinkIcon className="w-3 h-3 mr-1" />
                        関連Action
                      </Button>
                    </div>
                    {selectedKnowledgeData.status === "draft" && (
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        <Send className="w-3 h-3 mr-1" />
                        レビュー依頼
                      </Button>
                    )}
                  </div>

                  {/* Usage Info */}
                  <div className="bg-slate-50 border rounded p-3">
                    <div className="text-xs text-slate-700">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">総使用回数:</span>
                        <span className="font-bold text-slate-900">{selectedKnowledgeData.usageCount}回</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">最終使用:</span>
                        <span>2026-03-10 14:30</span>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Knowledge Modal */}
      <CreateKnowledgeModal open={showCreateModal} onOpenChange={setShowCreateModal} />
    </div>
  );
}