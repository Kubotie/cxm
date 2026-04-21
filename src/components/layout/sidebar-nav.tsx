"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building, Inbox, BookOpen, Settings, CheckSquare, Edit3, Shield, ChevronLeft, ChevronRight, FolderKanban, Send, Users, Calendar, Headphones, GitBranch, Activity, Zap, ClipboardList, SlidersHorizontal } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

const navItems = [
  {
    title: "Console",
    icon: LayoutDashboard,
    href: "/console",
  },
  {
    title: "Company",
    icon: Building,
    href: "/companies",
  },
  {
    title: "Projects",
    icon: FolderKanban,
    href: "/projects",
  },
  {
    title: "Inbox",
    icon: Inbox,
    href: "/inbox",
  },
  {
    title: "Support",
    icon: Headphones,
    href: "/support",
  },
  {
    title: "Actions",
    icon: CheckSquare,
    href: "/actions",
  },
  {
    title: "Content",
    icon: Edit3,
    href: "/content",
  },
  {
    title: "Library",
    icon: BookOpen,
    href: "/library",
  },
  {
    title: "Audience",
    icon: Users,
    href: "/audience",
  },
  {
    title: "Event",
    icon: Calendar,
    href: "/events",
  },
  {
    title: "Outbound",
    icon: Send,
    href: "/outbound",
  },
  {
    title: "Automation",
    icon: GitBranch,
    href: "/automation",
  },
  {
    title: "Audit",
    icon: Shield,
    href: "/governance",
  },
  {
    title: "Policies",
    icon: SlidersHorizontal,
    href: "/ops/policies",
  },
  {
    title: "Mut.Logs",
    icon: Activity,
    href: "/ops/company-mutation-logs",
  },
  {
    title: "SF Ops",
    icon: Zap,
    href: "/ops/salesforce",
  },
  {
    title: "SF DataPrep",
    icon: ClipboardList,
    href: "/ops/sf-data-prep",
  },
  {
    title: "Settings",
    icon: Settings,
    href: "/settings",
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("sidebar-collapsed");
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  return (
    <TooltipProvider delayDuration={200}>
      <aside className={`border-r bg-slate-50 flex flex-col transition-all ${isCollapsed ? 'w-16' : 'w-64'}`}>
        <div className={`border-b flex items-center justify-between ${isCollapsed ? 'p-3' : 'px-5 py-5'}`}>
          {!isCollapsed && <h1 className="font-semibold text-lg text-slate-900">CXM Platform</h1>}
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 ${isCollapsed ? 'mx-auto' : ''}`}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
        <nav className={`flex-1 ${isCollapsed ? 'py-4 px-2' : 'p-4 pl-3'}`}>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <li key={item.href}>
                  {isCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Link
                            href={item.href}
                            className={`flex items-center gap-3 rounded-md text-sm transition-colors ${
                              isActive
                                ? "bg-slate-900 text-white"
                                : "text-slate-700 hover:bg-slate-200"
                            } ${isCollapsed ? 'justify-center p-2' : 'px-4 py-2.5'}`}
                          >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            {!isCollapsed && <span>{item.title}</span>}
                          </Link>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        sideOffset={8}
                        className="bg-slate-900 text-white border-slate-900 px-3 py-2 text-sm"
                      >
                        {item.title}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-md text-sm transition-colors ${
                        isActive
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-200"
                      } ${isCollapsed ? 'justify-center p-2' : 'px-4 py-2.5'}`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </TooltipProvider>
  );
}
