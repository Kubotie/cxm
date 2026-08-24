"use client";

// ─── プロジェクト詳細（30日の管理画面利用）───────────────────────────────────
//
// 一覧（/v2/projects）では概要しか出せないので、ここで内訳まで見せる。
//
// 戻り先は `?from=` で受け取る:
//   from=company:<uid>  → その会社の詳細ページへ戻す
//   from=list（既定）    → プロジェクト分析の一覧へ戻す
// ブラウザバックに任せると、会社ページから来たのか一覧から来たのかで
// 戻り先が変わることを担当者が予測できない。**明示的に持たせる。**

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Loader2, AlertCircle, ChevronLeft, ExternalLink, Info, AlertTriangle,
} from "lucide-react";
import { InfoTip } from "@/components/ui/info-tip";
import { ACTIVITY_META } from "@/lib/company/campaign-signals";
import type { ProjectDetailResponse } from "@/app/api/projects/[projectId]/route";
import { VERDICT_META } from "@/lib/company/module-signals";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { useRegisterAiPageContext } from "@/components/ai";

const TONE: Record<string, { chip: string; bar: string }> = {
  red:   { chip: "bg-red-50 text-red-700",         bar: "bg-red-400" },
  amber: { chip: "bg-amber-50 text-amber-700",     bar: "bg-amber-400" },
  slate: { chip: "bg-slate-100 text-slate-500",    bar: "bg-slate-300" },
  green: { chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-400" },
};

/** 種別ごとの色。回遊は「使っていない」側なので灰色に寄せる */
const TYPE_COLOR: Record<string, string> = {
  分析利用: "bg-sky-400",
  施策構築: "bg-indigo-400",
  施策検証: "bg-emerald-400",
  初期設定: "bg-violet-400",
  転換シグナル: "bg-amber-400",
  購買シグナル: "bg-amber-500",
  回遊:   "bg-slate-300",
  未分類: "bg-slate-200",
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[10px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.06)] ${className}`}>{children}</section>;
}

export function ProjectDetailView({ projectId }: { projectId: string }) {
  const params = useSearchParams();
  const from = params.get("from") ?? "list";

  const [data, setData] = useState<ProjectDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    fetch(`/api/projects/${encodeURIComponent(projectId)}`)
      .then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        return j as ProjectDetailResponse;
      })
      .then(j => { if (alive) setData(j); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [projectId]);

  // 戻り先。会社から来たならその会社へ、そうでなければ一覧へ
  const back = from.startsWith("company:")
    ? { href: `/v2/companies/${from.slice("company:".length)}`, label: "会社ページに戻る" }
    : { href: "/v2/projects", label: "プロジェクト分析に戻る" };

  // ── AI パネルへの申告 ──────────────────────────────────────────────────────
  useRegisterAiPageContext({
    pageId: "v2-project-detail",
    title: "プロジェクト詳細",
    description:
      "1プロジェクトの機能ごとの利用内訳・種別構成・契約との差分を見る画面。"
      + "一覧では出せない「何がどれだけ使われているか」をここで確認する。",
    snapshot: data ?? { projectId, 状態: "未取得" },
    hints: { projectId, 遷移元: from, 読込中: loading, エラー: error },
    sources: [
      {
        label: "プロジェクト詳細",
        endpoint: `/api/projects/${projectId}`,
        description: "この画面の全データ",
      },
    ],
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-slate-400 py-24">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">プロジェクトの利用状況を読み込んでいます…</span>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="px-4 py-4 space-y-3 max-w-[1200px] mx-auto">
        <Link href={back.href} className="inline-flex items-center gap-1 text-[12px] text-slate-600 hover:text-slate-900">
          <ChevronLeft className="w-3.5 h-3.5" />{back.label}
        </Link>
        <Card className="px-5 py-4">
          <div className="flex items-start gap-2 text-red-600 text-[12.5px]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-px" />{error ?? "取得できませんでした"}
          </div>
        </Card>
      </div>
    );
  }

  const m = VERDICT_META[data.module.verdict];

  return (
    <div className="px-4 py-4 space-y-3 max-w-[1200px] mx-auto">
      {/* ── 戻る導線 ── */}
      <Link href={back.href} className="inline-flex items-center gap-1 text-[12px] text-slate-600 hover:text-slate-900">
        <ChevronLeft className="w-3.5 h-3.5" />{back.label}
      </Link>

      {/* ── 見出し ── */}
      <Card className="px-5 py-4">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[15px] font-bold text-slate-900">{data.projectName}</h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TONE[m.tone].chip}`} title={m.hint}>
                {m.label}
              </span>
              {data.paidType && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                  {data.paidType}
                </span>
              )}
            </div>
            <div className="text-[11.5px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-3">
              {data.companyUid ? (
                <Link href={`/v2/companies/${data.companyUid}`} className="text-blue-700 hover:underline inline-flex items-center gap-0.5">
                  {data.companyName}<ExternalLink className="w-3 h-3" />
                </Link>
              ) : (
                <span>{data.companyName ?? "会社未紐付け"}</span>
              )}
              {data.tier && <span>Tier {data.tier}</span>}
              {data.owner && <span>担当 {data.owner}</span>}
              <span className="tabular-nums">ID {data.projectId}</span>
              {data.period.start && (
                <span className="tabular-nums">{data.period.start} 〜 {data.period.end}（30日）</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-0.5">
          {/* 全体の結論を先に置く。数値タイルだけでは読み解けない */}
          {data.headline && (
            <p className="text-[13px] text-slate-900 leading-relaxed border-l-[3px] border-slate-900 pl-3">
              {data.headline}
            </p>
          )}
          {data.actions.length > 0 && (
            <div className="mt-2">
              <div className="text-[11px] font-bold text-emerald-700">手を入れられる点</div>
              <ul className="mt-0.5 space-y-0.5">
                {data.actions.map((a, i) => (
                  <li key={i} className="text-[11.5px] text-emerald-800 flex gap-1.5">
                    <span className="text-emerald-300 shrink-0">・</span><span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.module.opportunities.map((o, i) => (
            <p key={i} className="text-[12.5px] text-emerald-700">機会: {o}</p>
          ))}
        </div>
      </Card>

      {/* ── 主要な数値 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <Stat label="実利用PV" value={data.module.activePv} tip="30日の管理画面PVのうち、着地画面（回遊）を除いたもの" />
        <Stat label="分析・検証PV" value={data.module.deepPv} tip="うち「分析利用」と「施策検証」。準備度の利用充足はこの値で配点します" />
        <Stat label="機能数" value={data.module.activeModuleCount} tip="30日に実際に触った機能の数（着地画面を除く）" />
        <Stat label="総PV" value={data.totalPv} tip="回遊を含む管理画面PVの合計（辞書にある機能のみ）" />
        <Stat label="L30 活動" value={data.metrics.l30Active} tip="過去30日のアクティブイベント数（計測タグ側）" />
        <Stat label="稼働施策" value={data.metrics.campaignCount} tip="目標付きの実行中キャンペーン数" />
        <Stat label="PV消化" value={data.metrics.pvRate} suffix="%" tip="当月実測PV ÷ 契約PV上限" />
      </div>

      {/* ── 契約と利用の差分 ── */}
      <Card className="px-5 py-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-[12.5px] font-bold text-slate-800">契約と利用</h2>
          <InfoTip text="契約プランで使えるはずの製品と、30日で実際に触った製品を比べています。差があれば追加購入なしで価値を出せる余地です。" />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-[12px]">
          <div>
            <div className="text-[10.5px] text-slate-400">契約している製品</div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {data.module.entitled.length === 0
                ? <span className="text-slate-400">—</span>
                : data.module.entitled.map(p => (
                    <span key={p} className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{p}</span>
                  ))}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] text-slate-400">30日で使った製品</div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {data.module.used.length === 0
                ? <span className="text-slate-400">なし</span>
                : data.module.used.map(p => (
                    <span key={p} className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">{p}</span>
                  ))}
            </div>
          </div>
          {data.module.unusedEntitled.length > 0 && (
            <div>
              <div className="text-[10.5px] text-slate-400">契約済みで未使用</div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {data.module.unusedEntitled.map(p => (
                  <span key={p} className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{p}</span>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="text-[10.5px] text-slate-400">A/Bテスト</div>
            <div className="mt-0.5 text-[11.5px]">
              {data.module.runsAbTest
                ? <span className="text-emerald-700 font-semibold">運用中</span>
                : <span className="text-slate-400">未運用</span>}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] text-slate-400 inline-flex items-center gap-1">
              ヒートマップ<InfoTip text="リストへの到達までしか計測できません。閲覧そのものは顧客ドメインへ遷移するため、このデータでは分かりません。" />
            </div>
            <div className="mt-0.5 text-[11.5px]">
              {data.module.reachedHeatmapList
                ? <span className="text-slate-700">リスト到達あり</span>
                : <span className="text-slate-400">到達なし</span>}
            </div>
          </div>
        </div>
      </Card>

      {/* 施策の動き。「稼働N本」は在庫数なので直近と必ず併記する */}
      {data.campaign && (() => {
        const c = data.campaign!;
        const meta = ACTIVITY_META[c.activity];
        const tone: Record<string, string> = {
          red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-700",
          slate: "bg-slate-100 text-slate-500", green: "bg-emerald-50 text-emerald-700",
        };
        return (
          <Card className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[13px] font-bold text-slate-900">施策の動き</h2>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tone[meta.tone]}`} title={meta.hint}>
                {meta.label}
              </span>
              <InfoTip text="「稼働中」は在庫数で時間の概念がありません。実測で「稼働5本以上なのに30日間1本も公開していない」有料PJが48件ありました。直近30日と最終公開を必ず併せて見てください。" />
            </div>

            <div className="mt-2.5 grid grid-cols-2 md:grid-cols-5 gap-3">
              <Metric label="稼働中（在庫）" value={`${c.running}本`} />
              <Metric label="30日に公開" value={`${c.ran30d}本`} warn={c.ran30d === 0 && c.running > 0} />
              <Metric label="30日に作成" value={`${c.created30d}本`} />
              <Metric label="最終公開"
                value={c.daysSinceLastRun === null ? "—" : `${c.daysSinceLastRun}日前`}
                warn={c.daysSinceLastRun !== null && c.daysSinceLastRun > 60} />
              <Metric label="ゴール未設定の配信" value={`${c.runningWithoutGoal}本`} warn={c.runningWithoutGoal > 0} />
            </div>

            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-slate-500">
              {c.publishRate !== null && <span>公開率 {Math.round(c.publishRate * 100)}%</span>}
              {c.abTestRate !== null && <span>A/Bテスト率 {Math.round(c.abTestRate * 100)}%</span>}
              {c.untitledRate !== null && <span>無題率 {Math.round(c.untitledRate * 100)}%</span>}
            </div>

            {c.opportunities.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {c.opportunities.map((o, i) => (
                  <li key={i} className="text-[11.5px] text-emerald-700">機会: {o}</li>
                ))}
              </ul>
            )}
            <p className="text-[10.5px] text-slate-400 mt-2">
              停止時刻・最終更新・成果の列はデータに含まれません。PAUSED は現在の状態であって履歴ではありません。
            </p>
          </Card>
        );
      })()}

      {/* ── 何に時間を使っているか ── */}
      {/* 週次の稼働（誰が動かしているか）。機能内訳より先に見たい情報 */}
      {data.accounts && data.accounts.series.length > 0 && (
        <AccountActivityChart accounts={data.accounts} />
      )}

      {data.bySignalType.length > 0 && (
        <Card className="px-5 py-4">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[12.5px] font-bold text-slate-800">何に時間を使っているか</h2>
            <InfoTip text="灰色の「回遊」は着地画面（プロジェクトホーム／データセンター）です。利用としては数えていません。ここだけが伸びている場合、ログインしただけの状態です。" />
          </div>
          <div className="mt-2 flex h-5 rounded overflow-hidden bg-slate-100">
            {data.bySignalType.map(t => (
              <div key={t.signalType} title={`${t.signalType} ${t.pv.toLocaleString("ja-JP")}PV（${t.share}%）`}
                className={TYPE_COLOR[t.signalType] ?? "bg-slate-300"}
                style={{ width: `${t.share}%` }} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {data.bySignalType.map(t => (
              <span key={t.signalType} className="text-[11.5px] inline-flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm ${TYPE_COLOR[t.signalType] ?? "bg-slate-300"}`} />
                <span className={t.countable ? "text-slate-700" : "text-slate-400"}>{t.signalType}</span>
                <span className="tabular-nums text-slate-500">{t.pv.toLocaleString("ja-JP")}PV</span>
                <span className="tabular-nums text-slate-400">{t.share}%</span>
                {!t.countable && <span className="text-[10px] text-slate-400">（利用に数えない）</span>}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* ── 機能ごとの内訳 ── */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-slate-100">
          <h2 className="text-[12.5px] font-bold text-slate-800">機能ごとの内訳</h2>
          <span className="text-[11px] text-slate-400">{data.modules.length}機能</span>
        </div>
        {data.modules.length === 0 ? (
          <p className="px-5 py-8 text-center text-[12.5px] text-slate-400">
            30日間、管理画面へのアクセスがありません。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">機能</th>
                  <th className="text-left font-medium px-3 py-2.5">製品</th>
                  <th className="text-left font-medium px-3 py-2.5">種別</th>
                  <th className="text-right font-medium px-3 py-2.5">PV</th>
                  <th className="text-left font-medium px-3 py-2.5 w-40">構成比</th>
                  <th className="text-left font-medium px-3 py-2.5">注意</th>
                </tr>
              </thead>
              <tbody>
                {data.modules.map(mod => (
                  <tr key={mod.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800" title={mod.description}>{mod.label}</div>
                      <div className="text-[10px] text-slate-400">{mod.id}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{mod.product}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        ["回遊", "未分類"].includes(mod.signalType) ? "bg-slate-100 text-slate-400" : "bg-slate-100 text-slate-600"
                      }`}>
                        {mod.signalType}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{mod.pv.toLocaleString("ja-JP")}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${TYPE_COLOR[mod.signalType] ?? "bg-slate-300"}`}
                            style={{ width: `${mod.share}%` }} />
                        </div>
                        <span className="text-[10.5px] tabular-nums text-slate-400 w-9 text-right">{mod.share}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 max-w-[26rem]">
                      {mod.caution && (
                        <span className="text-[11px] text-amber-700 inline-flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                          <span title={mod.caution}>{mod.caution.slice(0, 70)}{mod.caution.length > 70 ? "…" : ""}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.excluded.length > 0 && (
          <p className="px-5 py-2.5 text-[11px] text-slate-400 border-t border-slate-100 flex items-start gap-1">
            <Info className="w-3 h-3 shrink-0 mt-0.5" />
            {data.excluded.map(e => `${e.reason}: ${e.pv.toLocaleString("ja-JP")}PV`).join(" / ")}
          </p>
        )}
      </Card>

      <p className="text-[10.5px] text-slate-400 px-1 leading-relaxed">
        管理画面のモジュール単位アクセス（過去30日の実測）です。
        着地画面（プロジェクトホーム／データセンター）は利用として数えていません。
        辞書に定義の無いモジュールは集計から除いています。
      </p>
    </div>
  );
}

function Stat({ label, value, suffix = "", tip }: {
  label: string; value: number | null; suffix?: string; tip: string;
}) {
  return (
    <div className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-2.5" title={tip}>
      <div className="text-[10px] font-bold tracking-wide text-slate-400 inline-flex items-center gap-1">
        {label}<InfoTip text={tip} />
      </div>
      <div className="text-lg font-extrabold tabular-nums text-slate-900 leading-tight mt-0.5">
        {value === null ? "—" : value.toLocaleString("ja-JP")}{value !== null && suffix}
      </div>
    </div>
  );
}

// ─── 週次のアカウント別稼働 ───────────────────────────────────────────────────
//
// 「誰が何日触っているか」を週単位で見る。
// **社内アカウント（@ptmind.com）は破線・グレーで区別する。** 運用人数には数えない。
// 我々が触っているのを顧客の運用と読むと、伴走している顧客ほど体制があるように見える。

/**
 * 直近4週に何を見ていたか。
 * 「Experienceしか触っていない」＝ Insight の価値が届いていない、が読める。
 */
const ROLE_META: Record<string, { label: string; chip: string }> = {
  insight:    { label: "Insight中心",    chip: "bg-sky-50 text-sky-700" },
  experience: { label: "Experience中心", chip: "bg-violet-50 text-violet-700" },
  both:       { label: "両方",           chip: "bg-emerald-50 text-emerald-700" },
  idle:       { label: "閲覧なし",       chip: "bg-slate-100 text-slate-500" },
};

/** 顧客側の系列色。多くても6人までは区別できる */
const SERIES_COLORS = ["#7c6bd6", "#e8836f", "#4a9d7f", "#d4a13c", "#5b8fc9", "#c2739e"];

function AccountActivityChart({ accounts }: { accounts: NonNullable<ProjectDetailResponse["accounts"]> }) {
  const [showInternal, setShowInternal] = useState(true);

  const series = accounts.series.filter(s => showInternal || !s.internal);

  // ⚠️ recharts の dataKey は **ドットをネストパスとして解釈する**。
  // メールアドレスをそのまま dataKey にすると `a@mynavi.jp` が
  // row["a@mynavi"]["jp"] と解決されて全系列が undefined になり、チャートが消える。
  // キーは index 由来の安全な文字列にし、表示名は name で渡す。
  const keyOf = (i: number) => `s${i}`;
  const rows = accounts.weeks.map((w, wi) => {
    const row: Record<string, string | number> = { week: w.slice(5) };
    series.forEach((s, si) => { row[keyOf(si)] = s.activeDays[wi] ?? 0; });
    return row;
  });

  const colorOf = (email: string, internal: boolean) => {
    if (internal) return "#cbd5e1";
    const idx = accounts.series.filter(x => !x.internal).findIndex(x => x.email === email);
    return SERIES_COLORS[idx % SERIES_COLORS.length] ?? "#94a3b8";
  };

  return (
    <Card className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[13px] font-bold text-slate-900">週次の稼働（アカウント別）</h2>
        <InfoTip text="各アカウントがその週に管理画面を触った日数です。社内アカウント（@ptmind.com）はグレーで表示し、運用人数には数えていません。" />
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11.5px] text-slate-500">
            運用 <span className="font-bold text-slate-800 tabular-nums">{accounts.operators}人</span>
            {accounts.operatorsPrev !== accounts.operators && (
              <span className="text-slate-400">（4週前 {accounts.operatorsPrev}人）</span>
            )}
          </span>
          {accounts.internalOperators > 0 && (
            <span className="text-[11.5px] text-slate-400">社内 {accounts.internalOperators}人</span>
          )}
          <label className="inline-flex items-center gap-1 text-[11.5px] text-slate-500 cursor-pointer">
            <input type="checkbox" checked={showInternal} onChange={e => setShowInternal(e.target.checked)} className="accent-slate-900" />
            社内を含める
          </label>
        </div>
      </div>

      {accounts.singleOperator && (
        <p className="text-[11.5px] text-amber-700 mt-1">
          運用が1人に依存しています。担当者が抜けると止まります。
        </p>
      )}

      <div className="h-[280px] mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false}
              label={{ value: "稼働日数", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#94a3b8" } }} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
              formatter={(v: number, name: string) => [`${v}日`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 10.5 }} iconSize={8} />
            {series.map((s, si) => (
              <Area
                key={s.email}
                type="monotone"
                dataKey={keyOf(si)}
                name={s.internal ? `${s.email}（社内）` : s.email}
                stackId="1"
                stroke={colorOf(s.email, s.internal)}
                fill={colorOf(s.email, s.internal)}
                fillOpacity={s.internal ? 0.25 : 0.45}
                strokeDasharray={s.internal ? "4 3" : undefined}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 誰が何を見ているか。役割が分かれていると、片方の製品の価値が届いていない */}
      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="text-[12px] font-bold text-slate-800">直近4週に見ていたもの</h3>
          <InfoTip text="各アカウントが直近4週に見たPVの内訳です。8割以上が片方に寄っていれば「〜中心」とします。役割が分かれている場合、片方の製品の価値がその人に届いていません。" />
          {accounts.untouchedProducts.length > 0 && (
            <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
              顧客側が {accounts.untouchedProducts.join("・")} を4週間見ていません
            </span>
          )}
        </div>

        <div className="mt-2 space-y-1">
          {accounts.series.filter(a => showInternal || !a.internal).map(a => {
            const r = ROLE_META[a.role] ?? ROLE_META.idle;
            const total = a.recentPtiPv + a.recentPtxPv;
            const ptiShare = total > 0 ? (a.recentPtiPv / total) * 100 : 0;
            return (
              <div key={a.email} className="flex flex-wrap items-center gap-2 text-[11.5px]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorOf(a.email, a.internal) }} />
                <span className={`min-w-0 truncate max-w-[18rem] ${a.internal ? "text-slate-400" : "text-slate-800"}`}>
                  {a.email}{a.internal && "（社内）"}
                </span>
                <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded shrink-0 ${r.chip}`}>{r.label}</span>
                {total > 0 && (
                  <>
                    <div className="flex h-1.5 w-24 rounded-full overflow-hidden bg-slate-100 shrink-0"
                         title={`Insight ${a.recentPtiPv.toLocaleString("ja-JP")}PV / Experience ${a.recentPtxPv.toLocaleString("ja-JP")}PV`}>
                      <div className="bg-sky-400" style={{ width: `${ptiShare}%` }} />
                      <div className="bg-violet-400" style={{ width: `${100 - ptiShare}%` }} />
                    </div>
                    <span className="text-[10.5px] text-slate-400 tabular-nums shrink-0">
                      I {a.recentPtiPv.toLocaleString("ja-JP")} / X {a.recentPtxPv.toLocaleString("ja-JP")}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10.5px] text-slate-400 mt-3">
        出所: Metabase（Project Relation Account ActiveDays by week）／
        {accounts.weeks[0]} 〜 {accounts.weeks.at(-1)}
      </p>
    </Card>
  );
}

function Metric({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold tracking-wide text-slate-400">{label}</div>
      <div className={`text-[15px] font-bold tabular-nums mt-0.5 ${warn ? "text-amber-700" : "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
}
