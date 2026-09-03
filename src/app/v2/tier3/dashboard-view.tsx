"use client";

// ─── Tier 3 ダッシュボード（CXM v2 / モックデザイン）─────────────────────────
//
// /v2/tier3 の本体。モックの「Tier 3 管理」画面を実データで再現する。
// /api/companies/tier3-dashboard（拡張シグナル）と /api/actions?include_done=1（対応済み）を取得。
// 「本日の対応済み」は /api/actions の done を「本日完了 ∧ Tier 3 企業」に絞り込んで表示する。

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, ArrowUpRight, FileText, SlidersHorizontal } from "lucide-react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { InfoTip } from "@/components/ui/info-tip";
import type {
  Tier3DashboardResponse, DashboardItem, Severity, AlarmType,
} from "@/app/api/companies/tier3-dashboard/route";
import type { ActionListItem } from "@/app/api/actions/route";
import { useRegisterAiPageContext } from "@/components/ai";

// ── フォーマッタ ──────────────────────────────────────────────────────────────

function formatMrr(mrr: number | null): string {
  if (mrr == null) return "—";
  return `¥${Math.round(mrr).toLocaleString("ja-JP")}`;
}

function planLabel(plan: DashboardItem["plan"]): string {
  return plan === "bundle" ? "Bundle"
    : plan === "insight" ? "Insight"
    : plan === "experience" ? "Experience"
    : "—";
}

// ── 対応済みアクション表示 ────────────────────────────────────────────────────

/** SF Event Type → 日本語 */
const ACTIVITY_TYPE_JA: Record<string, string> = {
  Call: "電話", Email: "メール", Meeting: "商談", Event: "イベント",
  Intercom: "Intercom", Chat: "チャット", Other: "その他",
};

/** ローカルタイムゾーンでの YYYY-MM-DD */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function truncate(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/**
 * アクションの表示ラベル。
 * SF行動を完了登録すると title が「（SF行動）」固定になり中身が分からないため、
 * その場合は SF Event の属性（形式 / 活動形式 / 目的 / 結果）から内容を組み立てる。
 * cf. actions-page.tsx markSfDone()
 */
function actionLabel(a: ActionListItem): string {
  const title = (a.title ?? "").trim();
  if (title && title !== "（SF行動）") return title;

  const parts: string[] = [];
  if (a.activityType) parts.push(ACTIVITY_TYPE_JA[a.activityType] ?? a.activityType);
  if (a.eventFormat)  parts.push(a.eventFormat);
  const purpose = (a.actionPurpose ?? "").trim();
  const body    = (a.body ?? "").trim();
  if (purpose)   parts.push(truncate(purpose, 40));
  else if (body) parts.push(truncate(body, 40));
  if (a.result)  parts.push(`評価${a.result}`);

  return parts.length > 0 ? parts.join(" / ") : "SF行動（内容未記録）";
}

const SEVERITY_META: Record<Severity, { label: string; chip: string; dot: string; num: string }> = {
  red:   { label: "緊急",     chip: "bg-red-50 text-red-700",         dot: "bg-red-500",     num: "text-red-600" },
  amber: { label: "要対応",   chip: "bg-amber-50 text-amber-700",     dot: "bg-amber-500",   num: "text-amber-600" },
  blue:  { label: "提案",     chip: "bg-blue-50 text-blue-700",       dot: "bg-blue-500",    num: "text-blue-600" },
  green: { label: "異常なし", chip: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", num: "text-emerald-600" },
};

type FilterKey = "all" | "urgent" | "needAction" | "proposal" | "normal";
const FILTER_TO_SEVERITY: Record<Exclude<FilterKey, "all">, Severity> = {
  urgent: "red", needAction: "amber", proposal: "blue", normal: "green",
};

// ── ソート ──────────────────────────────────────────────────────────────────
type SortKey = "priority" | "name" | "mrr" | "pvRate" | "l30" | "l7" | "wow" | "severity";
type SortDir = "asc" | "desc";
const SEVERITY_RANK: Record<Severity, number> = { red: 3, amber: 2, blue: 1, green: 0 };

function sortValue(it: DashboardItem, key: SortKey): number | string {
  switch (key) {
    case "name":     return it.canonicalName ?? "";
    case "mrr":      return it.mrr ?? -1;
    case "pvRate":   return it.pvRate ?? -1;
    case "l30":      return it.l30Total ?? -1;
    case "l7":       return it.l7ThisWeek ?? -1;
    case "wow":      return it.wowPct ?? Number.NEGATIVE_INFINITY;
    case "severity": return SEVERITY_RANK[it.severity];
    default:         return it.priorityScore;
  }
}

// ── 小コンポーネント ──────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[10px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.06)] ${className}`}>
      {children}
    </section>
  );
}

function CardHeader({ title, tag, tip }: { title: string; tag?: string; tip?: string }) {
  return (
    <div className="flex items-center gap-2 px-3.5 py-3 border-b border-slate-100">
      <h2 className="text-[12.5px] font-bold tracking-wide text-slate-800">{title}</h2>
      {tip && <InfoTip text={tip} />}
      {tag && <span className="ml-auto text-[10.5px] text-slate-400">{tag}</span>}
    </div>
  );
}

function SortableTh({
  label, sk, sortKey, sortDir, onSort, align = "left", tip,
}: {
  label: string; sk: SortKey; sortKey: SortKey; sortDir: SortDir;
  onSort: (k: SortKey) => void; align?: "left" | "right"; tip?: string;
}) {
  const active = sortKey === sk;
  return (
    <th className={`px-3.5 py-2.5 font-bold ${align === "right" ? "text-right" : ""}`}>
      <span className={`inline-flex items-center gap-0.5 ${active ? "text-blue-600" : ""}`}>
        <span className="cursor-pointer select-none hover:text-slate-700" onClick={() => onSort(sk)}>
          {label}
          {active && (sortDir === "asc" ? <ArrowUp className="inline w-3 h-3" /> : <ArrowDown className="inline w-3 h-3" />)}
        </span>
        {tip && <InfoTip text={tip} />}
      </span>
    </th>
  );
}

function SeverityChip({ severity }: { severity: Severity }) {
  const m = SEVERITY_META[severity];
  return <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${m.chip}`}>{m.label}</span>;
}

function PvBar({ rate }: { rate: number | null }) {
  if (rate == null) return <span className="text-slate-400 text-xs">—</span>;
  const color = rate >= 90 ? "bg-red-500" : rate >= 50 ? "bg-amber-500" : "bg-blue-600";
  return (
    <div className="w-[104px]">
      <div className="h-1.5 rounded bg-slate-200 overflow-hidden">
        <div className={`h-full rounded ${color}`} style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
      <div className="mt-0.5 text-[10.5px] font-semibold text-slate-400 tabular-nums">
        {rate}%{rate >= 90 ? " ⚠" : ""}
      </div>
    </div>
  );
}

function WowDelta({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-slate-400 tabular-nums">—</span>;
  const cls = pct <= -1 ? "text-red-600" : pct >= 1 ? "text-emerald-600" : "text-slate-400";
  const sign = pct > 0 ? "+" : "";
  return <span className={`font-bold tabular-nums ${cls}`}>{sign}{pct}%</span>;
}

// ── メイン ────────────────────────────────────────────────────────────────────

export function Tier3DashboardView() {
  const [data, setData]       = useState<Tier3DashboardResponse | null>(null);
  const [done, setDone]       = useState<ActionListItem[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState("");
  const [filter, setFilter]   = useState<FilterKey>("all");
  const [alarmFilter, setAlarmFilter] = useState<AlarmType | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // 文字列(name)は昇順、数値は降順を初期方向にする
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/companies/tier3-dashboard?limit=2000")
        .then(r => r.ok ? r.json() as Promise<Tier3DashboardResponse> : Promise.reject(new Error(String(r.status)))),
      fetch("/api/actions?include_done=1")
        .then(r => r.ok ? r.json() as Promise<{ actions: ActionListItem[] }> : Promise.resolve({ actions: [] }))
        .catch(() => ({ actions: [] as ActionListItem[] })),
    ])
      .then(([dash, act]) => {
        if (cancelled) return;
        setData(dash);
        // 「本日の対応済み」= 本日完了登録された ∧ この画面の対象（Tier 3）企業のもの
        const today   = localDateStr(new Date());
        const tierUids = new Set(dash.items.map(i => i.companyUid));
        const doneToday = (act.actions ?? [])
          .filter(a => a.status === "done")
          .filter(a => !!a.companyUid && tierUids.has(a.companyUid))
          .filter(a => {
            if (!a.createdAt) return false;
            const d = new Date(a.createdAt);
            return !isNaN(d.getTime()) && localDateStr(d) === today;
          })
          .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
        setDone(doneToday);
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.items.filter(it => {
      if (filter !== "all" && it.severity !== FILTER_TO_SEVERITY[filter]) return false;
      if (alarmFilter && !it.alarms.includes(alarmFilter)) return false;
      if (q && !it.canonicalName.toLowerCase().includes(q) && !it.owner.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, query, filter, alarmFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      if (typeof va === "string" || typeof vb === "string") {
        return String(va).localeCompare(String(vb), "ja") * dir;
      }
      return (va - vb) * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const todayTargets = useMemo(
    () => (data?.items ?? []).filter(it => it.severity !== "green").slice(0, 6),
    [data],
  );

  const updatedLabel = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";

  // ── AI パネルへの申告 ──────────────────────────────────────────────────────
  useRegisterAiPageContext({
    pageId: "v2-tier3",
    title: "Tier 3 管理",
    description:
      "Tier 3 企業を拡張シグナルつきで並べ、「今日、誰に連絡すべきか」を1画面で判断する画面。"
      + "重大度（severity）とアラート種別（alarm）で優先順位を付ける。",
    snapshot: {
      counts: data?.counts,
      updatedAt: data?.updatedAt,
      totalItems: data?.items.length ?? 0,
      shownItems: sorted.length,
      items: sorted,
      本日の対応候補: todayTargets.map(t => t.canonicalName),
      本日の対応済み: done,
    },
    hints: {
      検索語: query, フィルタ: filter, アラートフィルタ: alarmFilter,
      並び替え: `${sortKey}/${sortDir}`, 読込中: loading, エラー: error,
    },
    sources: [
      {
        label: "Tier 3 ダッシュボード",
        endpoint: "/api/companies/tier3-dashboard",
        description: "この画面の全データ（limit で件数指定）",
      },
      {
        label: "アクション一覧",
        endpoint: "/api/actions",
        description: "対応済み判定に使っているアクション。include_done=1 で完了分を含む",
      },
    ],
  });

  return (
    <>
      {/* ── トップバー ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3.5 px-5 py-3.5 bg-white border-b border-slate-200">
        <div>
          <h1 className="m-0 text-base font-bold tracking-tight flex items-center gap-2">
            Tier 3 管理
            <span className="text-[10.5px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {data ? `${data.counts.all} 社` : "—"}
            </span>
          </h1>
          <div className="text-[11.5px] text-slate-400 mt-0.5">今日、誰に連絡すべきか — 1画面で判断</div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          デイリー更新 · 最終 {updatedLabel}
        </div>
        <button className="inline-flex items-center gap-1.5 border border-slate-200 bg-white rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <SlidersHorizontal className="w-3.5 h-3.5" /> 表示設定
        </button>
        <button className="inline-flex items-center gap-1.5 bg-blue-600 border border-blue-600 rounded-lg px-3 py-1.5 text-xs font-semibold text-white hover:brightness-105">
          <FileText className="w-3.5 h-3.5" /> レポート出力
        </button>
      </div>

      {/* ── コンテンツ ─────────────────────────────────────────────────────── */}
      <div className="p-4 md:p-5">
        {loading && (
          <div className="flex items-center justify-center gap-2 text-slate-500 py-16">
            <Loader2 className="w-4 h-4 animate-spin" /> 読み込み中...
          </div>
        )}
        {(error || (!loading && !data)) && (
          <div className="flex items-center gap-2 text-red-600 py-4 px-4 bg-red-50 rounded">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">読み込みに失敗しました: {error ?? "データなし"}</span>
          </div>
        )}

        {data && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-[264px_1fr] gap-4 items-start">
            {/* ── 左カラム ─────────────────────────────────────────────────── */}
            <div className="space-y-4">
              {/* アラームサマリー */}
              <Card>
                <CardHeader title="アラームサマリー" tag={alarmFilter ? "絞込中" : "クリックで絞込"} />
                <div>
                  {([
                    { label: "PV 超過・超過予測",         source: "PTBI",       n: data.summary.pvOver,      sev: "red"   as Severity, alarm: "pv_over"     as AlarmType,
                      tip: "当月のPV消費が上限の90%以上。超過リスクがある状態（緊急）。出典: PTBI" },
                    { label: "更新 60 日以内",            source: "契約",       n: data.summary.renewalSoon, sev: "amber" as Severity, alarm: "renewal_soon" as AlarmType,
                      tip: "契約更新日まで60日以内。0-30日=要観察（この期間は解約不可のため緊急ではない）／31-60日=要注意。要対応(amber)扱い" },
                    { label: "操作数 急減（前週比 −50%↓）", source: "PTBI",      n: data.summary.opsDrop,     sev: "amber" as Severity, alarm: "ops_drop"     as AlarmType,
                      tip: "今週のアクティブユーザー数(L7)が前週比 −50%以下。利用が急に落ちている。出典: PTBI" },
                    { label: "30 日以上 無活動 / 休眠",    source: "PTBI",       n: data.summary.inactive30,  sev: "amber" as Severity, alarm: "inactive_30"  as AlarmType,
                      tip: "最終活動から30日以上、またはPtengine持続休眠（2ヶ月以上操作が少なく直近30日アクティブ<3）。出典: PTBI" },
                    { label: "アップセル機会",            source: "契約プラン", n: data.summary.upsell,      sev: "blue"  as Severity, alarm: "upsell"       as AlarmType,
                      tip: "単一プラン契約（Insight または Experience のみ）で、ある程度稼働している企業。もう一方のプラン追加＝Bundle への拡張余地がある。出典: 契約プラン" },
                  ]).map((r, i) => {
                    const active = alarmFilter === r.alarm;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { setAlarmFilter(active ? null : r.alarm); setFilter("all"); }}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 border-b border-slate-100 last:border-0 text-left transition
                          ${active ? "bg-blue-50" : "hover:bg-slate-50"}`}
                      >
                        <span className={`w-2 h-2 rounded-sm ${SEVERITY_META[r.sev].dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-semibold flex items-center gap-1 ${active ? "text-blue-700" : "text-slate-800"}`}>
                            {r.label}
                            <InfoTip text={r.tip} />
                          </div>
                          <div className="text-[10.5px] text-slate-400">{r.source}</div>
                        </div>
                        <div className={`text-lg font-extrabold tabular-nums ${SEVERITY_META[r.sev].num}`}>{r.n}</div>
                      </button>
                    );
                  })}
                </div>
                {alarmFilter && (
                  <div className="px-3.5 py-2 border-t border-slate-100">
                    <button type="button" onClick={() => setAlarmFilter(null)}
                      className="text-[11px] font-semibold text-slate-500 hover:text-blue-600">
                      × アラーム絞り込みを解除
                    </button>
                  </div>
                )}
              </Card>

              {/* 今日対応する企業 */}
              <Card>
                <CardHeader title="今日対応する企業" tag={`優先度順 · 上位${todayTargets.length}`} />
                <div className="p-2">
                  {todayTargets.length === 0 && (
                    <div className="text-center text-slate-400 text-xs py-6">対応が必要な企業はありません</div>
                  )}
                  {todayTargets.map((it, i) => (
                    <div key={it.companyUid} className="flex gap-2.5 p-2 border-t border-slate-100 first:border-0">
                      <div className={`w-5 h-5 rounded-md text-[11px] font-extrabold grid place-items-center flex-none mt-0.5
                        ${it.severity === "red" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/v2/companies/${it.companyUid}?from=tier3`} className="block text-[12.5px] font-bold text-slate-900 truncate hover:text-blue-600 hover:underline">
                          {it.canonicalName}
                        </Link>
                        <div className="text-[10.5px] text-slate-500 mt-0.5">{it.primaryReason}</div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <SeverityChip severity={it.severity} />
                          <span className="ml-auto text-[11px] font-semibold text-slate-400 tabular-nums">{formatMrr(it.mrr)}</span>
                          <Link href={`/v2/companies/${it.companyUid}?from=tier3`} className="flex-none inline-flex items-center gap-0.5 text-[11px] font-bold text-blue-600 hover:underline">
                            対応 <ArrowUpRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* 本日の対応済み */}
              <Card>
                <CardHeader
                  title="本日の対応済み"
                  tag={`${done.length} 件`}
                  tip="Tier 3 企業に対して本日「完了」登録されたアクション（NocoDB company_actions / Salesforce 行動）。時刻は完了登録した時刻で、SF行動の実施日が別日の場合は「実施 M/D」を併記します。"
                />
                <div className="px-3.5 py-2">
                  {done.length === 0 && (
                    <div className="text-center text-slate-400 text-xs py-4">対応済みアクションはありません</div>
                  )}
                  {done.slice(0, 6).map(a => {
                    // dueDate = SF行動の実施日。完了登録日（createdAt）と異なる場合のみ併記する。
                    const doneAt = a.createdAt ? new Date(a.createdAt) : null;
                    const showDue = a.dueDate && doneAt && !isNaN(doneAt.getTime())
                      && a.dueDate !== localDateStr(doneAt);
                    return (
                      <div key={`${a.rowId}-${a.id}`} className="flex gap-2.5 py-2 border-b border-dashed border-slate-100 last:border-0">
                        <div className="text-[10.5px] font-bold text-slate-400 w-9 flex-none pt-0.5 tabular-nums">
                          {doneAt && !isNaN(doneAt.getTime())
                            ? doneAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </div>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-none" />
                        <div className="text-[11.5px] text-slate-600">
                          <b className="font-bold text-slate-800">{a.companyName}</b> — {actionLabel(a)}
                          {showDue && (
                            <span className="ml-1 text-[10.5px] text-slate-400">
                              （実施 {a.dueDate!.slice(5).replace("-", "/")}）
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {done.length > 6 && (
                    <div className="pt-1.5 text-[10.5px] text-slate-400">ほか {done.length - 6} 件</div>
                  )}
                </div>
              </Card>
            </div>

            {/* ── 右カラム：企業一覧 ───────────────────────────────────────── */}
            <Card>
              {/* ツールバー */}
              <div className="flex items-center gap-2.5 flex-wrap px-3.5 py-3 border-b border-slate-100">
                <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                  {([
                    { key: "all"        as FilterKey, label: "すべて",   n: data.counts.all },
                    { key: "urgent"     as FilterKey, label: "緊急",     n: data.counts.urgent },
                    { key: "needAction" as FilterKey, label: "要対応",   n: data.counts.needAction },
                    { key: "proposal"   as FilterKey, label: "提案",     n: data.counts.proposal },
                    { key: "normal"     as FilterKey, label: "異常なし", n: data.counts.normal },
                  ]).map(t => (
                    <button
                      key={t.key}
                      onClick={() => { setFilter(t.key); setAlarmFilter(null); }}
                      className={`px-2.5 py-1 text-[11.5px] font-semibold rounded-md flex items-center gap-1.5 transition
                        ${filter === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                    >
                      {t.label}
                      <span className={`text-[10px] font-extrabold ${filter === t.key ? "text-blue-600" : "text-slate-400"}`}>{t.n}</span>
                    </button>
                  ))}
                </div>
                <div className="ml-auto relative">
                  <input
                    type="text"
                    placeholder="企業名 / 担当で検索…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    className="border border-slate-200 bg-slate-50 rounded-lg pl-3 pr-3 h-8 text-xs text-slate-800 w-[210px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* テーブル */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-left text-[10.5px] font-bold tracking-wide text-slate-400 uppercase bg-slate-50">
                      <SortableTh label="企業名 / 担当"   sk="name"     sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortableTh label="MRR"             sk="mrr"      sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                      <th className="px-3.5 py-2.5 font-bold">プラン</th>
                      <SortableTh label="PV消費率"        sk="pvRate"   sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortableTh label="L30"             sk="l30"      sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right"
                        tip="過去30日にアクティブだったユーザー数（全プロジェクト合計）。継続的な利用ボリュームの目安" />
                      <SortableTh label="L7 / 前週比"     sk="l7"       sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right"
                        tip="今週(直近7日)のアクティブユーザー数と、前週比の増減率。急減は利用低下のサイン" />
                      <SortableTh label="アラーム"        sk="severity" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}
                        tip="重大度: 緊急=PV超過 ／ 要対応=更新60日以内・操作数急減・30日無活動 ／ 提案=アップセル機会 ／ 異常なし" />
                      <th className="px-3.5 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 && (
                      <tr><td colSpan={8} className="text-center text-slate-400 py-8">該当する企業がありません</td></tr>
                    )}
                    {sorted.map(it => (
                      <tr key={it.companyUid} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-3.5 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            <Link href={`/v2/companies/${it.companyUid}?from=tier3`} className="font-bold text-[12.5px] text-slate-900 hover:text-blue-600 hover:underline">
                              {it.canonicalName}
                            </Link>
                            <span className="text-[10.5px] text-slate-400">{it.owner === "—" ? "担当なし" : it.owner}</span>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-right tabular-nums">{formatMrr(it.mrr)}</td>
                        <td className="px-3.5 py-2.5">
                          {it.plan
                            ? <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded border
                                ${it.plan === "bundle" ? "bg-blue-50 text-blue-700 border-transparent"
                                : it.plan === "experience" ? "bg-emerald-50 text-emerald-700 border-transparent"
                                : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                                {planLabel(it.plan)}
                              </span>
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-3.5 py-2.5"><PvBar rate={it.pvRate} /></td>
                        <td className="px-3.5 py-2.5 text-right tabular-nums">{it.l30Total ?? "—"}</td>
                        <td className="px-3.5 py-2.5 text-right">
                          <span className="tabular-nums">{it.l7ThisWeek ?? "—"}</span>{" "}
                          <WowDelta pct={it.wowPct} />
                        </td>
                        <td className="px-3.5 py-2.5"><SeverityChip severity={it.severity} /></td>
                        <td className="px-3.5 py-2.5 text-right">
                          <Link href={`/v2/companies/${it.companyUid}?from=tier3`} className="inline-flex items-center gap-0.5 text-[11px] font-bold text-blue-600 hover:underline">
                            対応 <ArrowUpRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 凡例 */}
              <div className="flex items-center gap-4 flex-wrap px-3.5 py-2.5 border-t border-slate-100 text-[10.5px] text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />緊急（PV超過）</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />要対応（更新60日以内 / 操作数急減 / 30日無活動）</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />提案（アップセル機会）</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />異常なし</span>
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
