import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, GitMerge } from "lucide-react";

interface Person {
  id: string;
  name: string;
  role: string;
  title?: string;
  department?: string;
  roleType: string;
  decisionInfluence: "high" | "medium" | "low" | "unknown";
  contactStatus: "active" | "contacted" | "not contacted" | "inactive" | "unknown";
  relationLevel?: string;
  company: string;
  email?: string;
  phone?: string;
  status: "confirmed" | "proposed" | "unresolved";
  confidence?: string;
  evidenceCount: number;
  lastTouchpoint?: string | null;
  linkedProjects?: string[];
  linkedActions?: number;
  linkedContentJobs?: number;
  scope?: string;
  owner?: string;
  relationshipHypothesis?: string;
  missingFields?: string[];
}

interface MissingRole {
  id: string;
  label: string;
  roleType: string;
  description: string;
  layer: "executive" | "champion" | "user";
}

interface PeopleOrgChartModalsProps {
  selectedPerson: Person | undefined;
  selectedMissingRole: MissingRole | null;
  showEvidenceSheet: boolean;
  showConfirmDialog: boolean;
  showEditDrawer: boolean;
  showMergeDialog: boolean;
  showProjectLinkSheet: boolean;
  showActionCreateDrawer: boolean;
  showMissingRoleSheet: boolean;
  setShowEvidenceSheet: (show: boolean) => void;
  setShowConfirmDialog: (show: boolean) => void;
  setShowEditDrawer: (show: boolean) => void;
  setShowMergeDialog: (show: boolean) => void;
  setShowProjectLinkSheet: (show: boolean) => void;
  setShowActionCreateDrawer: (show: boolean) => void;
  setShowMissingRoleSheet: (show: boolean) => void;
}

export function PeopleOrgChartModals({
  selectedPerson,
  selectedMissingRole,
  showEvidenceSheet,
  showConfirmDialog,
  showEditDrawer,
  showMergeDialog,
  showProjectLinkSheet,
  showActionCreateDrawer,
  showMissingRoleSheet,
  setShowEvidenceSheet,
  setShowConfirmDialog,
  setShowEditDrawer,
  setShowMergeDialog,
  setShowProjectLinkSheet,
  setShowActionCreateDrawer,
  setShowMissingRoleSheet,
}: PeopleOrgChartModalsProps) {
  return (
    <>
      {/* Evidence Sheet */}
      <Sheet open={showEvidenceSheet} onOpenChange={setShowEvidenceSheet}>
        <SheetContent className="w-[700px] sm:max-w-[700px]">
          <SheetHeader>
            <SheetTitle>Evidence 確認 - {selectedPerson?.name}</SheetTitle>
            <SheetDescription>
              この人物に関連するEvidenceを確認します
            </SheetDescription>
          </SheetHeader>
          <Tabs defaultValue="list" className="mt-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="list" className="text-xs">Evidence一覧</TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs">タイムライン</TabsTrigger>
            </TabsList>
            <TabsContent value="list" className="mt-4">
              <ScrollArea className="h-[calc(100vh-250px)]">
                <div className="space-y-3 px-4">
                  <div className="bg-slate-50 border rounded p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">週次MTG議事録 - オンボーディング進捗確認</p>
                        <p className="text-xs text-slate-600 mt-1">2026-03-10 | Type: Meeting Minutes</p>
                      </div>
                      <Badge variant="outline" className="text-xs">Scope: Company</Badge>
                    </div>
                    <p className="text-xs text-slate-700 mb-2">
                      「{selectedPerson?.name}から、プロジェクト進捗についてフィードバックを頂きました。決裁プロセスについて確認が必要とのことです。」
                    </p>
                    <Button size="sm" variant="outline" className="w-full text-xs">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      原文を開く
                    </Button>
                  </div>

                  <div className="bg-slate-50 border rounded p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">メール: プロジェクト方針確認</p>
                        <p className="text-xs text-slate-600 mt-1">2026-03-08 | Type: Email</p>
                      </div>
                      <Badge variant="outline" className="text-xs">Scope: Project</Badge>
                    </div>
                    <p className="text-xs text-slate-700 mb-2">
                      「{selectedPerson?.name}より、技術選定の最終確認のメールを受信しました。」
                    </p>
                    <Button size="sm" variant="outline" className="w-full text-xs">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      原文を開く
                    </Button>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-xs text-blue-900 font-medium mb-1">合計 {selectedPerson?.evidenceCount}件のEvidenceがあります</p>
                    <p className="text-xs text-blue-800">Evidenceは顧客理解の根拠として保持されます</p>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="timeline" className="mt-4">
              <ScrollArea className="h-[calc(100vh-250px)]">
                <div className="space-y-3 px-4">
                  <div className="relative pl-6 pb-4 border-l-2 border-slate-200">
                    <div className="absolute left-0 top-0 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-500" />
                    <p className="text-xs text-slate-500 mb-1">2026-03-10 14:30</p>
                    <p className="text-sm font-medium text-slate-900">週次MTG参加</p>
                  </div>
                  <div className="relative pl-6 pb-4 border-l-2 border-slate-200">
                    <div className="absolute left-0 top-0 -translate-x-1/2 w-3 h-3 rounded-full bg-green-500" />
                    <p className="text-xs text-slate-500 mb-1">2026-03-08 11:20</p>
                    <p className="text-sm font-medium text-slate-900">メール送信</p>
                  </div>
                  <div className="relative pl-6 pb-4">
                    <div className="absolute left-0 top-0 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-300" />
                    <p className="text-xs text-slate-500 mb-1">2026-03-05 16:00</p>
                    <p className="text-sm font-medium text-slate-900">初回ミーティング</p>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Confirm People Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md max-h-[calc(100vh-4rem)] flex flex-col">
          <DialogHeader>
            <DialogTitle>People確定</DialogTitle>
            <DialogDescription>
              このPeopleを確定します。proposed → confirmed に変更されます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto">
            <div className="bg-slate-50 border rounded p-3">
              <h4 className="text-sm font-semibold text-slate-900 mb-2">{selectedPerson?.name}</h4>
              <div className="text-xs text-slate-700 space-y-1">
                <p>Role: {selectedPerson?.role}</p>
                <p>Department: {selectedPerson?.department || "未設定"}</p>
                <p>Email: {selectedPerson?.email || "未設定"}</p>
                <p>Phone: {selectedPerson?.phone || "未設定"}</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-xs font-semibold text-blue-900 mb-1">根拠Evidence</p>
              <p className="text-xs text-blue-800">{selectedPerson?.evidenceCount}件のEvidenceから抽出されました</p>
              <p className="text-xs text-blue-700 mt-1">Confidence: {selectedPerson?.confidence}</p>
            </div>

            {selectedPerson?.missingFields && selectedPerson.missingFields.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3">
                <p className="text-xs font-semibold text-amber-900 mb-1">⚠️ 未入力項目</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedPerson.missingFields.map((field, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs bg-white text-amber-800">{field}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              キャンセル
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowConfirmDialog(false);
                setShowEditDrawer(true);
              }}
            >
              編集して確定
            </Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setShowConfirmDialog(false)}
            >
              確定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit People Drawer */}
      <Sheet open={showEditDrawer} onOpenChange={setShowEditDrawer}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>People情報編集</SheetTitle>
            <SheetDescription>
              {selectedPerson?.name}の情報を編集します
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-200px)] mt-6">
            <div className="space-y-4 px-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900">名前</label>
                <Input defaultValue={selectedPerson?.name} className="text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900">役職 (Title)</label>
                <Input defaultValue={selectedPerson?.title} className="text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900">Role Type</label>
                <Select defaultValue={selectedPerson?.roleType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Decision Maker">Decision Maker</SelectItem>
                    <SelectItem value="Executive Sponsor">Executive Sponsor</SelectItem>
                    <SelectItem value="Budget Holder">Budget Holder</SelectItem>
                    <SelectItem value="Champion">Champion</SelectItem>
                    <SelectItem value="Project Owner">Project Owner</SelectItem>
                    <SelectItem value="User">User</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900">Department</label>
                <Input defaultValue={selectedPerson?.department} className="text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900">Email</label>
                <Input type="email" defaultValue={selectedPerson?.email} className="text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900">Phone</label>
                <Input type="tel" defaultValue={selectedPerson?.phone} className="text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900">Decision Influence</label>
                <Select defaultValue={selectedPerson?.decisionInfluence}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900">Relationship Notes</label>
                <textarea
                  className="w-full min-h-[100px] text-sm border rounded-md p-2"
                  defaultValue={selectedPerson?.relationshipHypothesis}
                  placeholder="この人物との関係性や役割についてのメモ..."
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-xs text-blue-900 font-medium mb-1">💡 ヒント</p>
                <p className="text-xs text-blue-800">
                  People情報はEvidenceから自動抽出されますが、手動で修正・補完することができます。
                </p>
              </div>
            </div>
          </ScrollArea>
          <div className="flex gap-2 mt-4 px-4">
            <Button
              className="flex-1"
              onClick={() => setShowEditDrawer(false)}
            >
              保存
            </Button>
            <Button variant="outline" onClick={() => setShowEditDrawer(false)}>
              キャンセル
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Merge People Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="max-w-2xl max-h-[calc(100vh-4rem)] flex flex-col">
          <DialogHeader>
            <DialogTitle>People統合</DialogTitle>
            <DialogDescription>
              重複している可能性があるPeopleを統合します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded p-3 bg-slate-50">
                <p className="text-xs font-semibold text-slate-700 mb-2">統合元</p>
                <p className="text-sm font-semibold text-slate-900">{selectedPerson?.name}</p>
                <p className="text-xs text-slate-600">{selectedPerson?.title}</p>
                <p className="text-xs text-slate-600 mt-1">Email: {selectedPerson?.email || "未設定"}</p>
                <p className="text-xs text-slate-600">Phone: {selectedPerson?.phone || "未設定"}</p>
                <Badge variant="outline" className="mt-2 text-xs">
                  Evidence: {selectedPerson?.evidenceCount}件
                </Badge>
              </div>
              <div className="border rounded p-3 bg-blue-50">
                <p className="text-xs font-semibold text-slate-700 mb-2">統合先候補</p>
                <p className="text-sm font-semibold text-slate-900">山田 太郎 (類似)</p>
                <p className="text-xs text-slate-600">CTO</p>
                <p className="text-xs text-slate-600 mt-1">Email: yamada@techinnov.co.jp</p>
                <p className="text-xs text-slate-600">Phone: 03-1234-5678</p>
                <Badge variant="outline" className="mt-2 text-xs">
                  Evidence: 8件
                </Badge>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <p className="text-xs font-semibold text-amber-900 mb-1">⚠️ 統合の確認</p>
              <p className="text-xs text-amber-800">
                統合すると、両方のEvidenceと関連情報が1つのPeopleに統合されます。この操作は取り消せません。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-900">統合後の名前</label>
              <Input defaultValue="山田 太郎" className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
              キャンセル
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setShowMergeDialog(false)}
            >
              統合する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Link Sheet */}
      <Sheet open={showProjectLinkSheet} onOpenChange={setShowProjectLinkSheet}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>Projectに紐付ける</SheetTitle>
            <SheetDescription>
              {selectedPerson?.name}をProjectに紐付けます
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-200px)] mt-6">
            <div className="space-y-4 px-4">
              <div className="bg-slate-50 border rounded p-3">
                <p className="text-xs font-semibold text-slate-700 mb-2">現在の紐付き</p>
                {selectedPerson?.linkedProjects && selectedPerson.linkedProjects.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedPerson.linkedProjects.map((proj, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">{proj}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">まだProjectに紐付いていません</p>
                )}
              </div>

              <Separator />

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-3">Project候補</p>
                <div className="space-y-2">
                  <div className="border rounded p-3 hover:bg-slate-50 cursor-pointer transition">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">プロジェクトA</p>
                        <p className="text-xs text-slate-600">オンボーディング支援プロジェクト</p>
                      </div>
                      <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-700">
                        Active
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 mb-2">
                      関連Evidence: 5件 | 紐付きPeople: 3名
                    </p>
                    <Button size="sm" variant="outline" className="w-full text-xs">
                      このProjectに紐付ける
                    </Button>
                  </div>

                  <div className="border rounded p-3 hover:bg-slate-50 cursor-pointer transition">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">プロジェクトB</p>
                        <p className="text-xs text-slate-600">機能拡張プロジェクト</p>
                      </div>
                      <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">
                        Planning
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 mb-2">
                      関連Evidence: 2件 | 紐付きPeople: 2名
                    </p>
                    <Button size="sm" variant="outline" className="w-full text-xs">
                      このProjectに紐付ける
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-xs text-blue-900 font-medium mb-1">💡 Project紐付けについて</p>
                <p className="text-xs text-blue-800">
                  Peopleは複数のProjectに紐付けることができます。Evidenceから自動で推薦されます。
                </p>
              </div>
            </div>
          </ScrollArea>
          <div className="flex gap-2 mt-4 px-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowProjectLinkSheet(false)}>
              閉じる
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Action Create Drawer */}
      <Sheet open={showActionCreateDrawer} onOpenChange={setShowActionCreateDrawer}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>Action作成</SheetTitle>
            <SheetDescription>
              {selectedPerson?.name}に対するActionを作成します
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-200px)] mt-6">
            <div className="space-y-4 px-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-xs font-semibold text-blue-900 mb-1">📋 対象人物</p>
                <p className="text-sm text-blue-800">{selectedPerson?.name} ({selectedPerson?.title})</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900">Actionタイトル</label>
                <Input 
                  defaultValue={`${selectedPerson?.name}様へのフォローアップ`} 
                  className="text-sm" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900">Action Type</label>
                <Select defaultValue="send_external">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="send_external">Send (外部送信)</SelectItem>
                    <SelectItem value="send_internal">Send (内部)</SelectItem>
                    <SelectItem value="push">Push (内部更新)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900">目的・詳細</label>
                <textarea
                  className="w-full min-h-[100px] text-sm border rounded-md p-2"
                  defaultValue={`${selectedPerson?.relationshipHypothesis || "関係性を深め"}について確認し、次のステップを明確にする`}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900">優先度</label>
                <Select defaultValue="medium">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900">期限</label>
                <Input type="date" className="text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900">Owner</label>
                <Input defaultValue={selectedPerson?.owner} className="text-sm" />
              </div>

              <div className="bg-slate-50 border rounded p-3">
                <p className="text-xs font-semibold text-slate-700 mb-2">関連Evidence</p>
                <p className="text-xs text-slate-600">{selectedPerson?.evidenceCount}件のEvidenceが紐付きます</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-xs text-blue-900 font-medium mb-1">💡 次のステップ</p>
                <p className="text-xs text-blue-800">
                  下書き保存後、Action Reviewページでレビュー・承認してから実行できます。
                </p>
              </div>
            </div>
          </ScrollArea>
          <div className="flex gap-2 mt-4 px-4">
            <Button
              className="flex-1"
              onClick={() => setShowActionCreateDrawer(false)}
            >
              下書き保存
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowActionCreateDrawer(false)}
            >
              レビューへ送る
            </Button>
            <Button variant="outline" onClick={() => setShowActionCreateDrawer(false)}>
              キャンセル
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Missing Role Sheet */}
      <Sheet open={showMissingRoleSheet} onOpenChange={setShowMissingRoleSheet}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>Missing Role候補追加</SheetTitle>
            <SheetDescription>
              {selectedMissingRole?.label}の候補を確認・追加します
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-200px)] mt-6">
            <div className="space-y-4 px-4">
              <div className="bg-amber-50 border border-amber-200 rounded p-3">
                <p className="text-xs font-semibold text-amber-900 mb-1">⚠️ 欠損役割</p>
                <p className="text-sm text-amber-800 font-medium">{selectedMissingRole?.roleType}</p>
                <p className="text-xs text-amber-700 mt-1">{selectedMissingRole?.description}</p>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-3">AI抽出候補</p>
                <div className="space-y-2">
                  <div className="border rounded p-3 bg-blue-50">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-semibold">
                          佐
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">佐藤 五郎</p>
                          <p className="text-xs text-slate-600">営業部長</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs bg-blue-200 text-blue-900">
                        Confidence: High
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-700 mb-2">
                      Evidence: 4件 | 「予算承認者」として議事録に記載あり
                    </p>
                    <Button size="sm" variant="outline" className="w-full text-xs">
                      この候補を追加
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-semibold text-slate-900 mb-3">手動入力</p>
                <div className="space-y-2">
                  <Input placeholder="名前" className="text-sm" />
                  <Input placeholder="役職" className="text-sm" />
                  <Input placeholder="Email (任意)" className="text-sm" />
                  <Button size="sm" className="w-full text-xs">
                    手動で追加
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-xs text-blue-900 font-medium mb-1">💡 Missing Roleについて</p>
                <p className="text-xs text-blue-800">
                  組織攻略に必要な役割が不明な場合、AIがEvidenceから候補を推薦します。手動で追加することもできます。
                </p>
              </div>
            </div>
          </ScrollArea>
          <div className="flex gap-2 mt-4 px-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowMissingRoleSheet(false)}>
              閉じる
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}