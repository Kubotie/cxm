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
import { Database, AlertTriangle, CheckCircle2 } from "lucide-react";

interface SyncConfirmModalProps {
  open: boolean;
  onClose: () => void;
}

export function SyncConfirmModal({ open, onClose }: SyncConfirmModalProps) {
  
  // Mock sync data
  const syncData = {
    action_id: "act_003",
    action_title: "活用事例ヒアリング依頼",
    status: "pushed",
    pushed_at: "2024-03-12 09:30",
    salesforce_object: "Task",
    sync_destination: "Salesforce (Production)",
    changes: [
      {
        field: "Subject",
        current_value: "-",
        new_value: "活用事例ヒアリング依頼",
      },
      {
        field: "Status",
        current_value: "-",
        new_value: "In Progress",
      },
      {
        field: "Priority",
        current_value: "-",
        new_value: "High",
      },
      {
        field: "WhoId",
        current_value: "-",
        new_value: "Contact: 田中太郎 (003XXXXXXXX)",
      },
      {
        field: "Description",
        current_value: "-",
        new_value: "Project活用状況のヒアリングと成功事例の収集を実施",
      },
    ],
    prerequisites: {
      is_pushed: true,
      has_evidence: true,
      has_recipients: true,
    },
  };

  const canSync = Object.values(syncData.prerequisites).every(v => v);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[calc(100vh-4rem)] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Salesforce同期確認（危険操作）
          </DialogTitle>
          <DialogDescription>
            この操作は外部システムへの同期を伴います。差分を慎重に確認してください。
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Prerequisites Check */}
            <div className="bg-slate-50 rounded-lg p-4 border">
              <h3 className="text-sm font-medium text-slate-700 mb-3">前提条件チェック</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {syncData.prerequisites.is_pushed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                  )}
                  <span className={syncData.prerequisites.is_pushed ? "text-slate-900" : "text-orange-700"}>
                    Actionが Push済み
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {syncData.prerequisites.has_evidence ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                  )}
                  <span className={syncData.prerequisites.has_evidence ? "text-slate-900" : "text-orange-700"}>
                    Evidence が紐付いている
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {syncData.prerequisites.has_recipients ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                  )}
                  <span className={syncData.prerequisites.has_recipients ? "text-slate-900" : "text-orange-700"}>
                    送信象が解決済み
                  </span>
                </div>
              </div>
            </div>

            {/* Action Info */}
            <div className="bg-slate-50 rounded-lg p-4 border">
              <h3 className="text-sm font-medium text-slate-700 mb-3">Action情報</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-slate-600 min-w-32">Action:</span>
                  <span className="text-slate-900 font-medium">
                    {syncData.action_title}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-600 min-w-32">Status:</span>
                  <Badge className="text-xs bg-emerald-100 text-emerald-700">
                    {syncData.status}
                  </Badge>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-600 min-w-32">Push日時:</span>
                  <span className="text-slate-900">{syncData.pushed_at}</span>
                </div>
              </div>
            </div>

            {/* Sync Destination */}
            <div className="bg-slate-50 rounded-lg p-4 border">
              <h3 className="text-sm font-medium text-slate-700 mb-3">同期先情報</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-slate-600 min-w-32">同期先:</span>
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-600" />
                    <span className="text-slate-900 font-medium">
                      {syncData.sync_destination}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-600 min-w-32">Object:</span>
                  <Badge variant="outline" className="text-xs">
                    {syncData.salesforce_object}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Changes/Diff */}
            <div className="bg-slate-50 rounded-lg p-4 border">
              <h3 className="text-sm font-medium text-slate-700 mb-3">同期内容（差分）</h3>
              <div className="space-y-2">
                {syncData.changes.map((change, idx) => (
                  <div 
                    key={idx}
                    className="bg-white border rounded p-3"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-medium text-slate-700 min-w-28">
                        {change.field}
                      </span>
                      <div className="flex-1 text-sm">
                        {change.current_value !== "-" && (
                          <div className="mb-1">
                            <span className="text-xs text-slate-500">現在値: </span>
                            <span className="text-slate-600 line-through">
                              {change.current_value}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-xs text-slate-500">新規値: </span>
                          <span className="text-slate-900 font-medium">
                            {change.new_value}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-orange-900 mb-1">
                    外部システム同期の確認
                  </h3>
                  <ul className="text-sm text-orange-800 space-y-1">
                    <li>• Salesforce本番環境にデータが作成されます</li>
                    <li>• 同期後の取り消しはできません</li>
                    <li>• 同期内容を慎重に確認してから実行してください</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button 
            className="bg-indigo-600 hover:bg-indigo-700"
            disabled={!canSync}
            onClick={() => {
              // Sync logic here
              alert("Salesforce同期が完了しました");
              onClose();
            }}
          >
            <Database className="w-4 h-4 mr-2" />
            同期する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}