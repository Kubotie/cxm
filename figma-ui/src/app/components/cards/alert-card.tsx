import { Badge } from "../ui/badge";
import { AlertTriangle, Info, TrendingUp } from "lucide-react";

export interface AlertCardProps {
  id: string;
  type: "risk" | "opportunity" | "info";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  evidenceCount: number;
  timestamp: string;
}

const typeConfig = {
  risk: {
    icon: AlertTriangle,
    colors: {
      high: "bg-red-50 border-red-200 text-red-900",
      medium: "bg-orange-50 border-orange-200 text-orange-900",
      low: "bg-yellow-50 border-yellow-200 text-yellow-900",
    },
  },
  opportunity: {
    icon: TrendingUp,
    colors: {
      high: "bg-emerald-50 border-emerald-200 text-emerald-900",
      medium: "bg-blue-50 border-blue-200 text-blue-900",
      low: "bg-sky-50 border-sky-200 text-sky-900",
    },
  },
  info: {
    icon: Info,
    colors: {
      high: "bg-slate-50 border-slate-200 text-slate-900",
      medium: "bg-slate-50 border-slate-200 text-slate-900",
      low: "bg-slate-50 border-slate-200 text-slate-900",
    },
  },
};

export function AlertCard({
  type,
  severity,
  title,
  description,
  evidenceCount,
  timestamp,
}: AlertCardProps) {
  const config = typeConfig[type];
  const Icon = config.icon;
  const colorClass = config.colors[severity];

  return (
    <div className={`border rounded-lg p-3 ${colorClass}`}>
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold">{title}</h4>
            <Badge variant="outline" className="text-xs">
              {severity}
            </Badge>
          </div>
          <p className="text-xs mb-2">{description}</p>
          <div className="flex items-center gap-3 text-xs opacity-80">
            <span>Evidence: {evidenceCount}件</span>
            <span>{timestamp}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
