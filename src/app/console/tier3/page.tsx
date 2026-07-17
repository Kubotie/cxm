"use client";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Layers, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LightWatchItem, LightWatchResponse } from "@/app/api/companies/light-watch/route";

type SortKey = 'name' | 'tier' | 'mrr' | 'openSupport' | 'renewal' | 'lastContact';
type SortDir = 'asc' | 'desc';

function formatMrr(mrr: number | null): string {
  if (mrr == null) return '—';
  return `¥${mrr.toLocaleString('ja-JP')}`;
}

function renewalBadge(bucket: string | null) {
  if (!bucket) return <span className="text-slate-400 text-xs">—</span>;
  const variant = bucket === 'expired' ? 'destructive'
    : bucket === '0-30' ? 'destructive'
    : bucket === '31-90' ? 'secondary'
    : 'outline';
  return <Badge variant={variant} className="text-xs">{bucket}</Badge>;
}

function tierBadge(tier: 1 | 2 | 3 | 5 | null, isPaidWatched: boolean) {
  if (tier === 3) return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs">Tier 3</Badge>;
  if (tier === 5) return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-xs">Tier 5</Badge>;
  if (isPaidWatched) return <Badge variant="outline" className="text-xs text-slate-600">有料監視</Badge>;
  return <span className="text-slate-400 text-xs">—</span>;
}

export default function Tier3Page() {
  const [data, setData]         = useState<LightWatchResponse | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'tier3' | 'paid'>('all');
  const [sortKey, setSortKey]   = useState<SortKey>('mrr');
  const [sortDir, setSortDir]   = useState<SortDir>('desc');

  useEffect(() => {
    fetch('/api/companies/light-watch?limit=2000')
      .then(r => r.ok ? r.json() as Promise<LightWatchResponse> : Promise.reject(new Error(String(r.status))))
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.items.filter(it => {
      if (tierFilter === 'tier3' && it.tier !== 3) return false;
      if (tierFilter === 'paid'  && !(it.isPaidWatched && it.tier == null)) return false;
      if (q && !it.canonicalName.toLowerCase().includes(q) && !it.owner.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, query, tierFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const av: string | number = sortKey === 'name'        ? a.canonicalName
                                : sortKey === 'tier'        ? (a.tier ?? 99)
                                : sortKey === 'mrr'         ? (a.mrr ?? -1)
                                : sortKey === 'openSupport' ? (a.openSupportCount ?? -1)
                                : sortKey === 'renewal'     ? (a.renewalDate ?? '')
                                :                             (a.lastContact ?? '');
      const bv: string | number = sortKey === 'name'        ? b.canonicalName
                                : sortKey === 'tier'        ? (b.tier ?? 99)
                                : sortKey === 'mrr'         ? (b.mrr ?? -1)
                                : sortKey === 'openSupport' ? (b.openSupportCount ?? -1)
                                : sortKey === 'renewal'     ? (b.renewalDate ?? '')
                                :                             (b.lastContact ?? '');
      if (av < bv) return -1 * dir;
      if (av > bv) return  1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir(k === 'name' ? 'asc' : 'desc'); }
  };

  const sortIcon = (k: SortKey) => sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div className="flex min-h-screen">
      <SidebarNav />
      <div className="flex-1 flex flex-col">
        <GlobalHeader />
        <main className="flex-1 p-6 overflow-x-auto">
          <div className="max-w-[1400px] mx-auto space-y-4">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Layers className="w-6 h-6 text-slate-600" />
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  Tier 3 / 有料自動監視
                </h1>
              </div>
              {data && (
                <div className="text-sm text-slate-500">
                  合計 <span className="font-semibold text-slate-800 dark:text-slate-200">{data.total}</span> 社
                  <span className="mx-2">·</span>
                  Tier 3: <span className="font-semibold">{data.byTier.tier3}</span>
                  <span className="mx-2">·</span>
                  有料自動監視: <span className="font-semibold">{data.byTier.paidUntagged}</span>
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="text"
                placeholder="会社名 / 担当で検索..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="max-w-xs"
              />
              <div className="flex gap-1">
                {[
                  { v: 'all',   l: 'すべて'          },
                  { v: 'tier3', l: 'Tier 3 のみ'    },
                  { v: 'paid',  l: '有料自動監視のみ' },
                ].map(t => (
                  <button
                    key={t.v}
                    onClick={() => setTierFilter(t.v as 'all' | 'tier3' | 'paid')}
                    className={`px-3 py-1 text-xs rounded border transition
                      ${tierFilter === t.v
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'
                      }`}
                  >
                    {t.l}
                  </button>
                ))}
              </div>
              <div className="ml-auto text-xs text-slate-500">
                表示: <span className="font-semibold">{sorted.length}</span> 社
              </div>
            </div>

            {/* States */}
            {loading && (
              <div className="flex items-center gap-2 text-slate-500 py-10 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                読み込み中...
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-red-600 py-4 px-4 bg-red-50 dark:bg-red-950/30 rounded">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">読み込みに失敗しました: {error}</span>
              </div>
            )}

            {/* Table */}
            {data && !loading && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer" onClick={() => toggleSort('name')}>
                        会社名{sortIcon('name')}
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => toggleSort('tier')}>
                        分類{sortIcon('tier')}
                      </TableHead>
                      <TableHead>担当</TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('mrr')}>
                        MRR{sortIcon('mrr')}
                      </TableHead>
                      <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('openSupport')}>
                        Open Support{sortIcon('openSupport')}
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => toggleSort('renewal')}>
                        契約更新{sortIcon('renewal')}
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => toggleSort('lastContact')}>
                        最終接触{sortIcon('lastContact')}
                      </TableHead>
                      <TableHead className="text-right">スナップショット</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                          該当する企業がありません
                        </TableCell>
                      </TableRow>
                    )}
                    {sorted.map(item => (
                      <TableRow key={item.companyUid}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/companies/${item.companyUid}`}
                            className="text-slate-900 dark:text-slate-100 hover:text-blue-600 hover:underline"
                          >
                            {item.canonicalName}
                          </Link>
                        </TableCell>
                        <TableCell>{tierBadge(item.tier, item.isPaidWatched)}</TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400 text-sm">
                          {item.owner === '—' ? <span className="text-slate-400">—</span> : item.owner}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMrr(item.mrr)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.openSupportCount != null && item.openSupportCount > 0 ? (
                            <Badge variant={item.openSupportCount >= 3 ? 'destructive' : 'secondary'} className="text-xs">
                              {item.openSupportCount}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {renewalBadge(item.renewalBucket)}
                          {item.renewalDate && (
                            <div className="text-xs text-slate-400 mt-0.5">{item.renewalDate}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400 text-sm">
                          {item.lastContact === '—' ? <span className="text-slate-400">—</span> : item.lastContact}
                        </TableCell>
                        <TableCell className="text-right text-xs text-slate-400">
                          {item.snapshotDate ?? '未取得'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Footer note */}
            <p className="text-xs text-slate-400 mt-4">
              Tier 3 は Metabase Tier マスターで指定された標準管理顧客、有料自動監視は Metabase 有料契約リストから自動タグ付けされた企業です。
              毎日 03:30 JST に Light snapshot batch がシグナルを更新します。
            </p>

          </div>
        </main>
      </div>
    </div>
  );
}
