import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Badge } from "../ui/badge";
import { History, Edit3, CheckCircle2, AlertTriangle } from "lucide-react";

interface ChangeHistoryEntry {
  id: string;
  timestamp: string;
  user: string;
  action: "created" | "updated" | "enabled" | "disabled";
  changes: Array<{
    field: string;
    oldValue: string;
    newValue: string;
  }>;
}

interface RuleChangeHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleName: string;
}

const mockHistory: ChangeHistoryEntry[] = [
  {
    id: "3",
    timestamp: "2024-03-15 14:30",
    user: "佐藤 Manager",
    action: "updated",
    changes: [
      {
        field: "Trigger Condition",
        oldValue: "Waiting > 36h",
        newValue: "Waiting > 48h",
      },
    ],
  },
  {
    id: "2",
    timestamp: "2024-03-10 09:15",
    user: "田中 Admin",
    action: "enabled",
    changes: [],
  },
  {
    id: "1",
    timestamp: "2024-03-01 16:45",
    user: "田中 Admin",
    action: "created",
    changes: [],
  },
];

export function RuleChangeHistorySheet({
  open,
  onOpenChange,
  ruleName,
}: RuleChangeHistorySheetProps) {
  const getActionBadge = (action: ChangeHistoryEntry["action"]) => {
    switch (action) {
      case "created":
        return (
          <Badge className="bg-blue-100 text-blue-700">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            作成
          </Badge>
        );
      case "updated":
        return (
          <Badge className="bg-slate-100 text-slate-700">
            <Edit3 className="w-3 h-3 mr-1" />
            更新
          </Badge>
        );
      case "enabled":
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            有効化
          </Badge>
        );
      case "disabled":
        return (
          <Badge className="bg-orange-100 text-orange-700">
            <AlertTriangle className="w-3 h-3 mr-1" />
            無効化
          </Badge>
        );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            変更履歴
          </SheetTitle>
          <SheetDescription>
            {ruleName} の変更履歴を表示しています。
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {/* Timeline */}
          <div className="space-y-6">
            {mockHistory.map((entry, index) => (
              <div key={entry.id} className="relative">
                {/* Timeline line */}
                {index < mockHistory.length - 1 && (
                  <div className="absolute left-4 top-8 bottom-0 w-px bg-slate-200" />
                )}

                <div className="flex gap-4">
                  {/* Timeline dot */}
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center">
                      <History className="w-4 h-4 text-slate-600" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getActionBadge(entry.action)}
                          <span className="text-sm font-medium text-slate-900">
                            {entry.user}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">
                          {entry.timestamp}
                        </span>
                      </div>

                      {/* Changes */}
                      {entry.changes.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {entry.changes.map((change, idx) => (
                            <div
                              key={idx}
                              className="bg-white border border-slate-200 rounded p-3 text-sm"
                            >
                              <p className="font-semibold text-slate-700 mb-2">
                                {change.field}
                              </p>
                              <div className="flex items-start gap-2">
                                <div className="flex-1">
                                  <p className="text-xs text-slate-500 mb-1">変更前:</p>
                                  <p className="text-slate-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                                    {change.oldValue}
                                  </p>
                                </div>
                                <div className="flex items-center px-2">
                                  →
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs text-slate-500 mb-1">変更後:</p>
                                  <p className="text-slate-600 bg-green-50 px-2 py-1 rounded border border-green-200">
                                    {change.newValue}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {entry.action === "created" && (
                        <p className="mt-2 text-sm text-slate-600">
                          このルールが作成されました。
                        </p>
                      )}

                      {entry.action === "enabled" && (
                        <p className="mt-2 text-sm text-slate-600">
                          このルールが有効化され、アラート生成が開始されました。
                        </p>
                      )}

                      {entry.action === "disabled" && (
                        <p className="mt-2 text-sm text-slate-600">
                          このルールが無効化され、アラート生成が停止されました。
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty state */}
          {mockHistory.length === 0 && (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">変更履歴がありません</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
