// サーバーコンポーネントのデータ取得中に表示されるフォールバック（ストリーミング）。
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function Loading() {
  return (
    <>
      <div className="flex items-center gap-3 px-5 py-3.5 bg-white border-b border-slate-200">
        <Link href="/v2/tier3" className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-blue-600">
          <ArrowLeft className="w-4 h-4" /> Tier 3 一覧
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-[13px] font-bold text-slate-800">会社詳細</span>
        <span className="ml-auto text-[11px] text-slate-400">利用状況ビュー</span>
      </div>
      <div className="flex items-center justify-center gap-2 text-slate-500 py-20">
        <Loader2 className="w-4 h-4 animate-spin" /> 読み込み中...
      </div>
    </>
  );
}
