"use client";

// ─── AI 回答の Markdown ビューアー ────────────────────────────────────────────
//
// パネルは幅 340〜760px と狭い。素の prose だけでは以下が読めなくなるため、
// 要素ごとに描画を定義している。
//
//   - **表**: react-markdown は単体で GFM を解釈しない（remark-gfm が必須）。
//            入れないと "| 項目 | 値 |" が段落テキストとして素通しになる。
//            さらに幅が足りないので、表だけを独立して横スクロールさせる。
//   - **コード/長い ID/URL**: 折り返さないとパネルからはみ出す。
//   - **リンク**: 別タブで開く。パネル内で遷移すると会話が消える。

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

/**
 * クリップボードへコピーする。
 *
 * navigator.clipboard は **secure context 限定**（https / localhost）。
 * それ以外や権限拒否では例外になるので、textarea + execCommand に落とす。
 * 「押したのに何も起きない」を避けるため、結果は必ず呼び出し元へ返す。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* フォールバックへ */ }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** コピーボタン。押下後2秒だけ結果を出す */
export function CopyButton({
  getText,
  label = "コピー",
  className = "",
}: {
  /** 押された瞬間に本文を取る（ストリーミング中の古い値を掴まないため関数で受ける） */
  getText: () => string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  const onClick = useCallback(async () => {
    const ok = await copyText(getText());
    setState(ok ? "done" : "failed");
    window.setTimeout(() => setState("idle"), 2000);
  }, [getText]);

  return (
    <button
      onClick={onClick}
      title={label || "コピー"}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10.5px]
                  transition ${state === "failed" ? "text-red-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}
                  ${className}`}
    >
      {state === "done"
        ? <><Check className="h-3 w-3 text-emerald-600" />{label !== "" && <span className="text-emerald-600">コピーしました</span>}</>
        : state === "failed"
          ? <><Copy className="h-3 w-3" />{label !== "" && <span>コピーできません</span>}</>
          : <><Copy className="h-3 w-3" />{label !== "" && <span>{label}</span>}</>}
    </button>
  );
}

/**
 * 表・コードブロックなど「幅を食う要素」を独立したスクロール領域に閉じ込める。
 * パネル本体を横スクロールさせると、テキストまで読めなくなる。
 *
 * 端のフェードで「まだ続きがある」ことを示す。CSS のスクロールバー装飾
 * （scrollbar-width / ::-webkit-scrollbar）では代用できない — macOS の
 * オーバーレイスクロールバーは静止時に消え、領域も占有しないため
 * （実測: offsetHeight - clientHeight = 2px = border のみ）。
 */
function ScrollBox({
  children,
  tone = "white",
}: {
  children: React.ReactNode;
  /** フェードの色を中身の背景に合わせる */
  tone?: "white" | "slate";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => setEdge({
      left:  el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
    update();

    el.addEventListener("scroll", update, { passive: true });
    // ストリーミング中は中身の幅が伸びるので、箱と中身の両方を監視する
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);

    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  const from = tone === "slate" ? "from-slate-50" : "from-white";

  return (
    <div className="relative my-2">
      <div ref={ref}
        className={`ai-scrollbox overflow-x-auto rounded-md border border-slate-200
                    ${tone === "slate" ? "bg-slate-50" : ""}`}>
        {children}
      </div>
      {edge.right && (
        <div aria-hidden
          className={`pointer-events-none absolute inset-y-px right-px w-8 rounded-r-md
                      bg-gradient-to-l ${from} to-transparent`} />
      )}
      {edge.left && (
        <div aria-hidden
          className={`pointer-events-none absolute inset-y-px left-px w-8 rounded-l-md
                      bg-gradient-to-r ${from} to-transparent`} />
      )}
    </div>
  );
}

/** コードブロック。右上にコピーボタンを重ねる */
function CodeBlock({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  return (
    <div className="group relative">
      <ScrollBox tone="slate">
        <pre ref={ref} className="m-0">{children}</pre>
      </ScrollBox>
      <div className="absolute right-1.5 top-1.5 rounded bg-slate-50/90 opacity-0 transition
                      group-hover:opacity-100 focus-within:opacity-100">
        <CopyButton getText={() => ref.current?.textContent ?? ""} />
      </div>
    </div>
  );
}

const COMPONENTS: Components = {
  // ── 表 ──────────────────────────────────────────────────────────────────
  // w-full にすると列がコンテナ幅に圧縮され、セル内が語中で改行される
  // （実測: "anthropic/c / laude-opus-4.8"）。自然幅にして溢れた分は横スクロールへ。
  table: ({ children }) => (
    <ScrollBox>
      <table className="w-auto min-w-full border-collapse text-[11px]">{children}</table>
    </ScrollBox>
  ),
  thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
  th: ({ children }) => (
    <th className="min-w-[7rem] whitespace-nowrap border-b border-slate-200 px-2 py-1.5
                   text-left font-semibold text-slate-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    // min-w: 列数が多いとき（5列 × 400px 等）に自動レイアウトが列を潰し、
    //        「AI パ ネル で」のように数文字ずつ折り返す。下限を切って横スクロールへ逃がす。
    // max-w: 逆に長い説明セル1つで表が無限に伸びるのを防ぐ。
    <td className="min-w-[7rem] max-w-[16rem] border-b border-slate-100 px-2 py-1.5
                   align-top text-slate-700">
      {children}
    </td>
  ),
  tr: ({ children }) => <tr className="even:bg-slate-50/50">{children}</tr>,

  // ── コード ──────────────────────────────────────────────────────────────
  // インラインは背景付き、ブロックは独立スクロール。
  // react-markdown v10 は inline フラグを渡さないため、pre の子かどうかで判定する。
  code: ({ children, className }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code className="block min-w-full whitespace-pre px-2.5 py-2 font-mono text-[10.5px]
                         leading-relaxed text-slate-800">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]
                       [overflow-wrap:break-word] text-slate-800">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,

  // ── テキスト要素 ────────────────────────────────────────────────────────
  h1: ({ children }) => <h3 className="mt-3 mb-1 text-[13.5px] font-bold text-slate-900">{children}</h3>,
  h2: ({ children }) => <h4 className="mt-3 mb-1 text-[13px] font-bold text-slate-900">{children}</h4>,
  h3: ({ children }) => <h5 className="mt-2.5 mb-1 text-[12.5px] font-semibold text-slate-900">{children}</h5>,
  h4: ({ children }) => <h6 className="mt-2 mb-0.5 text-[12px] font-semibold text-slate-700">{children}</h6>,
  p:  ({ children }) => <p className="my-1.5 leading-relaxed break-words">{children}</p>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-4">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed break-words">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="text-slate-400 line-through">{children}</del>,
  hr: () => <hr className="my-3 border-slate-200" />,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-slate-300 pl-2.5 text-slate-600">
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => (
    // パネル内で遷移すると会話が消えるため必ず別タブ
    <a href={href} target="_blank" rel="noopener noreferrer"
       className="text-blue-600 underline decoration-blue-300 underline-offset-2 break-all
                  hover:text-blue-700">
      {children}
    </a>
  ),

  // ── GFM タスクリスト ────────────────────────────────────────────────────
  input: ({ checked, type }) =>
    type === "checkbox"
      ? <input type="checkbox" checked={!!checked} readOnly className="mr-1 align-middle" />
      : null,
};

/**
 * GFM の表は「ブロックの先頭」に無いと表として解釈されない。
 * モデルが
 *     参考までに関連する設定値：
 *     | 項目 | 値 |
 *     |---|---|
 * のように直前の文と地続きで書くと、表全体が段落の続きとして扱われ、
 * `| 項目 | 値 | |---|---|` が生のまま画面に出る（実際に発生）。
 *
 * プロンプトで空行を指示しても取りこぼすので、描画側で直前に空行を差し込む。
 * 判定は「表ヘッダ行 + 次行が区切り行」の2行セットが揃ったときだけ。
 * 単に | を含むだけの文章を巻き込まないようにする。
 */
function ensureTableBlocks(md: string): string {
  const lines = md.split("\n");
  const isRow = (s?: string) => !!s && /^\s*\|.*\|\s*$/.test(s);
  // |---|:--:|---| の形（区切り行）
  const isDelim = (s?: string) => !!s && /^\s*\|?[\s:|-]*\|[\s:|-]*$/.test(s) && /-/.test(s);

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const prev = out[out.length - 1];
    if (
      isRow(lines[i]) && isDelim(lines[i + 1])   // ここから表が始まる
      && prev !== undefined && prev.trim() !== "" // 直前が本文
      && !isRow(prev)                             // 直前が表の一部ではない
    ) {
      out.push("");
    }
    out.push(lines[i]);
  }
  return out.join("\n");
}

export function AiMarkdown({ children }: { children: string }) {
  return (
    <div className="text-[12.5px] text-slate-800 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {ensureTableBlocks(children)}
      </ReactMarkdown>
    </div>
  );
}
