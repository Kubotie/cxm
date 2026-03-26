import { Badge } from "./badge";

interface ViewContextHeaderProps {
  pageName: string;
  currentView: string;
  subtitle: string;
  className?: string;
}

export function ViewContextHeader({
  pageName,
  currentView,
  subtitle,
  className = "",
}: ViewContextHeaderProps) {
  return (
    <div className={`${className}`}>
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{pageName}</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">•</span>
          <Badge variant="outline" className="text-sm font-semibold bg-slate-50 text-slate-700 border-slate-300">
            {currentView}
          </Badge>
        </div>
      </div>
      <p className="text-sm text-slate-600 mt-1">{subtitle}</p>
    </div>
  );
}
