import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "../components/ui/breadcrumb";
import {
  Mail,
  MessageSquare,
  Send,
  Save,
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  User,
  Building2,
  Target,
  FileText,
  Sparkles,
  Eye,
  Edit3,
  XCircle,
  Users,
  ExternalLink,
  Shield,
  BookOpen,
  Clock,
  ChevronRight,
  Database,
  CheckSquare,
  Calendar,
} from "lucide-react";
import { FileManager } from "../components/library/file-manager";
import { RichTextEditor } from "../components/outbound/rich-text-editor";

export function OutboundEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showSendModal, setShowSendModal] = useState(false);
  const [showTemplateDrawer, setShowTemplateDrawer] = useState(false);
  const [showAIDrawer, setShowAIDrawer] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [bodyText, setBodyText] = useState("");
  const [selectedExistingFiles, setSelectedExistingFiles] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Mock data - in real app, fetch based on id
  const outboundData = {
    id: id || "out-1",
    name: "利用低下クラスター向けリエンゲージメントEmail",
    channel: "email" as const,
    audienceScope: "project" as const,
    linkedCluster: "利用低下クラスター",
    linkedSegment: "Churn Prevention",
    linkedAction: "action-001",
    linkedContentJob: "content-job-001",
    linkedEvent: {
      id: "evt_1",
      name: "Q2製品アップデート案内",
      type: "Product Update",
    } as { id: string; name: string; type: string } | null,
    resolvedRecipientsCount: 847,
    unresolvedRecipientsCount: 12,
    projectCount: 847,
    userCount: 1234,
    reviewState: "review_required" as const,
    sourceContext: "Audience Workspace",
    owner: "佐藤 太郎",
    subject: "【重要】ご利用状況のご確認とサポートのご案内",
    body: `{{user_name}}様

いつもお世話になっております。
{{company_name}}の{{csm_name}}です。

このたび、{{project_name}}のご利用状況を確認させていただいたところ、
過去30日間のアクティビティが以前と比較して低下していることに気づきました。

もし何かお困りの点や、機能についてのご不明点がございましたら、
お気軽にご相談ください。

以下のような追加サポートをご用意しております:
- 個別トレーニングセッション
- ベストプラクティスのご共有
- 導入支援のご相談

ご都合の良い日時をお知らせいただければ、
オンラインミーティングを設定させていただきます。

引き続きよろしくお願いいたします。

{{csm_name}}
{{company_name}}`,
    templateName: "リエンゲージメントメール（管理者向け）",
    templateId: "template-reengagement",
  };

  const mockResolvedRecipients = [
    { id: "p1", name: "プロジェクトA", company: "テックイノベーション株式会社", users: ["田太郎", "山田花子"], userCount: 2 },
    { id: "p2", name: "データ分析基盤構築", company: "デジタルマーケティング株式会社", users: ["佐藤次郎"], userCount: 1 },
    { id: "p3", name: "全社DX推進", company: "クラウドインフラ株式会社", users: ["鈴木三郎"], userCount: 1 },
  ];

  const mockUnresolvedRecipients = [
    { id: "p-unr-1", name: "営業管理システム刷新", company: "エンタープライズシステムズ株式会社", reason: "メールアドレス未登録", userCount: 3 },
    { id: "p-unr-2", name: "マーケティング自動化", company: "グローバルソリューションズ株式会社", reason: "担当者情報なし", userCount: 5 },
    { id: "p-unr-3", name: "カスタマーサポート強化", company: "テクノロジーパートナーズ株式会社", reason: "配信除外リスト", userCount: 4 },
  ];

  const mockEvidence = [
    { id: "ev-1", type: "activity_log", title: "l30_active急激低下", project: "プロジェクトA", date: "2026-03-10", severity: "high" },
    { id: "ev-2", type: "metric", title: "habituation_status悪化", project: "データ分析基盤構築", date: "2026-03-09", severity: "high" },
    { id: "ev-3", type: "insight", title: "管理者の関心維持", project: "全社DX推進", date: "2026-03-08", severity: "medium" },
  ];

  const variables = [
    { name: "user_name", example: "田中太郎", description: "受信者の氏名" },
    { name: "company_name", example: "テックイノベーション株式会社", description: "会社名" },
    { name: "project_name", example: "プロジェクトA", description: "プロジェクト名" },
    { name: "csm_name", example: "佐藤 太郎", description: "担当CSM名" },
  ];

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="w-5 h-5" />;
      case "intercom": return <MessageSquare className="w-5 h-5" />;
      case "slack": return <MessageSquare className="w-5 h-5" />;
      default: return <Send className="w-5 h-5" />;
    }
  };

  const handleSend = () => {
    setShowSendModal(true);
  };

  const confirmSend = () => {
    setShowSendModal(false);
    navigate("/outbound");
  };

  return (
    <div className="flex h-screen bg-white">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="border-b bg-white px-8 py-4">
            <nav className="mb-4">
              <ol className="flex items-center gap-2 text-sm text-slate-600">
                <li>
                  <Link to="/outbound" className="hover:text-slate-900">Outbound</Link>
                </li>
                <li><ChevronRight className="w-4 h-4" /></li>
                <li className="text-slate-900 font-medium">Editor</li>
              </ol>
            </nav>

            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  {getChannelIcon(outboundData.channel)}
                  <h1 className="text-xl font-semibold text-slate-900">{outboundData.name}</h1>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <Badge variant="outline" className="capitalize">{outboundData.channel}</Badge>
                  <Badge variant="outline">
                    {outboundData.audienceScope === "project" && <Target className="w-3 h-3 mr-1" />}
                    {outboundData.audienceScope === "company" && <Building2 className="w-3 h-3 mr-1" />}
                    {outboundData.audienceScope === "user" && <User className="w-3 h-3 mr-1" />}
                    {outboundData.audienceScope}
                  </Badge>
                  {outboundData.linkedCluster && (
                    <Badge variant="outline">Cluster: {outboundData.linkedCluster}</Badge>
                  )}
                  {outboundData.reviewState === "review_required" && (
                    <Badge variant="outline" className="text-amber-600 border-amber-600">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Review Required
                    </Badge>
                  )}
                  {outboundData.unresolvedRecipientsCount > 0 && (
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Unresolved: {outboundData.unresolvedRecipientsCount}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-6 text-sm text-slate-600">
                  <div>対象Project: {outboundData.projectCount}件</div>
                  <div>対象User: {outboundData.userCount}件</div>
                  <div>Resolved: {outboundData.resolvedRecipientsCount}件</div>
                  <div>Owner: {outboundData.owner}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate("/outbound")}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Listに戻る
                </Button>
                <Button variant="outline" size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  下書き保存
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex min-h-0">
            {/* Left: Audience / Delivery Scope */}
            <div className="w-80 border-r bg-slate-50 overflow-y-auto">
              <div className="p-6">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Audience / Delivery Scope</h2>

                <div className="space-y-4 mb-6">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Audience Scope</div>
                    <Badge variant="outline">
                      {outboundData.audienceScope === "project" && <Target className="w-3 h-3 mr-1" />}
                      {outboundData.audienceScope === "company" && <Building2 className="w-3 h-3 mr-1" />}
                      {outboundData.audienceScope === "user" && <User className="w-3 h-3 mr-1" />}
                      {outboundData.audienceScope}
                    </Badge>
                  </div>

                  {outboundData.linkedCluster && (
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Linked Cluster</div>
                      <div className="text-sm text-slate-900">{outboundData.linkedCluster}</div>
                    </div>
                  )}

                  {outboundData.linkedSegment && (
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Linked Segment</div>
                      <div className="text-sm text-slate-900">{outboundData.linkedSegment}</div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs text-slate-500 mb-1">Source Context</div>
                    <div className="text-sm text-slate-900">{outboundData.sourceContext}</div>
                  </div>
                </div>

                <Separator className="my-6" />

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-slate-900">Resolved Recipients</h3>
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      {outboundData.resolvedRecipientsCount}
                    </Badge>
                  </div>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {mockResolvedRecipients.map((recipient) => (
                        <Card key={recipient.id} className="bg-white">
                          <CardContent className="p-3">
                            <div className="text-sm font-medium text-slate-900 mb-1">{recipient.name}</div>
                            <div className="text-xs text-slate-600 mb-2">{recipient.company}</div>
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-slate-500">
                                <Users className="w-3 h-3 inline mr-1" />
                                {recipient.userCount} users
                              </div>
                              <Button variant="ghost" size="sm" className="h-6 text-xs">
                                <Eye className="w-3 h-3 mr-1" />
                                詳細
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {outboundData.unresolvedRecipientsCount > 0 && (
                  <>
                    <Separator className="my-6" />
                    
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-slate-900">Unresolved Recipients</h3>
                        <Badge variant="outline" className="text-orange-600 border-orange-600">
                          {outboundData.unresolvedRecipientsCount}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {mockUnresolvedRecipients.map((recipient) => (
                          <Card key={recipient.id} className="bg-white border-orange-200">
                            <CardContent className="p-3">
                              <div className="text-sm font-medium text-slate-900 mb-1">{recipient.name}</div>
                              <div className="text-xs text-slate-600 mb-2">{recipient.company}</div>
                              <div className="flex items-center gap-1 mb-2">
                                <AlertTriangle className="w-3 h-3 text-orange-600" />
                                <span className="text-xs text-orange-600">{recipient.reason}</span>
                              </div>
                              <div className="text-xs text-slate-500">
                                <Users className="w-3 h-3 inline mr-1" />
                                {recipient.userCount} users affected
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="w-full mt-3">
                        <Edit3 className="w-4 h-4 mr-2" />
                        手動解決
                      </Button>
                    </div>
                  </>
                )}

                <Separator className="my-6" />

                <div className="space-y-2">
                  <Button variant="ghost" size="sm" className="w-full justify-start text-slate-600 hover:text-slate-900">
                    <Building2 className="w-4 h-4 mr-2" />
                    Linked Companyを見る
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-slate-600 hover:text-slate-900">
                    <Target className="w-4 h-4 mr-2" />
                    Linked Projectを見る
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-slate-600 hover:text-slate-900">
                    <User className="w-4 h-4 mr-2" />
                    Linked Userを見る
                  </Button>
                </div>

                <Separator className="my-6" />

                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to={`/audience?returnTo=/outbound/editor/${id}`}>
                    <Edit3 className="w-4 h-4 mr-2" />
                    送信対象を調整
                  </Link>
                </Button>
              </div>
            </div>

            {/* Center: Message Editor */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                <div className="max-w-3xl mx-auto space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Message Editor</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {outboundData.channel === "email" && (
                        <div>
                          <Label htmlFor="subject">件名</Label>
                          <Input
                            id="subject"
                            defaultValue={outboundData.subject}
                            className="mt-1"
                          />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label htmlFor="body">本文</Label>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setShowTemplateDrawer(true)}>
                              <BookOpen className="w-4 h-4 mr-2" />
                              テンプレート変更
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setShowAIDrawer(true)}>
                              <Sparkles className="w-4 h-4 mr-2" />
                              AI改善
                            </Button>
                          </div>
                        </div>
                        <RichTextEditor
                          value={bodyText || outboundData.body}
                          onChange={setBodyText}
                          channel={outboundData.channel}
                          placeholder="本文を入力..."
                          rows={18}
                        />
                      </div>

                      <Separator />

                      {/* File Attachments */}
                      <FileManager
                        selectedFiles={selectedExistingFiles}
                        onFilesChange={setSelectedExistingFiles}
                        newFiles={uploadedFiles}
                        onNewFilesChange={setUploadedFiles}
                      />

                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="text-sm font-medium text-slate-900 mb-2">使用テンプレート</div>
                        <div className="text-sm text-slate-600">{outboundData.templateName}</div>
                      </div>

                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-sm font-medium text-slate-900 mb-2">変数一覧</div>
                        <div className="space-y-2">
                          {variables.map((variable) => (
                            <div key={variable.name} className="flex items-start gap-2 text-sm">
                              <code className="bg-white px-2 py-1 rounded text-xs font-mono text-blue-600">
                                {`{{${variable.name}}}`}
                              </code>
                              <div className="flex-1">
                                <div className="text-slate-900">{variable.description}</div>
                                <div className="text-xs text-slate-500">例: {variable.example}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label>Internal Notes</Label>
                        <Textarea
                          placeholder="社内メモ（顧客には見えません）"
                          rows={3}
                          className="mt-1"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Sample Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                        {outboundData.channel === "email" && (
                          <div>
                            <div className="text-xs text-slate-500 mb-1">件名:</div>
                            <div className="text-sm font-medium text-slate-900">
                              【重要】ご利用状況のご確認とサポートのご案内
                            </div>
                          </div>
                        )}
                        <Separator />
                        <div>
                          <div className="text-xs text-slate-500 mb-1">本文プレビュー:</div>
                          <div className="text-sm text-slate-900 whitespace-pre-wrap">
                            田中太郎様{"\n\n"}
                            いつもお世話になっております。{"\n"}
                            テックイノベーション株式会社の佐藤 太郎です。{"\n\n"}
                            このたび、プロジェクトAのご利用状況を確認させていただいたところ、{"\n"}
                            過去30日間のアクティビティが以前と比較して低下していることに気づきました。
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            {/* Right: Evidence / Review / Approval */}
            <div className="w-96 border-l bg-slate-50 overflow-y-auto">
              <div className="p-6">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">Evidence / Review / Approval</h2>

                <div className="mb-6">
                  <h3 className="text-sm font-medium text-slate-900 mb-3">根拠Evidence</h3>
                  <div className="space-y-2">
                    {mockEvidence.map((evidence) => (
                      <Card key={evidence.id} className="bg-white">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="text-sm font-medium text-slate-900">{evidence.title}</div>
                            <Badge 
                              variant="outline" 
                              className={evidence.severity === "high" ? "text-red-600 border-red-600" : "text-amber-600 border-amber-600"}
                            >
                              {evidence.severity}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-600 mb-1">{evidence.project}</div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-slate-500">{evidence.date}</div>
                            <Button variant="ghost" size="sm" className="h-6 text-xs">
                              <ExternalLink className="w-3 h-3 mr-1" />
                              原文
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <Separator className="my-6" />

                <div className="mb-6">
                  <h3 className="text-sm font-medium text-slate-900 mb-3">関連情報</h3>
                  <div className="space-y-2 text-sm">
                    {outboundData.linkedEvent ? (
                      <div className="flex items-start gap-2 p-2 bg-purple-50 border border-purple-200 rounded">
                        <Calendar className="w-4 h-4 text-purple-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-xs text-purple-600 mb-0.5">Linked Event</div>
                          <Link 
                            to={`/events/${outboundData.linkedEvent.id}`}
                            className="text-sm text-purple-700 hover:text-purple-900 hover:underline font-medium"
                          >
                            {outboundData.linkedEvent.name}
                          </Link>
                          <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-200 ml-2">
                            {outboundData.linkedEvent.type}
                          </Badge>
                        </div>
                      </div>
                    ) : null}
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <div className="text-slate-600">Linked Action</div>
                        <div className="text-slate-900">{outboundData.linkedAction}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <div className="text-slate-600">Linked Content Job</div>
                        <div className="text-slate-900">{outboundData.linkedContentJob}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator className="my-6" />

                <div className="mb-6">
                  <h3 className="text-sm font-medium text-slate-900 mb-3">Review Checklist</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox id="check-1" defaultChecked />
                      <label htmlFor="check-1" className="text-sm text-slate-700">
                        対象が正しいか確認済み
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="check-2" defaultChecked />
                      <label htmlFor="check-2" className="text-sm text-slate-700">
                        本文に誤りがないか確認済み
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="check-3" />
                      <label htmlFor="check-3" className="text-sm text-slate-700">
                        Evidenceの根拠が十分か
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="check-4" />
                      <label htmlFor="check-4" className="text-sm text-slate-700">
                        送信タイミングは適切か
                      </label>
                    </div>
                  </div>
                </div>

                <Separator className="my-6" />

                <div className="mb-6">
                  <h3 className="text-sm font-medium text-slate-900 mb-3">Approval State</h3>
                  {outboundData.reviewState === "review_required" ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium text-amber-900">Review Required</div>
                          <div className="text-xs text-amber-700 mt-1">
                            送信前にレビューが必要です
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium text-green-900">Approved</div>
                          <div className="text-xs text-green-700 mt-1">
                            送信可能です
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator className="my-6" />

                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-2 mb-2">
                    <Shield className="w-4 h-4 text-red-600 mt-0.5" />
                    <div className="text-sm font-medium text-red-900">外部送信警告</div>
                  </div>
                  <div className="text-xs text-red-700">
                    この操作は顧客に直接届く外部送信です。送信前に必ず内容を確認してください。
                  </div>
                </div>

                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => setShowReviewModal(true)}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Review承認
                  </Button>
                  <Button variant="outline" size="sm" className="w-full">
                    <XCircle className="w-4 h-4 mr-2" />
                    差し戻し
                  </Button>
                  <Button 
                    size="sm" 
                    className="w-full bg-red-600 hover:bg-red-700"
                    onClick={handleSend}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    送信実行
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Send Confirmation Modal - 危険操作 */}
      <Dialog open={showSendModal} onOpenChange={setShowSendModal}>
        <DialogContent className="max-w-2xl max-h-[calc(100vh-4rem)] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              外部送信の確認
            </DialogTitle>
            <DialogDescription>
              この操作は顧客に直接届く外部送信です。送信内容を最終確認してください。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500 mb-1">Channel</div>
                <Badge variant="outline" className="capitalize">{outboundData.channel}</Badge>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Audience Scope</div>
                <Badge variant="outline">{outboundData.audienceScope}</Badge>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Resolved Recipients</div>
                <div className="text-sm font-medium text-green-600">{outboundData.resolvedRecipientsCount}件</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Unresolved Recipients</div>
                <div className="text-sm font-medium text-orange-600">{outboundData.unresolvedRecipientsCount}件</div>
              </div>
            </div>

            <Separator />

            {outboundData.channel === "email" && (
              <div>
                <div className="text-xs text-slate-500 mb-1">件名</div>
                <div className="text-sm text-slate-900 bg-slate-50 rounded p-2">{outboundData.subject}</div>
              </div>
            )}

            <div>
              <div className="text-xs text-slate-500 mb-1">本文（抜粋）</div>
              <div className="text-sm text-slate-900 bg-slate-50 rounded p-3 max-h-40 overflow-y-auto">
                {outboundData.body.substring(0, 200)}...
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1">Approval State</div>
              {outboundData.reviewState === "approved" ? (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Approved
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-600">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Review Required
                </Badge>
              )}
            </div>

            <div>
              <div className="text-xs text-slate-500 mb-1">Linked Evidence</div>
              <div className="text-sm text-slate-600">{mockEvidence.length}件のEvidenceを参照</div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-sm font-medium text-red-900 mb-1">確認事項</div>
              <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                <li>送信対象が正しいことを確認しました</li>
                <li>本文に誤りがないことを確認しました</li>
                <li>Unresolvedがある場合、対応方針を確認しました</li>
                <li>送信後の取り消しはできません</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendModal(false)}>
              キャンセル
            </Button>
            <Button onClick={confirmSend} className="bg-red-600 hover:bg-red-700">
              <Send className="w-4 h-4 mr-2" />
              送信する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Drawer */}
      <Sheet open={showTemplateDrawer} onOpenChange={setShowTemplateDrawer}>
        <SheetContent side="right" className="w-[600px]">
          <SheetHeader>
            <SheetTitle>テンプレート選択</SheetTitle>
            <SheetDescription>
              適用するテンプレートを選択してください
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <p className="text-sm text-slate-600">テンプレート一覧がここに表示されます</p>
          </div>
        </SheetContent>
      </Sheet>

      {/* AI Improvement Drawer */}
      <Sheet open={showAIDrawer} onOpenChange={setShowAIDrawer}>
        <SheetContent side="right" className="w-[600px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              AI下書き改善
            </SheetTitle>
            <SheetDescription>
              現在の本文をAIで改善します
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <p className="text-sm text-slate-600">AI改善機能がここに表示されます</p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Review Modal */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-lg max-h-[calc(100vh-4rem)] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Review承認
            </DialogTitle>
            <DialogDescription>
              この送信内容を承認しますか？
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3 overflow-y-auto">
            <div className="text-sm text-slate-600">
              承認後、送信可能な状態になります。
            </div>
            <div className="bg-slate-50 rounded p-3 text-sm">
              <div className="font-medium text-slate-900 mb-2">承認内容</div>
              <ul className="space-y-1 text-slate-600">
                <li>• 対象: {outboundData.resolvedRecipientsCount}件</li>
                <li>• Channel: {outboundData.channel}</li>
                <li>• Evidence: {mockEvidence.length}件</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewModal(false)}>
              チャンセル
            </Button>
            <Button onClick={() => setShowReviewModal(false)} className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              承認する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}