import { Button } from "./button";
import { Badge } from "./badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Filter, ChevronDown } from "lucide-react";

interface ViewOption {
  value: string;
  label: string;
  description?: string;
  isDefault?: boolean;
}

interface ViewSwitcherProps {
  currentView: string;
  views: ViewOption[];
  onViewChange: (view: string) => void;
  className?: string;
}

export function ViewSwitcher({
  currentView,
  views,
  onViewChange,
  className = "",
}: ViewSwitcherProps) {
  const currentViewOption = views.find((v) => v.value === currentView);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Filter className="w-4 h-4" />
        <span className="font-medium">View:</span>
      </div>
      
      <Select value={currentView} onValueChange={onViewChange}>
        <SelectTrigger className="w-[240px] h-9 text-sm">
          <div className="flex items-center gap-2">
            <SelectValue>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{currentViewOption?.label}</span>
                {currentViewOption?.isDefault && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    Default
                  </Badge>
                )}
              </div>
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent>
          {views.map((view) => (
            <SelectItem key={view.value} value={view.value}>
              <div className="flex items-center justify-between gap-3 w-full">
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{view.label}</div>
                  {view.description && (
                    <div className="text-xs text-slate-500 mt-0.5">{view.description}</div>
                  )}
                </div>
                {view.isDefault && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    Default
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
