"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import { Textarea }  from "@/components/ui/textarea";
import { Badge }     from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2, Download, Sparkles, FileText, CheckCircle2,
  ChevronRight, Plus, Search, X,
  Clock, FilePlus, HelpCircle, Presentation, FileCode2,
  Trash2, Eye, Code2,
} from "lucide-react";
import { SidebarNav }   from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { toast } from "sonner";
import type { CsmAsset } from "@/lib/nocodb/assets";
import type { CsmDocument } from "@/lib/nocodb/documents";
import type { DeckTemplate } from "@/lib/deck-templates/types";

type OutputType = "pptx" | "md" | "docs";
type Step = 1 | 2 | 3;
type PageTab = "new" | "history";

const OUTPUT_TYPES: {
  type: OutputType;
  label: string;
  ext: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    type: "pptx",
    label: "PowerPoint",
    ext: ".pptx",
    desc: "デッキスキルを使ったブランド準拠のスライド資料",
    icon: <Presentation className="w-6 h-6" />,
    color: "text-orange-500",
  },
  {
    type: "docs",
    label: "Word",
    ext: ".docx",
    desc: "見出し・箇条書き・表を含むWord文書",
    icon: <FileText className="w-6 h-6" />,
    color: "text-blue-500",
  },
  {
    type: "md",
    label: "Markdown",
    ext: ".md",
    desc: "そのまま使えるMarkdown形式のドキュメント",
    icon: <FileCode2 className="w-6 h-6" />,
    color: "text-slate-600",
  },
];

const ASSET_CATEGORY_COLORS: Record<string, string> = {
  "事例":               "text-blue-700 border-blue-300",
  "AI計画":             "text-violet-700 border-violet-300",
  "アカウントプランニング": "text-amber-700 border-amber-300",
  "ノウハウ・マニュアル":  "text-green-700 border-green-300",
};

const CATEGORY_FILTER_OPTIONS = [
  { value: "", label: "すべて" },
  { value: "事例", label: "事例" },
  { value: "AI計画", label: "AI計画" },
  { value: "アカウントプランニング", label: "AP" },
  { value: "ノウハウ・マニュアル", label: "ノウハウ" },
];

const STEP_LABELS = (outputType: OutputType) => [
  "出力形式",
  outputType === "pptx" ? "スキル・アセット" : "アセット確認",
  "プレビュー",
];

const DOC_TYPE_ICON: Record<string, React.ReactNode> = {
  pptx: <Presentation className="w-4 h-4 text-orange-500" />,
  docs: <FileText className="w-4 h-4 text-blue-500" />,
  md:   <FileCode2 className="w-4 h-4 text-slate-500" />,
};

export function DocumentsPage() {
  const [pageTab, setPageTab]         = useState<PageTab>("new");
  const [step, setStep]               = useState<Step>(1);
  const [outputType, setOutputType]   = useState<OutputType>("pptx");
  const [deckTemplate, setDeckTemplate] = useState<DeckTemplate | null>(null);
  const [templates, setTemplates]     = useState<DeckTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [userInstruction, setUserInstruction] = useState("");

  // アセット選択
  const [assets, setAssets]           = useState<CsmAsset[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetCategoryFilter, setAssetCategoryFilter] = useState("");

  // 生成結果
  const [generating, setGenerating]   = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [thinkingText, setThinkingText]   = useState("");
  const [reviewScore, setReviewScore]     = useState<number | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [docTitle, setDocTitle]       = useState("");
  const [slideCount, setSlideCount]   = useState<number | undefined>();
  const [mdContent, setMdContent]     = useState<string | null>(null);
  const [mdViewMode, setMdViewMode]   = useState<"rendered" | "raw">("rendered");

  // スキルアップロード
  const [uploading, setUploading]     = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  // 履歴
  const [documents, setDocuments]     = useState<CsmDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  // テンプレート一覧
  function loadTemplates() {
    setLoadingTemplates(true);
    fetch("/api/deck-templates")
      .then(r => r.ok ? r.json() : { templates: [] })
      .then((d: { templates: DeckTemplate[] }) => setTemplates(d.templates ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false));
  }
  useEffect(() => { loadTemplates(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // テンプレート削除
  async function handleDeleteTemplate(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("このスキルを削除しますか？")) return;
    setDeletingTemplateId(id);
    try {
      const res = await fetch(`/api/deck-templates?id=${id}`, { method: "DELETE" });
      const data = await res.json() as { error?: string };
      if (!res.ok) { toast.error(data.error ?? "削除に失敗しました"); return; }
      toast.success("スキルを削除しました");
      if (deckTemplate?.id === id) setDeckTemplate(null);
      loadTemplates();
    } catch { toast.error("削除に失敗しました"); }
    finally { setDeletingTemplateId(null); }
  }

  // 履歴ロード
  useEffect(() => {
    if (pageTab !== "history") return;
    setLoadingDocs(true);
    fetch("/api/documents")
      .then(r => r.ok ? r.json() : { documents: [] })
      .then((d: { documents: CsmDocument[] }) => setDocuments(d.documents ?? []))
      .catch(() => setDocuments([]))
      .finally(() => setLoadingDocs(false));
  }, [pageTab]);

  // Step 2: アセット一覧ロード
  useEffect(() => {
    if (step !== 2) return;
    setLoadingAssets(true);
    setSelectedIds([]);
    setAssetSearch("");
    setAssetCategoryFilter("");
    fetch("/api/assets?limit=100&sort_by=reference_count")
      .then(r => r.ok ? r.json() : { assets: [] })
      .then((d: { assets: CsmAsset[] }) => setAssets(d.assets ?? []))
      .catch(() => setAssets([]))
      .finally(() => setLoadingAssets(false));
  }, [step]);

  const filteredAssets = useMemo(() => {
    let list = assets;
    if (assetCategoryFilter) list = list.filter(a => a.category === assetCategoryFilter);
    if (assetSearch.trim()) {
      const q = assetSearch.trim().toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.summary ?? "").toLowerCase().includes(q) ||
        (a.tags ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [assets, assetSearch, assetCategoryFilter]);

  function toggleAsset(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function canProceedToStep2() {
    if (outputType === "pptx") return !!deckTemplate;
    return true;
  }

  async function handleGenerate() {
    setGenerating(true);
    setDownloadUrl(null);
    setMdContent(null);
    setThinkingText("");
    setStatusMessage("");
    setReviewScore(null);

    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          output_type:       outputType,
          deck_template_id:  outputType === "pptx" ? deckTemplate?.id : undefined,
          asset_ids:         selectedIds.length > 0 ? selectedIds : undefined,
          company_name:      companyName.trim() || undefined,
          user_instruction:  userInstruction.trim() || undefined,
          auto_recommend:    selectedIds.length === 0,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const event = JSON.parse(jsonStr) as {
              type: string;
              message?: string;
              delta?: string;
              document_id?: string;
              title?: string;
              download_url?: string | null;
              md_content?: string;
              slide_count?: number;
              score?: number;
              issue_count?: number;
            };
            if (event.type === "status") {
              setStatusMessage(event.message ?? "");
            } else if (event.type === "thinking") {
              setThinkingText(prev => prev + (event.delta ?? ""));
            } else if (event.type === "review") {
              setReviewScore(event.score ?? null);
            } else if (event.type === "done") {
              setDownloadUrl(event.download_url ?? null);
              setDocTitle(event.title ?? "");
              setSlideCount(event.slide_count);
              setMdContent(event.md_content ?? null);
              setMdViewMode("rendered");
              setStep(3);
            } else if (event.type === "error") {
              toast.error(event.message ?? "生成に失敗しました");
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setGenerating(false);
      setStatusMessage("");
    }
  }

  function downloadSampleTemplate() {
    const sample = {
      id: "my-brand-deck",
      name: "My Brand デック",
      description: "自社ブランドのデッキテンプレート",
      brand_tokens: {
        colors: { primary: "101C1F", accent: "C8F050", bg: "FFFFFF", text_on_dark: "FFFFFF", text_body: "101C1F", text_muted: "5A6568" },
        fonts: { primary: "Noto Sans JP", secondary: "Open Sans" },
      },
      prompt_guidance: "## スライド構成ガイド\n- 表紙\n- アジェンダ\n- 本編\n- まとめ",
    };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "deck-template-sample.json"; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleUploadTemplate(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isJson = file.name.endsWith(".json");
    const isZip  = file.name.endsWith(".zip");
    if (!isJson && !isZip) {
      toast.error(".json または .zip ファイルをアップロードしてください");
      if (uploadRef.current) uploadRef.current.value = "";
      return;
    }
    if (isJson) {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as Record<string, unknown>;
        const isClaudeSkill = !!parsed.files && !parsed.brand_tokens;
        const isDeckTemplate = !!parsed.id && !!parsed.name && !!parsed.brand_tokens;
        if (!isClaudeSkill && !isDeckTemplate) {
          toast.error("対応していない形式です。DeckTemplate JSON または Claude スキルエクスポートをアップロードしてください", { duration: 8000 });
          if (uploadRef.current) uploadRef.current.value = "";
          return;
        }
      } catch {
        toast.error("JSONのパースに失敗しました");
        if (uploadRef.current) uploadRef.current.value = "";
        return;
      }
    }
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/deck-templates", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { template: DeckTemplate };
      setTemplates(prev => [...prev, data.template]);
      toast.success(`「${data.template.name}」を追加しました`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  async function handleDelete(doc: CsmDocument) {
    if (!confirm(`「${doc.title}」を削除しますか？`)) return;
    setDeletingId(doc.document_id);
    try {
      const res = await fetch(`/api/documents/${doc.document_id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDocuments(prev => prev.filter(d => d.document_id !== doc.document_id));
      toast.success("削除しました");
    } catch { toast.error("削除に失敗しました"); }
    finally { setDeletingId(null); }
  }

  function reset() {
    setStep(1);
    setOutputType("pptx");
    setDeckTemplate(null);
    setCompanyName("");
    setUserInstruction("");
    setAssets([]);
    setSelectedIds([]);
    setAssetSearch("");
    setAssetCategoryFilter("");
    setDownloadUrl(null);
    setDocTitle("");
    setSlideCount(undefined);
    setMdContent(null);
    setThinkingText("");
    setStatusMessage("");
    setReviewScore(null);
  }

  const stepLabels = STEP_LABELS(outputType);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <SidebarNav />
      <div className="flex flex-col flex-1 overflow-hidden">
        <GlobalHeader />
        <main className="flex flex-col flex-1 overflow-hidden">

          {/* ヘッダー */}
          <div className="px-6 py-4 border-b border-slate-100 flex-shrink-0">
            <h1 className="text-lg font-semibold text-slate-900">資料作成</h1>
            <p className="text-xs text-slate-500 mt-0.5">出力形式を選んでAIが資料を自動生成します</p>
          </div>

          {/* タブ */}
          <div className="flex gap-0 px-6 border-b border-slate-100 flex-shrink-0">
            {([
              { key: "new",     label: "新規作成", Icon: FilePlus },
              { key: "history", label: "作成履歴", Icon: Clock },
            ] as const).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPageTab(key)}
                className={[
                  "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors",
                  pageTab === key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {key === "history" && documents.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1">{documents.length}</Badge>
                )}
              </button>
            ))}
          </div>

          {/* ─────────── 新規作成タブ ─────────── */}
          {pageTab === "new" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* ステップインジケーター */}
              <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 flex-shrink-0">
                {([1, 2, 3] as Step[]).map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={[
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                      step === s   ? "bg-slate-900 text-white"
                        : step > s ? "bg-green-500 text-white"
                        : "bg-slate-100 text-slate-400",
                    ].join(" ")}>
                      {step > s ? "✓" : s}
                    </div>
                    <span className={["text-xs", step >= s ? "text-slate-700 font-medium" : "text-slate-400"].join(" ")}>
                      {stepLabels[s - 1]}
                    </span>
                    {i < 2 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                  </div>
                ))}
              </div>

              <div className="flex-1 overflow-auto px-6 py-6">

                {/* ─── Step 1: 出力形式選択 ─── */}
                {step === 1 && (
                  <div className="space-y-6 max-w-2xl">

                    {/* 出力形式 */}
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-slate-700">出力形式を選択</p>
                      <div className="grid grid-cols-3 gap-3">
                        {OUTPUT_TYPES.map(ot => (
                          <button
                            key={ot.type}
                            type="button"
                            onClick={() => { setOutputType(ot.type); if (ot.type !== "pptx") setDeckTemplate(null); }}
                            className={[
                              "rounded-lg border-2 p-4 text-left transition-all",
                              outputType === ot.type
                                ? "border-slate-800 bg-slate-900 text-white"
                                : "border-slate-200 hover:border-slate-400 bg-white",
                            ].join(" ")}
                          >
                            <div className={outputType === ot.type ? "text-white" : ot.color}>
                              {ot.icon}
                            </div>
                            <p className={`font-semibold text-sm mt-2 ${outputType === ot.type ? "text-white" : "text-slate-800"}`}>
                              {ot.label}
                            </p>
                            <p className={`text-[10px] mt-0.5 ${outputType === ot.type ? "text-slate-300" : "text-slate-500"}`}>
                              {ot.ext}
                            </p>
                            <p className={`text-[10px] mt-1.5 leading-relaxed ${outputType === ot.type ? "text-slate-400" : "text-slate-400"}`}>
                              {ot.desc}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* pptx のみ: デッキスキル選択 */}
                    {outputType === "pptx" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-700">デッキスキルを選択</p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={downloadSampleTemplate}
                              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                              title="サンプルJSONをダウンロード"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                              サンプル
                            </button>
                            <button
                              type="button"
                              onClick={() => uploadRef.current?.click()}
                              disabled={uploading}
                              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-dashed border-slate-300 rounded-md px-2.5 py-1.5 hover:border-slate-500 transition-colors"
                            >
                              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                              スキルを追加 (.json / .zip)
                            </button>
                          </div>
                          <input ref={uploadRef} type="file" accept=".json,.zip" className="hidden" onChange={handleUploadTemplate} />
                        </div>

                        {loadingTemplates ? (
                          <div className="grid grid-cols-2 gap-3">
                            {[0, 1].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            {templates.map(t => (
                              <div key={t.id} className="relative group">
                                <button
                                  type="button"
                                  onClick={() => setDeckTemplate(t)}
                                  className={[
                                    "w-full rounded-lg border-2 p-4 text-left transition-all",
                                    deckTemplate?.id === t.id
                                      ? "border-slate-800 bg-slate-900 text-white"
                                      : "border-slate-200 hover:border-slate-400 bg-white",
                                  ].join(" ")}
                                >
                                  <div className="flex gap-1 mb-3">
                                    {(["primary", "accent", "bg"] as const).map(k => (
                                      <span key={k} className="w-4 h-4 rounded-full border border-black/10"
                                        style={{ backgroundColor: `#${t.brand_tokens.colors[k]}` }} />
                                    ))}
                                  </div>
                                  <p className={`font-semibold text-sm ${deckTemplate?.id === t.id ? "text-white" : "text-slate-800"}`}>{t.name}</p>
                                  <p className={`text-xs mt-1 line-clamp-2 ${deckTemplate?.id === t.id ? "text-slate-300" : "text-slate-500"}`}>{t.description}</p>
                                  {t.is_builtin && (
                                    <Badge variant="outline" className={`text-[9px] mt-2 ${deckTemplate?.id === t.id ? "border-slate-500 text-slate-300" : "border-slate-300 text-slate-400"}`}>内蔵</Badge>
                                  )}
                                </button>
                                {!t.is_builtin && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteTemplate(e, t.id)}
                                    disabled={deletingTemplateId === t.id}
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-200 rounded-full w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-300 shadow-sm"
                                    title="削除"
                                  >
                                    {deletingTemplateId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 会社名 */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">対象会社名（任意）</label>
                      <Input
                        value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                        placeholder="例: 〇〇株式会社"
                        className="text-sm max-w-xs"
                      />
                    </div>

                    <Button onClick={() => setStep(2)} disabled={!canProceedToStep2()}>
                      次へ: アセット確認
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                )}

                {/* ─── Step 2: アセット確認 ─── */}
                {step === 2 && (
                  <div className="space-y-4 max-w-2xl">
                    {/* 選択中バッジ */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {(() => {
                        const ot = OUTPUT_TYPES.find(o => o.type === outputType);
                        return (
                          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700">
                            <span className={ot?.color}>{ot?.icon}</span>
                            {ot?.label}
                          </div>
                        );
                      })()}
                      {outputType === "pptx" && deckTemplate && (
                        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700">
                          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: `#${deckTemplate.brand_tokens.colors.accent}` }} />
                          {deckTemplate.name}
                        </div>
                      )}
                      {companyName && <Badge variant="secondary" className="text-xs">{companyName}</Badge>}
                    </div>

                    {/* 目的・指示 */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">
                        どんな資料を作りますか？
                        <span className="text-slate-400 font-normal ml-1">（任意）</span>
                      </label>
                      <Textarea
                        value={userInstruction}
                        onChange={e => setUserInstruction(e.target.value)}
                        placeholder="例：先月のKPI達成状況と来月の施策を報告する月次CSレポート。聴衆は社内マネージャー向け。"
                        rows={3}
                        className="text-xs resize-none leading-relaxed"
                      />
                    </div>

                    {/* アセット選択 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-700">
                          参照するアセットを選択
                          <span className="text-slate-400 font-normal ml-1 text-xs">（未選択の場合はAIが自動推薦）</span>
                        </p>
                        {selectedIds.length > 0 && (
                          <button type="button" onClick={() => setSelectedIds([])} className="text-xs text-slate-400 hover:text-slate-600">
                            選択解除 ({selectedIds.length})
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                          value={assetSearch}
                          onChange={e => setAssetSearch(e.target.value)}
                          placeholder="タイトル・サマリー・タグで絞り込み..."
                          className="pl-8 text-xs h-8"
                        />
                        {assetSearch && (
                          <button type="button" onClick={() => setAssetSearch("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {CATEGORY_FILTER_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setAssetCategoryFilter(opt.value)}
                            className={[
                              "px-2.5 py-0.5 rounded-full text-[11px] border transition-colors",
                              assetCategoryFilter === opt.value
                                ? "bg-slate-800 text-white border-slate-800"
                                : "text-slate-500 border-slate-200 hover:border-slate-400",
                            ].join(" ")}
                          >
                            {opt.label}
                          </button>
                        ))}
                        {(assetSearch || assetCategoryFilter) && (
                          <span className="text-[10px] text-slate-400 ml-1">{filteredAssets.length}/{assets.length}件</span>
                        )}
                      </div>
                    </div>

                    {/* アセットリスト */}
                    {loadingAssets ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                        <Loader2 className="w-4 h-4 animate-spin" />アセットを読み込み中...
                      </div>
                    ) : filteredAssets.length === 0 ? (
                      <div className="rounded-md border border-dashed border-slate-200 p-6 text-center">
                        <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">
                          {assetSearch || assetCategoryFilter ? "条件に一致するアセットがありません" : "アセットがありません"}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">AIがスキルのみで生成します</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[380px] overflow-auto pr-1">
                        {filteredAssets.map(a => {
                          const isSelected = selectedIds.includes(a.asset_id);
                          const tagList = a.tags ? a.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
                          return (
                            <button
                              key={a.asset_id}
                              type="button"
                              onClick={() => toggleAsset(a.asset_id)}
                              className={[
                                "w-full text-left rounded-lg border p-3 transition-all",
                                isSelected ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:border-slate-300 bg-white",
                              ].join(" ")}
                            >
                              <div className="flex items-start gap-2">
                                <div className={["w-4 h-4 mt-0.5 rounded border-2 flex-shrink-0 flex items-center justify-center", isSelected ? "border-violet-500 bg-violet-500" : "border-slate-300"].join(" ")}>
                                  {isSelected && <span className="text-white text-[8px] font-bold">✓</span>}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start gap-2">
                                    <p className="text-xs font-medium text-slate-800 flex-1 line-clamp-1">{a.title}</p>
                                    {a.category && (
                                      <Badge variant="outline" className={`text-[9px] flex-shrink-0 ${ASSET_CATEGORY_COLORS[a.category] ?? "text-slate-500 border-slate-300"}`}>
                                        {a.category}
                                      </Badge>
                                    )}
                                  </div>
                                  {a.summary && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{a.summary}</p>}
                                  {(tagList.length > 0 || a.reference_count > 0) && (
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      {tagList.slice(0, 3).map(tag => (
                                        <span key={tag} className="text-[9px] text-slate-400 bg-slate-100 rounded px-1 py-0.5">{tag}</span>
                                      ))}
                                      {a.reference_count > 0 && <span className="text-[9px] text-violet-500 ml-auto">参照{a.reference_count}回</span>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" onClick={() => setStep(1)} disabled={generating}>戻る</Button>
                      <Button onClick={handleGenerate} disabled={generating}>
                        {generating
                          ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /><Sparkles className="w-3.5 h-3.5 mr-1" />AI生成中...</>
                          : <><Sparkles className="w-4 h-4 mr-1.5" />資料を生成する{selectedIds.length > 0 && ` (${selectedIds.length}件参照)`}</>
                        }
                      </Button>
                    </div>

                    {/* 思考過程ライブ表示 */}
                    {generating && (
                      <div className="rounded-lg border border-violet-100 bg-violet-50/60 p-4 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 animate-pulse text-violet-500" />
                          <span className="text-sm font-medium text-violet-700 flex-1">
                            {statusMessage || "AI が考えています..."}
                          </span>
                          {reviewScore !== null && (
                            <span className={[
                              "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                              reviewScore >= 7
                                ? "text-green-700 border-green-300 bg-green-50"
                                : "text-amber-700 border-amber-300 bg-amber-50",
                            ].join(" ")}>
                              品質スコア {reviewScore}/10
                            </span>
                          )}
                        </div>
                        {thinkingText && (
                          <div className="rounded-md bg-white border border-violet-100 p-3 max-h-56 overflow-auto">
                            <p className="text-[9px] text-violet-400 mb-1.5 font-semibold uppercase tracking-wider">思考過程</p>
                            <p className="text-[11px] text-slate-500 leading-relaxed whitespace-pre-wrap font-mono">{thinkingText}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Step 3: プレビュー・ダウンロード ─── */}
                {step === 3 && (
                  <div className="space-y-5 max-w-3xl">
                    <div className="flex items-center gap-3 text-green-600">
                      <CheckCircle2 className="w-7 h-7 flex-shrink-0" />
                      <div>
                        <p className="font-semibold">資料が生成されました</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {outputType === "pptx" && slideCount != null ? `${slideCount}枚のスライド` : OUTPUT_TYPES.find(o => o.type === outputType)?.label}
                        </p>
                      </div>
                    </div>

                    {/* タイトル */}
                    {docTitle && (
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs text-slate-400 mb-0.5">タイトル</p>
                        <p className="font-medium text-slate-800">{docTitle}</p>
                      </div>
                    )}

                    {/* MD プレビュー */}
                    {outputType === "md" && mdContent && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-slate-600">プレビュー</p>
                          <div className="flex items-center gap-1 rounded-md border border-slate-200 p-0.5 bg-white">
                            <button
                              type="button"
                              onClick={() => setMdViewMode("rendered")}
                              className={[
                                "flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors",
                                mdViewMode === "rendered" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700",
                              ].join(" ")}
                            >
                              <Eye className="w-3 h-3" />
                              レンダリング
                            </button>
                            <button
                              type="button"
                              onClick={() => setMdViewMode("raw")}
                              className={[
                                "flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors",
                                mdViewMode === "raw" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700",
                              ].join(" ")}
                            >
                              <Code2 className="w-3 h-3" />
                              ソース
                            </button>
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white overflow-auto max-h-[480px]">
                          {mdViewMode === "rendered" ? (
                            <div className="prose prose-sm prose-slate max-w-none p-5">
                              <ReactMarkdown>{`# ${docTitle}\n\n${mdContent}`}</ReactMarkdown>
                            </div>
                          ) : (
                            <pre className="p-5 text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">
                              {`# ${docTitle}\n\n${mdContent}`}
                            </pre>
                          )}
                        </div>
                      </div>
                    )}

                    {/* docs プレビュー（概要のみ） */}
                    {outputType === "docs" && mdContent && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-slate-600">内容プレビュー</p>
                        <div className="rounded-lg border border-slate-200 bg-white overflow-auto max-h-[480px]">
                          <div className="prose prose-sm prose-slate max-w-none p-5">
                            <ReactMarkdown>{`# ${docTitle}\n\n${mdContent}`}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* pptx プレビュー（スライド数のみ、iframeは非対応） */}
                    {outputType === "pptx" && (
                      <div className="rounded-lg border border-slate-200 bg-white p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-md bg-orange-50 border border-orange-200 flex items-center justify-center flex-shrink-0">
                          <Presentation className="w-6 h-6 text-orange-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{docTitle}.pptx</p>
                          {slideCount != null && <p className="text-xs text-slate-500 mt-0.5">{slideCount} スライド</p>}
                          <p className="text-[10px] text-slate-400 mt-0.5">ダウンロードしてPowerPointで開いてください</p>
                        </div>
                      </div>
                    )}

                    {/* ダウンロード */}
                    {downloadUrl ? (
                      <Button asChild size="default" className="w-full sm:w-auto">
                        <a href={downloadUrl} download>
                          <Download className="w-4 h-4 mr-2" />
                          {OUTPUT_TYPES.find(o => o.type === outputType)?.label}をダウンロード
                          <span className="ml-1 text-xs opacity-70">{OUTPUT_TYPES.find(o => o.type === outputType)?.ext}</span>
                        </a>
                      </Button>
                    ) : (
                      <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                        Vercel Blob が未設定のためダウンロードURLが生成されませんでした。
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={reset} className="flex-1">
                        新しい資料を作成
                      </Button>
                      <Button variant="outline" onClick={() => { reset(); setPageTab("history"); }} className="flex-1">
                        <Clock className="w-4 h-4 mr-1.5" />
                        履歴を見る
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────── 作成履歴タブ ─────────── */}
          {pageTab === "history" && (
            <div className="flex-1 overflow-auto px-6 py-6">
              {loadingDocs ? (
                <div className="space-y-3 max-w-2xl">
                  {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                  <Clock className="w-10 h-10" />
                  <p className="text-sm">作成履歴がありません</p>
                  <Button variant="outline" size="sm" onClick={() => setPageTab("new")}>
                    <FilePlus className="w-4 h-4 mr-1.5" />
                    資料を作成する
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-w-2xl">
                  <p className="text-xs text-slate-500 mb-3">{documents.length}件の資料</p>
                  {documents.map(doc => {
                    const createdAt = doc.created_at
                      ? new Date(doc.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : null;
                    const refCount = (() => {
                      try { return (JSON.parse(doc.referenced_asset_ids ?? "[]") as string[]).length; }
                      catch { return 0; }
                    })();
                    const dtype = (doc.document_type ?? "pptx") as string;

                    return (
                      <div
                        key={doc.document_id}
                        className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3.5 hover:border-slate-300 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                          {DOC_TYPE_ICON[dtype] ?? <FileText className="w-4 h-4 text-slate-400" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 line-clamp-1">{doc.title}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-[9px] text-slate-500 border-slate-200 uppercase">
                              {dtype}
                            </Badge>
                            {refCount > 0 && <span className="text-[10px] text-slate-400">{refCount}件のアセットを参照</span>}
                            {createdAt && <span className="text-[10px] text-slate-400">{createdAt}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {doc.blob_url ? (
                            <Button asChild variant="outline" size="sm" className="h-7 text-xs px-2.5">
                              <a href={doc.blob_url} download>
                                <Download className="w-3.5 h-3.5 mr-1" />DL
                              </a>
                            </Button>
                          ) : (
                            <span className="text-[10px] text-slate-300 px-1">URL なし</span>
                          )}
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
                            onClick={() => handleDelete(doc)}
                            disabled={deletingId === doc.document_id}
                          >
                            {deletingId === doc.document_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
