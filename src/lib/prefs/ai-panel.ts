// ─── AI アシスタントパネルのアカウント設定 ────────────────────────────────────
//
// 保存先は旧 UI から使っている localStorage の `cxm_prefs_<name2>`。その中に
// `ai_panel` を1階層足すだけにしている。NocoDB に列を増やさないのは、
//   - staff_identify に無い列へ PATCH すると 422 で落ちる（列追加は運用作業）
//   - パネルの見た目に関する設定はサーバー側に読み手がいない
// ため。逆に「履歴」は Blob 側にユーザー単位で実体があるので、そちらは
// /api/ai/chat/threads を直接叩く（この設定には含めない）。
//
// name2 は cxm_user_uid Cookie に入っているが HttpOnly なのでクライアントから
// 読めない。/api/user/profile を1回だけ引いてモジュール内でメモ化する。

export interface AiPanelPrefs {
  /** ページを開いた時点でパネルを開いた状態にする */
  openOnLoad:   boolean;
  /** 履歴一覧の既定の絞り込み */
  historyScope: "page" | "all";
  /** 回答生成中の思考プロセスを表示する */
  showThinking: boolean;
}

export const AI_PANEL_PREFS_DEFAULT: AiPanelPrefs = {
  openOnLoad:   false,
  historyScope: "all",
  showThinking: true,
};

/** 同一タブ内で設定変更をパネルへ伝えるためのイベント名（storage イベントは他タブ専用） */
export const AI_PANEL_PREFS_EVENT = "cxm:ai-panel-prefs";

function prefsKey(name2: string) { return `cxm_prefs_${name2}`; }

/** cxm_prefs_<name2> 全体。ai_panel 以外のキー（旧 UI の設定）を壊さないため */
type PrefsBag = Record<string, unknown> & { ai_panel?: Partial<AiPanelPrefs> };

function readBag(name2: string): PrefsBag {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(prefsKey(name2));
    return raw ? (JSON.parse(raw) as PrefsBag) : {};
  } catch { return {}; }
}

export function loadAiPanelPrefs(name2: string): AiPanelPrefs {
  const saved = readBag(name2).ai_panel ?? {};
  return {
    openOnLoad:   saved.openOnLoad   ?? AI_PANEL_PREFS_DEFAULT.openOnLoad,
    historyScope: saved.historyScope ?? AI_PANEL_PREFS_DEFAULT.historyScope,
    showThinking: saved.showThinking ?? AI_PANEL_PREFS_DEFAULT.showThinking,
  };
}

export function saveAiPanelPrefs(name2: string, prefs: AiPanelPrefs): void {
  if (typeof window === "undefined") return;
  try {
    const bag = readBag(name2);
    window.localStorage.setItem(prefsKey(name2), JSON.stringify({ ...bag, ai_panel: prefs }));
    window.dispatchEvent(new CustomEvent<AiPanelPrefs>(AI_PANEL_PREFS_EVENT, { detail: prefs }));
  } catch { /* ignore */ }
}

// ── ログイン中ユーザーの name2 ────────────────────────────────────────────────

let userKeyPromise: Promise<string | null> | null = null;

/** /api/user/profile を1回だけ引いて name2 を返す。未ログイン等では null */
export function fetchUserKey(): Promise<string | null> {
  if (!userKeyPromise) {
    userKeyPromise = fetch("/api/user/profile")
      .then(res => (res.ok ? res.json() : null))
      .then((data: { name2?: string } | null) => data?.name2 ?? null)
      .catch(() => null);
  }
  return userKeyPromise;
}
