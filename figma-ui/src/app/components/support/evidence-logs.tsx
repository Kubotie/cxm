import { Link } from "react-router";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { 
  FileText, 
  ArrowRight, 
  Lightbulb,
  BookOpen,
  Target,
  Send,
  Zap,
} from "lucide-react";

interface EvidenceLog {
  type: string;
  timestamp: string;
  user: string;
  company?: string;
  content: string;
  channel: string;
  caseId: string;
}

interface SuggestedAction {
  type: string;
  label: string;
}

interface EvidenceLogsProps {
  evidence: string;
  evidenceLog?: EvidenceLog;
  suggestedActions?: SuggestedAction[];
  queueLink?: string;
}

export function EvidenceLogs({ evidence, evidenceLog, suggestedActions, queueLink }: EvidenceLogsProps) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-600" />
          Why This Matters
        </div>
        <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded p-3">
          {evidence}
        </p>
      </div>

      {/* Evidence Log - Single Log */}
      {evidenceLog && (
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            Evidence Log (実際のログ)
          </div>
          <div className={`p-3 border rounded-lg ${
            evidenceLog.type === 'intercom' ? 'bg-blue-50 border-blue-200' :
            evidenceLog.type === 'slack' ? 'bg-purple-50 border-purple-200' :
            evidenceLog.type === 'chatwork' ? 'bg-green-50 border-green-200' :
            evidenceLog.type === 'cse_ticket' ? 'bg-amber-50 border-amber-200' :
            'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-xs ${
                  evidenceLog.type === 'intercom' ? 'bg-blue-100 border-blue-300 text-blue-700' :
                  evidenceLog.type === 'slack' ? 'bg-purple-100 border-purple-300 text-purple-700' :
                  evidenceLog.type === 'chatwork' ? 'bg-green-100 border-green-300 text-green-700' :
                  evidenceLog.type === 'cse_ticket' ? 'bg-amber-100 border-amber-300 text-amber-700' :
                  'bg-slate-100 border-slate-300 text-slate-700'
                }`}>
                  {evidenceLog.channel}
                </Badge>
                <span className="text-xs text-slate-600 font-mono">{evidenceLog.timestamp}</span>
              </div>
              <Link to={`/support/${evidenceLog.caseId}`}>
                <Button size="sm" variant="ghost" className="h-6 text-xs">
                  Case詳細
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="text-xs font-semibold text-slate-900 mb-1">
              {evidenceLog.user} {evidenceLog.company && `(${evidenceLog.company})`}
            </div>
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {evidenceLog.content}
            </div>
          </div>
        </div>
      )}

      {/* Suggested Actions */}
      {suggestedActions && suggestedActions.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-2">Suggested Actions</div>
          <div className="flex flex-wrap gap-2">
            {suggestedActions.map((action, idx) => (
              <Button key={idx} size="sm" variant="outline" className="h-8 text-xs bg-white">
                {action.type === 'faq' && <BookOpen className="w-3 h-3 mr-1" />}
                {action.type === 'help' && <FileText className="w-3 h-3 mr-1" />}
                {action.type === 'content' && <FileText className="w-3 h-3 mr-1" />}
                {action.type === 'action' && <Target className="w-3 h-3 mr-1" />}
                {action.type === 'outbound' && <Send className="w-3 h-3 mr-1" />}
                {action.type === 'escalation' && <Zap className="w-3 h-3 mr-1" />}
                {action.type === 'product' && <Target className="w-3 h-3 mr-1" />}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {queueLink && (
        <div className="flex gap-2 pt-2 border-t">
          <Link to={queueLink}>
            <Button size="sm" className="bg-slate-600 hover:bg-slate-700">
              関連案件を確認
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}