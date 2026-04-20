"use client";

// ─── SF 実接続前データ整備 Ops 画面 ──────────────────────────────────────────
// GET /api/ops/sf-data-prep/report を呼び出し、4つの観点でデータ品質を診断する:
//   1. sf_account_id 未設定企業
//   2. company_people フィールド品質
//   3. company_actions の owner が email 形式でないもの
//   4. Contact 名寄せ競合候補

import { useState, useCallback } from "react";
import { SidebarNav }   from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { Button }       from "@/components/ui/button";
import { Badge }        from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  RefreshCw, Loader2, AlertTriangle, CheckCircle2,
  Building2, Users, Zap, GitMerge, ChevronDown, ChevronRight,
} from "lucide-react";
import type {
  SfDataPrepReport, CompanyDataPrepItem, PeopleQualityMetrics,
  ActionOwnerIssue, ConflictCandidate,
} from "@/lib/salesforce/sf-data-prep-report";

// ── サマリーカード ─────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, accent,
}: {
  icon:   React.ElementType;
  label:  string;
  value:  number;
  accent: 'red' | 'amber' | 'slate';
}) {
  const clsMap = {
    red:   'text-red-600 bg-red-50 border-red-200',
    amber: 'text-amber-600 bg-amber-50 border-amber-200',
    slate: 'text-slate-600 bg-slate-50 border-slate-200',
  };
  const numCls = { red: 'text-red-700', amber: 'text-amber-700', slate: 'text-slate-700' };
  return (
    <div className={`rounded-lg border p-4 flex items-start gap-3 ${clsMap[accent]}`}>
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${numCls[accent]}`} />
      <div>
        <p className={`text-2xl font-bold ${numCls[accent]}`}>{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── People 品質バッジ ─────────────────────────────────────────────────────────

function PeopleQualityCell({ q }: { q: PeopleQualityMetrics }) {
  if (q.total === 0) return <span className="text-xs text-slate-300">—</span>;
  if (!q.hasIssue) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <CheckCircle2 className="w-3.5 h-3.5" /> OK
      </span>
    );
  }
  const issues: string[] = [];
  if (q.noEmail      > 0) issues.push(`email×${q.noEmail}`);
  if (q.noInfluence  > 0) issues.push(`inf×${q.noInfluence}`);
  if (q.noTouchpoint > 0) issues.push(`tp×${q.noTouchpoint}`);
  if (q.noOwner      > 0) issues.push(`owner×${q.noOwner}`);
  if (q.noManagerId  > 0 && q.total >= 2) issues.push(`mgr×${q.noManagerId}`);
  return (
    <div className="flex flex-wrap gap-1">
      {issues.map(i => (
        <span key={i} className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 rounded px-1.5 py-0.5 font-mono">
          {i}
        </span>
      ))}
    </div>
  );
}

// ── 展開詳細行 ────────────────────────────────────────────────────────────────

function CompanyDetailRow({ item }: { item: CompanyDataPrepItem }) {
  return (
    <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 space-y-3 text-xs">

      {/* People 品質 */}
      {item.peopleQuality.total > 0 && item.peopleQuality.hasIssue && (
        <div>
          <p className="font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> People 未整備 ({item.peopleQuality.total}名)
          </p>
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {[
              { key: 'email 未設定',       v: item.peopleQuality.noEmail      },
              { key: 'influence 未分類',    v: item.peopleQuality.noInfluence  },
              { key: 'touchpoint 未記録',   v: item.peopleQuality.noTouchpoint },
              { key: 'owner 未設定',        v: item.peopleQuality.noOwner      },
              { key: 'manager_id 未設定',   v: item.peopleQuality.noManagerId  },
            ].map(({ key, v }) => v > 0 && (
              <div key={key} className="bg-white border border-amber-200 rounded p-1.5">
                <p className="text-base font-bold text-amber-600">{v}</p>
                <p className="text-[10px] text-slate-400 leading-tight">{key}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action owner 問題 */}
      {item.actionOwnerIssues.length > 0 && (
        <div>
          <p className="font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> Action owner が非メール形式 ({item.actionOwnerIssues.length}件)
          </p>
          <div className="space-y-1">
            {item.actionOwnerIssues.map((issue: ActionOwnerIssue) => (
              <div key={issue.actionId} className="flex items-center gap-2 bg-white border border-red-200 rounded px-2 py-1">
                <span className="flex-1 text-slate-700 truncate">{issue.title}</span>
                <code className="text-red-600 text-[10px] bg-red-50 px-1.5 py-0.5 rounded font-mono">{issue.owner}</code>
                <span className="text-[10px] text-slate-400">→ メールアドレス形式が必要</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 競合候補 */}
      {item.conflictCandidates.length > 0 && (
        <div>
          <p className="font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
            <GitMerge className="w-3.5 h-3.5" /> 名寄せ競合候補 ({item.conflictCandidates.length}件)
          </p>
          <div className="space-y-1.5">
            {item.conflictCandidates.map((c: ConflictCandidate, i: number) => (
              <div key={i} className="bg-white border border-violet-200 rounded px-2 py-1.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                    c.type === 'sf_cxm_same_email' ? 'bg-violet-50 border-violet-200 text-violet-700' :
                    c.type === 'duplicate_email'   ? 'bg-red-50 border-red-200 text-red-700' :
                    'bg-amber-50 border-amber-200 text-amber-700'
                  }`}>
                    {c.type === 'sf_cxm_same_email' ? 'SF/CXM重複email'
                      : c.type === 'duplicate_email' ? '同一email重複'
                      : '類似名'}
                  </span>
                  <span className="text-slate-500 text-[10px]">{c.detail}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {c.persons.map((p, pi) => (
                    <span key={pi} className="text-[10px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                      {p.name}
                      <span className="ml-1 text-slate-400">({p.source})</span>
                      {p.email && <span className="ml-1 text-slate-400 font-mono">{p.email}</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 問題なし */}
      {!item.peopleQuality.hasIssue && item.actionOwnerIssues.length === 0 && item.conflictCandidates.length === 0 && (
        <p className="text-green-600 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> 整備済み（People / Action / 競合候補すべて問題なし）
        </p>
      )}
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────────────────────

export function SfDataPrepOpsPage() {
  const [loading,    setLoading]    = useState(false);
  const [report,     setReport]     = useState<SfDataPrepReport | null>(null);
  const [fetchErr,   setFetchErr]   = useState<string | null>(null);
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<'all' | 'issues_only'>('issues_only');

  const runReport = useCallback(async () => {
    setLoading(true);
    setFetchErr(null);
    setExpanded(new Set());
    try {
      const res  = await fetch('/api/ops/sf-data-prep/report');
      const data = await res.json() as SfDataPrepReport;
      setReport(data);
    } catch (e) {
      setFetchErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleExpand = (uid: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const displayItems = report
    ? filterMode === 'issues_only'
      ? report.items.filter(i => i.issueScore > 0)
      : report.items
    : [];

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-5xl mx-auto space-y-5">

            {/* ── ヘッダ ── */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-slate-500" />
                  SF 実接続前データ整備
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  sf_account_id / People / Action owner / 名寄せ競合の4観点でデータ品質を診断します
                </p>
              </div>
              <Button onClick={runReport} disabled={loading} size="sm" className="gap-2">
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <RefreshCw className="w-4 h-4" />
                }
                {loading ? '診断中...' : 'レポートを生成'}
              </Button>
            </div>

            {/* ── エラー ── */}
            {fetchErr && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {fetchErr}
              </div>
            )}

            {/* ── 結果 ── */}
            {report && (
              <div className="space-y-5">

                {/* サマリーカード */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard icon={Building2} label="sf_account_id 未設定"      value={report.missingSfId}               accent="red"   />
                  <StatCard icon={Users}     label="People 品質問題あり企業"     value={report.companiesWithPeopleIssues} accent="amber" />
                  <StatCard icon={Zap}       label="Action owner 非メール形式"   value={report.totalActionOwnerIssues}    accent="amber" />
                  <StatCard icon={GitMerge}  label="名寄せ競合候補"              value={report.totalConflictCandidates}   accent="slate" />
                </div>

                {/* 実行日時 + フィルタ */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    {new Date(report.generatedAt).toLocaleString('ja-JP')} 時点 / {report.totalCompanies} 社対象
                  </p>
                  <div className="flex gap-1">
                    {(['issues_only', 'all'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setFilterMode(mode)}
                        className={`text-xs px-3 py-1 rounded border transition-colors ${
                          filterMode === mode
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {mode === 'issues_only' ? `問題あり (${report.items.filter(i => i.issueScore > 0).length})` : `全件 (${report.items.length})`}
                      </button>
                    ))}
                  </div>
                </div>

                {displayItems.length === 0 ? (
                  <Card>
                    <CardContent className="px-4 py-8 text-center text-green-600 text-sm flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      問題は見つかりませんでした
                    </CardContent>
                  </Card>
                ) : (

                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          <TableHead className="text-xs">企業名</TableHead>
                          <TableHead className="text-xs w-40">sf_account_id</TableHead>
                          <TableHead className="text-xs">People 品質</TableHead>
                          <TableHead className="text-xs w-24 text-center">Action owner</TableHead>
                          <TableHead className="text-xs w-20 text-center">競合候補</TableHead>
                          <TableHead className="text-xs w-16 text-center">スコア</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayItems.map(item => (
                          <>
                            <TableRow
                              key={item.companyUid}
                              className={`cursor-pointer hover:bg-slate-50 ${expanded.has(item.companyUid) ? 'bg-slate-50' : ''}`}
                              onClick={() => toggleExpand(item.companyUid)}
                            >
                              <TableCell className="py-2 pl-4">
                                {expanded.has(item.companyUid)
                                  ? <ChevronDown  className="w-3.5 h-3.5 text-slate-400" />
                                  : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                }
                              </TableCell>
                              <TableCell className="py-2">
                                <span className="text-sm font-medium text-slate-800">{item.name}</span>
                                <span className="ml-2 text-[10px] text-slate-400 font-mono">{item.companyUid}</span>
                              </TableCell>
                              <TableCell className="py-2">
                                {item.sfCompanyId
                                  ? <code className="text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded">{item.sfCompanyId}</code>
                                  : <Badge variant="outline" className="text-[10px] text-red-600 bg-red-50 border-red-200">未設定</Badge>
                                }
                              </TableCell>
                              <TableCell className="py-2">
                                <PeopleQualityCell q={item.peopleQuality} />
                              </TableCell>
                              <TableCell className="py-2 text-center">
                                {item.actionOwnerIssues.length > 0
                                  ? <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200">{item.actionOwnerIssues.length}件</Badge>
                                  : <span className="text-xs text-slate-300">—</span>
                                }
                              </TableCell>
                              <TableCell className="py-2 text-center">
                                {item.conflictCandidates.length > 0
                                  ? <Badge variant="outline" className="text-[10px] text-violet-700 bg-violet-50 border-violet-200">{item.conflictCandidates.length}件</Badge>
                                  : <span className="text-xs text-slate-300">—</span>
                                }
                              </TableCell>
                              <TableCell className="py-2 text-center">
                                <span className={`text-xs font-mono font-semibold ${
                                  item.issueScore >= 20 ? 'text-red-600' :
                                  item.issueScore >= 10 ? 'text-amber-600' : 'text-slate-500'
                                }`}>
                                  {item.issueScore}
                                </span>
                              </TableCell>
                            </TableRow>

                            {/* 展開詳細行 */}
                            {expanded.has(item.companyUid) && (
                              <TableRow key={`${item.companyUid}-detail`}>
                                <TableCell colSpan={7} className="p-0">
                                  <CompanyDetailRow item={item} />
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}

                {/* 凡例 */}
                <Card className="border-slate-100">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-xs font-semibold text-slate-500">スコア凡例</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-500">
                    <span>sf_account_id 未設定: +10点</span>
                    <span>名寄せ競合候補 1件: +8点</span>
                    <span>Action owner 非メール 1件: +5点</span>
                    <span>email 未設定 1人: +3点</span>
                    <span>influence 未分類 1人: +2点</span>
                    <span className="text-red-500">20点以上: 赤 / 10点以上: 橙</span>
                  </CardContent>
                </Card>

              </div>
            )}

            {/* 未実行時ヒント */}
            {!report && !loading && !fetchErr && (
              <Card className="border-slate-200">
                <CardContent className="px-4 py-8 text-center text-slate-400 text-sm space-y-2">
                  <p>「レポートを生成」ボタンを押してデータ品質を診断してください</p>
                  <p className="text-xs">対象: CSM管理企業 (is_csm_managed=true) 最大200社</p>
                </CardContent>
              </Card>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
