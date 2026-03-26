import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { FileText, Send, Users, AlertCircle } from "lucide-react";

export interface ActionCardProps {
  id: string;
  title: string;
  type: "push" | "send_internal" | "send_external";
  status: "draft" | "pending_review" | "approved" | "sent";
  targetScope: string;
  evidenceCount: number;
  confidence?: "high" | "medium" | "low";
  missingFields?: string[];
}

const typeLabels = {
  push: "Push",
  send_internal: "社内送信",
  send_external: "外部送信",
};

const typeColors = {
  push: "bg-blue-100 text-blue-800 border-blue-200",
  send_internal: "bg-emerald-100 text-emerald-800 border-emerald-200",
  send_external: "bg-red-100 text-red-800 border-red-200",
};

const statusLabels = {
  draft: "下書き",
  pending_review: "レビュー待ち",
  approved: "承認済",
  sent: "送信済",
};

export function ActionCard({
  id,
  title,
  type,
  status,
  targetScope,
  evidenceCount,
  confidence,
  missingFields,
}: ActionCardProps) {
  const isDangerous = type === "send_external";

  return (
    <div className={`border rounded-lg p-4 bg-white ${isDangerous ? "border-red-200" : ""}`}>
      <div className="flex items-start gap-3 mb-3">
        <FileText className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className={`text-xs ${typeColors[type]}`}>
              {typeLabels[type]}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {statusLabels[status]}
            </Badge>
            {confidence && (
              <Badge variant="outline" className="text-xs">
                信頼度: {confidence}
              </Badge>
            )}
          </div>
          <h4 className="text-sm font-medium text-slate-900 mb-2">{title}</h4>
          <div className="flex items-center gap-3 text-xs text-slate-600 mb-2">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              Target: {targetScope}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Evidence: {evidenceCount}件
            </span>
          </div>
          {missingFields && missingFields.length > 0 && (
            <div className="flex items-start gap-1 text-xs text-amber-700 bg-amber-50 p-2 rounded">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>Missing: {missingFields.join(", ")}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {status === "draft" && (
          <Button size="sm" className="text-xs h-7">
            レビューへ
          </Button>
        )}
        {status === "pending_review" && (
          <Button size="sm" className="text-xs h-7">
            承認
          </Button>
        )}
        {status === "approved" && type === "push" && (
          <Button size="sm" className="text-xs h-7">
            <Send className="w-3 h-3 mr-1" />
            Push
          </Button>
        )}
        {status === "approved" && type === "send_internal" && (
          <Button size="sm" className="text-xs h-7">
            <Send className="w-3 h-3 mr-1" />
            社内送信
          </Button>
        )}
        {status === "approved" && type === "send_external" && (
          <Button size="sm" variant="destructive" className="text-xs h-7">
            <Send className="w-3 h-3 mr-1" />
            外部送信
          </Button>
        )}
        <Button variant="outline" size="sm" className="text-xs h-7">
          編集
        </Button>
      </div>
    </div>
  );
}
