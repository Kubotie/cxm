import { useState } from "react";
import { Link } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Separator } from "../components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
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
  Search,
  Plus,
  Eye,
  Copy,
  CheckCircle2,
  Clock,
  Users,
  ArrowRight,
  Shield,
  Edit3,
  ChevronRight,
  X,
  Upload,
  File,
  Lightbulb,
  GitBranch,
  Paperclip,
  Trash2,
  Calendar,
} from "lucide-react";
import { CreateForm } from "../components/library/create-form";
import { FilesList } from "../components/library/files-list";
import { RichTextEditor } from "../components/outbound/rich-text-editor";

// モックデータ
const templates = [
  {
    id: "tmpl_1",
    title: "フォローアップメール（決裁者向け）",
    category: "Email",
    type: "external",
    intendedUse: "決裁者が会議を欠席した際の個別フォローアップ",
    status: "approved" as const,
    owner: "田中 花子",
    lastUpdated: "2026-03-05",
    usageCount: 127,
    scope: "Company",
    tags: ["decision_maker", "follow_up", "meeting"],
    linkedEvent: {
      id: "evt_1",
      name: "Q2製品アップデート案内",
      type: "Product Update",
    },
    content: "件名: 【フォローアップ】先日の会議について\n\n{{recipient_name}}様\n\nお世話になっております。{{sender_name}}です。\n\n先日の会議では、ご多忙のためご欠席とのことで残念でした。会議では以下の内容を議論いたしました：\n\n- {{topic_1}}\n- {{topic_2}}\n- {{topic_3}}\n\nつきましては、{{next_action}}についてご相談させていただきたく、お時間をいただけますでしょうか。\n\nご都合の良い日時をお知らせいただけますと幸いです。\n\n何卒よろしくお願いいたします。",
  },
  {
    id: "tmpl_2",
    title: "オンボーディング進捗確認",
    category: "Email",
    type: "external",
    intendedUse: "Setup Phaseの進捗確認と次ステップの案内",
    status: "approved" as const,
    owner: "佐藤 太郎",
    lastUpdated: "2026-03-03",
    usageCount: 89,
    scope: "Project",
    tags: ["onboarding", "setup", "progress"],
    linkedEvent: null,
    content: "件名: オンボーディング進捗のご確認\n\n{{recipient_name}}様\n\nいつもお世話になっております。\n\nオンボーディングの進捗状況を確認させていただきたく、ご連絡いたしました。現在のステータスは以下の通りです：\n\n✓ 完了: {{completed_items}}\n⏳ 進行中: {{in_progress_items}}\n□ 未着手: {{pending_items}}\n\n次のステップとして、{{next_steps}}を予定しております。\n\nご不明点やサポートが必要な点がございましたら、お気軽にお知らせください。",
  },
  {
    id: "tmpl_3",
    title: "活用促進Tips（Slack配信用）",
    category: "Slack",
    type: "external",
    intendedUse: "週次でのTips配信により活用を促進",
    status: "approved" as const,
    owner: "田中 花子",
    lastUpdated: "2026-03-01",
    usageCount: 234,
    scope: "User",
    tags: ["tips", "engagement", "weekly"],
    linkedEvent: {
      id: "evt_2",
      name: "新規顧客向けWebinar",
      type: "Webinar",
    },
    content: "🎯 今週のTips\n\n{{tip_title}}\n\n{{tip_description}}\n\n💡 使い方:\n{{usage_instructions}}\n\n詳細はこちら: {{help_link}}",
  },
  {
    id: "tmpl_4",
    title: "QBR準備ガイド",
    category: "Playbook",
    type: "internal",
    intendedUse: "四半期レビューの準備と実施手順",
    status: "approved" as const,
    owner: "佐藤 太郎",
    lastUpdated: "2026-02-28",
    usageCount: 45,
    scope: "Company",
    tags: ["qbr", "review", "executive"],
    linkedEvent: null,
    content: "# QBR準備ガイド\n\n## 事前準備（1週間前）\n- Health Scoreの確認\n- 主要メトリクスの集計\n- Success Storyの抽出\n\n## 当日アジェンダ\n1. 前期の振り返り\n2. 現在の状況\n3. 今後の計画\n\n## フォローアップ\n- 議事録の作成と共有\n- アクションアイテムの追跡",
  },
  {
    id: "tmpl_5",
    title: "チャーン防止アクションプラン",
    category: "Playbook",
    type: "internal",
    intendedUse: "At-Risk顧客への対応手順",
    status: "approved" as const,
    owner: "田中 花子",
    lastUpdated: "2026-02-25",
    usageCount: 67,
    scope: "Company",
    tags: ["churn", "at_risk", "action_plan"],
    linkedEvent: null,
    content: "# チャーン防止アクションプラン\n\n## ステップ1: 原因の特定\n- Health Score低下の要因分析\n- 顧客インタビューの実施\n\n## ステップ2: 対応策の立案\n- カスタマイズされたサポートプラン\n- エグゼクティブエスカレーション\n\n## ステップ3: フォローアップ\n- 週次での進捗確認\n- 改善状況のモニタリング",
  },
  {
    id: "tmpl_6",
    title: "トレーニングセッション案内",
    category: "Email",
    type: "external",
    intendedUse: "新規ユーザーへのトレーニング案内",
    status: "draft" as const,
    owner: "佐藤 太郎",
    lastUpdated: "2026-03-10",
    usageCount: 12,
    scope: "User",
    tags: ["training", "new_user", "onboarding"],
    linkedEvent: null,
    content: "件名: トレーニングセッションのご案内\n\n{{recipient_name}}様\n\n新規ユーザー向けのトレーニングセッションを下記の通り開催いたします：\n\n日時: {{training_date}}\n時間: {{training_time}}\n場所: {{training_location}}\n\nご参加をお待ちしております。",
  },
];

const statusColors = {
  approved: "bg-green-100 text-green-800",
  draft: "bg-slate-100 text-slate-700",
  pending_review: "bg-amber-100 text-amber-800",
};

export function Library() {
  const [activeTab, setActiveTab] = useState("templates");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showTypeSelectModal, setShowTypeSelectModal] = useState(false);
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [selectedType, setSelectedType] = useState<"template" | "playbook" | "knowledge" | "asset" | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [variables, setVariables] = useState<Array<{
    name: string;
    label: string;
    required: boolean;
    defaultValue: string;
    description: string;
    sampleValue: string;
  }>>([]);
  const [editedContent, setEditedContent] = useState("");

  const filteredTemplates = templates.filter((tmpl) => {
    if (categoryFilter !== "all" && tmpl.category !== categoryFilter) return false;
    if (searchQuery && !tmpl.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    totalTemplates: templates.length,
    approvedTemplates: templates.filter((t) => t.status === "approved").length,
    totalPlaybooks: templates.filter((t) => t.category === "Playbook").length,
    externalTemplates: templates.filter((t) => t.type === "external").length,
  };

  const selectedTemplateData = templates.find((t) => t.id === selectedTemplate);

  const handleRowClick = (templateId: string) => {
    setSelectedTemplate(templateId);
    setShowEditDrawer(true);
    setIsEditing(false);
  };

  const handleTypeSelect = (type: "template" | "playbook" | "knowledge" | "asset") => {
    setSelectedType(type);
    setShowTypeSelectModal(false);
    setShowCreateDrawer(true);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setUploadedFiles(Array.from(files));
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const addVariable = () => {
    setVariables([
      ...variables,
      {
        name: "",
        label: "",
        required: false,
        defaultValue: "",
        description: "",
        sampleValue: "",
      },
    ]);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="System" />
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Page Header */}
          <div className="bg-white border-b p-4">
            <div className="max-w-[1800px] mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-xl font-semibold text-slate-900 mb-1">Library</h1>
                  <p className="text-sm text-slate-600">
                    Template・Playbook・承認済みContentを管理します
                  </p>
                </div>
                <Button size="sm" className="text-xs" onClick={() => setShowTypeSelectModal(true)}>
                  <Plus className="w-3 h-3 mr-1" />
                  新規作成
                </Button>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-white border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs text-slate-600">全Template</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {stats.totalTemplates}
                  </div>
                </div>
                <div className="bg-white border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-xs text-slate-600">承認済み</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {stats.approvedTemplates}
                  </div>
                </div>
                <div className="bg-white border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs text-slate-600">Playbook</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.totalPlaybooks}
                  </div>
                </div>
                <div className="bg-white border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-xs text-slate-600">外部送信用</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {stats.externalTemplates}
                  </div>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    placeholder="Template名で検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全Category</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Slack">Slack</SelectItem>
                    <SelectItem value="Playbook">Playbook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Main Content: Tabs */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full max-w-[1800px] mx-auto p-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <TabsList className="w-fit mb-3">
                  <TabsTrigger value="templates" className="text-xs">
                    <FileText className="w-3 h-3 mr-1.5" />
                    Templates
                  </TabsTrigger>
                  <TabsTrigger value="files" className="text-xs">
                    <Paperclip className="w-3 h-3 mr-1.5" />
                    Files
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="templates" className="flex-1 overflow-hidden mt-0">
                  <div className="bg-white border rounded-lg overflow-hidden h-full flex flex-col">
                    <div className="flex-1 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Template名</TableHead>
                            <TableHead className="w-[100px]">Category</TableHead>
                            <TableHead className="w-[100px]">Type</TableHead>
                            <TableHead className="w-[300px]">用途</TableHead>
                            <TableHead className="w-[100px]">Scope</TableHead>
                            <TableHead className="w-[100px]">利用回数</TableHead>
                            <TableHead className="w-[100px]">Status</TableHead>
                            <TableHead className="w-[100px]">更新日</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTemplates.map((template) => (
                            <TableRow 
                              key={template.id}
                              className="cursor-pointer hover:bg-slate-50"
                              onClick={() => handleRowClick(template.id)}
                            >
                              <TableCell className="font-medium text-sm">{template.title}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {template.category}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    template.type === "external" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {template.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                <div className="line-clamp-2">{template.intendedUse}</div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {template.scope}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{template.usageCount}回</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-xs ${statusColors[template.status]}`}>
                                  {template.status === "approved" && "承認済み"}
                                  {template.status === "draft" && "Draft"}
                                  {template.status === "pending_review" && "Review待ち"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {template.lastUpdated}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 w-7 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRowClick(template.id);
                                    }}
                                  >
                                    <Eye className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="p-3 border-t text-center bg-slate-50">
                      <p className="text-sm text-slate-500">
                        {filteredTemplates.length}件を表示中
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="files" className="flex-1 overflow-hidden mt-0">
                  <FilesList
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
      </div>

      {/* Edit Drawer */}
      <Sheet open={showEditDrawer} onOpenChange={setShowEditDrawer}>
        <SheetContent className="w-[700px] sm:max-w-[700px] overflow-y-auto p-6">
          <SheetHeader>
            <SheetTitle>Template詳細・編集</SheetTitle>
            <SheetDescription>
              Templateの詳細を確認・編集できます
            </SheetDescription>
          </SheetHeader>

          {selectedTemplateData && (
            <div className="mt-6 space-y-6">
              {/* Header Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${statusColors[selectedTemplateData.status]}`}>
                    {selectedTemplateData.status === "approved" && "承認済み"}
                    {selectedTemplateData.status === "draft" && "Draft"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      selectedTemplateData.type === "external"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {selectedTemplateData.type}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {selectedTemplateData.category}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={isEditing ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-xs"
                  >
                    {isEditing ? (
                      <>
                        <Eye className="w-3 h-3 mr-1" />
                        表示モード
                      </>
                    ) : (
                      <>
                        <Edit3 className="w-3 h-3 mr-1" />
                        編集モード
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Template Title */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">Template名</Label>
                {isEditing ? (
                  <Input
                    defaultValue={selectedTemplateData.title}
                    className="mt-1 text-sm"
                  />
                ) : (
                  <p className="mt-1 text-sm font-medium text-slate-900">{selectedTemplateData.title}</p>
                )}
              </div>

              {/* Intended Use */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">用途</Label>
                {isEditing ? (
                  <Textarea
                    defaultValue={selectedTemplateData.intendedUse}
                    className="mt-1 text-sm"
                    rows={2}
                  />
                ) : (
                  <p className="mt-1 text-sm text-slate-700">{selectedTemplateData.intendedUse}</p>
                )}
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Scope</Label>
                  <p className="mt-1 text-sm text-slate-900">{selectedTemplateData.scope}</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Owner</Label>
                  <p className="mt-1 text-sm text-slate-900">{selectedTemplateData.owner}</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">利用回数</Label>
                  <p className="mt-1 text-sm text-slate-900">{selectedTemplateData.usageCount}回</p>
                </div>
              </div>

              {/* Linked Event */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-2 block">Linked Event</Label>
                {selectedTemplateData.linkedEvent ? (
                  <div className="flex items-center gap-2 p-2 bg-purple-50 border border-purple-200 rounded">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <Link 
                      to={`/events/${selectedTemplateData.linkedEvent.id}`}
                      className="text-sm text-purple-700 hover:text-purple-900 hover:underline font-medium flex-1"
                    >
                      {selectedTemplateData.linkedEvent.name}
                    </Link>
                    <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                      {selectedTemplateData.linkedEvent.type}
                    </Badge>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 p-2 bg-slate-50 border border-slate-200 rounded">
                    Event紐付けなし
                  </div>
                )}
                {isEditing && (
                  <Select defaultValue={selectedTemplateData.linkedEvent?.id || "none"}>
                    <SelectTrigger className="mt-2 h-8 text-xs">
                      <SelectValue placeholder="Eventを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">紐付けなし</SelectItem>
                      <SelectItem value="evt_1">Q2製品アップデート案内</SelectItem>
                      <SelectItem value="evt_2">新規顧客向けWebinar</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Separator />

              {/* Content */}
              <div>
                {isEditing ? (
                  <RichTextEditor
                    value={editedContent || selectedTemplateData.content}
                    onChange={setEditedContent}
                    channel={
                      selectedTemplateData.category === "Email" ? "email" : 
                      selectedTemplateData.category === "Slack" ? "slack" :
                      selectedTemplateData.category === "Chatwork" ? "chatwork" : "email"
                    }
                    rows={12}
                  />
                ) : (
                  <>
                    <Label className="text-xs font-semibold text-slate-700">Content</Label>
                    <div className="mt-1 text-sm text-slate-700 bg-slate-50 p-3 rounded border border-slate-200 whitespace-pre-wrap font-mono">
                      {selectedTemplateData.content}
                    </div>
                  </>
                )}
              </div>

              <Separator />

              {/* Tags */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-2 block">Tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTemplateData.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                {isEditing ? (
                  <>
                    <Button size="sm" className="flex-1">
                      保存
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setIsEditing(false)}
                    >
                      キャンセル
                    </Button>
                  </>
                ) : (
                  <>
                    <Link to={`/outbound/compose?fromTemplate=${selectedTemplateData.id}`} className="flex-1">
                      <Button size="sm" className="w-full">
                        <ArrowRight className="w-3 h-3 mr-1" />
                        Outboundに適用
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Copy className="w-3 h-3 mr-1" />
                      複製
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Type Select Modal */}
      <Dialog open={showTypeSelectModal} onOpenChange={setShowTypeSelectModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Library資産を作成</DialogTitle>
            <DialogDescription>
              Evidence・Actions・Contentから生まれた再利用資産を管理します
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <button
              className="p-4 border-2 border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              onClick={() => handleTypeSelect("template")}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900 mb-1">Template</div>
                  <div className="text-xs text-slate-600">
                    再利用する文面・フォーマット
                  </div>
                </div>
              </div>
            </button>
            <button
              className="p-4 border-2 border-slate-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-left"
              onClick={() => handleTypeSelect("playbook")}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <GitBranch className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900 mb-1">Playbook</div>
                  <div className="text-xs text-slate-600">
                    条件分岐を含む実行手順
                  </div>
                </div>
              </div>
            </button>
            <button
              className="p-4 border-2 border-slate-200 rounded-lg hover:border-amber-500 hover:bg-amber-50 transition-colors text-left"
              onClick={() => handleTypeSelect("knowledge")}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Lightbulb className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900 mb-1">Knowledge</div>
                  <div className="text-xs text-slate-600">
                    運用知見・判断メモ・改善知見
                  </div>
                </div>
              </div>
            </button>
            <button
              className="p-4 border-2 border-slate-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-left"
              onClick={() => handleTypeSelect("asset")}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Paperclip className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900 mb-1">Asset</div>
                  <div className="text-xs text-slate-600">
                    スライド・PDF・資料・添付ファイル
                  </div>
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Drawer */}
      <Sheet open={showCreateDrawer} onOpenChange={setShowCreateDrawer}>
        <SheetContent className="w-[700px] sm:max-w-[700px] overflow-y-auto p-6">
          <SheetHeader>
            <SheetTitle>新規作成</SheetTitle>
            <SheetDescription>
              {selectedType === "template" && "Templateを作成します"}
              {selectedType === "playbook" && "Playbookを作成します"}
              {selectedType === "knowledge" && "Knowledgeを作成します"}
              {selectedType === "asset" && "Assetを作成します"}
            </SheetDescription>
          </SheetHeader>

          {selectedType && (
            <CreateForm
              type={selectedType}
              onClose={() => setShowCreateDrawer(false)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}