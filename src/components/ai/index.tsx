"use client";

// ─── AI アシスタントのマウント一式 ────────────────────────────────────────────
// ルートレイアウトに1回置くだけで、全ページでパネルが使えるようになる。
// Provider が children を包んでいるので、各画面から
// useRegisterAiPageContext() でデータを申告できる。
//
// ── 押し出しが「ラッパー div の padding-right」である理由 ─────────────────────
//   ここは3回作り直している。効かなかったものと理由:
//
//   1. <html> の padding-right     → ルート要素の padding はスクロール可能領域を作らない
//   2. <body> の margin-right      → 同上（実測 html.scrollWidth が viewport で止まる）
//   3. ラッパー div の margin-right → **右マージンは inline-end 方向の
//                                     scrollable overflow に寄与しない**（CSS 仕様）
//
//   いずれも「本文が下限幅に達するとパネルの下に潜り込み、横スクロールしても
//   到達できない」状態になった。padding は overflow に寄与するので、
//   ラッパーの padding-right + box-sizing: content-box にしている。
//   content-box が必須なのは、Tailwind preflight が全要素を border-box にしており、
//   border-box だと min-width に padding が含まれて本文の下限が確保できないため。

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AiPageContextProvider } from "./ai-page-context";
import {
  AiSidePanel, MIN_CONTENT_WIDTH, clampPanelWidth,
  PANEL_WIDTH_KEY, PANEL_DEFAULT_WIDTH,
} from "./ai-side-panel";
import { fetchUserKey, loadAiPanelPrefs } from "@/lib/prefs/ai-panel";

/** パネルを出さないパス */
const HIDDEN_PREFIXES = ["/login"];

export function AiAssistantShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const disabled = HIDDEN_PREFIXES.some(p => pathname?.startsWith(p));

  const [open, setOpen]   = useState(false);
  const [width, setWidth] = useState(PANEL_DEFAULT_WIDTH);

  // 保存済みの幅を復元し、ウィンドウ幅に対して上限をかける
  useEffect(() => {
    const saved = Number(window.localStorage.getItem(PANEL_WIDTH_KEY));
    setWidth(prev => clampPanelWidth(
      Number.isFinite(saved) && saved > 0 ? saved : prev,
      window.innerWidth,
    ));

    // ウィンドウを縮めたときにパネルが画面を占領しないようにする
    const onResize = () => setWidth(prev => clampPanelWidth(prev, window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 「起動時に開く」設定（/v2/settings）。アカウント単位なので name2 を引いてから読む。
  // ルートレイアウトに1つしか無いコンポーネントなので、画面遷移では再実行されない
  // ＝ ユーザーが閉じたパネルを遷移のたびに開き直すことはない。
  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    fetchUserKey().then(key => {
      if (cancelled || !key) return;
      if (loadAiPanelPrefs(key).openOnLoad) setOpen(true);
    });
    return () => { cancelled = true; };
  }, [disabled]);

  const pushed = open && !disabled;

  return (
    <AiPageContextProvider>
      <div
        style={pushed
          ? {
              boxSizing:    "content-box",
              paddingRight: `${width}px`,
              minWidth:     `${MIN_CONTENT_WIDTH}px`,
            }
          : undefined}
      >
        {children}
      </div>
      <AiSidePanel
        open={open}
        setOpen={setOpen}
        width={width}
        setWidth={setWidth}
        disabled={disabled}
      />
    </AiPageContextProvider>
  );
}

export { useRegisterAiPageContext } from "./ai-page-context";
