"use client";

// ─── 設定（CXM v2）──────────────────────────────────────────────────────────
//
// 旧 UI（/settings = SettingsPage）は独自にサイドバー＋ヘッダーを描いていて、
// v2 レイアウトの中では二重になる。ここでは v2 の他画面（tier3 / projects）と
// 同じ「トップバー + コンテンツ」の形で最小限だけ移植する。
//
// 最小単位として扱う項目:
//   1. アカウント（表示名 / メール / ロール）と ログアウト
//   2. 表示スコープ（default_home_scope）
//   3. 重点領域（focus_areas）
//   4. パスワード変更（staff_identify.password_hash）
//   5. AI アシスタント
//      - パネルの既定挙動（localStorage / ブラウザ側だけで完結するもの）
//      - 回答スタイル・履歴の保持期間・使用モデル（サーバーが読む必要があるので
//        /api/ai/prefs 経由で Blob に保存。詳細は src/lib/ai/user-ai-prefs.ts）
//      - 自分のチャット履歴の件数と全削除
//
// 注意: 2 と 3 は旧 UI から持ってきた項目で、2 は旧 UI の一覧にしか効かず、
// 3 は保存されるだけで読み手がいない（grep で確認済み）。まずは動線を v2 に寄せる
// のが目的なので値はそのまま置き、実効性のある項目は別途入れ替える前提。
//
// 保存は localStorage（即時・確実）＋ NocoDB PATCH の二重書き。旧 UI と同じキーを
// 使うので設定は相互に引き継がれる。staff_identify 側の列（default_home_scope /
// focus_areas / team / preferred_summary_policy_id）は 2026-08-24 に追加済みで、
// PATCH は実際に永続化される（それ以前は列が無く黙って失敗していた）。

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserCircle, LogOut, Check, SlidersHorizontal, Sparkles, Trash2, KeyRound } from "lucide-react";
import { useRegisterAiPageContext } from "@/components/ai";
import {
  AI_PANEL_PREFS_DEFAULT, loadAiPanelPrefs, saveAiPanelPrefs,
  type AiPanelPrefs,
} from "@/lib/prefs/ai-panel";
import type { UserAiPrefs } from "@/lib/ai/user-ai-prefs";
import type { AppUserProfile } from "@/lib/nocodb/user-profile";

// ── 定数 ────────────────────────────────────────────────────────────────────

type Scope = "mine" | "team" | "all";

const SCOPE_OPTIONS: { value: Scope; label: string; note: string }[] = [
  { value: "mine", label: "自分担当のみ", note: "owner_name が自分の企業だけ" },
  { value: "team", label: "チーム全体",   note: "同じチームの担当分を含む" },
  { value: "all",  label: "全社",         note: "担当を問わず全企業" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", manager: "Manager", ops: "Ops", csm: "CSM", viewer: "Viewer",
};

const FOCUS_OPTIONS = [
  { value: "renewal",   label: "更新管理" },
  { value: "expansion", label: "拡張・アップセル" },
  { value: "risk",      label: "リスク管理" },
  { value: "support",   label: "サポート対応" },
];

/** 履歴の保持期間の選択肢。値は日数（0 = 無期限）。API 側の RETENTION_CHOICES と対応 */
const RETENTION_LABELS: { value: number; label: string }[] = [
  { value: 0,   label: "無期限" },
  { value: 30,  label: "30日" },
  { value: 90,  label: "90日" },
  { value: 180, label: "180日" },
  { value: 365, label: "1年" },
];

/** サーバー側 MIN_PASSWORD_LENGTH と合わせる */
const MIN_PASSWORD = 10;

/** 回答スタイルの入力上限。サーバー側 MAX_INSTRUCTIONS_LEN と合わせる */
const MAX_INSTRUCTIONS = 600;

const INSTRUCTIONS_PLACEHOLDER =
  "例）結論だけ3行で。数字は必ず出典を付ける。私の担当（owner_name = 自分）の企業を前提に答える。";

// ── ローカル保存（NocoDB に拡張列が無くても設定を保持する）────────────────────

interface LocalPrefs {
  default_home_scope?: Scope;
  focus_areas?: string[];
}

function localPrefsKey(name2: string) { return `cxm_prefs_${name2}`; }

function loadLocalPrefs(name2: string): LocalPrefs {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(localPrefsKey(name2));
    return raw ? (JSON.parse(raw) as LocalPrefs) : {};
  } catch { return {}; }
}

function saveLocalPrefs(name2: string, prefs: LocalPrefs) {
  try { localStorage.setItem(localPrefsKey(name2), JSON.stringify(prefs)); } catch { /* ignore */ }
}

// ── 小物 ────────────────────────────────────────────────────────────────────

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl">
      <header className="px-4 py-3 border-b border-slate-100">
        <h2 className="m-0 text-[12.5px] font-bold text-slate-800">{title}</h2>
        {note && <p className="m-0 mt-0.5 text-[11px] text-slate-400">{note}</p>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Toggle({ checked, onChange, label, note }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; note?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-start gap-3 text-left py-1.5"
    >
      <span className={`mt-0.5 flex-none w-8 h-[18px] rounded-full transition relative
        ${checked ? "bg-blue-600" : "bg-slate-300"}`}>
        <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all
          ${checked ? "left-[16px]" : "left-[2px]"}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold text-slate-700">{label}</span>
        {note && <span className="block text-[10.5px] text-slate-400 mt-0.5">{note}</span>}
      </span>
    </button>
  );
}

// ── 本体 ────────────────────────────────────────────────────────────────────

export function SettingsView() {
  const router = useRouter();
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [scope, setScope] = useState<Scope>("mine");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [aiPrefs, setAiPrefs] = useState<AiPanelPrefs>(AI_PANEL_PREFS_DEFAULT);

  // サーバー側（Blob）に持つ AI 設定。回答スタイル / 保持期間 / モデル
  const [srvPrefs, setSrvPrefs] = useState<UserAiPrefs | null>(null);
  const [models, setModels] = useState<{ id: string; label: string }[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [srvSaveError, setSrvSaveError] = useState<string | null>(null);

  // パスワード。値は state に置くだけで、保存後は即クリアする
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNext, setPwNext] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);

  // 自分のチャット履歴（Vercel Blob 上にユーザー単位で実体がある）
  const [threadCount, setThreadCount] = useState<number | null>(null);
  const [chatStoreEnabled, setChatStoreEnabled] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/user/profile").catch(() => null);
    if (!res || !res.ok) return;
    const data: AppUserProfile = await res.json();
    setProfile(data);
    const prefs = loadLocalPrefs(data.name2);
    setScope(prefs.default_home_scope ?? data.default_home_scope ?? "mine");
    setFocusAreas(prefs.focus_areas ?? data.focus_areas ?? []);
    setAiPrefs(loadAiPanelPrefs(data.name2));
  }, []);

  /** 個別パスワードを設定済みか。ハッシュ自体は返ってこない */
  const loadPasswordState = useCallback(async () => {
    const res = await fetch("/api/user/password", { cache: "no-store" }).catch(() => null);
    if (!res || !res.ok) return;
    const json = await res.json() as { hasPassword?: boolean };
    setHasPassword(json.hasPassword === true);
  }, []);

  /** サーバー側 AI 設定とモデル候補 */
  const loadServerAiPrefs = useCallback(async () => {
    const res = await fetch("/api/ai/prefs", { cache: "no-store" }).catch(() => null);
    if (!res || !res.ok) return;
    const json = await res.json() as {
      prefs: UserAiPrefs;
      defaultModel?: string;
      models?: { id: string; label: string }[];
    };
    setSrvPrefs(json.prefs);
    setModels(json.models ?? []);
    setDefaultModel(json.defaultModel ?? "");
  }, []);

  /** 履歴の件数。保存が無効（Blob 未設定）なら storageEnabled=false が返る */
  const loadThreadCount = useCallback(async () => {
    const res = await fetch("/api/ai/chat/threads", { cache: "no-store" }).catch(() => null);
    if (!res || !res.ok) { setThreadCount(null); return; }
    const json = await res.json() as { threads?: unknown[]; storageEnabled?: boolean };
    setChatStoreEnabled(json.storageEnabled !== false);
    setThreadCount(json.threads?.length ?? 0);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadProfile().finally(() => setLoading(false));
    void loadThreadCount();
    void loadServerAiPrefs();
    void loadPasswordState();
  }, [loadProfile, loadThreadCount, loadServerAiPrefs, loadPasswordState]);

  async function save() {
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    try {
      saveLocalPrefs(profile.name2, { default_home_scope: scope, focus_areas: focusAreas });
      // AI パネル設定はここで保存 → イベント経由でパネル側に即反映される
      saveAiPanelPrefs(profile.name2, aiPrefs);

      void fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_home_scope: scope, focus_areas: focusAreas }),
      }).catch(() => {});
      setProfile(prev => prev ? { ...prev, default_home_scope: scope, focus_areas: focusAreas } : prev);

      // サーバー側の AI 設定。ここだけは結果を待つ（モデル名の検証で弾かれ得る）
      setSrvSaveError(null);
      if (srvPrefs) {
        const res = await fetch("/api/ai/prefs", {
          method:  "PUT",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(srvPrefs),
        }).catch(() => null);
        if (!res || !res.ok) {
          const msg = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : null;
          setSrvSaveError(msg ?? "AI 設定の保存に失敗しました");
          return;
        }
        const json = await res.json() as { prefs: UserAiPrefs };
        setSrvPrefs(json.prefs);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  /** パスワード変更。他の設定とは独立に即時保存する */
  async function changePassword() {
    setPwError(null);
    setPwDone(false);

    if (pwNext.length < MIN_PASSWORD) { setPwError(`新しいパスワードは ${MIN_PASSWORD} 文字以上にしてください`); return; }
    if (pwNext !== pwConfirm)         { setPwError("確認用のパスワードが一致しません"); return; }

    setPwSaving(true);
    try {
      const res = await fetch("/api/user/password", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNext }),
      }).catch(() => null);

      if (!res || !res.ok) {
        const msg = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : null;
        setPwError(msg ?? "パスワードの変更に失敗しました");
        return;
      }
      // 入力値をメモリに残さない
      setPwCurrent(""); setPwNext(""); setPwConfirm("");
      setHasPassword(true);
      setPwDone(true);
      setTimeout(() => setPwDone(false), 4000);
    } finally {
      setPwSaving(false);
    }
  }

  async function deleteAllThreads() {
    setDeleting(true);
    try {
      await fetch("/api/ai/chat/threads", { method: "DELETE" }).catch(() => {});
      await loadThreadCount();
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  function toggleFocus(value: string) {
    setFocusAreas(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }

  // ── AI パネルへの申告 ──────────────────────────────────────────────────────
  useRegisterAiPageContext({
    pageId: "v2-settings",
    title: "設定",
    description: "ログイン中ユーザーの表示スコープ・重点領域を設定する画面。",
    snapshot: {
      ユーザー: profile ? { 表示名: profile.name, ID: profile.name2, ロール: profile.role } : null,
      表示スコープ: scope,
      重点領域: focusAreas,
      AIパネル設定: aiPrefs,
      AI回答設定: srvPrefs,
      使用モデル: srvPrefs?.model || defaultModel,
      チャット履歴件数: threadCount,
    },
    hints: { 読込中: loading },
    sources: [
      { label: "ユーザープロファイル", endpoint: "/api/user/profile", description: "staff_identify の自分の行" },
    ],
  });

  return (
    <>
      {/* ── トップバー ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3.5 px-5 py-3.5 bg-white border-b border-slate-200">
        <div>
          <h1 className="m-0 text-base font-bold tracking-tight flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            設定
          </h1>
          <div className="text-[11.5px] text-slate-400 mt-0.5">自分の表示範囲と、AI が優先する観点</div>
        </div>
        <div className="flex-1" />
        <button
          onClick={logout}
          disabled={loggingOut}
          className="inline-flex items-center gap-1.5 border border-slate-200 bg-white rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          {loggingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
          ログアウト
        </button>
      </div>

      {/* ── コンテンツ ─────────────────────────────────────────────────────── */}
      <div className="p-4 md:p-5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-slate-500 py-16">
            <Loader2 className="w-4 h-4 animate-spin" /> 読み込み中...
          </div>
        ) : !profile ? (
          <div className="text-sm text-slate-500 py-8 text-center">プロファイルを取得できませんでした</div>
        ) : (
          <div className="max-w-[720px] space-y-4">

            {/* アカウント */}
            <Card title="アカウント" note="表示名・ロールの変更は運用側（staff_identify）で行う">
              <div className="flex items-center gap-3">
                <UserCircle className="w-9 h-9 text-slate-300 flex-none" />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-slate-800">{profile.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-slate-400 truncate">{profile.email ?? profile.name2}</span>
                    <span className="text-[9.5px] font-bold px-1.5 py-px rounded-full bg-slate-100 text-slate-600 flex-none">
                      {ROLE_LABELS[profile.role] ?? profile.role}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* パスワード */}
            <Card
              title="パスワード"
              note={
                hasPassword === null ? "確認中…"
                  : hasPassword
                    ? "個別パスワードを設定済み。共有パスワードでは入れません"
                    : "まだ共有パスワードでログインしています。ここで自分専用のパスワードを設定してください"
              }
            >
              <div className="space-y-2.5 max-w-[380px]">
                <label className="block">
                  <span className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {hasPassword ? "現在のパスワード" : "共有パスワード（現在ログインに使っているもの）"}
                  </span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={pwCurrent}
                    onChange={e => setPwCurrent(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px]
                               text-slate-700 focus:border-blue-500 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="block text-[11px] font-semibold text-slate-600 mb-1">
                    新しいパスワード（{MIN_PASSWORD} 文字以上）
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={pwNext}
                    onChange={e => setPwNext(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px]
                               text-slate-700 focus:border-blue-500 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="block text-[11px] font-semibold text-slate-600 mb-1">新しいパスワード（確認）</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={pwConfirm}
                    onChange={e => setPwConfirm(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px]
                               text-slate-700 focus:border-blue-500 focus:outline-none"
                  />
                </label>

                <div className="flex items-center gap-3 pt-0.5">
                  <button
                    onClick={changePassword}
                    disabled={pwSaving || !pwCurrent || !pwNext || !pwConfirm}
                    className="inline-flex items-center gap-1.5 border border-slate-300 bg-white rounded-lg px-3 py-1.5
                               text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {pwSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                    {hasPassword ? "パスワードを変更" : "パスワードを設定"}
                  </button>
                  {pwDone  && <span className="text-[11.5px] text-emerald-600">変更しました。次回のログインから有効です</span>}
                  {pwError && <span className="text-[11.5px] text-red-600">{pwError}</span>}
                </div>
              </div>
            </Card>

            {/* 表示スコープ */}
            <Card title="表示スコープ" note="一覧に出す企業の範囲。現在の反映先は旧 UI の一覧（Home / Companies / Outbound）で、v2 の各画面は未接続">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {SCOPE_OPTIONS.map(opt => {
                  const active = scope === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setScope(opt.value)}
                      className={[
                        "text-left px-3 py-2.5 rounded-lg border transition",
                        active
                          ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500/20"
                          : "border-slate-200 bg-white hover:border-slate-300",
                      ].join(" ")}
                    >
                      <div className={`text-[12px] font-semibold ${active ? "text-blue-700" : "text-slate-700"}`}>
                        {opt.label}
                      </div>
                      <div className="text-[10.5px] text-slate-400 mt-0.5">{opt.note}</div>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* 重点領域 */}
            <Card title="重点領域" note="値は保存されるが、AI サマリ生成への反映は未接続">
              <div className="flex flex-wrap gap-2">
                {FOCUS_OPTIONS.map(opt => {
                  const active = focusAreas.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleFocus(opt.value)}
                      className={[
                        "px-3 py-1 rounded-full text-[11.5px] font-semibold border transition",
                        active
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-400",
                      ].join(" ")}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* AI アシスタント */}
            <Card
              title="AI アシスタント"
              note="ページデータ用のチャットパネル（⌘/Ctrl + I）。履歴はアカウント単位で保存されるため、ここで管理する"
            >
              <div className="divide-y divide-slate-100">
                <Toggle
                  checked={aiPrefs.openOnLoad}
                  onChange={v => setAiPrefs(p => ({ ...p, openOnLoad: v }))}
                  label="ページを開いたときにパネルを開く"
                  note="常に AI を横に置いて見るスタイルのとき。閉じた場合はその後の画面遷移で開き直さない"
                />
                <Toggle
                  checked={aiPrefs.showThinking}
                  onChange={v => setAiPrefs(p => ({ ...p, showThinking: v }))}
                  label="思考プロセスを表示する"
                  note="回答生成中に、モデルが何を考えているかを薄字で出す"
                />

                <div className="pt-2.5">
                  <div className="text-[12px] font-semibold text-slate-700">履歴一覧の既定の絞り込み</div>
                  <div className="flex gap-1.5 mt-1.5">
                    {([
                      { value: "page", label: "このページ発の会話だけ" },
                      { value: "all",  label: "すべて" },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setAiPrefs(p => ({ ...p, historyScope: opt.value }))}
                        className={[
                          "px-3 py-1 rounded-full text-[11.5px] font-semibold border transition",
                          aiPrefs.historyScope === opt.value
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-400",
                        ].join(" ")}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── ここから下はサーバー側に保存する（システムプロンプト・期限削除・モデル選択） ── */}

                <div className="pt-3">
                  <div className="text-[12px] font-semibold text-slate-700">回答スタイル・常用の前提</div>
                  <div className="text-[10.5px] text-slate-400 mt-0.5">
                    毎回打っている前置きをここに置く。全画面のチャットに効く
                  </div>
                  <textarea
                    value={srvPrefs?.instructions ?? ""}
                    onChange={e => setSrvPrefs(p => p ? { ...p, instructions: e.target.value.slice(0, MAX_INSTRUCTIONS) } : p)}
                    disabled={!srvPrefs}
                    rows={3}
                    placeholder={INSTRUCTIONS_PLACEHOLDER}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11.5px] leading-relaxed
                               text-slate-700 placeholder:text-slate-300 focus:border-blue-500 focus:outline-none
                               disabled:bg-slate-50 resize-y"
                  />
                  <div className="text-[10px] text-slate-400 text-right mt-0.5">
                    {(srvPrefs?.instructions ?? "").length} / {MAX_INSTRUCTIONS}
                  </div>
                </div>

                <div className="pt-2.5">
                  <div className="text-[12px] font-semibold text-slate-700">履歴の保持期間</div>
                  <div className="text-[10.5px] text-slate-400 mt-0.5">
                    期限を過ぎた会話は、履歴一覧を開いたときに自動削除される
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {RETENTION_LABELS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setSrvPrefs(p => p ? { ...p, retentionDays: opt.value } : p)}
                        disabled={!srvPrefs}
                        className={[
                          "px-3 py-1 rounded-full text-[11.5px] font-semibold border transition disabled:opacity-50",
                          srvPrefs?.retentionDays === opt.value
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-400",
                        ].join(" ")}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2.5">
                  <div className="text-[12px] font-semibold text-slate-700">使用モデル</div>
                  <div className="text-[10.5px] text-slate-400 mt-0.5">
                    {models.length > 0
                      ? "安い順（おおむね速い順）。深く考えさせたいときだけ上位に切り替える"
                      : "候補を取得できませんでした（OpenRouter のカタログ未取得）。既定のまま動きます"}
                  </div>
                  <select
                    value={srvPrefs?.model ?? ""}
                    onChange={e => setSrvPrefs(p => p ? { ...p, model: e.target.value } : p)}
                    disabled={!srvPrefs || models.length === 0}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5
                               text-[11.5px] text-slate-700 focus:border-blue-500 focus:outline-none
                               disabled:bg-slate-50"
                  >
                    <option value="">既定にまかせる{defaultModel ? `（${defaultModel}）` : ""}</option>
                    {models.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>

                {/* 履歴。保存ボタンとは独立（破棄は即時・取り消し不可） */}
                <div className="pt-2.5 flex items-center gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-slate-400 flex-none" />
                      チャット履歴
                    </div>
                    <div className="text-[10.5px] text-slate-400 mt-0.5">
                      {!chatStoreEnabled
                        ? "保存は無効（BLOB_READ_WRITE_TOKEN 未設定）。会話はリロードで消える"
                        : threadCount === null
                          ? "件数を取得できませんでした"
                          : `${threadCount} 件を保存中。自分の履歴だけが対象で、他ユーザーからは見えない`}
                    </div>
                  </div>
                  <div className="flex-1" />
                  {chatStoreEnabled && (threadCount ?? 0) > 0 && (
                    confirmDelete ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={deleteAllThreads}
                          disabled={deleting}
                          className="inline-flex items-center gap-1.5 bg-red-600 border border-red-600 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold text-white hover:brightness-105 disabled:opacity-60"
                        >
                          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          {threadCount} 件を削除する
                        </button>
                        <button
                          onClick={() => setConfirmDelete(false)}
                          disabled={deleting}
                          className="text-[11.5px] text-slate-500 hover:text-slate-700 px-2 disabled:opacity-60"
                        >
                          やめる
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="inline-flex items-center gap-1.5 border border-slate-200 bg-white rounded-lg px-3 py-1.5 text-[11.5px] font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        全削除
                      </button>
                    )
                  )}
                </div>
              </div>
            </Card>

            {/* 保存 */}
            <div className="flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 bg-blue-600 border border-blue-600 rounded-lg px-4 py-1.5 text-xs font-semibold text-white hover:brightness-105 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : saved ? <Check className="w-3.5 h-3.5" /> : null}
                {saved ? "保存済み" : "保存"}
              </button>
              {saved && <span className="text-[11.5px] text-emerald-600">設定を保存しました</span>}
              {srvSaveError && <span className="text-[11.5px] text-red-600">{srvSaveError}</span>}
            </div>

          </div>
        )}
      </div>
    </>
  );
}
