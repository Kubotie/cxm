"use client";

// ─── 画面コンテキストの登録機構 ───────────────────────────────────────────────
//
// 各画面が「今表示しているデータ」を AI パネルに申告する。
// 画面側の書き方は1行:
//
//   useRegisterAiPageContext({
//     pageId: "v2-readiness",
//     title: "提案準備ボード",
//     description: "担当顧客を提案できる/できないで4レーンに分ける画面",
//     snapshot: data,                       // すでに fetch 済みのものをそのまま
//     sources: [{ label: "提案準備ボード", endpoint: "/api/companies/proposal-board" }],
//   });
//
// ── context を2つに分けている理由（実際に踏んだ無限ループ）────────────────────
//   最初は actions と meta を1つの context 値に入れていた。すると
//     meta 更新 → context 値の参照が変わる → 登録フックの cleanup が走って retract
//     → meta が null → 画面が再登録 → meta 更新 → …
//   で "Maximum update depth exceeded" になる。
//   **登録側が触る API は絶対に参照が変わらないこと**が要件なので、
//   actions（不変）と meta（可変）を別 context に分離した。
//
// ── snapshot を state ではなく ref に置いている理由 ───────────────────────────
//   snapshot は毎レンダーで新しいオブジェクト参照になりうる。state に入れると
//   「登録 → 再レンダー → 登録」でやはりループする。
//   パネルが snapshot を必要とするのは **送信の瞬間だけ** なので、
//   ref に最新を置いて送信時に読む。UI に出す軽い情報だけを state で持つ。

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import type { AiPageContext } from "@/lib/ai/page-context";

/** UI 表示に使う軽量メタ（再レンダーを起こしてよいもの） */
export interface AiPageMeta {
  pageId:      string;
  title:       string;
  description: string;
  sourceCount: number;
}

/** 登録側が使う API。**参照は一度作ったら変えない** */
interface AiPageActions {
  publish: (ctx: AiPageContext) => void;
  retract: (pageId: string) => void;
  readLive: () => AiPageContext | null;
}

const ActionsCtx = createContext<AiPageActions | null>(null);
const MetaCtx    = createContext<AiPageMeta | null>(null);

export function AiPageContextProvider({ children }: { children: React.ReactNode }) {
  const liveRef = useRef<AiPageContext | null>(null);
  const [meta, setMeta] = useState<AiPageMeta | null>(null);

  // deps を空にして参照を固定する。setMeta / ref は再生成されないので安全。
  const actions = useMemo<AiPageActions>(() => ({
    publish: (ctx: AiPageContext) => {
      liveRef.current = ctx;
      setMeta(prev => {
        const next: AiPageMeta = {
          pageId:      ctx.pageId,
          title:       ctx.title,
          description: ctx.description,
          sourceCount: ctx.sources.length,
        };
        // 中身が同じなら前の参照を返す（React が再レンダーを打ち切る）
        if (prev
          && prev.pageId === next.pageId
          && prev.title === next.title
          && prev.description === next.description
          && prev.sourceCount === next.sourceCount) return prev;
        return next;
      });
    },
    retract: (pageId: string) => {
      if (liveRef.current?.pageId === pageId) liveRef.current = null;
      setMeta(prev => (prev?.pageId === pageId ? null : prev));
    },
    readLive: () => liveRef.current,
  }), []);

  return (
    <ActionsCtx.Provider value={actions}>
      <MetaCtx.Provider value={meta}>{children}</MetaCtx.Provider>
    </ActionsCtx.Provider>
  );
}

// ── パネル側 ──────────────────────────────────────────────────────────────────

/** 送信時に最新のコンテキストを読む */
export function useAiPageActions(): AiPageActions | null {
  return useContext(ActionsCtx);
}

/** 画面名など UI 表示用 */
export function useAiPageMeta(): AiPageMeta | null {
  return useContext(MetaCtx);
}

// ── 画面側 ────────────────────────────────────────────────────────────────────

/**
 * 画面側から呼ぶ。マウント中はこの画面のコンテキストが AI パネルに渡る。
 * snapshot はメモ化不要（ref に入るだけで再レンダーを起こさない）。
 */
export function useRegisterAiPageContext(ctx: AiPageContext): void {
  const actions = useContext(ActionsCtx);

  // 毎レンダー後に最新化する。中身が変わらなければ state は動かない。
  useEffect(() => {
    actions?.publish(ctx);
  });

  // アンマウント（と画面切り替え）時だけ解除する。
  // actions は不変なので、この effect が再実行されるのは pageId が変わったときだけ。
  const pageId = ctx.pageId;
  useEffect(() => {
    return () => actions?.retract(pageId);
  }, [actions, pageId]);
}
