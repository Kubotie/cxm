"use client";

// ─── プロジェクト分析ダッシュボード ──────────────────────────────────────────
//
// 過去30日の管理画面モジュール利用 × 契約プラン × L30アクティブ。
//
// この画面が答える問い:
//   1. 契約しているのに使われていないプロジェクトはどれか（＝提案の入口）
//   2. 管理画面に来ていないプロジェクトはどれか（＝提案より前に手当てが要る）
//   3. どの機能が実際に使われているか（＝機能の採用状況）
//
// **回遊（着地画面）を利用として数えない。** 数えると全員が使っている扱いになる。
// この前提を画面にも明記する。

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, AlertCircle, Search, ChevronDown, ExternalLink, Info, RefreshCw,
} from "lucide-react";
import { InfoTip } from "@/components/ui/info-tip";
import { useRegisterAiPageContext } from "@/components/ai";
import type { ModuleUsageResponse, ProjectModuleRow } from "@/app/api/projects/module-usage/route";
import { VERDICT_META, type ModuleVerdict } from "@/lib/company/module-signals";

const VERDICT_ORDER: ModuleVerdict[] = ["dormant", "unused", "partial", "shallow", "unevaluated", "healthy"];

const TONE: Record<string, { chip: string; bar: string }> = {
  red:   { chip: "bg-red-50 text-red-700",         bar: "bg-red-400" },
  amber: { chip: "bg-amber-50 text-amber-700",     bar: "bg-amber-400" },
  slate: { chip: "bg-slate-100 text-slate-500",    bar: "bg-slate-300" },
  green: { chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-400" },
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[10px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.06)] ${className}`}>{children}</section>;
}

export function ProjectModuleDashboard() {
  const [data, setData] = useState<ModuleUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [verdict, setVerdict] = useState<ModuleVerdict | "all">("all");
  const [plan, setPlan] = useState<string>("all");
  const [owner, setOwner] = useState<string>("all");
  const [q, setQ] = useState("");
  const [onlyManaged, setOnlyManaged] = useState(false);
  const [showAdoption, setShowAdoption] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    fetch("/api/projects/module-usage")
      .then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        return j as ModuleUsageResponse;
      })
      .then(j => { if (alive) setData(j); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.rows.filter(r => {
      if (verdict !== "all" && r.verdict !== verdict) return false;
      if (plan !== "all" && r.plan !== plan) return false;
      if (owner !== "all" && r.owner !== owner) return false;
      if (onlyManaged && !r.companyUid) return false;
      if (needle) {
        const hay = `${r.projectName} ${r.companyName ?? ""} ${r.projectId}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [data, verdict, plan, owner, q, onlyManaged]);

  // ── AI パネルへの申告 ──────────────────────────────────────────────────────
  // 早期 return より前に置く（return の後ろではフックが呼ばれない）
  useRegisterAiPageContext({
    pageId: "v2-projects",
    title: "プロジェクト分析",
    description:
      "過去30日の管理画面モジュール利用 × 契約プラン × L30アクティブ。"
      + "契約しているのに使われていないプロジェクト、管理画面に来ていないプロジェクト、"
      + "実際に使われている機能を見る画面。回遊（着地画面）は利用として数えない。",
    snapshot: {
      counts: data?.counts,
      totalRows: data?.rows.length ?? 0,
      shownRows: rows.length,
      rows,
    },
    hints: {
      判定フィルタ: verdict, プランフィルタ: plan, 担当フィルタ: owner,
      検索語: q, 管理対象のみ: onlyManaged, 読込中: loading, エラー: error,
    },
    sources: [
      {
        label: "モジュール利用",
        endpoint: "/api/projects/module-usage",
        description: "この画面の全データ。includeFree=1 で無料プロジェクトも含む",
      },
      {
        label: "プロジェクト詳細",
        endpoint: "/api/projects/{projectId}",
        description: "1プロジェクトの機能内訳・契約との差分",
      },
    ],
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-slate-400 py-24">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">プロジェクトの利用状況を集計しています…</span>
      </div>
    );
  }
  if (error || !data) {
    return (
      <Card className="px-5 py-4 m-4">
        <div className="flex items-start gap-2 text-red-600 text-[12.5px]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-px" />{error ?? "取得できませんでした"}
        </div>
      </Card>
    );
  }

  const total = Object.values(data.counts).reduce((a, b) => a + b, 0);

  return (
    <div className="px-4 py-4 space-y-3 max-w-[1600px] mx-auto">
      {/* ── 見出し ── */}
      <Card className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[15px] font-bold text-slate-900">プロジェクト分析</h1>
          <span className="text-[11.5px] text-slate-400 tabular-nums">
            有料プロジェクト {total.toLocaleString("ja-JP")}件
          </span>
          {data.period.start && (
            <span className="text-[11.5px] text-slate-400 tabular-nums">
              {data.period.start} 〜 {data.period.end}（30日）
            </span>
          )}
          <button
            onClick={() => location.reload()}
            className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-[6px] border border-slate-200 text-[11.5px] text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />再読込
          </button>
        </div>
        <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
          管理画面の各機能へのアクセス（過去30日）と契約プランを突き合わせています。
          <span className="font-semibold text-slate-700">着地画面（プロジェクトホーム／データセンター）は利用として数えません。</span>
          数えると、ログインしただけの状態が「使っている」になるためです。
        </p>
      </Card>

      {/* ── 判定サマリー ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {VERDICT_ORDER.map(v => {
          const m = VERDICT_META[v];
          const n = data.counts[v] ?? 0;
          const pct = total > 0 ? Math.round((n / total) * 100) : 0;
          const on = verdict === v;
          return (
            <button
              key={v}
              onClick={() => setVerdict(on ? "all" : v)}
              title={m.hint}
              className={`text-left rounded-[10px] border bg-white px-3.5 py-3 transition ${
                on ? "border-slate-900 shadow-[0_2px_8px_rgba(15,23,42,.10)]" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TONE[m.tone].chip}`}>{m.label}</span>
              </div>
              <div className="text-2xl font-extrabold tabular-nums text-slate-900 leading-none mt-1.5">{n}</div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                <div className={`h-full ${TONE[m.tone].bar} rounded-full`} style={{ width: `${pct}%` }} />
              </div>
              <div className="text-[10px] text-slate-400 tabular-nums mt-0.5">{pct}%</div>
            </button>
          );
        })}
      </div>

      {/* ── プラン別 ── */}
      <Card className="px-5 py-3.5">
        <div className="flex items-center gap-1.5">
          <h2 className="text-[12.5px] font-bold text-slate-800">契約プラン別</h2>
          <InfoTip text="BUNDLE は Insight と Experience の両方、PTI は Insight、PTX は Experience が使えます。契約している製品を使っていないものが「一部未使用」です。" />
        </div>
        <div className="mt-2 space-y-1.5">
          {data.byPlan.map(p => (
            <div key={p.plan} className="flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] font-bold text-slate-700 w-16 shrink-0">{p.plan}</span>
              <span className="text-[11px] text-slate-400 tabular-nums w-12 shrink-0">{p.total}件</span>
              <div className="flex h-4 flex-1 min-w-[12rem] rounded overflow-hidden bg-slate-100">
                {VERDICT_ORDER.map(v => {
                  const n = p.counts[v] ?? 0;
                  if (!n) return null;
                  return (
                    <div key={v} title={`${VERDICT_META[v].label} ${n}件`}
                      className={TONE[VERDICT_META[v].tone].bar}
                      style={{ width: `${(n / p.total) * 100}%` }} />
                  );
                })}
              </div>
              <span className="text-[10.5px] text-slate-500">
                {VERDICT_ORDER.filter(v => p.counts[v]).map(v => `${VERDICT_META[v].label}${p.counts[v]}`).join(" / ")}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* ── 機能の採用状況 ── */}
      <Card>
        <button onClick={() => setShowAdoption(v => !v)} className="w-full flex items-center gap-1.5 px-5 py-3 text-left">
          <h2 className="text-[12.5px] font-bold text-slate-800">機能ごとの採用状況</h2>
          <span className="text-[11px] text-slate-400">{data.adoption.length}機能</span>
          <ChevronDown className={`w-4 h-4 text-slate-400 ml-auto transition-transform ${showAdoption ? "rotate-180" : ""}`} />
        </button>
        {showAdoption && (
          <div className="px-5 pb-4 border-t border-slate-100 pt-3">
            <p className="text-[11px] text-slate-500 mb-2">
              「注意」が付いた機能は、そのまま利用率として読むと判断を誤ります。必ず内容を確認してください。
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="text-left font-medium py-1.5 pr-3">機能</th>
                    <th className="text-left font-medium py-1.5 pr-3">製品</th>
                    <th className="text-left font-medium py-1.5 pr-3">種別</th>
                    <th className="text-right font-medium py-1.5 pr-3">利用PJ</th>
                    <th className="text-right font-medium py-1.5 pr-3">PV</th>
                    <th className="text-left font-medium py-1.5">注意</th>
                  </tr>
                </thead>
                <tbody>
                  {data.adoption.map(a => (
                    <tr key={a.id} className="border-b border-slate-50">
                      <td className="py-1.5 pr-3 text-slate-800 font-medium">{a.label}</td>
                      <td className="py-1.5 pr-3 text-slate-500">{a.product}</td>
                      <td className="py-1.5 pr-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{a.signalType}</span>
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-slate-700">{a.projects.toLocaleString("ja-JP")}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">{a.pv.toLocaleString("ja-JP")}</td>
                      <td className="py-1.5 text-amber-700 max-w-[28rem]">
                        {a.caution && <span title={a.caution}>{a.caution.slice(0, 60)}{a.caution.length > 60 ? "…" : ""}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.droppedPv > 0 && (
              <p className="text-[11px] text-slate-400 mt-2 flex items-start gap-1">
                <Info className="w-3 h-3 shrink-0 mt-0.5" />
                辞書に定義の無いモジュール {data.droppedPv.toLocaleString("ja-JP")}PV を集計から除いています。
              </p>
            )}
          </div>
        )}
      </Card>

      {/* ── フィルタ ── */}
      <Card className="px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={q} onChange={e => setQ(e.target.value)}
              placeholder="会社名・プロジェクト名で絞る"
              className="text-[12px] pl-7 pr-3 py-1.5 rounded-[7px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200 w-64"
            />
          </div>
          <select value={plan} onChange={e => setPlan(e.target.value)}
            className="text-[12px] px-2.5 py-1.5 rounded-[7px] border border-slate-200 bg-white">
            <option value="all">すべてのプラン</option>
            {data.byPlan.map(p => <option key={p.plan} value={p.plan}>{p.plan}</option>)}
          </select>
          <select value={owner} onChange={e => setOwner(e.target.value)}
            className="text-[12px] px-2.5 py-1.5 rounded-[7px] border border-slate-200 bg-white">
            <option value="all">すべての担当</option>
            {data.owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <label className="inline-flex items-center gap-1.5 text-[12px] text-slate-600 cursor-pointer">
            <input type="checkbox" checked={onlyManaged} onChange={e => setOnlyManaged(e.target.checked)} className="accent-slate-900" />
            担当企業のみ
          </label>
          <span className="text-[11.5px] text-slate-400 tabular-nums ml-auto">{rows.length.toLocaleString("ja-JP")}件</span>
        </div>
      </Card>

      {/* ── 一覧 ── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">判定</th>
                <th className="text-left font-medium px-3 py-2.5">プロジェクト / 会社</th>
                <th className="text-left font-medium px-3 py-2.5">プラン</th>
                <th className="text-right font-medium px-3 py-2.5">実利用PV</th>
                <th className="text-right font-medium px-3 py-2.5">深さPV</th>
                <th className="text-right font-medium px-3 py-2.5">機能数</th>
                <th className="text-right font-medium px-3 py-2.5">L30</th>
                <th className="text-left font-medium px-3 py-2.5">状況 / 機会</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-[12.5px]">該当なし</td></tr>
              ) : rows.slice(0, 300).map(r => <Row key={r.projectId} r={r} />)}
            </tbody>
          </table>
        </div>
        {rows.length > 300 && (
          <p className="px-4 py-2.5 text-[11.5px] text-amber-700 border-t border-slate-100">
            {rows.length.toLocaleString("ja-JP")}件のうち上位300件を表示しています。絞り込んでください。
          </p>
        )}
      </Card>
    </div>
  );
}

function Row({ r }: { r: ProjectModuleRow }) {
  const m = VERDICT_META[r.verdict];
  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50/60 align-top">
      <td className="px-4 py-2.5">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TONE[m.tone].chip}`} title={m.hint}>
          {m.label}
        </span>
      </td>
      <td className="px-3 py-2.5 min-w-[14rem]">
        {/* 一覧から来たことを from で持たせ、詳細から一覧に戻せるようにする */}
        <Link
          href={`/v2/projects/${encodeURIComponent(r.projectId)}?from=list`}
          className="font-medium text-slate-800 hover:text-blue-700 hover:underline"
        >
          {r.projectName}
        </Link>
        <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2">
          {r.companyUid ? (
            <Link href={`/v2/companies/${r.companyUid}?from=projects`} className="text-blue-700 hover:underline inline-flex items-center gap-0.5">
              {r.companyName}<ExternalLink className="w-2.5 h-2.5" />
            </Link>
          ) : (
            <span>{r.companyName ?? "会社未紐付け"}</span>
          )}
          {r.tier && <span>T{r.tier}</span>}
          {r.owner && <span>{r.owner}</span>}
        </div>
      </td>
      <td className="px-3 py-2.5 text-slate-600">
        {r.plan}
        {r.legacyLp && <div className="text-[10px] text-slate-400">旧LP特例</div>}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{r.activePv.toLocaleString("ja-JP")}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{r.deepPv.toLocaleString("ja-JP")}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{r.activeModuleCount}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{r.l30Active.toLocaleString("ja-JP")}</td>
      <td className="px-3 py-2.5 max-w-[30rem]">
        {r.reasons.map((x, i) => (
          <div key={i} className="text-[11.5px] text-slate-600">{x}</div>
        ))}
        {r.opportunities.map((x, i) => (
          <div key={i} className="text-[11.5px] text-emerald-700 mt-0.5">機会: {x}</div>
        ))}
        <div className="flex flex-wrap gap-1 mt-1">
          {r.runsAbTest && <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">A/Bテスト運用中</span>}
          {r.unusedEntitled.map(p => (
            <span key={p} className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{p} 未使用</span>
          ))}
          {r.topModules.slice(0, 4).map(t => (
            <span key={t.id} title={`${t.signalType} / ${t.pv}PV`} className="text-[9.5px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
              {t.label} {t.pv}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}
