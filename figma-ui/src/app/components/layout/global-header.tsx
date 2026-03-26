import { Bell, User } from "lucide-react";
import { Badge } from "../ui/badge";

type CurrentView = "Console" | "Company" | "Project" | "Cross-project analytics" | "Cross-scope" | "Mixed" | "System" | null;

interface GlobalHeaderProps {
  currentView?: CurrentView;
}

export function GlobalHeader({ currentView }: GlobalHeaderProps) {
  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6">
      {/* Left side: Reserved for future notifications/announcements */}
      <div className="flex items-center gap-4">
        {/* Future notification area */}
      </div>
      
      <div className="flex items-center gap-4">
        <button className="relative p-2 hover:bg-slate-100 rounded-md">
          <Bell className="w-5 h-5 text-slate-600" />
          <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500">
            3
          </Badge>
        </button>
        <button className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-md">
          <User className="w-5 h-5 text-slate-600" />
          <span className="text-sm text-slate-700">CSM User</span>
        </button>
      </div>
    </header>
  );
}