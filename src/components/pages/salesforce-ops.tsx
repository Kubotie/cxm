"use client";

// ─── Salesforce Ops 診断画面 ──────────────────────────────────────────────────
// GET /api/ops/salesforce/health を呼び出して接続状態を表示する。
// Config / Auth / Query の3ステップ結果を色分けカードで表示する。

import { useState, useCallback } from "react";
import { SidebarNav }   from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { Button }       from "@/components/ui/button";
import { Badge }        from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2, XCircle, Clock, RefreshCw, Loader2,
  Settings, KeyRound, Database, Zap, AlertTriangle,
} from "lucide-react";
import type { SalesforceHealthResult } from "@/app/api/ops/salesforce/health/route";

// ── ステータスバッジ ──────────────────────────────────────────────────────────

type StepStatus = 'ok' | 'error' | 'skipped' | 'missing';

function StatusBadge({ status }: { status: StepStatus }) {
  const map: Record<StepStatus, { label: string; cls: string }> = {
    ok:      { label: 'OK',      cls: 'bg-green-100 text-green-700 border-green-300' },
    error:   { label: 'ERROR',   cls: 'bg-red-100   text-red-700   border-red-300'   },
    skipped: { label: 'SKIPPED', cls: 'bg-slate-100 text-slate-500 border-slate-300' },
    missing: { label: 'MISSING', cls: 'bg-amber-100 text-amber-700 border-amber-300' },
  };
  const { label, cls } = map[status] ?? map.skipped;
  return (
    <Badge variant="outline" className={`text-xs font-mono ${cls}`}>{label}</Badge>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'ok')      return <CheckCircle2  className="w-4 h-4 text-green-500" />;
  if (status === 'error')   return <XCircle       className="w-4 h-4 text-red-500"   />;
  if (status === 'missing') return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return                           <Clock         className="w-4 h-4 text-slate-400" />;
}

// ── Overall バナー ────────────────────────────────────────────────────────────

function OverallBanner({ overall }: { overall: SalesforceHealthResult['overall'] }) {
  const map = {
    ok:      { label: '接続 OK — Salesforce と正常に通信できています',   cls: 'bg-green-50 border-green-200 text-green-800' },
    partial: { label: '一部エラー — 設定または認証に問題があります',       cls: 'bg-amber-50 border-amber-200 text-amber-800' },
    error:   { label: '接続エラー — 環境変数が未設定または認証に失敗しています', cls: 'bg-red-50   border-red-200   text-red-800'   },
  };
  const { label, cls } = map[overall];
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${cls}`}>
      {label}
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────────────────────

export function SalesforceOpsPage() {
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<SalesforceHealthResult | null>(null);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  const runDiagnostics = useCallback(async () => {
    setLoading(true);
    setFetchErr(null);
    try {
      const res = await fetch('/api/ops/salesforce/health');
      const data = await res.json() as SalesforceHealthResult;
      setResult(data);
    } catch (e) {
      setFetchErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto space-y-5">

            {/* ── ヘッダ ── */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Salesforce 接続診断
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  環境変数・認証・SOQL 疎通の3ステップを確認します
                </p>
              </div>
              <Button
                onClick={runDiagnostics}
                disabled={loading}
                size="sm"
                className="gap-2"
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <RefreshCw className="w-4 h-4" />
                }
                {loading ? '診断中...' : '診断を実行'}
              </Button>
            </div>

            {/* ── フェッチエラー ── */}
            {fetchErr && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                API エラー: {fetchErr}
              </div>
            )}

            {/* ── 結果 ── */}
            {result && (
              <div className="space-y-4">

                {/* Overall バナー */}
                <OverallBanner overall={result.overall} />

                {/* 実行時刻 */}
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  {new Date(result.checkedAt).toLocaleString('ja-JP')} に実行
                </p>

                {/* Step 1: Config */}
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Settings className="w-4 h-4 text-slate-500" />
                      Step 1 — 環境変数チェック
                      <StatusBadge status={result.config.status as StepStatus} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    {result.config.missing.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500">未設定の環境変数:</p>
                        {result.config.missing.map(v => (
                          <code key={v} className="block text-xs bg-red-50 text-red-700 px-2 py-1 rounded font-mono">
                            {v}
                          </code>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        2変数すべて設定済みです（Client Credentials Grant）。
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                      <div>
                        <span className="text-slate-400">Login URL: </span>
                        {result.config.loginUrl || '(未設定)'}
                      </div>
                      <div>
                        <span className="text-slate-400">API Version: </span>
                        {result.config.apiVersion}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Step 2: Auth */}
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-slate-500" />
                      Step 2 — Client Credentials 認証
                      <StepIcon status={result.auth.status as StepStatus} />
                      <StatusBadge status={result.auth.status as StepStatus} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 text-xs text-slate-600 space-y-1">
                    {result.auth.status === 'ok' && (
                      <p className="text-green-700">Client Credentials Grant によるアクセストークン取得に成功しました。</p>
                    )}
                    {result.auth.instanceUrl && (
                      <p>
                        <span className="text-slate-400">Resolved instance URL: </span>
                        {result.auth.instanceUrl}
                      </p>
                    )}
                    {result.auth.status === 'skipped' && (
                      <p className="text-slate-400">環境変数未設定のためスキップしました。</p>
                    )}
                    {result.auth.error && (
                      <pre className="bg-red-50 text-red-700 text-xs rounded p-2 whitespace-pre-wrap break-all">
                        {result.auth.error}
                      </pre>
                    )}
                  </CardContent>
                </Card>

                {/* Step 3: SOQL Query */}
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Database className="w-4 h-4 text-slate-500" />
                      Step 3 — SOQL 疎通確認
                      <StepIcon status={result.query.status as StepStatus} />
                      <StatusBadge status={result.query.status as StepStatus} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 text-xs text-slate-600 space-y-2">
                    <code className="block bg-slate-50 text-slate-700 px-2 py-1.5 rounded font-mono">
                      {result.query.soql}
                    </code>
                    {result.query.status === 'ok' && (
                      <p className="text-green-700">
                        クエリ成功。{result.query.resultCount} 件取得しました。
                      </p>
                    )}
                    {result.query.status === 'skipped' && (
                      <p className="text-slate-400">前のステップが失敗したためスキップしました。</p>
                    )}
                    {result.query.error && (
                      <pre className="bg-red-50 text-red-700 text-xs rounded p-2 whitespace-pre-wrap break-all">
                        {result.query.error}
                      </pre>
                    )}
                  </CardContent>
                </Card>

                {/* 次のアクションガイド */}
                {result.overall !== 'ok' && (
                  <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="px-4 py-4 text-xs text-amber-800 space-y-1">
                      <p className="font-medium">次のアクション:</p>
                      {result.config.missing.length > 0 && (
                        <p>
                          1. Vercel の Environment Variables に{' '}
                          <code className="font-mono bg-amber-100 px-1 rounded">
                            {result.config.missing.join(' / ')}
                          </code>{' '}
                          を追加して再デプロイしてください。
                        </p>
                      )}
                      {result.config.missing.length === 0 && result.auth.status === 'error' && (
                        <p>
                          2. Salesforce Connected App の設定を確認してください。<br />
                          grant_type=client_credentials が有効か、Consumer Key / Secret が正しいか確認してください。
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

              </div>
            )}

            {/* ── 未実行時のヒント ── */}
            {!result && !loading && !fetchErr && (
              <Card className="border-slate-200">
                <CardContent className="px-4 py-8 text-center text-slate-400 text-sm">
                  「診断を実行」ボタンを押して Salesforce 接続を確認してください
                </CardContent>
              </Card>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
