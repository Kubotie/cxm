"use client";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, Sparkles, Loader2, AlertCircle, RefreshCw, Calendar, Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ChurnReportListItem } from "@/app/api/ops/churn-reports/route";
import type { ChurnReportDetail } from "@/app/api/ops/churn-reports/[reportId]/route";

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('ja-JP', {
    year:   'numeric',
    month:  '2-digit',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

export function ChurnAnalysisPage() {
  const [list, setList]                       = useState<ChurnReportListItem[]>([]);
  const [listLoading, setListLoading]         = useState(true);
  const [listError, setListError]             = useState<string | null>(null);
  const [selectedId, setSelectedId]           = useState<string | null>(null);
  const [detail, setDetail]                   = useState<ChurnReportDetail | null>(null);
  const [detailLoading, setDetailLoading]     = useState(false);
  const [detailError, setDetailError]         = useState<string | null>(null);
  const [regenerating, setRegenerating]       = useState(false);
  const [regenerateNote, setRegenerateNote]   = useState<string | null>(null);

  // 一覧取得
  const loadList = () => {
    setListLoading(true);
    setListError(null);
    fetch('/api/ops/churn-reports?limit=100')
      .then(r => r.ok ? r.json() as Promise<{ items: ChurnReportListItem[] }> : Promise.reject(new Error(String(r.status))))
      .then(d => {
        setList(d.items);
        if (d.items.length > 0 && !selectedId) setSelectedId(d.items[0].reportId);
      })
      .catch(err => setListError(err instanceof Error ? err.message : String(err)))
      .finally(() => setListLoading(false));
  };

  useEffect(loadList, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 詳細取得
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setDetailLoading(true);
    setDetailError(null);
    fetch(`/api/ops/churn-reports/${selectedId}`)
      .then(r => r.ok ? r.json() as Promise<ChurnReportDetail> : Promise.reject(new Error(String(r.status))))
      .then(setDetail)
      .catch(err => setDetailError(err instanceof Error ? err.message : String(err)))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  // 手動再生成
  const triggerRegenerate = async () => {
    if (!confirm('週次解約分析レポートを新規生成しますか？（AI 呼び出しあり、数分かかります）')) return;
    setRegenerating(true);
    setRegenerateNote(null);
    try {
      const res = await fetch('/api/batch/churn-analysis-weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`status=${res.status}`);
      setRegenerateNote('レポート生成をバックグラウンドで開始しました。数分後に一覧を再読み込みしてください。');
    } catch (err) {
      setRegenerateNote(`生成に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <SidebarNav />
      <div className="flex-1 flex flex-col">
        <GlobalHeader />
        <main className="flex-1 p-6 overflow-x-auto">
          <div className="max-w-[1400px] mx-auto">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <TrendingDown className="w-6 h-6 text-slate-600" />
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  解約遡及分析
                </h1>
                <Badge variant="outline" className="text-xs">週次 AI レポート</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={loadList} disabled={listLoading}>
                  <RefreshCw className={`w-3 h-3 mr-1 ${listLoading ? 'animate-spin' : ''}`} />
                  更新
                </Button>
                <Button size="sm" onClick={triggerRegenerate} disabled={regenerating}>
                  {regenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                  今すぐ生成
                </Button>
              </div>
            </div>

            {regenerateNote && (
              <div className="mb-4 rounded border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-3 text-sm text-blue-800 dark:text-blue-200">
                {regenerateNote}
              </div>
            )}

            {/* 2-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">

              {/* Left: report history */}
              <aside className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                  <h2 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    レポート履歴
                  </h2>
                </div>

                {listLoading && (
                  <div className="p-4 text-sm text-slate-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    読み込み中...
                  </div>
                )}
                {listError && (
                  <div className="p-3 text-sm text-red-600 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{listError}</span>
                  </div>
                )}
                {!listLoading && !listError && list.length === 0 && (
                  <div className="p-4 text-sm text-slate-500 text-center">
                    まだレポートがありません。<br/>
                    <span className="text-xs">「今すぐ生成」で初回を作成できます</span>
                  </div>
                )}
                {!listLoading && list.length > 0 && (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[calc(100vh-220px)] overflow-y-auto">
                    {list.map(r => (
                      <li key={r.reportId}>
                        <button
                          onClick={() => setSelectedId(r.reportId)}
                          className={`w-full text-left px-3 py-3 transition
                            ${selectedId === r.reportId
                              ? 'bg-blue-50 dark:bg-blue-950/40 border-l-2 border-blue-500'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-900/40 border-l-2 border-transparent'
                            }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {r.weekStart} 〜 {r.weekEnd}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mb-1">
                            解約 {r.churnTotal} 社 · 予兆 {r.warningTotal} 社 ({formatPercent(r.warningRate)})
                          </div>
                          <div className="text-xs text-slate-400 line-clamp-2">
                            {r.summary || '(サマリーなし)'}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>

              {/* Right: detail */}
              <section>
                {!selectedId && (
                  <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-10 text-center text-slate-500">
                    左のリストからレポートを選択してください
                  </div>
                )}
                {selectedId && detailLoading && (
                  <div className="flex items-center gap-2 text-slate-500 py-10 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    詳細を読み込み中...
                  </div>
                )}
                {detailError && (
                  <div className="rounded border border-red-200 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {detailError}
                  </div>
                )}
                {detail && !detailLoading && (
                  <div className="space-y-4">

                    {/* Meta card */}
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            {detail.weekStart} 〜 {detail.weekEnd} レポート
                          </CardTitle>
                          <div className="text-xs text-slate-400">
                            {formatDateTime(detail.generatedAt)} · {detail.modelUsed}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-4 gap-4 text-center">
                          <div>
                            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                              {detail.churnTotal}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">解約企業数</div>
                          </div>
                          <div>
                            <div className="text-2xl font-semibold text-orange-600">
                              {detail.warningTotal}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">予兆検知社数</div>
                          </div>
                          <div>
                            <div className="text-2xl font-semibold text-blue-600">
                              {formatPercent(detail.warningRate)}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">検知率</div>
                          </div>
                          <div>
                            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                              {detail.windowDays}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">遡及日数</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* AI Summary */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-blue-500" />
                          総括
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {detail.aiSummary || '(サマリーなし)'}
                        </p>
                      </CardContent>
                    </Card>

                    {/* Key findings */}
                    {detail.aiKeyFindings.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">発見事項</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {detail.aiKeyFindings.map((finding, i) => (
                              <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                                <span className="text-slate-400 mt-0.5">•</span>
                                <span>{finding}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {/* Recommendations */}
                    {detail.aiRecommendations.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-blue-700 dark:text-blue-300">
                            推奨アクション
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ol className="space-y-2">
                            {detail.aiRecommendations.map((rec, i) => (
                              <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                                <span className="text-blue-500 font-semibold shrink-0">{i + 1}.</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ol>
                        </CardContent>
                      </Card>
                    )}

                    {/* Per-company signals table */}
                    {detail.report && detail.report.perCompany.filter(c => c.metabase.hasWarning || c.firstWarningAt !== 'none').length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-500" />
                            予兆が立った企業
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>企業</TableHead>
                                  <TableHead>Tier</TableHead>
                                  <TableHead>担当</TableHead>
                                  <TableHead>解約日</TableHead>
                                  <TableHead>Snapshot 予兆</TableHead>
                                  <TableHead>Metabase 予兆</TableHead>
                                  <TableHead className="text-right">リードタイム</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {detail.report.perCompany
                                  .filter(c => c.metabase.hasWarning || c.firstWarningAt !== 'none')
                                  .map(c => (
                                    <TableRow key={`${c.sfAccountId}-${c.churnDate}-${c.projectName ?? ''}`}>
                                      <TableCell className="font-medium">
                                        {c.canonicalName ?? c.sfAccountId}
                                        {c.projectName && (
                                          <div className="text-xs text-slate-400 mt-0.5">({c.projectName})</div>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {c.tier != null ? (
                                          <Badge variant="outline" className="text-xs">Tier {c.tier}</Badge>
                                        ) : (
                                          <span className="text-slate-400 text-xs">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-sm text-slate-600">
                                        {c.ownerName ?? <span className="text-slate-400">—</span>}
                                      </TableCell>
                                      <TableCell className="text-sm text-slate-600">{c.churnDate}</TableCell>
                                      <TableCell>
                                        {c.firstWarningAt !== 'none' ? (
                                          <Badge variant="destructive" className="text-xs">
                                            {c.firstWarningAt}
                                          </Badge>
                                        ) : (
                                          <span className="text-slate-400 text-xs">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                          {c.metabase.hadDownsell && (
                                            <Badge variant="secondary" className="text-xs">Downsell</Badge>
                                          )}
                                          {c.metabase.hadPriorChurnOnSameSfId && (
                                            <Badge variant="secondary" className="text-xs">別PJ解約</Badge>
                                          )}
                                          {c.metabase.hadTrialRegression && (
                                            <Badge variant="secondary" className="text-xs">Trial逆行</Badge>
                                          )}
                                          {!c.metabase.hasWarning && (
                                            <span className="text-slate-400 text-xs">—</span>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right text-sm tabular-nums text-slate-600">
                                        {c.metabase.earliestSignalDaysBefore != null
                                          ? `${c.metabase.earliestSignalDaysBefore}日前`
                                          : '—'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </section>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
