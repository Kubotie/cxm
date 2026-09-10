"use client";

// ─── 言質の引用と、その前後 ───────────────────────────────────────────────────
//
// **一文だけ見せられても判断できない。** 実測（2026-09-10）: LayerX の
// 「今後もサービス自体は増えていく」が V5（体制縮小）として出たが、この一文では
// 増員の話か縮小の話か読めず、レビューが止まった。前後を見れば
// 「契約管理も増えており、今後もサービス自体は増えていく」＝サイト数が増える話だと分かる。
//
// ⚠️ ホバーの当たり判定は「前後を見る」の文字だけにする。
//   引用ブロック全体を対象にすると、読んでいる最中に勝手に開いて邪魔になる。
//
// ⚠️ 置く側のカードに overflow-hidden があるとポップオーバーが切れる。
//   角丸はヘッダーの rounded-t-xl などで代替すること。
//
// ポップオーバー自体にもカーソルを乗せられる（読んでいる途中で消えると使えない）。
// 入れ子は span + block で組む。div を混ぜると inline 要素の中に block が入って不正になる。

import type { VoiceContext } from "@/lib/churn/voice-context";

export function QuoteWithContext({ quote, context }: {
  quote: string;
  context: VoiceContext | null;
}) {
  const has = context !== null && Boolean(context.before || context.after || context.approximate);

  return (
    <div className="relative">
      <div className="text-[13px] text-slate-900 leading-relaxed bg-red-50 border-l-2 border-red-700
        px-3 py-2 rounded-r">
        「{quote}」
        {has && context && (
          <span className="group ml-1.5 text-[10px] text-red-800/70 whitespace-nowrap cursor-help
            underline decoration-dotted underline-offset-2 hover:text-red-900">
            前後を見る
            <span className="absolute left-0 right-0 top-full z-30 mt-1 hidden group-hover:block">
              <span className="block bg-white border border-slate-300 rounded-lg shadow-xl p-3
                max-h-[280px] overflow-y-auto text-[12px] leading-relaxed text-left normal-case">
                {context.approximate ? (
                  <>
                    <span className="block text-[10.5px] text-amber-700 mb-1.5">
                      原文の中でこの引用を見つけられませんでした（表記が変わっている可能性）。文書の冒頭を出しています。
                    </span>
                    <span className="block text-slate-500 whitespace-pre-wrap">{context.matched}</span>
                  </>
                ) : (
                  <span className="block whitespace-pre-wrap">
                    <span className="text-slate-400">{context.before}</span>
                    <mark className="bg-amber-100 text-slate-900 font-bold px-0.5">{context.matched}</mark>
                    <span className="text-slate-400">{context.after}</span>
                  </span>
                )}
              </span>
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
