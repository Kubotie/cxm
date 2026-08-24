"use client";

// ─── 画面内 AI アシスタント（右サイドパネル）───────────────────────────────────
//
// 「今見ている画面のことを何でも聞ける」パネル。
//
//   - 画面が useRegisterAiPageContext で申告したデータをそのまま AI に渡す
//   - 足りない分は AI が内部 API を叩いて深掘りする（実行状況をパネルに出す）
//   - 履歴はユーザー単位で保存。一覧から再開・改名・削除ができる
//
// ── オーバーレイではなく本文を押し出している理由 ──────────────────────────────
//   「画面の説明をさせる」用途なので、パネルを開いたまま元の画面を読めないと使えない。
//   html 要素に padding-right を当てて本文を詰める（閉じたら戻す）。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AI_PANEL_PREFS_DEFAULT, AI_PANEL_PREFS_EVENT, fetchUserKey, loadAiPanelPrefs,
  type AiPanelPrefs,
} from "@/lib/prefs/ai-panel";
import { usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  Sparkles, X, Send, History, Plus, Trash2, Pencil, Check, Loader2,
  Database, ChevronDown, ChevronRight, AlertCircle, MessageSquare, GripVertical,
} from "lucide-react";
import { useAiPageActions, useAiPageMeta } from "./ai-page-context";
import type { AiChatMessage, AiChatThreadSummary, AiChatToolCall } from "@/lib/ai/chat-store";

// ── 定数 ──────────────────────────────────────────────────────────────────────

const MIN_WIDTH = 340;
const MAX_WIDTH = 760;
const DEFAULT_WIDTH = 440;
const WIDTH_KEY = "cxm.ai-panel.width";

/**
 * パネルを開いたときに本文へ確保する最小幅。
 * これを下回るとダッシュボードの KPI タイルやタブが縦積みに折り返して読めなくなる
 * （実測: 残り 540px で「PV消/費率」のように1文字ずつ折れる）。
 * 下限に達したら本文を潰さず横スクロールに逃がす。
 */
export const MIN_CONTENT_WIDTH = 820;

/** パネル幅の上限。画面の半分を超えて広げられないようにする */
export function clampPanelWidth(w: number, viewportWidth: number): number {
  const cap = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(viewportWidth * 0.5)));
  return Math.min(cap, Math.max(MIN_WIDTH, w));
}

export const PANEL_WIDTH_KEY = WIDTH_KEY;
export const PANEL_DEFAULT_WIDTH = DEFAULT_WIDTH;

/** パネルを出さないパス */
const HIDDEN_PREFIXES = ["/login"];

// ── ストリーム中のツール実行表示 ──────────────────────────────────────────────

interface LiveTool { path: string; status: "start" | "ok" | "error"; summary?: string }

// ── SSE イベント ──────────────────────────────────────────────────────────────

type StreamEvent =
  | { type: "thread"; threadId: string; title: string }
  | { type: "thinking"; delta: string }
  | { type: "text"; delta: string }
  | { type: "tool"; path: string; status: "start" | "ok" | "error"; summary?: string }
  | { type: "done"; message: AiChatMessage }
  | { type: "warn"; message: string }
  | { type: "error"; message: string };

// ── 参照データの開示 ──────────────────────────────────────────────────────────

function ToolCallList({ calls }: { calls: AiChatToolCall[] }) {
  const [open, setOpen] = useState(false);
  if (calls.length === 0) return null;
  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-slate-600 hover:text-slate-900"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Database className="w-3 h-3" />
        <span>参照したデータ {calls.length} 件</span>
      </button>
      {open && (
        <ul className="px-2 pb-2 space-y-1">
          {calls.map((c, i) => (
            <li key={i} className="text-[10.5px] leading-relaxed">
              <code className={`break-all ${c.ok ? "text-slate-700" : "text-red-600"}`}>{c.path}</code>
              {c.summary && <span className="text-slate-500"> — {c.summary}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── メッセージ表示 ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: AiChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-3 py-2 text-[12.5px] leading-relaxed text-white whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="prose prose-sm prose-slate max-w-none text-[12.5px]
        prose-headings:text-[13px] prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
        prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5
        prose-table:text-[11px] prose-code:text-[11px] prose-pre:text-[11px]">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
      {message.toolCalls && <ToolCallList calls={message.toolCalls} />}
    </div>
  );
}

// ── 履歴一覧 ──────────────────────────────────────────────────────────────────

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const diffMin = Math.floor((now - d.getTime()) / 60_000);
  if (diffMin < 1)  return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH}時間前`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7)    return `${diffD}日前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface HistoryViewProps {
  threads:     AiChatThreadSummary[];
  loading:     boolean;
  currentPageId: string | null;
  scope:       "page" | "all";
  onScope:     (s: "page" | "all") => void;
  onOpen:      (id: string) => void;
  onRename:    (id: string, title: string) => void;
  onDelete:    (id: string) => void;
  onDeleteAll: () => void;
}

function HistoryView(p: HistoryViewProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);

  const shown = useMemo(() => (
    p.scope === "page" && p.currentPageId
      ? p.threads.filter(t => t.pageId === p.currentPageId)
      : p.threads
  ), [p.threads, p.scope, p.currentPageId]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* スコープ切替 */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-200">
        {(["page", "all"] as const).map(s => (
          <button
            key={s}
            onClick={() => p.onScope(s)}
            disabled={s === "page" && !p.currentPageId}
            className={`px-2 py-1 rounded text-[11px] transition disabled:opacity-40
              ${p.scope === s ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {s === "page" ? "この画面" : "すべて"}
          </button>
        ))}
        <span className="ml-auto text-[10.5px] text-slate-400">{shown.length} 件</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {p.loading && (
          <div className="flex items-center gap-2 p-4 text-[11.5px] text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> 履歴を読み込み中…
          </div>
        )}
        {!p.loading && shown.length === 0 && (
          <p className="p-4 text-[11.5px] leading-relaxed text-slate-500">
            まだ履歴がありません。画面について質問すると、ここに残ります。
          </p>
        )}
        <ul className="divide-y divide-slate-100">
          {shown.map(t => (
            <li key={t.id} className="group px-3 py-2 hover:bg-slate-50">
              {editing === t.id ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") { p.onRename(t.id, draft); setEditing(null); }
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="flex-1 min-w-0 rounded border border-slate-300 px-1.5 py-1 text-[11.5px] outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => { p.onRename(t.id, draft); setEditing(null); }}
                    className="p-1 text-slate-500 hover:text-emerald-600"
                    title="保存"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-start gap-1.5">
                  <button onClick={() => p.onOpen(t.id)} className="flex-1 min-w-0 text-left">
                    <p className="text-[12px] text-slate-800 leading-snug line-clamp-2">{t.title}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400 truncate">
                      {formatWhen(t.updatedAt)} · {t.messageCount} 発言
                      {t.pagePath ? ` · ${t.pagePath}` : ""}
                    </p>
                  </button>
                  <div className="flex-none flex opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => { setEditing(t.id); setDraft(t.title); }}
                      className="p-1 text-slate-400 hover:text-slate-700" title="名前を変更"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => p.onDelete(t.id)}
                      className="p-1 text-slate-400 hover:text-red-600" title="削除"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {p.threads.length > 0 && (
        <div className="border-t border-slate-200 p-2">
          {confirmAll ? (
            <div className="flex items-center gap-1.5">
              <span className="flex-1 text-[11px] text-red-700">全 {p.threads.length} 件を削除しますか？</span>
              <button
                onClick={() => { p.onDeleteAll(); setConfirmAll(false); }}
                className="rounded bg-red-600 px-2 py-1 text-[11px] text-white hover:bg-red-700"
              >削除する</button>
              <button
                onClick={() => setConfirmAll(false)}
                className="rounded px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
              >やめる</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmAll(true)}
              className="flex items-center gap-1.5 px-1.5 py-1 text-[11px] text-slate-500 hover:text-red-600"
            >
              <Trash2 className="w-3 h-3" /> 履歴をすべて削除
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── 本体 ──────────────────────────────────────────────────────────────────────

export interface AiSidePanelProps {
  /** 開閉状態は本文の押し出しと共有する必要があるため、親（AiAssistantShell）が持つ */
  open:    boolean;
  setOpen: (next: boolean | ((prev: boolean) => boolean)) => void;
  width:   number;
  setWidth: (next: number | ((prev: number) => number)) => void;
  /** パネル自体を出さない画面（ログイン等） */
  disabled: boolean;
}

export function AiSidePanel({ open, setOpen, width, setWidth, disabled }: AiSidePanelProps) {
  const pathname = usePathname();
  const pageApi  = useAiPageActions();
  const meta     = useAiPageMeta();

  const [view,  setView]  = useState<"chat" | "history">("chat");

  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input,    setInput]    = useState("");

  const [streaming,  setStreaming]  = useState(false);
  const [streamText, setStreamText] = useState("");
  const [thinking,   setThinking]   = useState("");
  const [liveTools,  setLiveTools]  = useState<LiveTool[]>([]);
  const [notice,     setNotice]     = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  const [threads,        setThreads]        = useState<AiChatThreadSummary[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [scope,          setScope]          = useState<"page" | "all">("all");
  const [storageEnabled, setStorageEnabled] = useState(true);

  // アカウント設定（/v2/settings の「AI アシスタント」カード）
  const [prefs, setPrefs] = useState<AiPanelPrefs>(AI_PANEL_PREFS_DEFAULT);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const taRef     = useRef<HTMLTextAreaElement | null>(null);

  const hidden = disabled;

  // ── アカウント設定の読み込み ───────────────────────────────────────────────
  // 設定画面での保存は同一タブなのでカスタムイベントで受け取る（storage イベントは他タブ専用）
  useEffect(() => {
    let cancelled = false;
    const apply = (p: AiPanelPrefs) => { setPrefs(p); setScope(p.historyScope); };
    fetchUserKey().then(key => { if (!cancelled && key) apply(loadAiPanelPrefs(key)); });
    const onPrefs = (e: Event) => apply((e as CustomEvent<AiPanelPrefs>).detail);
    window.addEventListener(AI_PANEL_PREFS_EVENT, onPrefs);
    return () => { cancelled = true; window.removeEventListener(AI_PANEL_PREFS_EVENT, onPrefs); };
  }, []);

  // ── ショートカット（Cmd/Ctrl + I）───────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── 自動スクロール ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamText, liveTools, view]);

  // ── 履歴一覧の取得 ─────────────────────────────────────────────────────────
  const loadThreads = useCallback(async () => {
    setThreadsLoading(true);
    try {
      const res = await fetch("/api/ai/chat/threads", { cache: "no-store" });
      if (!res.ok) throw new Error(`履歴の取得に失敗しました（${res.status}）`);
      const json = await res.json() as { threads: AiChatThreadSummary[]; storageEnabled?: boolean };
      setThreads(json.threads ?? []);
      setStorageEnabled(json.storageEnabled !== false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setThreadsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && view === "history") void loadThreads();
  }, [open, view, loadThreads]);

  // ── 送信 ───────────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const live = pageApi?.readLive() ?? null;
    const context = {
      pageId:      live?.pageId      ?? "unknown",
      title:       live?.title       ?? "不明な画面",
      description: live?.description ?? "この画面はAIパネルにデータを申告していない。必要なデータはカタログから自分で取得すること。",
      snapshot:    live?.snapshot,
      sources:     live?.sources ?? [],
      hints:       live?.hints,
      pathname:    pathname ?? "/",
    };

    setInput("");
    setError(null);
    setNotice(null);
    setStreamText("");
    setThinking("");
    setLiveTools([]);
    setStreaming(true);
    setView("chat");
    setMessages(prev => [
      ...prev,
      { role: "user", content: text, createdAt: new Date().toISOString() },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ threadId, message: text, context }),
        signal:  controller.signal,
      });

      if (!res.ok || !res.body) {
        const detail = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(detail.error ?? `送信に失敗しました（${res.status}）`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // SSE は "\n\n" 区切り。チャンク境界でイベントが割れるのでバッファに溜める
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep = buffer.indexOf("\n\n");
        while (sep >= 0) {
          const raw = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          sep = buffer.indexOf("\n\n");

          const line = raw.split("\n").find(l => l.startsWith("data: "));
          if (!line) continue;

          let ev: StreamEvent;
          try {
            ev = JSON.parse(line.slice(6)) as StreamEvent;
          } catch { continue; }

          switch (ev.type) {
            case "thread":
              setThreadId(ev.threadId);
              break;
            case "thinking":
              setThinking(t => t + ev.delta);
              break;
            case "text":
              setStreamText(t => t + ev.delta);
              break;
            case "tool":
              setLiveTools(prev => {
                const i = prev.findIndex(t => t.path === ev.path && t.status === "start");
                if (ev.status === "start") return [...prev, { path: ev.path, status: "start" }];
                if (i < 0) return [...prev, { path: ev.path, status: ev.status, summary: ev.summary }];
                const next = [...prev];
                next[i] = { path: ev.path, status: ev.status, summary: ev.summary };
                return next;
              });
              break;
            case "warn":
              setNotice(ev.message);
              break;
            case "done":
              setMessages(prev => [...prev, ev.message]);
              setStreamText("");
              setThinking("");
              setLiveTools([]);
              break;
            case "error":
              setError(ev.message);
              break;
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, pageApi, pathname, threadId]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    // 中断時点までの本文は残す（消すと何も手元に残らない）
    setStreaming(false);
    if (streamText.trim()) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `${streamText}\n\n（※ 中断しました）`, createdAt: new Date().toISOString() },
      ]);
    }
    setStreamText("");
    setThinking("");
    setLiveTools([]);
  }, [streamText]);

  // ── スレッド操作 ───────────────────────────────────────────────────────────
  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setThreadId(null);
    setMessages([]);
    setStreamText("");
    setThinking("");
    setLiveTools([]);
    setError(null);
    setNotice(null);
    setView("chat");
    setTimeout(() => taRef.current?.focus(), 0);
  }, []);

  const openThread = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/ai/chat/threads/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`スレッドを開けませんでした（${res.status}）`);
      const thread = await res.json() as { id: string; messages: AiChatMessage[] };
      setThreadId(thread.id);
      setMessages(thread.messages ?? []);
      setView("chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const renameThread = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setThreads(prev => prev.map(t => (t.id === id ? { ...t, title: trimmed } : t)));
    const res = await fetch(`/api/ai/chat/threads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    if (!res.ok) { setError("タイトルの変更に失敗しました"); void loadThreads(); }
  }, [loadThreads]);

  const deleteThread = useCallback(async (id: string) => {
    setThreads(prev => prev.filter(t => t.id !== id));
    if (threadId === id) { setThreadId(null); setMessages([]); }
    const res = await fetch(`/api/ai/chat/threads/${id}`, { method: "DELETE" });
    if (!res.ok) { setError("削除に失敗しました"); void loadThreads(); }
  }, [threadId, loadThreads]);

  const deleteAll = useCallback(async () => {
    setThreads([]);
    setThreadId(null);
    setMessages([]);
    const res = await fetch("/api/ai/chat/threads", { method: "DELETE" });
    if (!res.ok) { setError("全削除に失敗しました"); void loadThreads(); }
  }, [loadThreads]);

  // ── 幅のドラッグ ───────────────────────────────────────────────────────────
  // ドラッグ中の幅は ref にも持つ。state 更新関数の中で localStorage を触ると
  // StrictMode の二重実行で副作用が2回走るため、確定時は ref から書き出す。
  const widthRef = useRef(width);
  useEffect(() => { widthRef.current = width; }, [width]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const move = (ev: MouseEvent) => {
      const next = clampPanelWidth(window.innerWidth - ev.clientX, window.innerWidth);
      widthRef.current = next;
      setWidth(next);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.localStorage.setItem(WIDTH_KEY, String(widthRef.current));
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, []);

  if (hidden) return null;

  // ── ランチャー ─────────────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="このページについてAIに聞く（⌘/Ctrl + I）"
        className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3
                   text-[12px] font-medium text-white shadow-lg shadow-slate-900/25 transition hover:bg-slate-800"
      >
        <Sparkles className="w-4 h-4" />
        このページについて聞く
      </button>
    );
  }

  const suggestions = meta
    ? ["この画面は何を見る画面？", "いま優先度が高いのはどれ？その根拠は？", "この数字はどこから来ている？"]
    : ["この画面について説明して"];

  return (
    <aside
      style={{ width }}
      className="fixed right-0 top-0 z-[60] flex h-screen flex-col border-l border-slate-200 bg-white shadow-xl"
    >
      {/* リサイズハンドル */}
      <div
        onMouseDown={startResize}
        className="group absolute left-0 top-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize"
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 transition group-hover:opacity-100">
          <GripVertical className="h-4 w-4 text-slate-400" />
        </div>
      </div>

      {/* ── ヘッダー ─────────────────────────────────────────────────────── */}
      <header className="flex-none border-b border-slate-200 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 flex-none text-blue-600" />
          <span className="flex-1 text-[12.5px] font-semibold text-slate-900">ページアシスタント</span>
          <button
            onClick={newChat}
            title="新しいチャット"
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setView(v => (v === "history" ? "chat" : "history"))}
            title="履歴"
            className={`rounded p-1.5 transition ${
              view === "history" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <History className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setOpen(false)}
            title="閉じる（⌘/Ctrl + I）"
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 何を見て答えるかを開示する */}
        <p className="mt-1 truncate text-[10.5px] text-slate-500">
          {meta
            ? <>参照中: <span className="font-medium text-slate-700">{meta.title}</span>{meta.sourceCount > 0 && ` · データ源 ${meta.sourceCount} 件`}</>
            : <>この画面はデータを申告していません（カタログから取得します）</>}
        </p>
      </header>

      {/* ── 通知・エラー（履歴ビューでも見えるようヘッダー直下に置く）───────── */}
      {(error || notice || !storageEnabled) && (
        <div className="flex-none space-y-1 border-b border-slate-200 px-3 py-2">
          {error && (
            <div className="flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
              <AlertCircle className="mt-0.5 h-3 w-3 flex-none" />
              <span className="min-w-0 break-words">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto flex-none text-red-400 hover:text-red-700"
                title="閉じる"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {notice && (
            <p className="rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">{notice}</p>
          )}
          {!storageEnabled && (
            <p className="px-2 text-[10.5px] text-slate-400">
              履歴の保存が無効です（BLOB_READ_WRITE_TOKEN 未設定）。会話はこのタブを閉じると失われます。
            </p>
          )}
        </div>
      )}

      {/* ── 本体 ─────────────────────────────────────────────────────────── */}
      {view === "history" ? (
        <HistoryView
          threads={threads}
          loading={threadsLoading}
          currentPageId={meta?.pageId ?? null}
          scope={scope}
          onScope={setScope}
          onOpen={openThread}
          onRename={renameThread}
          onDelete={deleteThread}
          onDeleteAll={deleteAll}
        />
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 min-h-0 space-y-3 overflow-y-auto px-3 py-3">
            {messages.length === 0 && !streaming && (
              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3">
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 flex-none text-slate-400" />
                  <p className="text-[11.5px] leading-relaxed text-slate-600">
                    この画面が表示しているデータを見ています。数字の意味、優先順位の根拠、
                    元データの中身まで聞けます。必要なら取得元 API まで自分で降りて確認します。
                  </p>
                </div>
                <div className="space-y-1.5">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); setTimeout(() => taRef.current?.focus(), 0); }}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-left text-[11.5px]
                                 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => <MessageBubble key={i} message={m} />)}

            {/* ストリーム中 */}
            {streaming && (
              <div className="space-y-2">
                {liveTools.length > 0 && (
                  <ul className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-2">
                    {liveTools.map((t, i) => (
                      <li key={`${t.path}-${i}`} className="flex items-start gap-1.5 text-[10.5px]">
                        {t.status === "start"
                          ? <Loader2 className="mt-0.5 h-3 w-3 flex-none animate-spin text-blue-500" />
                          : t.status === "ok"
                            ? <Check className="mt-0.5 h-3 w-3 flex-none text-emerald-600" />
                            : <AlertCircle className="mt-0.5 h-3 w-3 flex-none text-red-500" />}
                        <span className="min-w-0">
                          <code className="break-all text-slate-700">{t.path || "(データ取得)"}</code>
                          {t.summary && <span className="text-slate-500"> — {t.summary}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {!streamText && thinking && prefs.showThinking && (
                  <p className="line-clamp-3 text-[10.5px] italic leading-relaxed text-slate-400">{thinking}</p>
                )}

                {streamText ? (
                  <div className="prose prose-sm prose-slate max-w-none text-[12.5px]
                    prose-headings:text-[13px] prose-headings:font-semibold prose-p:my-1.5
                    prose-ul:my-1.5 prose-li:my-0.5 prose-table:text-[11px]">
                    <ReactMarkdown>{streamText}</ReactMarkdown>
                  </div>
                ) : liveTools.length === 0 && (!thinking || !prefs.showThinking) ? (
                  <div className="flex items-center gap-2 text-[11.5px] text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> 考えています…
                  </div>
                ) : null}
              </div>
            )}

          </div>

          {/* ── 入力 ───────────────────────────────────────────────────── */}
          <div className="flex-none border-t border-slate-200 p-2.5">
            <div className="flex items-end gap-1.5 rounded-xl border border-slate-300 bg-white px-2 py-1.5
                            focus-within:border-blue-500">
              <textarea
                ref={taRef}
                rows={1}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                }}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="この画面について聞く（Enter で送信 / Shift+Enter で改行）"
                className="max-h-[140px] min-h-[22px] flex-1 resize-none bg-transparent text-[12px]
                           leading-relaxed text-slate-900 outline-none placeholder:text-slate-400"
              />
              {streaming ? (
                <button
                  onClick={stop}
                  title="中断"
                  className="flex-none rounded-lg bg-slate-200 p-1.5 text-slate-700 hover:bg-slate-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => void send()}
                  disabled={!input.trim()}
                  title="送信"
                  className="flex-none rounded-lg bg-blue-600 p-1.5 text-white transition
                             hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="mt-1 px-1 text-[10px] text-slate-400">
              読み取り専用。データの更新・送信はできません。
            </p>
          </div>
        </>
      )}
    </aside>
  );
}
