"use client";
import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button }   from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input }    from "@/components/ui/input";
import { Badge }    from "@/components/ui/badge";
import { Loader2, Upload, CheckCircle2, FileText, Sparkles, AlertCircle } from "lucide-react";
import { ASSET_CATEGORIES, type AssetCategory } from "@/lib/prompts/asset-analysis";
import type { CsmAsset } from "@/lib/nocodb/assets";

export interface AssetUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAuthor?: string;
  onUploaded?: (asset: CsmAsset) => void;
}

type Step = "select" | "analyzing" | "review" | "saving" | "done" | "error";

interface AnalysisProposal {
  title: string;
  category: AssetCategory;
  category_reason: string;
  summary: string;
  blob_url: string | null;
  content: string;
}

const CATEGORY_COLORS: Record<AssetCategory, string> = {
  '事例':               'bg-blue-50 text-blue-700 border-blue-300',
  'AI計画':             'bg-violet-50 text-violet-700 border-violet-300',
  'アカウントプランニング': 'bg-amber-50 text-amber-700 border-amber-300',
  'ノウハウ・マニュアル':  'bg-green-50 text-green-700 border-green-300',
  'その他':             'bg-slate-50 text-slate-600 border-slate-300',
};

export function AssetUploadDialog({
  open,
  onOpenChange,
  defaultAuthor = "",
  onUploaded,
}: AssetUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile]         = useState<File | null>(null);
  const [step, setStep]         = useState<Step>("select");
  const [proposal, setProposal] = useState<AnalysisProposal | null>(null);
  const [editTitle, setEditTitle]       = useState("");
  const [editCategory, setEditCategory] = useState<AssetCategory>("その他");
  const [editSummary, setEditSummary]   = useState("");
  const [errorMsg, setErrorMsg]         = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setStep("select");
    setProposal(null);
    setErrorMsg("");
  }

  function reset() {
    setFile(null);
    setStep("select");
    setProposal(null);
    setEditTitle("");
    setEditCategory("その他");
    setEditSummary("");
    setErrorMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  // ステップ1: ファイルをアップロードしてAIに分析させる
  async function handleAnalyze() {
    if (!file) return;
    setStep("analyzing");
    setErrorMsg("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/assets/analyze", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as AnalysisProposal;
      setProposal(data);
      setEditTitle(data.title);
      setEditCategory(data.category);
      setEditSummary(data.summary);
      setStep("review");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStep("error");
    }
  }

  // ステップ2: 確認済みデータをNocoBDBに保存する
  async function handleSave() {
    if (!proposal) return;
    setStep("saving");
    setErrorMsg("");

    try {
      const res = await fetch("/api/assets/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim() || proposal.title,
          category: editCategory,
          category_reason: proposal.category_reason,
          summary: editSummary,
          blob_url: proposal.blob_url,
          content: proposal.content,
          author: defaultAuthor,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { asset: CsmAsset };
      setStep("done");
      onUploaded?.(data.asset);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStep("error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-violet-500" />
            MDファイルをアップロード
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === "review"
              ? "AIの提案を確認・編集して保存してください"
              : "アップロード後、AIがカテゴリ分類とサマリーを提案します"}
          </DialogDescription>
        </DialogHeader>

        {/* 完了画面 */}
        {step === "done" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium text-sm">保存が完了しました</span>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>閉じる</Button>
            </DialogFooter>
          </div>
        )}

        {/* ファイル選択 + 分析中（分析エラー時も表示） */}
        {(step === "select" || step === "analyzing" || (step === "error" && proposal === null)) && (
          <div className="space-y-4 py-2">
            {/* ファイル選択エリア */}
            <div className="space-y-1.5">
              <div
                className="flex items-center gap-3 rounded-md border-2 border-dashed border-slate-200 p-4 cursor-pointer hover:border-slate-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText className="w-8 h-8 text-slate-300 flex-shrink-0" />
                <div className="min-w-0">
                  {file ? (
                    <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                  ) : (
                    <p className="text-sm text-slate-400">クリックしてファイルを選択（.md）</p>
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* 作成者（表示のみ） */}
            {defaultAuthor && (
              <p className="text-xs text-slate-500">
                作成者: <span className="font-medium text-slate-700">{defaultAuthor}</span>
              </p>
            )}

            {/* 分析中インジケーター */}
            {step === "analyzing" && (
              <div className="flex items-center gap-2 rounded-md bg-violet-50 border border-violet-100 p-3 text-sm text-violet-700">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  AIが分析中...（カテゴリ分類・サマリー生成）
                </span>
              </div>
            )}

            {/* エラー */}
            {step === "error" && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>キャンセル</Button>
              <Button
                onClick={handleAnalyze}
                disabled={!file || step === "analyzing"}
              >
                {step === "analyzing"
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />分析中...</>
                  : <><Sparkles className="w-4 h-4 mr-1.5" />AIで分析する</>
                }
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* AI提案レビュー画面（保存エラー時も表示） */}
        {(step === "review" || step === "saving" || (step === "error" && proposal !== null)) && proposal && (
          <div className="space-y-4 py-2">
            {/* AIバッジ */}
            <div className="flex items-center gap-1.5 text-xs text-violet-600">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AIが以下の内容を提案しています。編集して保存できます。</span>
            </div>

            {/* タイトル */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">タイトル</label>
              <Input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="text-sm"
                disabled={step === "saving"}
              />
            </div>

            {/* カテゴリ選択 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">カテゴリ</label>
              <div className="flex flex-wrap gap-1.5">
                {ASSET_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    disabled={step === "saving"}
                    onClick={() => setEditCategory(cat)}
                    className={[
                      "px-2.5 py-1 rounded-full text-xs border transition-colors",
                      editCategory === cat
                        ? CATEGORY_COLORS[cat]
                        : "text-slate-400 border-slate-200 hover:border-slate-400",
                    ].join(" ")}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {/* AI分類根拠 */}
              {proposal.category_reason && (
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  AI判断: {proposal.category_reason}
                </p>
              )}
            </div>

            {/* サマリー */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">
                サマリー
                <span className="ml-1.5 text-[10px] font-normal text-slate-400">（検索・AI参照に使用）</span>
              </label>
              <Textarea
                value={editSummary}
                onChange={e => setEditSummary(e.target.value)}
                rows={3}
                className="text-xs resize-none"
                placeholder="検索・AI参照に使われるサマリー"
                disabled={step === "saving"}
              />
            </div>

            {/* 作成者（表示のみ） */}
            {defaultAuthor && (
              <p className="text-xs text-slate-500">
                作成者: <span className="font-medium text-slate-700">{defaultAuthor}</span>
              </p>
            )}

            {/* エラー */}
            {step === "error" && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep("select")}
                disabled={step === "saving"}
              >
                やり直す
              </Button>
              <Button
                onClick={handleSave}
                disabled={!editTitle.trim() || step === "saving"}
              >
                {step === "saving"
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" />保存中...</>
                  : "保存する"
                }
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
