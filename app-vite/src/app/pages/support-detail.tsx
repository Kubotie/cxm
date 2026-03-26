import { useState } from "react";
import { Link, useParams } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  ArrowLeft,
  Ticket,
  CheckCircle2,
  Building,
  FileText,
  ArrowRight,
  Send,
  Play,
  BookOpen,
  Lightbulb,
} from "lucide-react";

// ── Mock data ────────────────────────────────────────────────────────────────

const CASE_DETAIL = {
  id: "sup_1",
  title: "レポート出力時のデータ欠損",
  caseType: "Support",
  source: "Slack",
  company: "グローバルソリューションズ株式会社",
  companyId: "2",
  project: "プロジェクトB",
  projectId: "proj_2",
  owner: "Support Team",
  assignedTeam: "Support",
  routingStatus: "in progress",
  sourceStatus: null,
  severity: "medium",
  createdAt: "2026-03-17 13:45",
  firstResponseTime: "0h 45m",
  openDuration: "3h 32m",
  waitingDuration: null,
  linkedCSETicket: null,
  relatedContent: 2,
  originalMessage: `お世話になっております。

レポート機能について質問させてください。

先週から、月次レポートをエクスポートする際に、
一部のプロジェクトデータが欠損している状態が続いています。

具体的には、
- 2026年2月のプロジェクトA、Cのデータが表示されない
- 3月1日以降は正常に表示される
- フィルタを変更しても同じ状況

原因と対処方法を教えていただけますでしょうか。

よろしくお願いいたします。`,
  triageNote: "データ同期の問題の可能性あり。Support Team で初期調査を実施。CSE連携が必要か判断中。",
  firstResponse: `ご連絡ありがとうございます。Support Teamの佐藤です。

レポート出力時のデータ欠損の件、承知いたしました。
初期調査を開始いたしますので、以下の情報をご共有いただけますでしょうか。

1. レポートの種類（月次、週次、カスタムなど）
2. エクスポート形式（CSV、Excel、PDFなど）
3. 使用しているブラウザとバージョン

また、同じ条件で他のプロジェクトのデータは正常に表示されますでしょうか。

ご確認をお願いいたします。`,
  routingHistory: [
    { timestamp: "2026-03-17 13:45", action: "Case created", user: "System", note: "Slack経由で自動作成" },
    { timestamp: "2026-03-17 14:10", action: "Triaged", user: "山本 一郎", note: "Support Teamにアサイン" },
    { timestamp: "2026-03-17 14:30", action: "First response sent", user: "佐藤 太郎 (Support Team)", note: "初期調査開始" },
  ],
};

const RELATED_ACTIONS = [
  { id: "act_1", title: "レポート機能のデータ同期状況確認", status: "in_progress", owner: "佐藤 太郎" },
];

const RELATED_CONTENT = [
  { id: "cnt_1", title: "レポート機能のトラブルシューティングガイド", type: "Help" },
  { id: "cnt_2", title: "データエクスポートのベストプラクティス", type: "Guide" },
];

const SIMILAR_CASES = [
  { id: "sup_5", title: "エクスポート時の日付範囲エラー", company: "株式会社テクノロジーイノベーション", companyId: "1", resolved: true, resolution: "データ同期のタイミング調整で解決" },
  { id: "sup_6", title: "特定期間のレポートデータ欠損", company: "クラウドインフラサービス", companyId: "5", resolved: true, resolution: "キャッシュクリアで解決" },
];

const AI_SUGGESTIONS = {
  summary: "レポート機能でのデータ欠損問題。2026年2月の特定プロジェクトデータが表示されない。データ同期またはキャッシュの問題の可能性が高い。",
  suggestedOwner: "Support Team（初期対応）",
  suggestedTeam: "Support → CSE（必要に応じて）",
  urgency: "Medium",
  nextSteps: [
    "顧客からブラウザ情報とレポート種類を確認",
    "バックエンドログで2月のデータ同期状態を確認",
    "類似ケースの解決方法を試行",
    "必要に応じてCSE Ticketを起票",
  ],
};

// ── Main component ────────────────────────────────────────────────────────────

export function SupportDetail() {
  const { id } = useParams();
  const [internalNote, setInternalNote] = useState("");

  // In a real app, look up by id. For now use the single mock.
  const c = CASE_DETAIL;
  void id;

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Support Detail" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1400px] mx-auto p-6 space-y-6">

            {/* Page header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link to="/support/queue">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Support Queue
                  </Button>
                </Link>
                <div className="h-6 w-px bg-slate-300" />
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{c.title}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{c.caseType}</Badge>
                    <Badge variant="outline" className="text-xs">{c.source}</Badge>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">{c.id}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/companies/${c.companyId}`}>
                  <Button variant="outline" size="sm">
                    <Building className="w-4 h-4 mr-2" />
                    Company
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">

              {/* Left column */}
              <div className="col-span-2 space-y-6">

                {/* Original Message */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Original Message / Ticket Summary</CardTitle>
                    <CardDescription>{c.source} • {c.createdAt}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-slate-50 border rounded-lg p-4">
                      <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">{c.originalMessage}</pre>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Summary */}
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-blue-600" />
                      AI Summary & Suggestions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-xs font-semibold text-blue-900 mb-1">要約</div>
                      <p className="text-sm text-blue-800">{AI_SUGGESTIONS.summary}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-semibold text-blue-900 mb-1">推奨オーナー</div>
                        <p className="text-sm text-blue-800">{AI_SUGGESTIONS.suggestedOwner}</p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-blue-900 mb-1">推奨チーム</div>
                        <p className="text-sm text-blue-800">{AI_SUGGESTIONS.suggestedTeam}</p>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-blue-900 mb-2">Next Steps</div>
                      <ul className="space-y-1">
                        {AI_SUGGESTIONS.nextSteps.map((step, idx) => (
                          <li key={idx} className="text-sm text-blue-800 flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                {/* Triage Note */}
                {c.triageNote && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Triage Note</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-700">{c.triageNote}</p>
                    </CardContent>
                  </Card>
                )}

                {/* First Response */}
                {c.firstResponse && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">First Response</CardTitle>
                      <CardDescription>{c.firstResponseTime} で応答</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">{c.firstResponse}</pre>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Routing History */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Routing History</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {c.routingHistory.map((event, idx) => (
                        <div key={idx} className="flex items-start gap-3 pb-3 border-b last:border-b-0">
                          <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-slate-900">{event.action}</span>
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-xs text-slate-500">{event.timestamp}</span>
                            </div>
                            <div className="text-sm text-slate-700">by {event.user}</div>
                            {event.note && <div className="text-xs text-slate-500 mt-1">{event.note}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Similar Cases */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Similar Cases</CardTitle>
                    <CardDescription>類似した問い合わせ・サポート案件</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {SIMILAR_CASES.map((similar) => (
                        <div key={similar.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg border">
                          <div className="flex-1">
                            <Link to={`/support/${similar.id}`} className="font-medium text-slate-900 hover:text-blue-600 hover:underline">
                              {similar.title}
                            </Link>
                            <div className="text-xs text-slate-500 mt-1">
                              <Link to={`/companies/${similar.companyId}`} className="hover:text-blue-600 hover:underline">
                                {similar.company}
                              </Link>
                            </div>
                            {similar.resolved && similar.resolution && (
                              <div className="text-xs text-green-700 mt-1 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                解決方法: {similar.resolution}
                              </div>
                            )}
                          </div>
                          <Badge className="bg-green-600 text-white text-xs ml-3">Resolved</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Internal Note */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Add Internal Note</CardTitle></CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="内部メモを入力..."
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                      rows={4}
                      className="mb-3"
                    />
                    <Button size="sm">
                      <Send className="w-4 h-4 mr-2" />
                      Save Note
                    </Button>
                  </CardContent>
                </Card>

              </div>

              {/* Right column */}
              <div className="space-y-6">

                {/* Case Details */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Case Details</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Current Owner</span>
                      <span className="font-medium text-slate-900">{c.owner}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Assigned Team</span>
                      <Badge variant="outline" className="text-xs">{c.assignedTeam}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Routing Status</span>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">{c.routingStatus}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Severity</span>
                      <Badge className="bg-amber-600 text-white text-xs">{c.severity}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Open Duration</span>
                      <span className="font-medium text-slate-900">{c.openDuration}</span>
                    </div>
                    {c.linkedCSETicket && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Linked CSE Ticket</span>
                        <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700">
                          <Ticket className="w-3 h-3 mr-1" />{c.linkedCSETicket}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Linked Company */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Linked Company / Project</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <Link
                      to={`/companies/${c.companyId}`}
                      className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border hover:bg-slate-100 transition-colors"
                    >
                      <Building className="w-4 h-4 text-slate-500" />
                      <div className="flex-1 text-sm font-medium text-slate-900">{c.company}</div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </Link>
                    {c.project && (
                      <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <div className="flex-1 text-sm font-medium text-slate-900">{c.project}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Actions */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <Select defaultValue="none">
                      <SelectTrigger><SelectValue placeholder="Assign to..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- Select --</SelectItem>
                        <SelectItem value="csm">CSM Team</SelectItem>
                        <SelectItem value="support">Support Team</SelectItem>
                        <SelectItem value="cse">CSE Team</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <Ticket className="w-4 h-4 mr-2" />
                      CSE Ticketを起票
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <Play className="w-4 h-4 mr-2" />
                      Actionを作成
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <FileText className="w-4 h-4 mr-2" />
                      Contentを作成
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <BookOpen className="w-4 h-4 mr-2" />
                      FAQ/Help候補にする
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <Send className="w-4 h-4 mr-2" />
                      Outboundを準備
                    </Button>
                  </CardContent>
                </Card>

                {/* Related Actions */}
                {RELATED_ACTIONS.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Related Actions</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {RELATED_ACTIONS.map((action) => (
                          <div key={action.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border">
                            <Play className="w-4 h-4 text-slate-500" />
                            <div className="flex-1">
                              <div className="text-sm text-slate-900">{action.title}</div>
                              <div className="text-xs text-slate-500">{action.owner}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Related Content */}
                {RELATED_CONTENT.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Related Content</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {RELATED_CONTENT.map((content) => (
                          <div key={content.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border">
                            <BookOpen className="w-4 h-4 text-slate-500" />
                            <div className="flex-1">
                              <div className="text-sm text-slate-900">{content.title}</div>
                              <Badge variant="outline" className="text-xs mt-1">{content.type}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
