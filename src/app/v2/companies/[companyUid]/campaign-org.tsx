"use client";

// ─── 施策から読む組織の動き（顧客情報タブ）──────────────────────────────────
//
// 「この会社で誰が何をしているか」を施策名と作成者の時系列から読む。
//
// 明細は13.8MBあるので**ボタンを押したときだけ**取得する。
// 開くだけで走らせると、顧客情報タブが毎回5秒待たされる。
//
// 読み違いを防ぐため、画面に必ず出すもの:
//   - 無題を除いた件数（24%は無題）
//   - 削除の内訳（DELETEDの70%は一度も公開されていない）
//   - このデータで答えられないこと（停止時刻・成果が無い）

import { useState } from "react";
import {
  Loader2, AlertCircle, Users, Sparkles, ChevronDown, Info,
  UserPlus, UserMinus, Clock,
} from "lucide-react";
import { InfoTip } from "@/components/ui/info-tip";
import type { CompanyCampaignsResponse } from "@/app/api/company/[companyUid]/campaigns/route";
import { ACTIVITY_META } from "@/lib/company/campaign-signals";

const TONE: Record<string, string> = {
  red:   "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-700",
  slate: "bg-slate-100 text-slate-500",
  green: "bg-emerald-50 text-emerald-700",
};

const STATUS_TONE: Record<string, string> = {
  RUNNING:   "bg-emerald-50 text-emerald-700",
  SCHEDULED: "bg-sky-50 text-sky-700",
  PAUSED:    "bg-amber-50 text-amber-700",
  DRAFT:     "bg-slate-100 text-slate-500",
  DELETED:   "bg-slate-100 text-slate-400",
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[10px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.06)] ${className}`}>{children}</section>;
}

export function CampaignOrgSection({ companyUid }: { companyUid: string }) {
  const [data, setData] = useState<CompanyCampaignsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showLimits, setShowLimits] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/company/${companyUid}/campaigns`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setData(j as CompanyCampaignsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  if (!data) {
    return (
      <Card className="px-5 py-4">
        <div className="flex items-start gap-2.5">
          <Users className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-[13px] font-bold text-slate-900">施策から読む組織の動き</h3>
            <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
              施策名と作成者の時系列から、どの部署が何を狙っているか・誰が動いているかを読みます。
              明細データが大きいため、押したときだけ取得します（初回は5秒ほど）。
            </p>
            {error && (
              <div className="flex items-center gap-1.5 text-[12px] text-red-600 mt-2">
                <AlertCircle className="w-4 h-4" />{error}
              </div>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] bg-slate-900 text-white text-[12px] font-bold hover:bg-slate-700 disabled:opacity-50"
            >
              {loading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />読み込んでいます…</>
                : <><Sparkles className="w-3.5 h-3.5" />施策の動きを読む</>}
            </button>
          </div>
        </div>
      </Card>
    );
  }

  const { org, activity } = data;
  const act = ACTIVITY_META[activity.activity];
  const customers = org.creators.filter(c => !c.internal);
  const internals = org.creators.filter(c => c.internal);

  return (
    <Card className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Users className="w-4 h-4 text-slate-400" />
        <h3 className="text-[13px] font-bold text-slate-900">施策から読む組織の動き</h3>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TONE[act.tone]}`} title={act.hint}>
          {act.label}
        </span>
        <span className="text-[11px] text-slate-400 tabular-nums">
          施策 {org.total.toLocaleString("ja-JP")}件（名前あり {org.named.toLocaleString("ja-JP")}）
        </span>
        <button onClick={load} disabled={loading}
          className="ml-auto text-[11px] text-slate-500 hover:text-slate-900 underline decoration-dotted disabled:opacity-50">
          {loading ? "更新中…" : "更新"}
        </button>
      </div>

      {/* 全体の結論。**箇条書きより先に読ませる** */}
      {org.summaries.headline && (
        <p className="mt-2.5 text-[13px] text-slate-900 leading-relaxed border-l-[3px] border-slate-900 pl-3">
          {org.summaries.headline}
        </p>
      )}

      {/* 内訳（数字の裏づけ） */}
      <details className="mt-2">
        <summary className="text-[11.5px] text-slate-500 cursor-pointer hover:text-slate-900">
          数字の内訳を見る
        </summary>
        <ul className="mt-1 space-y-0.5">
          {[...activity.reasons, ...org.reasons].map((r, i) => (
            <li key={i} className="text-[11.5px] text-slate-600 flex gap-1.5">
              <span className="text-slate-300 shrink-0">・</span><span>{r}</span>
            </li>
          ))}
        </ul>
      </details>

      {/* 人の動き */}
      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <h4 className="text-[12px] font-bold text-slate-800">誰が施策を作っているか</h4>
          <InfoTip text="施策の作成者です。新しく作り始めた人・作らなくなった人は、担当者の交代や体制変更のサインになります。社内アカウント（@ptmind.com）は分けて表示します。" />
          {org.newCreators.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 inline-flex items-center gap-0.5">
              <UserPlus className="w-2.5 h-2.5" />新しく {org.newCreators.length}人
            </span>
          )}
          {org.quietCreators.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 inline-flex items-center gap-0.5">
              <UserMinus className="w-2.5 h-2.5" />90日以上動きなし {org.quietCreators.length}人
            </span>
          )}
        </div>

        <p className="text-[12px] text-slate-800 mt-1.5 leading-relaxed bg-slate-50 border border-slate-150 rounded-[7px] px-3 py-2">{org.summaries.creators}</p>

        <div className="mt-2 space-y-1">
          {[...customers, ...internals].map(c => (
            <div key={c.creator} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11.5px]">
              <span className={`min-w-0 truncate max-w-[20rem] ${c.internal ? "text-slate-400" : "text-slate-800 font-medium"}`}>
                {c.creator}{c.internal && "（社内）"}
              </span>
              {c.isNew && <span className="text-[9.5px] font-bold px-1 py-px rounded bg-emerald-50 text-emerald-700">新規</span>}
              {c.wentQuiet && <span className="text-[9.5px] font-bold px-1 py-px rounded bg-amber-50 text-amber-700">90日+動きなし</span>}
              <span className="text-[10.5px] text-slate-500 tabular-nums">
                作成 {c.total}（90日 {c.created90d} / 30日 {c.created30d}）・公開 {c.ran}
              </span>
              {c.topType && <span className="text-[9.5px] px-1 py-px rounded bg-slate-100 text-slate-500">{c.topType}</span>}
              <span className="text-[10px] text-slate-400 tabular-nums">
                {c.firstAt?.slice(0, 10)} 〜 {c.lastAt?.slice(0, 10)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* テーマ */}
      {org.themes.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1.5">
            <h4 className="text-[12px] font-bold text-slate-800">施策名によく出る語</h4>
            <InfoTip text="施策名に繰り返し出てくる語です。事業部名・対象ページ・施策の型が表れます。形態素解析はしておらず、区切り文字と【】で拾った語の出現回数です。意味づけはしていません。" />
          </div>
          <p className="text-[12px] text-slate-800 mt-1.5 leading-relaxed bg-slate-50 border border-slate-150 rounded-[7px] px-3 py-2">{org.summaries.themes}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {org.themes.map(t => (
              <span key={t.word}
                title={`全期間 ${t.count}件 / 直近90日 ${t.recent}件`}
                className={`text-[10.5px] px-1.5 py-0.5 rounded ${
                  t.recent > 0 ? "bg-blue-50 text-blue-700 font-semibold" : "bg-slate-100 text-slate-500"
                }`}>
                {t.word} {t.count}
                {t.recent > 0 && <span className="opacity-70">（90日 {t.recent}）</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 進み方 */}
      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-1.5">
          <h4 className="text-[12px] font-bold text-slate-800">施策の進み方</h4>
          <InfoTip text="作成から公開までの速さと、削除の内訳です。作って消しただけの施策と、配信してから止めた施策は別の行動なので分けています。" />
        </div>
        <p className="text-[12px] text-slate-800 mt-1.5 leading-relaxed bg-slate-50 border border-slate-150 rounded-[7px] px-3 py-2">{org.summaries.pace}</p>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="公開までの中央値" value={org.medianDaysToLaunch === null ? "—" : `${org.medianDaysToLaunch}日`}
              hint="作成から初公開までの日数の中央値。全社の標準は0日（作ったその日に公開）なので、大きいほど意思決定に時間がかかっています" />
        <Stat label="公開まで30日超" value={`${org.slowLaunches}件`} warn={org.slowLaunches > 0}
              hint="どこかで詰まった施策です。承認・実装・素材待ちなどの可能性があります" />
        <Stat label="作って消しただけ" value={`${org.deleted.neverRan}件`}
              hint="DELETED のうち一度も公開されなかったもの。試行錯誤の残骸で、実施済みの施策とは別物です" />
        <Stat label="配信後に削除" value={`${org.deleted.ranThenDeleted}件`}
              hint="実際に配信してから削除したもの。こちらは実施済みの施策です" />
      </div>

      {/* 施策の時系列 */}
      {org.recent.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1.5">
            <h4 className="text-[12px] font-bold text-slate-800">最近の施策</h4>
          </div>
          <p className="text-[12px] text-slate-800 mt-1.5 leading-relaxed bg-slate-50 border border-slate-150 rounded-[7px] px-3 py-2">{org.summaries.recent}</p>
          <div className="mt-1.5 space-y-1">
            {org.recent.slice(0, showAll ? undefined : 8).map((c, i) => (
              <div key={i} className="flex flex-wrap items-baseline gap-x-2 text-[11.5px]">
                <span className="text-[10px] text-slate-400 tabular-nums shrink-0 w-[4.5rem]">
                  {c.createdAt?.slice(0, 10) ?? "—"}
                </span>
                <span className={`text-[9.5px] font-bold px-1 py-px rounded shrink-0 ${STATUS_TONE[c.status] ?? "bg-slate-100 text-slate-500"}`}>
                  {c.status}
                </span>
                {!c.everRan && (
                  <span className="text-[9.5px] px-1 py-px rounded bg-slate-100 text-slate-400 shrink-0" title="一度も公開されていません">未公開</span>
                )}
                {c.isAbTest && <span className="text-[9.5px] font-bold px-1 py-px rounded bg-violet-50 text-violet-700 shrink-0">AB</span>}
                {!c.hasGoal && c.status === "RUNNING" && (
                  <span className="text-[9.5px] font-bold px-1 py-px rounded bg-amber-50 text-amber-700 shrink-0" title="配信中ですがゴールが設定されていません">ゴール無</span>
                )}
                <span className="text-slate-800 min-w-0 flex-1">{c.name}</span>
                {c.daysToLaunch !== null && c.daysToLaunch >= 30 && (
                  <span className="text-[10px] text-amber-700 shrink-0 inline-flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />{c.daysToLaunch}日
                  </span>
                )}
              </div>
            ))}
          </div>
          {org.recent.length > 8 && (
            <button onClick={() => setShowAll(v => !v)}
              className="mt-1.5 text-[11px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-0.5">
              {showAll ? "折りたたむ" : `残り ${org.recent.length - 8}件を見る`}
              <ChevronDown className={`w-3 h-3 transition-transform ${showAll ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      )}

      {/* 答えられないこと */}
      <div className="mt-3 border-t border-slate-100 pt-2.5">
        <button onClick={() => setShowLimits(v => !v)}
          className="text-[11px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">
          <Info className="w-3 h-3" />このデータで分からないこと
          <ChevronDown className={`w-3 h-3 transition-transform ${showLimits ? "rotate-180" : ""}`} />
        </button>
        {showLimits && (
          <ul className="mt-1 space-y-0.5">
            {data.limitations.map((l, i) => (
              <li key={i} className="text-[11px] text-slate-500 flex gap-1.5">
                <span className="text-slate-300 shrink-0">・</span><span>{l}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function Stat({ label, value, hint, warn = false }: {
  label: string; value: string; hint: string; warn?: boolean;
}) {
  return (
    <div title={hint} className="cursor-help">
      <div className="text-[10px] font-bold tracking-wide text-slate-400">{label}</div>
      <div className={`text-[15px] font-bold tabular-nums mt-0.5 ${warn ? "text-amber-700" : "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
}
