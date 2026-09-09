"use client";

// ─── 解約レーダー：個社ドリル ─────────────────────────────────────────────────
//
// 設計: docs-src/cxm_v2/19_Churn_Radar_Design.md §5.3
//
// **90日を1本の時間軸に揃える。** 上段に4本の系列、下段に同じ軸で出来事を打つ。
// 「4/7 の重大バグ → 6月以降の施策減 → 議事録の途絶」が縦に並んで初めて因果が読める。
// そのまま上長・顧客に見せる資料になることを想定している。

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, ArrowLeft, AlertCircle, MessageSquareQuote, Ticket,
  UserRoundCog, Radio, TrendingDown, ExternalLink,
} from "lucide-react";
import { useRegisterAiPageContext } from "@/components/ai";
import { STAGE_COLOR } from "@/lib/churn/radar-scope";
import type {
  RadarCompanyResponse, RadarTimelineEvent, RadarEventKind, RadarVoiceItem,
} from "@/app/api/radar/company/[companyUid]/route";
import type { RadarStage } from "@/lib/churn/radar-rules";
import type { AckStatus } from "@/lib/churn/radar-state";

// ── 表示メタ ──────────────────────────────────────────────────────────────────

const STAGE_LABEL: Record<string, { text: string; chip: string }> = {
  critical: { text: "critical・今週やる",   chip: "bg-red-100 text-red-800" },
  warn:     { text: "warn・更新前に接触",   chip: "bg-amber-100 text-amber-800" },
  watch:    { text: "watch・落ち始め",     chip: "bg-slate-200 text-slate-700" },
  clear:    { text: "clear・点灯なし",     chip: "bg-emerald-100 text-emerald-800" },
};

const KIND_META: Record<RadarEventKind, { icon: React.ElementType; color: string }> = {
  stage:        { icon: Radio,            color: "#b42318" },
  voice:        { icon: MessageSquareQuote, color: "#b42318" },
  ticket_open:  { icon: Ticket,           color: "#b54708" },
  ticket_close: { icon: Ticket,           color: "#067647" },
  owner_change: { icon: UserRoundCog,     color: "#475467" },
  contact:      { icon: TrendingDown,     color: "#475467" },
};

const ACK_TEXT: Record<AckStatus, string> = {
  none: "未確認", ack: "見た", working: "対応中", watching: "様子見", dismissed: "誤検知",
};

function yen(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `¥${Math.round(n / 1_000)}K`;
  return `¥${n}`;
}

// ── スパークライン ────────────────────────────────────────────────────────────

/**
 * 4本の系列は**同じ横軸**（左＝90日前、右＝今日）で描く。
 * 軸を揃えないと、上下に並べても因果が読めない。
 */
function Spark({ label, value, tone, points, area, max }: {
  label: string; value: string; tone: "bad" | "warn" | "plain";
  points: Array<number | null>; area?: boolean; max?: number;
}) {
  const color = tone === "bad" ? "#b42318" : tone === "warn" ? "#b54708" : "#475467";
  const W = 120, H = 30;
  const top = max ?? Math.max(1, ...points.filter((v): v is number => v != null));

  // null は描かない（記録が無い日と 0 の日は違う）
  const segs: string[] = [];
  let cur: string[] = [];
  points.forEach((v, i) => {
    if (v == null) { if (cur.length > 1) segs.push(cur.join(" ")); cur = []; return; }
    const x = (i / Math.max(1, points.length - 1)) * W;
    const y = H - 3 - (v / top) * (H - 6);
    cur.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (cur.length > 1) segs.push(cur.join(" "));

  const last = [...points].reverse().find(v => v != null) ?? null;
  const lastX = W;
  const lastY = last != null ? H - 3 - (last / top) * (H - 6) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 flex flex-col gap-1.5 min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10.5px] text-slate-500 truncate">{label}</span>
        <span className={`font-mono text-[13.5px] font-semibold flex-none ${
          tone === "bad" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-slate-900"}`}>
          {value}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} height={30} className="w-full" preserveAspectRatio="none" aria-hidden="true">
        {area && segs.length > 0 && (
          <polygon points={`0,${H} ${segs[0]} ${W},${H}`} fill={color} opacity="0.1" />
        )}
        {segs.map((s, i) => (
          <polyline key={i} points={s} fill="none" stroke={color} strokeWidth="1.5"
            vectorEffect="non-scaling-stroke" />
        ))}
        {lastY != null && <circle cx={lastX - 1.5} cy={lastY} r="2" fill={color} />}
      </svg>
    </div>
  );
}

// ── 本体 ──────────────────────────────────────────────────────────────────────

export default function DrillView({ companyUid }: { companyUid: string }) {
  const [data, setData]   = useState<RadarCompanyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyVoice, setBusyVoice] = useState<string | null>(null);

  // 言質のレビュー。承認しても反映は次回走査から（その旨を UI にも出す）
  const reviewVoice = async (voiceId: string, status: "confirmed" | "rejected" | "pending") => {
    setBusyVoice(voiceId);
    try {
      const res = await fetch(`/api/radar/voice/${encodeURIComponent(voiceId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存に失敗しました");
      setData(prev => prev && ({
        ...prev,
        voices: prev.voices.map(v =>
          v.voiceId === voiceId ? { ...v, reviewStatus: status, reviewedBy: json.reviewedBy } : v),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyVoice(null);
    }
  };

  useEffect(() => {
    fetch(`/api/radar/company/${companyUid}`)
      .then(async r => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "取得に失敗しました");
        return json as RadarCompanyResponse;
      })
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, [companyUid]);

  const series = data?.series ?? [];

  const latest = useMemo(() => {
    const withSeat = [...series].reverse().find(s => s.seatTotal != null);
    const withCamp = [...series].reverse().find(s => s.campaigns != null);
    const contacts = series.filter(s => s.contact);
    const lastContact = contacts.length > 0 ? contacts[contacts.length - 1].date : null;
    const blank = lastContact
      ? Math.round((Date.parse(series[series.length - 1].date) - Date.parse(lastContact)) / 86400_000)
      : null;
    return {
      seat: withSeat ?? null,
      camp: withCamp?.campaigns ?? null,
      campPeak: Math.max(0, ...series.map(s => s.campaigns ?? 0)),
      blank,
      openTickets: series[series.length - 1]?.openTickets ?? 0,
    };
  }, [series]);

  useRegisterAiPageContext({
    pageId: "v2-radar-company",
    title: data ? `解約レーダー：${data.name}` : "解約レーダー：個社",
    description:
      "1社の90日を1本の時間軸に揃えた画面。席の稼働率・稼働施策・接触・未解決チケットの系列と、"
      + "同じ軸に並ぶ出来事（点灯／悪化／チケット／担当交代／言質）から解約予兆の因果を読む。",
    snapshot: data ? {
      name: data.name, stage: data.stage, score: data.score,
      daysToRenewal: data.daysToRenewal, agedDays: data.agedDays,
      topReason: data.topReason,
      signals: data.current.signals.map(s => `${s.id} ${s.label}: ${s.detail}`),
      missing: data.current.missing,
      events: data.events.map(e => `${e.date} ${e.label}${e.detail ? `：${e.detail}` : ""}`),
      coverage: data.coverage,
    } : {},
    hints: { companyUid, エラー: error },
    sources: [{
      label: "個社の90日時系列",
      endpoint: `/api/radar/company/${companyUid}`,
      description: "系列・出来事・判定根拠の全データ",
    }],
  });

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
        <span className="text-xs">90日ぶんの材料を集めています</span>
      </div>
    );
  }

  const stageMeta = STAGE_LABEL[data.stage] ?? STAGE_LABEL.clear;
  const seatRatio = latest.seat && latest.seat.seatTotal
    ? (latest.seat.seatActive ?? 0) / latest.seat.seatTotal : null;

  return (
    <div className="p-4 md:p-5 flex flex-col gap-3.5">
      {/* ── ヘッダー ───────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-2">
        <Link href="/v2/radar"
          className="text-[11.5px] text-slate-500 hover:text-slate-900 transition flex items-center gap-1 w-fit">
          <ArrowLeft className="w-3 h-3" />レーダーに戻る
        </Link>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[17px] font-bold text-slate-900 flex items-center gap-2 flex-wrap">
              {data.name}
              <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${stageMeta.chip}`}>
                {stageMeta.text}
              </span>
            </h1>
            <p className="text-[11.5px] text-slate-500 mt-1 font-mono">
              {data.tier != null ? `Tier${data.tier}` : "Tier—"} ／ 担当 {data.ownerName ?? "—"} ／ {yen(data.mrr)}／月 ／
              更新 {data.renewalDate ?? "—"}
              {data.daysToRenewal != null && `（残り${data.daysToRenewal}日）`}
              {data.firstDetectedAt && ` ／ 初回点灯 ${data.firstDetectedAt}`}
            </p>
          </div>
          <div className="text-right">
            <div className={`font-mono text-[19px] font-semibold leading-none ${
              (data.agedDays ?? 0) >= 60 ? "text-red-700"
              : (data.agedDays ?? 0) >= 21 ? "text-amber-700" : "text-slate-700"}`}>
              {data.agedDays ?? "—"}<span className="text-[11px] ml-0.5">日</span>
            </div>
            <div className="text-[10px] text-slate-400 tracking-wide">
              鳴りっぱなし・{ACK_TEXT[data.ackStatus]}
              {data.ackBy ? `（${data.ackBy}）` : ""}
            </div>
          </div>
        </div>
        {data.topReason && (
          <p className="text-[13px] text-slate-900 leading-relaxed bg-white border border-slate-200 border-l-2 border-l-slate-400 px-3 py-2 rounded-r-lg">
            {data.topReason}
          </p>
        )}
      </header>

      {/* ── 4本の系列 ─────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Spark
          label="席の稼働率"
          value={latest.seat?.seatTotal
            ? `${latest.seat.seatActive ?? 0}/${latest.seat.seatTotal}` : "—"}
          tone={seatRatio != null && seatRatio < 0.2 ? "bad" : "plain"}
          points={series.map(s => s.seatRatio)}
          max={1} area
        />
        <Spark
          // 系列は90日窓。180日窓で見る D5 の数字（判定文に出るピーク）とは母数が違うので、
          // 「90日ピーク → 現在」と読める形にして混同を避ける
          label="稼働施策（90日）"
          value={latest.camp != null
            ? (latest.campPeak > latest.camp ? `${latest.campPeak} → ${latest.camp}` : String(latest.camp))
            : "—"}
          tone={latest.camp != null && latest.campPeak >= 2 && latest.camp <= latest.campPeak / 2 ? "bad" : "plain"}
          points={series.map(s => s.campaigns)}
          area
        />
        <Spark
          label="接触"
          value={latest.blank != null ? `${latest.blank}日空白` : "記録なし"}
          tone={latest.blank != null && latest.blank >= 60 ? "bad" : latest.blank != null && latest.blank >= 30 ? "warn" : "plain"}
          points={series.map(s => (s.contact ? 1 : 0))}
          max={1}
        />
        <Spark
          label="未解決チケット"
          value={`${latest.openTickets}件`}
          tone={latest.openTickets > 0 ? "bad" : "plain"}
          points={series.map(s => s.openTickets)}
          area
        />
      </section>
      <p className="text-[10.5px] text-slate-400 font-mono -mt-1.5">
        4本とも横軸は共通（左＝{series[0]?.date} ／ 右＝{series[series.length - 1]?.date}）
        {data.coverage.from && ` ・ 利用系の記録は ${data.coverage.from} から`}
      </p>

      {/* ── 出来事 ────────────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-slate-100">
          <span className="text-[11.5px] font-bold text-slate-900">この90日に起きたこと</span>
          <span className="ml-2 font-mono text-[11px] text-slate-400">{data.events.length}</span>
        </div>
        {data.events.length === 0 ? (
          <p className="px-3.5 py-6 text-center text-[12px] text-slate-500">
            記録された出来事はありません。
          </p>
        ) : (
          <ol className="flex flex-col">
            {data.events.map((e, i) => <EventRow key={`${e.date}-${i}`} e={e} />)}
          </ol>
        )}
      </section>

      {/* ── 言質 ─────────────────────────────────────────────────────── */}
      {data.voices.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center gap-2 flex-wrap">
            <span className="text-[11.5px] font-bold text-slate-900">言質</span>
            <span className="text-[10.5px] text-slate-500">
              議事録・問い合わせから抽出。採用するまでスコアには入らない
            </span>
            <span className="ml-auto font-mono text-[11px] text-slate-400">
              要レビュー {data.voices.filter(v => v.reviewStatus === "pending" && v.priority === "required").length}
            </span>
          </div>
          {/* 契約・競合に直接触れるものと高確信度だけを上に出す。
              週20件のレビューは続かないので、残りは下に畳む */}
          {data.voices.filter(v => v.priority === "required").map(v => (
            <VoiceRow key={v.voiceId} v={v} busy={busyVoice === v.voiceId} onReview={reviewVoice} />
          ))}
          {data.voices.some(v => v.priority === "reference") && (
            <details className="border-t border-slate-100">
              <summary className="px-3.5 py-2 text-[11px] text-slate-500 cursor-pointer hover:text-slate-900">
                参考（読むだけ・スコアには入らない）{data.voices.filter(v => v.priority === "reference").length}件
              </summary>
              {data.voices.filter(v => v.priority === "reference").map(v => (
                <VoiceRow key={v.voiceId} v={v} busy={busyVoice === v.voiceId} onReview={reviewVoice}
                  readOnly />
              ))}
            </details>
          )}
        </section>
      )}

      {/* ── 判定の根拠 ────────────────────────────────────────────────── */}
      <section className="grid gap-2 lg:grid-cols-2">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[11.5px] font-bold text-slate-900">立っているシグナル</span>
            <span className="font-mono text-[11px] text-slate-400">
              合計 {data.current.score}（時計 ×{data.current.clock}）
            </span>
          </div>
          {data.current.signals.length === 0 ? (
            <p className="px-3.5 py-5 text-[12px] text-slate-500 text-center">
              点灯している要因はありません。
            </p>
          ) : data.current.signals.map(s => (
            <div key={s.id} className="px-3.5 py-2.5 border-b border-slate-50 last:border-b-0 flex gap-2.5">
              <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded h-fit flex-none text-white"
                style={{ background: s.layer === "voice" ? STAGE_COLOR.critical : "#64748b" }}>
                {s.id}
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-bold text-slate-900">{s.label}</div>
                <p className="text-[11.5px] text-slate-600 leading-relaxed">{s.detail}</p>
                {/* 何を見て立ったか。検算できない判定は使われない */}
                {data.signalSources[s.id] && (
                  <p className="text-[10.5px] text-slate-400 mt-0.5">
                    出所：{data.signalSources[s.id]}
                  </p>
                )}
                {/* 「92日開いたまま」だけでは動けない。その現物を開けるようにする */}
                {s.refs && s.refs.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                    {s.refs.map((r, i) => r.url ? (
                      <a key={i} href={r.url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-blue-700
                          hover:text-blue-900 hover:underline">
                        {r.label}<ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : (
                      <span key={i} className="text-[11px] text-slate-400">
                        {r.label}（{r.sourceLabel ?? r.source}・リンクなし）
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="ml-auto font-mono text-[11px] text-slate-400 flex-none">+{s.weight}</span>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-slate-100">
            <span className="text-[11.5px] font-bold text-slate-900">見ていない項目</span>
            <span className="ml-2 text-[10.5px] text-slate-500">
              立たなかったのではなく、材料が無くて評価していないもの
            </span>
          </div>
          {data.current.missing.length === 0 ? (
            <p className="px-3.5 py-5 text-[12px] text-slate-500 text-center">
              すべての項目を評価できています。
            </p>
          ) : data.current.missing.map(m => (
            <div key={m.id} className="px-3.5 py-2 border-b border-slate-50 last:border-b-0 flex gap-2.5 items-baseline">
              <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex-none">
                {m.id}
              </span>
              <p className="text-[11.5px] text-slate-600">{m.reason}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── 部品 ──────────────────────────────────────────────────────────────────────

function EventRow({ e }: { e: RadarTimelineEvent }) {
  const meta = KIND_META[e.kind] ?? KIND_META.contact;
  const Icon = meta.icon;
  return (
    <li className="grid grid-cols-[74px_20px_1fr] gap-2 px-3.5 py-2.5 border-b border-slate-50 last:border-b-0">
      <span className="font-mono text-[11px] text-slate-400 pt-0.5">{e.date}</span>
      <span className="pt-0.5">
        <Icon className="w-3.5 h-3.5" style={{ color: e.strong ? meta.color : "#94a3b8" }} />
      </span>
      <div className="min-w-0">
        <div className={`flex items-center gap-2 flex-wrap text-[12.5px] ${
          e.strong ? "font-bold text-slate-900" : "text-slate-700"}`}>
          {e.label}
          {/* 出所。リンクが張れるものは開ける、張れないものは名前を出して
              根拠の中身をその場に添える（Slack / Chatwork / 判定 / 担当交代） */}
          {e.source && (
            e.url ? (
              <a href={e.url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10.5px] font-normal text-blue-700
                  hover:text-blue-900 hover:underline">
                {e.source}<ExternalLink className="w-2.5 h-2.5" />
              </a>
            ) : (
              <span className="text-[10.5px] font-normal text-slate-400">{e.source}</span>
            )
          )}
        </div>
        {/* リンクを張れない出所は、参照した中身そのものを出して根拠にする。
            判定イベントは行数が増えるので折りたたむ */}
        {!e.url && e.excerpt && (
          e.kind === "stage" ? (
            <details className="mt-1">
              <summary className="text-[10.5px] text-slate-400 cursor-pointer hover:text-slate-700 w-fit">
                参照した情報を見る
              </summary>
              <pre className="text-[10.5px] text-slate-500 leading-relaxed mt-1 whitespace-pre-wrap
                bg-slate-50 border border-slate-100 rounded px-2 py-1.5 font-sans">{e.excerpt}</pre>
            </details>
          ) : (
            <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5 line-clamp-2">
              {e.excerpt}
            </p>
          )
        )}
        {e.detail && (
          <p className={`text-[11.5px] leading-relaxed mt-0.5 ${
            e.kind === "voice"
              ? "text-slate-900 bg-red-50 border-l-2 border-red-700 px-2.5 py-1.5 rounded-r"
              : "text-slate-600"}`}>
            {e.kind === "voice" ? `「${e.detail}」` : e.detail}
          </p>
        )}
      </div>
    </li>
  );
}

function VoiceRow({ v, busy, onReview, readOnly }: {
  v: RadarVoiceItem; busy: boolean;
  onReview: (id: string, s: "confirmed" | "rejected" | "pending") => void;
  /** 参考は読むだけ。採用すると D層・B層と同じ事実が二重にスコアへ乗る */
  readOnly?: boolean;
}) {
  const done = v.reviewStatus !== "pending";
  return (
    <div className={`px-3.5 py-3 border-b border-slate-50 last:border-b-0 flex flex-col gap-2
      ${v.reviewStatus === "rejected" ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-800 font-bold">
          {v.intentType} {v.intentLabel}
        </span>
        <span className="font-mono">{v.occurredAt}</span>
        {/* 抽出元を開けるようにする。原文にあたれないと言質は使えない */}
        {v.url ? (
          <a href={v.url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 hover:underline">
            {v.sourceLabel}<ExternalLink className="w-2.5 h-2.5" />
          </a>
        ) : (
          <span>{v.sourceLabel}</span>
        )}
        <span className="font-mono">確信度 {v.confidence.toFixed(2)}</span>
        {done && (
          <>
            <span className={`font-bold ${v.reviewStatus === "confirmed" ? "text-emerald-700" : "text-slate-500"}`}>
              {v.reviewStatus === "confirmed" ? "採用済み" : "棄却"}
              {v.reviewedBy ? `（${v.reviewedBy}）` : ""}
            </span>
            {/* 誤操作を戻せないと、人はボタンを押さなくなる */}
            <button onClick={() => onReview(v.voiceId, "pending")} disabled={busy}
              className="ml-auto text-[10.5px] text-slate-400 hover:text-slate-700 underline
                disabled:opacity-40 transition">
              取り消す
            </button>
          </>
        )}
      </div>
      {/* 要約ではなく原文を出す。要約だけを見せると判断の根拠を誤らせる */}
      <p className="text-[13px] text-slate-900 leading-relaxed bg-red-50 border-l-2 border-red-700 px-3 py-2 rounded-r">
        「{v.quotedText}」
      </p>
      {v.extractReason && (
        <p className="text-[11px] text-slate-500 leading-relaxed">なぜ拾ったか：{v.extractReason}</p>
      )}
      {readOnly && (
        <p className="text-[10.5px] text-slate-400 text-right">スコアには入りません</p>
      )}
      {!readOnly && !done && (
        <div className="flex gap-1.5 justify-end">
          <button onClick={() => onReview(v.voiceId, "confirmed")} disabled={busy}
            className="text-[10.5px] px-3 py-1 rounded-md bg-slate-900 text-white font-bold
              disabled:opacity-40 hover:bg-slate-700 transition">
            言質として採用
          </button>
          <button onClick={() => onReview(v.voiceId, "rejected")} disabled={busy}
            className="text-[10.5px] px-3 py-1 rounded-md border border-slate-300 bg-white text-slate-600
              disabled:opacity-40 hover:border-slate-400 transition">
            棄却
          </button>
        </div>
      )}
    </div>
  );
}
