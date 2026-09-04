"use client";

// ─── 解約レーダー：スコープ（トップ画面）─────────────────────────────────────
//
// 設計: docs-src/cxm_v2/19_Churn_Radar_Design.md §5.1
//
// **ランキングをトップに置かない。** 健全な週も「1位＝一番危ない会社」が同じ顔で出続けると
// オオカミ少年になって見られなくなる。開いて最初に分かるべきことは「平穏かどうか」の一目。
//
// 極座標に2軸を同時に乗せる:
//   半径 = 更新までの日数（中心＝更新日）  … いつまでに手を打つか
//   角度 = 落ち方の種類（右＝言質 / 上＝関係 / 左＝利用）… 何が起きているか
//
// 健全な週は淡い点が外周に散っているだけになる。危険圏（内側の赤い輪）が空なら閉じてよい。

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, AlertCircle, RefreshCw, ArrowUpRight, CheckCircle2, Gauge as GaugeIcon,
  MessageSquareQuote, ExternalLink,
} from "lucide-react";
import { useRegisterAiPageContext } from "@/components/ai";
import {
  SCOPE_SECTORS, SCOPE_SECTOR_LABEL, SCOPE_DANGER_DAYS, STAGE_COLOR,
  radiusRatio, angleFor, dotRadius, polar, inDangerZone,
} from "@/lib/churn/radar-scope";
import { daysToCancelDeadline, CANCEL_NOTICE_DAYS } from "@/lib/churn/radar-rules";
import { readOwnerFilter, writeOwnerFilter } from "@/lib/churn/radar-prefs";
import type { RadarBoardResponse, RadarBoardPoint } from "@/app/api/radar/board/route";
import type { RadarStage, RadarLayer } from "@/lib/churn/radar-rules";
import type { AckStatus } from "@/lib/churn/radar-state";

// ── 表示メタ ──────────────────────────────────────────────────────────────────

const STAGE_META: Record<RadarStage, { label: string; note: string; chip: string; bar: string }> = {
  critical: { label: "critical", note: "今週やる",   chip: "bg-red-100 text-red-800",     bar: "bg-red-700" },
  warn:     { label: "warn",     note: "更新前に接触", chip: "bg-amber-100 text-amber-800", bar: "bg-amber-600" },
  watch:    { label: "watch",    note: "落ち始め",   chip: "bg-slate-200 text-slate-700",  bar: "bg-slate-400" },
  clear:    { label: "clear",    note: "点灯なし",   chip: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-600" },
};

const ACK_BUTTONS: Array<{ status: AckStatus; label: string }> = [
  { status: "working",   label: "対応中" },
  { status: "watching",  label: "様子見" },
  { status: "dismissed", label: "誤検知" },
];

const ACK_TEXT: Record<AckStatus, string> = {
  none: "未確認", ack: "見た", working: "対応中", watching: "様子見", dismissed: "誤検知",
};

// ── スコープ描画のジオメトリ ──────────────────────────────────────────────────

// viewBox の左右に余白を持たせる。余白が無いとセクター見出しを扇の外に置けず、
// 内側に押し込まれて光点と重なる。
const W = 568, H = 334, CX = 284, CY = 302, R = 248;

/**
 * 描く目盛り。**解約申出の期限まで**の日数で刻む。
 * radiusRatio は「更新までの日数」を受けるので、+30 して渡す。
 */
const RING_MARKS: Array<[number, string]> = [
  [30,  "締切30日前"], [90,  "3ヶ月"], [180, "半年"], [335, "1年"],
];
const ringRadiusRatio = (deadlineDays: number) => radiusRatio(deadlineDays + CANCEL_NOTICE_DAYS);

/** 上半円の弧。右端から左端へ、上を通る */
function arc(r: number): string {
  const [x1, y1] = polar(CX, CY, r, 0);
  const [x2, y2] = polar(CX, CY, r, 180);
  return `M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 0 0 ${x2.toFixed(1)},${y2.toFixed(1)}`;
}

function yen(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `¥${Math.round(n / 1_000)}K`;
  return `¥${n}`;
}

// ── 本体 ──────────────────────────────────────────────────────────────────────

type ListScope  = "danger" | "lit" | "all";
type SortKey    = "renewal" | "score" | "aged";

/**
 * 並び順。既定は「更新が近い順」。
 * 何順で並んでいるか画面に出ていないと、フィルタを押しても
 * 先頭の顔ぶれが変わらず「効いていない」ように見える。
 */
const SORT_META: Record<SortKey, { label: string; note: string }> = {
  renewal: { label: "締切が近い順", note: "解約申出の期限が近い順。いつまでに手を打つかの順" },
  score:   { label: "重い順",       note: "症状の重さの順" },
  aged:    { label: "放置が長い順", note: "鳴りっぱなしの日数の順" },
};

export default function ScopeView() {
  const router = useRouter();
  const [data, setData]       = useState<RadarBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  // 担当フィルタは画面をまたいで保つ（言質レビューと共通）。
  // レーダーで自分に絞ったのに移動すると全体に戻る、では毎回選び直しになる
  const [owner, setOwnerState] = useState<string>("all");
  useEffect(() => { setOwnerState(readOwnerFilter()); }, []);
  const setOwner = (v: string) => { setOwnerState(v); writeOwnerFilter(v); };
  const [listScope, setListScope]   = useState<ListScope>("danger");
  const [sortKey, setSortKey]       = useState<SortKey>("renewal");
  const [hovered, setHovered] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/radar/board")
      .then(r => r.json())
      .then((json: RadarBoardResponse) => { setData(json); setError(null); })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const points = useMemo(() => {
    if (!data) return [];
    if (owner === "all") return data.points;
    return data.points.filter(p => (p.ownerName ?? "—") === owner);
  }, [data, owner]);

  /** 担当ごとの件数。押す前に何件になるか分かるようにする */
  const ownerCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of data?.points ?? []) {
      const k = p.ownerName ?? "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const lit = useMemo(() => points.filter(p => p.stage !== "clear"), [points]);

  /** フィルタごとの母数。押す前に結果が分かるようボタンに出す */
  const scopeCounts = useMemo(() => ({
    danger: lit.filter(p => inDangerZone(p.daysToRenewal)).length,
    lit:    lit.length,
    all:    points.length,
  }), [lit, points]);

  const listed = useMemo(() => {
    const base =
      listScope === "danger"
        ? lit.filter(p => inDangerZone(p.daysToRenewal))
        : listScope === "lit" ? lit : points;
    return [...base].sort((a, b) => {
      if (sortKey === "score") return b.score - a.score;
      if (sortKey === "aged")  return (b.agedDays ?? -1) - (a.agedDays ?? -1);
      // 既定：解約申出の期限が近い順。同着は重い順。
      // 締切を過ぎたものは後ろへ（今期はもう動かせない）
      const norm = (d: number | null) => {
        const x = daysToCancelDeadline(d);
        return x === null ? 9999 : x < 0 ? 9000 - x : x;
      };
      const da = norm(a.daysToRenewal), db = norm(b.daysToRenewal);
      return da !== db ? da - db : b.score - a.score;
    });
  }, [lit, points, listScope, sortKey]);

  const counts = useMemo(() => {
    const c: Record<RadarStage, number> = { critical: 0, warn: 0, watch: 0, clear: 0 };
    for (const p of points) c[p.stage]++;
    return c;
  }, [points]);

  const dangerPoints = useMemo(() => lit.filter(p => inDangerZone(p.daysToRenewal)), [lit]);

  useRegisterAiPageContext({
    pageId: "v2-radar",
    title: "解約レーダー",
    description:
      "更新までの日数を半径、落ち方の種類（利用／関係／言質）を角度に取ったスコープで、"
      + "解約の予兆が出ている顧客を一目で把握する画面。危険圏＝更新90日以内かつ点灯中。",
    snapshot: {
      asOf: data?.asOf ?? null,
      counts,
      dangerZone: dangerPoints.length,
      dangerZoneMrr: dangerPoints.reduce((a, p) => a + (p.mrr ?? 0), 0),
      items: listed.slice(0, 20).map(p => ({
        name: p.name, stage: p.stage, score: p.score,
        daysToRenewal: p.daysToRenewal, agedDays: p.agedDays,
        ackStatus: p.ackStatus, topReason: p.topReason,
        signals: p.signals.map(s => `${s.id} ${s.label}: ${s.detail}`),
      })),
    },
    hints: {
      担当フィルタ: owner,
      リスト範囲: listScope,
      読込中: loading,
      エラー: error,
    },
    sources: [
      {
        label: "解約レーダー（走査結果）",
        endpoint: "/api/radar/board",
        description: "churn_radar_state の全社ぶん。stage / score / 根拠シグナル / 放置日数を含む",
      },
      {
        label: "個社の90日時系列",
        endpoint: "/api/radar/company/[companyUid]",
        description: "席の稼働率・施策数・接触・チケットの日次系列と、同じ軸に並ぶ出来事",
      },
    ],
  });

  // ── 確認操作 ────────────────────────────────────────────────────────────────
  const sendAck = async (companyUid: string, status: AckStatus) => {
    setBusyUid(companyUid);
    try {
      const res = await fetch("/api/radar/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyUid, status }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "保存に失敗しました");
      setData(prev => prev && ({
        ...prev,
        points: prev.points.map(p => p.companyUid === companyUid ? { ...p, ackStatus: status } : p),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyUid(null);
    }
  };

  // ── 描画 ────────────────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="grid place-items-center h-64 text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-xs">走査結果を読み込んでいます</span>
      </div>
    );
  }

  if (data && !data.ready) {
    return (
      <div className="max-w-xl mx-auto mt-16 bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-slate-900 font-bold">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          レーダーがまだ動いていません
        </div>
        <p className="text-[13px] text-slate-600 leading-relaxed">{data.setupHint}</p>
      </div>
    );
  }

  // 判定は critical で出す。critical の意味は「今週やる」なので、そのまま行動の件数になる。
  // 危険圏（更新90日以内かつ点灯中）は watch/warn も含むため、判定に使うと数が膨らんで動けない。
  const thisWeek = lit.filter(p => p.stage === "critical");
  const verdict  = thisWeek.length === 0;

  return (
    <div className="p-4 md:p-5 flex flex-col gap-3.5">
      {/* ── ヘッダー ───────────────────────────────────────────────────── */}
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[17px] font-bold text-slate-900">解約レーダー</h1>
          <p className="text-[11.5px] text-slate-500 mt-0.5">
            {data?.asOf} 走査 ／ Tier1–2 の {points.length}社
            {data?.setupHint && <span className="text-amber-700 ml-2">{data.setupHint}</span>}
          </p>
        </div>
        <div className="flex gap-1.5 items-center">
          {/* 押す前に何件になるか見せる。件数が出ていないと、押しても
              先頭の顔ぶれが変わらないフィルタは「効いていない」ように見える */}
          <button onClick={() => setOwner("all")}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition flex items-center gap-1.5
              ${owner === "all"
                ? "bg-slate-900 border-slate-900 text-white font-bold"
                : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"}`}>
            全体
            <span className={`font-mono ${owner === "all" ? "text-slate-300" : "text-slate-400"}`}>
              {data?.points.length ?? 0}
            </span>
          </button>
          {ownerCounts.map(([name, n]) => (
            <button key={name} onClick={() => setOwner(name)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition flex items-center gap-1.5
                ${owner === name
                  ? "bg-slate-900 border-slate-900 text-white font-bold"
                  : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"}`}>
              {name}{data?.viewerOwnerName === name ? "（自分）" : ""}
              <span className={`font-mono ${owner === name ? "text-slate-300" : "text-slate-400"}`}>{n}</span>
            </button>
          ))}
          <button onClick={load} disabled={loading}
            className="text-[11px] px-2.5 py-1 rounded-full border border-slate-300 bg-white text-slate-600
              hover:border-slate-400 transition flex items-center gap-1 disabled:opacity-50">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />再読込
          </button>
          {/* レビュー待ちが溜まると、critical に上がるはずの企業が上がらない。
              件数をここに出して放置させない */}
          <Link href="/v2/radar/voices"
            className={`text-[11px] px-2.5 py-1 rounded-full border transition flex items-center gap-1.5
              ${(data?.voiceReviewPending ?? 0) > 0
                ? "bg-red-50 border-red-300 text-red-800 font-bold hover:border-red-500"
                : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"}`}>
            <MessageSquareQuote className="w-3 h-3" />言質レビュー
            {(data?.voiceReviewPending ?? 0) > 0 && (
              <span className="font-mono">{data?.voiceReviewPending}</span>
            )}
          </Link>
          <Link href="/v2/radar/accuracy"
            className="text-[11px] px-2.5 py-1 rounded-full border border-slate-300 bg-white text-slate-600
              hover:border-slate-400 transition flex items-center gap-1">
            <GaugeIcon className="w-3 h-3" />精度
          </Link>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-[12px] rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* ── スコープ本体 ──────────────────────────────────────────────── */}
      <div className="rounded-xl p-3.5 grid gap-4 lg:grid-cols-[minmax(320px,1fr)_252px]"
        style={{ background: "radial-gradient(120% 90% at 30% 0%, #12203a 0%, #0b1220 62%)" }}>

        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <span className="text-[12.5px] font-bold text-white">スコープ</span>
            <span className="text-[10.5px] font-mono text-slate-500 tracking-wide">
              中心＝解約申出の期限（更新30日前）／ 外周＝1年先
            </span>
            <span className="ml-auto text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
              <i className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {data?.asOf} 走査完了
            </span>
          </div>

          {/* SVG を実寸で伸ばしすぎない。viewBox 520 幅が 1000px を超えると
              文字が約2倍に拡大され、セクター見出しがデータより目立つ */}
          <div className="relative w-full max-w-[700px] mx-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto"
              role="img" aria-label="更新までの日数を半径、落ち方の種類を角度に取ったレーダースコープ">
              <defs>
                <radialGradient id="radar-danger" cx="50%" cy="100%" r="100%">
                  <stop offset="0%" stopColor="#ff5a4a" stopOpacity="0.17" />
                  <stop offset="100%" stopColor="#ff5a4a" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="radar-sweep" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="#5fcf9a" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#5fcf9a" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* 危険圏＝解約申出の期限まで30日以内（更新31〜60日前）。
                  ここを逃すと今期は何をしても動かせない */}
              <path
                d={`M${CX - R * ringRadiusRatio(SCOPE_DANGER_DAYS)},${CY} `
                  + `A${R * ringRadiusRatio(SCOPE_DANGER_DAYS)},${R * ringRadiusRatio(SCOPE_DANGER_DAYS)} 0 0 1 `
                  + `${CX + R * ringRadiusRatio(SCOPE_DANGER_DAYS)},${CY} Z`}
                fill="url(#radar-danger)" />

              {/* リングの弧。ラベルは光点の後（最前面）にまとめて描く */}
              {RING_MARKS.map(([d, label]) => {
                const r = R * ringRadiusRatio(d);
                const strong = d === SCOPE_DANGER_DAYS;
                return (
                  <path key={label} d={arc(r)} fill="none"
                    stroke={strong ? "#7a3a34" : "#22304a"}
                    strokeWidth={strong ? 1.4 : 1}
                    strokeDasharray={strong ? undefined : "2 4"} />
                );
              })}

              {/* セクター境界 */}
              {[60, 120].map(deg => {
                const [x, y] = polar(CX, CY, R, deg);
                return <line key={deg} x1={CX} y1={CY} x2={x} y2={y} stroke="#1b2740" strokeWidth="1" />;
              })}

              {/* 走査線。止まっていればデータが更新されていないと分かる */}
              <g className="radar-sweep" style={{ transformBox: "view-box", transformOrigin: `${CX}px ${CY}px` }}>
                <path
                  d={`M${CX},${CY} L${CX - R},${CY} A${R},${R} 0 0 1 `
                    + `${(CX - R * 0.866).toFixed(1)},${(CY - R * 0.5).toFixed(1)} Z`}
                  fill="url(#radar-sweep)" />
                <line x1={CX} y1={CY} x2={CX - R} y2={CY} stroke="#5fcf9a" strokeWidth="1" opacity="0.35" />
              </g>

              {/* 光点。clear は描かない ─ 空白そのものが「平穏」の表示になる。
                  ホバー中のものは最後に描く。先に描くと後続の光点に
                  ラベルが覆われて読めなくなる（SVG に z-index は無い）。 */}
              {[...lit].sort((a, b) =>
                Number(a.companyUid === hovered) - Number(b.companyUid === hovered),
              ).map(p => {
                const r    = R * radiusRatio(p.daysToRenewal);
                const deg  = angleFor(p.sector, p.companyUid);
                const [x, y] = polar(CX, CY, r, deg);
                // 締切を過ぎた顧客は今期もう動かせない。中心に集まるが、
                // 小さく暗くして危険圏の顧客と見間違えないようにする
                const passed = (daysToCancelDeadline(p.daysToRenewal) ?? 0) < 0;
                const size = dotRadius(p.mrr) * (passed ? 0.6 : 1);
                const color = STAGE_COLOR[p.stage];
                const isHover = hovered === p.companyUid;
                return (
                  <g key={p.companyUid}
                    onMouseEnter={() => setHovered(p.companyUid)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => router.push(`/v2/radar/${p.companyUid}`)}
                    className="cursor-pointer">
                    {p.stage !== "watch" && !passed && (
                      <circle cx={x} cy={y} r={size + 6} fill={color} opacity={isHover ? 0.3 : 0.14} />
                    )}
                    <circle cx={x} cy={y} r={size} fill={color}
                      opacity={passed ? 0.35 : p.stage === "watch" ? 0.62 : 1}
                      className={p.isNew && !passed ? "radar-blip" : undefined} />
                    {isHover && (
                      <>
                        <line x1={x} y1={y} x2={x} y2={y - 18} stroke={color} strokeWidth="1" opacity="0.7" />
                        <text x={x} y={y - 22} textAnchor="middle" fontSize="10.5" fontWeight="700"
                          fill="#ffffff" stroke="#0b1220" strokeWidth="3" paintOrder="stroke"
                          strokeLinejoin="round">
                          {p.name}
                        </text>
                        <text x={x} y={y - 33} textAnchor="middle" fontFamily="ui-monospace, monospace"
                          fontSize="9" fill="#a4b0c2" stroke="#0b1220" strokeWidth="3"
                          paintOrder="stroke" strokeLinejoin="round">
                          {(() => {
                            const dl = daysToCancelDeadline(p.daysToRenewal);
                            return dl === null ? "更新日不明"
                              : dl < 0 ? `申出締切は過ぎている（更新まで${p.daysToRenewal}日）`
                              : `申出締切まで${dl}日`;
                          })()}
                          {p.agedDays !== null ? ` ／ ${p.agedDays}日鳴りっぱなし` : ""}
                        </text>
                      </>
                    )}
                    <title>{`${p.name}／${STAGE_META[p.stage].label}／${
                      daysToCancelDeadline(p.daysToRenewal) === null ? "更新日不明"
                      : `申出締切まで${daysToCancelDeadline(p.daysToRenewal)}日`}`}</title>
                  </g>
                );
              })}

              {/* ── 目盛りは最前面。光点の下に潜ると読めなくなる ─────────── */}
              {RING_MARKS.map(([d, label]) => {
                const r = R * ringRadiusRatio(d);
                const strong = d === SCOPE_DANGER_DAYS;
                return (
                  <text key={`lbl-${label}`} x={CX - 9} y={CY - r + 11} textAnchor="end"
                    fontFamily="ui-monospace, monospace" fontSize="8.5"
                    fill={strong ? "#c07064" : "#5a6d84"}
                    stroke="#0b1220" strokeWidth="2.5" paintOrder="stroke"
                    strokeLinejoin="round">{label}</text>
                );
              })}
              {(Object.keys(SCOPE_SECTORS) as RadarLayer[]).map(layer => {
                const [lo, hi] = SCOPE_SECTORS[layer];
                const mid = (lo + hi) / 2;
                const [x, y] = polar(CX, CY, R - 20, mid);
                const anchor = mid > 100 ? "end" : mid < 80 ? "start" : "middle";
                return (
                  <text key={layer} x={x} y={y} textAnchor={anchor}
                    fontSize="9" fontWeight="700" fill="#55697f" letterSpacing="0.06em"
                    stroke="#0b1220" strokeWidth="2.5" paintOrder="stroke"
                    strokeLinejoin="round">
                    {SCOPE_SECTOR_LABEL[layer]}
                  </text>
                );
              })}

              <circle cx={CX} cy={CY} r="4" fill="#e2e8f0" />
              <text x={CX} y={CY + 17} textAnchor="middle" fontFamily="ui-monospace, monospace"
                fontSize="8.5" fill="#6b7f96"
                stroke="#0b1220" strokeWidth="2.5" paintOrder="stroke"
                strokeLinejoin="round">解約申出の期限</text>
              <text x={CX} y={CY + 28} textAnchor="middle" fontFamily="ui-monospace, monospace"
                fontSize="7.5" fill="#4a5c72"
                stroke="#0b1220" strokeWidth="2.5" paintOrder="stroke"
                strokeLinejoin="round">＝更新30日前</text>
            </svg>
          </div>
        </div>

        {/* ── 読み取り盤 ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2.5 min-w-0">
          <div className={`rounded-lg px-3.5 py-3 border ${verdict
            ? "bg-[#101f19] border-[#1e4634]" : "bg-[#1a1214] border-[#58201c]"}`}>
            <span className="font-mono text-[9.5px] tracking-widest text-slate-500">いまの判定</span>
            <div className={`text-[19px] font-bold leading-tight mt-0.5 ${verdict ? "text-emerald-400" : "text-red-300"}`}>
              {verdict ? "今週やる案件はない" : `今週やる ${thisWeek.length}社`}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              {verdict
                ? `critical はゼロ。危険圏（解約申出の期限まで30日以内）の${dangerPoints.length}社は、期限までに接触しておけばよい。`
                : `${yen(thisWeek.reduce((a, p) => a + (p.mrr ?? 0), 0))}／月。危険圏には${dangerPoints.length}社。`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <Gauge k="危険圏 締切30日以内" v={dangerPoints.length} tone={dangerPoints.length > 0 ? "warn" : "ok"} n="点灯中" />
            <Gauge k="新規点灯" v={lit.filter(p => p.isNew).length} tone="warn" n="7日以内" />
            <Gauge k="最長放置"
              v={data?.longestAged ? `${data.longestAged.days}日` : "—"}
              tone={data?.longestAged && data.longestAged.days > 60 ? "bad" : "plain"}
              n={data?.longestAged?.name ?? "—"} />
            <Gauge k="未確認" v={lit.filter(p => p.ackStatus === "none").length} tone="plain" n="要トリアージ" />
          </div>

          <div className="border-t border-[#1e2a3d] pt-2 flex flex-col gap-1">
            {(["critical", "warn", "watch"] as RadarStage[]).map(s => (
              <div key={s} className="flex items-center gap-2 text-[10.5px] text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: STAGE_COLOR[s] }} />
                <b className="text-slate-300 font-medium">{STAGE_META[s].label}</b>
                <span>{STAGE_META[s].note}</span>
                <span className="ml-auto font-mono text-slate-500">{counts[s]}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-[10.5px] text-slate-500 mt-0.5">
              <span className="w-2.5 h-2.5 rounded-full flex-none border border-[#3b5573] bg-[#213247]" />
              点の大きさ＝MRR
              <span className="ml-auto font-mono">clear {counts.clear}</span>
            </div>
            <div className="flex items-center gap-2 text-[10.5px] text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full flex-none bg-slate-500 opacity-40 ml-0.5 mr-1" />
              中心の薄い点＝申出締切を過ぎた顧客（今期は動かせない）
            </div>
          </div>
        </div>
      </div>

      {/* ── リスト ────────────────────────────────────────────────────── */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-slate-100 flex-wrap">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[11.5px] font-bold text-slate-900">
              {listScope === "danger" ? "危険圏（解約申出の期限まで30日以内＝更新31〜60日前）"
                : listScope === "lit" ? "点灯中のすべて" : "全社"}
            </span>
            <span className="font-mono text-[11.5px] text-slate-500">
              {listed.length}<span className="text-slate-400">／{points.length}社</span>
            </span>
            <span className="text-[10.5px] text-slate-400">
              {SORT_META[sortKey].label}に並べています
            </span>
          </div>
          <div className="flex gap-1.5 items-center flex-wrap">
            {([["danger", "危険圏"], ["lit", "点灯中"], ["all", "全社"]] as [ListScope, string][]).map(([s, label]) => (
              <button key={s} onClick={() => setListScope(s)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition flex items-center gap-1.5
                  ${listScope === s
                    ? "bg-slate-900 border-slate-900 text-white font-bold"
                    : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"}`}>
                {label}
                <span className={`font-mono ${listScope === s ? "text-slate-300" : "text-slate-400"}`}>
                  {scopeCounts[s]}
                </span>
              </button>
            ))}
            <span className="w-px h-4 bg-slate-200 mx-0.5" />
            {(Object.keys(SORT_META) as SortKey[]).map(k => (
              <button key={k} onClick={() => setSortKey(k)} title={SORT_META[k].note}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition
                  ${sortKey === k
                    ? "bg-slate-100 border-slate-400 text-slate-900 font-bold"
                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-400"}`}>
                {SORT_META[k].label}
              </button>
            ))}
          </div>
        </div>

        {listed.length === 0 ? (
          <div className="px-3.5 py-8 text-center text-[12px] text-slate-500 flex flex-col items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            {listScope === "danger"
              ? "解約申出の期限が近くて落ちている顧客はいません。今週はここを見なくてよい。"
              : "該当する顧客はいません。"}
          </div>
        ) : listed.map(p => (
          <RadarRow key={p.companyUid} p={p} busy={busyUid === p.companyUid} onAck={sendAck} />
        ))}
      </section>

    </div>
  );
}

// ── 部品 ──────────────────────────────────────────────────────────────────────

function Gauge({ k, v, n, tone }: {
  k: string; v: number | string; n: string; tone: "bad" | "warn" | "ok" | "plain";
}) {
  const color = tone === "bad" ? "text-red-300" : tone === "warn" ? "text-amber-300"
    : tone === "ok" ? "text-emerald-400" : "text-slate-200";
  return (
    <div className="bg-[#101a2b] border border-[#1e2a3d] rounded-lg px-2.5 py-2 min-w-0">
      <span className="block font-mono text-[9px] tracking-wide text-slate-500 truncate">{k}</span>
      <span className={`font-mono text-[17px] font-semibold leading-tight ${color}`}>{v}</span>
      <span className="block text-[9.5px] text-slate-500 truncate">{n}</span>
    </div>
  );
}

function RadarRow({ p, busy, onAck }: {
  p: RadarBoardPoint; busy: boolean; onAck: (uid: string, s: AckStatus) => void;
}) {
  const meta = STAGE_META[p.stage];
  const deadline = daysToCancelDeadline(p.daysToRenewal);
  // 放置が長いほど強く出す。無視されていること自体を可視化するのがこの画面の役目
  const aged = p.agedDays ?? 0;
  const agedTone = aged >= 60 ? "text-red-700 font-semibold"
    : aged >= 21 ? "text-amber-700" : "text-slate-500";

  return (
    <article className="grid grid-cols-[4px_1fr] border-b border-slate-100 last:border-b-0">
      <div className={meta.bar} />
      <div className="px-3.5 py-2.5 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/v2/radar/${p.companyUid}`}
            className="text-[13.5px] font-bold text-slate-900 hover:text-blue-700 transition flex items-center gap-1">
            {p.name}<ArrowUpRight className="w-3 h-3 opacity-50" />
          </Link>
          {p.tier != null && (
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Tier{p.tier}</span>
          )}
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{yen(p.mrr)}</span>
          <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${meta.chip}`}>{meta.label}</span>
          {/* 見るべきは更新日ではなく「解約を申し出られる期限」。
              締切を過ぎた顧客は今期もう動かせないので、そう表示する */}
          <span className="ml-auto text-right flex-none min-w-[76px]">
            <b className={`block font-mono text-[15px] leading-none whitespace-nowrap ${
              deadline === null ? "text-slate-400"
              : deadline < 0 ? "text-slate-400"
              : deadline <= 30 ? "text-red-700"
              : deadline <= 60 ? "text-amber-700" : "text-slate-600"}`}>
              {deadline === null ? "—" : deadline < 0 ? "締切後" : `${deadline}日`}
            </b>
            <span className="block text-[9.5px] text-slate-400 tracking-wide mt-0.5">
              {deadline === null ? "更新日不明"
                : deadline < 0 ? `更新まで${p.daysToRenewal}日`
                : "で申出締切"}
            </span>
          </span>
        </div>

        {p.topReason && (
          <p className="text-[12.5px] text-slate-800 leading-relaxed border-l-2 border-slate-200 pl-2.5">
            {p.topReason}
          </p>
        )}

        {p.signals.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {p.signals.map(s => {
              // 根拠の現物が開けるものはチップ自体をリンクにする
              const url = s.refs?.find(r => r.url)?.url ?? null;
              const cls = `text-[11px] px-2 py-0.5 rounded flex items-center gap-1 ${
                s.layer === "voice" ? "bg-red-50 text-red-800" : "bg-slate-100 text-slate-600"}`;
              const body = (
                <>
                  <b className="font-mono font-semibold opacity-60">{s.id}</b>{s.label}
                  {url && <ExternalLink className="w-2.5 h-2.5 opacity-60" />}
                </>
              );
              return url ? (
                <a key={s.id} href={url} target="_blank" rel="noreferrer"
                  className={`${cls} hover:underline`}>{body}</a>
              ) : (
                <span key={s.id} className={cls}>{body}</span>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2.5 flex-wrap pt-1.5 mt-0.5 border-t border-slate-100">
          <span className={`font-mono text-[11px] ${agedTone}`}>
            {p.agedDays !== null ? `${p.agedDays}日鳴りっぱなし` : "点灯なし"}
            {p.ackStatus === "none" && p.stage !== "clear" ? "・未確認" : ""}
          </span>
          {p.ackStatus !== "none" && (
            <span className="text-[11px] text-slate-500">
              {ACK_TEXT[p.ackStatus]}{p.ackBy ? `（${p.ackBy}）` : ""}
            </span>
          )}
          <span className="text-[11px] text-slate-500">担当 {p.ownerName ?? "—"}</span>
          <div className="ml-auto flex gap-1.5">
            {ACK_BUTTONS.map(b => {
              const on = p.ackStatus === b.status;
              return (
                // 選択中のボタンをもう一度押すと未確認に戻す。
                // 誤操作を戻せないと、人はボタンを押さなくなる
                <button key={b.status} disabled={busy}
                  onClick={() => onAck(p.companyUid, on ? "none" : b.status)}
                  title={on ? "もう一度押すと未確認に戻します" : undefined}
                  className={`text-[10.5px] px-2.5 py-1 rounded-md border transition disabled:opacity-40
                    ${on
                      ? "bg-slate-900 border-slate-900 text-white font-bold"
                      : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"}`}>
                  {b.label}{on ? " ✓" : ""}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}
