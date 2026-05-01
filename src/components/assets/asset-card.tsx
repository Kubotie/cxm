"use client";
import { Badge }  from "@/components/ui/badge";
import { User, TrendingUp, Sparkles, MessageSquare, Tag } from "lucide-react";
import type { CsmAsset } from "@/lib/nocodb/assets";

export interface AssetCardProps {
  asset: CsmAsset;
  activeTag?: string;
  onTagClick?: (tag: string) => void;
  onClick?: () => void;
}

export function AssetCard({ asset, activeTag, onTagClick, onClick }: AssetCardProps) {
  const createdAt = asset.created_at
    ? new Date(asset.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })
    : null;

  const tagList = asset.tags
    ? asset.tags.split(",").map(t => t.trim()).filter(Boolean)
    : [];

  const KNOWN_CATEGORIES = ["事例", "AI計画", "アカウントプランニング", "ノウハウ・マニュアル", "その他"];
  const categoryColor =
    asset.category === "事例"               ? "text-blue-700 border-blue-300 bg-blue-50" :
    asset.category === "AI計画"             ? "text-violet-700 border-violet-300 bg-violet-50" :
    asset.category === "アカウントプランニング" ? "text-amber-700 border-amber-300 bg-amber-50" :
    asset.category === "ノウハウ・マニュアル"  ? "text-green-700 border-green-300 bg-green-50" :
    "text-slate-600 border-slate-300 bg-slate-50";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg border border-slate-200 bg-white p-3.5 space-y-2 hover:border-slate-400 hover:shadow-sm transition-all"
    >
      {/* ヘッダー行: タイトル + カテゴリバッジ */}
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm text-slate-800 leading-snug line-clamp-2 flex-1">
          {asset.title}
        </p>
        {asset.category && KNOWN_CATEGORIES.includes(asset.category) && (
          <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${categoryColor}`}>
            {asset.category}
          </Badge>
        )}
      </div>

      {/* サマリー */}
      {asset.summary && (
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{asset.summary}</p>
      )}

      {/* ソース種別バッジ（AI計画・レビューは目立たせる） */}
      {asset.source_type === "ai_plan" && (
        <div className="flex items-center gap-1 text-[10px] text-violet-600 bg-violet-50 rounded px-1.5 py-0.5 w-fit">
          <Sparkles className="w-3 h-3" />
          AI計画
        </div>
      )}
      {asset.source_type === "review" && (
        <div className="flex items-center gap-1 text-[10px] text-green-700 bg-green-50 rounded px-1.5 py-0.5 w-fit">
          <MessageSquare className="w-3 h-3" />
          アクションレビュー
        </div>
      )}

      {/* タグ */}
      {tagList.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
          <Tag className="w-3 h-3 text-slate-300 flex-shrink-0" />
          {tagList.slice(0, 4).map(tag => (
            <span
              key={tag}
              role="button"
              tabIndex={0}
              onClick={e => {
                e.stopPropagation();
                onTagClick?.(tag);
              }}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onTagClick?.(tag);
                }
              }}
              className={[
                "px-1.5 py-0.5 rounded text-[10px] border transition-colors cursor-pointer",
                activeTag === tag
                  ? "bg-violet-600 text-white border-violet-600"
                  : "text-slate-400 border-slate-200 hover:border-violet-400 hover:text-violet-600",
              ].join(" ")}
            >
              {tag}
            </span>
          ))}
          {tagList.length > 4 && (
            <span className="text-[10px] text-slate-300">+{tagList.length - 4}</span>
          )}
        </div>
      )}

      {/* フッター: 作成者 + 参照数 + 日付 */}
      <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
        {asset.author && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {asset.author}
          </span>
        )}
        {asset.reference_count > 0 && (
          <span className="flex items-center gap-1 text-violet-500">
            <TrendingUp className="w-3 h-3" />
            {asset.reference_count}回参照
          </span>
        )}
        {createdAt && <span className="ml-auto">{createdAt}</span>}
      </div>
    </button>
  );
}
