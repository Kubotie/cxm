import { useState } from "react";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { AlertTriangle, TrendingUp, Users, Clock, FileSearch, ExternalLink, ChevronRight, Sparkles, CheckCircle2, XCircle, PauseCircle } from "lucide-react";
import { Link } from "react-router";

// モックデータ
const mockAlerts = [
  {
    id: "alert-1",
    alertType: "risk" as const,
    severity: "high" as const,
    company: "株式会社テクノロジーイノベーション",
    companyId: "1",
    relatedProject: "プロジェクトA",
    phaseLabel: "Setup",
    shortSummary: "オンボーディング遅延の兆候。決裁者の会議欠席が3回連続。",
    evidenceCount: 4,
    generatedAt: "2026-03-10 14:30",
    owner: "佐藤 太郎",
    status: "pending_review" as const,
    scope: "Company",
    sourceType: "minutes",
    confidence: "high" as const,
    missingFields: [],
    aiProposal: "決裁者への個別フォローアップMTGを提案。過去の議事録から、技術的な懸念点が未解決の可能性。",
    relatedEvidence: [
      { id: "ev-1", title: "週次MTG議事録 - 山田氏欠席", date: "2026-03-10" },
      { id: "ev-2", title: "フォローアップメール未返信", date: "2026-03-08" },
      { id: "ev-3", title: "進捗報告MTG - 山田氏欠席", date: "2026-03-05" },
      { id: "ev-4", title: "技術仕様確認依頼 - 未回答", date: "2026-03-03" },
    ],
  },
  {
    id: "alert-2",
    alertType: "opportunity" as const,
    severity: "high" as const,
    company: "グローバルソリューションズ株式会社",
    companyId: "2",
    relatedProject: null,
    phaseLabel: "Engagement",
    shortSummary: "追加ライセンス検討の可能性。営業部長から「他部署での導入も検討したい」との発言。",
    evidenceCount: 2,
    generatedAt: "2026-03-09 16:00",
    owner: "田中 花子",
    status: "pending_review" as const,
    scope: "Company",
    sourceType: "mail",
    confidence: "high" as const,
    missingFields: [],
    aiProposal: "追加ライセンスの提案資料を作成し、営業部長との個別商談を設定することを推奨。",
    relatedEvidence: [
      { id: "ev-5", title: "四半期レビューMTG - 拡大希望", date: "2026-03-09" },
      { id: "ev-6", title: "他部署への紹介依頼メール", date: "2026-03-07" },
    ],
  },
  {
    id: "alert-3",
    alertType: "missing_info" as const,
    severity: "medium" as const,
    company: "エンタープライズシステムズ",
    companyId: "3",
    relatedProject: "プロジェクトB",
    phaseLabel: "Optimization",
    shortSummary: "決裁者情報が不完全。経営層の関与状況が不明。",
    evidenceCount: 3,
    generatedAt: "2026-03-08 11:20",
    owner: "佐藤 太郎",
    status: "unprocessed" as const,
    scope: "Company",
    sourceType: "minutes",
    confidence: "medium" as const,
    missingFields: ["経営層連絡先", "決裁フロー", "予算承認者"],
    aiProposal: "次回MTGで組織図の確認と、決裁フローのヒアリングを実施することを推奨。",
    relatedEvidence: [
      { id: "ev-7", title: "キックオフMTG議事録", date: "2026-03-08" },
      { id: "ev-8", title: "組織図共有依頼メール", date: "2026-03-06" },
      { id: "ev-9", title: "契約書レビュー依頼", date: "2026-03-04" },
    ],
  },
  {
    id: "alert-4",
    alertType: "unprocessed_evidence" as const,
    severity: "low" as const,
    company: "クラウドインフラサービス",
    companyId: "5",
    relatedProject: "プロジェクトC",
    phaseLabel: "Activation",
    shortSummary: "未処理のMTG議事録が3件。内容確認と抽出が必要。",
    evidenceCount: 3,
    generatedAt: "2026-03-07 18:45",
    owner: "田中 花子",
    status: "unprocessed" as const,
    scope: "Project",
    sourceType: "minutes",
    confidence: "high" as const,
    missingFields: [],
    aiProposal: "議事録から人物情報とアクションアイテムを抽出し、次回フォローアップに活用することを推奨。",
    relatedEvidence: [
      { id: "ev-10", title: "技術MTG議事録", date: "2026-03-07" },
      { id: "ev-11", title: "進捗確認MTG議事録", date: "2026-03-05" },
      { id: "ev-12", title: "仕様レビューMTG議事録", date: "2026-03-03" },
    ],
  },
  {
    id: "alert-5",
    alertType: "risk" as const,
    severity: "medium" as const,
    company: "株式会社メディカルテック",
    companyId: "8",
    relatedProject: null,
    phaseLabel: "Setup",
    shortSummary: "サポートチケットの増加傾向。ログインエラーと機能理解不足の兆候。",
    evidenceCount: 5,
    generatedAt: "2026-03-06 10:15",
    owner: "田中 花子",
    status: "in_review" as const,
    scope: "Company",
    sourceType: "support",
    confidence: "medium" as const,
    missingFields: ["トレーニング実施状況"],
    aiProposal: "追加トレーニングセッションの提案と、よくある質問のドキュメント整備を推奨。",
    relatedEvidence: [
      { id: "ev-13", title: "サポートチケット #2847", date: "2026-03-06" },
      { id: "ev-14", title: "サポートチケット #2831", date: "2026-03-05" },
      { id: "ev-15", title: "サポートチケット #2819", date: "2026-03-04" },
      { id: "ev-16", title: "サポートチケット #2805", date: "2026-03-03" },
      { id: "ev-17", title: "トレーニングフィードバック", date: "2026-03-02" },
    ],
  },
];

const alertTypeConfig = {
  risk: { label: "Risk", icon: AlertTriangle, color: "text-red-700 bg-red-50 border-red-200" },
  opportunity: { label: "Opportunity", icon: TrendingUp, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  missing_info: { label: "Missing Info", icon: Users, color: "text-amber-700 bg-amber-50 border-amber-200" },
  unprocessed_evidence: { label: "Unprocessed Evidence", icon: Clock, color: "text-slate-700 bg-slate-50 border-slate-200" },
};

const severityColors = {
  high: "bg-red-500",
  medium: "bg-orange-500",
  low: "bg-slate-400",
};

const statusLabels = {
  unprocessed: "未処理",
  pending_review: "レビュー待ち",
  in_review: "レビュー中",
  closed: "クローズ",
};

const confidenceLabels = {
  high: "高",
  medium: "中",
  low: "低",
};

export function AlertQueue() {
  const [selectedAlert, setSelectedAlert] = useState<string | null>(mockAlerts[0]?.id || null);
  const [alertTypeFilter, setAlertTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const selectedAlertData = mockAlerts.find(a => a.id === selectedAlert);

  // Summary calculations
  const highRiskCount = mockAlerts.filter(a => a.alertType === "risk" && a.severity === "high").length;
  const opportunityCount = mockAlerts.filter(a => a.alertType === "opportunity").length;
  const missingInfoCount = mockAlerts.filter(a => a.alertType === "missing_info").length;
  const unprocessedCount = mockAlerts.filter(a => a.alertType === "unprocessed_evidence").length;
  const pendingReviewCount = mockAlerts.filter(a => a.status === "pending_review").length;

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Cross-scope" />
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Page Header */}
          <div className="bg-white border-b p-4">
            <div className="max-w-[1800px] mx-auto">
              <h1 className="text-xl font-semibold text-slate-900 mb-3">Inbox / Alert Queue</h1>
              
              {/* Queue Summary */}
              <div className="grid grid-cols-5 gap-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-xs text-red-700 font-medium">High Risk</span>
                  </div>
                  <div className="text-xl font-semibold text-red-900">{highRiskCount}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs text-emerald-700 font-medium">Opportunity</span>
                  </div>
                  <div className="text-xl font-semibold text-emerald-900">{opportunityCount}</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-amber-600" />
                    <span className="text-xs text-amber-700 font-medium">Missing Info</span>
                  </div>
                  <div className="text-xl font-semibold text-amber-900">{missingInfoCount}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-slate-600" />
                    <span className="text-xs text-slate-700 font-medium">Unprocessed</span>
                  </div>
                  <div className="text-xl font-semibold text-slate-900">{unprocessedCount}</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <FileSearch className="w-4 h-4 text-blue-600" />
                    <span className="text-xs text-blue-700 font-medium">Pending Review</span>
                  </div>
                  <div className="text-xl font-semibold text-blue-900">{pendingReviewCount}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white border-b p-3">
            <div className="max-w-[1800px] mx-auto">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700">フィルタ:</span>
                <Select value={alertTypeFilter} onValueChange={setAlertTypeFilter}>
                  <SelectTrigger className="w-48 h-8 text-xs">
                    <SelectValue placeholder="Alert Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべてのタイプ</SelectItem>
                    <SelectItem value="risk">Risk</SelectItem>
                    <SelectItem value="opportunity">Opportunity</SelectItem>
                    <SelectItem value="missing_info">Missing Info</SelectItem>
                    <SelectItem value="unprocessed_evidence">Unprocessed Evidence</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="unprocessed">未処理</SelectItem>
                    <SelectItem value="pending_review">レビュー待ち</SelectItem>
                    <SelectItem value="in_review">レビュー中</SelectItem>
                    <SelectItem value="closed">クローズ</SelectItem>
                  </SelectContent>
                </Select>
                <Separator orientation="vertical" className="h-6" />
                <Badge variant="outline" className="text-xs">優先度: 高→低</Badge>
              </div>
            </div>
          </div>

          {/* Main Content: Alert List + Detail Panel */}
          <div className="flex-1 overflow-hidden">
            <div className="max-w-[1800px] mx-auto h-full flex gap-4 p-4">
              {/* Alert List */}
              <div className="w-[600px] flex flex-col bg-white border rounded-lg overflow-hidden">
                <div className="p-3 border-b bg-slate-50">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-slate-900">Alert一覧</h2>
                    <span className="text-xs text-slate-500">{mockAlerts.length}件</span>
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-2">
                    {mockAlerts.map((alert) => {
                      const config = alertTypeConfig[alert.alertType];
                      const Icon = config.icon;
                      const isSelected = selectedAlert === alert.id;

                      return (
                        <div
                          key={alert.id}
                          onClick={() => setSelectedAlert(alert.id)}
                          className={`border rounded-lg p-3 cursor-pointer transition-all ${
                            isSelected
                              ? "border-blue-500 bg-blue-50 shadow-sm"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-1 h-full rounded-full ${severityColors[alert.severity]} flex-shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className={`text-xs ${config.color}`}>
                                  <Icon className="w-3 h-3 mr-1" />
                                  {config.label}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {alert.severity}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {statusLabels[alert.status]}
                                </Badge>
                              </div>
                              <h3 className="text-sm font-semibold text-slate-900 mb-1">
                                {alert.company}
                              </h3>
                              <p className="text-xs text-slate-700 mb-2 line-clamp-2">
                                {alert.shortSummary}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-slate-500">
                                <span>Phase: {alert.phaseLabel}</span>
                                <span>Evidence: {alert.evidenceCount}件</span>
                                <span>{alert.generatedAt}</span>
                              </div>
                            </div>
                            <ChevronRight className={`w-4 h-4 text-slate-400 flex-shrink-0 ${isSelected ? "text-blue-500" : ""}`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Detail Panel */}
              {selectedAlertData && (
                <div className="flex-1 flex flex-col bg-white border rounded-lg overflow-hidden">
                  <div className="p-4 border-b bg-slate-50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={`text-xs ${alertTypeConfig[selectedAlertData.alertType].color}`}>
                            {alertTypeConfig[selectedAlertData.alertType].label}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Severity: {selectedAlertData.severity}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {statusLabels[selectedAlertData.status]}
                          </Badge>
                        </div>
                        <h2 className="text-lg font-semibold text-slate-900 mb-1">
                          {selectedAlertData.company}
                        </h2>
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          <span>Scope: {selectedAlertData.scope}</span>
                          <span>Phase: {selectedAlertData.phaseLabel}</span>
                          {selectedAlertData.relatedProject && (
                            <span>Project: {selectedAlertData.relatedProject}</span>
                          )}
                          <span>担当: {selectedAlertData.owner}</span>
                        </div>
                      </div>
                      <Link to={`/company/${selectedAlertData.companyId}`}>
                        <Button variant="outline" size="sm" className="text-xs">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Company詳細
                        </Button>
                      </Link>
                    </div>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      {/* Alert Summary */}
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-2">Alert概要</h3>
                        <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded border">
                          {selectedAlertData.shortSummary}
                        </p>
                      </div>

                      <Separator />

                      {/* AI Proposal */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4 text-blue-600" />
                          <h3 className="text-sm font-semibold text-slate-900">AI提案</h3>
                          <Badge variant="outline" className="text-xs">
                            信頼度: {confidenceLabels[selectedAlertData.confidence]}
                          </Badge>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded p-3">
                          <p className="text-sm text-blue-900">{selectedAlertData.aiProposal}</p>
                        </div>
                        {selectedAlertData.missingFields.length > 0 && (
                          <div className="mt-2 bg-amber-50 border border-amber-200 rounded p-3">
                            <p className="text-xs font-semibold text-amber-900 mb-1">Missing Fields:</p>
                            <div className="flex flex-wrap gap-1">
                              {selectedAlertData.missingFields.map((field, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs bg-white">
                                  {field}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* Related Evidence */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-slate-900">
                            関連Evidence ({selectedAlertData.evidenceCount}件)
                          </h3>
                          <Button variant="outline" size="sm" className="text-xs h-7">
                            <FileSearch className="w-3 h-3 mr-1" />
                            すべて表示
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {selectedAlertData.relatedEvidence.map((evidence) => (
                            <div key={evidence.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border text-sm">
                              <div className="flex-1">
                                <div className="text-slate-900 font-medium text-xs mb-0.5">{evidence.title}</div>
                                <div className="text-slate-500 text-xs">{evidence.date}</div>
                              </div>
                              <Button variant="ghost" size="sm" className="text-xs h-6">
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      {/* Recommended Actions */}
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-2">推奨アクション</h3>
                        <div className="bg-slate-50 border rounded p-3">
                          <ul className="text-sm text-slate-700 space-y-1">
                            <li>• Evidenceの詳細を確認する</li>
                            <li>• レビューして次のアクションを決定する</li>
                            <li>• 必要に応じてAction Cardを作成する</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>

                  {/* Action Buttons */}
                  <div className="p-4 border-t bg-slate-50">
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="flex-1 text-xs">
                        <FileSearch className="w-3 h-3 mr-1" />
                        Evidenceを見る
                      </Button>
                      <Button size="sm" className="flex-1 text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        レビューへ
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Button size="sm" variant="outline" className="flex-1 text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Actionを作成
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs">
                        <PauseCircle className="w-3 h-3 mr-1" />
                        保留
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs">
                        <XCircle className="w-3 h-3 mr-1" />
                        クローズ
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}