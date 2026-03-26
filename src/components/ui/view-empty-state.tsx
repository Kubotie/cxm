import { Button } from "./button";
import { FileX, ArrowRight } from "lucide-react";

interface ViewEmptyStateProps {
  title: string;
  description: string;
  currentView: string;
  cta?: {
    label: string;
    action: () => void;
  };
  className?: string;
}

export function ViewEmptyState({
  title,
  description,
  currentView,
  cta,
  className = "",
}: ViewEmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 ${className}`}>
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <FileX className="w-8 h-8 text-slate-400" />
      </div>
      
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 text-center max-w-md mb-1">{description}</p>
      
      <div className="text-xs text-slate-500 mt-1 mb-4">
        現在のView: <span className="font-semibold text-slate-700">{currentView}</span>
      </div>
      
      {cta && (
        <Button
          variant="outline"
          size="sm"
          onClick={cta.action}
          className="mt-2"
        >
          {cta.label}
          <ArrowRight className="w-3 h-3 ml-2" />
        </Button>
      )}
    </div>
  );
}
