"use client";

// ─── 解約報告 ────────────────────────────────────────────────────────────────
//
// **解約の連絡は受けたが、契約終了まではまだ間がある**顧客がいる。
// その顧客がレーダーの危険圏に並び続けると、まだ手を打てる顧客がその下に埋もれる。
// ここでフラグを立てると、リスト側の既定の絞り込みから外れ「解約予定」に回る。
//
// ⚠️ スコアもステージも動かさない。レーダーの精度検証は「点灯していたか」を
//   後から答え合わせするので、人が判定を書き換えると検証が壊れる。
//
// 置き場所は企業ページのヘッダー。主役ではないので小さく、ただし
// 報告済みの状態は取り違えると致命的なので、立った後ははっきり出す。
//
// レーダーの個社ページ（値を既に持っている）と、通常の企業詳細ページ
// （持っていない）の両方から使う。後者は ChurnReportInline が自分で引く。

import { useEffect, useState } from "react";
import { Flag, Loader2, X } from "lucide-react";
import type { ChurnReport } from "@/lib/churn/churn-report";

/**
 * 契約満了日 ＝ **更新日の前日**。
 *
 * 解約はほぼ「次の更新をしない」なので、終了日は毎回これになる。
 * 手で打たせると、更新日そのものを入れてしまう（1日ずれる）。
 *
 * 更新日が過ぎている企業は入れない。`renewal_date` が古いまま残っている顧客に
 * 過去日を黙って入れると、気づかず保存されてしまう。その場合は手入力に落とす。
 */
function defaultEffectiveDate(renewalDate: string | null | undefined): string {
  if (!renewalDate) return "";
  const t = Date.parse(`${String(renewalDate).slice(0, 10)}T00:00:00Z`);
  if (isNaN(t)) return "";
  const day = new Date(t - 86400_000).toISOString().slice(0, 10);
  return day >= new Date().toISOString().slice(0, 10) ? day : "";
}

export function ChurnReportButton({ companyUid, report, renewalDate, onChange }: {
  companyUid: string;
  report: ChurnReport | null;
  /** 次回の更新日（YYYY-MM-DD）。契約終了日の既定値をここから作る */
  renewalDate?: string | null;
  onChange: (next: ChurnReport | null) => void;
}) {
  const [open, setOpen]   = useState(false);
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [note, setNote]   = useState("");

  const suggested = defaultEffectiveDate(renewalDate);
  const openForm  = () => { setEffectiveDate(suggested); setNote(""); setOpen(true); };
  const closeForm = () => { setOpen(false); setError(null); };

  const send = async (body: Record<string, unknown>) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/radar/churn-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyUid, ...body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存に失敗しました");
      onChange(json.churnReport ?? null);
      setOpen(false);
      setEffectiveDate(""); setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // ── 報告済み ───────────────────────────────────────────────────────────────
  if (report) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-md
          bg-slate-900 text-white">
          <Flag className="w-3 h-3" />
          解約予定
          <span className="font-mono font-normal text-slate-300">
            {report.effectiveDate ? `${report.effectiveDate} 終了` : "終了日未定"}
          </span>
        </span>
        <span className="text-[10.5px] text-slate-500">
          {report.reportedAt} {report.reportedBy ?? "—"} が報告
          {report.note ? `／${report.note}` : ""}
        </span>
        <button onClick={() => send({ cancel: true })} disabled={busy}
          className="text-[10.5px] text-slate-400 hover:text-red-700 underline underline-offset-2
            disabled:opacity-40">
          {busy ? "取り消し中…" : "取り消す"}
        </button>
        {error && <span className="text-[10.5px] text-red-700">{error}</span>}
      </div>
    );
  }

  // ── 未報告 ─────────────────────────────────────────────────────────────────
  if (!open) {
    return (
      <button onClick={openForm}
        title="解約の連絡を受けている場合に立てます。レーダーの既定のリストから外れます"
        className="text-[10.5px] px-2 py-1 rounded-md border border-slate-300 bg-white text-slate-500
          hover:border-slate-500 hover:text-slate-800 transition flex items-center gap-1">
        <Flag className="w-3 h-3" />解約報告
      </button>
    );
  }

  return (
    <div className="bg-white border border-slate-300 rounded-lg px-3 py-2.5 flex flex-col gap-2
      shadow-sm w-full max-w-[420px]">
      <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-900">
        <Flag className="w-3 h-3" />解約報告を登録する
        <button onClick={closeForm}
          className="ml-auto text-slate-400 hover:text-slate-700"><X className="w-3.5 h-3.5" /></button>
      </div>
      <p className="text-[10.5px] text-slate-500 leading-relaxed">
        レーダーの危険圏・点灯中のリストから外し、「解約予定」として残します。
        判定スコアは変わりません。
      </p>
      <label className="flex items-center gap-2 text-[11px] text-slate-600">
        <span className="flex-none w-[72px]">契約終了日</span>
        <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)}
          className="flex-1 border border-slate-300 rounded px-2 py-1 text-[11.5px] font-mono
            focus:outline-none focus:border-slate-500" />
      </label>
      {/* 何を根拠に入れた値か書く。黙って入っていると、直すべきか判断できない */}
      <span className="text-[10px] text-slate-400 ml-[80px] -mt-1">
        {suggested
          ? effectiveDate === suggested
            ? `更新日 ${String(renewalDate).slice(0, 10)} の前日を入れています。違うときは直してください`
            : `更新日は ${String(renewalDate).slice(0, 10)}（その前日は ${suggested}）`
          : "更新日が分からないので空です。分かれば入れてください（未定でも登録できます）"}
      </span>
      <label className="flex items-start gap-2 text-[11px] text-slate-600">
        <span className="flex-none w-[72px] pt-1.5">メモ</span>
        <input type="text" value={note} onChange={e => setNote(e.target.value)}
          placeholder="経緯・連絡元など（任意）"
          className="flex-1 border border-slate-300 rounded px-2 py-1 text-[11.5px]
            focus:outline-none focus:border-slate-500" />
      </label>
      {error && <span className="text-[10.5px] text-red-700">{error}</span>}
      <div className="flex justify-end gap-1.5">
        <button onClick={closeForm}
          className="text-[11px] px-2.5 py-1 rounded-md border border-slate-300 text-slate-600
            hover:border-slate-400">やめる</button>
        <button onClick={() => send({ effectiveDate: effectiveDate || null, note: note || null })}
          disabled={busy}
          className="text-[11px] px-2.5 py-1 rounded-md bg-slate-900 text-white font-bold
            hover:bg-slate-700 transition disabled:opacity-40 flex items-center gap-1">
          {busy && <Loader2 className="w-3 h-3 animate-spin" />}フラグを立てる
        </button>
      </div>
    </div>
  );
}

/**
 * 自分で読み込む版。レーダーの走査結果を持たない画面（通常の企業詳細）用。
 *
 * **Tier3 の企業にも立てられる。** 解約報告は走査対象かどうかと関係ない事実で、
 * 保存先も companies なので、レーダーに出てこない顧客でも記録できる。
 */
export function ChurnReportInline({ companyUid, renewalDate }: {
  companyUid: string;
  renewalDate?: string | null;
}) {
  const [report, setReport] = useState<ChurnReport | null>(null);
  const [ready, setReady]   = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/radar/churn-report?companyUid=${encodeURIComponent(companyUid)}`)
      .then(r => r.json())
      .then(j => { if (alive) { setReport(j.churnReport ?? null); setReady(true); } })
      // 読めなくても画面は壊さない。未報告として出す
      .catch(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [companyUid]);

  // 読み込み前にボタンを出すと、報告済みなのに「解約報告」と見えてしまう
  if (!ready) return null;

  return (
    <ChurnReportButton
      companyUid={companyUid} report={report} renewalDate={renewalDate} onChange={setReport} />
  );
}
