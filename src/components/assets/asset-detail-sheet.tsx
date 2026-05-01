"use client";
import { useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge }   from "@/components/ui/badge";
import { Button }  from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, ExternalLink, User, TrendingUp, BookOpen } from "lucide-react";
import { toast } from "sonner";
import type { CsmAsset } from "@/lib/nocodb/assets";

export interface AssetDetailSheetProps {
  asset: CsmAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: (asset: CsmAsset) => void;
}

const SOURCE_LABEL: Record<string, string> = {
  uploaded: "アップロード",
  ai_plan:  "AI計画",
  review:   "レビュー",
};

export function AssetDetailSheet({
  asset,
  open,
  onOpenChange,
  onUpdated,
}: AssetDetailSheetProps) {
  const [recategorizing, setRecategorizing] = useState(false);

  if (!asset) return null;

  const createdAt = asset.created_at
    ? new Date(asset.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" })
    : null;

  async function handleRecategorize() {
    if (!asset) return;
    setRecategorizing(true);
    try {
      const res = await fetch(`/api/assets/${asset.asset_id}/categorize`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { asset: CsmAsset };
      onUpdated?.(data.asset);
      toast.success("再カテゴリ分類が完了しました");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "再分類に失敗しました");
    } finally {
      setRecategorizing(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[560px] flex flex-col">
        <SheetHeader className="flex-shrink-0 space-y-1">
          <SheetTitle className="text-base leading-snug">{asset.title}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex items-center gap-2 flex-wrap">
              {asset.category && (
                <Badge
                  variant="outline"
                  className={[
                    "text-[10px]",
                    asset.category === "事例"               ? "text-blue-700 border-blue-300 bg-blue-50" :
                    asset.category === "AI計画"             ? "text-violet-700 border-violet-300 bg-violet-50" :
                    asset.category === "アカウントプランニング" ? "text-amber-700 border-amber-300 bg-amber-50" :
                    asset.category === "ノウハウ・マニュアル"  ? "text-green-700 border-green-300 bg-green-50" :
                    "text-slate-600 border-slate-300 bg-slate-50",
                  ].join(" ")}
                >
                  {asset.category}
                </Badge>
              )}
              {asset.source_type && (
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <BookOpen className="w-3 h-3" />
                  {SOURCE_LABEL[asset.source_type] ?? asset.source_type}
                </span>
              )}
              {asset.author && (
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <User className="w-3 h-3" />
                  {asset.author}
                </span>
              )}
              {asset.reference_count > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-violet-500">
                  <TrendingUp className="w-3 h-3" />
                  {asset.reference_count}回参照
                </span>
              )}
              {createdAt && <span className="text-[10px] text-slate-400">{createdAt}</span>}
            </div>
          </SheetDescription>
        </SheetHeader>

        {/* サマリー */}
        {asset.summary && (
          <div className="flex-shrink-0 rounded-md bg-violet-50 border border-violet-100 p-3 mt-3">
            <p className="text-[10px] font-medium text-violet-600 mb-1">AI生成サマリー</p>
            <p className="text-xs text-slate-700 leading-relaxed">{asset.summary}</p>
            {asset.category_reason && (
              <p className="text-[10px] text-slate-500 mt-1.5">分類根拠: {asset.category_reason}</p>
            )}
          </div>
        )}

        {/* コンテンツ */}
        <ScrollArea className="flex-1 min-h-0 mt-3">
          <pre className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-mono bg-slate-50 rounded-md p-4 border border-slate-100">
            {asset.content}
          </pre>
        </ScrollArea>

        {/* アクション */}
        <div className="flex-shrink-0 flex items-center gap-2 pt-3 border-t mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecategorize}
            disabled={recategorizing}
            className="text-xs"
          >
            {recategorizing
              ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
              : <RefreshCw className="w-3 h-3 mr-1" />
            }
            AI再分析
          </Button>
          {asset.blob_url && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-xs"
            >
              <a href={asset.blob_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3 mr-1" />
                元ファイル
              </a>
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            閉じる
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
