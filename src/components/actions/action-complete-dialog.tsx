"use client";

// ─── アクション完了確認ダイアログ ─────────────────────────────────────────────
//
// 「実施済み」クリック時に開く2択ダイアログ。
//   - そのまま完了（レビューなし）
//   - レビューを記録して完了（AIがチームナレッジに整理）
//
// SF-only（_source=sf）の場合は「そのまま完了」のみ表示。

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button }   from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, Check, ChevronLeft, Loader2, CheckCircle2, BookOpen, ChevronRight,
} from "lucide-react";
import type { ActionListItem } from "@/app/api/actions/route";

// ── 型 ───────────────────────────────────────────────────────────────────────

export interface ActionCompleteDialogProps {
  action:                  ActionListItem | null;
  open:                    boolean;
  onOpenChange:            (open: boolean) => void;
  /** レビューなし完了 — 親が patchStatus/markSfDone を実行する */
  onCompleteWithoutReview: (action: ActionListItem) => void;
  /** レビューあり完了 — review API は Dialog 内で完結、親は patchStatus('done') を呼ぶ */
  onCompleteWithReview:    (action: ActionListItem) => void;
}

type DialogStep = 'choice' | 'review_input' | 'reviewing' | 'review_done';

// ── Component ─────────────────────────────────────────────────────────────────

export function ActionCompleteDialog({
  action,
  open,
  onOpenChange,
  onCompleteWithoutReview,
  onCompleteWithReview,
}: ActionCompleteDialogProps) {
  const [step,        setStep]        = useState<DialogStep>('choice');
  const [reviewText,  setReviewText]  = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);

  const isSfOnly = action?._source === 'sf';

  // ダイアログが開くたびにステートをリセット
  useEffect(() => {
    if (open) {
      setStep('choice');
      setReviewText('');
      setReviewError(null);
    }
  }, [open]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && step === 'reviewing') return; // AI処理中は閉じさせない
    if (!nextOpen) {
      setTimeout(() => {
        setStep('choice');
        setReviewText('');
        setReviewError(null);
      }, 200);
    }
    onOpenChange(nextOpen);
  }

  function handleCompleteWithoutReview() {
    if (!action) return;
    onCompleteWithoutReview(action);
    onOpenChange(false);
  }

  async function handleCompleteWithReview() {
    if (!action || !reviewText.trim()) return;
    setStep('reviewing');
    setReviewError(null);
    try {
      const res = await fetch(`/api/actions/${action.id}/review`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_text:   reviewText.trim(),
          action_title:  action.title,
          company_name:  action.companyName ?? undefined,
          original_plan: action.body ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onCompleteWithReview(action);  // 親が patchStatus('done') を呼ぶ
      setStep('review_done');
      setTimeout(() => onOpenChange(false), 2500);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'レビューの保存に失敗しました');
      setStep('review_input');  // テキストを保持してエラー表示
    }
  }

  if (!action) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[460px]">

        {/* ── ヘッダー ──────────────────────────────────────────── */}
        {step !== 'review_done' && (
          <DialogHeader>
            <DialogTitle className="text-base">アクションを完了する</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 line-clamp-2">
              <span className="font-medium text-slate-700">{action.title}</span>
              {action.companyName && (
                <span className="text-slate-400"> — {action.companyName}</span>
              )}
            </DialogDescription>
          </DialogHeader>
        )}

        {/* ── step: choice ─────────────────────────────────────── */}
        {step === 'choice' && (
          <div className="space-y-2.5 pt-1">

            {/* レビューありで完了（CXM/both のみ） */}
            {!isSfOnly && (
              <button
                onClick={() => setStep('review_input')}
                className={[
                  'w-full text-left rounded-lg border-2 p-4 transition-all group',
                  'border-violet-200 bg-violet-50 hover:border-violet-400 hover:bg-violet-100',
                ].join(' ')}
              >
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-violet-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-violet-900">
                      レビューを記録して完了
                    </p>
                    <p className="text-xs text-violet-600 mt-0.5">
                      AIがチームナレッジに整理・保存します
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-violet-500">
                      <BookOpen className="w-3 h-3" />
                      <span>アセットライブラリでチーム全員が参照可能</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-violet-400 self-center flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            )}

            {/* そのまま完了 */}
            <button
              onClick={handleCompleteWithoutReview}
              className={[
                'w-full text-left rounded-lg border p-4 transition-all',
                'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
              ].join(' ')}
            >
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    そのまま完了
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    記録なしで即座にステータスを完了に変更します
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* ── step: review_input ───────────────────────────────── */}
        {step === 'review_input' && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep('choice')}
                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <p className="text-xs font-medium text-slate-700">実施レビューを入力</p>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              何がうまくいったか、何を学んだか、次回への改善点などを記録してください。
              AIが要約してチームのアセットライブラリに保存します。
            </p>
            <Textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              placeholder={`例: 顧客の懸念点だった○○を事前に資料で補足したところ、スムーズに合意を得られた。次回は□□も準備しておくと良さそう。`}
              className="text-sm min-h-[120px] resize-none"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
            {reviewError && (
              <p className="text-xs text-red-600">{reviewError}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep('choice')}
              >
                戻る
              </Button>
              <Button
                size="sm"
                className="bg-violet-600 hover:bg-violet-700 text-white"
                onClick={handleCompleteWithReview}
                disabled={!reviewText.trim()}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                AI要約して完了
              </Button>
            </div>
          </div>
        )}

        {/* ── step: reviewing ──────────────────────────────────── */}
        {step === 'reviewing' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">AIが整理中...</p>
              <p className="text-xs text-slate-400 mt-1">
                レビュー内容をチームナレッジに変換しています
              </p>
            </div>
          </div>
        )}

        {/* ── step: review_done ────────────────────────────────── */}
        {step === 'review_done' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">アクションを完了しました</p>
              <p className="text-xs text-slate-500 mt-1">レビューがチームアセットに保存されました</p>
            </div>
            <Link
              href="/assets?source_type=review"
              className="text-xs text-violet-600 hover:underline flex items-center gap-1 mt-1"
              onClick={() => onOpenChange(false)}
            >
              <BookOpen className="w-3.5 h-3.5" />
              アセットライブラリで確認
            </Link>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
