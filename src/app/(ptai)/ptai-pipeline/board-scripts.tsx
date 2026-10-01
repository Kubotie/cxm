"use client";

// ─── 原本スクリプトの読み込み ────────────────────────────────────────────────
//
// 順番に意味がある:
//   1. /api/ptai/raw   … 原本の RAW 相当（顧客名・MRR を含むので認証必須の API 経由）。
//                        PTAI_DATA_SOURCE=twenty なら Twenty と Notion から組み立てる
//   2. claude-shim.js  … window.claude を用意する（board.js が起動時に使う）
//   3. board.js        … 原本の JS（Version 96）
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
      // Salesforce の商談を最新にしてから RAW を読む。
      // 1 時間以内に同期済みならサーバー側で何もしない（?ifStale=1）。
      // Vercel の Hobby プランは Cron が 1 日 1 回までなので、
      // 「1 時間おき」はここで担保する。失敗しても画面は出す。
      try {
        await fetch("/api/ptai/sf-sync?ifStale=1", { method: "POST", credentials: "same-origin" });
      } catch { /* 同期できなくても表示は続ける */ }

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
