"use client";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { TrendingDown, Sparkles, Loader2, AlertCircle, RefreshCw, Calendar, Building2, HelpCircle, Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

/**
 * 次回の自動更新日時 (次の月曜 04:00 JST) を計算する。
 * cron: "0 19 * * 0" = 日曜 19:00 UTC = 月曜 04:00 JST
 */
function computeNextWeeklyRun(now: Date): Date {
  // JST 基準で計算し、翌月曜 04:00 JST を求める
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffsetMs);
  const dayJst = jstNow.getUTCDay(); // 0=日 1=月 ... 6=土
  const hourJst = jstNow.getUTCHours();

  // 「次の月曜 04:00 JST」までの日数
  let daysToAdd: number;
  if (dayJst === 1 && hourJst < 4) {
    daysToAdd = 0; // 今日の月曜 04:00 がまだ先
  } else if (dayJst === 1) {
    daysToAdd = 7; // 月曜だが 04:00 過ぎ → 来週
  } else {
    daysToAdd = (1 - dayJst + 7) % 7; // 次の月曜まで
    if (daysToAdd === 0) daysToAdd = 7;
  }

  const nextJst = new Date(Date.UTC(
    jstNow.getUTCFullYear(),
    jstNow.getUTCMonth(),
    jstNow.getUTCDate() + daysToAdd,
    4, 0, 0, 0,
  ));
  return new Date(nextJst.getTime() - jstOffsetMs); // UTC に戻す
}

function formatNextRun(d: Date): string {
  return d.toLocaleString('ja-JP', {
    month:   '2-digit',
    day:     '2-digit',
    weekday: 'short',
    hour:    '2-digit',
    minute:  '2-digit',
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
  const [helpOpen, setHelpOpen]               = useState(false);

  const nextRunLabel = useMemo(() => formatNextRun(computeNextWeeklyRun(new Date())), []);

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
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <TrendingDown className="w-6 h-6 text-slate-600" />
                  <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    解約遡及分析
                  </h1>
                  <Badge variant="outline" className="text-xs">週次 AI レポート</Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5 ml-9">
                  <Clock className="w-3 h-3" />
                  次回自動更新: <span className="font-medium text-slate-600 dark:text-slate-400">{nextRunLabel}</span>
                  <span className="text-slate-400">(毎週月曜 04:00 JST)</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-800" aria-label="このページの読み方">
                      <HelpCircle className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-blue-500" />
                        このページの読み方
                      </DialogTitle>
                      <DialogDescription className="text-xs text-slate-500">
                        解約遡及分析の見方・専門用語の解説
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 text-sm text-slate-700 dark:text-slate-300">
                      <section>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">分析の目的</h3>
                        <p className="text-sm leading-relaxed">
                          過去 90 日間に解約 (Package-Churn) した企業について、
                          <span className="font-medium">解約前にどんな予兆シグナルが出ていたか</span>を遡って確認するレポートです。
                          「拾えていれば防げたかもしれない解約」を可視化し、次に同じパターンを見逃さないための材料にします。
                        </p>
                      </section>

                      <section>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">予兆シグナルは 2 種類</h3>

                        <div className="rounded border border-slate-200 dark:border-slate-800 p-3 mb-2">
                          <div className="font-medium text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
                            <Badge variant="destructive" className="text-xs">Snapshot 予兆</Badge>
                            日次スナップショット由来
                          </div>
                          <p className="text-xs leading-relaxed mb-2 text-slate-600 dark:text-slate-400">
                            毎日記録している「企業の状態」から検知。解約日の 30/60/90 日前のスナップショットを見て、以下いずれかが立っていれば予兆あり。
                          </p>
                          <ul className="text-xs space-y-0.5 ml-3 text-slate-600 dark:text-slate-400">
                            <li>• <code className="text-[11px]">overall_health</code> が <code>at_risk</code> または <code>critical</code></li>
                            <li>• <code className="text-[11px]">stalled_project_count</code> が 1 以上（停滞プロジェクトあり）</li>
                            <li>• <code className="text-[11px]">open_support_count</code> が 1 以上（未解決サポート案件あり）</li>
                          </ul>
                          <p className="text-xs mt-2 text-slate-500">
                            表示: <code className="text-[11px]">d30 / d60 / d90</code> = 解約日から 30/60/90 日前で最初に予兆が立った時点
                          </p>
                        </div>

                        <div className="rounded border border-slate-200 dark:border-slate-800 p-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">Metabase 予兆</Badge>
                            Package Events 由来
                          </div>
                          <p className="text-xs leading-relaxed mb-2 text-slate-600 dark:text-slate-400">
                            Metabase の契約イベントログから検知。解約日より前の 90 日間に以下のイベントがあれば予兆あり。
                          </p>
                          <ul className="text-xs space-y-0.5 ml-3 text-slate-600 dark:text-slate-400">
                            <li>• <span className="font-medium">Downsell</span> — プラン格下げ</li>
                            <li>• <span className="font-medium">Trial 逆行</span> — 有料からトライアルへ戻る</li>
                            <li>• <span className="font-medium">別 PJ 解約</span> — 同 SF アカウント内で別プロジェクトが先に解約</li>
                          </ul>
                        </div>
                      </section>

                      <section>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">リードタイム</h3>
                        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          予兆イベントが起きてから解約日までの日数。
                          <span className="font-medium text-slate-800 dark:text-slate-200"> 値が大きいほど早期に検知できていた</span>ことを意味し、CSM が介入する余地が大きかったケースです。
                          値が小さい (14 日以内など) は「気付いた時にはもう遅かった」パターン。
                        </p>
                      </section>

                      <section>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">読み方の手順</h3>
                        <ol className="text-xs space-y-1.5 text-slate-600 dark:text-slate-400 list-decimal ml-5">
                          <li><span className="font-medium text-slate-800 dark:text-slate-200">総括</span> で今週の全体状況を把握する（1〜2 分）</li>
                          <li><span className="font-medium text-slate-800 dark:text-slate-200">発見事項</span> で個別の異常パターン・注目社を確認する</li>
                          <li><span className="font-medium text-slate-800 dark:text-slate-200">推奨アクション</span> から今週着手すべきものを CSM チームで分担</li>
                          <li><span className="font-medium text-slate-800 dark:text-slate-200">予兆企業テーブル</span> で具体社名と予兆種別を確認、必要なら深掘り追跡</li>
                        </ol>
                      </section>

                      <section>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">更新頻度</h3>
                        <ul className="text-xs space-y-0.5 text-slate-600 dark:text-slate-400 ml-3">
                          <li>• <span className="font-medium">毎週月曜 04:00 JST</span> に自動生成（Vercel Cron）</li>
                          <li>• 右上の「<span className="font-medium">今すぐ生成</span>」で手動生成も可能（約 45 秒）</li>
                          <li>• 過去のレポートは左サイドバーから履歴として参照可能</li>
                        </ul>
                      </section>

                      <section>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">データソース</h3>
                        <ul className="text-xs space-y-0.5 text-slate-600 dark:text-slate-400 ml-3">
                          <li>• 解約イベント: Metabase Package-Churn CSV（Ptengine BI）</li>
                          <li>• Snapshot 予兆: NocoDB <code>company_daily_snapshot</code>（Deep/Light batch が日次記録）</li>
                          <li>• Metabase 予兆: Metabase Package Events（Downsell / Trial / 先行 Churn）</li>
                          <li>• AI サマリー: Claude Sonnet 4.5 (OpenRouter)</li>
                        </ul>
                      </section>
                    </div>
                  </DialogContent>
                </Dialog>
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
