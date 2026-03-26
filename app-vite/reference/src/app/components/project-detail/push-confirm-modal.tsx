import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { Play, Users, FileText, Target, Calendar } from "lucide-react";

interface PushConfirmModalProps {
  open: boolean;
  onClose: () => void;
}

export function PushConfirmModal({ open, onClose }: PushConfirmModalProps) {
  
  // Mock push data
  const pushData = {
    action_id: "act_002",
    action_title: "新機能ベータテスト依頼",
    action_type: "outreach",
    status: "ready",
    audience_scope: "Project",
    audience_id: "proj_abc123",
    owner: "CSM佐藤",
    due_date: "2024-03-14",
    push_targets: [
      {
        user_name: "田中太郎",
        role: "Champion",
        email: "tanaka@sample.co.jp",
      },
      {
        user_name: "鈴木一郎",
        role: "Champion",
        email: "suzuki@sample.co.jp",
      },
    ],
    evidence_refs: [
      {
        id: "ev_1",
        source: "Product Usage",
        summary: "キャンペーン作成数が通常の3倍に増加",
        timestamp: "2024-03-12 11:00",
      },
      {
        id: "ev_2",
        source: "Slack",
        summary: "新機能のUIが分かりづらいとの報告",
        timestamp: "2024-03-12 14:30",
      },
      {
        id: "ev_3",
        source: "Minutes",
        summary: "次四半期の展開計画についてディスカッション",
        timestamp: "2024-03-11 16:00",
      },
    ],
  };

  const getScopeBadge = (scope: string) => {
    const colors = {
      Company: "bg-purple-100 text-purple-700",
      Project: "bg-blue-100 text-blue-700",
      User: "bg-emerald-100 text-emerald-700",
    };
    return <Badge className={`text-xs ${colors[scope as keyof typeof colors]}`}>{scope}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[calc(100vh-4rem)] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="w-5 h-5 text-blue-600" />
            Push実行確認
          </DialogTitle>
          <DialogDescription>
            このActionをPushします。Evidence、対象、期限を確認してください。
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Action Info */}
            <div className="bg-slate-50 rounded-lg p-4 border">
              <h3 className="text-sm font-medium text-slate-700 mb-3">Action情報</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-slate-600 min-w-24">Action:</span>
                  <span className="text-slate-900 font-medium">
                    {pushData.action_title}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-600 min-w-24">Type:</span>
                  <Badge variant="outline" className="text-xs">
                    {pushData.action_type}
                  </Badge>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-600 min-w-24">Scope:</span>
                  {getScopeBadge(pushData.audience_scope)}
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-600 min-w-24">Owner:</span>
                  <div className="flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-slate-600" />
                    <span className="text-slate-900 font-medium">{pushData.owner}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-600 min-w-24">期限:</span>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-600" />
                    <span className="text-slate-900 font-medium">{pushData.due_date}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Push Targets */}
            <div className="bg-slate-50 rounded-lg p-4 border">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-medium text-slate-700">Push対象</h3>
                <Badge variant="secondary" className="text-xs">
                  {pushData.push_targets.length}名
                </Badge>
              </div>

              <div className="space-y-2">
                {pushData.push_targets.map((target, idx) => (
                  <div 
                    key={idx}
                    className="bg-white border rounded p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-slate-900 font-medium">
                        {target.user_name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {target.role}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600">{target.email}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Evidence (Required) */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-blue-700" />
                <h3 className="text-sm font-medium text-blue-900">Evidence（必須）</h3>
                <Badge className="text-xs bg-blue-100 text-blue-700">
                  {pushData.evidence_refs.length}件
                </Badge>
              </div>

              <div className="space-y-2">
                {pushData.evidence_refs.map((evidence) => (
                  <div 
                    key={evidence.id}
                    className="bg-white border rounded p-3"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1">
                        <Badge variant="outline" className="text-xs mb-2">
                          {evidence.source}
                        </Badge>
                        <p className="text-sm text-slate-900">{evidence.summary}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 mt-2">{evidence.timestamp}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 text-sm text-blue-800">
                ✓ Evidence が確認されています。Push実行可能です。
              </div>
            </div>

            {/* Info */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-4">
              <div className="text-sm text-slate-700">
                <p className="mb-2">
                  <strong>Push後の動作:</strong>
                </p>
                <ul className="space-y-1 text-xs">
                  <li>• Actionのステータスが「Pushed」に変更されます</li>
                  <li>• 送信チャネル（Intercom/Email）の選択が可能になります</li>
                  <li>• Push後にSalesforce同期が可能になります</li>
                </ul>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => {
              // Push logic here
              alert("Push実行が完了しました");
              onClose();
            }}
          >
            <Play className="w-4 h-4 mr-2" />
            Push実行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}