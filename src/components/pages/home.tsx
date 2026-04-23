"use client";

// ─── Home ページ（変動コックピット）────────────────────────────────────────────
// 担当ポートフォリオの変動を把握し、今週の方針を決める画面
//
// Section 1: 今週の優先アクション（ヒーロー） + MRR サマリー
// Section 2: 変化サマリー 2段 × 4列
//   Tier 1 — 今日の変化（前日差分ベース）: 健全度悪化 / サポート増加 / 更新30日入り / フェーズ変化
//   Tier 2 — 今週の文脈（現況+週次）: 健全度リスク / 更新間近30日 / 週次悪化 / 拡大機会
// Section 3: ポートフォリオ分布（補助）
//
// データソース: /api/company-summary-list?limit=500&sort=priority_desc

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  RefreshCw, AlertTriangle,
  Headphones, TrendingUp, ArrowRight,
  Building2, Calendar,
  TrendingDown, GitBranch,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { SidebarNav }     from "@/components/layout/sidebar-nav";
import { GlobalHeader }   from "@/components/layout/global-header";
import { Badge }          from "@/components/ui/badge";
import { Button }         from "@/components/ui/button";
import { Skeleton }       from "@/components/ui/skeleton";
import { AlertBox }       from "@/components/ui/alert-box";
import { getHealthBadge } from "@/lib/company/badges";
import { priorityReason } from "@/lib/company/priority-reason";
import type { CompanyListItemVM } from "@/lib/company/company-vm";

function apiFetch(path: string) {
  return fetch(path, { headers: { "Content-Type": "application/json" } });
}

// ── MRR フォーマット ─────────────────────────────────────────────────────────

function formatMrr(yen: number): string {
  if (yen >= 100_000_000) return `¥${(yen / 100_000_000).toFixed(1)}億`;
  if (yen >= 10_000)      return `¥${Math.round(yen / 10_000).toLocaleString()}万`;
  return `¥${yen.toLocaleString()}`;
}

// ── Company List への URL ─────────────────────────────────────────────────────

function listUrl(segment: string): string {
  return `/companies?segment=${segment}`;
}

// ── Snapshot 差分グループ定義 ─────────────────────────────────────────────────

interface DiffGroup {
  id:               string;
  label:            string;
  icon:             React.ReactNode;
  count:            number;
  items:            CompanyListItemVM[];
  segment:          string;
  iconColor:        string;
  bgClass:          string;
  borderColor:      string;
  accentColor:      string;
  renderDetail:     (item: CompanyListItemVM) => string | null;
}

function buildTrendGroups(all: CompanyListItemVM[]): DiffGroup[] {
  return [
    {
      id: "trendWeeklyWorsened", label: "健全度悪化（週）",
      icon: <TrendingDown className="w-3.5 h-3.5" />,
      count: all.filter(i => i.snapshotDiff?.weeklyHealthWorsened === true).length,
      items: all.filter(i => i.snapshotDiff?.weeklyHealthWorsened === true).slice(0, 3),
      segment: "weekly_worsened",
      iconColor: "text-red-600", bgClass: "bg-red-50",
      borderColor: "border-red-200", accentColor: "border-l-red-500",
      renderDetail: i => i.snapshotDiff?.weeklyHealthTransition ?? null,
    },
    {
      id: "trendWeeklyActivated", label: "健全化（週）",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      count: all.filter(i => i.snapshotDiff?.weeklyActivated === true).length,
      items: all.filter(i => i.snapshotDiff?.weeklyActivated === true).slice(0, 3),
      segment: "weekly_activated",
      iconColor: "text-emerald-600", bgClass: "bg-emerald-50",
      borderColor: "border-emerald-200", accentColor: "border-l-emerald-500",
      renderDetail: i => i.snapshotDiff?.weeklyHealthTransition ?? null,
    },
    {
      id: "trendMonthlyRenewal", label: "更新接近（月）",
      icon: <Calendar className="w-3.5 h-3.5" />,
      count: all.filter(i => i.snapshotDiff?.monthlyRenewalEntered === true).length,
      items: all.filter(i => i.snapshotDiff?.monthlyRenewalEntered === true).slice(0, 3),
      segment: "monthly_renewal_entered",
      iconColor: "text-orange-600", bgClass: "bg-orange-50",
      borderColor: "border-orange-200", accentColor: "border-l-orange-500",
      renderDetail: i => i.renewalDaysLeft != null ? `あと${i.renewalDaysLeft}日` : null,
    },
    {
      id: "trendMonthlyMrrInc", label: "MRR増加（月）",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      count: all.filter(i => i.snapshotDiff?.monthlyMrrIncreased === true).length,
      items: all.filter(i => i.snapshotDiff?.monthlyMrrIncreased === true).slice(0, 3),
      segment: "monthly_mrr_increased",
      iconColor: "text-emerald-600", bgClass: "bg-emerald-50",
      borderColor: "border-emerald-200", accentColor: "border-l-emerald-500",
      renderDetail: i => {
        const d = i.snapshotDiff?.monthlyMrrDelta;
        return d != null && d > 0 ? `+${formatMrr(d)}` : null;
      },
    },
    {
      id: "trendMonthlyMrrDec", label: "MRR減少（月）",
      icon: <TrendingDown className="w-3.5 h-3.5" />,
      count: all.filter(i => i.snapshotDiff?.monthlyMrrDecreased === true).length,
      items: all.filter(i => i.snapshotDiff?.monthlyMrrDecreased === true).slice(0, 3),
      segment: "monthly_mrr_decreased",
      iconColor: "text-red-600", bgClass: "bg-red-50",
      borderColor: "border-red-200", accentColor: "border-l-red-500",
      renderDetail: i => {
        const d = i.snapshotDiff?.monthlyMrrDelta;
        return d != null && d < 0 ? `-${formatMrr(Math.abs(d))}` : null;
      },
    },
  ];
}

function buildDiffGroups(all: CompanyListItemVM[]): DiffGroup[] {
  const phaseChg    = all.filter(i => i.snapshotDiff?.phaseChanged === true);
  const entered30   = all.filter(i => i.snapshotDiff?.renewalEnteredThirty === true);
  const entered90   = all.filter(i => i.snapshotDiff?.renewalEnteredNinety === true);
  const suppInc     = all.filter(i => i.snapshotDiff?.supportIncreased === true);
  const mrrDec      = all.filter(i => i.snapshotDiff?.mrrDecreased === true);
  const mrrInc      = all.filter(i => i.snapshotDiff?.mrrIncreased === true);

  return [
    {
      id: "diffPhase", label: "フェーズ変化",
      icon: <GitBranch className="w-3.5 h-3.5" />,
      count: phaseChg.length, items: phaseChg.slice(0, 3), segment: "phase_changed",
      iconColor: "text-violet-600", bgClass: "bg-violet-50",
      borderColor: "border-violet-200", accentColor: "border-l-violet-500",
      renderDetail: i => {
        const prev = i.snapshotDiff?.previousMPhase;
        return prev ? `${prev} → ${i.activePhaseLabel ?? "?"}` : null;
      },
    },
    {
      id: "diffRenewal30", label: "更新30日入り",
      icon: <Calendar className="w-3.5 h-3.5" />,
      count: entered30.length, items: entered30.slice(0, 3), segment: "renewal_entered_30",
      iconColor: "text-rose-600", bgClass: "bg-rose-50",
      borderColor: "border-rose-200", accentColor: "border-l-rose-500",
      renderDetail: i => i.renewalDaysLeft != null ? `あと${i.renewalDaysLeft}日` : null,
    },
    {
      id: "diffRenewal90", label: "更新90日入り",
      icon: <Calendar className="w-3.5 h-3.5" />,
      count: entered90.length, items: entered90.slice(0, 3), segment: "renewal_entered_90",
      iconColor: "text-orange-500", bgClass: "bg-orange-50",
      borderColor: "border-orange-200", accentColor: "border-l-orange-400",
      renderDetail: i => i.renewalDaysLeft != null ? `あと${i.renewalDaysLeft}日` : null,
    },
    {
      id: "diffSupport", label: "サポート増加",
      icon: <Headphones className="w-3.5 h-3.5" />,
      count: suppInc.length, items: suppInc.slice(0, 3), segment: "support_increased",
      iconColor: "text-amber-600", bgClass: "bg-amber-50",
      borderColor: "border-amber-200", accentColor: "border-l-amber-500",
      renderDetail: i => {
        const d = i.snapshotDiff?.supportDelta;
        return d != null && d > 0 ? `+${d}件` : null;
      },
    },
    {
      id: "diffMrrDec", label: "MRR 減少",
      icon: <TrendingDown className="w-3.5 h-3.5" />,
      count: mrrDec.length, items: mrrDec.slice(0, 3), segment: "mrr_decreased",
      iconColor: "text-red-600", bgClass: "bg-red-50",
      borderColor: "border-red-200", accentColor: "border-l-red-500",
      renderDetail: i => {
        const d = i.snapshotDiff?.mrrDelta;
        return d != null && d < 0 ? `-${formatMrr(Math.abs(d))}` : null;
      },
    },
    {
      id: "diffMrrInc", label: "MRR 増加",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      count: mrrInc.length, items: mrrInc.slice(0, 3), segment: "mrr_increased",
      iconColor: "text-emerald-600", bgClass: "bg-emerald-50",
      borderColor: "border-emerald-200", accentColor: "border-l-emerald-500",
      renderDetail: i => {
        const d = i.snapshotDiff?.mrrDelta;
        return d != null && d > 0 ? `+${formatMrr(d)}` : null;
      },
    },
    {
      id: "diffHealthDec", label: "健全度 悪化",
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      count: all.filter(i => i.snapshotDiff?.healthWorsened === true).length,
      items: all.filter(i => i.snapshotDiff?.healthWorsened === true).slice(0, 3),
      segment: "health_worsened",
      iconColor: "text-red-600", bgClass: "bg-red-50",
      borderColor: "border-red-200", accentColor: "border-l-red-500",
      renderDetail: i => i.snapshotDiff?.healthTransition ?? null,
    },
    {
      id: "diffHealthInc", label: "健全度 改善",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      count: all.filter(i => i.snapshotDiff?.healthImproved === true).length,
      items: all.filter(i => i.snapshotDiff?.healthImproved === true).slice(0, 3),
      segment: "health_improved",
      iconColor: "text-emerald-600", bgClass: "bg-emerald-50",
      borderColor: "border-emerald-200", accentColor: "border-l-emerald-500",
      renderDetail: i => i.snapshotDiff?.healthTransition ?? null,
    },
  ];
}

// ── DiffTile ──────────────────────────────────────────────────────────────────

function DiffTile({ group }: { group: DiffGroup }) {
  const hasData = group.count > 0;
  const containerCls = hasData
    ? `${group.bgClass} ${group.borderColor} border-l-[3px] ${group.accentColor}`
    : "bg-white border-slate-100";

  return (
    <div className={`flex flex-col gap-1.5 p-3 rounded-xl border transition-all ${containerCls}`}>
      <div className="flex items-center justify-between gap-1">
        <Link
          href={listUrl(group.segment)}
          className={`flex items-center gap-1 hover:opacity-75 transition-opacity min-w-0 ${hasData ? group.iconColor : "text-slate-400"}`}
        >
          {group.icon}
          <span className="text-[11px] font-semibold text-slate-700 truncate">{group.label}</span>
          {hasData && <ArrowRight className="w-2.5 h-2.5 opacity-40 flex-shrink-0" />}
        </Link>
        <Link
          href={listUrl(group.segment)}
          className={`text-lg font-bold leading-none tabular-nums flex-shrink-0 hover:opacity-75 ${hasData ? group.iconColor : "text-slate-200"}`}
        >
          {group.count}
        </Link>
      </div>

      <div className="flex flex-col gap-0.5 min-h-[36px] justify-end">
        {hasData ? (
          <>
            {group.items.map(item => {
              const detail = group.renderDetail(item);
              return (
                <Link
                  key={item.companyUid}
                  href={`/companies/${item.companyUid}`}
                  className="text-[10px] text-slate-600 truncate hover:text-slate-900 hover:underline leading-snug"
                >
                  · {item.companyName}
                  {detail && <span className={`ml-1 font-medium ${group.iconColor}`}>{detail}</span>}
                </Link>
              );
            })}
            {group.count > 3 && (
              <Link href={listUrl(group.segment)} className="text-[10px] text-slate-400 hover:text-slate-600 mt-0.5">
                他 {group.count - 3} 社 →
              </Link>
            )}
          </>
        ) : (
          <span className="text-[10px] text-slate-300">変化なし</span>
        )}
      </div>
    </div>
  );
}

// ── チャート共通カスタム Tooltip ──────────────────────────────────────────────

interface ChartTooltipPayload {
  name: string;
  value: number;
  payload?: { mrr?: number; segment?: string };
}

function ChartTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      <p className="text-slate-600">{p.value} 社</p>
      {p.payload?.mrr != null && p.payload.mrr > 0 && (
        <p className="text-slate-500 mt-0.5">MRR {formatMrr(p.payload.mrr)}</p>
      )}
      {p.payload?.segment && (
        <p className="text-indigo-500 mt-1 text-[10px]">クリックで絞り込み →</p>
      )}
    </div>
  );
}

// ── クリック可能バー用ラッパー ────────────────────────────────────────────────

type ClickableBarChartProps = {
  children: React.ReactNode;
  onBarClick?: (data: { segment?: string }) => void;
};

// recharts の BarChart に onClick を渡すとバー単位でクリックイベントが取れる
// ただし recharts の ActiveShape のデータは payload を経由するため関数ベースで受け取る

// ── Chart 1: 健全度分布バー ───────────────────────────────────────────────────

interface HealthBarData {
  name: string; count: number; fill: string; segment: string;
}

function HealthBarChart({ data, onNavigate }: {
  data: HealthBarData[];
  onNavigate: (segment: string) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart
        data={data}
        margin={{ top: 16, right: 8, left: -24, bottom: 0 }}
        barSize={32}
        onClick={(e) => {
          const seg = (e?.activePayload?.[0]?.payload as HealthBarData | undefined)?.segment;
          if (seg) onNavigate(seg);
        }}
        style={{ cursor: "pointer" }}
      >
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map(entry => <Cell key={entry.name} fill={entry.fill} />)}
          <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: "#475569", fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Chart 2: フェーズ分布バー（横向き）───────────────────────────────────────

interface PhaseBarData {
  name: string; count: number;
}

function PhaseBarChart({ data }: { data: PhaseBarData[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-sm text-slate-400">
        フェーズデータなし
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36 + 16)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 32, left: 4, bottom: 0 }}
        barSize={18}
      >
        <CartesianGrid horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
        <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]}>
          <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "#475569", fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Chart 3: 更新ウィンドウバー ───────────────────────────────────────────────

interface RenewalBarData {
  name: string; count: number; mrr: number; fill: string; segment: string;
}

function RenewalBarChart({ data, onNavigate }: {
  data: RenewalBarData[];
  onNavigate: (segment: string) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart
        data={data}
        margin={{ top: 16, right: 8, left: -24, bottom: 0 }}
        barSize={32}
        onClick={(e) => {
          const seg = (e?.activePayload?.[0]?.payload as RenewalBarData | undefined)?.segment;
          if (seg) onNavigate(seg);
        }}
        style={{ cursor: "pointer" }}
      >
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map(entry => <Cell key={entry.name} fill={entry.fill} />)}
          <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: "#475569", fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── ChartCard ─────────────────────────────────────────────────────────────────

function ChartCard({ title, hint, children }: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{title}</p>
        {hint && <p className="text-[10px] text-slate-300">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function Home() {
  const [items,       setItems]       = useState<CompanyListItemVM[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await apiFetch("/api/company-summary-list?limit=500&sort=priority_desc");
      const data = await res.json() as { total: number; items: CompanyListItemVM[] };
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error ?? res.statusText);
      setItems(data.items ?? []);
      setLastFetched(new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const diffGroups      = buildDiffGroups(items);
  const trendGroups     = buildTrendGroups(items);
  const topItems        = items.slice(0, 7);
  const total           = items.length;
  const hasSnapshotDiff = items.some(i => i.snapshotDiff !== undefined);

  // ── 変化サマリー: 2段×4列に集約 ──────────────────────────────────────────
  // Tier 1（今日の変化 — 緊急度高）: 前日diff から
  const urgentTiles = [
    diffGroups.find(g => g.id === "diffHealthDec")!,
    diffGroups.find(g => g.id === "diffSupport")!,
    diffGroups.find(g => g.id === "diffRenewal30")!,
    diffGroups.find(g => g.id === "diffPhase")!,
  ].filter(Boolean) as DiffGroup[];

  // Tier 2（今週の文脈 — 現況+週次）: 現況シグナル + 週次傾向
  const risk      = items.filter(i => i.overallHealth === "critical" || i.overallHealth === "at_risk");
  const renewal30 = items.filter(i => i.renewalBucket === "0-30");
  const expand    = items.filter(i => i.overallHealth === "expanding");
  const contextTiles: DiffGroup[] = [
    {
      id: "ctxRisk", label: "健全度リスク",
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      count: risk.length, items: risk.slice(0, 3), segment: "critical",
      iconColor: "text-red-500", bgClass: "bg-red-50",
      borderColor: "border-red-200", accentColor: "border-l-red-400",
      renderDetail: i => i.overallHealth === "critical" ? "Critical" : "At Risk",
    },
    {
      id: "ctxRenewal30", label: "更新間近（30日）",
      icon: <Calendar className="w-3.5 h-3.5" />,
      count: renewal30.length, items: renewal30.slice(0, 3), segment: "renewal_30",
      iconColor: "text-rose-600", bgClass: "bg-rose-50",
      borderColor: "border-rose-200", accentColor: "border-l-rose-500",
      renderDetail: i => i.renewalDaysLeft != null ? `あと${i.renewalDaysLeft}日` : null,
    },
    trendGroups.find(g => g.id === "trendWeeklyWorsened")!,
    {
      id: "ctxExpand", label: "拡大機会",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      count: expand.length, items: expand.slice(0, 3), segment: "expanding",
      iconColor: "text-indigo-500", bgClass: "bg-indigo-50",
      borderColor: "border-indigo-200", accentColor: "border-l-indigo-400",
      renderDetail: i => i.activePhaseLabel ?? null,
    },
  ].filter(Boolean) as DiffGroup[];

  // ── 健全度集計 ──────────────────────────────────────────────────────────────
  const critical  = items.filter(i => i.overallHealth === "critical").length;
  const atRisk    = items.filter(i => i.overallHealth === "at_risk").length;
  const healthy   = items.filter(i => i.overallHealth === "healthy").length;
  const expanding = items.filter(i => i.overallHealth === "expanding").length;

  // ── MRR サマリー ────────────────────────────────────────────────────────────
  const mrrTotal     = items.reduce((s, i) => s + (i.mrr ?? 0), 0);
  const mrrAtRisk    = items
    .filter(i => i.overallHealth === "critical" || i.overallHealth === "at_risk")
    .reduce((s, i) => s + (i.mrr ?? 0), 0);
  const mrrRenewal30 = items
    .filter(i => i.renewalBucket === "0-30")
    .reduce((s, i) => s + (i.mrr ?? 0), 0);
  const hasMrr = mrrTotal > 0;

  // ── チャートデータ ──────────────────────────────────────────────────────────

  const healthChartData: HealthBarData[] = [
    { name: "Critical",  count: critical,  fill: "#ef4444", segment: "critical"  },
    { name: "At Risk",   count: atRisk,    fill: "#f59e0b", segment: "at_risk"   },
    { name: "Healthy",   count: healthy,   fill: "#94a3b8", segment: "all"       },
    { name: "Expanding", count: expanding, fill: "#818cf8", segment: "expanding" },
  ];

  const phaseChartData: PhaseBarData[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const label = item.activePhaseLabel ?? "未設定";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [items]);

  const renewalChartData: RenewalBarData[] = useMemo(() => {
    const buckets: { key: CompanyListItemVM["renewalBucket"]; name: string; fill: string; segment: string }[] = [
      { key: "0-30",   name: "30日以内", fill: "#e11d48", segment: "renewal_30" },
      { key: "31-90",  name: "31-90日",  fill: "#f97316", segment: "renewal_90" },
      { key: "91-180", name: "91-180日", fill: "#eab308", segment: "all"        },
      { key: "180+",   name: "180日+",   fill: "#94a3b8", segment: "all"        },
    ];
    return buckets.map(({ key, name, fill, segment }) => {
      const matched = items.filter(i => i.renewalBucket === key);
      return { name, fill, segment, count: matched.length, mrr: matched.reduce((s, i) => s + (i.mrr ?? 0), 0) };
    });
  }, [items]);

  // チャートのバークリック → Company List へ遷移
  function navigateToList(segment: string) {
    window.location.href = listUrl(segment);
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader />

        <main className="flex-1 overflow-y-auto p-6">

          {/* ── ページヘッダー ──────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-slate-800">変動コックピット</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                担当ポートフォリオの変動を把握し、今週の方針を決める
              </p>
            </div>
            <div className="flex items-center gap-2">
              {lastFetched && (
                <span className="text-xs text-slate-400">更新: {lastFetched}</span>
              )}
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                更新
              </Button>
            </div>
          </div>

          {error && <AlertBox variant="error" className="mb-4">{error}</AlertBox>}

          {/* ══ SECTION 1: 優先アクションキュー（ヒーロー）─────────────── */}
          <div className="grid grid-cols-5 gap-5 mb-6">

            {/* 優先アクションキュー（col-span-3） */}
            <div className="col-span-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                  今週の優先アクション
                </p>
                <Link
                  href="/companies"
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                >
                  全企業を見る <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[0,1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
              ) : topItems.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400 bg-white rounded-lg border border-slate-200">
                  表示できる企業がありません
                </div>
              ) : (
                <div className="space-y-1">
                  {topItems.map((item, idx) => {
                    const badge  = getHealthBadge(item.overallHealth);
                    const reason = priorityReason(item.priorityBreakdown ?? []);
                    return (
                      <Link
                        key={item.companyUid}
                        href={`/companies/${item.companyUid}`}
                        className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2.5 hover:border-slate-300 hover:shadow-sm transition-all group"
                      >
                        {/* 順位 */}
                        <span className="text-[11px] text-slate-300 w-4 text-right flex-shrink-0 tabular-nums font-medium">
                          {idx + 1}
                        </span>
                        {/* Health badge */}
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 flex-shrink-0 font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </Badge>
                        {/* 企業名 */}
                        <span className="text-sm font-medium text-slate-800 flex-1 truncate min-w-0">
                          {item.companyName}
                        </span>
                        {/* 更新日 */}
                        {item.renewalBucket === "0-30" && (
                          <span className="text-[10px] text-rose-600 font-medium flex-shrink-0 flex items-center gap-0.5">
                            <Calendar className="w-3 h-3" />{item.renewalDaysLeft}日
                          </span>
                        )}
                        {/* フェーズ */}
                        {item.activePhaseLabel && (
                          <span className="text-[11px] text-slate-400 flex-shrink-0 w-24 truncate text-right">
                            {item.activePhaseLabel}
                          </span>
                        )}
                        {/* 優先理由 */}
                        {reason && (
                          <span className="text-[10px] text-slate-400 flex-shrink-0 hidden xl:block max-w-[120px] truncate">
                            {reason}
                          </span>
                        )}
                        <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* MRR サマリー + 全社リンク（col-span-2） */}
            <div className="col-span-2 flex flex-col gap-3">
              {!loading && hasMrr && (
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mb-3">
                    MRR サマリー
                  </p>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">合計 MRR</span>
                      <span className="text-base font-bold text-slate-800 tabular-nums">
                        {formatMrr(mrrTotal)}
                      </span>
                    </div>
                    {mrrAtRisk > 0 && (
                      <Link href={listUrl("arr_at_risk")} className="flex items-center justify-between hover:opacity-75 transition-opacity">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          リスク下 <ArrowRight className="w-3 h-3 text-slate-300" />
                        </span>
                        <span className="text-sm font-semibold text-red-600 tabular-nums">
                          {formatMrr(mrrAtRisk)}
                          <span className="text-[10px] font-normal text-slate-400 ml-1">
                            ({Math.round(mrrAtRisk / mrrTotal * 100)}%)
                          </span>
                        </span>
                      </Link>
                    )}
                    {mrrRenewal30 > 0 && (
                      <Link href={listUrl("renewal_30")} className="flex items-center justify-between hover:opacity-75 transition-opacity">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          30日更新分 <ArrowRight className="w-3 h-3 text-slate-300" />
                        </span>
                        <span className="text-sm font-semibold text-rose-600 tabular-nums">
                          {formatMrr(mrrRenewal30)}
                        </span>
                      </Link>
                    )}
                    <div className="pt-1 border-t border-slate-100">
                      <p className="text-[11px] text-slate-400 text-right tabular-nums">
                        {items.filter(i => i.mrr != null).length} 社集計
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {loading && <Skeleton className="h-36 rounded-xl" />}

              {!loading && (
                <Link
                  href="/companies"
                  className="flex items-center justify-between p-3 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Building2 className="w-4 h-4" />
                    全 {total} 社を管理中
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </Link>
              )}
            </div>
          </div>

          {/* ══ SECTION 2: 変化サマリー（2段 × 4列）──────────────────────── */}
          <div className="mb-6">
            {/* Tier 1: 今日の変化（緊急） */}
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                今日の変化
              </p>
              {!hasSnapshotDiff && (
                <span className="text-[10px] text-slate-300">
                  — スナップショット蓄積後（翌日〜）から表示
                </span>
              )}
            </div>
            {loading ? (
              <div className="grid grid-cols-4 gap-3 mb-3">
                {[0,1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3 mb-3">
                {urgentTiles.map(g => <DiffTile key={g.id} group={g} />)}
              </div>
            )}

            {/* Tier 2: 今週の文脈（現況 + 週次） */}
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                今週の文脈
              </p>
              <span className="text-[10px] text-slate-300">— 現況シグナル + 週次傾向</span>
            </div>
            {loading ? (
              <div className="grid grid-cols-4 gap-3">
                {[0,1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {contextTiles.map(g => <DiffTile key={g.id} group={g} />)}
              </div>
            )}
          </div>

          {/* ══ SECTION 3: 分布（補助）────────────────────────────────────── */}
          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              {[0,1,2].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mb-3">
                ポートフォリオ分布
                <span className="ml-2 normal-case font-normal text-slate-300">— クリックで絞り込み</span>
              </p>
              <div className="grid grid-cols-3 gap-4">
                <ChartCard title="健全度分布" hint="クリックで絞り込み">
                  <HealthBarChart data={healthChartData} onNavigate={navigateToList} />
                </ChartCard>
                <ChartCard title="フェーズ分布">
                  <PhaseBarChart data={phaseChartData} />
                </ChartCard>
                <ChartCard title="更新ウィンドウ" hint="クリックで絞り込み">
                  <RenewalBarChart data={renewalChartData} onNavigate={navigateToList} />
                </ChartCard>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
