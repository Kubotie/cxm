"use client";

import { useState, useEffect } from "react";
import { Bell, User, LogOut, AlertCircle, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AppUserProfile } from "@/lib/nocodb/user-profile";

type CurrentView =
  | "Console"
  | "Company"
  | "Project"
  | "Cross-project analytics"
  | "Cross-scope"
  | "Mixed"
  | "System"
  | "Support"
  | "Support Queue"
  | "Support Detail"
  | "Support Analytics"
  | null;

interface GlobalHeaderProps {
  currentView?: CurrentView;
}

type OverdueActionNotification = {
  kind: "overdue_action";
  id: string;
  title: string;
  companyName: string;
  dueDate: string;
};

type ProjectSignalNotification = {
  kind: "project_signal";
  label: string;
  companyName: string;
  companyUid: string;
  index: number;
};

type Notification = OverdueActionNotification | ProjectSignalNotification;

function useNotifications(profile: AppUserProfile | null): Notification[] {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!profile) return;

    const owner =
      profile.default_home_scope === "mine" ? profile.name2 : undefined;

    Promise.all([
      fetch("/api/actions").then((r) => r.json()),
      fetch(
        `/api/home/project-signals${owner ? `?owner=${encodeURIComponent(owner)}` : ""}`
      ).then((r) => r.json()),
    ])
      .then(([actionsRes, signalsRes]) => {
        const today = new Date().toISOString().slice(0, 10);

        const overdueActions: OverdueActionNotification[] = (
          actionsRes.actions ?? []
        )
          .filter(
            (a: { dueDate: string | null; status: string }) =>
              a.dueDate &&
              a.dueDate < today &&
              !["done", "cancelled"].includes(a.status)
          )
          .map(
            (a: {
              id: string;
              title: string;
              companyName: string;
              dueDate: string;
            }) => ({
              kind: "overdue_action" as const,
              id: a.id,
              title: a.title,
              companyName: a.companyName,
              dueDate: a.dueDate,
            })
          );

        const criticalSignals: ProjectSignalNotification[] = Array.isArray(
          signalsRes
        )
          ? signalsRes
              .filter((s: { severity: string }) => s.severity === "critical")
              .flatMap(
                (
                  s: {
                    label: string;
                    items: { companyName: string; companyUid: string }[];
                  },
                  si: number
                ) =>
                  s.items.map((item, ii) => ({
                    kind: "project_signal" as const,
                    label: s.label,
                    companyName: item.companyName,
                    companyUid: item.companyUid,
                    index: si * 1000 + ii,
                  }))
              )
          : [];

        setNotifications([...overdueActions, ...criticalSignals]);
      })
      .catch(() => {});
  }, [profile]);

  return notifications;
}

const SCOPE_LABELS: Record<"mine" | "team" | "all", string> = {
  mine: "自分担当",
  team: "チーム",
  all: "全体",
};

export function GlobalHeader({ currentView }: GlobalHeaderProps) {
  const [user, setUser] = useState<AppUserProfile | null>(null);
  const notifications = useNotifications(user);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => {});
  }, []);

  async function changeScope(scope: "mine" | "team" | "all") {
    if (!user) return;
    await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ default_home_scope: scope }),
    }).catch(() => {});

    const prefsKey = `cxm_prefs_${user.name2}`;
    const prefs = JSON.parse(localStorage.getItem(prefsKey) ?? "{}");
    localStorage.setItem(
      prefsKey,
      JSON.stringify({ ...prefs, default_home_scope: scope })
    );
    // storage イベントは他タブにしか届かないため、同一タブ内のリスナーに手動で通知する
    window.dispatchEvent(new Event("storage"));

    setUser((prev) => (prev ? { ...prev, default_home_scope: scope } : null));
    if (window.location.pathname === "/") window.location.reload();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.reload();
  }

  const overdueActions = notifications.filter(
    (n): n is OverdueActionNotification => n.kind === "overdue_action"
  );
  const criticalSignals = notifications.filter(
    (n): n is ProjectSignalNotification => n.kind === "project_signal"
  );

  // suppress unused warning — currentView reserved for future use
  void currentView;

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6">
      {/* Left side: Reserved for future notifications/announcements */}
      <div className="flex items-center gap-4" />

      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="relative p-2 hover:bg-slate-100 rounded-md">
              <Bell className="w-5 h-5 text-slate-600" />
              {notifications.length > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500">
                  {notifications.length}
                </Badge>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="px-4 py-3 border-b">
              <p className="text-sm font-medium">通知</p>
            </div>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                新しい通知はありません
              </p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {overdueActions.length > 0 && (
                  <div>
                    <div className="px-4 py-2 flex items-center gap-2 bg-red-50">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-xs font-medium text-red-700">
                        期限切れタスク
                      </span>
                    </div>
                    {overdueActions.map((n) => (
                      <div
                        key={n.id}
                        className="px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                      >
                        <p className="text-sm text-slate-800 line-clamp-1">
                          {n.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {n.companyName} · {n.dueDate}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {criticalSignals.length > 0 && (
                  <div>
                    <div className="px-4 py-2 flex items-center gap-2 bg-amber-50">
                      <Layers className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-medium text-amber-700">
                        プロジェクトシグナル
                      </span>
                    </div>
                    {criticalSignals.map((n) => (
                      <div
                        key={`${n.companyUid}-${n.index}`}
                        className="px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                      >
                        <p className="text-sm text-slate-800 line-clamp-1">
                          {n.label}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {n.companyName}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-md">
              <User className="w-5 h-5 text-slate-600" />
              <span className="text-sm text-slate-700">
                {user?.name ?? "CSM User"}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-sm">{user?.name ?? "—"}</span>
                {user?.role && (
                  <span className="text-xs text-slate-500">{user.role}</span>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-slate-500 font-normal py-1">
              表示スコープ
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={user?.default_home_scope ?? "all"}
              onValueChange={(v) => changeScope(v as "mine" | "team" | "all")}
            >
              {(["mine", "team", "all"] as const).map((scope) => (
                <DropdownMenuRadioItem key={scope} value={scope}>
                  {SCOPE_LABELS[scope]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
              <LogOut />
              ログアウト
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
