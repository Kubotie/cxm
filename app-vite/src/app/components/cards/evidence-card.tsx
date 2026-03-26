import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ExternalLink, FileText, Mail, MessageSquare } from "lucide-react";

export interface EvidenceCardProps {
  id: string;
  date: string;
  title: string;
  sourceType: "mail" | "minutes" | "support" | "inquiry" | "ticket" | "log";
  messageType: string;
  status: "unprocessed" | "proposal_generated" | "confirmed" | "synced";
  scope: string;
  ownerRole?: string;
  excerpt?: string;
  sourceUrl?: string;
  onExtract?: (id: string) => void;
  onReview?: (id: string) => void;
  onViewSource?: (id: string) => void;
}

const sourceIcons = {
  mail: Mail,
  minutes: FileText,
  support: MessageSquare,
  inquiry: MessageSquare,
  ticket: MessageSquare,
  log: FileText,
};

const statusColors = {
  unprocessed: "bg-amber-100 text-amber-800 border-amber-200",
  proposal_generated: "bg-blue-100 text-blue-800 border-blue-200",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  synced: "bg-slate-100 text-slate-600 border-slate-200",
};

const statusLabels = {
  unprocessed: "未処理",
  proposal_generated: "提案生成済",
  confirmed: "確定済",
  synced: "同期済",
};

export function EvidenceCard({
  id,
  date,
  title,
  sourceType,
  messageType,
  status,
  scope,
  ownerRole,
  excerpt,
  sourceUrl,
  onExtract,
  onReview,
  onViewSource,
}: EvidenceCardProps) {
  const SourceIcon = sourceIcons[sourceType];

  return (
    <div className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3 mb-2">
        <SourceIcon className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs text-slate-500">{date}</span>
            <Badge variant="outline" className={`text-xs ${statusColors[status]}`}>
              {statusLabels[status]}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {sourceType}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {messageType}
            </Badge>
          </div>
          <h4 className="text-sm font-medium text-slate-900 mb-1">{title}</h4>
          {excerpt && (
            <p className="text-xs text-slate-600 line-clamp-2 mb-2">{excerpt}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Scope: {scope}</span>
            {ownerRole && <span>Owner: {ownerRole}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        {sourceUrl && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => onViewSource?.(id)}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            原文
          </Button>
        )}
        {status === "unprocessed" && (
          <>
            <Button
              size="sm"
              className="text-xs h-7"
              onClick={() => onExtract?.(id)}
            >
              AIで抽出
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => onReview?.(id)}
            >
              レビューへ
            </Button>
          </>
        )}
      </div>
    </div>
  );
}