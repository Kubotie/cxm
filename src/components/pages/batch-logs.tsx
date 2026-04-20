"use client";

// ─── Batch 実行ログ一覧画面 ──────────────────────────────────────────────────
// GET /api/ops/batch-logs から audit_logs を取得して表示する。
// フィルタ: batch_type / dry_run / failed_only / date_from / date_to

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw, AlertTriangle, X, FileQuestion,
  CheckSquare, ChevronRight, Clock, Database,
  Copy, Check, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";
import type { RawAuditLog } from "@/app/api/ops/batch-logs/route";

// ── 定数 ─────────────────────────────────────────────────────────────────────

const API_BASE    = '/api';
const BATCH_TOKEN = process.env.NEXT_PUBLIC_SUPPORT_BATCH_SECRET ?? '';

const BATCH_TYPE_OPTIONS = [
  { value: 'all',                        label: '全種別' },
  { value: 'company-summary-regenerate', label: 'Regenerate（AI 再生成）' },
  { value: 'company-summary-review',     label: 'Review（→ reviewed）' },
  { value: 'support-rebuild-ai-state',   label: 'Support AI State' },
  { value: 'support-rebuild-alerts',     label: 'Support Alerts' },
  { value: 'unified-log-signals',        label: 'Unified Log Signals' },
];

const BATCH_TYPE_BADGE: Record<string, string> = {
  'company-summary-regenerate': 'bg-amber-100 border-amber-300 text-amber-700',
  'company-summary-review':     'bg-blue-100  border-blue-300  text-blue-700',
  'support-rebuild-ai-state':   'bg-purple-100 border-purple-300 text-purple-700',
  'support-rebuild-alerts':     'bg-rose-100  border-rose-300  text-rose-700',
  'unified-log-signals':        'bg-slate-100 border-slate-300 text-slate-600',
};

// ── ヘルパー ─────────────────────────────────────────────────────────────────

function apiFetch(path: string) {
  return fetch(`${API_BASE}${path}`, {
    headers: BATCH_TOKEN ? { 'Authorization': `Bearer ${BATCH_TOKEN}` } : {},
  });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ja-JP', {
      month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return iso.slice(0, 19); }
}

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000)  return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function parseJson<T>(str: string | null | undefined, fallback: T): T {
  try { return str ? JSON.parse(str) as T : fallback; }
  catch { return fallback; }
}

// ── 詳細ダイアログ ────────────────────────────────────────────────────────────

function LogDetailDialog({ log, onClose }: { log: RawAuditLog; onClose: () => void }) {
  const [copiedJson,    setCopiedJson]    = useState(false);
  const [jsonExpanded,  setJsonExpanded]  = useState(false);

  const failures = parseJson<{ company_uid?: string; company_name?: string; case_id?: string; reason?: string }[]>(
    log.failure_details, [],
  );
  const filters  = parseJson<Record<string, unknown>>(log.filters, {});
  const okCount  = log.ok_count ?? log.success_count ?? 0;

  // result_json の表示: 1000文字超は折りたたみ
  const rawJson      = log.result_json ?? JSON.stringify(log, null, 2);
  const jsonPreview  = rawJson.slice(0, 1000);
  const jsonIsLong   = rawJson.length > 1000;

  async function copyJson() {
    await navigator.clipboard.writeText(rawJson);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  }

  const typeBadge = BATCH_TYPE_BADGE[log.batch_type ?? ''] ?? 'bg-slate-100 border-slate-300 text-slate-500';

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Database className="w-4 h-4 text-slate-500" />
            実行ログ詳細 — ID: {log.Id}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Badge variant="outline" className={`text-xs border ${typeBadge}`}>
                {log.batch_type ?? log.endpoint.replace('/api/batch/', '')}
              </Badge>
              {log.dry_run && (
                <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">dry_run</span>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0 space-y-4 text-sm pr-1">

          {/* ── 基本情報グリッド ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs bg-slate-50 rounded-md px-3 py-2.5 border border-slate-100">
            {([
              ['実行開始',  fmtDate(log.started_at)],
              ['実行終了',  fmtDate(log.finished_at)],
              ['所要時間',  fmtMs(log.duration_ms)],
              ['endpoint', log.endpoint],
              ['source',   log.source_queue],
              ['request',  log.request_params],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex gap-2 min-w-0">
                <span className="text-slate-400 w-18 flex-shrink-0">{k}</span>
                <span className="text-slate-700 font-mono truncate" title={v}>{v || '—'}</span>
              </div>
            ))}
          </div>

          {/* ── フィルタ条件 ──────────────────────────────────────────── */}
          {Object.keys(filters).length > 0 && (
            <div className="rounded-md border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
                フィルタ条件
              </div>
              <pre className="px-3 py-2 text-xs text-slate-700 whitespace-pre-wrap font-mono bg-white">
                {JSON.stringify(filters, null, 2)}
              </pre>
            </div>
          )}

          {/* ── 件数サマリー ──────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-2">
            {([
              { label: '対象合計', value: log.total_targeted, cls: 'bg-slate-50 border-slate-200 text-slate-700' },
              { label: '成功 (ok)',  value: okCount,           cls: 'bg-teal-50  border-teal-200  text-teal-700'  },
              { label: 'skip',      value: log.skipped_count,  cls: 'bg-slate-50 border-slate-200 text-slate-500' },
              { label: '失敗',      value: log.failed_count,   cls: log.failed_count > 0
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : 'bg-slate-50 border-slate-200 text-slate-400' },
            ] as { label: string; value: number; cls: string }[]).map(c => (
              <div key={c.label} className={`p-2 rounded border text-center ${c.cls}`}>
                <p className="text-lg font-bold leading-none">{c.value}</p>
                <p className="text-[10px] mt-1">{c.label}</p>
              </div>
            ))}
          </div>

          {/* ── 失敗詳細 ──────────────────────────────────────────────── */}
          {failures.length > 0 && (
            <div className="rounded-md border border-red-200 overflow-hidden">
              <div className="bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700">
                失敗詳細 ({failures.length} 件)
              </div>
              <div className="divide-y divide-red-100">
                {failures.map((f, i) => {
                  const uid  = f.company_uid ?? f.case_id;
                  const name = f.company_name ?? f.case_id ?? uid ?? `#${i + 1}`;
                  const href = f.company_uid
                    ? `/companies/${f.company_uid}`
                    : f.case_id
                      ? `/support/${f.case_id}`
                      : null;
                  return (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 text-xs text-red-600 bg-white">
                      {href ? (
                        <Link
                          href={href}
                          className="font-medium hover:underline flex items-center gap-0.5 flex-shrink-0"
                          onClick={onClose}
                        >
                          {name}
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </Link>
                      ) : (
                        <span className="font-medium flex-shrink-0">{name}</span>
                      )}
                      <span className="text-red-300">—</span>
                      <span className="break-all">{f.reason}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── result_json ───────────────────────────────────────────── */}
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-3 py-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">result_json</span>
              <div className="flex items-center gap-2">
                {jsonIsLong && (
                  <button
                    onClick={() => setJsonExpanded(v => !v)}
                    className="text-[11px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                  >
                    {jsonExpanded
                      ? <><ChevronUp className="w-3 h-3" />折りたたむ</>
                      : <><ChevronDown className="w-3 h-3" />全て表示（{rawJson.length.toLocaleString()} 文字）</>
                    }
                  </button>
                )}
                <button
                  onClick={copyJson}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
                >
                  {copiedJson
                    ? <><Check className="w-3 h-3 text-teal-500" />コピーしました</>
                    : <><Copy className="w-3 h-3" />コピー</>
                  }
                </button>
              </div>
            </div>
            <pre className="px-3 py-2 text-[11px] text-slate-600 whitespace-pre-wrap font-mono bg-white overflow-x-auto max-h-60 overflow-y-auto">
              {jsonExpanded || !jsonIsLong ? rawJson : jsonPreview + `\n…（残り ${rawJson.length - 1000} 文字）`}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BatchLogsPage() {
  const [items,        setItems]        = useState<RawAuditLog[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [unavailable,  setUnavailable]  = useState<string | null>(null);
  const [lastFetched,  setLastFetched]  = useState<string | null>(null);
  const [detailLog,    setDetailLog]    = useState<RawAuditLog | null>(null);

  // フィルタ
  const [batchType,    setBatchType]    = useState('all');
  const [dryRunFilter, setDryRunFilter] = useState('all');
  const [failedOnly,   setFailedOnly]   = useState(false);
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [limit,        setLimit]        = useState('50');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnavailable(null);
    try {
      const params = new URLSearchParams({ limit });
      if (batchType !== 'all')    params.set('batch_type',  batchType);
      if (dryRunFilter !== 'all') params.set('dry_run',     dryRunFilter);
      if (failedOnly)             params.set('failed_only', 'true');
      if (dateFrom)               params.set('date_from',   dateFrom);
      if (dateTo)                 params.set('date_to',     dateTo);

      const res = await apiFetch(`/ops/batch-logs?${params.toString()}`);

      type Response =
        | { available: true;  total: number; items: RawAuditLog[] }
        | { available: false; reason: string }
        | { error: string };

      const data = await res.json() as Response;

      if ('error' in data) throw new Error(data.error);
      if (!data.available) {
        setUnavailable('reason' in data ? data.reason : '利用不可');
        return;
      }
      setItems(data.items ?? []);
      setLastFetched(new Date().toLocaleTimeString('ja-JP'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [batchType, dryRunFilter, failedOnly, dateFrom, dateTo, limit]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // 集計（表示中 items から）
  const totalFailed = items.reduce((s, i) => s + i.failed_count, 0);
  const totalOk     = items.reduce((s, i) => s + (i.ok_count ?? i.success_count ?? 0), 0);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader />

        <main className="flex-1 overflow-y-auto p-6">

          {/* ── ページヘッダー ─────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Batch 実行ログ</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                audit_logs テーブルに記録された batch 実行履歴
              </p>
            </div>
            <div className="flex items-center gap-2">
              {lastFetched && <span className="text-xs text-slate-400">最終取得: {lastFetched}</span>}
              <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                更新
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/ops/company-summary">
                  <ChevronRight className="w-4 h-4 mr-1" />
                  Summary 運用
                </Link>
              </Button>
            </div>
          </div>

          {/* ── テーブル未設定バナー ──────────────────────────────── */}
          {unavailable && (
            <div className="mb-4 p-4 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <p className="font-medium flex items-center gap-2 mb-1">
                <Database className="w-4 h-4" />
                audit_logs テーブル未設定
              </p>
              <p className="text-xs text-amber-700">{unavailable}</p>
            </div>
          )}

          {/* ── フィルタバー ─────────────────────────────────────── */}
          {!unavailable && (
            <Card className="mb-4 border-slate-200">
              <CardContent className="p-3">
                <div className="flex flex-wrap gap-x-4 gap-y-2 items-end">

                  {/* batch_type */}
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 mb-1">batch 種別</p>
                    <Select value={batchType} onValueChange={setBatchType}>
                      <SelectTrigger className="h-8 w-52 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {BATCH_TYPE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* dry_run */}
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 mb-1">dry_run</p>
                    <Select value={dryRunFilter} onValueChange={setDryRunFilter}>
                      <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all"   className="text-xs">すべて</SelectItem>
                        <SelectItem value="false" className="text-xs">本実行のみ</SelectItem>
                        <SelectItem value="true"  className="text-xs">dry_run のみ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* date_from / date_to */}
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 mb-1">実行日 from</p>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="h-8 w-36 text-xs"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 mb-1">実行日 to</p>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="h-8 w-36 text-xs"
                    />
                  </div>

                  {/* failed_only */}
                  <div className="flex flex-col gap-1">
                    <p className="text-[11px] font-medium text-slate-400">failed のみ</p>
                    <button
                      onClick={() => setFailedOnly(v => !v)}
                      className={`h-8 px-3 text-xs rounded border font-medium transition-all
                        ${failedOnly
                          ? 'bg-red-100 border-red-300 text-red-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      {failedOnly ? '✗ 失敗あり のみ' : '失敗あり のみ'}
                    </button>
                  </div>

                  {/* limit */}
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 mb-1">表示件数</p>
                    <Select value={limit} onValueChange={setLimit}>
                      <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['20', '50', '100', '200'].map(v => (
                          <SelectItem key={v} value={v} className="text-xs">{v} 件</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* リセット */}
                  {(batchType !== 'all' || dryRunFilter !== 'all' || failedOnly || dateFrom || dateTo) && (
                    <button
                      onClick={() => { setBatchType('all'); setDryRunFilter('all'); setFailedOnly(false); setDateFrom(''); setDateTo(''); }}
                      className="h-8 px-2 text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />リセット
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── エラー ─────────────────────────────────────────────── */}
          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* ── ログ一覧 ───────────────────────────────────────────── */}
          {!unavailable && (
            <Card className="border-slate-200">
              {/* テーブルヘッダー */}
              {!loading && items.length > 0 && (
                <div className="grid grid-cols-[40px_160px_80px_80px_1fr_80px_80px_80px_28px] gap-2 px-4 py-2 border-b border-slate-100 bg-slate-50 text-[11px] font-medium text-slate-400">
                  <span className="text-right">ID</span>
                  <span>batch_type</span>
                  <span>dry_run</span>
                  <span>実行日時</span>
                  <span>endpoint</span>
                  <span className="text-right">ok</span>
                  <span className="text-right">skip</span>
                  <span className="text-right">failed</span>
                  <span />
                </div>
              )}

              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 space-y-3">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : items.length === 0 ? (
                  <div className="py-16 text-center text-slate-400">
                    <FileQuestion className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">条件に一致する実行ログがありません</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {items.map(log => {
                      const okCount   = log.ok_count ?? log.success_count ?? 0;
                      const typeBadge = BATCH_TYPE_BADGE[log.batch_type ?? ''] ?? 'bg-slate-100 border-slate-300 text-slate-500';
                      const hasFailed = log.failed_count > 0;
                      return (
                        <button
                          key={log.Id}
                          onClick={() => setDetailLog(log)}
                          className={`w-full grid grid-cols-[40px_160px_80px_80px_1fr_80px_80px_80px_28px] gap-2 items-center
                            px-4 py-2.5 text-left hover:bg-slate-50/80 transition-colors text-xs group
                            ${hasFailed ? 'border-l-2 border-l-red-400' : ''}`}
                        >
                          {/* ID */}
                          <span className="text-slate-300 font-mono text-right">{log.Id}</span>

                          {/* batch_type */}
                          <span>
                            <Badge variant="outline" className={`text-[10px] border ${typeBadge}`}>
                              {log.batch_type ?? log.endpoint.replace('/api/batch/', '')}
                            </Badge>
                          </span>

                          {/* dry_run */}
                          <span>
                            {log.dry_run
                              ? <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">dry</span>
                              : <span className="text-[10px] text-slate-300">—</span>
                            }
                          </span>

                          {/* 実行日時 */}
                          <span className="text-slate-500 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                            <span className="tabular-nums">{fmtDate(log.started_at)}</span>
                          </span>

                          {/* endpoint */}
                          <span className="text-slate-400 truncate font-mono text-[10px]"
                            title={log.endpoint}
                          >
                            {log.endpoint}
                          </span>

                          {/* ok */}
                          <span className="text-teal-600 font-medium tabular-nums text-right flex items-center justify-end gap-1">
                            <CheckSquare className="w-3 h-3" />{okCount}
                          </span>

                          {/* skip */}
                          <span className="text-slate-400 tabular-nums text-right">
                            {log.skipped_count > 0 ? log.skipped_count : <span className="text-slate-200">0</span>}
                          </span>

                          {/* failed */}
                          <span className={`tabular-nums text-right font-medium ${hasFailed ? 'text-red-500' : 'text-slate-200'}`}>
                            {hasFailed ? `✗ ${log.failed_count}` : '0'}
                          </span>

                          {/* 詳細矢印 */}
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* フッター: 集計 */}
                {!loading && items.length > 0 && (
                  <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <span>{items.length} 件表示（started_at 降順）</span>
                    <span className="flex items-center gap-4">
                      <span>合計 ok: <span className="font-medium text-teal-600">{totalOk}</span></span>
                      {totalFailed > 0 && (
                        <span>合計 failed: <span className="font-medium text-red-500">{totalFailed}</span></span>
                      )}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      {/* ── 詳細ダイアログ ────────────────────────────────────────── */}
      {detailLog && (
        <LogDetailDialog log={detailLog} onClose={() => setDetailLog(null)} />
      )}
    </div>
  );
}
