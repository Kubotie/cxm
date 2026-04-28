"use client";

// ─── ユーザー設定画面 ─────────────────────────────────────────────────────────
//
// 機能:
//   1. 個人設定編集（スコープ / 重点領域）— ロール変更・ユーザー切り替えは不可
//   2. ログアウト

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SidebarNav }   from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { Button }       from "@/components/ui/button";
import { Badge }        from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator }    from "@/components/ui/separator";
import { Loader2, UserCircle, LogOut, Check } from "lucide-react";
import type { AppUserProfile } from "@/lib/nocodb/user-profile";

// ── 定数 ────────────────────────────────────────────────────────────────────

const SCOPE_LABELS: Record<string, string> = {
  mine: '自分担当のみ',
  team: 'チーム全体',
  all:  '全社',
};

const ROLE_LABELS: Record<string, string> = {
  admin:   'Admin',
  manager: 'Manager',
  ops:     'Ops',
  csm:     'CSM',
  viewer:  'Viewer',
};

const FOCUS_OPTIONS = [
  { value: 'renewal',   label: '更新管理' },
  { value: 'expansion', label: '拡張・アップセル' },
  { value: 'risk',      label: 'リスク管理' },
  { value: 'support',   label: 'サポート対応' },
];

// ── ローカルストレージ（NocoDB 拡張列がなくても設定を保持するため）───────────

function localPrefsKey(name2: string) { return `cxm_prefs_${name2}`; }

interface LocalPrefs {
  default_home_scope?: 'mine' | 'team' | 'all';
  focus_areas?:        string[];
}

function loadLocalPrefs(name2: string): LocalPrefs {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(localPrefsKey(name2));
    return raw ? (JSON.parse(raw) as LocalPrefs) : {};
  } catch { return {}; }
}

function saveLocalPrefs(name2: string, prefs: LocalPrefs) {
  try { localStorage.setItem(localPrefsKey(name2), JSON.stringify(prefs)); } catch { /* ignore */ }
}

// ── コンポーネント ────────────────────────────────────────────────────────────

export function SettingsPage() {
  const router = useRouter();
  const [currentProfile, setCurrentProfile] = useState<AppUserProfile | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // 編集フォームの状態
  const [scope,      setScope]      = useState<'mine' | 'team' | 'all'>('mine');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);

  // ── データ取得 ─────────────────────────────────────────────────────────────

  const loadProfile = useCallback(async () => {
    const res = await fetch('/api/user/profile').catch(() => null);
    if (!res || !res.ok) return;
    const data: AppUserProfile = await res.json();
    setCurrentProfile(data);
    const prefs = loadLocalPrefs(data.name2);
    setScope(prefs.default_home_scope ?? data.default_home_scope ?? 'mine');
    setFocusAreas(prefs.focus_areas ?? data.focus_areas ?? []);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadProfile().finally(() => setLoading(false));
  }, [loadProfile]);

  // ── 設定保存 ──────────────────────────────────────────────────────────────

  async function saveSettings() {
    if (!currentProfile) return;
    setSaving(true);
    setSaved(false);
    try {
      saveLocalPrefs(currentProfile.name2, { default_home_scope: scope, focus_areas: focusAreas });

      void fetch('/api/user/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ default_home_scope: scope, focus_areas: focusAreas }),
      }).catch(() => {});

      setCurrentProfile(prev => prev ? { ...prev, default_home_scope: scope, focus_areas: focusAreas } : prev);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  // ── ログアウト ────────────────────────────────────────────────────────────

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
    router.refresh();
  }

  // ── フォーカスエリア toggle ───────────────────────────────────────────────

  function toggleFocus(value: string) {
    setFocusAreas(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value],
    );
  }

  // ── レンダリング ──────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <SidebarNav />
      <div className="flex flex-col flex-1 overflow-hidden">
        <GlobalHeader />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
                <Loader2 className="w-4 h-4 animate-spin" />
                読み込み中…
              </div>
            ) : currentProfile ? (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <UserCircle className="w-8 h-8 text-slate-400" />
                      <div>
                        <h2 className="text-sm font-semibold text-slate-800">{currentProfile.name}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400">{currentProfile.email ?? currentProfile.name2}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            {ROLE_LABELS[currentProfile.role] ?? currentProfile.role}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={logout}
                      disabled={loggingOut}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-60"
                    >
                      {loggingOut
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <LogOut className="w-3.5 h-3.5" />}
                      ログアウト
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  {/* Home スコープ */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">
                      Home 表示スコープ
                    </label>
                    <Select value={scope} onValueChange={v => setScope(v as 'mine' | 'team' | 'all')}>
                      <SelectTrigger className="w-full text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SCOPE_LABELS).map(([v, label]) => (
                          <SelectItem key={v} value={v}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-400">
                      Home 画面に表示する企業の範囲を設定します。
                    </p>
                  </div>

                  <Separator />

                  {/* 重点領域 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">
                      重点領域（AI サマリへの反映）
                    </label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {FOCUS_OPTIONS.map(opt => {
                        const active = focusAreas.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            onClick={() => toggleFocus(opt.value)}
                            className={[
                              'px-3 py-1 rounded-full text-xs border transition-colors',
                              active
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
                            ].join(' ')}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-400">
                      選択した領域が AI サマリ生成の優先度に反映されます。
                    </p>
                  </div>

                  <Separator />

                  {/* 保存ボタン */}
                  <div className="flex items-center gap-3 pt-1">
                    <Button
                      onClick={saveSettings}
                      disabled={saving}
                      size="sm"
                      className="min-w-24"
                    >
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      ) : saved ? (
                        <Check className="w-3.5 h-3.5 mr-1.5" />
                      ) : null}
                      {saved ? '保存済み' : '保存'}
                    </Button>
                    {saved && (
                      <span className="text-xs text-green-600">設定を保存しました</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-8 text-sm text-slate-500">
                プロファイルを取得できませんでした
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
