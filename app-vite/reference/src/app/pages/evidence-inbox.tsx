import { useState } from "react";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { EvidenceCard } from "../components/cards/evidence-card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
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
import {
  Inbox,
  Filter,
  Search,
  Mail,
  Calendar,
  Headphones,
  MessageSquare,
  ExternalLink,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  UserPlus,
  FolderPlus,
  Link as LinkIcon,
} from "lucide-react";

// Mock data for Evidence Inbox
const mockCSMEvidence = [
  {
    id: "csm-1",
    date: "2026-03-11",
    title: "週次レビューMTG - プロジェクトA進捗",
    sourceType: "minutes" as const,
    messageType: "meeting",
    status: "unprocessed" as const,
    scope: "Company / 株式会社テクノロジーイノベーション",
    ownerRole: "CSM",
    excerpt: "決裁者が会議に不参加。プロジェクトの優先度が下がっている可能性を指摘。",
    sourceUrl: "#",
  },
  {
    id: "csm-2",
    date: "2026-03-10",
    title: "メール: 追加機能に関する問い合わせ",
    sourceType: "mail" as const,
    messageType: "inquiry",
    status: "proposal_generated" as const,
    scope: "Company / グローバルソリューションズ",
    ownerRole: "CSM",
    excerpt: "新しい分析機能について詳細を知りたいとの要望。導入拡大の可能性。",
    sourceUrl: "#",
  },
  {
    id: "csm-3",
    date: "2026-03-10",
    title: "四半期ビジネスレビュー議事録",
    sourceType: "minutes" as const,
    messageType: "meeting",
    status: "confirmed" as const,
    scope: "Company / エンタープライズシステムズ",
    ownerRole: "CSM Manager",
    excerpt: "ROI指標が目標を達成。契約更新に向けて前向きな雰囲気。",
    sourceUrl: "#",
  },
  {
    id: "csm-4",
    date: "2026-03-09",
    title: "メール: トレーニング日程調整依頼",
    sourceType: "mail" as const,
    messageType: "request",
    status: "unprocessed" as const,
    scope: "Project / プロジェクトB",
    ownerRole: "CSM",
    excerpt: "新メンバー向けのオンボーディングトレーニングをスケジュールしたい。",
    sourceUrl: "#",
  },
];

const mockSupportEvidence = [
  {
    id: "sup-1",
    date: "2026-03-11",
    title: "チケット #2847: ログイン不具合の報告",
    sourceType: "support" as const,
    messageType: "incident",
    status: "unprocessed" as const,
    scope: "未紐付け",
    ownerRole: "Support",
    excerpt: "特定のブラウザでログインができないとの報告。複数ユーザーから類似報告あり。",
    sourceUrl: "#",
  },
  {
    id: "sup-2",
    date: "2026-03-10",
    title: "お問い合わせ: データエクスポート機能について",
    sourceType: "inquiry" as const,
    messageType: "inquiry",
    status: "proposal_generated" as const,
    scope: "Company / デジタルマーケティング株式会社",
    ownerRole: "Support",
    excerpt: "CSV形式でのデータエクスポート方法についての質問。",
    sourceUrl: "#",
  },
  {
    id: "sup-3",
    date: "2026-03-09",
    title: "チケット #2823: API連携エラー",
    sourceType: "ticket" as const,
    messageType: "technical_issue",
    status: "confirmed" as const,
    scope: "Company / AIソリューションズ株式会社",
    ownerRole: "Engineer",
    excerpt: "外部システムとのAPI連携でタイムアウトエラーが発生。",
    sourceUrl: "#",
  },
];

const mockCRMEvidence = [
  {
    id: "crm-1",
    date: "2026-03-11",
    title: "Webフォームからの問い合わせ",
    sourceType: "inquiry" as const,
    messageType: "new_inquiry",
    status: "unprocessed" as const,
    scope: "未紐付け - 要Resolver確認",
    ownerRole: "未割当",
    excerpt: "製品の価格とプランについての問い合わせ。企業情報が未確定。",
    sourceUrl: "#",
  },
  {
    id: "crm-2",
    date: "2026-03-10",
    title: "契約更新に関する問い合わせ",
    sourceType: "inquiry" as const,
    messageType: "renewal_inquiry",
    status: "proposal_generated" as const,
    scope: "Company / クラウドインフラサービス",
    ownerRole: "CSM",
    excerpt: "次年度の契約更新について、プラン変更の可能性を相談したい。",
    sourceUrl: "#",
  },
];

export function EvidenceInbox() {
  const [activeTab, setActiveTab] = useState("csm");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [showExtractSheet, setShowExtractSheet] = useState(false);
  const [showReviewSheet, setShowReviewSheet] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<string | null>(null);

  const getEvidenceForTab = () => {
    switch (activeTab) {
      case "csm":
        return mockCSMEvidence;
      case "support":
        return mockSupportEvidence;
      case "crm":
        return mockCRMEvidence;
      default:
        return [];
    }
  };

  const evidence = getEvidenceForTab();
  const unprocessedCount = evidence.filter((e) => e.status === "unprocessed").length;

  const handleExtract = (id: string) => {
    setSelectedEvidence(id);
    setShowExtractSheet(true);
  };

  const handleReview = (id: string) => {
    setSelectedEvidence(id);
    setShowReviewSheet(true);
  };

  const handleViewSource = (id: string) => {
    const item = evidence.find((e) => e.id === id);
    if (item?.sourceUrl) {
      window.open(item.sourceUrl, "_blank");
    }
  };

  const selectedEvidenceData = evidence.find((e) => e.id === selectedEvidence);

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Mixed" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto p-6">
            {/* Page Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <Inbox className="w-6 h-6 text-slate-400" />
                <h1 className="text-2xl font-semibold text-slate-900">Evidence Inbox</h1>
                <Badge className="bg-amber-500">{unprocessedCount} 未処理</Badge>
              </div>
              <p className="text-sm text-slate-600">
                Minutes / mail / support / inquiry / ticket / logs を、提案生成の起点として整理して見る
              </p>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList className="grid w-full grid-cols-3 max-w-md">
                <TabsTrigger value="csm">CSM</TabsTrigger>
                <TabsTrigger value="support">Support</TabsTrigger>
                <TabsTrigger value="crm">CRM</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Filter Bar */}
            <div className="bg-white border rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">フィルタ</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Status:</span>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      <SelectItem value="unprocessed">未処理</SelectItem>
                      <SelectItem value="proposal_generated">提案生成済</SelectItem>
                      <SelectItem value="confirmed">確定済</SelectItem>
                      <SelectItem value="synced">同期済</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Scope:</span>
                  <Select value={scopeFilter} onValueChange={setScopeFilter}>
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      <SelectItem value="company">Company</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="unlinked">未紐付け</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {activeTab === "csm" && (
                  <Badge variant="outline" className="text-xs">mail + minutes</Badge>
                )}
                {activeTab === "support" && (
                  <Badge variant="outline" className="text-xs">support + inquiry</Badge>
                )}
                {activeTab === "crm" && (
                  <Badge variant="outline" className="text-xs">inquiry</Badge>
                )}
              </div>
            </div>

            {/* Context Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <div className="flex items-start gap-2">
                <LinkIcon className="w-4 h-4 text-blue-700 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">
                    {activeTab === "csm" && "CSM優先の文脈"}
                    {activeTab === "support" && "Support優先の文脈"}
                    {activeTab === "crm" && "CRM Inquiryの文脈"}
                  </h4>
                  <p className="text-xs text-blue-800">
                    {activeTab === "csm" && "CSM関連のメールと議事録を表示しています。AI提案だけでなく、原文や根拠へのアクセスを重視します。"}
                    {activeTab === "support" && "サポート関連のチケットと問い合わせを表示しています。Company未解決の場合は未紐付け状態が強調されます。"}
                    {activeTab === "crm" && "CRMからの問い合わせを表示しています。Company未解決の場合はResolver確認が必要です。"}
                  </p>
                </div>
              </div>
            </div>

            {/* Evidence List */}
            <div className="space-y-4">
              {activeTab === "crm" && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <ExternalLink className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-amber-900 mb-1">未紐付けInquiry検出</h4>
                      <p className="text-xs text-amber-800 mb-3">
                        Company未解決のInquiryが1件あります。Resolver確認または手動紐付けが必要です。
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" className="text-xs h-7">
                          Resolver確認
                        </Button>
                        <Button variant="outline" size="sm" className="text-xs h-7">
                          手動紐付け
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {evidence.map((item) => (
                  <EvidenceCard
                    key={item.id}
                    {...item}
                    onExtract={handleExtract}
                    onReview={handleReview}
                    onViewSource={handleViewSource}
                  />
                ))}
              </div>

              {evidence.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Evidenceがありません</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* AI抽出Sheet */}
      <Sheet open={showExtractSheet} onOpenChange={setShowExtractSheet}>
        <SheetContent className="w-[960px] sm:max-w-[960px] overflow-y-auto p-0">
          <div className="p-6">
            <SheetHeader className="mb-6">
              <SheetTitle className="text-xl">AI抽出結果</SheetTitle>
              <SheetDescription className="text-sm">
                Evidence から Signal / Phase / Next Action を抽出しました
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-6">
              <div className="bg-slate-50 border-2 border-slate-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  元Evidence
                </h4>
                <p className="text-sm text-slate-900 font-medium mb-2">
                  {selectedEvidenceData?.title}
                </p>
                <p className="text-sm text-slate-600 leading-relaxed">{selectedEvidenceData?.excerpt}</p>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="pb-2 border-b">
                  <h4 className="text-base font-semibold text-slate-900">抽出されたSignal</h4>
                </div>
                <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-amber-700" />
                    <span className="text-sm font-semibold text-amber-900">Risk</span>
                  </div>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    決裁者の会議不参加により、プロジェクト優先度低下のリスクを検知
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="pb-2 border-b">
                  <h4 className="text-base font-semibold text-slate-900">現在のPhase</h4>
                </div>
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900 font-medium">Adoption → Engagement への移行期</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="pb-2 border-b">
                  <h4 className="text-base font-semibold text-slate-900">推奨Next Action</h4>
                </div>
                <div className="bg-slate-50 border-2 border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-2"></div>
                    <p className="text-sm text-slate-700 flex-1">
                      決裁者との1on1ミーティングを設定
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mt-2"></div>
                    <p className="text-sm text-slate-700 flex-1">
                      プロジェクトのビジネス価値を再確認するレポート送付
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-8 pt-6 border-t">
              <Button
                className="flex-1 h-11"
                onClick={() => {
                  setShowExtractSheet(false);
                  setShowReviewSheet(true);
                }}
              >
                レビューへ進む
              </Button>
              <Button variant="outline" onClick={() => setShowExtractSheet(false)} className="h-11 px-6">
                閉じる
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* レビューSheet */}
      <Sheet open={showReviewSheet} onOpenChange={setShowReviewSheet}>
        <SheetContent className="w-[960px] sm:max-w-[960px] overflow-y-auto p-0">
          <div className="p-6">
            <SheetHeader className="mb-6">
              <SheetTitle className="text-xl">Action レビュー</SheetTitle>
              <SheetDescription className="text-sm">
                抽出された Action を確認・編集してください
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700 block">Action タイトル *</label>
                <Input
                  defaultValue="決裁者との1on1ミーティング設定"
                  className="text-sm h-10"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-700 block">詳細</label>
                <textarea
                  className="w-full min-h-[120px] text-sm border-2 border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  defaultValue="プロジェクトの優先度が下がっている懸念があるため、決裁者と直接対話してビジネス価値を再確認する"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-700 block">優先度</label>
                  <Select defaultValue="high">
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-700 block">期限</label>
                  <Input type="date" className="text-sm h-10" />
                </div>
              </div>

              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-blue-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">AI提案</p>
                    <p className="text-sm text-blue-800 leading-relaxed">
                      この Action を承認すると、Action Reviewキューに追加されます
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-8 pt-6 border-t">
              <Button
                className="flex-1 h-11"
                onClick={() => setShowReviewSheet(false)}
              >
                承認してキューに追加
              </Button>
              <Button variant="outline" onClick={() => setShowReviewSheet(false)} className="h-11 px-6">
                キャンセル
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}