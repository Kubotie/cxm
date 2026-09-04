"use client";

// ─── 解約レーダー：精度パネル ─────────────────────────────────────────────────
//
// 設計: docs-src/cxm_v2/19_Churn_Radar_Design.md §5.4
//
// **これが無いと閾値が誰にも触れなくなる。** 実際に解約した企業に対して何日前に鳴っていたか、
// 現場が「誤検知」と判断した割合はいくつか ─ この2つが閾値を動かす唯一の根拠になる。
//
// 検知率は高いほど良いが、**常時点灯していれば自動的に高くなる**。
// リードタイムが窓の上限（180日）に張り付いている社が多い＝鳴りっぱなしなので、
// 検知率とセットで「点灯している社の割合」も並べて出す。

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import type { RadarAccuracyResponse } from "@/app/api/radar/accuracy/route";

export default function AccuracyView() {
  const [data, setData]   = useState<RadarAccuracyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/radar/accuracy?window_days=180&limit=40")
      .then(async r => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "取得に失敗しました");
        return json as RadarAccuracyResponse;
      })
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-16 bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-3">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <AlertCircle className="w-4 h-4 text-red-600" />読み込めませんでした
        </div>
        <p className="text-[13px] text-slate-600">{error}</p>
        <Link href="/v2/radar" className="text-[12px] text-blue-700 hover:underline">← レーダーに戻る</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid place-items-center h-64 text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-xs">解約企業の判定を再生しています（1分ほどかかります）</span>
      </div>
    );
  }

  const { detection, falsePositive, distribution } = data;
  const totalCompanies = Object.values(distribution).reduce((a, b) => a + b, 0);
  const litRate = totalCompanies > 0
    ? Math.round((falsePositive.lit / totalCompanies) * 100) : 0;

  return (
    <div className="p-4 md:p-5 flex flex-col gap-3.5">
      <header className="flex flex-col gap-1.5">
        <Link href="/v2/radar"
          className="text-[11.5px] text-slate-500 hover:text-slate-900 transition flex items-center gap-1 w-fit">
          <ArrowLeft className="w-3 h-3" />レーダーに戻る
        </Link>
        <h1 className="text-[17px] font-bold text-slate-900">精度</h1>
        <p className="text-[11.5px] text-slate-500 font-mono">
          {data.window.from} 〜 {data.window.to}（{data.window.days}日）の解約を対象に判定を再生
        </p>
      </header>

      {/* ── 検知 ─────────────────────────────────────────────────────── */}
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat k="解約（期間内）" v={detection.churnedTotal} n="全Tier" />
        <Stat k="判定を再生できた" v={detection.evaluated} n={`材料なし ${detection.churnedTotal - detection.evaluated}`} />
        <Stat k="解約前に点灯していた" v={`${Math.round(detection.detectionRate * 100)}%`}
          n={`${detection.detected} / ${detection.evaluated} 社`} tone="ok" />
        <Stat k="検知リードタイム 中央値" v={detection.medianLeadDays != null ? `${detection.medianLeadDays}日` : "—"}
          n={detection.avgLeadDays != null ? `平均 ${detection.avgLeadDays}日` : "—"} tone="ok" />
      </section>

      <p className="text-[12px] text-slate-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
        検知率は<b>常時点灯していれば自動的に高くなる</b>ので、単独では精度を意味しない。
        いま Tier1–2 の <b>{litRate}%（{falsePositive.lit}/{totalCompanies}社）</b>が点灯中で、
        平均 <b>{falsePositive.avgAgedDays ?? "—"}日</b>鳴り続けている。
        リードタイムが 175 日前後に並ぶ社は「早く気づけた」ではなく「ずっと鳴っている」。
        閾値は<b>誤検知の申告</b>が溜まってから動かす。
      </p>

      {/* ── 誤検知 ───────────────────────────────────────────────────── */}
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat k="点灯中" v={falsePositive.lit} n={`全${totalCompanies}社中`} />
        <Stat k="誤検知と申告" v={falsePositive.dismissed}
          n={`${Math.round(falsePositive.rate * 100)}%`} tone={falsePositive.rate > 0.3 ? "bad" : "plain"} />
        <Stat k="未確認のまま" v={falsePositive.unacked} n="トリアージ待ち"
          tone={falsePositive.unacked > falsePositive.lit / 2 ? "bad" : "plain"} />
        <Stat k="平均放置日数" v={falsePositive.avgAgedDays != null ? `${falsePositive.avgAgedDays}日` : "—"}
          n="点灯中の平均" tone={(falsePositive.avgAgedDays ?? 0) > 60 ? "bad" : "plain"} />
      </section>

      {/* ── 解約企業の内訳 ───────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-slate-100">
          <span className="text-[11.5px] font-bold text-slate-900">解約した企業と、その時点の判定</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-[12.5px]">
            <thead>
              <tr className="text-[10.5px] text-slate-500 border-b border-slate-100">
                <th className="text-left font-bold px-3.5 py-2">解約日</th>
                <th className="text-left font-bold px-3.5 py-2">企業</th>
                <th className="text-right font-bold px-3.5 py-2">点灯リード</th>
                <th className="text-right font-bold px-3.5 py-2">critical リード</th>
                <th className="text-left font-bold px-3.5 py-2">解約時の判定</th>
              </tr>
            </thead>
            <tbody>
              {detection.companies.map(c => (
                <tr key={`${c.companyUid}-${c.churnDate}`} className="border-b border-slate-50 last:border-b-0">
                  <td className="px-3.5 py-2 font-mono text-slate-500 whitespace-nowrap">{c.churnDate}</td>
                  <td className="px-3.5 py-2 text-slate-900">
                    {c.name ?? c.companyUid}
                    {c.note && <span className="ml-2 text-[11px] text-slate-400">{c.note}</span>}
                  </td>
                  <td className={`px-3.5 py-2 text-right font-mono ${
                    c.leadTimeDays === null ? "text-slate-300"
                    : c.leadTimeDays >= 170 ? "text-slate-400" : "text-slate-900"}`}>
                    {c.leadTimeDays !== null ? `${c.leadTimeDays}日前` : "鳴らず"}
                  </td>
                  <td className="px-3.5 py-2 text-right font-mono text-slate-600">
                    {c.criticalLeadDays !== null ? `${c.criticalLeadDays}日前` : "—"}
                  </td>
                  <td className="px-3.5 py-2">
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                      c.stageAtChurn === "critical" ? "bg-red-100 text-red-800"
                      : c.stageAtChurn === "warn" ? "bg-amber-100 text-amber-800"
                      : c.stageAtChurn === "watch" ? "bg-slate-200 text-slate-700"
                      : "bg-emerald-100 text-emerald-800"}`}>
                      {c.stageAtChurn}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ k, v, n, tone }: {
  k: string; v: number | string; n: string; tone?: "ok" | "bad" | "plain";
}) {
  const color = tone === "ok" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 flex flex-col gap-0.5 min-w-0">
      <span className="font-mono text-[10px] text-slate-500 truncate">{k}</span>
      <span className={`font-mono text-[20px] font-semibold leading-tight ${color}`}>{v}</span>
      <span className="text-[10px] text-slate-400 truncate">{n}</span>
    </div>
  );
}
