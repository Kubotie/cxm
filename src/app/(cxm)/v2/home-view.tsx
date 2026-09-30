"use client";

// ─── v2 ホーム ────────────────────────────────────────────────────────────────
//
// **ログイン直後に開く画面。「今日どこから手をつけるか」を30秒で決めるためにある。**
//
// 置くもの / 置かないものの基準:
//   置く   … 毎朝見る価値があり、かつ**その場で行き先が決まる**もの
//   置かない… 個社を精査しないと意味が出ないもの（＝提案準備ボード・個社ページの仕事）
//
// データ源は2本のバッチが書いたものだけを読む。ホームでは重い計算をしない。
//   日次 cxm_project_metrics  → 利用実態（提案準備ボード API 経由）
//   週次 cxm_industry_intel   → 業界ニュース（/api/home/digest 経由）
//
// **バッチが落ちた日にホームが黙って古い数字を出すのがいちばん危ない。**
// そのため画面の下部ではなくヘッダー直下に「データ更新状況」を置き、
// 今日の分が入っていなければ警告色で出す。

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, AlertCircle, ExternalLink, CalendarClock, Sparkles, Target, Wrench,
  Newspaper, Database, RefreshCw, ArrowRight, Building2, TrendingDown,
  CircleAlert, CheckCircle2, Clock,
} from "lucide-react";
import { InfoTip } from "@/components/ui/info-tip";
import { useRegisterAiPageContext } from "@/components/ai";
import type { HomeDigestResponse, HomeNewsItem } from "@/app/api/home/digest/route";
import type { ProposalBoardResponse, BoardItem, BoardLane } from "@/app/api/companies/proposal-board/route";
import type { AppUserProfile } from "@/lib/nocodb/user-profile";

// ── 表示メタ ──────────────────────────────────────────────────────────────────

const LANE_META: Record<BoardLane, {
  title: string; short: string; icon: React.ElementType; chip: string; dot: string;
}> = {
  renewal:     { title: "更新を確保する", short: "更新",   icon: CalendarClock, chip: "bg-amber-50 text-amber-800 border-amber-200",     dot: "bg-amber-500" },
  ready:       { title: "提案できる",     short: "提案可", icon: Sparkles,      chip: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  conditional: { title: "条件付き",       short: "条件付", icon: Target,        chip: "bg-blue-50 text-blue-800 border-blue-200",         dot: "bg-blue-500" },
  hold:        { title: "足元を戻す",     short: "要回復", icon: Wrench,        chip: "bg-slate-100 text-slate-700 border-slate-300",     dot: "bg-slate-400" },
};

const LANE_ORDER: BoardLane[] = ["renewal", "ready", "conditional", "hold"];

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[10px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.06)] ${className}`}>
      {children}
    </section>
  );
}

function CardHead({
  icon: Icon, title, note, right,
}: { icon: React.ElementType; title: string; note?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 px-4 py-3 border-b border-slate-100">
      <Icon className="w-4 h-4 text-slate-400 mt-[1px] flex-none" />
      <div className="min-w-0 flex-1">
        <h2 className="text-[13px] font-bold text-slate-900 leading-tight">{title}</h2>
        {note && <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{note}</p>}
      </div>
      {right}
    </div>
  );
}

/** 挨拶。時刻で変える（毎朝開く画面なので、朝であることが分かるほうが自然） */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return "お疲れさまです";
  if (h < 11) return "おはようございます";
  if (h < 18) return "お疲れさまです";
  return "お疲れさまです";
}

function todayLabel(): string {
  const d = new Date();
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日(${w})`;
}

/** "YYYY-MM" / "YYYY" → "2026年8月" */
function asOfLabel(asOf: string | null): string {
  if (!asOf) return "時点不明";
  const m = asOf.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[1]}年${Number(m[2])}月`;
  if (/^\d{4}$/.test(asOf)) return `${asOf}年`;
  return asOf;
}

// ── 本体 ──────────────────────────────────────────────────────────────────────

export function V2HomeView() {
  const [digest, setDigest]   = useState<HomeDigestResponse | null>(null);
  const [board, setBoard]     = useState<ProposalBoardResponse | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);

  const [digestErr, setDigestErr] = useState<string | null>(null);
  const [boardErr, setBoardErr]   = useState<string | null>(null);
  const [digestLoading, setDigestLoading] = useState(true);
  const [boardLoading, setBoardLoading]   = useState(true);

  /** 担当フィルタ。既定は「自分の担当だけ」。全社を見たいときだけ外す */
  const [mineOnly, setMineOnly] = useState(true);
  /** 担当顧客が0社だったので自動で全社に切り替えたか（理由を画面に出すため） */
  const [autoAll, setAutoAll]   = useState(false);
  const [industry, setIndustry] = useState<string>("all");

  // ── 取得（3本を独立に。1本遅くても他は先に出す）───────────────────────────
  useEffect(() => {
    let alive = true;

    fetch("/api/user/profile")
      .then(r => (r.ok ? r.json() : null))
      .then(p => { if (alive) setProfile(p); })
      .catch(() => undefined);

    setDigestLoading(true);
    fetch("/api/home/digest")
      .then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        return j as HomeDigestResponse;
      })
      .then(j => { if (alive) { setDigest(j); setDigestErr(null); } })
      .catch(e => { if (alive) setDigestErr(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setDigestLoading(false); });

    setBoardLoading(true);
    fetch("/api/companies/proposal-board")
      .then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        return j as ProposalBoardResponse;
      })
      .then(j => { if (alive) { setBoard(j); setBoardErr(null); } })
      .catch(e => { if (alive) setBoardErr(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setBoardLoading(false); });

    return () => { alive = false; };
  }, []);

  /** companies.owner_name は staff_identify.name2。プロファイルの name2 と突き合わせる */
  const myName = profile?.name2 ?? "";
  const canFilterMine = Boolean(myName)
    && Boolean(board?.owners?.includes(myName) || digest?.owners?.includes(myName));

  const mine = mineOnly && canFilterMine;

  /**
   * **担当顧客が1社もない人がホームを開くと、全部が空になる。**
   * 企画・マネジメント側のアカウントで実際にそうなった。
   * その場合だけ自動で全社に切り替え、理由を画面に出す（黙って切り替えない）。
   */
  useEffect(() => {
    if (!board || !mineOnly || !myName) return;
    if (board.items.some(i => i.owner === myName)) return;
    setMineOnly(false);
    setAutoAll(true);
  }, [board, mineOnly, myName]);

  // ── 提案準備ボード側の集計 ────────────────────────────────────────────────
  const items = useMemo<BoardItem[]>(() => {
    const all = board?.items ?? [];
    return mine ? all.filter(i => i.owner === myName) : all;
  }, [board, mine, myName]);

  const laneCounts = useMemo(() => {
    const m: Record<BoardLane, number> = { renewal: 0, ready: 0, conditional: 0, hold: 0 };
    for (const i of items) m[i.lane]++;
    return m;
  }, [items]);

  /**
   * 今日の要対応。期限があるものを最優先にする。
   *   1) 更新判断期（満了91〜31日前）… 期限が動かせない
   *   2) 期限切れ
   *   3) 足元を戻す（hold）のうち準備度が低い順
   */
  const todo = useMemo(() => {
    const renewal = items
      .filter(i => i.lane === "renewal")
      .sort((a, b) => (a.renewalDate ?? "9999").localeCompare(b.renewalDate ?? "9999"));
    const hold = items
      .filter(i => i.lane === "hold")
      .sort((a, b) => (a.readiness.overallScore ?? 999) - (b.readiness.overallScore ?? 999));
    return [...renewal, ...hold].slice(0, 8);
  }, [items]);

  /** 利用の異変。休眠・施策停止は「提案の前に手当てが要る」合図 */
  const anomalies = useMemo(() => {
    const dormant = items.filter(i => i.usage?.moduleVerdict === "dormant");
    const stopped = items.filter(i => i.usage?.campaign?.activity === "stopped");
    const pvTight = items.filter(i => (i.usage?.pvRate ?? 0) >= 90);
    return { dormant, stopped, pvTight };
  }, [items]);

  // ── 業界ニュース側の絞り込み ──────────────────────────────────────────────
  const news = useMemo<HomeNewsItem[]>(() => {
    let list = digest?.news ?? [];
    if (mine) list = list.filter(n => n.owner === myName);
    if (industry !== "all") list = list.filter(n => n.industry === industry);
    return list;
  }, [digest, mine, myName, industry]);

  /** 絞り込み後に出ている業界だけを選択肢にする（空の選択肢を出さない） */
  const industryOptions = useMemo(() => {
    const base = digest?.news ?? [];
    const scoped = mine ? base.filter(n => n.owner === myName) : base;
    const m = new Map<string, number>();
    for (const n of scoped) {
      if (!n.industry) continue;
      m.set(n.industry, (m.get(n.industry) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [digest, mine, myName]);

  // ── AI パネルへの申告 ──────────────────────────────────────────────────────
  useRegisterAiPageContext({
    pageId: "v2-home",
    title: "ホーム",
    description:
      "ログイン直後の画面。担当顧客の提案準備状況（4レーン）、今日の要対応、"
      + "週次バッチが取得した業界ニュース、日次・週次バッチの更新状況をまとめている。",
    snapshot: {
      担当: mine ? myName : "全社",
      レーン件数: laneCounts,
      対象社数: items.length,
      今日の要対応: todo.map(i => ({
        企業: i.companyName, レーン: i.lane, 更新日: i.renewalDate, 準備度: i.readiness.overallScore,
      })),
      利用の異変: {
        休眠: anomalies.dormant.length,
        施策停止: anomalies.stopped.length,
        PV逼迫: anomalies.pvTight.length,
      },
      業界ニュース件数: news.length,
      業界ニュース: news.slice(0, 20),
      データ更新: digest?.batch,
      業界情報カバレッジ: digest?.coverage,
    },
    hints: { 担当フィルタ: mine ? myName : "全社", 業界フィルタ: industry },
    sources: [
      { label: "ホームダイジェスト", endpoint: "/api/home/digest", description: "業界ニュースとバッチ更新状況" },
      { label: "提案準備ボード", endpoint: "/api/companies/proposal-board", description: "担当顧客の提案準備度" },
    ],
  });

  const daily = digest?.batch.daily;

  return (
    <>
      {/* ── ヘッダー ── */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold text-slate-900 flex items-center gap-1.5">
              {greeting()}{profile?.name ? `、${profile.name} さん` : ""}
              <InfoTip text="毎朝ここから始めるための画面です。数値は日次バッチ（利用実態）と週次バッチ（業界ニュース）が書いたものを読んでいます。個社の精査は提案準備ボードから各社のページへ進んでください。" />
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {todayLabel()}
              {board && ` ・ Tier 1–3 / ${items.length}社`}
              {mine && " ・ 自分の担当のみ"}
              {autoAll && " ・ 担当顧客が登録されていないため全社を表示しています"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {canFilterMine && (
              <div className="flex items-center rounded-[8px] border border-slate-300 overflow-hidden">
                <button onClick={() => { setMineOnly(true); setAutoAll(false); }}
                  className={`px-2.5 py-1.5 text-[11.5px] font-bold transition
                    ${mineOnly ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                  自分の担当
                </button>
                <button onClick={() => { setMineOnly(false); setAutoAll(false); }}
                  className={`px-2.5 py-1.5 text-[11.5px] font-bold transition border-l border-slate-300
                    ${!mineOnly ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                  全社
                </button>
              </div>
            )}
            <Link href="/v2/readiness"
              className="inline-flex items-center gap-1.5 h-[32px] px-3 rounded-[8px] bg-slate-900 text-white text-[11.5px] font-bold hover:bg-slate-800 transition">
              提案準備ボード
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* データ更新状況。落ちた日に気づけるよう、目立つ位置に置く */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-[11px]">
          <FreshnessChip
            label="利用データ（日次）"
            ok={Boolean(daily?.isToday)}
            detail={
              digestLoading ? "確認中…"
              : daily?.latestDate
                ? `${daily.latestDate} ${daily.computedAt?.slice(11) ?? ""} / ${daily.rowCount.toLocaleString("ja-JP")}PJ`
                : "未取得"
            }
            warnText="今日の集計がまだ入っていません。表示は前回集計時点のものです。"
          />
          <FreshnessChip
            label="業界ニュース（週次）"
            ok={Boolean(digest && digest.coverage.fresh > 0)}
            detail={
              digestLoading ? "確認中…"
              : digest
                ? `${digest.coverage.stored}/${digest.coverage.target}社取得 ・ 7日以内 ${digest.coverage.fresh}社`
                : "未取得"
            }
            warnText="週次バッチ（日曜06:00）がまだ一巡していません。取得済みの企業だけを表示しています。"
          />
          {digest && digest.coverage.failed > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 font-bold">
              <CircleAlert className="w-3 h-3" />
              業界調査エラー {digest.coverage.failed}社
            </span>
          )}
        </div>
      </header>

      <div className="p-5 flex flex-col gap-4">
        {/* ── 1段目: レーン別の件数 ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {LANE_ORDER.map(lane => {
            const meta = LANE_META[lane];
            const Icon = meta.icon;
            return (
              <Link key={lane} href="/v2/readiness"
                className={`rounded-[10px] border bg-white px-4 py-3 hover:shadow-[0_2px_8px_rgba(15,23,42,.08)] transition ${
                  lane === "renewal" ? "border-amber-200" : "border-slate-200"
                }`}>
                <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-slate-500">
                  <Icon className="w-3.5 h-3.5" />
                  {meta.title}
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[26px] font-extrabold text-slate-900 leading-none tabular-nums">
                    {boardLoading ? "–" : laneCounts[lane]}
                  </span>
                  <span className="text-[11px] text-slate-400">社</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* grid の子は既定で min-width:auto。**min-w-0 を付けないと長文が折り返さず、
            カードが内容幅まで膨らんでページごと横にはみ出す**（実測: 右カラムが画面外へ） */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
          {/* ── 業界ニュース ── */}
          <Card className="min-w-0">
            <CardHead
              icon={Newspaper}
              title="担当顧客の業界で起きていること"
              note="週次バッチ（日曜06:00）が Web 検索で集めたもの。出典が開けない・時点が特定できない情報は最初から除外しています。"
              right={
                industryOptions.length > 1 ? (
                  <select value={industry} onChange={e => setIndustry(e.target.value)}
                    className="h-[28px] max-w-[190px] rounded-[7px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-700">
                    <option value="all">業界: すべて</option>
                    {industryOptions.map(([name, n]) => (
                      <option key={name} value={name}>{name}（{n}）</option>
                    ))}
                  </select>
                ) : null
              }
            />

            {digestLoading && !digest ? (
              <div className="flex items-center justify-center gap-2 text-slate-400 py-12 text-[12px]">
                <Loader2 className="w-4 h-4 animate-spin" />
                業界ニュースを読み込み中…
              </div>
            ) : digestErr ? (
              <div className="m-4 flex items-center gap-2 text-red-600 py-3 px-3.5 bg-red-50 rounded-[8px] text-[12px]">
                <AlertCircle className="w-4 h-4 flex-none" />
                読み込みに失敗しました: {digestErr}
              </div>
            ) : news.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-[12.5px] text-slate-500 font-medium">表示できるニュースがありません</p>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  {digest && digest.coverage.stored === 0
                    ? "週次バッチがまだ一度も完了していません。"
                    : mine
                      ? "自分の担当企業の業界情報がまだ取得されていません。「全社」に切り替えると他の企業の分を見られます。"
                      : "絞り込み条件に一致する情報がありません。"}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
                {news.map((n, i) => (
                  <li key={`${n.companyUid}-${i}`} className="px-4 py-3 hover:bg-slate-50/70 transition">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <Link href={`/v2/companies/${n.companyUid}?from=home`}
                        className="inline-flex items-center gap-1 text-[11.5px] font-bold text-slate-700 hover:text-blue-600 transition">
                        <Building2 className="w-3 h-3 opacity-60" />
                        {n.companyName}
                      </Link>
                      {n.industry && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {n.industry}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {asOfLabel(n.asOf)}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-slate-700 leading-relaxed break-words">{n.text}</p>
                    {n.sourceUrl && (
                      <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline max-w-full">
                        <ExternalLink className="w-3 h-3 flex-none" />
                        <span className="truncate">{n.sourceTitle ?? n.sourceUrl}</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {digest && news.length > 0 && (
              <p className="px-4 py-2.5 border-t border-slate-100 text-[10.5px] text-slate-400 leading-relaxed">
                {news.length}件を表示。同じ業界の企業には同じ話題が出ます。
                個社の文脈に落とすには各社ページの「顧客情報」タブへ。
              </p>
            )}
          </Card>

          {/* ── 右カラム ── */}
          <div className="flex flex-col gap-4 min-w-0">
            {/* 今日の要対応 */}
            <Card>
              <CardHead
                icon={CalendarClock}
                title="今日から手をつける"
                note="期限のあるもの（更新判断期）を先に、次に足元が崩れている順に並べています。"
              />
              {boardLoading && !board ? (
                <div className="flex items-center justify-center gap-2 text-slate-400 py-10 text-[12px]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  算出中…
                </div>
              ) : boardErr ? (
                <div className="m-4 flex items-center gap-2 text-red-600 py-3 px-3.5 bg-red-50 rounded-[8px] text-[12px]">
                  <AlertCircle className="w-4 h-4 flex-none" />
                  {boardErr}
                </div>
              ) : todo.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1.5" />
                  <p className="text-[12px] text-slate-500">期限つき・要回復の顧客はありません</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {todo.map(i => {
                    const meta = LANE_META[i.lane];
                    return (
                      <li key={i.companyUid}>
                        <Link href={`/v2/companies/${i.companyUid}?from=home`}
                          className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50/70 transition">
                          <span className={`w-1.5 h-1.5 rounded-full flex-none ${meta.dot}`} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-bold text-slate-800 truncate">{i.companyName}</div>
                            <div className="text-[10.5px] text-slate-400 truncate">
                              {meta.title}
                              {i.lane === "renewal" && i.renewalDate && ` ・ 満了 ${i.renewalDate}`}
                              {i.lane === "hold" && i.blockers.length > 0 && ` ・ ${i.blockers.length}件の阻害要因`}
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-slate-400 tabular-nums flex-none">
                            {i.readiness.overallScore ?? "—"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {/* 利用の異変 */}
            <Card>
              <CardHead
                icon={TrendingDown}
                title="利用の異変"
                note="提案より先に手当てが要るもの。日次バッチの30日実測から判定しています。"
              />
              <div className="p-3 grid grid-cols-3 gap-2">
                <AnomalyTile label="休眠"     hint="30日間ほとんど管理画面が使われていない" count={anomalies.dormant.length} loading={boardLoading} tone="red" />
                <AnomalyTile label="施策停止" hint="30日間1本も施策を公開していない"       count={anomalies.stopped.length} loading={boardLoading} tone="amber" />
                <AnomalyTile label="PV枠逼迫" hint="期末のPV着地見込みが契約枠の90%以上"   count={anomalies.pvTight.length} loading={boardLoading} tone="blue" />
              </div>
              {!boardLoading && anomalies.dormant.length > 0 && (
                <ul className="border-t border-slate-100 divide-y divide-slate-100">
                  {anomalies.dormant.slice(0, 4).map(i => (
                    <li key={i.companyUid}>
                      <Link href={`/v2/companies/${i.companyUid}?from=home`}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50/70 transition">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-none" />
                        <span className="text-[11.5px] text-slate-700 truncate flex-1">{i.companyName}</span>
                        <span className="text-[10px] text-slate-400 flex-none">休眠</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/v2/projects"
                className="flex items-center justify-center gap-1 px-4 py-2.5 border-t border-slate-100 text-[11.5px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition">
                プロジェクト分析で見る
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Card>

            {/* データの出どころ */}
            <Card>
              <CardHead icon={Database} title="データの更新" />
              <dl className="px-4 py-3 flex flex-col gap-2.5 text-[11.5px]">
                <SourceRow
                  name="利用実態（毎朝 05:30）"
                  value={daily?.latestDate ? `${daily.latestDate} / ${daily.rowCount.toLocaleString("ja-JP")}PJ` : "—"}
                  ok={Boolean(daily?.isToday)}
                />
                <SourceRow
                  name="業界ニュース（日曜 06:00）"
                  value={digest?.coverage.latestAt ?? "—"}
                  ok={Boolean(digest && digest.coverage.fresh > 0)}
                />
                {digest && digest.coverage.missing > 0 && (
                  <p className="text-[10.5px] text-slate-400 leading-relaxed pt-1 border-t border-slate-100">
                    {digest.coverage.missing}社は業界情報を未取得です。週次バッチが古い順に埋めていきます。
                  </p>
                )}
              </dl>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

// ── 小物 ──────────────────────────────────────────────────────────────────────

function FreshnessChip({
  label, ok, detail, warnText,
}: { label: string; ok: boolean; detail: string; warnText: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full font-medium border
      ${ok ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>
      {ok ? <CheckCircle2 className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
      <span className="font-bold">{label}</span>
      <span className="opacity-80">{detail}</span>
      {!ok && <InfoTip text={warnText} />}
    </span>
  );
}

function AnomalyTile({
  label, hint, count, loading, tone,
}: { label: string; hint: string; count: number; loading: boolean; tone: "red" | "amber" | "blue" }) {
  const cls = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-blue-600";
  return (
    <div className="rounded-[8px] bg-slate-50 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10.5px] font-bold text-slate-500">
        {label}
        <InfoTip text={hint} />
      </div>
      <div className={`text-[20px] font-extrabold leading-tight tabular-nums ${count > 0 ? cls : "text-slate-300"}`}>
        {loading ? "–" : count}
      </div>
    </div>
  );
}

function SourceRow({ name, value, ok }: { name: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full flex-none ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
      <dt className="text-slate-500 flex-1 min-w-0 truncate">{name}</dt>
      <dd className="text-slate-800 font-bold tabular-nums flex-none">{value}</dd>
    </div>
  );
}
