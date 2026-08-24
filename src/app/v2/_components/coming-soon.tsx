import { Construction } from "lucide-react";

// ─── 新 UI（v2）の未実装ページ用プレースホルダ ────────────────────────────────
// モックのサイドバー項目を全て用意しつつ、中身は段階的に実装するための枠。

export function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <>
      <div className="flex items-center gap-3.5 px-5 py-3.5 bg-white border-b border-slate-200">
        <h1 className="m-0 text-base font-bold tracking-tight">{title}</h1>
      </div>
      <div className="p-5">
        <div className="rounded-[10px] border border-dashed border-slate-300 bg-white/60 grid place-items-center py-20 text-center">
          <Construction className="w-8 h-8 text-slate-300 mb-3" />
          <div className="text-sm font-semibold text-slate-500">{title} は準備中です</div>
          <div className="text-xs text-slate-400 mt-1 max-w-md">
            {note ?? "この新 UI ツールでは Tier 3 管理を先行実装しています。他の画面は順次このデザインで作り込みます。"}
          </div>
        </div>
      </div>
    </>
  );
}
