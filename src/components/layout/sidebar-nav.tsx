"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Building2, Headphones, SlidersHorizontal,
  Activity, Zap, ClipboardList, Database, Settings,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { getCurrentRole, canAccess } from "@/lib/auth/role";

// ── メニュー定義 ────────────────────────────────────────────────────────────
//
// group: undefined = 全ロール表示、'ops' = Ops セパレータ以下

interface NavItem {
  title: string;
  icon:  React.ElementType;
  href:  string;
  group?: 'ops';
}

const NAV_ITEMS: NavItem[] = [
  // ── メインナビ ──
  { title: 'Home',       icon: Home,            href: '/' },
  { title: 'Companies',  icon: Building2,        href: '/companies' },
  { title: 'Support',    icon: Headphones,       href: '/support' },

  // ── Ops エリア（セパレータ区切り）──
  { title: 'Policies',     icon: SlidersHorizontal, href: '/ops/policies',            group: 'ops' },
  { title: 'Summary Ops',  icon: Database,           href: '/ops/company-summary',     group: 'ops' },
  { title: 'Mut. Logs',    icon: Activity,           href: '/ops/company-mutation-logs', group: 'ops' },
  { title: 'SF Ops',       icon: Zap,                href: '/ops/salesforce',          group: 'ops' },
  { title: 'SF DataPrep',  icon: ClipboardList,      href: '/ops/sf-data-prep',        group: 'ops' },
  { title: 'Settings',     icon: Settings,           href: '/settings',                group: 'ops' },
];

export function SidebarNav() {
  const pathname = usePathname();
  const role = getCurrentRole();

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("sidebar-collapsed");
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // ロールでフィルタ
  const visibleItems = NAV_ITEMS.filter(item => canAccess(item.href, role));

  // メインナビ / Ops に分割（セパレータ挿入のため）
  const mainItems = visibleItems.filter(item => !item.group);
  const opsItems  = visibleItems.filter(item => item.group === 'ops');

  function NavLink({ item }: { item: NavItem }) {
    const Icon = item.icon;
    // '/' のみ完全一致。それ以外は prefix 一致
    const isActive = item.href === '/'
      ? pathname === '/'
      : pathname === item.href || pathname.startsWith(item.href + '/');
    const cls = `flex items-center gap-3 rounded-md text-sm transition-colors ${
      isActive
        ? "bg-slate-900 text-white"
        : "text-slate-600 hover:bg-slate-200 hover:text-slate-800"
    } ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2'}`;

    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={item.href} className={cls}>
              <Icon className="w-4 h-4 flex-shrink-0" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="bg-slate-900 text-white border-slate-900 px-3 py-2 text-sm">
            {item.title}
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Link href={item.href} className={cls}>
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span>{item.title}</span>
      </Link>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <aside className={`border-r bg-slate-50 flex flex-col transition-all duration-200 ${isCollapsed ? 'w-16' : 'w-56'}`}>
        {/* ヘッダー */}
        <div className={`border-b flex items-center justify-between ${isCollapsed ? 'p-3' : 'px-4 py-4'}`}>
          {!isCollapsed && <h1 className="font-semibold text-base text-slate-900 tracking-tight">CXM Platform</h1>}
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 text-slate-500 ${isCollapsed ? 'mx-auto' : ''}`}
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>

        {/* ナビ */}
        <nav className={`flex-1 ${isCollapsed ? 'py-3 px-2' : 'p-3'}`}>
          {/* メインナビ */}
          <ul className="space-y-0.5">
            {mainItems.map(item => (
              <li key={item.href}><NavLink item={item} /></li>
            ))}
          </ul>

          {/* Ops セパレータ */}
          {opsItems.length > 0 && (
            <>
              <div className={`my-3 ${isCollapsed ? 'border-t border-slate-200' : 'flex items-center gap-2'}`}>
                {!isCollapsed && (
                  <>
                    <div className="flex-1 border-t border-slate-200" />
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Ops</span>
                    <div className="flex-1 border-t border-slate-200" />
                  </>
                )}
              </div>
              <ul className="space-y-0.5">
                {opsItems.map(item => (
                  <li key={item.href}><NavLink item={item} /></li>
                ))}
              </ul>
            </>
          )}
        </nav>

        {/* ロールバッジ（開発用） */}
        {!isCollapsed && role !== 'csm' && (
          <div className="px-3 pb-3">
            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-mono">
              role: {role}
            </span>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
