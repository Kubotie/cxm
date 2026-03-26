import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Clock, CheckSquare } from "lucide-react";

export interface CompanyCardProps {
  id: string;
  name: string;
  phaseLabel: string;
  unprocessedMinutes: number;
  riskLevel: "high" | "medium" | "low" | "none";
  opportunityLevel: "high" | "medium" | "low" | "none";
  openActions: number;
  lastContact: string;
  owner: string;
}

const riskColors = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-orange-100 text-orange-800 border-orange-200",
  low: "bg-yellow-100 text-yellow-800 border-yellow-200",
  none: "bg-slate-100 text-slate-600 border-slate-200",
};

const opportunityColors = {
  high: "bg-emerald-100 text-emerald-800 border-emerald-200",
  medium: "bg-blue-100 text-blue-800 border-blue-200",
  low: "bg-sky-100 text-sky-800 border-sky-200",
  none: "bg-slate-100 text-slate-600 border-slate-200",
};

export function CompanyCard({
  id,
  name,
  phaseLabel,
  unprocessedMinutes,
  riskLevel,
  opportunityLevel,
  openActions,
  lastContact,
  owner,
}: CompanyCardProps) {
  return (
    <Link href={`/company/${id}`}>
      <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-slate-300">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 mb-1">{name}</h3>
            <Badge variant="outline" className="text-xs">
              {phaseLabel}
            </Badge>
          </div>
          <div className="text-xs text-slate-500">{owner}</div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-slate-400" />
            <Badge variant="outline" className={`text-xs ${riskColors[riskLevel]}`}>
              Risk: {riskLevel}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <Badge variant="outline" className={`text-xs ${opportunityColors[opportunityLevel]}`}>
              Opp: {opportunityLevel}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-medium">{unprocessedMinutes}</span>
            <span>未処理Minutes</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckSquare className="w-3.5 h-3.5" />
            <span className="font-medium">{openActions}</span>
            <span>未完了Action</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t text-xs text-slate-500">
          最終接点: {lastContact}
        </div>
      </Card>
    </Link>
  );
}
