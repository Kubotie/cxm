import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Building, Mail, Phone, CheckCircle2 } from "lucide-react";

export interface PeopleCardProps {
  id: string;
  name: string;
  role?: string;
  company: string;
  email?: string;
  phone?: string;
  status: "candidate" | "confirmed" | "proposed" | "unresolved";
  evidenceCount: number;
  missingFields?: string[];
  relationshipHypothesis?: string;
}

export function PeopleCard({
  id,
  name,
  role,
  company,
  email,
  phone,
  status,
  evidenceCount,
  missingFields,
  relationshipHypothesis,
}: PeopleCardProps) {
  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-slate-900">{name}</h4>
            {status === "confirmed" && (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
          </div>
          {role && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-1">
              <Building className="w-3 h-3" />
              <span>{role}</span>
            </div>
          )}
          <div className="text-xs text-slate-500 mb-2">{company}</div>
          
          {(email || phone) && (
            <div className="space-y-1 mb-2">
              {email && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Mail className="w-3 h-3" />
                  <span>{email}</span>
                </div>
              )}
              {phone && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Phone className="w-3 h-3" />
                  <span>{phone}</span>
                </div>
              )}
            </div>
          )}

          <div className="text-xs text-slate-500 mb-2">
            Evidence: {evidenceCount}件
          </div>

          {relationshipHypothesis && (
            <div className="text-xs text-slate-600 bg-blue-50 p-2 rounded mb-2">
              関係性: {relationshipHypothesis}
            </div>
          )}

          {missingFields && missingFields.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {missingFields.map((field) => (
                <Badge key={field} variant="outline" className="text-xs bg-amber-50">
                  {field}未入力
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {status === "candidate" && (
          <Button size="sm" className="text-xs h-7">
            確定
          </Button>
        )}
        <Button variant="outline" size="sm" className="text-xs h-7">
          詳細
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-7">
          Evidence
        </Button>
      </div>
    </div>
  );
}
