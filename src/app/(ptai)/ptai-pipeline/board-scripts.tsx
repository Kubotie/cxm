"use client";

// ─── 原本スクリプトの読み込み ────────────────────────────────────────────────
//
// 順番に意味がある:
//   1. /api/ptai/raw   … 原本 1353 行の RAW（顧客名・MRR を含むので認証必須の API 経由）
//   2. claude-shim.js  … window.claude を用意する（board.js が起動時に使う）
//   3. board.js        … 原本 1354〜3898 行
//
// board.js はクラシックスクリプトで、トップレベルに const / let を置いている。
// 二度実行すると再宣言で落ちるので、ドキュメントごとに 1 回だけに絞る。

import { useEffect } from "react";

const SCRIPTS = [
  "/ptai-pipeline/claude-shim.js",
  "/ptai-pipeline/board.js",
];

declare global {
  interface Window {
    __pgaBoardLoaded?: boolean;
    __PGA_RAW?: unknown;
  }
}

function load(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = false;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`${src} を読み込めませんでした`));
    document.body.appendChild(el);
  });
}

export function BoardScripts() {
  useEffect(() => {
    if (window.__pgaBoardLoaded) return;
    window.__pgaBoardLoaded = true;

    (async () => {
      try {
        const res = await fetch("/api/ptai/raw", { credentials: "same-origin" });
        if (!res.ok) throw new Error(`/api/ptai/raw ${res.status}`);
        window.__PGA_RAW = await res.json();
      } catch (e) {
        console.error("[ptai-pipeline] RAW を読み込めませんでした", e);
        return;
      }

      for (const src of SCRIPTS) {
        try {
          await load(src);
        } catch (e) {
          console.error("[ptai-pipeline]", e);
          return;
        }
      }
    })();
  }, []);

  return null;
}
