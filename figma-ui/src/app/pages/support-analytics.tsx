import { useState } from "react";
import { Link } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Ticket,
  Clock,
  AlertCircle,
  Users,
  FileText,
  Lightbulb,
  Target,
  Zap,
  BookOpen,
  Send,
} from "lucide-react";

// Mock data
const inquiryVolumeTrend = [
  { date: "2/25", count: 42 },
  { date: "2/26", count: 45 },
  { date: "2/27", count: 38 },
  { date: "2/28", count: 51 },
  { date: "2/29", count: 48 },
  { date: "3/1", count: 55 },
  { date: "3/2", count: 49 },
  { date: "3/3", count: 52 },
  { date: "3/4", count: 47 },
  { date: "3/5", count: 58 },
  { date: "3/6", count: 53 },
  { date: "3/7", count: 60 },
  { date: "3/8", count: 56 },
  { date: "3/9", count: 51 },
];

const inquiryRoutingDistribution = [
  { name: "CSM", value: 342, color: "#3b82f6" },
  { name: "Support", value: 218, color: "#8b5cf6" },
  { name: "CSE", value: 87, color: "#f59e0b" },
  { name: "Unassigned", value: 45, color: "#64748b" },
];

const supportVolumeByCategory = [
  { category: "機能の使い方", count: 156 },
  { category: "API連携", count: 98 },
  { category: "パフォーマンス", count: 76 },
  { category: "データ同期", count: 68 },
  { category: "権限・アクセス", count: 54 },
  { category: "レポート", count: 48 },
  { category: "その他", count: 92 },
];

const responseTimeTrend = [
  { date: "2/25", firstResponse: 2.8, resolution: 22.3 },
  { date: "2/26", firstResponse: 2.5, resolution: 20.1 },
  { date: "2/27", firstResponse: 2.7, resolution: 21.5 },
  { date: "2/28", firstResponse: 2.3, resolution: 19.2 },
  { date: "2/29", firstResponse: 2.6, resolution: 20.8 },
  { date: "3/1", firstResponse: 2.4, resolution: 18.5 },
  { date: "3/2", firstResponse: 2.2, resolution: 17.9 },
  { date: "3/3", firstResponse: 2.5, resolution: 19.6 },
  { date: "3/4", firstResponse: 2.1, resolution: 18.2 },
  { date: "3/5", firstResponse: 2.4, resolution: 19.1 },
  { date: "3/6", firstResponse: 2.3, resolution: 18.8 },
  { date: "3/7", firstResponse: 2.2, resolution: 18.3 },
];

const cseTicketTrend = [
  { date: "2/25", newTickets: 12, resolved: 8, aging: 18 },
  { date: "2/26", newTickets: 10, resolved: 11, aging: 17 },
  { date: "2/27", newTickets: 15, resolved: 9, aging: 23 },
  { date: "2/28", newTickets: 8, resolved: 12, aging: 19 },
  { date: "2/29", newTickets: 14, resolved: 10, aging: 23 },
  { date: "3/1", newTickets: 11, resolved: 13, aging: 21 },
  { date: "3/2", newTickets: 9, resolved: 11, aging: 19 },
  { date: "3/3", newTickets: 13, resolved: 8, aging: 24 },
  { date: "3/4", newTickets: 7, resolved: 14, aging: 17 },
  { date: "3/5", newTickets: 12, resolved: 9, aging: 20 },
  { date: "3/6", newTickets: 10, resolved: 12, aging: 18 },
  { date: "3/7", newTickets: 11, resolved: 10, aging: 19 },
];

const topCompaniesBySupport = [
  { id: "1", name: "株式会社テクノロジーイノベーション", supportVolume: 78, inquiries: 18, cseTickets: 5, trend: "+23%" },
  { id: "2", name: "グローバルソリューションズ株式会社", supportVolume: 64, inquiries: 14, cseTickets: 3, trend: "+15%" },
  { id: "5", name: "クラウドインフラサービス", supportVolume: 52, inquiries: 11, cseTickets: 7, trend: "+42%" },
  { id: "3", name: "デジタルマーケティング株式会社", supportVolume: 48, inquiries: 12, cseTickets: 2, trend: "+8%" },
  { id: "4", name: "エンタープライズソフトウェア", supportVolume: 41, inquiries: 9, cseTickets: 3, trend: "-5%" },
];

const recurringIssues = [
  { 
    issue: "レポートエクスポート時のデータ欠損",
    occurrences: 23,
    affectedCompanies: 8,
    avgResolutionTime: "14.2h",
    faqCandidate: true,
    productIssue: true,
  },
  { 
    issue: "API連携時のタイムアウトエラー",
    occurrences: 18,
    affectedCompanies: 12,
    avgResolutionTime: "22.5h",
    faqCandidate: true,
    productIssue: true,
  },
  { 
    issue: "ユーザー招待メールの遅延",
    occurrences: 15,
    affectedCompanies: 10,
    avgResolutionTime: "8.3h",
    faqCandidate: true,
    productIssue: false,
  },
  { 
    issue: "権限設定の反映遅延",
    occurrences: 12,
    affectedCompanies: 7,
    avgResolutionTime: "11.7h",
    faqCandidate: false,
    productIssue: true,
  },
];

const aiInsights = [
  {
    category: "FAQ化候補",
    items: [
      "「レポートエクスポート時のデータ欠損」は23件発生。FAQ/Help化を推奨",
      "「API連携時のタイムアウト」は解決パターンが確立。Helpガイド作成を推奨",
    ],
  },
  {
    category: "Proactive Support必要顧客",
    items: [
      "クラウドインフラサービス: サポート件数が42%増加。ヘルスチェックMTG推奨",
      "株式会社テクノロジーイノベーション: CSE Ticket 5件継続中。エスカレーション状況確認推奨",
    ],
  },
  {
    category: "Product改善候補",
    items: [
      "レポート機能: データ同期のタイミング調整が必要",
      "API連携: タイムアウト設定の見直しが必要",
      "権限管理: 反映の即時性向上が必要",
    ],
  },
  {
    category: "Event/Content提案",
    items: [
      "「レポート活用ベストプラクティス」Webinar開催を推奨",
      "「API連携トラブルシューティングガイド」Content作成を推奨",
    ],
  },
];

export function SupportAnalytics() {
  const [timeRange, setTimeRange] = useState("14days");
  const [volumeGranularity, setVolumeGranularity] = useState<"day" | "week" | "month">("day");
  const [responseTimeGranularity, setResponseTimeGranularity] = useState<"day" | "week" | "month">("day");
  const [cseTicketGranularity, setCSETicketGranularity] = useState<"day" | "week" | "month">("day");

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Support Analytics" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1800px] mx-auto p-6 space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Support Analytics</h1>
                <p className="text-sm text-slate-600 mt-1">
                  問い合わせ・サポート・CSE連携の傾向分析と改善提案
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7days">過去7日間</SelectItem>
                    <SelectItem value="14days">過去14日間</SelectItem>
                    <SelectItem value="30days">過去30日間</SelectItem>
                    <SelectItem value="90days">過去90日間</SelectItem>
                  </SelectContent>
                </Select>
                <Link to="/support/queue">
                  <Button variant="outline" size="sm">
                    Support Queue
                  </Button>
                </Link>
              </div>
            </div>

            {/* Inquiry 観点 */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Inquiry 観点
              </h2>
              <div className="grid grid-cols-2 gap-6">
                {/* Inquiry Volume Trend with Granularity Switcher */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">Inquiry Volume Trend</CardTitle>
                        <CardDescription>新規問い合わせ件数の推移</CardDescription>
                      </div>
                      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                        <button
                          onClick={() => setVolumeGranularity("day")}
                          className={`px-3 py-1 text-xs rounded transition-colors ${
                            volumeGranularity === "day"
                              ? "bg-white text-slate-900 shadow-sm font-medium"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Day
                        </button>
                        <button
                          onClick={() => setVolumeGranularity("week")}
                          className={`px-3 py-1 text-xs rounded transition-colors ${
                            volumeGranularity === "week"
                              ? "bg-white text-slate-900 shadow-sm font-medium"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Week
                        </button>
                        <button
                          onClick={() => setVolumeGranularity("month")}
                          className={`px-3 py-1 text-xs rounded transition-colors ${
                            volumeGranularity === "month"
                              ? "bg-white text-slate-900 shadow-sm font-medium"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Month
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={inquiryVolumeTrend} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} width={35} />
                        <Tooltip contentStyle={{ fontSize: '12px' }} />
                        <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} name="Inquiries" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Inquiry Routing Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Inquiry Routing Distribution</CardTitle>
                    <CardDescription>問い合わせの振り分け先比率</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={inquiryRoutingDistribution}
                          cx="50%"
                          cy="45%"
                          labelLine={false}
                          label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                          outerRadius={70}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {inquiryRoutingDistribution.map((entry, index) => (
                            <Cell key={`routing-${entry.name}-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `${value.toLocaleString()} cases`} />
                        <Legend 
                          verticalAlign="bottom" 
                          height={40}
                          wrapperStyle={{ fontSize: '11px', lineHeight: '1.4' }}
                          formatter={(value, entry: any) => `${value}:${entry.payload.value.toLocaleString()}`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Support 観点 */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Support 観点
              </h2>
              <div className="grid grid-cols-2 gap-6">
                {/* Response Time Trend */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Response Time Trend</CardTitle>
                    <CardDescription>初回応答時間と解決時間の推移（時間）</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={responseTimeTrend} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} width={35} />
                        <Tooltip contentStyle={{ fontSize: '12px' }} formatter={(value: number) => `${value}h`} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="firstResponse" stroke="#10b981" strokeWidth={2} name="First Response" />
                        <Line type="monotone" dataKey="resolution" stroke="#f59e0b" strokeWidth={2} name="Resolution" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Support Volume by Category */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Support Volume by Category</CardTitle>
                    <CardDescription>カテゴリ別のサポート件数</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={supportVolumeByCategory} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 11 }} width={35} />
                        <Tooltip contentStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* CSE Ticket 観点 */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Ticket className="w-5 h-5" />
                CSE Ticket 観点
              </h2>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">CSE Ticket Trend</CardTitle>
                  <CardDescription>CSE Ticketの起票・解決・エイジング推移</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={cseTicketTrend} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} width={35} />
                      <Tooltip contentStyle={{ fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Line type="monotone" dataKey="newTickets" stroke="#f59e0b" strokeWidth={2} name="New Tickets" />
                      <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} name="Resolved" />
                      <Line type="monotone" dataKey="aging" stroke="#ef4444" strokeWidth={2} name="Aging" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Top Companies by Support Volume */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Companies by Support Volume</CardTitle>
                <CardDescription>サポート件数が多い顧客（過去14日間）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topCompaniesBySupport.map((company) => (
                    <div key={company.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                      <Link 
                        to={`/company/${company.id}`}
                        className="flex-1 hover:text-blue-600 hover:underline"
                      >
                        <div className="font-medium text-slate-900">{company.name}</div>
                      </Link>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-purple-500" />
                          <span className="text-slate-600">Support:</span>
                          <span className="font-semibold text-slate-900">{company.supportVolume}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-blue-500" />
                          <span className="text-slate-600">Inquiry:</span>
                          <span className="font-semibold text-slate-900">{company.inquiries}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Ticket className="w-4 h-4 text-amber-500" />
                          <span className="text-slate-600">CSE:</span>
                          <span className="font-semibold text-slate-900">{company.cseTickets}</span>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${company.trend.startsWith('+') ? 'text-red-700 bg-red-50 border-red-200' : 'text-green-700 bg-green-50 border-green-200'}`}
                        >
                          {company.trend.startsWith('+') ? <TrendingUp className="w-3 h-3 mr-1 inline" /> : <TrendingDown className="w-3 h-3 mr-1 inline" />}
                          {company.trend}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recurring Issues */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recurring Issues</CardTitle>
                <CardDescription>繰り返し発生している課題</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recurringIssues.map((issue, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border">
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium text-slate-900">{issue.issue}</div>
                        <div className="flex gap-2">
                          {issue.faqCandidate && (
                            <Badge className="bg-blue-600 text-white text-xs">
                              <BookOpen className="w-3 h-3 mr-1" />
                              FAQ候補
                            </Badge>
                          )}
                          {issue.productIssue && (
                            <Badge className="bg-amber-600 text-white text-xs">
                              <Target className="w-3 h-3 mr-1" />
                              Product改善
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-slate-600">
                        <div>発生件数: <span className="font-semibold text-slate-900">{issue.occurrences}</span></div>
                        <div>影響顧客: <span className="font-semibold text-slate-900">{issue.affectedCompanies}社</span></div>
                        <div>平均解決時間: <span className="font-semibold text-slate-900">{issue.avgResolutionTime}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* AI Insights */}
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-blue-600" />
                  AI Insights & Recommendations
                </CardTitle>
                <CardDescription>AIによる分析結果と改善提案</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {aiInsights.map((insight, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-4 border border-blue-200">
                      <div className="text-sm font-semibold text-blue-900 mb-2">{insight.category}</div>
                      <ul className="space-y-2">
                        {insight.items.map((item, itemIdx) => (
                          <li key={itemIdx} className="text-sm text-slate-700 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>
        </main>
      </div>
    </div>
  );
}