import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ExternalLink,
  Sparkles,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Search,
  Link as LinkIcon,
  UserPlus,
  Users,
  FolderPlus,
  FileText,
  User,
  Clock,
  Activity,
} from "lucide-react";

interface LogData {
  id: string;
  title: string;
  summary: string;
  timestamp: string;
  channel: string;
  sourceType: string;
  messageType: string;
  confidence: number | null;
  missingFields?: string[];
  hasOriginalLink: boolean;
  resolverResult?: string | null;
  linkedPeople: string[];
  linkedProject: string | null;
}

interface SourceTypeConfig {
  label: string;
  [key: string]: any;
}

interface ActionPanelsProps {
  selectedLogData: LogData | undefined;
  sourceTypeConfig: Record<string, SourceTypeConfig>;
  companyName: string;
  relatedProjects: string[];
  
  // Panel states
  showOriginalPanel: boolean;
  setShowOriginalPanel: (value: boolean) => void;
  showAIExtractionPanel: boolean;
  setShowAIExtractionPanel: (value: boolean) => void;
  showReviewPanel: boolean;
  setShowReviewPanel: (value: boolean) => void;
  showPeopleLinkPanel: boolean;
  setShowPeopleLinkPanel: (value: boolean) => void;
  showProjectLinkPanel: boolean;
  setShowProjectLinkPanel: (value: boolean) => void;
  showActionCreatePanel: boolean;
  setShowActionCreatePanel: (value: boolean) => void;
  showRelatedAlertsPanel: boolean;
  setShowRelatedAlertsPanel: (value: boolean) => void;
  showRelatedActionsPanel: boolean;
  setShowRelatedActionsPanel: (value: boolean) => void;
  showResolverDetailPanel: boolean;
  setShowResolverDetailPanel: (value: boolean) => void;
}

export function LogActionPanels({
  selectedLogData,
  sourceTypeConfig,
  companyName,
  relatedProjects,
  showOriginalPanel,
  setShowOriginalPanel,
  showAIExtractionPanel,
  setShowAIExtractionPanel,
  showReviewPanel,
  setShowReviewPanel,
  showPeopleLinkPanel,
  setShowPeopleLinkPanel,
  showProjectLinkPanel,
  setShowProjectLinkPanel,
  showActionCreatePanel,
  setShowActionCreatePanel,
  showRelatedAlertsPanel,
  setShowRelatedAlertsPanel,
  showRelatedActionsPanel,
  setShowRelatedActionsPanel,
  showResolverDetailPanel,
  setShowResolverDetailPanel,
}: ActionPanelsProps) {
  return (
    <>
      {/* Original Source Panel */}
      <Sheet open={showOriginalPanel} onOpenChange={setShowOriginalPanel}>
        <SheetContent className="w-[500px] sm:max-w-[500px] flex flex-col overflow-hidden">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="text-base">原文プレビュー</SheetTitle>
            <SheetDescription className="text-xs">
              Source metadata and original content
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 min-h-0 mt-4">
            <div className="space-y-4 px-4 pb-4">
              {selectedLogData && (
                <>
                  <div className="border rounded p-3 bg-slate-50">
                    <div className="grid grid-cols-[120px_1fr] gap-2 text-xs">
                      <div className="font-semibold text-slate-700">Source Type:</div>
                      <div>{sourceTypeConfig[selectedLogData.sourceType].label}</div>
                      <div className="font-semibold text-slate-700">Channel:</div>
                      <div>{selectedLogData.channel}</div>
                      <div className="font-semibold text-slate-700">Timestamp:</div>
                      <div>{selectedLogData.timestamp}</div>
                      <div className="font-semibold text-slate-700">Message Type:</div>
                      <div>{selectedLogData.messageType}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Original Content</h4>
                    <div className="border rounded p-4 bg-white">
                      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {selectedLogData.summary}
                        {"\n\n"}[This is a mock preview. In production, the full original message would be displayed here.]
                      </p>
                    </div>
                  </div>

                  {selectedLogData.hasOriginalLink && (
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      元ソースを開く ({selectedLogData.channel})
                    </Button>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* AI Extraction Panel */}
      <Sheet open={showAIExtractionPanel} onOpenChange={setShowAIExtractionPanel}>
        <SheetContent className="w-[600px] sm:max-w-[600px] flex flex-col overflow-hidden">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="text-base">AI抽出結果</SheetTitle>
            <SheetDescription className="text-xs">
              Extract structured data from evidence
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 min-h-0 mt-4">
            <div className="space-y-4 px-4 pb-4">
              {selectedLogData && (
                <>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">要約</h4>
                    <div className="border rounded p-3 bg-slate-50">
                      <p className="text-sm text-slate-800">{selectedLogData.summary}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">抽出候補</h4>
                    <div className="space-y-2">
                      <div className="border rounded p-3 bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-700">Signal Type</span>
                          <Badge className="bg-red-500 text-xs">Risk Signal</Badge>
                        </div>
                        <div className="text-sm text-slate-900">決裁者不在パターンの検出</div>
                      </div>
                      <div className="border rounded p-3 bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-700">Related People</span>
                          <Badge variant="outline" className="text-xs">Detected</Badge>
                        </div>
                        <div className="text-sm text-slate-900">{selectedLogData.linkedPeople.join(", ") || "未検出"}</div>
                      </div>
                    </div>
                  </div>

                  {selectedLogData.confidence && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-blue-900">Confidence Score</span>
                        <span className="text-lg font-bold text-blue-700">{(selectedLogData.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="mt-2 bg-white rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all" 
                          style={{ width: `${selectedLogData.confidence * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {selectedLogData.missingFields && selectedLogData.missingFields.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700" />
                        <span className="text-sm font-semibold text-amber-900">Missing Fields</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedLogData.missingFields.map((field, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs bg-amber-100 text-amber-800">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 text-xs">
                      <Eye className="w-3 h-3 mr-1" />
                      レビューへ進む
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs">
                      <Sparkles className="w-3 h-3 mr-1" />
                      再抽出
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowAIExtractionPanel(false)}>
                      キャンセル
                    </Button>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Review Panel */}
      <Sheet open={showReviewPanel} onOpenChange={setShowReviewPanel}>
        <SheetContent className="w-[650px] sm:max-w-[650px] flex flex-col overflow-hidden">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="text-base">Evidence レビュー</SheetTitle>
            <SheetDescription className="text-xs">
              Review and approve extracted data
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 min-h-0 mt-4">
            <div className="space-y-4 px-4 pb-4">
              {selectedLogData && (
                <>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">提案内容</h4>
                    <div className="border rounded p-3 bg-slate-50">
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-semibold text-slate-700">Signal Type: </span>
                          <Badge className="bg-red-500 text-xs ml-1">Risk</Badge>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-700">Title: </span>
                          {selectedLogData.title}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-700">Summary: </span>
                          {selectedLogData.summary}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Evidence引用</h4>
                    <div className="border rounded p-3 bg-blue-50">
                      <div className="text-xs text-blue-900 mb-1 font-semibold">Source: {selectedLogData.channel}</div>
                      <p className="text-sm text-slate-800 italic">"{selectedLogData.summary}"</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">差分</h4>
                    <div className="border rounded overflow-hidden">
                      <div className="bg-green-50 border-b border-green-200 p-2">
                        <div className="text-xs font-mono text-green-800">+ Status: reviewed</div>
                        <div className="text-xs font-mono text-green-800">+ Risk Badge: true</div>
                        <div className="text-xs font-mono text-green-800">+ Evidence Badge: true</div>
                      </div>
                    </div>
                  </div>

                  {selectedLogData.missingFields && selectedLogData.missingFields.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700" />
                        <span className="text-sm font-semibold text-amber-900">Missing Fields</span>
                      </div>
                      <div className="text-xs text-amber-800 mb-2">
                        以下のフィールドが不足しています。レビュー後に手動で紐付けてください。
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedLogData.missingFields.map((field, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs bg-amber-100 text-amber-800">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 text-xs bg-green-600 hover:bg-green-700">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      承認
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      差し戻し
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowReviewPanel(false)}>
                      保留
                    </Button>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* People Link Panel */}
      <Sheet open={showPeopleLinkPanel} onOpenChange={setShowPeopleLinkPanel}>
        <SheetContent className="w-[550px] sm:max-w-[550px] flex flex-col overflow-hidden">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="text-base">Peopleに紐付ける</SheetTitle>
            <SheetDescription className="text-xs">
              Link evidence to relevant people
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 min-h-0 mt-4">
            <div className="space-y-4 px-4 pb-4">
              <div>
                <div className="relative mb-3">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input placeholder="人物名で検索..." className="pl-8 h-8 text-sm" />
                </div>
                
                <h4 className="text-sm font-semibold text-slate-900 mb-2">候補一覧</h4>
                <div className="space-y-2">
                  {[
                    { name: "山田 太郎", role: "CTO", company: companyName, matchScore: 95 },
                    { name: "田中 花子", role: "担当者", company: companyName, matchScore: 82 },
                    { name: "鈴木 次郎", role: "マーケ部長", company: companyName, matchScore: 70 },
                  ].map((person, idx) => (
                    <div key={idx} className="border rounded p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <div className="font-semibold text-sm text-slate-900">{person.name}</div>
                          <div className="text-xs text-slate-600">{person.role} • {person.company}</div>
                        </div>
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-800">
                          {person.matchScore}% match
                        </Badge>
                      </div>
                    </div>
                  ))}\n                </div>
              </div>

              <div className="bg-slate-50 border rounded p-3">
                <div className="text-xs text-slate-700 mb-2">
                  <span className="font-semibold">未解決理由:</span> 完全一致する人物が見つかりませんでした
                </div>
                <div className="text-xs text-slate-600">
                  候補から選択するか、新規作成してください。
                </div>
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button size="sm" className="flex-1 text-xs">
                  <LinkIcon className="w-3 h-3 mr-1" />
                  既存人物に紐付け
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs">
                  <UserPlus className="w-3 h-3 mr-1" />
                  新規作成
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowPeopleLinkPanel(false)}>
                  キャンセル
                </Button>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Project Link Panel */}
      <Sheet open={showProjectLinkPanel} onOpenChange={setShowProjectLinkPanel}>
        <SheetContent className="w-[550px] sm:max-w-[550px] flex flex-col overflow-hidden">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="text-base">Projectに紐付ける</SheetTitle>
            <SheetDescription className="text-xs">
              Link evidence to relevant projects
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 min-h-0 mt-4">
            <div className="space-y-4 px-4 pb-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-2">既存Project候補</h4>
                <div className="space-y-2">
                  {relatedProjects.map((project, idx) => (
                    <div key={idx} className="border rounded p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-sm text-slate-900 mb-1">{project}</div>
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Users className="w-3 h-3" />
                            <span>3名</span>
                            <span>•</span>
                            <span>Phase: Discovery</span>
                          </div>
                          <div className="mt-2">
                            <div className="text-xs text-slate-500 mb-1">関連Evidence: 5件</div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-800">
                          Active
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 border rounded p-3">
                <div className="text-xs text-slate-700 mb-1">
                  <span className="font-semibold">Linked Company:</span> {companyName}
                </div>
                <div className="text-xs text-slate-600">
                  このEvidenceはCompanyレベルで紐付けられます。
                </div>
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button size="sm" className="flex-1 text-xs">
                  <LinkIcon className="w-3 h-3 mr-1" />
                  このProjectに紐付ける
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs">
                  <FolderPlus className="w-3 h-3 mr-1" />
                  新規候補
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowProjectLinkPanel(false)}>
                  キャンセル
                </Button>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Action Create Panel */}
      <Sheet open={showActionCreatePanel} onOpenChange={setShowActionCreatePanel}>
        <SheetContent className="w-[600px] sm:max-w-[600px] flex flex-col overflow-hidden">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="text-base">Action作成</SheetTitle>
            <SheetDescription className="text-xs">
              Create action based on evidence
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 min-h-0 mt-4">
            <div className="space-y-4 px-4 pb-4">
              {selectedLogData && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-slate-900 mb-1 block">Title</label>
                    <Input 
                      defaultValue={`【対応】${selectedLogData.title}`}
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-900 mb-1 block">Objective</label>
                    <textarea 
                      className="w-full border rounded px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      defaultValue={selectedLogData.summary}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-900 mb-1 block">Owner</label>
                    <Select defaultValue="csm-sato">
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csm-sato">佐藤 太郎 (CSM)</SelectItem>
                        <SelectItem value="csm-tanaka">田中 花子 (CSM)</SelectItem>
                        <SelectItem value="sales-suzuki">鈴木 次郎 (Sales)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-900 mb-1 block">Due Date</label>
                    <Input type="date" className="text-sm" defaultValue="2026-03-18" />
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-purple-700" />
                      <span className="text-sm font-semibold text-purple-900">Linked Evidence</span>
                    </div>
                    <div className="text-xs text-purple-800">
                      {selectedLogData.title}
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 text-xs">
                      <Eye className="w-3 h-3 mr-1" />
                      レビューへ送る
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs">
                      <FileText className="w-3 h-3 mr-1" />
                      下書き保存
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowActionCreatePanel(false)}>
                      キャンセル
                    </Button>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Related Alerts Panel */}
      <Sheet open={showRelatedAlertsPanel} onOpenChange={setShowRelatedAlertsPanel}>
        <SheetContent className="w-[600px] sm:max-w-[600px] flex flex-col overflow-hidden">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="text-base">関連Alert</SheetTitle>
            <SheetDescription className="text-xs">
              Alerts related to this evidence
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 min-h-0 mt-4">
            <div className="space-y-3 px-4 pb-4">
              {[
                { id: "alert-1", title: "決裁者連続欠席パターン検出", severity: "high", status: "open", relatedEvidence: 3 },
                { id: "alert-2", title: "Health Score急激低下", severity: "medium", status: "reviewing", relatedEvidence: 5 },
              ].map((alert) => (
                <div key={alert.id} className="border rounded p-3 bg-white">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-slate-900 mb-1">{alert.title}</div>
                      <div className="flex items-center gap-2">
                        <Badge className={alert.severity === "high" ? "bg-red-500" : "bg-orange-500"} variant="default">
                          {alert.severity}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {alert.status}
                        </Badge>
                        <div className="text-xs text-slate-600">
                          <FileText className="w-3 h-3 inline mr-1" />
                          {alert.relatedEvidence}件のEvidence
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Related Actions Panel */}
      <Sheet open={showRelatedActionsPanel} onOpenChange={setShowRelatedActionsPanel}>
        <SheetContent className="w-[600px] sm:max-w-[600px] flex flex-col overflow-hidden">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="text-base">関連Action</SheetTitle>
            <SheetDescription className="text-xs">
              Actions related to this evidence
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 min-h-0 mt-4">
            <div className="space-y-3 px-4 pb-4">
              {[
                { id: "action-1", title: "CTOと1on1ミーティング設定", owner: "佐藤 太郎", dueDate: "2026-03-15", status: "in_progress" },
                { id: "action-2", title: "担当者向けトレーニング実施", owner: "田中 花子", dueDate: "2026-03-20", status: "pending" },
              ].map((action) => (
                <div key={action.id} className="border rounded p-3 bg-white">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-slate-900 mb-1">{action.title}</div>
                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {action.owner}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {action.dueDate}
                        </div>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${action.status === "in_progress" ? "bg-blue-50 text-blue-800" : "bg-slate-50 text-slate-800"}`}
                    >
                      {action.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Resolver Detail Panel */}
      <Sheet open={showResolverDetailPanel} onOpenChange={setShowResolverDetailPanel}>
        <SheetContent className="w-[550px] sm:max-w-[550px] flex flex-col overflow-hidden">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="text-base">Resolver詳細</SheetTitle>
            <SheetDescription className="text-xs">
              Resolver processing details
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 min-h-0 mt-4">
            <div className="space-y-4 px-4 pb-4">
              {selectedLogData && (
                <>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">入力値</h4>
                    <div className="border rounded p-3 bg-slate-50 font-mono text-xs">
                      <div>source_type: {selectedLogData.sourceType}</div>
                      <div>channel: {selectedLogData.channel}</div>
                      <div>message_type: {selectedLogData.messageType}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">解決結果</h4>
                    <div className="border rounded p-3 bg-white">
                      <Badge variant="outline" className="text-xs mb-2">
                        {selectedLogData.resolverResult || "N/A"}
                      </Badge>
                      <div className="text-sm text-slate-800">
                        {selectedLogData.resolverResult === "action_proposed" && "Action提案が生成されました"}
                        {selectedLogData.resolverResult === "resolved" && "自動解決されました"}
                        {selectedLogData.resolverResult === "unresolved" && "未解決のまま保留されています"}
                      </div>
                    </div>
                  </div>

                  {selectedLogData.resolverResult === "unresolved" && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700" />
                        <span className="text-sm font-semibold text-amber-900">未解決理由</span>
                      </div>
                      <div className="text-xs text-amber-800">
                        必要な情報が不足しているため、自動解決できませんでした。
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Fallbackルール</h4>
                    <div className="border rounded p-3 bg-slate-50">
                      <div className="text-xs text-slate-700 space-y-1">
                        <div>1. 自動紐付けを試行</div>
                        <div>2. 信頼度が80%未満の場合は人間レビューへ</div>
                        <div>3. 重要度が高い場合は必ずレビュー</div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 text-xs">
                      <LinkIcon className="w-3 h-3 mr-1" />
                      手動で紐付ける
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowResolverDetailPanel(false)}>
                      閉じる
                    </Button>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}