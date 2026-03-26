import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import {
  Mail,
  Phone,
  Eye,
  Edit,
  CheckCircle,
  FileText,
  Sparkles,
  Link as LinkIcon,
  GitMerge,
} from "lucide-react";

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

interface PeopleDetailPanelProps {
  person: Person;
  onClose: () => void;
  onShowEvidence: () => void;
  onShowActionCreate: () => void;
  onShowEdit: () => void;
  onShowConfirm: () => void;
  onShowProjectLink: () => void;
  onShowMerge: () => void;
}

export function PeopleDetailPanel({
  person,
  onClose,
  onShowEvidence,
  onShowActionCreate,
  onShowEdit,
  onShowConfirm,
  onShowProjectLink,
  onShowMerge,
}: PeopleDetailPanelProps) {
  return (
    <div className="absolute top-0 right-0 bottom-0 w-80 flex flex-col border-l bg-white shadow-xl z-10">
      <div className="p-3 border-b bg-slate-50 flex items-start justify-between flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
            person.status === "confirmed" ? "bg-emerald-500 text-white" :
            person.status === "proposed" ? "bg-blue-500 text-white" :
            "bg-amber-500 text-white"
          }`}>
            {person.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 mb-0.5 truncate">{person.name}</h3>
            <div className="text-xs text-slate-600 truncate">{person.title || person.role}</div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 flex-shrink-0 ml-2"
          onClick={onClose}
        >
          ✕
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Contact Info */}
          <div>
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Contact Info</h4>
            <div className="space-y-2">
              {person.email ? (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-700">{person.email}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email未登録</span>
                </div>
              )}
              {person.phone ? (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-700">{person.phone}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Phone className="w-3.5 h-3.5" />
                  <span>Phone未登録</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Relationship & Influence */}
          <div>
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Relationship & Influence</h4>
            <div className="bg-slate-50 border rounded p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Contact Status:</span>
                <Badge variant="outline" className={`text-xs ${
                  person.contactStatus === "active" ? "bg-emerald-100 text-emerald-700" :
                  person.contactStatus === "not contacted" ? "bg-red-100 text-red-700" :
                  "bg-slate-100"
                }`}>
                  {person.contactStatus}
                </Badge>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Decision Influence:</span>
                <Badge variant="outline" className={`text-xs ${
                  person.decisionInfluence === "high" ? "bg-red-100 text-red-700" :
                  person.decisionInfluence === "medium" ? "bg-amber-100 text-amber-700" :
                  "bg-slate-100"
                }`}>
                  {person.decisionInfluence}
                </Badge>
              </div>
              {person.owner && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Owner:</span>
                  <span className="font-medium text-slate-900">{person.owner}</span>
                </div>
              )}
              {person.lastTouchpoint && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Last Touchpoint:</span>
                  <span className="font-medium text-slate-900">{person.lastTouchpoint}</span>
                </div>
              )}
            </div>
            
            {person.relationshipHypothesis && (
              <div className="mt-2 bg-blue-50 border border-blue-200 rounded p-2">
                <p className="text-xs text-blue-900 italic">
                  {person.relationshipHypothesis}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Linked Info */}
          <div>
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Linked Info</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs bg-slate-50 border rounded p-2">
                <span className="text-slate-600">Evidence Count:</span>
                <Badge variant="outline" className="text-xs">{person.evidenceCount}</Badge>
              </div>
              {person.linkedActions !== undefined && (
                <div className="flex items-center justify-between text-xs bg-slate-50 border rounded p-2">
                  <span className="text-slate-600">Linked Actions:</span>
                  <Badge variant="outline" className="text-xs">{person.linkedActions}</Badge>
                </div>
              )}
              {person.linkedContentJobs !== undefined && (
                <div className="flex items-center justify-between text-xs bg-slate-50 border rounded p-2">
                  <span className="text-slate-600">Content Jobs:</span>
                  <Badge variant="outline" className="text-xs">{person.linkedContentJobs}</Badge>
                </div>
              )}
              {person.linkedProjects && person.linkedProjects.length > 0 && (
                <div className="text-xs bg-slate-50 border rounded p-2">
                  <div className="text-slate-600 mb-1">Linked Projects:</div>
                  <div className="flex flex-wrap gap-1">
                    {person.linkedProjects.map((proj, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">{proj}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {person.missingFields && person.missingFields.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs font-semibold text-amber-900 uppercase tracking-wide mb-2">Missing Fields</h4>
                <div className="bg-amber-50 border border-amber-200 rounded p-2">
                  <div className="flex flex-wrap gap-1">
                    {person.missingFields.map((field, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs bg-white text-amber-800">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Next Actions */}
          <div>
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Next Actions</h4>
            <div className="space-y-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full text-xs justify-start"
                onClick={onShowEvidence}
              >
                <Eye className="w-3 h-3 mr-2" />
                Evidenceを見る
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full text-xs justify-start"
              >
                <FileText className="w-3 h-3 mr-2" />
                Unified Company Logで確認
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full text-xs justify-start"
                onClick={onShowActionCreate}
              >
                <Sparkles className="w-3 h-3 mr-2" />
                Actionを作成
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full text-xs justify-start"
                onClick={onShowEdit}
              >
                <Edit className="w-3 h-3 mr-2" />
                People情報を編集
              </Button>
              {person.status !== "confirmed" && (
                <Button 
                  size="sm" 
                  className="w-full text-xs justify-start bg-emerald-600 hover:bg-emerald-700"
                  onClick={onShowConfirm}
                >
                  <CheckCircle className="w-3 h-3 mr-2" />
                  Peopleを確定
                </Button>
              )}
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full text-xs justify-start"
                onClick={onShowProjectLink}
              >
                <LinkIcon className="w-3 h-3 mr-2" />
                Projectに紐付ける
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full text-xs justify-start"
                onClick={onShowMerge}
              >
                <GitMerge className="w-3 h-3 mr-2" />
                People統合
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}