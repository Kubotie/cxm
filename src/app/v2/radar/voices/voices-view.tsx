"use client";

// ─── 解約レーダー：言質レビュー ───────────────────────────────────────────────
//
// 設計: docs-src/cxm_v2/19_Churn_Radar_Design.md §8.6
//
// **13社ぶんの個社ページを開いて回るのは、毎週やる作業として成立しない。**
// 週4〜5件をここで片付ける。上から読んで採用／棄却を押すだけ。
//
// 判断に要るものだけ置く:
//   - 原文の引用（要約ではなく）
//   - 出所へのリンク（Notion / Intercom）
//   - なぜ拾ったか（抽出時の説明）
//   - その会社の状態と解約申出の期限までの日数 ─ 同じ発言でも期限が近いほど重い

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, ArrowLeft, AlertCircle, ExternalLink, CheckCircle2, ArrowUpRight,
} from "lucide-react";
import { useRegisterAiPageContext } from "@/components/ai";
import type {
  RadarVoicesResponse, RadarVoiceListItem,
} from "@/app/api/radar/voices/route";
import { daysToCancelDeadline, type RadarStage } from "@/lib/churn/radar-rules";
import { readOwnerFilter, writeOwnerFilter } from "@/lib/churn/radar-prefs";

type ReviewStatus = "pending" | "confirmed" | "rejected";
type Scope = "required" | "reference" | "done";

const STAGE_CHIP: Record<RadarStage, string> = {
  critical: "bg-red-100 text-red-800",
  warn:     "bg-amber-100 text-amber-800",
  watch:    "bg-slate-200 text-slate-700",
  clear:    "bg-emerald-100 text-emerald-800",
};

const SCOPE_META: Record<Scope, { label: string; note: string; status: string; priority: string }> = {
  required:  { label: "要レビュー", note: "契約・競合に直接触れる発言。計上すると解約リスクとしてスコアに乗る（重み4）", status: "pending",   priority: "required" },
  reference: { label: "参考",       note: "読むだけ。スコアには入らない（利用・関係の層が既に数値で捉えている内容のため）", status: "pending",   priority: "reference" },
  done:      { label: "判断済み",   note: "計上または棄却したもの。取り消せる",                    status: "all",       priority: "all" },
};

function yen(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `¥${Math.round(n / 1_000)}K`;
  return `¥${n}`;
}

export default function VoicesView() {
  const [data, setData]     = useState<RadarVoicesResponse | null>(null);
  const [scope, setScope]   = useState<Scope>("required");
  // 担当フィルタはレーダーと共通のキーで保つ
  const [owner, setOwnerState] = useState<string>("all");
  const setOwner = (v: string) => { setOwnerState(v); writeOwnerFilter(v); };
  const [viewer, setViewer] = useState<string | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [busy, setBusy]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 自分の担当を初期選択にはしない（他人の分も見えたほうが週次のトリアージは回る）。
  // ただしボタンには出す。cxm_user_uid は HttpOnly なので profile を1回引くしかない
  useEffect(() => {
    setOwnerState(readOwnerFilter());
    fetch("/api/user/profile")
      .then(r => r.ok ? r.json() : null)
      .then(p => setViewer(p?.name2 ?? null))
      .catch(() => setViewer(null));
  }, []);

  const load = useCallback((s: Scope) => {
    setLoading(true);
    const m = SCOPE_META[s];
    fetch(`/api/radar/voices?status=${m.status}&priority=${m.priority}`)
      .then(async r => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "取得に失敗しました");
        return json as RadarVoicesResponse;
      })
      .then(json => {
        // 「判断済み」は pending を含めない
        if (s === "done") json.items = json.items.filter(v => v.reviewStatus !== "pending");
        setData(json); setError(null);
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(scope); }, [load, scope]);

  const review = async (voiceId: string, status: ReviewStatus) => {
    setBusy(voiceId);
    try {
      const res = await fetch(`/api/radar/voice/${encodeURIComponent(voiceId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存に失敗しました");
      // 判断したものはその場から消す（残りが減っていくのが見えるほうが手が止まらない）
      setData(prev => {
        if (!prev) return prev;
        const done = status !== "pending";
        return {
          ...prev,
          items: scope === "done" && status === "pending"
            ? prev.items.filter(v => v.voiceId !== voiceId)
            : done && scope !== "done"
              ? prev.items.filter(v => v.voiceId !== voiceId)
              : prev.items.map(v => v.voiceId === voiceId
                  ? { ...v, reviewStatus: status, reviewedBy: json.reviewedBy } : v),
          counts: {
            ...prev.counts,
            requiredPending: Math.max(0, prev.counts.requiredPending - (scope === "required" && done ? 1 : 0)),
          },
        };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  /**
   * 担当ごとの件数。押す前に何件になるか分かるようにする。
   *
   * ⚠️ 選択中の担当が候補に無いときも必ず出す。実測（2026-09-09）で、
   *   要レビュー17件が全員 BB 担当だったため候補が1人になり、
   *   「2人以上いるときだけ出す」条件でフィルタ行ごと消えていた。
   *   別の担当を選んだまま候補から外れると、解除する手段が画面から無くなる。
   */
  const ownerCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of data?.items ?? []) {
      const k = v.ownerName ?? "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    const list = [...m.entries()].sort((a, b) => b[1] - a[1]);
    if (owner !== "all" && !list.some(([n]) => n === owner)) list.push([owner, 0]);
    return list;
  }, [data, owner]);

  const items = useMemo(
    () => (data?.items ?? []).filter(v => owner === "all" || (v.ownerName ?? "—") === owner),
    [data, owner],
  );

  const byCompany = useMemo(() => {
    const m = new Map<string, RadarVoiceListItem[]>();
    for (const v of items) {
      if (!m.has(v.companyUid)) m.set(v.companyUid, []);
      m.get(v.companyUid)!.push(v);
    }
    return [...m.values()];
  }, [items]);

  useRegisterAiPageContext({
    pageId: "v2-radar-voices",
    title: "言質レビュー",
    description:
      "議事録・問い合わせから抽出した「契約継続の判断に触れる顧客の発言」を、"
      + "人が採用／棄却する画面。採用したものだけが解約レーダーのスコアに入る。",
    snapshot: {
      scope, counts: data?.counts ?? null,
      owner,
      items: items.slice(0, 30).map(v => ({
        company: v.companyName, stage: v.stage, daysToRenewal: v.daysToRenewal,
        intent: `${v.intentType} ${v.intentLabel}`, quote: v.quotedText,
        reason: v.extractReason, status: v.reviewStatus,
      })),
    },
    hints: { 読込中: loading, エラー: error, 担当フィルタ: owner },
    sources: [{
      label: "言質レビュー一覧",
      endpoint: "/api/radar/voices",
      description: "status / priority で絞れる。採用は POST /api/radar/voice/[voiceId]",
    }],
  });

  if (data && !data.ready) {
    return (
      <div className="p-4 md:p-5">
        <div className="max-w-xl mx-auto mt-12 bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-3">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <AlertCircle className="w-4 h-4 text-amber-600" />言質テーブルが未設定です
          </div>
          <p className="text-[13px] text-slate-600">{data.setupHint}</p>
        </div>
      </div>
    );
  }

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
            <h1 className="text-[17px] font-bold text-slate-900">言質レビュー</h1>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              {SCOPE_META[scope].note}
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(Object.keys(SCOPE_META) as Scope[]).map(s => {
              const n = s === "required" ? data?.counts.requiredPending
                : s === "reference" ? data?.counts.referencePending
                : (data?.counts.confirmed ?? 0) + (data?.counts.rejected ?? 0);
              return (
                <button key={s} onClick={() => setScope(s)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition flex items-center gap-1.5
                    ${scope === s
                      ? "bg-slate-900 border-slate-900 text-white font-bold"
                      : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"}`}>
                  {SCOPE_META[s].label}
                  <span className={`font-mono ${scope === s ? "text-slate-300" : "text-slate-400"}`}>
                    {n ?? "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── 担当フィルタ ───────────────────────────────────────────────
          候補が1人でも出す。消すと「フィルタが無くなった」と誤解させるうえ、
          選択中の担当が候補から外れたときに解除できなくなる */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10.5px] text-slate-400 font-mono mr-0.5">担当</span>
        <button onClick={() => setOwner("all")}
          className={`text-[11px] px-2.5 py-1 rounded-full border transition flex items-center gap-1.5
            ${owner === "all"
              ? "bg-slate-900 border-slate-900 text-white font-bold"
              : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"}`}>
          全体
          <span className={`font-mono ${owner === "all" ? "text-slate-300" : "text-slate-400"}`}>
            {data?.items.length ?? 0}
          </span>
        </button>
        {ownerCounts.map(([name, n]) => (
          <button key={name} onClick={() => setOwner(name)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition flex items-center gap-1.5
              ${owner === name
                ? "bg-slate-900 border-slate-900 text-white font-bold"
                : "bg-white border-slate-300 text-slate-600 hover:border-slate-400"}`}>
            {name}{viewer && name === viewer ? "（自分）" : ""}
            <span className={`font-mono ${owner === name ? "text-slate-300" : "text-slate-400"}`}>{n}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-[12px] rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* ── 一覧 ───────────────────────────────────────────────────────── */}
      {loading && !data ? (
        <div className="grid place-items-center h-48 text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-xs">読み込んでいます</span>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-10 text-center
          flex flex-col items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          <p className="text-[13px] text-slate-700 font-bold">
            {owner !== "all" ? `${owner} の担当分はありません`
              : scope === "required" ? "レビュー待ちはありません" : "該当するものはありません"}
          </p>
          {scope === "required" && (
            <p className="text-[11.5px] text-slate-500">
              週に4〜5件のペースで新しい言質が入ります。次の走査は月曜の朝です。
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* 会社ごとにまとめる。同じ会社の発言は続けて読むほうが判断しやすい */}
          {byCompany.map(group => (
            <section key={group[0].companyUid}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center gap-2 flex-wrap">
                <Link href={`/v2/radar/${group[0].companyUid}`}
                  className="text-[13.5px] font-bold text-slate-900 hover:text-blue-700 transition
                    flex items-center gap-1">
                  {group[0].companyName}<ArrowUpRight className="w-3 h-3 opacity-50" />
                </Link>
                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${STAGE_CHIP[group[0].stage]}`}>
                  {group[0].stage}
                </span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                  {yen(group[0].mrr)}
                </span>
                <span className="text-[11px] text-slate-500">担当 {group[0].ownerName ?? "—"}</span>
                {/* 見るべきは更新日ではなく「解約を申し出られる期限」（更新30日前）。
                    締切を過ぎた顧客は今期もう動かせない */}
                {(() => {
                  const dl = daysToCancelDeadline(group[0].daysToRenewal);
                  return (
                    <span className="ml-auto text-right font-mono flex-none">
                      <b className={`text-[14px] ${
                        dl === null ? "text-slate-400"
                        : dl < 0 ? "text-slate-400"
                        : dl <= 30 ? "text-red-700"
                        : dl <= 60 ? "text-amber-700" : "text-slate-600"}`}>
                        {dl === null ? "—" : dl < 0 ? "締切後" : `${dl}日`}
                      </b>
                      <span className="text-[9.5px] text-slate-400 ml-1">
                        {dl === null ? "更新日不明"
                          : dl < 0 ? `更新まで${group[0].daysToRenewal}日`
                          : "で申出締切"}
                      </span>
                    </span>
                  );
                })()}
              </div>
              {group.map(v => (
                <VoiceItem key={v.voiceId} v={v} busy={busy === v.voiceId} onReview={review}
                  readOnly={scope === "reference"} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 1件 ───────────────────────────────────────────────────────────────────────

function VoiceItem({ v, busy, onReview, readOnly }: {
  v: RadarVoiceListItem; busy: boolean;
  onReview: (id: string, s: ReviewStatus) => void;
  /**
   * 参考は読むだけにする。
   * V3/V4/V5 は D層・B層が既に数値で捉えている状態の言い換えなので、
   * 採用するとスコアが二重に乗る。「レビュー不要」と書きながら押せる状態は
   * 意図と実装がずれている。
   */
  readOnly?: boolean;
}) {
  const done = v.reviewStatus !== "pending";
  return (
    <div className={`px-3.5 py-3 border-b border-slate-50 last:border-b-0 flex flex-col gap-2
      ${v.reviewStatus === "rejected" ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-800 font-bold">
          {v.intentType} {v.intentLabel}
        </span>
        <span className="font-mono">{v.occurredAt}</span>
        {/* 原文にあたれないと言質は使えない */}
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
          <span className={`font-bold ${v.reviewStatus === "confirmed" ? "text-emerald-700" : "text-slate-500"}`}>
            {v.reviewStatus === "confirmed" ? "リスク計上済み" : "棄却"}
            {v.reviewedBy ? `（${v.reviewedBy}）` : ""}
          </span>
        )}
      </div>

      {/* 要約ではなく原文。要約だけを見せると判断の根拠を誤らせる */}
      <p className="text-[13px] text-slate-900 leading-relaxed bg-red-50 border-l-2 border-red-700
        px-3 py-2 rounded-r">
        「{v.quotedText}」
      </p>
      {v.extractReason && (
        <p className="text-[11px] text-slate-500 leading-relaxed">なぜ拾ったか：{v.extractReason}</p>
      )}

      {readOnly ? (
        <p className="text-[10.5px] text-slate-400 text-right">スコアには入りません</p>
      ) : (
        <div className="flex gap-1.5 justify-end">
          {done ? (
            <button onClick={() => onReview(v.voiceId, "pending")} disabled={busy}
              className="text-[10.5px] text-slate-400 hover:text-slate-700 underline
                disabled:opacity-40 transition">
              取り消す
            </button>
          ) : (
            <>
              <button onClick={() => onReview(v.voiceId, "confirmed")} disabled={busy}
                className="text-[11px] px-3 py-1.5 rounded-md bg-slate-900 text-white font-bold
                  disabled:opacity-40 hover:bg-slate-700 transition">
                リスクとして計上
              </button>
              <button onClick={() => onReview(v.voiceId, "rejected")} disabled={busy}
                className="text-[11px] px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-600
                  disabled:opacity-40 hover:border-slate-400 transition">
                棄却
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
