import { useState } from "react";
import { Link } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { EvidenceLogs } from "../components/support/evidence-logs";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  MessageSquare,
  AlertCircle,
  Clock,
  TrendingUp,
  ArrowRight,
  Ticket,
  AlertTriangle,
  Zap,
  Target,
  Building,
  Lightbulb,
  BookOpen,
  Send,
  Eye,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  Users,
  Flame,
} from "lucide-react";

// Mock data for Alerts
const urgentAlerts = [
  {
    id: "alert_1",
    type: "urgent",
    title: "高priority案件が8時間以上未対応",
    count: 3,
    severity: "critical",
    cases: [
      { 
        id: "inq_1", 
        title: "API連携時のタイムアウトについて", 
        company: "株式会社テクノロジーイノベーション", 
        companyId: "1", 
        elapsed: "8h 34m", 
        priority: "high",
        user: "田中太郎",
        createdAt: "2024-03-17 01:30",
        lastUpdated: "2024-03-17 02:15",
      },
      { 
        id: "sup_3", 
        title: "本番環境でのデータ消失", 
        company: "グローバルソリューションズ", 
        companyId: "2", 
        elapsed: "12h 15m", 
        priority: "critical",
        user: "山田花子",
        createdAt: "2024-03-16 21:50",
        lastUpdated: "2024-03-16 22:30",
      },
      { 
        id: "inq_5", 
        title: "ログイン不可の緊急対応依頼", 
        company: "クラウドインフラサービス", 
        companyId: "5", 
        elapsed: "9h 20m", 
        priority: "high",
        user: "佐藤健",
        createdAt: "2024-03-17 00:45",
        lastUpdated: "2024-03-17 01:10",
      },
    ],
    suggestedAction: "即座にCSMまたはSupportにアサインし、初回応答を実施してください",
    evidence: "過去の類似案件では、12時間超過すると顧客満足度が著しく低下します",
    evidenceLogs: [
      {
        type: "intercom",
        timestamp: "2024-03-17 01:30",
        user: "田中太郎",
        company: "株式会社テクノロジーイノベーション",
        content: "API連携処理を実行すると、タイムアウトエラー（504 Gateway Timeout）が発生します。本番環境で顧客データの取り込みができず業務が止まっています。至急対応をお願いします。",
        channel: "Intercom",
        caseId: "inq_1",
      },
      {
        type: "intercom",
        timestamp: "2024-03-16 21:50",
        user: "山田花子",
        company: "グローバルソリューションズ",
        content: "本番環境で昨日作成したレポートデータが消失しています。バックアップからの復旧が必要です。緊急で対応いただけますでしょうか。",
        channel: "Intercom",
        caseId: "sup_3",
      },
      {
        type: "slack",
        timestamp: "2024-03-16 22:30",
        user: "Support Team (内部)",
        company: "グローバルソリューションズ",
        content: "グローバルソリューションズ様のデータ消失案件、エンジニアリングチームにエスカレーションが必要です。顧客は本番運用中のため、最優先対応をお願いします。",
        channel: "Slack (#cs-escalation)",
        caseId: "sup_3",
      },
      {
        type: "intercom",
        timestamp: "2024-03-17 00:45",
        user: "佐藤健",
        company: "クラウドインフラサービス",
        content: "管理画面にログインしようとすると「認証エラー」が表示されログインできません。複数メンバーで同じ症状が出ています。至急確認をお願いします。",
        channel: "Intercom",
        caseId: "inq_5",
      },
    ],
    statisticalEvidence: {
      similarCasesLast30Days: 12,
      avgResolutionTimeWhenDelayed: "28.5h",
      csatDropRate: "-45%",
      escalationRate: "67%",
    },
  },
  {
    id: "alert_2",
    type: "escalation",
    title: "CSE待機が48時間を超過",
    count: 2,
    severity: "high",
    cases: [
      { 
        id: "cse_1", 
        title: "[CSE-1234] データ同期エラーの調査", 
        company: "クラウドインフラサービス", 
        companyId: "5", 
        cseTicket: "CSE-1234", 
        waitingTime: "52h", 
        priority: "high",
        user: "鈴木一郎",
        createdAt: "2024-03-14 18:00",
        lastCseUpdate: "2024-03-15 10:30",
      },
      { 
        id: "cse_2", 
        title: "[CSE-1256] パフォーマンス劣化の調査", 
        company: "グローバルソリューションズ", 
        companyId: "2", 
        cseTicket: "CSE-1256", 
        waitingTime: "72h", 
        priority: "medium",
        user: "高橋美咲",
        createdAt: "2024-03-14 10:00",
        lastCseUpdate: "2024-03-14 16:45",
      },
    ],
    suggestedAction: "CSE Ticketの進捗確認と、顧客への中間報告をOutboundで準備してください",
    evidence: "待機時間が長期化すると、顧客からのエスカレーション率が上昇します",
    evidenceLogs: [
      {
        type: "intercom",
        timestamp: "2024-03-14 18:00",
        user: "鈴木一郎",
        company: "クラウドインフラサービス",
        content: "データ同期処理が1時間以上経過しても完了しません。エラーログには「Sync failed: timeout」と表示されています。エンジニアリングチームでの調査をお願いできますでしょうか。",
        channel: "Intercom",
        caseId: "cse_1",
      },
      {
        type: "cse_ticket",
        timestamp: "2024-03-14 19:15",
        user: "CSMチーム → エンジニアリングチーム",
        company: "クラウドインフラサービス",
        content: "CSE-1234 起票: データ同期タイムアウトの原因調査。影響範囲: 本番環境、優先度: High。再現手順と環境情報を添付しました。",
        channel: "CSE Ticket",
        caseId: "cse_1",
      },
      {
        type: "cse_ticket",
        timestamp: "2024-03-15 10:30",
        user: "エンジニアリングチーム",
        company: "クラウドインフラサービス",
        content: "CSE-1234 更新: ログ調査中。データベース側のクエリパフォーマンス問題の可能性。詳細調査に2-3営業日必要。",
        channel: "CSE Ticket",
        caseId: "cse_1",
      },
      {
        type: "intercom",
        timestamp: "2024-03-16 14:20",
        user: "鈴木一郎",
        company: "クラウドインフラサービス",
        content: "起票いただいた件、その後の進捗はいかがでしょうか。現在も同じエラーが継続しており、顧客からの問い合わせも増えています。",
        channel: "Intercom",
        caseId: "cse_1",
      },
      {
        type: "intercom",
        timestamp: "2024-03-14 10:00",
        user: "高橋美咲",
        company: "グローバルソリューションズ",
        content: "ダッシュボードの読み込みが非常に遅く、レポート表示に30秒以上かかります。先週までは数秒で表示されていました。パフォーマンス調査をお願いします。",
        channel: "Intercom",
        caseId: "cse_2",
      },
      {
        type: "cse_ticket",
        timestamp: "2024-03-14 11:30",
        user: "CSMチーム → エンジニアリングチーム",
        company: "グローバルソリューションズ",
        content: "CSE-1256 起票: ダッシュボードパフォーマンス劣化。影響範囲: 特定顧客環境、優先度: Medium。パフォーマンスログを添付。",
        channel: "CSE Ticket",
        caseId: "cse_2",
      },
      {
        type: "cse_ticket",
        timestamp: "2024-03-14 16:45",
        user: "エンジニアリングチーム",
        company: "グローバルソリューションズ",
        content: "CSE-1256 更新: 初期調査完了。データ量増加によるクエリパフォーマンス低下を確認。最適化パッチの検討中。",
        channel: "CSE Ticket",
        caseId: "cse_2",
      },
    ],
    statisticalEvidence: {
      avgWaitingTimeBeforeEscalation: "48h",
      escalationRateAfter48h: "78%",
      csatImpact: "-32%",
    },
  },
];

const riskAlerts = [
  {
    id: "risk_1",
    type: "volume_spike",
    title: "クラウドインフラサービスのサポート件数が42%急増",
    company: "クラウドインフラサービス",
    companyId: "5",
    severity: "high",
    metric: "+42% (過去7日間)",
    trend: "increasing",
    evidence: {
      summary: "先週比で18件増加。API連携とパフォーマンス関連の問い合わせが集中しています",
      relatedIssues: ["API連携エラー (8件)", "パフォーマンス劣化 (6件)", "データ同期遅延 (4件)"],
      linkedTickets: ["CSE-1234", "CSE-1245"],
    },
    suggestedActions: [
      { type: "proactive", label: "ヘルスチェックMTGを設定", cta: "Action作成" },
      { type: "content", label: "API連携トラブルシューティングガイドを送付", cta: "Content作成" },
      { type: "escalation", label: "CSE状況確認とロードマップ共有", cta: "Outbound準備" },
    ],
  },
  {
    id: "risk_2",
    type: "recurring_issue",
    title: "「レポートエクスポート時のデータ欠損」が23件発生",
    severity: "medium",
    metric: "23件 (8社に影響)",
    trend: "increasing",
    evidence: {
      summary: "同一issueが繰り返し発生。解決パターンは確立していますが、根本対策が必要です",
      relatedIssues: ["データ同期タイング問題", "キャッシュクリア対応", "ブラウザ依存の不具合"],
      avgResolutionTime: "14.2h",
    },
    suggestedActions: [
      { type: "faq", label: "FAQ/Help化して自己解決を促進", cta: "FAQ Draft作成" },
      { type: "product", label: "Product改善として起票", cta: "Product Feedback" },
      { type: "proactive", label: "影響顧客に事前案内を送付", cta: "Outbound準備" },
    ],
  },
  {
    id: "risk_3",
    type: "unresolved_aging",
    title: "未解決案件が14日以上継続中",
    count: 5,
    severity: "medium",
    metric: "5件 (3社に影響)",
    evidence: {
      summary: "長期未解決案件は顧客体験を著しく低下させます。定期フォローアップが必要です",
      cases: [
        { id: "sup_7", title: "カスタムフィールド設定の問い合わせ", company: "デジタルマーケティング", days: 18 },
        { id: "sup_9", title: "権限設定の仕様確認", company: "エンタープライズソフトウェア", days: 21 },
        { id: "sup_12", title: "レポート定期配信の設定支援", company: "株式会社テクノロジーイノベーション", days: 16 },
      ],
    },
    suggestedActions: [
      { type: "follow_up", label: "顧客にフォローアップを送付", cta: "Outbound準備" },
      { type: "reassign", label: "担当者を再アサインして進捗確認", cta: "Reassign" },
    ],
  },
];

const opportunityAlerts = [
  {
    id: "opp_1",
    type: "expansion",
    title: "グローバルソリューションズが高度な機能への興味を示している",
    company: "グローバルソリューションズ",
    companyId: "2",
    impact: "high",
    evidence: "現在Basic Planを利用中。Advanced Analytics機能について3回問い合わせがあり、導入企業の事例を知りたいとのこと。利用拡大のチャンスです。",
    evidenceLog: {
      type: "intercom",
      timestamp: "2024-03-16 15:30",
      user: "山田花子",
      company: "グローバルソリューションズ",
      content: "Advanced Analytics機能について詳しく教えていただけますでしょうか。現在Basic Planを利用していますが、データ分析の高度化を検討しており、既に導入されている企業様の活用事例があれば知りたいです。特にカスタムダッシュボード機能とAIレコメンデーション機能に興味があります。",
      channel: "Intercom",
      caseId: "inq_8",
    },
    suggestedActions: [
      { type: "content", label: "Advanced Analytics導入事例を送付" },
      { type: "action", label: "機能デモMTGを設定" },
      { type: "outbound", label: "アップグレード提案を準備" },
    ],
  },
  {
    id: "opp_2",
    type: "upsell",
    title: "株式会社テクノロジーイノベーションがプラン上限に到達",
    company: "株式会社テクノロジーイノベーション",
    companyId: "1",
    impact: "high",
    evidence: "現在Standard Plan（ユーザー数上限50名）を利用中。利用ユーザー数が48名に達しており、追加メンバーの招待について問い合わせがありました。Enterprise Planへのアップセル好機です。",
    evidenceLog: {
      type: "intercom",
      timestamp: "2024-03-17 10:15",
      user: "田中太郎",
      company: "株式会社テクノロジーイノベーション",
      content: "新しいメンバーを追加したいのですが、「ユーザー数上限に近づいています」という警告が表示されました。現在の契約プランでユーザー数を増やすことはできますか？それとも上位プランへの変更が必要でしょうか？今後も組織拡大予定のため、柔軟に対応できる方法を教えてください。",
      channel: "Intercom",
      caseId: "inq_9",
    },
    suggestedActions: [
      { type: "content", label: "Enterprise Planの機能比較表を送付" },
      { type: "action", label: "プランアップグレード相談MTGを設定" },
      { type: "outbound", label: "特別価格の提案を準備" },
    ],
  },
  {
    id: "opp_3",
    type: "cross_sell",
    title: "デジタルマーケティングが関連製品に興味を示している",
    company: "デジタルマーケティング",
    companyId: "3",
    impact: "medium",
    evidence: "現在CXM基盤のみ利用中。MA（Marketing Automation）ツールとの連携について質問があり、シームレスな統合に関心を持っています。クロスセルの機会です。",
    evidenceLog: {
      type: "intercom",
      timestamp: "2024-03-15 14:20",
      user: "佐藤美香",
      company: "デジタルマーケティング",
      content: "現在御社のCXM基盤を利用していますが、マーケティングオートメーションツールとの連携は可能でしょうか？HubSpotやMarketoとの統合実績があれば教えてください。また、御社でMAツールも提供されている場合、CXMとの統合がスムーズだと思うのですが、詳細を知りたいです。",
      channel: "Intercom",
      caseId: "inq_10",
    },
    suggestedActions: [
      { type: "content", label: "MA連携ソリューションの資料を送付" },
      { type: "action", label: "統合デモMTGを設定" },
      { type: "outbound", label: "バンドル提案を準備" },
    ],
  },
];

const aiSuggestions = [
  {
    id: "ai_1",
    category: "Content Suggestion",
    title: "「API連携トラブルシューティングガイド」Content作成を推奨",
    impact: "high",
    reason: "API連携関連の問い合わせが月間45件。詳細ガイドにより初回応答時間を大幅短縮できます",
    evidence: {
      relatedCases: 45,
      avgResolutionTime: "22.5h",
      improvementEstimate: "初回応答時間を50%短縮、解決時間を30%短縮見込み",
    },
    suggestedAction: "Content作成",
  },
  {
    id: "ai_2",
    category: "Action Suggestion",
    title: "株式会社テクノロジーイノベーションに週次進捗MTGを提案",
    impact: "medium",
    reason: "CSE Ticket 5件が継続中。定期的な進捗共有で顧客不安を解消できます",
    evidence: {
      linkedTickets: ["CSE-1234", "CSE-1245", "CSE-1267", "CSE-1289", "CSE-1301"],
      oldestTicketAge: "28日",
      customerSentiment: "不安・懸念が複数ログに出現",
    },
    suggestedAction: "Action作成",
  },
  {
    id: "ai_3",
    category: "Outbound Suggestion",
    title: "CSE Ticket長期化案件に中間報告を送付",
    impact: "high",
    reason: "待機時間48時間超過の案件が2件。中間報告で顧客満足度低下を防げます",
    evidence: {
      affectedCases: 2,
      avgWaitingTime: "62h",
      escalationRisk: "高",
    },
    suggestedAction: "Outbound準備",
  },
];

// KPI data for collapsed section
const supportSummary = {
  newInquiries: 47,
  openSupport: 124,
  linkedCSETickets: 18,
  avgFirstResponseTime: "2.3h",
  avgResolutionTime: "18.5h",
  avgWaitingOnCSE: "4.8h",
};

const trendData = [
  { date: "3/11", inquiries: 45, support: 118, firstResponse: 2.8, resolution: 22.1 },
  { date: "3/12", inquiries: 52, support: 125, firstResponse: 2.5, resolution: 19.8 },
  { date: "3/13", inquiries: 38, support: 115, firstResponse: 2.1, resolution: 18.2 },
  { date: "3/14", inquiries: 61, support: 132, firstResponse: 2.7, resolution: 20.5 },
  { date: "3/15", inquiries: 49, support: 128, firstResponse: 2.4, resolution: 17.9 },
  { date: "3/16", inquiries: 55, support: 134, firstResponse: 2.2, resolution: 18.8 },
  { date: "3/17", inquiries: 47, support: 124, firstResponse: 2.3, resolution: 18.5 },
];

export function SupportHome() {
  const [showHealthMetrics, setShowHealthMetrics] = useState(false);
  const [showTrendCharts, setShowTrendCharts] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const [volumeGranularity, setVolumeGranularity] = useState<"day" | "week" | "month">("day");
  const [responseTimeGranularity, setResponseTimeGranularity] = useState<"day" | "week" | "month">("day");

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Support Dashboard" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1800px] mx-auto p-6 space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Support</h1>
                <p className="text-sm text-slate-600 mt-1">
                  アラート・AI提案・Evidence確認で今すぐ対応すべき案件を判断
                </p>
              </div>
              <div className="flex gap-2">
                <Link to="/support/queue">
                  <Button variant="outline" size="sm">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Support Queue
                  </Button>
                </Link>
                <Link to="/support/analytics">
                  <Button size="sm">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Analytics
                  </Button>
                </Link>
              </div>
            </div>

            {/* === MAIN SECTION: Urgent Alerts === */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-600" />
                <h2 className="text-lg font-semibold text-slate-900">Urgent Alerts</h2>
                <Badge className="bg-red-600 text-white">{urgentAlerts.reduce((sum, alert) => sum + alert.count, 0)}</Badge>
              </div>

              {urgentAlerts.map((alert) => (
                <Card key={alert.id} className="border-red-200 bg-red-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                          <CardTitle className="text-base text-red-900">{alert.title}</CardTitle>
                          <Badge className={`text-xs ${alert.severity === 'critical' ? 'bg-red-700' : 'bg-red-600'} text-white`}>
                            {alert.severity === 'critical' ? 'Critical' : 'High'}
                          </Badge>
                          <Badge variant="outline" className="text-xs bg-white border-red-300 text-red-700">
                            {alert.count}件
                          </Badge>
                        </div>
                        <CardDescription className="text-red-800">{alert.suggestedAction}</CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedAlert(selectedAlert === alert.id ? null : alert.id)}
                        className="text-red-700 hover:bg-red-100"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Evidence確認
                        {selectedAlert === alert.id ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                      </Button>
                    </div>
                  </CardHeader>

                  {selectedAlert === alert.id && (
                    <CardContent className="border-t border-red-200 pt-4 bg-white">
                      <EvidenceLogs
                        evidence={alert.evidence}
                        evidenceLog={alert.evidenceLogs && alert.evidenceLogs.length > 0 ? alert.evidenceLogs[0] : undefined as any}
                        suggestedActions={[
                          { type: "action", label: "CSMにアサイン"  as any},
                          { type: "escalation", label: "緊急対応を開始" },
                        ] as any}
                        queueLink="/support/queue?filter=urgent"
                      />
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            {/* === MAIN SECTION: Risk Alerts === */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <h2 className="text-lg font-semibold text-slate-900">Risk Alerts</h2>
                <Badge className="bg-orange-600 text-white">{riskAlerts.length}</Badge>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {riskAlerts.map((alert) => (
                  <Card key={alert.id} className="border-orange-200 bg-orange-50">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-5 h-5 text-orange-600" />
                            <CardTitle className="text-base text-orange-900">{alert.title}</CardTitle>
                            <Badge className="bg-orange-600 text-white text-xs">{alert.severity === 'high' ? 'High Risk' : 'Medium Risk'}</Badge>
                            <Badge variant="outline" className="text-xs bg-white border-orange-300 text-orange-700">
                              {alert.metric}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedAlert(selectedAlert === alert.id ? null : alert.id)}
                          className="text-orange-700 hover:bg-orange-100"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Evidence確認
                          {selectedAlert === alert.id ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                        </Button>
                      </div>
                    </CardHeader>

                    {selectedAlert === alert.id && (
                      <CardContent className="border-t border-orange-200 pt-4 bg-white">
                        <div className="space-y-4">
                          <div>
                            <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-blue-600" />
                              AI Summary
                            </div>
                            <p className="text-sm text-slate-700 bg-blue-50 border border-blue-200 rounded p-3">
                              {alert.evidence.summary}
                            </p>
                          </div>

                          <div>
                            <div className="text-xs font-semibold text-slate-700 mb-2">Related Issues</div>
                            <div className="flex flex-wrap gap-2">
                              {alert.evidence.relatedIssues.map((issue, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {issue}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {'cases' in alert.evidence && alert.evidence.cases && (
                            <div>
                              <div className="text-xs font-semibold text-slate-700 mb-2">Affected Cases</div>
                              <div className="space-y-2">
                                {alert.evidence.cases.map((caseItem: any) => (
                                  <div key={caseItem.id} className="flex items-center justify-between p-2 bg-slate-50 border rounded text-sm">
                                    <div>
                                      <Link to={`/support/${caseItem.id}`} className="font-medium text-slate-900 hover:text-blue-600 hover:underline">
                                        {caseItem.title}
                                      </Link>
                                      <div className="text-xs text-slate-600 mt-1">
                                        <span>{caseItem.company}</span>
                                        <span className="mx-2">•</span>
                                        <span className="text-orange-600">{caseItem.days}日間未解決</span>
                                      </div>
                                    </div>
                                    <Link to={`/support/${caseItem.id}`}>
                                      <Button size="sm" variant="outline" className="h-7 text-xs">
                                        詳細
                                        <ArrowRight className="w-3 h-3 ml-1" />
                                      </Button>
                                    </Link>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <div className="text-xs font-semibold text-slate-700 mb-2">Suggested Actions</div>
                            <div className="flex flex-wrap gap-2">
                              {alert.suggestedActions.map((action, idx) => (
                                <Button key={idx} size="sm" variant="outline" className="h-8 text-xs">
                                  {action.type === 'faq' && <BookOpen className="w-3 h-3 mr-1" />}
                                  {action.type === 'content' && <FileText className="w-3 h-3 mr-1" />}
                                  {action.type === 'proactive' && <Zap className="w-3 h-3 mr-1" />}
                                  {action.type === 'escalation' && <Send className="w-3 h-3 mr-1" />}
                                  {action.type === 'product' && <Target className="w-3 h-3 mr-1" />}
                                  {action.type === 'follow_up' && <Send className="w-3 h-3 mr-1" />}
                                  {action.type === 'reassign' && <Users className="w-3 h-3 mr-1" />}
                                  {action.label}
                                </Button>
                              ))}
                            </div>
                          </div>

                          {'companyId' in alert && alert.companyId && (
                            <div className="flex gap-2 pt-2 border-t">
                              <Link to={`/company/${alert.companyId}`}>
                                <Button size="sm" variant="outline">
                                  <Building className="w-4 h-4 mr-2" />
                                  Company詳細
                                </Button>
                              </Link>
                              <Link to={`/support/queue?company=${alert.companyId}`}>
                                <Button size="sm" variant="outline">
                                  <MessageSquare className="w-4 h-4 mr-2" />
                                  Queue確認
                                </Button>
                              </Link>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>

            {/* === MAIN SECTION: Opportunity Alerts === */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-slate-900">Opportunity Alerts</h2>
                <Badge className="bg-green-600 text-white">{opportunityAlerts.length}</Badge>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {opportunityAlerts.map((alert) => (
                  <Card key={alert.id} className="border-green-200 bg-green-50">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="w-5 h-5 text-green-600" />
                            <CardTitle className="text-base text-green-900">{alert.title}</CardTitle>
                            <Badge className="bg-green-600 text-white text-xs">{alert.impact === 'high' ? 'High Impact' : 'Medium Impact'}</Badge>
                            {alert.count && (
                              <Badge variant="outline" className="text-xs bg-white border-green-300 text-green-700">
                                {alert.count}件
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedAlert(selectedAlert === alert.id ? null : alert.id)}
                          className="text-green-700 hover:bg-green-100"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Evidence確認
                          {selectedAlert === alert.id ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                        </Button>
                      </div>
                    </CardHeader>

                    {selectedAlert === alert.id && (
                      <CardContent className="border-t border-green-200 pt-4 bg-white">
                        <EvidenceLogs
                          evidence={alert.evidence}
                          evidenceLog={alert.evidenceLog}
                          suggestedActions={alert.suggestedActions}
                          queueLink={`/company/${alert.companyId}`}
                        />
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>

            {/* === MAIN SECTION: AI Suggestions === */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-slate-900">AI Suggestions</h2>
                <Badge className="bg-blue-600 text-white">{aiSuggestions.length}</Badge>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {aiSuggestions.map((suggestion) => (
                  <Card key={suggestion.id} className="border-blue-200 bg-blue-50">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="w-5 h-5 text-blue-600" />
                            <Badge variant="outline" className="text-xs bg-white border-blue-300 text-blue-700">
                              {suggestion.category}
                            </Badge>
                            <Badge className="bg-blue-600 text-white text-xs">
                              {suggestion.impact === 'high' ? 'High Impact' : 'Medium Impact'}
                            </Badge>
                          </div>
                          <CardTitle className="text-base text-blue-900 mb-1">{suggestion.title}</CardTitle>
                          <CardDescription className="text-blue-800">{suggestion.reason}</CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedAlert(selectedAlert === suggestion.id ? null : suggestion.id)}
                          className="text-blue-700 hover:bg-blue-100"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Evidence確認
                          {selectedAlert === suggestion.id ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                        </Button>
                      </div>
                    </CardHeader>

                    {selectedAlert === suggestion.id && (
                      <CardContent className="border-t border-blue-200 pt-4 bg-white">
                        <div className="space-y-4">
                          <div>
                            <div className="text-xs font-semibold text-slate-700 mb-2">Evidence</div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              {suggestion.evidence.relatedCases !== undefined && (
                                <div className="p-2 bg-slate-50 border rounded">
                                  <div className="text-xs text-slate-600">関連案件</div>
                                  <div className="font-semibold text-slate-900">{suggestion.evidence.relatedCases}件</div>
                                </div>
                              )}
                              {suggestion.evidence.avgResolutionTime && (
                                <div className="p-2 bg-slate-50 border rounded">
                                  <div className="text-xs text-slate-600">平均解決時間</div>
                                  <div className="font-semibold text-slate-900">{suggestion.evidence.avgResolutionTime}</div>
                                </div>
                              )}
                              {suggestion.evidence.improvementEstimate && (
                                <div className="p-2 bg-green-50 border border-green-200 rounded col-span-2">
                                  <div className="text-xs text-green-700 mb-1">改善見込み</div>
                                  <div className="text-sm text-green-800">{suggestion.evidence.improvementEstimate}</div>
                                </div>
                              )}
                              {suggestion.evidence.linkedTickets && (
                                <div className="p-2 bg-slate-50 border rounded col-span-2">
                                  <div className="text-xs text-slate-600 mb-1">Linked CSE Tickets</div>
                                  <div className="flex flex-wrap gap-1">
                                    {suggestion.evidence.linkedTickets.map((ticket: string, idx: number) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        <Ticket className="w-3 h-3 mr-1" />
                                        {ticket}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {suggestion.evidence.oldestTicketAge && (
                                <div className="p-2 bg-amber-50 border border-amber-200 rounded">
                                  <div className="text-xs text-amber-700">最古Ticket</div>
                                  <div className="font-semibold text-amber-900">{suggestion.evidence.oldestTicketAge}</div>
                                </div>
                              )}
                              {suggestion.evidence.customerSentiment && (
                                <div className="p-2 bg-amber-50 border border-amber-200 rounded">
                                  <div className="text-xs text-amber-700">顧客センチメント</div>
                                  <div className="font-semibold text-amber-900">{suggestion.evidence.customerSentiment}</div>
                                </div>
                              )}
                              {suggestion.evidence.affectedCases !== undefined && (
                                <div className="p-2 bg-slate-50 border rounded">
                                  <div className="text-xs text-slate-600">影響案件</div>
                                  <div className="font-semibold text-slate-900">{suggestion.evidence.affectedCases}件</div>
                                </div>
                              )}
                              {suggestion.evidence.avgWaitingTime && (
                                <div className="p-2 bg-red-50 border border-red-200 rounded">
                                  <div className="text-xs text-red-700">平均待機時間</div>
                                  <div className="font-semibold text-red-900">{suggestion.evidence.avgWaitingTime}</div>
                                </div>
                              )}
                              {suggestion.evidence.escalationRisk && (
                                <div className="p-2 bg-red-50 border border-red-200 rounded col-span-2">
                                  <div className="text-xs text-red-700">エスカレーションリスク</div>
                                  <div className="font-semibold text-red-900">{suggestion.evidence.escalationRisk}</div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2 border-t">
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                              {suggestion.suggestedAction === 'Content作成' && <FileText className="w-4 h-4 mr-2" />}
                              {suggestion.suggestedAction === 'Action作成' && <Target className="w-4 h-4 mr-2" />}
                              {suggestion.suggestedAction === 'Outbound準備' && <Send className="w-4 h-4 mr-2" />}
                              {suggestion.suggestedAction}
                            </Button>
                            <Link to="/support/queue">
                              <Button size="sm" variant="outline">
                                <MessageSquare className="w-4 h-4 mr-2" />
                                関連案件を確認
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>

            {/* Health Summary & Trend Charts - Collapsed by Default */}
            <Card className="border-slate-300">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowHealthMetrics(!showHealthMetrics)}>
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-slate-600" />
                    <CardTitle className="text-base text-slate-700">Health Summary</CardTitle>
                    <Badge variant="outline" className="text-xs text-slate-600">サブ指標</Badge>
                  </div>
                  {showHealthMetrics ? <ChevronUp className="w-5 h-5 text-slate-600" /> : <ChevronDown className="w-5 h-5 text-slate-600" />}
                </div>
              </CardHeader>
              {showHealthMetrics && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-6 gap-4">
                    <div className="p-3 bg-slate-50 border rounded">
                      <div className="text-xs text-slate-600">New Inquiries</div>
                      <div className="text-xl font-bold text-blue-600 mt-1">{supportSummary.newInquiries}</div>
                    </div>
                    <div className="p-3 bg-slate-50 border rounded">
                      <div className="text-xs text-slate-600">Open Support</div>
                      <div className="text-xl font-bold text-purple-600 mt-1">{supportSummary.openSupport}</div>
                    </div>
                    <div className="p-3 bg-slate-50 border rounded">
                      <div className="text-xs text-slate-600">Linked CSE Tickets</div>
                      <div className="text-xl font-bold text-amber-600 mt-1">{supportSummary.linkedCSETickets}</div>
                    </div>
                    <div className="p-3 bg-slate-50 border rounded">
                      <div className="text-xs text-slate-600">Avg First Response</div>
                      <div className="text-xl font-bold text-green-600 mt-1">{supportSummary.avgFirstResponseTime}</div>
                    </div>
                    <div className="p-3 bg-slate-50 border rounded">
                      <div className="text-xs text-slate-600">Avg Resolution</div>
                      <div className="text-xl font-bold text-green-600 mt-1">{supportSummary.avgResolutionTime}</div>
                    </div>
                    <div className="p-3 bg-slate-50 border rounded">
                      <div className="text-xs text-slate-600">Avg Waiting on CSE</div>
                      <div className="text-xl font-bold text-amber-600 mt-1">{supportSummary.avgWaitingOnCSE}</div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

          </div>
        </main>
      </div>
    </div>
  );
}