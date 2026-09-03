"use client";

// ─── 提案準備ボード ───────────────────────────────────────────────────────────
//
// **このボードは「今週どこを見るか」を決めるための一覧に徹する。**
// 当てるWHATの候補・状況チップ・カタログの状態は個社ページの「提案準備」タブへ移した
// （2026-08-22）。一覧に判断材料と作業を同居させるとカードが縦に伸び、
// 本来の用途である「絞り込み」ができなくなるため。
//
// Tier 1/2/3 の担当顧客を「今どこに提案できるか / どこは提案してはいけないか」で並べる。
// 設計根拠: docs-src/cxm_v2/17_WHO_WHAT_Matching_Plan.md §10.1（週の始めに誰を見るか決める）/ §15
//
// この画面の役割は「提案先を選ぶ」ことだけ。個社の精査は詳細ページに委ねる。
// レーンは4つ。上から順に、今週手を動かす優先順になっている。

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, AlertCircle, Search, ArrowUpRight, CalendarClock,
  Target, Sparkles, Wrench, TrendingDown, Info,
  HelpCircle, ChevronDown,
} from "lucide-react";
import { InfoTip } from "@/components/ui/info-tip";
import { useRegisterAiPageContext } from "@/components/ai";
import { VERDICT_META as MODULE_VERDICT_META } from "@/lib/company/module-signals";
import type {
  ProposalBoardResponse, BoardItem, BoardLane,
} from "@/app/api/companies/proposal-board/route";
import type { ReadinessLevel } from "@/lib/company/proposal-readiness";
import {
  FACTOR_META, BLOCKER_META, READINESS_CAP_NOTE, USAGE_METRIC_META, BLOCKER_VS_SCORE_NOTE,
} from "@/lib/company/proposal-readiness";

// ── 状況IDの日本語名 ──────────────────────────────────────────────────────────
//
// ── 表示メタ ──────────────────────────────────────────────────────────────────

const LANE_META: Record<BoardLane, {
  title: string; note: string; icon: React.ElementType;
  accent: string; chip: string; bar: string;
}> = {
  renewal: {
    title: "更新を確保する",
    note: "解約判断が行われる満了91〜31日前で、足元が固まっていない。新提案は持ち込まず、契約の継続と摩擦の解消に集中する。",
    icon: CalendarClock,
    accent: "border-l-amber-500", chip: "bg-amber-100 text-amber-800", bar: "bg-amber-500",
  },
  ready: {
    title: "提案できる",
    note: "足元が固まっている。外部で「今提案する理由」を掴めば、そのまま拡張提案に進める。",
    icon: Sparkles,
    accent: "border-l-emerald-500", chip: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-500",
  },
  conditional: {
    title: "条件付き",
    note: "提案はできるが、新規購入を求める前に足元の課題に触れる必要がある。",
    icon: Target,
    accent: "border-l-blue-500", chip: "bg-blue-100 text-blue-800", bar: "bg-blue-500",
  },
  hold: {
    title: "足元を戻す",
    note: "提案の局面ではない。利用の停滞と未解決の摩擦を解消することが先。",
    icon: Wrench,
    accent: "border-l-slate-400", chip: "bg-slate-200 text-slate-700", bar: "bg-slate-400",
  },
};

const LANE_ORDER: BoardLane[] = ["renewal", "ready", "conditional", "hold"];

const LEVEL_TEXT: Record<ReadinessLevel, string> = {
  high: "text-emerald-600", medium: "text-amber-600", low: "text-red-600", unknown: "text-slate-400",
};

const FACTOR_KEYS = ["utilization", "execution", "relationship", "friction"] as const;
// 短縮名は FACTOR_META（proposal-readiness.ts）が正本。ここには持たない

function formatMrr(mrr: number | null): string {
  return mrr == null ? "—" : `¥${Math.round(mrr).toLocaleString("ja-JP")}`;
}

/**
 * 更新状態のバッジ。
 *
 * 契約満了30日以内は解約できない運用ルールのため `0-30` は緊急ではなく「更新予定」。
 * 実際に解約判断が行われる満了 91〜31日前（`31-90`）を最も強く出す。
 */
function RenewalBadge({ bucket }: { bucket: BoardItem["renewalBucket"] }) {
  if (!bucket) return null;
  const meta =
    bucket === "31-90"   ? { label: "更新判断期", cls: "bg-amber-100 text-amber-800" } :
    bucket === "0-30"    ? { label: "更新予定",   cls: "bg-slate-100 text-slate-500" } :
    bucket === "expired" ? { label: "期限切れ",   cls: "bg-red-100 text-red-700" } :
    null;
  if (!meta) return null;
  return (
    <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${meta.cls}`}>{meta.label}</span>
  );
}

// ── 本体 ──────────────────────────────────────────────────────────────────────

export function ReadinessBoardView() {
  const [data, setData]       = useState<ProposalBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [q, setQ]           = useState("");
  const [owner, setOwner]   = useState<string>("all");
  const [tiers, setTiers]   = useState<Set<number>>(new Set([1, 2, 3]));

  useEffect(() => {
    setLoading(true);
    fetch("/api/companies/proposal-board")
      .then(r => r.ok ? r.json() as Promise<ProposalBoardResponse> : Promise.reject(new Error(String(r.status))))
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const kw = q.trim().toLowerCase();
    return data.items.filter(i =>
      (owner === "all" || i.owner === owner)
      && (i.tier == null || tiers.has(i.tier))
      && (kw === "" || i.companyName.toLowerCase().includes(kw) || i.owner.toLowerCase().includes(kw))
    );
  }, [data, q, owner, tiers]);

  const byLane = useMemo(() => {
    const m: Record<BoardLane, BoardItem[]> = { renewal: [], ready: [], conditional: [], hold: [] };
    for (const i of filtered) m[i.lane].push(i);
    return m;
  }, [filtered]);

  // ── AI パネルへの申告 ──────────────────────────────────────────────────────
  // 絞り込み後の「画面に出ている分」を渡す。全件を渡すと AI が画面と違う母数で答える。
  useRegisterAiPageContext({
    pageId: "v2-readiness",
    title: "提案準備ボード",
    description:
      "担当顧客を「更新を確保する / 提案できる / 条件付き / 足元を戻す」の4レーンに分け、"
      + "今週どこに手を動かすかを決める画面。判断材料は提案準備度スコアと阻害要因。",
    snapshot: {
      laneCounts: Object.fromEntries(LANE_ORDER.map(l => [l, byLane[l].length])),
      totalItems: data?.items.length ?? 0,
      shownItems: filtered.length,
      items: filtered,
    },
    hints: { 検索語: q, 担当フィルタ: owner, Tierフィルタ: Array.from(tiers), 読込中: loading, エラー: error },
    sources: [
      {
        label: "提案準備ボード",
        endpoint: "/api/companies/proposal-board",
        description: "この画面の全データ。owner / opportunity クエリで絞れる",
      },
    ],
  });

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 text-slate-400 py-24">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Tier 1–3 の提案準備度を算出中…</span>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-5">
        <div className="flex items-center gap-2 text-red-600 py-4 px-4 bg-red-50 rounded-[10px] text-sm">
          <AlertCircle className="w-4 h-4" />読み込みに失敗しました{error ? `: ${error}` : ""}
        </div>
      </div>
    );
  }

  const toggleTier = (t: number) =>
    setTiers(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next.size === 0 ? new Set([1, 2, 3]) : next;
    });

  return (
    <>
      {/* ── ヘッダー ── */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold text-slate-900 flex items-center gap-1.5">
              提案準備ボード
              <InfoTip text="Tier 1–3 の担当顧客を「今どこに提案できるか」で並べています。判定は既存データからの推定です。個社の精査は各社のページで行ってください。" />
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tier 1–3 / {data.counts.all}社
              {data.snapshotDate && ` ・ スナップショット ${data.snapshotDate}`}
              {data.trendFromDate && ` ・ 推移起点 ${data.trendFromDate}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {/* Tier */}
            <div className="flex items-center gap-1">
              {[1, 2, 3].map(t => (
                <button key={t} onClick={() => toggleTier(t)}
                  className={`px-2.5 py-1.5 rounded-[8px] text-[11.5px] font-bold border transition
                    ${tiers.has(t)
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-500 border-slate-300 hover:border-slate-400"}`}>
                  T{t}
                </button>
              ))}
            </div>

            {/* 担当 */}
            <select value={owner} onChange={e => setOwner(e.target.value)}
              className="h-[32px] rounded-[8px] border border-slate-300 bg-white px-2.5 text-[12px] text-slate-700">
              <option value="all">担当: 全員</option>
              {data.owners.map(o => <option key={o} value={o}>{o}</option>)}
            </select>

            {/* 検索 */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="顧客名・担当で絞り込み"
                className="h-[32px] w-[200px] rounded-[8px] border border-slate-300 pl-8 pr-2.5 text-[12px] placeholder:text-slate-400" />
            </div>
          </div>
        </div>

        {/* レーン件数サマリー */}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {LANE_ORDER.map(lane => {
            const meta = LANE_META[lane];
            const Icon = meta.icon;
            return (
              <span key={lane} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-bold ${meta.chip}`}>
                <Icon className="w-3.5 h-3.5" />
                {meta.title}
                <span className="tabular-nums">{byLane[lane].length}</span>
              </span>
            );
          })}
          {filtered.length !== data.counts.all && (
            <span className="inline-flex items-center px-2.5 py-1 text-[11.5px] text-slate-400">
              {data.counts.all}社中 {filtered.length}社を表示
            </span>
          )}
        </div>
      </header>

      <div className="p-4 md:p-5 space-y-5">
        <LegendPanel />

        {LANE_ORDER.map(lane => (
          <LaneSection key={lane} lane={lane} items={byLane[lane]} />
        ))}

        {/* 一覧では評価できないもの（判定の限界を明示する） */}
        {data.notEvaluated.length > 0 && (
          <section className="rounded-[10px] border border-slate-200 bg-white px-5 py-4">
            <div className="flex items-center gap-1.5">
              <Info className="w-4 h-4 text-slate-400" />
              <h2 className="text-[12.5px] font-bold text-slate-800">この一覧では評価していないもの</h2>
            </div>
            <ul className="mt-2 space-y-1">
              {data.notEvaluated.map((n, i) => (
                <li key={i} className="text-[11.5px] text-slate-500 flex items-start gap-1.5">
                  <span className="text-slate-300 mt-px">・</span>{n}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-400 mt-2.5">
              準備度は推定であり確定ではありません。提案の可否は根拠を確認のうえ判断してください。
            </p>
          </section>
        )}
      </div>
    </>
  );
}

// ── レーン ────────────────────────────────────────────────────────────────────

/** 利用実態の数字の説明（ホバーで出す） */
function usageHint(key: typeof USAGE_METRIC_META[number]["key"]): string {
  const m = USAGE_METRIC_META.find(x => x.key === key);
  if (!m) return "";
  return [m.label, m.meaning, `出所: ${m.source}`, m.caveat ? `注意: ${m.caveat}` : null]
    .filter(Boolean).join("\n");
}

/**
 * ブロッカーのチップ文言から説明を引く。
 * 「未解決サポート 12件」のように件数が入るので、前方一致で照合する。
 */
function blockerHint(label: string): string {
  const hit = BLOCKER_META.find(m => {
    const head = m.label.split(" ")[0];
    return label.startsWith(head);
  });
  return hit ? `${hit.when}\n→ ${hit.why}` : label;
}

// ─── 指標の凡例 ───────────────────────────────────────────────────────────────
//
// カードの数字とチップが何を意味するかを、画面上で確認できるようにする。
// 文言は FACTOR_META / BLOCKER_META（proposal-readiness.ts）が正本。
// ここに書き写すと、配点を直したときに説明だけ古いまま残る。

function LegendPanel() {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-[10px] border border-slate-200 bg-white">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-5 py-3 text-left"
      >
        <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="text-[12.5px] font-bold text-slate-800">指標とフラグの見方</span>
        <span className="text-[11px] text-slate-400">
          準備度の4要素・カードの数字・赤いフラグ{BLOCKER_META.length}種類の定義
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 ml-auto shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-5 pb-4 border-t border-slate-100 pt-3.5 space-y-4">
          {/* 4要素 */}
          <div>
            <h3 className="text-[12px] font-bold text-slate-800">準備度の4要素</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              各0〜100点。重み付き平均が「準備度」になります。データが無い要素は平均から除きます。
            </p>
            <div className="mt-2 space-y-2">
              {FACTOR_KEYS.map(key => {
                const m = FACTOR_META[key];
                return (
                  <div key={key} className="rounded-[8px] border border-slate-150 px-3 py-2">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-[12px] font-bold text-slate-900">{m.short}</span>
                      <span className="text-[11.5px] text-slate-600">{m.label}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 tabular-nums">
                        重み {Math.round(m.weight * 100)}%
                      </span>
                    </div>
                    <p className="text-[11.5px] text-slate-700 mt-1">{m.question}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">算出: {m.basis}</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">低いとき: {m.lowMeans}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* カードの数字 */}
          <div>
            <h3 className="text-[12px] font-bold text-slate-800">カードに出る数字</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              企業内の有料プロジェクトを合算した値です。プロジェクト別の内訳は個社ページで確認できます。
            </p>
            <div className="mt-2 space-y-1.5">
              {USAGE_METRIC_META.map(m => (
                <div key={m.key} className="rounded-[8px] border border-slate-150 px-3 py-2">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[12px] font-bold text-slate-900">{m.short}</span>
                    <span className="text-[11.5px] text-slate-600">{m.label}</span>
                  </div>
                  <p className="text-[11.5px] text-slate-700 mt-1">{m.meaning}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">出所: {m.source}</p>
                  {m.caveat && <p className="text-[11px] text-amber-700 mt-0.5">注意: {m.caveat}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* 30日の利用判定 */}
          <div>
            <h3 className="text-[12px] font-bold text-slate-800">30日の利用判定</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              管理画面のモジュール単位アクセス（実測）から判定しています。
              提案の可否に直結する「休眠」「未使用」「一部未使用」だけカードに出しています。
            </p>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {(["dormant", "unused", "partial", "shallow", "healthy", "unevaluated"] as const).map(v => (
                <div key={v} className="rounded-[8px] border border-slate-150 px-3 py-2">
                  <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded ${
                    MODULE_VERDICT_META[v].tone === "red" ? "bg-red-50 text-red-700"
                    : MODULE_VERDICT_META[v].tone === "amber" ? "bg-amber-50 text-amber-700"
                    : MODULE_VERDICT_META[v].tone === "green" ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                  }`}>
                    {MODULE_VERDICT_META[v].label}
                  </span>
                  <p className="text-[11px] text-slate-600 mt-1">{MODULE_VERDICT_META[v].hint}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 上限 */}
          <div>
            <h3 className="text-[12px] font-bold text-slate-800">準備度に上限がかかる条件</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              平均が高くても、次のときは上限で頭打ちにします。1つ致命的な要素があれば提案は通らないためです。
            </p>
            <ul className="mt-1 space-y-0.5">
              {READINESS_CAP_NOTE.map((n, i) => (
                <li key={i} className="text-[11.5px] text-slate-700 flex gap-1.5">
                  <span className="text-slate-300 shrink-0">・</span><span>{n}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ブロッカー */}
          <div>
            <h3 className="text-[12px] font-bold text-slate-800">赤いフラグ（ブロッカー）</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              提案の前に片付けるべきこと、または注意して扱うべき状態です。カードには最大4件まで出ます。
            </p>
            {/* 「スコアが高いのにフラグが出る」を矛盾と読まれないようにする */}
            <div className="mt-1.5 rounded-[8px] bg-slate-50 border border-slate-200 px-3 py-2">
              {BLOCKER_VS_SCORE_NOTE.map((n, i) => (
                <p key={i} className="text-[11px] text-slate-600 leading-relaxed">{n}</p>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {BLOCKER_META.map(m => (
                <div key={m.label} className="rounded-[8px] border border-slate-150 px-3 py-2">
                  <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-700">
                    {m.label}
                  </span>
                  <p className="text-[11px] text-slate-600 mt-1">条件: {m.when}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{m.why}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10.5px] text-slate-400">
            数値はいずれも推定です。判断はカードから個社ページへ進み、根拠を確認のうえ行ってください。
          </p>
        </div>
      )}
    </section>
  );
}

function LaneSection({ lane, items }: { lane: BoardLane; items: BoardItem[] }) {
  const meta = LANE_META[lane];
  const Icon = meta.icon;

  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2 px-0.5">
        <h2 className="text-[13.5px] font-bold text-slate-900 flex items-center gap-1.5">
          <Icon className="w-4 h-4 text-slate-500" />
          {meta.title}
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${meta.chip} tabular-nums`}>{items.length}</span>
        </h2>
        <p className="text-[11.5px] text-slate-500">{meta.note}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-slate-200 px-5 py-6 text-center text-[12px] text-slate-400">
          該当なし
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map(item => <CompanyCard key={item.companyUid} item={item} accent={meta.accent} bar={meta.bar} />)}
        </div>
      )}
    </section>
  );
}

// ── カード ────────────────────────────────────────────────────────────────────

function CompanyCard({ item, accent, bar }: { item: BoardItem; accent: string; bar: string }) {
  const r = item.readiness;
  const u = item.usage;

  return (
    <Link href={`/v2/companies/${item.companyUid}?from=readiness`}
      className={`group block rounded-[10px] border border-slate-200 border-l-4 ${accent} bg-white
        shadow-[0_1px_2px_rgba(15,23,42,.06)] hover:shadow-[0_2px_8px_rgba(15,23,42,.10)] hover:border-slate-300 transition`}>
      <div className="px-4 py-3.5">
        {/* 会社名 + スコア */}
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                T{item.tier ?? "—"}
              </span>
              <h3 className="text-[13.5px] font-bold text-slate-900 truncate group-hover:text-blue-700 transition">
                {item.companyName}
              </h3>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span>{item.owner || "担当未設定"}</span>
              <span className="tabular-nums">{formatMrr(item.mrr)}</span>
              {item.blankDays !== null && <span className="tabular-nums">接点 {item.blankDays}日前</span>}
              {item.renewalDate && <span className="tabular-nums">更新 {item.renewalDate}</span>}
              <RenewalBadge bucket={item.renewalBucket} />
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-2xl font-extrabold tabular-nums leading-none ${LEVEL_TEXT[r.overall]}`}>
              {r.overallScore ?? "—"}
            </div>
            <div className="text-[9.5px] font-bold tracking-wide text-slate-400 uppercase mt-0.5">準備度</div>
          </div>
        </div>

        {/* 4要素のミニバー */}
        <div className="flex gap-1.5 mt-3">
          {FACTOR_KEYS.map(key => {
            const f = r.factors[key];
            return (
              <div
                key={key}
                className="flex-1"
                title={`${FACTOR_META[key].label}｜${FACTOR_META[key].question}\n算出: ${FACTOR_META[key].basis}\n低いとき: ${FACTOR_META[key].lowMeans}\n準備度への重み: ${Math.round(FACTOR_META[key].weight * 100)}%`}
              >
                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${bar} rounded-full`} style={{ width: `${f.score ?? 0}%` }} />
                </div>
                {/* 見出しは正式名を出す。横並びだと収まらないので縦に積む */}
                <div className="mt-1">
                  <div className="text-[9.5px] text-slate-400 leading-tight whitespace-nowrap">
                    {FACTOR_META[key].short}
                  </div>
                  <div className="text-[12px] font-bold text-slate-600 tabular-nums leading-tight">
                    {f.score ?? "—"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 利用実態 */}
        {u && (
          <div className="text-[11px] text-slate-500 mt-2.5 flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums">
            {/* 施策は在庫数なので、直近30日の公開本数を必ず併記する。
                実測で「稼働5本以上なのに30日間公開0本」が48件あった */}
            <span
              className="cursor-help"
              title={
                u.campaign
                  ? `稼働中 ${u.campaigns}本（在庫）\n30日: 作成${u.campaign.created30d}本・公開${u.campaign.ran30d}本`
                    + (u.campaign.daysSinceLastRun !== null ? `\n最終公開 ${u.campaign.daysSinceLastRun}日前` : '')
                    + `\n\n${usageHint("campaigns")}`
                  : usageHint("campaigns")
              }
            >
              施策 {u.campaigns}
              {u.campaign && (
                <span className={u.campaign.ran30d === 0 ? "text-red-600 font-semibold" : "text-slate-400"}>
                  （30日 {u.campaign.ran30d}）
                </span>
              )}
            </span>
            {/* 分析は30日の実測。累計ヒートマップは表示しない（今使っているかが分からないため） */}
            <span className="cursor-help" title={usageHint("heatmaps")}>
              分析 {u.deepPv === null ? "—" : u.deepPv.toLocaleString("ja-JP")}
            </span>
            {u.pvRate !== null && (
              <span className="cursor-help" title={`${u.pvNote}\n\n${usageHint("pvRate")}`}>
                PV {u.pvRate}%
              </span>
            )}
            {u.operators !== null && (
              <span
                className={`cursor-help ${u.operators === 0 ? "text-red-600 font-semibold" : u.operators === 1 ? "text-amber-700" : ""}`}
                title={`直近4週に管理画面を触った顧客側の人数（社内アカウントは除外）\n${
                  u.operatorsPrev !== null ? `その前の4週: ${u.operatorsPrev}人\n` : ""
                }1人の場合、担当者が抜けると運用が止まります`}
              >
                運用 {u.operators}人
              </span>
            )}
            {u.habituation === false && (
              <span className="text-red-600 font-semibold cursor-help" title={usageHint("habituation")}>習慣化なし</span>
            )}
            {item.paidProjectCount > 1 && <span className="text-slate-400">有料PJ {item.paidProjectCount}</span>}
          </div>
        )}

        {/* 30日の利用判定。休眠・契約済み未使用は提案の可否に直結する */}
        {u?.moduleVerdict && ["dormant", "unused", "partial"].includes(u.moduleVerdict) && (
          <div className="flex flex-wrap gap-1 mt-2">
            <span
              title={MODULE_VERDICT_META[u.moduleVerdict].hint}
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded cursor-help ${
                u.moduleVerdict === "partial" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
              }`}
            >
              30日: {MODULE_VERDICT_META[u.moduleVerdict].label}
            </span>
            {u.unusedEntitled.map(p => (
              <span key={p} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                {p} 未使用
              </span>
            ))}
          </div>
        )}

        {/* ブロッカー */}
        {item.blockers.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {item.blockers.slice(0, 4).map((b, i) => (
              <span key={i} title={blockerHint(b)}
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-700 cursor-help">
                {b}
              </span>
            ))}
            {item.blockers.length > 4 && (
              <span className="text-[10px] text-slate-400">+{item.blockers.length - 4}</span>
            )}
          </div>
        )}

        {/* 外部機会を当てたら型が変わる場合のヒント */}
        {item.playIfOpportunity && (
          <div className="text-[11px] text-slate-500 mt-2.5 pt-2.5 border-t border-slate-100 flex items-center gap-1.5">
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            外部機会を掴めば
            <span className="font-bold text-slate-700">
              {item.playIfOpportunity === "expand" ? "拡張提案"
                : item.playIfOpportunity === "connect" ? "接続提案"
                : item.playIfOpportunity === "deepen" ? "深化" : "立て直し"}
            </span>
            へ
          </div>
        )}

        {/* 判定を押し下げた理由 */}
        {r.caps.length > 0 && (
          <div className="text-[10.5px] text-amber-700 mt-2 flex items-start gap-1">
            <TrendingDown className="w-3 h-3 shrink-0 mt-px" />
            <span>{r.caps[0]}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
