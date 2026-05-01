"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Badge }    from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AssetUploadDialog } from "@/components/assets/asset-upload-dialog";
import { AssetCard }         from "@/components/assets/asset-card";
import { AssetDetailSheet }  from "@/components/assets/asset-detail-sheet";
import { SidebarNav }  from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { Upload, Search, FileText, SortAsc, Tag, X } from "lucide-react";
import type { CsmAsset } from "@/lib/nocodb/assets";
import type { AssetSortBy } from "@/lib/nocodb/assets";

const CATEGORY_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "事例", label: "事例" },
  { value: "AI計画", label: "AI計画" },
  { value: "アカウントプランニング", label: "アカウントプランニング" },
  { value: "ノウハウ・マニュアル", label: "ノウハウ・マニュアル" },
  { value: "その他", label: "その他" },
];

const SORT_OPTIONS: { value: AssetSortBy; label: string }[] = [
  { value: "created_at",      label: "最新順" },
  { value: "reference_count", label: "参照数順" },
  { value: "title",           label: "タイトル順" },
];

const PAGE_SIZE = 24;

export function AssetsPage() {
  const searchParams = useSearchParams();

  const [assets, setAssets]           = useState<CsmAsset[]>([]);
  const [loading, setLoading]         = useState(false);
  const [q, setQ]                     = useState("");
  const [category, setCategory]       = useState("");
  const [linkedActionId]              = useState(() => searchParams.get("linked_action_id") ?? "");
  const [sortBy, setSortBy]           = useState<AssetSortBy>("created_at");
  const [activeTag, setActiveTag]     = useState("");
  const [tags, setTags]               = useState<string[]>([]);
  const [offset, setOffset]           = useState(0);
  const [hasMore, setHasMore]         = useState(false);
  const [uploadOpen, setUploadOpen]   = useState(false);
  const [selected, setSelected]       = useState<CsmAsset | null>(null);
  const [currentUser, setCurrentUser] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ログインユーザー取得
  useEffect(() => {
    fetch("/api/user/profile")
      .then(r => r.ok ? r.json() : null)
      .then((p: { name2?: string } | null) => { if (p?.name2) setCurrentUser(p.name2); })
      .catch(() => {});
  }, []);

  // タグ一覧を取得（初回のみ）
  useEffect(() => {
    fetch("/api/assets/tags")
      .then(r => r.ok ? r.json() : { tags: [] })
      .then((d: { tags: string[] }) => setTags(d.tags ?? []))
      .catch(() => {});
  }, []);

  const fetchAssets = useCallback(async (
    searchQ: string,
    cat: string,
    sort: AssetSortBy,
    tag: string,
    off: number,
    append = false,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQ) params.set("q", searchQ);
      if (cat)     params.set("category", cat);
      if (tag)     params.set("tag", tag);
      if (linkedActionId) params.set("linked_action_id", linkedActionId);
      params.set("sort_by", sort);
      params.set("limit",  String(PAGE_SIZE));
      params.set("offset", String(off));

      const res = await fetch(`/api/assets?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { assets: CsmAsset[] };
      const list = data.assets ?? [];

      setAssets(prev => append ? [...prev, ...list] : list);
      setHasMore(list.length === PAGE_SIZE);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [linkedActionId]);

  // 初回ロード + フィルタ変更時
  useEffect(() => {
    setOffset(0);
    fetchAssets(q, category, sortBy, activeTag, 0, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sortBy, activeTag, fetchAssets]);

  // 検索: debounce 400ms
  function handleSearchChange(v: string) {
    setQ(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setOffset(0);
      fetchAssets(v, category, sortBy, activeTag, 0, false);
    }, 400);
  }

  function handleLoadMore() {
    const nextOffset = offset + PAGE_SIZE;
    setOffset(nextOffset);
    fetchAssets(q, category, sortBy, activeTag, nextOffset, true);
  }

  function handleUploaded(asset: CsmAsset) {
    setAssets(prev => [asset, ...prev]);
    setUploadOpen(false);
    // タグ一覧を再取得
    fetch("/api/assets/tags")
      .then(r => r.ok ? r.json() : { tags: [] })
      .then((d: { tags: string[] }) => setTags(d.tags ?? []))
      .catch(() => {});
  }

  function handleAssetUpdated(updated: CsmAsset) {
    setAssets(prev => prev.map(a => a.asset_id === updated.asset_id ? updated : a));
    setSelected(updated);
  }

  // アクティブなフィルター数（検索ワード除く）
  const activeFilterCount = [category, activeTag].filter(Boolean).length;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <SidebarNav />
      <div className="flex flex-col flex-1 overflow-hidden">
        <GlobalHeader />
        <main className="flex flex-col flex-1 overflow-hidden">

          {/* ヘッダー */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">MDアセットライブラリ</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {linkedActionId
                  ? "このアクションに関連するアセット"
                  : "CSMが日々作成したナレッジを蓄積・活用する"}
              </p>
            </div>
            <Button onClick={() => setUploadOpen(true)} size="sm">
              <Upload className="w-4 h-4 mr-1.5" />
              MDファイルをアップロード
            </Button>
          </div>

          {/* フィルターバー */}
          <div className="px-6 py-3 border-b border-slate-100 flex-shrink-0 space-y-2.5">
            {/* 1行目: 検索 + ソート */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* 検索ボックス */}
              <div className="relative flex-1 min-w-[200px] max-w-[360px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  value={q}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder="タイトル・サマリーで検索..."
                  className="pl-8 text-xs h-8"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => handleSearchChange("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* ソート */}
              <div className="flex items-center gap-1.5">
                <SortAsc className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <div className="flex items-center gap-1">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSortBy(opt.value)}
                      className={[
                        "px-2.5 py-1 rounded-full text-xs border transition-colors",
                        sortBy === opt.value
                          ? "bg-slate-900 text-white border-slate-900"
                          : "text-slate-500 border-slate-200 hover:border-slate-400",
                      ].join(" ")}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* アクティブフィルターバッジ */}
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => { setCategory(""); setActiveTag(""); }}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                  フィルター解除 ({activeFilterCount})
                </button>
              )}
            </div>

            {/* 2行目: カテゴリ */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap">
                {CATEGORY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCategory(opt.value)}
                    className={[
                      "px-2.5 py-1 rounded-full text-xs border transition-colors",
                      category === opt.value
                        ? "bg-slate-900 text-white border-slate-900"
                        : "text-slate-500 border-slate-200 hover:border-slate-400",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

            </div>

            {/* 3行目: タグフィルター（タグが存在する場合のみ表示） */}
            {tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 text-[10px] text-slate-400 flex-shrink-0">
                  <Tag className="w-3 h-3" />
                  タグ
                </span>
                {tags.slice(0, 20).map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setActiveTag(activeTag === tag ? "" : tag)}
                    className={[
                      "px-2 py-0.5 rounded text-[10px] border transition-colors",
                      activeTag === tag
                        ? "bg-violet-600 text-white border-violet-600"
                        : "text-slate-500 border-slate-200 hover:border-violet-400 hover:text-violet-600",
                    ].join(" ")}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* コンテンツ */}
          <div className="flex-1 overflow-auto px-6 py-4">
            {loading && assets.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-36 rounded-lg" />
                ))}
              </div>
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                <FileText className="w-10 h-10" />
                <p className="text-sm">
                  {q || category || activeTag
                    ? "条件に一致するアセットがありません"
                    : "アセットがありません"}
                </p>
                {(q || category || activeTag) && (
                  <Button
                    variant="outline" size="sm"
                    onClick={() => { setQ(""); setCategory(""); setActiveTag(""); }}
                  >
                    フィルターをクリア
                  </Button>
                )}
                {!q && !category && !activeTag && (
                  <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
                    最初のファイルをアップロード
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary" className="text-[10px]">
                    {assets.length}件表示
                  </Badge>
                  {activeTag && (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-violet-600 border-violet-300 bg-violet-50 cursor-pointer"
                      onClick={() => setActiveTag("")}
                    >
                      <Tag className="w-2.5 h-2.5 mr-1" />
                      {activeTag}
                      <X className="w-2.5 h-2.5 ml-1" />
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {assets.map(asset => (
                    <AssetCard
                      key={asset.asset_id}
                      asset={asset}
                      activeTag={activeTag}
                      onTagClick={tag => setActiveTag(activeTag === tag ? "" : tag)}
                      onClick={() => setSelected(asset)}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div className="flex justify-center mt-6">
                    <Button
                      variant="outline" size="sm"
                      onClick={handleLoadMore}
                      disabled={loading}
                    >
                      さらに読み込む
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Dialogs */}
          <AssetUploadDialog
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            defaultAuthor={currentUser}
            onUploaded={handleUploaded}
          />
          <AssetDetailSheet
            asset={selected}
            open={!!selected}
            onOpenChange={v => { if (!v) setSelected(null); }}
            onUpdated={handleAssetUpdated}
          />
        </main>
      </div>
    </div>
  );
}
