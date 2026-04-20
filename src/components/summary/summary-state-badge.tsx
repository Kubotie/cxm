// ─── Summary State Badge — 共通表示コンポーネント ─────────────────────────────
// 3 variant で summary 状態を統一表示する。
//
//   inline       — Company ヘッダー用。バッジ + review status + 日付の1行表示
//   sidebar-meta — サイドバーボタン直下のメタ行
//   sheet-panel  — Sheet header 直下のフルパネル（詳細グリッド付き）
//
// このコンポーネント自身は副作用・fetch なし。props から描画するのみ。

"use client";

import { Lock } from "lucide-react";
import type { CompanySummaryViewModel } from "@/lib/company/company-summary-state-policy";
import { SUMMARY_FRESHNESS_CONFIG } from "@/lib/company/company-summary-state-policy";
import type { AppCompanySummaryState } from "@/lib/nocodb/types";

// ── 型定義 ───────────────────────────────────────────────────────────────────

export interface SummaryStateBadgeProps {
  vm:       CompanySummaryViewModel;
  /** sheet-panel variant で詳細グリッド（ソース更新・確認者等）を表示するために使う */
  record?:  AppCompanySummaryState | null;
  variant?: 'inline' | 'sidebar-meta' | 'sheet-panel';
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

function fmtDate(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' },
): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('ja-JP', opts);
  } catch {
    return iso.slice(0, 16);
  }
}

const SHORT: Intl.DateTimeFormatOptions = { month: 'numeric', day: 'numeric' };
const LONG:  Intl.DateTimeFormatOptions = { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' };

// ── コンポーネント ────────────────────────────────────────────────────────────

/**
 * 3 variant で summary 状態を統一表示する純粋な表示コンポーネント。
 * アクションボタンは含まない。
 */
export function SummaryStateBadge({ vm, record, variant = 'inline' }: SummaryStateBadgeProps) {
  const cfg = SUMMARY_FRESHNESS_CONFIG[vm.freshnessStatus];

  // ── inline variant（Company ヘッダー用） ─────────────────────────────────
  if (variant === 'inline') {
    // missing は表示しない（ヘッダーには「生成済みのときだけ」表示）
    if (!vm.hasSummary) return null;

    return (
      <div className="flex items-center gap-1.5 text-xs">
        {vm.isApproved && <Lock className="w-3 h-3 text-green-600 flex-shrink-0" />}
        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium leading-none ${cfg.badgeClass}`}>
          {cfg.label}
        </span>
        {vm.reviewStatusLabel && (
          <span className={vm.isApproved ? 'text-green-700 font-medium' : 'text-slate-500'}>
            {vm.reviewStatusLabel}
          </span>
        )}
        {vm.lastAiUpdatedAt && (
          <span className="text-slate-400">
            {fmtDate(vm.lastAiUpdatedAt, SHORT)} 更新
          </span>
        )}
      </div>
    );
  }

  // ── sidebar-meta variant（サイドバーボタン直下の補助テキスト行） ───────────
  if (variant === 'sidebar-meta') {
    if (!vm.hasSummary) return null;

    const parts: string[] = [];
    if (vm.reviewStatusLabel) parts.push(vm.reviewStatusLabel);
    const d = fmtDate(vm.lastAiUpdatedAt, SHORT);
    if (d) parts.push(`${d} 更新`);

    if (parts.length === 0) return null;

    return (
      <p className="text-[10px] text-slate-400 pl-1">
        {parts.join(' · ')}
      </p>
    );
  }

  // ── sheet-panel variant（Sheet header 直下のフルパネル） ─────────────────
  if (variant === 'sheet-panel') {
    if (!vm.hasSummary) return null;

    return (
      <div className={`mt-3 border rounded-lg overflow-hidden text-xs ${vm.isApproved ? 'border-green-200' : 'border-slate-200'}`}>
        {/* ヘッダー行：鮮度 + review status + AI 生成日時 */}
        <div className={`px-3 py-2 flex items-center gap-2 flex-wrap ${vm.isApproved ? 'bg-green-50' : 'bg-slate-50'}`}>
          <span className={`px-2 py-0.5 rounded border text-[10px] font-medium ${cfg.badgeClass}`}>
            {cfg.label}
          </span>
          {vm.reviewStatusLabel && (
            <span className={`font-medium ${vm.isApproved ? 'text-green-700' : 'text-slate-600'}`}>
              {vm.reviewStatusLabel}
            </span>
          )}
          {vm.lastAiUpdatedAt && (
            <span className="text-slate-400 ml-auto">
              AI生成: {fmtDate(vm.lastAiUpdatedAt, LONG)}
            </span>
          )}
        </div>

        {/* 詳細グリッド：ソース更新・モデル・バージョン・確認者・確認日時 */}
        <div className="px-3 py-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px] border-t border-slate-100">
          {record?.sourceUpdatedAt && (
            <>
              <span className="text-slate-400">ソース更新</span>
              <span className="text-slate-600">{String(record.sourceUpdatedAt).slice(0, 16)}</span>
            </>
          )}
          {vm.model && (
            <>
              <span className="text-slate-400">モデル</span>
              <span className="text-slate-600">{vm.model}</span>
            </>
          )}
          {vm.aiVersion && (
            <>
              <span className="text-slate-400">AI バージョン</span>
              <span className="text-slate-600">{vm.aiVersion}</span>
            </>
          )}
          {record?.reviewedBy && (
            <>
              <span className="text-slate-400">確認者</span>
              <span className="text-slate-600">{record.reviewedBy}</span>
            </>
          )}
          {record?.reviewedAt && (
            <>
              <span className="text-slate-400">確認日時</span>
              <span className="text-slate-600">{fmtDate(record.reviewedAt, LONG)}</span>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}
