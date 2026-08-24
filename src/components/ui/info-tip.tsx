"use client";

import { Info } from "lucide-react";
import { useState, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * 指標ラベル横に置く小さな ℹ アイコン。ホバー / タップで説明を即時表示する。
 * ツールチップは position:fixed + portal で body 直下に描画するため、
 * overflow:auto なテーブル内でもクリップされない。
 */
export function InfoTip({ text, className = "" }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // 画面端で見切れないよう左右をクランプ（ツールチップ最大幅 280 の半分 = 140）
    const left = Math.min(Math.max(r.left + r.width / 2, 148), window.innerWidth - 148);
    setPos({ top: r.bottom + 6, left });
    setOpen(true);
  };
  const hide = () => setOpen(false);

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={hide}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); open ? hide() : show(); }}
      className={`inline-flex items-center cursor-help text-slate-400 hover:text-blue-500 align-middle ${className}`}
      aria-label={text}
    >
      <Info className="w-3.5 h-3.5" />
      {open && typeof document !== "undefined" && createPortal(
        <div
          role="tooltip"
          style={{ position: "fixed", top: pos.top, left: pos.left, transform: "translateX(-50%)", zIndex: 9999, maxWidth: 280 }}
          className="rounded-lg bg-slate-800 text-white text-[11px] leading-relaxed px-3 py-2 shadow-lg pointer-events-none whitespace-pre-line"
        >
          {text}
        </div>,
        document.body,
      )}
    </span>
  );
}
