"use client";

// ─── Company Summary 運用画面 ────────────────────────────────────────────────
// GET /api/company-summary-list を使って summary 状態を一覧表示し、
// batch regenerate / batch review への導線を提供する内部運用ツール。
//
// ── 使用 API ──────────────────────────────────────────────────────────────────
//   GET  /api/company-summary-list         — 一覧取得（フィルタ・ソート）
//   POST /api/batch/company-summary        — 一括再生成（dry_run 確認後に実行）
//   POST /api/batch/company-summary-review — 一括レビュー済み更新
//
// ── 認証 ──────────────────────────────────────────────────────────────────────
//   NEXT_PUBLIC_SUPPORT_BATCH_SECRET を設定した場合、Bearer として送信する。
//   未設定の場合は Authorization ヘッダーなし（SUPPORT_BATCH_SECRET 未設定時は API 側がスキップ）。

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw, CheckSquare, AlertTriangle, Lock,
  FileQuestion, Clock, Check, X, Loader2, ChevronDown, ChevronUp,
  Copy, ExternalLink, History, Database,
} from "lucide-react";
import type { CompanySummaryListItemViewModel } from "@/lib/company/company-summary-state-policy";

// ── 型 ───────────────────────────────────────────────────────────────────────

interface ListResponse {
  total:   number;
  filters: Record<string, unknown>;
  items:   CompanySummaryListItemViewModel[];
}

interface BatchDryRunResult {
  dry_run:               true;
  total_targeted:        number;
  /** review batch のみ。実行予定件数 */
  ok_count?:             number;
  /** review batch のみ。missing による skip 見込み */
  skipped_missing_count?: number;
  /** review batch のみ。locked（approved）による skip 見込み */
  skipped_locked_count?:  number;
  target_companies: {
    uid:              string;
    name:             string;
    freshness_status: string;
    human_review_status?: string | null;
    can_bulk_regenerate?: boolean;
    can_bulk_approve?:    boolean;
    /** skip 理由（skip される企業のみ付与） */
    skip_reason?:     string;
  }[];
  note?:           string;
}

interface BatchRunResultItem {
  company_uid:            string;
  company_name:           string;
  /** ok | skipped_missing | skipped_locked | failed（regenerate は ok | skipped | failed） */
  status:                 string;
  freshness_status:       string;
  human_review_status?:   string | null;
  previous_review_status?: string | null;
  skip_reason?:           string;
  error?:                 string;
}

interface BatchRunResult {
  dry_run:               false;
  started_at?:           string;
  finished_at?:          string;
  duration_ms?:          number;
  total_targeted:        number;
  ok_count?:             number;
  success_count?:        number;
  skipped_missing_count?: number;
  skipped_locked_count?:  number;
  failed_count:          number;
  skipped_count?:        number;
  failures:              { company_uid: string; company_name: string; reason: string }[];
  results?:              BatchRunResultItem[];
  /** NocoDB audit_logs へ保存された行 ID（未設定時は null = console fallback） */
  audit_log_id?:         number | null;
}

type BatchMode = 'regenerate' | 'review';

// ── 定数 ────────────────────────────────────────────────────────────────────

const API_BASE    = '/api';
const BATCH_TOKEN = process.env.NEXT_PUBLIC_SUPPORT_BATCH_SECRET ?? '';

const FRESHNESS_OPTIONS = [
  { value: 'missing', label: 'missing',  badgeClass: 'bg-slate-100 border-slate-300 text-slate-600' },
  { value: 'stale',   label: 'stale',    badgeClass: 'bg-amber-100 border-amber-300 text-amber-700' },
  { value: 'fresh',   label: 'fresh',    badgeClass: 'bg-teal-100 border-teal-300 text-teal-700' },
  { value: 'locked',  label: 'locked',   badgeClass: 'bg-green-100 border-green-300 text-green-700' },
];

const REVIEW_OPTIONS = [
  { value: 'null',      label: '未設定（null）' },
  { value: 'pending',   label: 'pending（未確認）' },
  { value: 'reviewed',  label: 'reviewed（確認済み）' },
  { value: 'corrected', label: 'corrected（補正済み）' },
  { value: 'approved',  label: 'approved（承認済み）' },
];

const FRESHNESS_BADGE: Record<string, string> = {
  missing: 'bg-slate-100 border-slate-300 text-slate-600',
  stale:   'bg-amber-100 border-amber-300 text-amber-700',
  fresh:   'bg-teal-100  border-teal-300  text-teal-700',
  locked:  'bg-green-100 border-green-300 text-green-700',
};

const REVIEW_BADGE: Record<string, string> = {
  null_missing:  'bg-slate-100 border-slate-200 text-slate-400',  // 未生成（record なし）
  null_norecord: 'bg-slate-100 border-slate-300 text-slate-500',  // 旧データ（record あり・status 未設定）
  pending:   'bg-amber-100 border-amber-300 text-amber-700',   // AI 生成済み・未確認
  reviewed:  'bg-blue-100  border-blue-300  text-blue-700',
  corrected: 'bg-purple-100 border-purple-300 text-purple-700',
  approved:  'bg-green-100 border-green-300  text-green-700',
};

// ── ヘルパー ─────────────────────────────────────────────────────────────────

function apiFetch(path: string, init?: RequestInit) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(BATCH_TOKEN ? { 'Authorization': `Bearer ${BATCH_TOKEN}` } : {}),
  };
  return fetch(`${API_BASE}${path}`, { ...init, headers: { ...headers, ...(init?.headers as Record<string,string> ?? {}) } });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso.slice(0, 16); }
}

// ── クイックスタット カード ────────────────────────────────────────────────

function StatCard({ icon, label, count, colorClass, onClick, active }: {
  icon:       React.ReactNode;
  label:      string;
  count:      number;
  colorClass: string;
  onClick?:   () => void;
  active?:    boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-4 rounded-lg border text-left transition-all
        ${active ? 'ring-2 ring-offset-1 ring-blue-400' : 'hover:shadow-sm'}
        ${colorClass}`}
    >
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold leading-none">{count}</p>
        <p className="text-xs mt-1 opacity-70">{label}</p>
      </div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CompanySummaryOps() {
  // ── フィルタ状態 ──────────────────────────────────────────────────────────
  const [freshness,    setFreshness]    = useState<string[]>([]);
  const [review,       setReview]       = useState<string[]>([]);
  const [limit,        setLimit]        = useState<string>('100');
  const [uidsInput,    setUidsInput]    = useState('');

  // ── データ状態 ────────────────────────────────────────────────────────────
  const [items,        setItems]        = useState<CompanySummaryListItemViewModel[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [lastFetched,  setLastFetched]  = useState<string | null>(null);

  // ── Batch ダイアログ状態 ──────────────────────────────────────────────────
  const [batchMode,      setBatchMode]      = useState<BatchMode | null>(null);
  const [dryRunResult,   setDryRunResult]   = useState<BatchDryRunResult | null>(null);
  const [batchResult,    setBatchResult]    = useState<BatchRunResult | null>(null);
  const [batchRunning,   setBatchRunning]   = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);
  const [copied,         setCopied]         = useState(false);

  // ── 一覧フェッチ ──────────────────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (freshness.length > 0)   params.set('freshness',    freshness.join(','));
      if (review.length > 0)      params.set('review',       review.join(','));
      if (limit)                  params.set('limit',        limit);
      const rawUids = uidsInput.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
      if (rawUids.length > 0)     params.set('company_uids', rawUids.join(','));

      const res  = await apiFetch(`/company-summary-list?${params.toString()}`);
      const data = await res.json() as ListResponse;
      if (!res.ok) throw new Error((data as unknown as { error: string }).error ?? res.statusText);
      setItems(data.items ?? []);
      setLastFetched(new Date().toLocaleTimeString('ja-JP'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [freshness, review, limit, uidsInput]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // ── クイックスタット（items から派生） ────────────────────────────────────

  const stats = {
    missing:    items.filter(i => i.freshnessStatus === 'missing').length,
    stale:      items.filter(i => i.freshnessStatus === 'stale').length,
    unreviewed: items.filter(i => !i.humanReviewStatus || i.humanReviewStatus === 'pending').length,
    approved:   items.filter(i => i.humanReviewStatus === 'approved').length,
  };

  // ── フィルタ トグル ────────────────────────────────────────────────────────

  function toggleFreshness(val: string) {
    setFreshness(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  }
  function toggleReview(val: string) {
    setReview(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  }

  // ── Batch 操作 ────────────────────────────────────────────────────────────

  async function openBatchDryRun(mode: BatchMode) {
    setBatchMode(mode);
    setDryRunResult(null);
    setBatchResult(null);
    setBatchRunning(true);
    try {
      let res: Response;
      if (mode === 'regenerate') {
        res = await apiFetch('/batch/company-summary', {
          method: 'POST',
          body: JSON.stringify({ dry_run: true, freshness_filter: ['missing', 'stale'], limit: 50 }),
        });
      } else {
        res = await apiFetch('/batch/company-summary-review', {
          method: 'POST',
          body: JSON.stringify({ dry_run: true, limit: 100 }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText);
      setDryRunResult(data as BatchDryRunResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBatchMode(null);
    } finally {
      setBatchRunning(false);
    }
  }

  async function executeBatch() {
    if (!batchMode) return;
    setBatchRunning(true);
    setBatchResult(null);
    try {
      let res: Response;
      if (batchMode === 'regenerate') {
        res = await apiFetch('/batch/company-summary', {
          method: 'POST',
          body: JSON.stringify({ dry_run: false, freshness_filter: ['missing', 'stale'], limit: 50 }),
        });
      } else {
        res = await apiFetch('/batch/company-summary-review', {
          method: 'POST',
          body: JSON.stringify({ dry_run: false, limit: 100 }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText);
      setBatchResult(data as BatchRunResult);
      setDryRunResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBatchRunning(false);
    }
  }

  function closeBatchDialog() {
    const wasExecuted = !!batchResult;
    setBatchMode(null);
    setDryRunResult(null);
    setBatchResult(null);
    setShowAllResults(false);
    setCopied(false);
    if (wasExecuted) fetchList();
  }

  async function copyResultJson() {
    if (!batchResult) return;
    await navigator.clipboard.writeText(JSON.stringify(batchResult, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── レンダリング ──────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader />

        <main className="flex-1 overflow-y-auto p-6">
          {/* ── ページヘッダー ───────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Company Summary 運用</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                summary 状態の確認・batch regenerate / review の実行
              </p>
            </div>
            <div className="flex items-center gap-2">
              {lastFetched && (
                <span className="text-xs text-slate-400">最終取得: {lastFetched}</span>
              )}
              <Button variant="outline" size="sm" onClick={fetchList} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                更新
              </Button>
            </div>
          </div>

          {/* ── クイックスタット ─────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <StatCard
              icon={<FileQuestion className="w-5 h-5 text-slate-500" />}
              label="missing（未生成）"
              count={stats.missing}
              colorClass="bg-slate-50 border-slate-200 text-slate-700"
              onClick={() => setFreshness(['missing'])}
              active={freshness.length === 1 && freshness[0] === 'missing'}
            />
            <StatCard
              icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
              label="stale（要再生成）"
              count={stats.stale}
              colorClass="bg-amber-50 border-amber-200 text-amber-800"
              onClick={() => setFreshness(['stale'])}
              active={freshness.length === 1 && freshness[0] === 'stale'}
            />
            <StatCard
              icon={<Clock className="w-5 h-5 text-slate-500" />}
              label="未確認（null + pending）"
              count={stats.unreviewed}
              colorClass="bg-white border-slate-200 text-slate-700"
              onClick={() => setReview(['null', 'pending'])}
              active={review.includes('null') && review.includes('pending')}
            />
            <StatCard
              icon={<Lock className="w-5 h-5 text-green-600" />}
              label="approved（保護）"
              count={stats.approved}
              colorClass="bg-green-50 border-green-200 text-green-800"
              onClick={() => setReview(['approved'])}
              active={review.length === 1 && review[0] === 'approved'}
            />
          </div>

          {/* ── フィルタバー ─────────────────────────────────────────────── */}
          <Card className="mb-4 border-slate-200">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-end">
                {/* freshness */}
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">freshness</p>
                  <div className="flex gap-1.5">
                    {FRESHNESS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => toggleFreshness(opt.value)}
                        className={`text-xs px-2.5 py-1 rounded border font-medium transition-all
                          ${freshness.includes(opt.value)
                            ? `${opt.badgeClass} ring-1 ring-offset-1 ring-current`
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    {freshness.length > 0 && (
                      <button onClick={() => setFreshness([])} className="text-xs px-2 py-1 text-slate-400 hover:text-slate-600">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* review */}
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">review</p>
                  <div className="flex flex-wrap gap-1.5">
                    {REVIEW_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => toggleReview(opt.value)}
                        className={`text-xs px-2.5 py-1 rounded border font-medium transition-all
                          ${review.includes(opt.value)
                            ? 'bg-blue-100 border-blue-300 text-blue-700 ring-1 ring-offset-1 ring-blue-400'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    {review.length > 0 && (
                      <button onClick={() => setReview([])} className="text-xs px-2 py-1 text-slate-400 hover:text-slate-600">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* limit */}
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">limit</p>
                  <Select value={limit} onValueChange={setLimit}>
                    <SelectTrigger className="h-8 w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['50', '100', '200', '500'].map(v => (
                        <SelectItem key={v} value={v} className="text-xs">{v} 件</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* company_uids */}
                <div className="flex-1 min-w-[200px]">
                  <p className="text-xs font-medium text-slate-500 mb-1.5">company_uids（カンマ区切り）</p>
                  <Input
                    value={uidsInput}
                    onChange={e => setUidsInput(e.target.value)}
                    placeholder="uid-001, uid-002 ..."
                    className="h-8 text-xs"
                  />
                </div>

                {/* 絞り込みリセット */}
                {(freshness.length > 0 || review.length > 0 || uidsInput) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8 text-slate-500"
                    onClick={() => { setFreshness([]); setReview([]); setUidsInput(''); }}
                  >
                    <X className="w-3 h-3 mr-1" />すべてリセット
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Batch 操作ボタン ──────────────────────────────────────────── */}
          <div className="flex gap-3 mb-4 items-start">
            {/* Regenerate */}
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                onClick={() => openBatchDryRun('regenerate')}
                disabled={loading}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Batch Regenerate（missing + stale）
              </Button>
              <p className="text-[11px] text-slate-400 pl-1">
                対象: missing / stale
                &nbsp;·&nbsp;
                <span className="text-green-600 font-medium">approved は自動スキップ</span>
              </p>
            </div>

            {/* Review */}
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => openBatchDryRun('review')}
                disabled={loading}
              >
                <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                Batch Review（→ reviewed）
              </Button>
              <p className="text-[11px] text-slate-400 pl-1">
                対象: pending / null / reviewed / corrected
                &nbsp;·&nbsp;
                <span className="text-slate-500 font-medium">missing は自動スキップ</span>
                &nbsp;·&nbsp;
                <span className="text-green-600 font-medium">approved は自動スキップ</span>
              </p>
            </div>
          </div>

          {/* ── エラー表示 ────────────────────────────────────────────────── */}
          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span>{error}</span>
                {error.includes('Invalid option') && (
                  <p className="mt-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    💡 <strong>NocoDB スキーマ不整合:</strong> overall_health カラムが SingleSelect（選択肢なし）になっています。NocoDB 管理画面でカラム型を <strong>Text</strong> に変更してください。
                  </p>
                )}
              </div>
              <button onClick={() => setError(null)} className="ml-auto flex-shrink-0"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* ── テーブル ─────────────────────────────────────────────────── */}
          <Card className="border-slate-200">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <FileQuestion className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">条件に一致する企業がありません</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 text-xs">
                        <TableHead className="w-[200px]">企業名</TableHead>
                        <TableHead className="w-[90px]">freshness</TableHead>
                        <TableHead className="w-[120px]">review status</TableHead>
                        <TableHead className="w-[60px] text-center">優先度</TableHead>
                        <TableHead className="w-[130px]">last AI updated</TableHead>
                        <TableHead className="w-[130px]">source updated</TableHead>
                        <TableHead className="w-[72px] text-center" title="canBulkRegenerate: approved 以外の企業">再生成可</TableHead>
                        <TableHead className="w-[72px] text-center" title="canBulkApprove: summary あり & approved 以外">review可</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(item => {
                        const isApprovedRow = item.humanReviewStatus === 'approved';
                        return (
                        <TableRow
                          key={item.companyUid}
                          className={`text-xs transition-colors
                            ${isApprovedRow
                              ? 'bg-green-50/60 hover:bg-green-50 border-l-2 border-l-green-400'
                              : 'hover:bg-slate-50/70'}`}
                        >
                          {/* 企業名 */}
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {isApprovedRow && (
                                <Lock className="w-3 h-3 text-green-500 flex-shrink-0" aria-label="approved（保護中）" />
                              )}
                              <Link
                                href={`/companies/${item.companyUid}`}
                                className={`hover:underline truncate block max-w-[175px] ${isApprovedRow ? 'text-green-700' : 'text-blue-600'}`}
                                title={item.companyName}
                              >
                                {item.companyName}
                              </Link>
                            </div>
                          </TableCell>

                          {/* freshness */}
                          <TableCell>
                            <Badge
                              variant="outline"
                              title={item.freshnessStatus === 'stale'
                                ? 'companies.updatedAt が AI 生成時刻より新しい（source_updated_at > last_ai_updated_at）'
                                : undefined}
                              className={`text-xs border ${FRESHNESS_BADGE[item.freshnessStatus] ?? 'bg-slate-100 text-slate-500'}`}
                            >
                              {item.freshnessStatus}
                            </Badge>
                          </TableCell>

                          {/* review status */}
                          <TableCell>
                            {(() => {
                              const isCorrected = item.humanReviewStatus === 'corrected';
                              // null の場合は freshnessStatus で "未生成" か "未設定" を区別
                              const badgeKey = isApprovedRow
                                ? 'approved'
                                : item.humanReviewStatus
                                  ?? (item.freshnessStatus === 'missing' ? 'null_missing' : 'null_norecord');
                              const badgeClass = REVIEW_BADGE[badgeKey] ?? 'bg-slate-100 border-slate-200 text-slate-500';
                              const label = isApprovedRow
                                ? item.reviewGroupLabel
                                : item.humanReviewStatus === null && item.freshnessStatus === 'missing'
                                  ? '未生成'
                                  : item.humanReviewStatus === null
                                    ? '未設定'
                                    : item.reviewGroupLabel;
                              return (
                                <div className="flex flex-col gap-1">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs
                                      ${isApprovedRow ? 'font-medium' : ''} ${badgeClass}`}
                                    title={item.humanReviewStatus === null && item.freshnessStatus !== 'missing'
                                      ? 'NocoDB に human_review_status が未設定のレコード（旧データ）'
                                      : undefined}
                                  >
                                    {isApprovedRow && <Lock className="w-2.5 h-2.5" />}
                                    {label}
                                  </span>
                                  {isCorrected && (
                                    <span
                                      className="text-[10px] text-purple-500 leading-none"
                                      title="corrected は手動補正済み。batch review で 'reviewed' に上書きされます"
                                    >
                                      ↻ batch で上書き対象
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </TableCell>

                          {/* 優先度 */}
                          <TableCell className="text-center">
                            <span className={`font-bold ${
                              item.regeneratePriority >= 4 ? 'text-slate-600' :
                              item.regeneratePriority === 3 ? 'text-amber-600' :
                              item.regeneratePriority === 2 ? 'text-teal-600' :
                              'text-green-600'
                            }`}>
                              {item.regeneratePriority}
                            </span>
                          </TableCell>

                          {/* last AI updated */}
                          <TableCell className="tabular-nums text-slate-500">
                            {fmtDate(item.lastAiUpdatedAt)}
                          </TableCell>

                          {/* source updated */}
                          <TableCell className="tabular-nums text-slate-500">
                            {fmtDate(item.sourceUpdatedAt)}
                          </TableCell>

                          {/* can bulk regenerate */}
                          <TableCell className="text-center">
                            {item.canBulkRegenerate
                              ? <Check className="w-4 h-4 text-teal-500 mx-auto" />
                              : <Lock className="w-3.5 h-3.5 text-green-400 mx-auto" aria-label="approved 保護" />
                            }
                          </TableCell>

                          {/* can bulk review (canBulkApprove = hasSummary && !isApproved) */}
                          <TableCell className="text-center">
                            {item.canBulkApprove
                              ? <Check className="w-4 h-4 text-blue-500 mx-auto" />
                              : item.freshnessStatus === 'missing'
                                ? <span className="text-[10px] text-slate-400">missing</span>
                                : <Lock className="w-3.5 h-3.5 text-green-400 mx-auto" aria-label="approved 保護" />
                            }
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* テーブルフッター */}
              {!loading && items.length > 0 && (
                <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span>{items.length} 件表示</span>
                  <span>sort: regenerate_priority 降順</span>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* ── Batch 確認ダイアログ ────────────────────────────────────────────── */}
      <Dialog open={batchMode !== null} onOpenChange={open => { if (!open) closeBatchDialog(); }}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {batchMode === 'regenerate'
                ? <><RefreshCw className="w-4 h-4 text-amber-600" /> Batch Regenerate 確認</>
                : <><CheckSquare className="w-4 h-4 text-blue-600" /> Batch Review 確認</>
              }
            </DialogTitle>
            <DialogDescription className="space-y-1">
              {batchMode === 'regenerate' ? (
                <>
                  <span>missing + stale の企業を AI 再生成します。</span>
                  <span className="flex gap-3 mt-1 text-[11px]">
                    <span className="text-green-600 font-medium">🔒 approved → 自動スキップ（保護）</span>
                  </span>
                </>
              ) : (
                <>
                  <span>pending / null / reviewed / corrected の企業を <strong>"reviewed"</strong> に一括更新します。</span>
                  <span className="flex gap-3 mt-1 text-[11px]">
                    <span className="text-slate-500 font-medium">missing → 自動スキップ（レコードなし）</span>
                    <span className="text-green-600 font-medium">🔒 approved → 自動スキップ（保護）</span>
                    <span className="text-purple-600 font-medium">corrected も "reviewed" に上書き（手動補正が消えます）</span>
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
          <div className="px-0.5 py-1 space-y-3">
          {/* ── dry_run 結果 ─────────────────────────────────────────────── */}
          {batchRunning && !dryRunResult && !batchResult && (
            <div className="flex items-center gap-2 py-6 justify-center text-slate-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              対象を確認中...
            </div>
          )}

          {dryRunResult && (() => {
            const executeCount = dryRunResult.ok_count
              ?? dryRunResult.target_companies.filter(c => !c.skip_reason).length;
            const skipMissing = dryRunResult.skipped_missing_count
              ?? dryRunResult.target_companies.filter(c => c.skip_reason?.includes('missing')).length;
            const skipLocked = dryRunResult.skipped_locked_count
              ?? dryRunResult.target_companies.filter(c => c.skip_reason?.includes('approved')).length;
            const afterLabel = batchMode === 'regenerate'
              ? '→ AI 再生成（freshness が fresh に更新）'
              : '→ human_review_status が "reviewed" に更新';

            return (
              <div className="space-y-3">
                {/* 実行後状態バナー */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium border
                  ${batchMode === 'regenerate'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-blue-50 border-blue-200 text-blue-800'}`}
                >
                  {batchMode === 'regenerate'
                    ? <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
                    : <CheckSquare className="w-3.5 h-3.5 flex-shrink-0" />
                  }
                  実行後: <span className="font-semibold">{afterLabel}</span>
                </div>

                {/* 件数サマリー（4カラム） */}
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-center">
                    <p className="text-xl font-bold text-slate-800">{dryRunResult.total_targeted}</p>
                    <p className="text-xs text-slate-500 mt-0.5">対象合計</p>
                  </div>
                  <div className="p-3 rounded-md bg-teal-50 border border-teal-200 text-center">
                    <p className="text-xl font-bold text-teal-700">{executeCount}</p>
                    <p className="text-xs text-teal-600 mt-0.5">実行予定</p>
                  </div>
                  <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-center">
                    <p className="text-xl font-bold text-slate-500">{skipMissing}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      skip
                      <span className="block text-[10px]">missing</span>
                    </p>
                  </div>
                  <div className="p-3 rounded-md bg-green-50 border border-green-200 text-center">
                    <p className="text-xl font-bold text-green-600">{skipLocked}</p>
                    <p className="text-xs text-green-600 mt-0.5">
                      skip
                      <span className="block text-[10px] flex items-center justify-center gap-0.5">
                        <Lock className="w-2.5 h-2.5 inline" /> approved
                      </span>
                    </p>
                  </div>
                </div>

                {/* 対象企業プレビュー */}
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <div className="bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 flex items-center gap-1">
                    <ChevronDown className="w-3 h-3" />
                    企業プレビュー（上位 {Math.min(dryRunResult.target_companies.length, 10)} 件 / 全 {dryRunResult.total_targeted} 件）
                  </div>
                  <div>
                    {dryRunResult.target_companies.slice(0, 10).map(c => {
                      const isLocked = c.skip_reason?.includes('approved');
                      const isMissing = c.skip_reason?.includes('missing');
                      return (
                        <div key={c.uid} className={`flex items-center justify-between px-3 py-2 border-t border-slate-100 text-xs
                          ${isLocked ? 'bg-green-50/50' : ''}`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isLocked && <Lock className="w-3 h-3 text-green-500 flex-shrink-0" />}
                            <Link
                              href={`/companies/${c.uid}`}
                              className={`truncate max-w-[230px] hover:underline flex items-center gap-0.5
                                ${isLocked ? 'text-green-700' : 'text-slate-700'}`}
                              title={c.name}
                              onClick={closeBatchDialog}
                            >
                              {c.name}
                              <ExternalLink className="w-2.5 h-2.5 opacity-40 flex-shrink-0" />
                            </Link>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <Badge variant="outline" className={`text-xs border ${FRESHNESS_BADGE[c.freshness_status] ?? ''}`}>
                              {c.freshness_status}
                            </Badge>
                            {c.skip_reason
                              ? (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  isLocked  ? 'bg-green-100 text-green-600' :
                                  isMissing ? 'bg-slate-100 text-slate-500' :
                                              'bg-slate-100 text-slate-400'
                                }`}>
                                  {isLocked ? '🔒 skip' : isMissing ? 'missing skip' : 'skip'}
                                </span>
                              )
                              : (
                                <span className="text-teal-600 text-xs font-medium">
                                  {batchMode === 'regenerate' ? '✓ 再生成' : '✓ reviewed へ'}
                                </span>
                              )
                            }
                          </div>
                        </div>
                      );
                    })}
                    {dryRunResult.target_companies.length > 10 && (
                      <div className="px-3 py-1.5 text-xs text-slate-400 text-center border-t border-slate-100">
                        他 {dryRunResult.target_companies.length - 10} 件（実行時はすべて処理されます）
                      </div>
                    )}
                  </div>
                </div>

                {/* skip ルール説明 */}
                <div className="flex gap-4 text-[11px] text-slate-500 bg-slate-50 rounded px-3 py-2 border border-slate-100">
                  <span><span className="font-medium text-slate-600">missing skip:</span> summary レコードなし。先に AI 生成・保存を実施してください</span>
                  <span><span className="font-medium text-green-600">🔒 approved skip:</span> 承認済み保護。個別の承認解除が必要です</span>
                </div>
              </div>
            );
          })()}

          {/* ── 実行結果 ─────────────────────────────────────────────────── */}
          {batchResult && (() => {
            const okCount      = batchResult.ok_count ?? batchResult.success_count ?? 0;
            const skipMissing  = batchResult.skipped_missing_count ?? 0;
            const skipLocked   = batchResult.skipped_locked_count ?? batchResult.skipped_count ?? 0;
            const failedCount  = batchResult.failed_count;
            const allResults   = batchResult.results ?? [];
            const previewRows  = showAllResults ? allResults : allResults.slice(0, 8);
            const runAt        = batchResult.started_at
              ? new Date(batchResult.started_at).toLocaleString('ja-JP')
              : null;

            return (
              <div className="space-y-3">
                {/* 実行時刻 + 監査ログ導線 */}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {runAt ? `実行開始: ${runAt}` : '実行完了'}
                    {batchResult.duration_ms != null && (
                      <span className="ml-2 text-slate-400">({batchResult.duration_ms}ms)</span>
                    )}
                  </span>
                  {batchResult.audit_log_id != null ? (
                    <Link
                      href="/ops/batch-logs"
                      className="flex items-center gap-1 text-blue-500 hover:text-blue-700"
                      onClick={closeBatchDialog}
                    >
                      <Database className="w-3 h-3" />
                      audit log #{batchResult.audit_log_id} を確認
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1 text-slate-400">
                      <History className="w-3 h-3" />
                      実行履歴は server logs（console.log [batch-run]）で確認
                    </span>
                  )}
                </div>

                {/* 集計カード */}
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className="p-3 rounded-md bg-teal-50 border border-teal-200 text-center">
                    <p className="text-xl font-bold text-teal-700">{okCount}</p>
                    <p className="text-xs text-teal-600 mt-0.5">成功</p>
                  </div>
                  <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-center">
                    <p className="text-xl font-bold text-slate-500">{skipMissing}</p>
                    <p className="text-xs text-slate-400 mt-0.5">skip<span className="block text-[10px]">missing</span></p>
                  </div>
                  <div className="p-3 rounded-md bg-green-50 border border-green-200 text-center">
                    <p className="text-xl font-bold text-green-600">{skipLocked}</p>
                    <p className="text-xs text-green-600 mt-0.5">skip<span className="block text-[10px]">🔒 approved</span></p>
                  </div>
                  <div className={`p-3 rounded-md text-center border ${failedCount > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                    <p className={`text-xl font-bold ${failedCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>{failedCount}</p>
                    <p className={`text-xs mt-0.5 ${failedCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>失敗</p>
                  </div>
                </div>

                {/* 失敗詳細 */}
                {batchResult.failures.length > 0 && (
                  <div className="border border-red-200 rounded-md bg-red-50 p-3 space-y-1">
                    <p className="text-xs font-medium text-red-700">失敗詳細:</p>
                    {batchResult.failures.map(f => (
                      <div key={f.company_uid} className="flex items-center gap-2 text-xs text-red-600">
                        <Link
                          href={`/companies/${f.company_uid}`}
                          className="font-medium hover:underline flex items-center gap-0.5"
                          onClick={closeBatchDialog}
                        >
                          {f.company_name}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                        <span className="text-red-400">—</span>
                        <span>{f.reason}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 全明細（results がある場合） */}
                {allResults.length > 0 && (
                  <div className="border border-slate-200 rounded-md overflow-hidden">
                    <div className="bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <ChevronDown className="w-3 h-3" />
                        実行明細（{allResults.length} 件）
                      </span>
                      <button
                        onClick={() => setShowAllResults(v => !v)}
                        className="text-[11px] text-blue-500 hover:text-blue-700"
                      >
                        {showAllResults ? '折りたたむ' : `全件表示（+${allResults.length - 8} 件）`}
                      </button>
                    </div>
                    <div>
                      {previewRows.map(r => {
                        const isOk      = r.status === 'ok';
                        const isFailed  = r.status === 'failed';
                        const isLocked  = r.status === 'skipped_locked';
                        const isMissing = r.status === 'skipped_missing';
                        return (
                          <div key={r.company_uid} className={`flex items-center justify-between px-3 py-1.5 border-t border-slate-100 text-xs
                            ${isLocked ? 'bg-green-50/40' : isFailed ? 'bg-red-50/40' : ''}`}
                          >
                            <Link
                              href={`/companies/${r.company_uid}`}
                              className={`hover:underline flex items-center gap-1 truncate max-w-[240px]
                                ${isFailed ? 'text-red-600' : isLocked ? 'text-green-700' : 'text-slate-700'}`}
                              onClick={closeBatchDialog}
                              title={r.company_name}
                            >
                              {isLocked && <Lock className="w-2.5 h-2.5 flex-shrink-0" />}
                              {r.company_name}
                              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-50" />
                            </Link>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <Badge variant="outline" className={`text-xs border ${FRESHNESS_BADGE[r.freshness_status] ?? ''}`}>
                                {r.freshness_status}
                              </Badge>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                isOk      ? 'bg-teal-100 text-teal-700' :
                                isLocked  ? 'bg-green-100 text-green-600' :
                                isMissing ? 'bg-slate-100 text-slate-500' :
                                isFailed  ? 'bg-red-100 text-red-600' :
                                            'bg-slate-100 text-slate-500'
                              }`}>
                                {isOk      ? '✓ ok' :
                                 isLocked  ? '🔒 locked' :
                                 isMissing ? 'missing' :
                                 isFailed  ? '✗ failed' : r.status}
                              </span>
                              {/* review: 変更前 → 変更後 */}
                              {isOk && r.previous_review_status !== undefined && (
                                <span className="text-[10px] text-slate-400 tabular-nums">
                                  {r.previous_review_status ?? 'null'} → reviewed
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {!showAllResults && allResults.length > 8 && (
                        <button
                          onClick={() => setShowAllResults(true)}
                          className="w-full px-3 py-1.5 text-xs text-blue-500 hover:text-blue-700 border-t border-slate-100 text-center flex items-center justify-center gap-1"
                        >
                          <ChevronDown className="w-3 h-3" />
                          残り {allResults.length - 8} 件を表示
                        </button>
                      )}
                      {showAllResults && allResults.length > 8 && (
                        <button
                          onClick={() => setShowAllResults(false)}
                          className="w-full px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600 border-t border-slate-100 text-center flex items-center justify-center gap-1"
                        >
                          <ChevronUp className="w-3 h-3" />
                          折りたたむ
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* コピー + 完了メッセージ */}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>「閉じる」で一覧を最新状態に更新します。</span>
                  <button
                    onClick={copyResultJson}
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors"
                    title="実行結果 JSON をクリップボードにコピー"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? 'コピーしました' : 'result JSON をコピー'}
                  </button>
                </div>
              </div>
            );
          })()}
          </div>
          </ScrollArea>

          <DialogFooter className="flex-shrink-0 border-t pt-3">
            {!batchResult ? (
              <>
                <Button variant="outline" size="sm" onClick={closeBatchDialog} disabled={batchRunning}>
                  キャンセル
                </Button>
                <Button
                  size="sm"
                  onClick={executeBatch}
                  disabled={batchRunning || !dryRunResult}
                  className={batchMode === 'regenerate' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}
                >
                  {batchRunning
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />実行中...</>
                    : batchMode === 'regenerate'
                      ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />再生成を実行</>
                      : <><CheckSquare className="w-3.5 h-3.5 mr-1.5" />reviewed に更新</>
                  }
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={closeBatchDialog}>
                閉じて一覧を更新
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
