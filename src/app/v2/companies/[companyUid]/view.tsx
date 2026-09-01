"use client";

// ─── CXM v2 会社詳細（3画面構成・チャート内包の1ファイル版）──────────────────
//   1. ダッシュボード  2. 時系列データログ  3. コミュニケーション

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, AlertCircle, ArrowLeft, ArrowUpRight, TrendingDown, TrendingUp,
  AlertTriangle, Sparkles, LayoutDashboard, Activity, MessagesSquare,
  MessageCircle, Hash, Mail, FileText, Ticket, ChevronRight,
  Target, Gauge, ShieldAlert, Check, Square, Search, BookOpen, HelpCircle, RefreshCw,
  ExternalLink,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ComposedChart, Bar,
} from "recharts";
import type { CompanyUsageResponse, ProjectUsageItem, Severity } from "@/app/api/company/[companyUid]/usage/route";
import type { TimeseriesResponse, TimeseriesPoint } from "@/app/api/company/[companyUid]/timeseries/route";
import type { CommunicationsResponse, CommChannel, CommItem } from "@/app/api/company/[companyUid]/communications/route";
import type { ReadinessResponse, ReadinessProjectItem } from "@/app/api/company/[companyUid]/readiness/route";
import type { CompanyProfileResponse } from "@/app/api/company/[companyUid]/profile/route";
import type { ReadinessFactorKey, ReadinessLevel, ProposalPlay, ReadinessFactor } from "@/lib/company/proposal-readiness";
import { FACTOR_META, USAGE_METRIC_META } from "@/lib/company/proposal-readiness";
import { VERDICT_META, type ModuleSignalVM } from "@/lib/company/module-signals";
import { InfoTip } from "@/components/ui/info-tip";
import { ProposalFlow } from "./proposal-flow";
import { CampaignOrgSection } from "./campaign-org";
import type { CampaignMonthPoint } from "@/lib/company/campaign-org-signals";
import { useRegisterAiPageContext } from "@/components/ai";

/** 無料版プロジェクト判定（paidType が FREE / 空 / PAID を含まない）。有償以外はすべて無料扱い。 */
function isFreeProject(p: ProjectUsageItem): boolean {
  const pt = (p.paidType ?? "").toUpperCase();
  return pt === "" || !pt.includes("PAID");
}

function formatMrr(mrr: number | null): string {
  return mrr == null ? "—" : `¥${Math.round(mrr).toLocaleString("ja-JP")}`;
}
function planLabel(plan: CompanyUsageResponse["plan"]): string {
  return plan === "bundle" ? "Bundle" : plan === "insight" ? "Insight" : plan === "experience" ? "Experience" : "未契約";
}
const SEV: Record<Severity, { label: string; chip: string; ring: string }> = {
  red:   { label: "緊急",   chip: "bg-red-50 text-red-700",         ring: "border-l-red-500" },
  amber: { label: "要対応", chip: "bg-amber-50 text-amber-700",     ring: "border-l-amber-500" },
  blue:  { label: "提案",   chip: "bg-blue-50 text-blue-700",       ring: "border-l-blue-500" },
  green: { label: "良好",   chip: "bg-emerald-50 text-emerald-700", ring: "border-l-emerald-500" },
};
const STATUS_META: Record<ProjectUsageItem["status"], { label: string; cls: string }> = {
  active:   { label: "稼働",   cls: "bg-emerald-50 text-emerald-700" },
  stalled:  { label: "停滞",   cls: "bg-amber-50 text-amber-700" },
  unused:   { label: "未活用", cls: "bg-red-50 text-red-700" },
  inactive: { label: "無効",   cls: "bg-slate-100 text-slate-500" },
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[10px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.06)] ${className}`}>{children}</section>;
}
/**
 * 折りたたみ。**毎回は見ないが、必要になったら開きたい**ものに使う。
 * 初期表示に出す情報を絞るための道具であって、隠すためのものではないので、
 * 何が入っているかは閉じたままでも分かる副題を必ず付ける。
 */
function Collapsible({
  icon: Icon, title, note, defaultOpen = false, children,
}: {
  icon: React.ElementType; title: string; note?: string;
  defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50/70 transition rounded-[10px]">
        <Icon className="w-4 h-4 text-slate-400 flex-none" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-bold text-slate-800 leading-tight">{title}</h2>
          {note && <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{note}</p>}
        </div>
        <ChevronRight className={`w-4 h-4 text-slate-400 flex-none transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-1 border-t border-slate-100">{children}</div>}
    </Card>
  );
}

function KpiTile({ label, value, sub, tone = "default" }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "default" | "red" | "amber" | "green";
}) {
  const cls = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : tone === "green" ? "text-emerald-600" : "text-slate-900";
  return (
    <Card className="px-4 py-3">
      <div className="text-[10.5px] font-bold tracking-wide text-slate-400 uppercase">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold tabular-nums ${cls}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </Card>
  );
}
function PvBar({ rate }: { rate: number | null }) {
  if (rate == null) return <span className="text-slate-400 text-xs">—</span>;
  const color = rate >= 90 ? "bg-red-500" : rate >= 50 ? "bg-amber-500" : "bg-blue-600";
  return (
    <div className="w-[92px]">
      <div className="h-1.5 rounded bg-slate-200 overflow-hidden"><div className={`h-full rounded ${color}`} style={{ width: `${Math.min(rate, 100)}%` }} /></div>
      <div className="mt-0.5 text-[10.5px] font-semibold text-slate-400 tabular-nums">{rate}%{rate >= 90 ? " ⚠" : ""}</div>
    </div>
  );
}
/** チャート軸の共通スタイル */
const AXIS = { fontSize: 10, fill: "#94a3b8" } as const;

/** "YYYY-MM-DD" → "M/D" */
/** "2026-08" → "26/8"。軸が詰まらない長さにする */
function fmtMonth(v: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  return m ? `${m[1].slice(2)}/${Number(m[2])}` : v;
}

function fmtDate(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${Number(m[2])}/${Number(m[3])}` : v;
}

function ChartCard({ title, note, tip, children }: { title: string; note?: string; tip?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[10px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.06)]">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-slate-100">
        <h3 className="text-[12px] font-bold text-slate-800 flex items-center gap-1">{title}{tip && <InfoTip text={tip} />}</h3>
        {note && <span className="ml-auto text-[10px] text-slate-400">{note}</span>}
      </div>
      <div className="px-2 py-3">{children}</div>
    </section>
  );
}
function EmptyChart({ label }: { label: string }) {
  return <div className="grid place-items-center h-[200px] text-xs text-slate-400 text-center px-4">{label}</div>;
}
function CompanyUsageCharts({ series, monthly }: {
  series: TimeseriesPoint[];
  monthly: CampaignMonthPoint[] | null;
}) {
  const hasSeries = series.length > 0;
  const hasMonthly = Boolean(monthly && monthly.length > 0);
  const tooltipStyle = {
    contentStyle: { fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" },
    labelStyle: { color: "#64748b", fontWeight: 600 },
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="アクティブユーザー数 推移" note={`${series.length} 日分`}>
        {!hasSeries ? <EmptyChart label="時系列データがありません" /> : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={series} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={AXIS} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} minTickGap={24} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <Tooltip {...tooltipStyle} labelFormatter={fmtDate} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="l7Active"  name="L7 アクティブ"  stroke="#2563eb" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="l30Active" name="L30 アクティブ" stroke="#94a3b8" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
      {/* ── 施策の動き ──────────────────────────────────────────────
          H/D/B（利用スコア）を置き換えた（2026-08-25）。
          あちらは保存先の列も算出も無く、待っても表示されない枠だった。
          こちらは施策明細（約2年）から日次バッチが月次で集計済み。

          **作成と公開を分けて出す。** 作った本数だけでは「出せているか」が分からず、
          作成月で公開を数えると翌月まで出せなかった詰まりが消える。 */}
      <ChartCard title="施策の動き 推移" note={hasMonthly ? `${monthly!.length}ヶ月` : "未計算"}
        tip={
          "月ごとの施策の本数。左の「人の推移」と対になる「打ち手の推移」です。\n" +
          "作成: その月に作られた施策の本数\n" +
          "公開: その月に初めて配信された本数（作成月ではなく初公開月で数えます）\n" +
          "配信中: その月に作られたもののうち、今も配信中のもの\n" +
          "※作成の棒に対して公開の棒が低い月は、作ってから出すまでで止まっています\n" +
          "※無題の施策は名前から意図を追えないため除いています"
        }>
        {!hasMonthly ? (
          <EmptyChart label="施策の明細がまだ集計されていません（毎朝のバッチで作られます）" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={monthly!} margin={{ top: 6, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tickFormatter={fmtMonth} tick={AXIS} tickLine={false}
                     axisLine={{ stroke: "#e2e8f0" }} minTickGap={16} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <Tooltip {...tooltipStyle} labelFormatter={fmtMonth} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="created"  name="作成" fill="#cbd5e1" radius={[3, 3, 0, 0]} maxBarSize={22} />
              <Bar dataKey="launched" name="公開" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={22} />
              <Line type="monotone" dataKey="running" name="今も配信中" stroke="#10b981" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

// 時系列データログは独立タブをやめ、ダッシュボードタブの折りたたみに入れた（2026-08-24）。
// 生ログは毎回見るものではなく、タブを1つ占有すると上位4タブの選択を鈍らせる。
type Tab = "profile" | "dashboard" | "readiness" | "comm";

// ── 提案準備度の表示メタ ──────────────────────────────────────────────────────

const LEVEL_META: Record<ReadinessLevel, { label: string; chip: string; bar: string; text: string }> = {
  high:    { label: "高",   chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500", text: "text-emerald-600" },
  medium:  { label: "中",   chip: "bg-amber-50 text-amber-700",     bar: "bg-amber-500",   text: "text-amber-600" },
  low:     { label: "低",   chip: "bg-red-50 text-red-700",         bar: "bg-red-500",     text: "text-red-600" },
  unknown: { label: "不明", chip: "bg-slate-100 text-slate-500",    bar: "bg-slate-300",   text: "text-slate-400" },
};

const PLAY_META: Record<ProposalPlay, { chip: string; ring: string }> = {
  expand:  { chip: "bg-emerald-600 text-white", ring: "border-l-emerald-500" },
  connect: { chip: "bg-blue-600 text-white",    ring: "border-l-blue-500" },
  deepen:  { chip: "bg-slate-700 text-white",   ring: "border-l-slate-500" },
  rebuild: { chip: "bg-amber-600 text-white",   ring: "border-l-amber-500" },
  unknown: { chip: "bg-slate-300 text-slate-700", ring: "border-l-slate-300" },
};

// 文言は FACTOR_META（proposal-readiness.ts）が正本。ここで書き換えないこと。
// 以前ここに別の説明を持っていて、配点を直したときに片方だけ古くなった。
const FACTOR_LABEL: Record<string, { label: string; hint: string }> =
  Object.fromEntries(
    (Object.keys(FACTOR_META) as ReadinessFactorKey[]).map(k => {
      const m = FACTOR_META[k];
      return [k, {
        label: m.label,
        hint: `${m.question}｜算出: ${m.basis}｜低いとき: ${m.lowMeans}｜準備度への重み ${Math.round(m.weight * 100)}%`,
      }];
    }),
  );

/**
 * 戻り先。**個社ページは複数の一覧から開かれる。**
 * 提案準備ボードから入ったのに「Tier 3 一覧」へ戻るのは感覚と合わない（実測で指摘あり）。
 * 既定は提案準備ボード（主動線。サイドバーでも個社ページはボードの子として扱っている）。
 */
const BACK_TO: Record<string, { href: string; label: string }> = {
  readiness: { href: "/v2/readiness", label: "提案準備ボード" },
  tier3:     { href: "/v2/tier3",     label: "Tier 3 一覧" },
  projects:  { href: "/v2/projects",  label: "プロジェクト分析" },
  home:      { href: "/v2",           label: "ホーム" },
};
const BACK_DEFAULT = BACK_TO.readiness;

export function CompanyDetailView({
  companyUid,
  initialUsage,
  initialTs,
  monthlyCampaigns,
  from,
}: {
  companyUid: string;
  initialUsage: CompanyUsageResponse | null;
  initialTs: TimeseriesResponse | null;
  /** 月ごとの施策の動き（日次バッチが保存済み）。null = 未計算 */
  monthlyCampaigns: CampaignMonthPoint[] | null;
  /** どの一覧から来たか（`?from=`）。戻り先の出し分けに使う */
  from?: string | null;
}) {
  // 初期データはサーバーコンポーネントから props で受け取る（クライアント fetch のウォーターフォールを排除）
  const usage = initialUsage;
  const ts    = initialTs;

  const [comm, setComm]     = useState<CommunicationsResponse | null>(null);
  const [commLoading, setCommLoading] = useState(false);
  const [tab, setTab]       = useState<Tab>("dashboard");

  // 顧客理解プロファイル（生成に時間がかかるのでタブを開いた時のみ取得）
  const [profile, setProfile] = useState<CompanyProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileKey, setProfileKey] = useState(0);
  const [industryRefresh, setIndustryRefresh] = useState(false);

  useEffect(() => {
    if (tab !== "profile") return;
    if (profile && profileKey === 0) return;
    setProfileLoading(true); setProfileError(null);
    // profileKey > 0 = 担当者が「更新」を押したとき。**保存済みではなく作り直す**。
    // 初回表示（profileKey === 0）は保存済みを読むので待たされない。
    const qs = industryRefresh ? "?industry=refresh" : profileKey > 0 ? "?refresh=1" : "";
    fetch(`/api/company/${companyUid}/profile${qs}`)
      .then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? String(r.status));
        return j as CompanyProfileResponse;
      })
      .then(setProfile)
      .catch(e => setProfileError(String(e instanceof Error ? e.message : e)))
      .finally(() => setProfileLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, companyUid, profileKey]);

  // 提案準備度。外部機会は既定で自動判定（§11）。null = 自動、true/false = 担当者の上書き
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [oppOverride, setOppOverride] = useState<boolean | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // **表示は「顧客情報」タブにある。**（2026-08-21 に移設したとき、この取得条件だけ
  // "readiness" のまま残っていて、顧客情報タブでは永久に取得されず
  // 「提案準備度を取得できませんでした」と出ていた。2026-08-24 修正）
  useEffect(() => {
    if (tab !== "profile") return;
    setReadinessLoading(true);
    const qs = oppOverride === null ? "" : `?opportunity=${oppOverride}`;
    fetch(`/api/company/${companyUid}/readiness${qs}`)
      .then(r => r.ok ? r.json() as Promise<ReadinessResponse> : Promise.reject(new Error(String(r.status))))
      .then(setReadiness)
      .catch(() => setReadiness(null))
      .finally(() => setReadinessLoading(false));
  }, [tab, companyUid, oppOverride, reloadKey]);

  // コミュニケーションはタブ切替時に遅延取得（初期表示をブロックしない）
  useEffect(() => {
    if (tab !== "comm" || comm || commLoading) return;
    setCommLoading(true);
    fetch(`/api/company/${companyUid}/communications`)
      .then(r => r.ok ? r.json() as Promise<CommunicationsResponse> : Promise.reject(new Error(String(r.status))))
      .then(setComm)
      .catch(() => setComm({ companyUid, counts: { chatwork: 0, slack: 0, notion: 0, mail: 0, intercom: 0, cse: 0 }, withBodyCount: 0, items: [] }))
      .finally(() => setCommLoading(false));
  }, [tab, comm, commLoading, companyUid]);

  // ── AI パネルへの申告 ──────────────────────────────────────────────────────
  // タブごとの遅延取得なので、**今開いているタブで取れているものだけ**を渡す。
  // 未取得のタブのデータは AI が sources から自分で取りに行く。
  useRegisterAiPageContext({
    pageId: "v2-company-detail",
    title: usage ? `個社ページ: ${usage.name}` : "個社ページ",
    description:
      "1顧客をどう前進させるかを決める画面。顧客情報 / ダッシュボード（利用状況と時系列）/ "
      + "提案準備（提案してよいかの判定）/ コミュニケーション履歴のタブで構成される。",
    snapshot: {
      companyUid,
      利用状況: usage,
      時系列: ts,
      顧客理解プロファイル: profile,
      提案準備度: readiness,
      コミュニケーション: comm,
    },
    hints: {
      開いているタブ: tab,
      companyUid,
      未取得: [
        !profile   && "顧客理解プロファイル",
        !readiness && "提案準備度",
        !comm      && "コミュニケーション履歴",
      ].filter(Boolean),
      profileError,
    },
    // この画面はタブごとの遅延読み込みなので、**取得できているものだけ loaded: true** にする。
    // 未取得のまま総合判断（「何を提案すべきか」等）を書かせると判断材料が欠けるため、
    // AI 側で「先に取るべきソース」として扱わせる。
    sources: [
      {
        label: "利用状況", endpoint: `/api/company/${companyUid}/usage`,
        description: "プロジェクト別・モジュール別の利用実績。PV消化率・稼働キャンペーン数の出所",
        loaded: !!usage,
      },
      {
        label: "時系列", endpoint: `/api/company/${companyUid}/timeseries`,
        description: "日次スナップショット履歴。増減の根拠。days で期間指定",
        loaded: !!ts,
      },
      {
        label: "顧客理解プロファイル", endpoint: `/api/company/${companyUid}/profile`,
        description: "「いま何が起きているか」の要約と materials（契約/利用実態/サポート/議事録の抜粋）",
        loaded: !!profile,
      },
      {
        label: "提案準備度", endpoint: `/api/company/${companyUid}/readiness`,
        description: "提案してよいかの判定。スコア内訳・阻害要因・推奨プレイ",
        loaded: !!readiness,
      },
      {
        label: "コミュニケーション履歴", endpoint: `/api/company/${companyUid}/communications`,
        description: "Slack/Chatwork/Intercom/議事録/CSEチケットの実際のやり取り。接点の有無と中身",
        loaded: !!comm,
      },
      {
        label: "外部WHO情報", endpoint: `/api/company/${companyUid}/external-intel`,
        description: "IR・組織・求人・競合。「今提案する理由」の外部根拠。不在を主張する前に必ず読む",
        loaded: false,
      },
      {
        label: "連絡先", endpoint: `/api/company/${companyUid}/people`,
        description: "担当者・役職・関係性。人物名を出す前に実在と役割を確認する",
        loaded: false,
      },
      {
        label: "アクション", endpoint: `/api/company/${companyUid}/actions`,
        description: "この企業に登録済みのアクション。**行動を勧める前に必ず読む**（重複提案の防止）",
        loaded: false,
      },
      {
        label: "企業原本", endpoint: `/api/nocodb/companies?uid=${companyUid}`,
        description: "companies テーブルの生データ。契約・Tier・担当の原本",
        loaded: false,
      },
    ],
  });

  const back = (from && BACK_TO[from]) || BACK_DEFAULT;

  if (!usage) {
    return (<><TopBar back={back} /><div className="p-5"><div className="flex items-center gap-2 text-red-600 py-4 px-4 bg-red-50 rounded"><AlertCircle className="w-4 h-4" /><span className="text-sm">読み込みに失敗しました: データなし</span></div></div></>);
  }

  const sev = SEV[usage.severity];

  return (
    <>
      <TopBar name={usage.name} back={back} />
      <div className="p-4 md:p-5 space-y-4">
        <HeaderCard data={usage} sev={sev} />

        <div className="flex gap-1 border-b border-slate-200">
          {([
            { key: "profile"   as Tab, label: "顧客情報", icon: BookOpen },
            { key: "dashboard" as Tab, label: "ダッシュボード", icon: LayoutDashboard },
            { key: "readiness" as Tab, label: "提案準備", icon: Target },
            { key: "comm"      as Tab, label: "コミュニケーション", icon: MessagesSquare },
          ]).map(t => {
            const Icon = t.icon;
            const on = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold border-b-2 -mb-px transition
                  ${on ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                <Icon className="w-4 h-4" />{t.label}
                {t.key === "comm" && comm && <span className="text-[10px] font-extrabold text-slate-400">{comm.items.length}</span>}
              </button>
            );
          })}
        </div>

        {tab === "profile" && (
          <ProfileTab
            data={profile}
            loading={profileLoading}
            error={profileError}
            onRegenerate={() => { setIndustryRefresh(false); setProfileKey(k => k + 1); }}
            onFetchIndustry={() => { setIndustryRefresh(true); setProfileKey(k => k + 1); }}
            companyUid={companyUid}
            readiness={readiness}
            readinessLoading={readinessLoading}
            oppOverride={oppOverride}
            onSetOverride={setOppOverride}
            onReloadReadiness={() => setReloadKey(k => k + 1)}
          />
        )}
        {tab === "dashboard" && <DashboardTab data={usage} ts={ts} monthly={monthlyCampaigns} />}
        {tab === "readiness" && (
          <ReadinessTab companyUid={companyUid} profile={profile} />
        )}
        {tab === "comm" && <CommTab comm={comm} loading={commLoading} />}
      </div>
    </>
  );
}

function HeaderCard({ data, sev }: { data: CompanyUsageResponse; sev: typeof SEV[Severity] }) {
  return (
    <Card className={`border-l-4 ${sev.ring}`}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-slate-900 truncate">{data.name}</h1>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sev.chip}`}>{sev.label}</span>
            {data.isChronicSilent && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-400 text-amber-600">
                休眠{data.chronicSilentL30 != null ? ` L30:${data.chronicSilentL30}` : ""}
              </span>
            )}
          </div>
          <div className="text-[11.5px] text-slate-400 mt-0.5">
            担当: {data.owner === "—" ? "担当なし" : data.owner}{data.tier != null && <span className="ml-2">· Tier {data.tier}</span>}
          </div>
        </div>
        <div className="flex-1" />
        <HeaderStat label="プラン" value={
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded border
            ${data.plan === "bundle" ? "bg-blue-50 text-blue-700 border-transparent"
            : data.plan === "experience" ? "bg-emerald-50 text-emerald-700 border-transparent"
            : data.plan === "insight" ? "bg-slate-50 text-slate-700 border-slate-200"
            : "bg-slate-50 text-slate-400 border-slate-200"}`}>{planLabel(data.plan)}</span>
        } />
        <HeaderStat label="MRR" value={<span className="text-sm font-bold tabular-nums text-slate-900">{formatMrr(data.mrr)}</span>} />
        <HeaderStat label="契約更新" value={<span className="text-sm font-bold text-slate-900">{data.renewalBucket ?? "—"}{data.renewalDate && <span className="block text-[10px] font-normal text-slate-400">{data.renewalDate}</span>}</span>} />
        <HeaderStat label="サポート" value={<span className={`text-sm font-bold tabular-nums ${(data.openSupport ?? 0) > 0 ? "text-amber-600" : "text-slate-900"}`}>{data.openSupport ?? 0}<span className="text-[10px] font-normal text-slate-400"> 件</span></span>} />
      </div>
    </Card>
  );
}

const VERDICT_CHIP: Record<string, string> = {
  dormant:     "bg-red-50 text-red-700",
  unused:      "bg-red-50 text-red-700",
  partial:     "bg-amber-50 text-amber-700",
  shallow:     "bg-amber-50 text-amber-700",
  unevaluated: "bg-slate-100 text-slate-500",
  healthy:     "bg-emerald-50 text-emerald-700",
};

function ProjectRow({ p, companyUid, muted = false }: {
  p: ProjectUsageItem;
  companyUid: string;
  muted?: boolean;
}) {
  const st = STATUS_META[p.status];
  const mod = p.moduleSignal;
  const vm = mod ? VERDICT_META[mod.verdict] : null;
  return (
    <tr className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 align-top ${muted ? "opacity-60" : ""}`}>
      <td className="px-3.5 py-2.5">
        {/* 戻り先を from で持たせる。詳細から会社ページへ正しく戻すため */}
        <Link
          href={`/v2/projects/${p.id}?from=company:${companyUid}`}
          className="font-bold text-[12px] text-slate-900 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
        >
          {p.name}<ArrowUpRight className="w-3 h-3 opacity-50" />
        </Link>
        <div className="text-[10px] text-slate-400">{p.paidType ? p.paidType.replace("-PAID", "") : "—"}</div>
      </td>

      <td className="px-3.5 py-2.5">
        {vm && mod ? (
          <>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${VERDICT_CHIP[mod.verdict]}`} title={vm.hint}>
              {vm.label}
            </span>
            {mod.unusedEntitled.length > 0 && (
              <div className="text-[9.5px] text-amber-700 mt-0.5">{mod.unusedEntitled.join("・")} 未使用</div>
            )}
            {mod.runsAbTest && <div className="text-[9.5px] text-emerald-700 mt-0.5">A/Bテスト運用中</div>}
          </>
        ) : <span className="text-slate-300">—</span>}
      </td>

      <td className="px-3.5 py-2.5 text-right tabular-nums">{mod ? mod.activePv.toLocaleString("ja-JP") : "—"}</td>
      <td className="px-3.5 py-2.5 text-right tabular-nums">{mod ? mod.deepPv.toLocaleString("ja-JP") : "—"}</td>
      <td className="px-3.5 py-2.5 text-right tabular-nums">{mod ? mod.activeModuleCount : "—"}</td>

      <td className="px-3.5 py-2.5">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
        {p.stalledDays != null && p.status === "stalled" && <span className="block text-[9.5px] text-slate-400 mt-0.5">{p.stalledDays}日</span>}
      </td>
      <td className="px-3.5 py-2.5 text-right tabular-nums">{p.l30Active ?? "—"}</td>
      <td className="px-3.5 py-2.5"><PvBar rate={p.pvRate} /></td>
      <td className="px-3.5 py-2.5 text-right tabular-nums">{p.campaignCount ?? "—"}</td>
      <td className="px-3.5 py-2.5">
        {p.habituation === true ? <span className="text-[10px] font-bold text-emerald-600">あり</span>
          : p.habituation === false ? <span className="text-[10px] text-slate-400">なし</span>
          : <span className="text-slate-300">—</span>}
      </td>
    </tr>
  );
}

function DashboardTab({ data, ts, monthly }: {
  data: CompanyUsageResponse; ts: TimeseriesResponse | null;
  monthly: CampaignMonthPoint[] | null;
}) {
  const wow = data.wowPct;
  const [showFree, setShowFree] = useState(false);

  // 有償プロジェクトのみを母数にする（無料版は除外）
  const paidProjects   = data.projects.filter(p => !isFreeProject(p));
  const freeProjects   = data.projects.filter(isFreeProject);
  const paidActive     = paidProjects.filter(p => p.status === "active").length;
  const paidStalled    = paidProjects.filter(p => p.status === "stalled").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiTile label="PV消費率(当月)" value={data.pvRate != null ? `${data.pvRate}%` : "—"} tone={data.pvOver ? "red" : "default"} sub={data.pvOver ? "上限に接近" : "上限内"} />
        <KpiTile label="L7アクティブユーザー数" value={data.l7ThisWeek ?? "—"}
          tone={wow != null && wow <= -50 ? "red" : wow != null && wow < 0 ? "amber" : "default"}
          sub={wow != null
            ? <span className={`inline-flex items-center gap-0.5 font-semibold ${wow <= -1 ? "text-red-500" : wow >= 1 ? "text-emerald-600" : "text-slate-400"}`}>
                {wow <= -1 ? <TrendingDown className="w-3 h-3" /> : wow >= 1 ? <TrendingUp className="w-3 h-3" /> : null}前週比 {wow > 0 ? "+" : ""}{wow}%
              </span>
            : "前週データなし"} />
        <KpiTile label="L30 アクティブ" value={data.l30Total ?? "—"} sub="直近30日 活動量" />
        <KpiTile label="稼働プロジェクト" value={`${paidActive}/${paidProjects.length}`} tone={paidActive === 0 && paidProjects.length > 0 ? "red" : "default"} sub={paidStalled > 0 ? `停滞 ${paidStalled}` : "停滞なし"} />
        <KpiTile label="最終活動" value={data.daysSinceActive != null ? `${data.daysSinceActive}日前` : "—"} tone={data.daysSinceActive != null && data.daysSinceActive >= 30 ? "amber" : "green"} sub={data.lastActive ?? "—"} />
      </div>

      <CompanyUsageCharts series={ts?.series ?? []} monthly={monthly} />

      {(data.riskSignals.length > 0 || data.opportunitySignals.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.riskSignals.length > 0 && (
            <Card className="px-4 py-3">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-red-600 mb-2"><AlertTriangle className="w-4 h-4" /> リスクシグナル</div>
              <ul className="space-y-1.5">{data.riskSignals.map((s, i) => (
                <li key={i} className="text-[11.5px] text-slate-600 flex gap-2"><span className={`mt-1 w-1.5 h-1.5 rounded-full flex-none ${s.severity === "high" ? "bg-red-500" : "bg-amber-500"}`} />{s.description}</li>
              ))}</ul>
            </Card>
          )}
          {data.opportunitySignals.length > 0 && (
            <Card className="px-4 py-3">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-blue-600 mb-2"><Sparkles className="w-4 h-4" /> 機会シグナル</div>
              <ul className="space-y-1.5">{data.opportunitySignals.map((s, i) => (
                <li key={i} className="text-[11.5px] text-slate-600 flex gap-2"><span className="mt-1 w-1.5 h-1.5 rounded-full flex-none bg-blue-500" />{s.description}</li>
              ))}</ul>
            </Card>
          )}
        </div>
      )}

      <Card>
        <div className="flex items-center gap-2 px-3.5 py-3 border-b border-slate-100">
          <h2 className="text-[12.5px] font-bold tracking-wide text-slate-800">プロジェクト別 利用状況</h2>
          <span className="ml-auto text-[10.5px] text-slate-400">
            有償 {paidProjects.length} プロジェクト{freeProjects.length > 0 && ` · 無料 ${freeProjects.length}`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-[10.5px] font-bold tracking-wide text-slate-400 uppercase bg-slate-50">
                <th className="px-3.5 py-2.5">プロジェクト / プラン</th>
                <th className="px-3.5 py-2.5"><span className="inline-flex items-center gap-1">30日の利用<InfoTip text={
                  "過去30日の管理画面アクセス（モジュール単位の実測）から判定しています。\n" +
                  "休眠 = 管理画面アクセスも計測イベントも0\n" +
                  "未使用 = 着地画面までで止まっている\n" +
                  "一部未使用 = 契約している製品の一部を使っていない\n" +
                  "浅い利用 = 施策・設定は触るが分析・検証に届かない\n" +
                  "活用中 = 契約製品を使い、分析・検証まで到達\n" +
                  "※ プロジェクトホーム／データセンターは着地画面なので利用として数えません"
                } /></span></th>
                <th className="px-3.5 py-2.5 text-right"><span className="inline-flex items-center gap-1">実利用PV<InfoTip text="30日の管理画面PVのうち、着地画面（回遊）を除いたもの。実際に機能を触った量です" /></span></th>
                <th className="px-3.5 py-2.5 text-right"><span className="inline-flex items-center gap-1">分析・検証PV<InfoTip text="うち「分析利用」と「施策検証」のPV。事実を見て成果を確かめているかの深さです。準備度の利用充足はこの値で配点します" /></span></th>
                <th className="px-3.5 py-2.5 text-right"><span className="inline-flex items-center gap-1">機能数<InfoTip text="30日に実際に触った機能の数（着地画面を除く）。利用の幅です" /></span></th>
                <th className="px-3.5 py-2.5">状態</th>
                <th className="px-3.5 py-2.5 text-right">L30</th>
                <th className="px-3.5 py-2.5">PV消費率</th>
                <th className="px-3.5 py-2.5 text-right">Campaign</th>
                <th className="px-3.5 py-2.5"><span className="inline-flex items-center gap-1">習慣化<InfoTip text={
                  "Ptengine の habituation フラグ。継続的に使われているかの判定です。\n" +
                  "30日の利用判定とは別系統なので、食い違うことがあります"
                } /></span></th>
              </tr>
            </thead>
            <tbody>
              {data.projects.length === 0 && (<tr><td colSpan={10} className="text-center text-slate-400 py-8">プロジェクトがありません</td></tr>)}
              {paidProjects.length === 0 && freeProjects.length > 0 && !showFree && (
                <tr><td colSpan={10} className="text-center text-slate-400 py-6 text-[11px]">有償プロジェクトはありません（無料版のみ）</td></tr>
              )}
              {paidProjects.map(p => <ProjectRow key={p.id} p={p} companyUid={data.companyUid} />)}

              {freeProjects.length > 0 && (
                <tr className="bg-slate-50/60">
                  <td colSpan={10} className="px-3.5 py-2">
                    <button type="button" onClick={() => setShowFree(v => !v)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-blue-600">
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showFree ? "rotate-90" : ""}`} />
                      無料版プロジェクト {freeProjects.length} 件を{showFree ? "隠す" : "表示"}
                    </button>
                  </td>
                </tr>
              )}
              {showFree && freeProjects.map(p => <ProjectRow key={p.id} p={p} companyUid={data.companyUid} muted />)}
            </tbody>
          </table>
        </div>
        <div className="px-3.5 py-2 border-t border-slate-100 text-[10px] text-slate-400 leading-relaxed">
          「30日の利用」は管理画面のモジュール単位アクセス（実測）から判定しています。
          着地画面（プロジェクトホーム／データセンター）は利用として数えません。
          ヒートマップの閲覧そのものは顧客ドメインへ遷移するため計測外で、リスト到達までしか分かりません。
        </div>
      </Card>

      {/* 生ログ。独立タブをやめてここに畳んだ（2026-08-24） */}
      <Collapsible icon={Activity} title="時系列データログ（日次スナップショット）"
        note={`日次バッチが記録した生の数値。増減の根拠を1日単位で確かめたいときに開く${ts?.series.length ? `（${ts.series.length}日分）` : ""}`}>
        <LogTab ts={ts} />
      </Collapsible>

      <div className="flex justify-end">
        <Link href={`/companies/${data.companyUid}`} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-500 hover:text-blue-600">現行 UI の詳細（AI要約・組織図など）を開く <ArrowUpRight className="w-3.5 h-3.5" /></Link>
      </div>
    </div>
  );
}

/** 折りたたみの中身。外枠（Card / 見出し）は呼び出し側が持つ */
function LogTab({ ts }: { ts: TimeseriesResponse | null }) {
  const rows = ts ? [...ts.series].reverse() : [];
  return (
    <div>
      {ts && !ts.hasScoreData && (
        <p className="text-[10.5px] text-slate-400 pt-2 pb-1">スコア（H/D/B）は未算出のため常に空欄です</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-[10.5px] font-bold tracking-wide text-slate-400 uppercase bg-slate-50">
              <th className="px-3 py-2.5">日付</th>
              <th className="px-3 py-2.5 text-right whitespace-nowrap">L7</th>
              <th className="px-3 py-2.5 text-right">L30</th>
              <th className="px-3 py-2.5 text-right">Campaign</th>
              <th className="px-3 py-2.5 text-right">PV超過PJ</th>
              <th className="px-3 py-2.5 text-right">稼働PJ</th>
              <th className="px-3 py-2.5 text-right">停滞PJ</th>
              <th className="px-3 py-2.5 text-right">H</th>
              <th className="px-3 py-2.5 text-right">D</th>
              <th className="px-3 py-2.5 text-right">B</th>
              <th className="px-3 py-2.5 text-right">MRR</th>
              <th className="px-3 py-2.5">Health</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (<tr><td colSpan={12} className="text-center text-slate-400 py-8">時系列データがありません（日次バッチの記録が必要です）</td></tr>)}
            {rows.map(r => (
              <tr key={r.date} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2 font-semibold text-slate-700 tabular-nums whitespace-nowrap">{r.date}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.l7Active ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.l30Active ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.campaign ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.pvAlertCount ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.activeProjects ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.stalledProjects ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.healthyAvg ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.depthAvg ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.breadthAvg ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.mrr != null ? `¥${Math.round(r.mrr).toLocaleString("ja-JP")}` : "—"}</td>
                <td className="px-3 py-2 text-[11px] text-slate-500">{r.overallHealth ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pt-2 text-[10px] text-slate-400">
        企業日次: PV超過PJ / 稼働・停滞PJ / MRR / Health（company_daily_snapshot）。プロジェクト集計: L7・L30・Campaign・H/D/B（project_user_snapshots）。
      </div>
    </div>
  );
}

const CHANNEL_META: Record<CommChannel, { label: string; icon: React.ElementType; cls: string }> = {
  notion:   { label: "議事録",   icon: FileText,      cls: "bg-slate-100 text-slate-600" },
  mail:     { label: "メール",   icon: Mail,          cls: "bg-sky-50 text-sky-700" },
  intercom: { label: "Intercom", icon: Mail,          cls: "bg-blue-50 text-blue-700" },
  chatwork: { label: "Chatwork", icon: MessageCircle, cls: "bg-emerald-50 text-emerald-700" },
  slack:    { label: "Slack",    icon: Hash,          cls: "bg-violet-50 text-violet-700" },
  cse:      { label: "CSE",      icon: Ticket,        cls: "bg-amber-50 text-amber-700" },
};

/** リンク先の呼び名（ツールチップ用）。リンクが無いチャネルは載せない */
const LINK_TARGET: Partial<Record<CommChannel, string>> = {
  intercom: "Intercom",
  mail:     "Intercom",
  cse:      "Notion",
  notion:   "Notion",
};

/**
 * Intercom の会話状態。**closed はバッジを出さない。**
 * 大半が closed なので、出すと画面が「Closed」で埋まって
 * 手を入れるべき Open / Snooze が沈む。
 */
const STATE_META: Record<'open' | 'snoozed' | 'closed', { label: string; cls: string; hint: string }> = {
  open:    { label: "Open",   cls: "bg-emerald-50 text-emerald-700", hint: "Intercom で未クローズ。まだやり取りが続いています" },
  snoozed: { label: "Snooze", cls: "bg-amber-50 text-amber-700",     hint: "Intercom でスヌーズ中。時間を置いて戻ってきます" },
  closed:  { label: "Closed", cls: "bg-slate-100 text-slate-400",    hint: "Intercom でクローズ済み" },
};

/** この文字数を超える本文は折りたたみ、「全文を表示」で開く */
const BODY_PREVIEW_LIMIT = 220;

function CommTab({ comm, loading }: { comm: CommunicationsResponse | null; loading: boolean }) {
  const [ch, setCh]   = useState<CommChannel | "all">("all");
  const [q, setQ]     = useState("");
  /** **Open / Snooze だけに絞る。** 見るべきはこの2つ、というのが運用上の合意 */
  const [liveOnly, setLiveOnly] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  if (loading) {
    return <div className="flex items-center justify-center gap-2 text-slate-500 py-16"><Loader2 className="w-4 h-4 animate-spin" /> 会話を読み込み中...</div>;
  }
  if (!comm) return null;

  const kw = q.trim().toLowerCase();
  const isLive = (i: CommItem) => i.state === "open" || i.state === "snoozed";
  const liveCount = comm.items.filter(isLive).length;
  const items = comm.items.filter(i =>
    (ch === "all" || i.channel === ch)
    && (!liveOnly || isLive(i))
    && (kw === "" || i.title.toLowerCase().includes(kw) || i.body.toLowerCase().includes(kw))
  );
  const filters: { key: CommChannel | "all"; label: string; n: number }[] = [
    { key: "all", label: "すべて", n: comm.items.length },
    ...(Object.keys(CHANNEL_META) as CommChannel[])
      .filter(c => comm.counts[c] > 0)
      .map(c => ({ key: c, label: CHANNEL_META[c].label, n: comm.counts[c] })),
  ];

  return (
    <Card>
      <div className="flex items-center gap-2 flex-wrap px-3.5 py-3 border-b border-slate-100">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 flex-wrap">
          {filters.map(f => (
            <button key={f.key} onClick={() => setCh(f.key)}
              className={`px-2.5 py-1 text-[11.5px] font-semibold rounded-md flex items-center gap-1.5 transition
                ${ch === f.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              {f.label}<span className={`text-[10px] font-extrabold ${ch === f.key ? "text-blue-600" : "text-slate-400"}`}>{f.n}</span>
            </button>
          ))}
        </div>

        {liveCount > 0 && (
          <button onClick={() => setLiveOnly(v => !v)}
            title="Intercom でまだ閉じていない会話（Open / Snooze）だけを表示します"
            className={`h-[30px] px-2.5 rounded-[8px] border text-[11.5px] font-semibold flex items-center gap-1.5 transition
              ${liveOnly
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
            未クローズのみ
            <span className={`text-[10px] font-extrabold ${liveOnly ? "text-emerald-600" : "text-slate-400"}`}>{liveCount}</span>
          </button>
        )}

        {/* 本文まで含めた全文検索 */}
        <div className="relative ml-auto">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="本文を検索"
            className="h-[30px] w-[180px] rounded-[8px] border border-slate-300 pl-8 pr-2.5 text-[11.5px] placeholder:text-slate-400" />
        </div>

        <span className="text-[10.5px] text-slate-400 tabular-nums">
          本文あり {comm.withBodyCount}/{comm.items.length}
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {items.length === 0 && (
          <div className="text-center text-slate-400 text-xs py-10">
            {kw ? `「${q}」に一致する会話がありません` : "会話ログがありません"}
          </div>
        )}
        {items.map(it => {
          const m = CHANNEL_META[it.channel];
          const Icon = m.icon;
          const isOpen = open.has(it.id);
          const isLong = it.bodyLength > BODY_PREVIEW_LIMIT;
          const hasDetail = (it.participants?.length ?? 0) > 0 || (it.actionItems?.length ?? 0) > 0;

          return (
            <div key={it.id} className="flex gap-3 px-4 py-3 hover:bg-slate-50/60">
              <div className={`w-7 h-7 rounded-lg grid place-items-center flex-none ${m.cls}`}><Icon className="w-3.5 h-3.5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${m.cls}`}>{m.label}</span>
                  {/* **見るべきは Open / Snooze だけ。** アサインの有無は運用上の意味が無い */}
                  {it.state && it.state !== "closed" && (
                    <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded flex-none ${STATE_META[it.state].cls}`}
                          title={STATE_META[it.state].hint}>
                      {STATE_META[it.state].label}
                    </span>
                  )}
                  {/* 元コンテンツへ飛ばす。Intercom は管理画面、CSE/議事録は Notion */}
                  {it.url ? (
                    <a href={it.url} target="_blank" rel="noopener noreferrer"
                       title={`${LINK_TARGET[it.channel] ?? "元データ"}で開く`}
                       className="group/link min-w-0 flex items-center gap-1 text-[12px] font-bold text-slate-800
                                  hover:text-blue-700 hover:underline decoration-blue-300 underline-offset-2">
                      <span className="truncate">{it.title}</span>
                      <ExternalLink className="w-3 h-3 flex-none text-slate-300 group-hover/link:text-blue-500" />
                    </a>
                  ) : (
                    <span className="text-[12px] font-bold text-slate-800 truncate">{it.title}</span>
                  )}
                  {it.meta && <span className="text-[10px] text-slate-400 flex-none">· {it.meta}</span>}
                  <span className="ml-auto flex-none text-right leading-tight">
                    <span className="block text-[10.5px] text-slate-500 tabular-nums" title="発生日時">
                      {it.date ? it.date.slice(0, 16).replace("T", " ") : "日時不明"}
                    </span>
                    <span className="block text-[9.5px] text-slate-400 tabular-nums" title="最終更新日時">
                      更新 {it.updatedAt ? it.updatedAt.slice(0, 16).replace("T", " ") : "—"}
                    </span>
                  </span>
                </div>

                {/* 本文 */}
                {it.bodyLength > 0 ? (
                  <>
                    <div className={`text-[11.5px] text-slate-600 mt-1.5 whitespace-pre-wrap leading-relaxed
                      ${isOpen ? "" : "line-clamp-3"}`}>
                      {it.body}
                    </div>
                    {(isLong || hasDetail) && (
                      <button onClick={() => toggle(it.id)}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition">
                        <ChevronRight className={`w-3 h-3 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                        {isOpen ? "閉じる" : `全文を表示（${it.bodyLength.toLocaleString("ja-JP")}字）`}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-[11px] text-slate-400 mt-1">（本文なし）</div>
                )}

                {/* 議事録の参加者・アクションアイテム */}
                {isOpen && hasDetail && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-2">
                    {(it.participants?.length ?? 0) > 0 && (
                      <div>
                        <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">参加者</div>
                        <div className="text-[11.5px] text-slate-600 mt-0.5">{it.participants!.join("、")}</div>
                      </div>
                    )}
                    {(it.actionItems?.length ?? 0) > 0 && (
                      <div>
                        <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">アクションアイテム</div>
                        <ul className="mt-0.5 space-y-0.5">
                          {it.actionItems!.map((a, i) => (
                            <li key={i} className="text-[11.5px] text-slate-600 flex items-start gap-1.5">
                              <span className="text-slate-300 mt-px">・</span>{a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-3.5 py-2 border-t border-slate-100 text-[10px] text-slate-400">
        議事録・メール・Intercom・Chatwork・Slack・CSE 案件を新しい順に表示。本文は元データに格納されているものをそのまま表示しています。
      </div>
    </Card>
  );
}

function HeaderStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (<div className="flex flex-col"><span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">{label}</span><span className="mt-0.5">{value}</span></div>);
}

function TopBar({ name, back }: { name?: string; back: { href: string; label: string } }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 bg-white border-b border-slate-200">
      <Link href={back.href} className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-blue-600"><ArrowLeft className="w-4 h-4" /> {back.label}</Link>
      <span className="text-slate-300">/</span>
      <span className="text-[13px] font-bold text-slate-800 truncate">{name ?? "会社詳細"}</span>
      <span className="ml-auto text-[11px] text-slate-400">利用状況ビュー</span>
    </div>
  );
}

// ─── 提案準備タブ ─────────────────────────────────────────────────────────────
//
// 「今この顧客に提案を持ち込んでよいか」を4要素で示す。
// 設計根拠: docs-src/cxm_v2/17_WHO_WHAT_Matching_Plan.md §15
//
// 判断は projects[] （＝部門・予算単位）を見る。会社単位で平均すると部門差が消える。

// 提案準備タブは**提案骨子を作ることだけ**を担う。
// 準備度の内訳・外部機会・部門別スコアは「顧客情報」タブに移した
// （2026-08-21）。1画面に判断材料と作業を同居させると、
// どこから手を付けるのかが分からなくなるため。
function ReadinessTab({ companyUid, profile }: {
  companyUid: string;
  /** 顧客情報タブで生成済みなら骨子のコンテキストに加える */
  profile: CompanyProfileResponse | null;
}) {
  return <ProposalFlow companyUid={companyUid} profile={profile} />;
}

/**
 * 提案準備度の詳細（顧客情報タブの折りたたみに置く）。
 *
 * **結論（スコア・提案の型）は StatusStrip が先頭で出す。**
 * ここは根拠であって、毎回開くものではない。
 * 外部機会は提案の型を切り替える最上位の要因なので、ここではなく上に出している。
 */
function ReadinessDetailBody({ data, loading }: {
  data: ReadinessResponse | null;
  loading: boolean;
}) {
  if (loading && !data) {
    return <div className="flex items-center gap-2 text-slate-400 py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">提案準備度を算出中…</span></div>;
  }
  if (!data) {
    return <div className="flex items-center gap-2 text-red-600 text-sm py-4"><AlertCircle className="w-4 h-4" />提案準備度を取得できませんでした</div>;
  }

  const rep = data.inputs.replaceability;

  return (
    <div className="space-y-4 pt-3">
      {/* ── プロジェクト（部門）別 ── 判断の主対象 */}
      <div>
        <div className="flex items-center gap-1.5 mb-2 px-0.5">
          <h2 className="text-[13px] font-bold text-slate-800">部門（プロジェクト）別の提案準備度</h2>
          <InfoTip text="同一企業でも部門・予算単位で準備度が逆になることがあります（主契約部門は解約方向、別部門は拡張余地など）。会社単位で平均すると差が消えるため、判断はこちらで行ってください。" />
          <span className="text-[11px] text-slate-400">
            有料 {data.inputs.paidProjectCount}件
            {data.inputs.excludedFreeCount > 0 && `（FREE ${data.inputs.excludedFreeCount}件を除外）`}
          </span>
        </div>
        {data.projects.length === 0 ? (
          <Card className="px-5 py-4"><div className="text-[12.5px] text-slate-500">有料プロジェクトがありません</div></Card>
        ) : (
          <div className="space-y-3">
            {data.projects.map(p => <ProjectReadinessCard key={p.project.id} item={p} />)}
          </div>
        )}
      </div>

      {/* 会社全体のスコア・提案の型・更新時期は StatusStrip（先頭）が出す。
          同じものを二度置くと、どちらが判断材料なのか分からなくなるためここには持たない。 */}

      {/* ── 摩擦の根拠（代替可能性の認知） ── */}
      {rep.detected && (
        <Card className="border-l-4 border-l-red-500">
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <h3 className="text-[13px] font-bold text-slate-800">「他ツールで代替可能」の認知を検出</h3>
              <InfoTip text="接点ログのキーワード照合による推定です。誤検知の可能性があるため、根拠を確認してください。サポートチケットが0件でも代替判断が出ていれば摩擦は存在します。" />
            </div>
            <p className="text-[12px] text-slate-500 mt-1">
              最新検出 {rep.latestDate ?? "時期不明"}
              {rep.competitors.length > 0 && <> ／ 言及された競合: <span className="font-semibold text-slate-700">{rep.competitors.join("、")}</span></>}
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {rep.hits.slice(0, 5).map((h, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                  <span className="tabular-nums text-slate-400">{h.date ?? "日付不明"}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                    {h.source === "minutes" ? "議事録" : h.source === "slack" ? "Slack" : "Chatwork"}
                  </span>
                  <span className="text-slate-700 truncate max-w-[22rem]">{h.label}</span>
                  <span className="text-red-600 font-semibold">{h.replacementTerms.join("・")}</span>
                  {h.competitorTerms.length > 0 && <span className="text-slate-500">（{h.competitorTerms.join("・")}）</span>}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {/* ── 入力の内訳（透明性） ── */}
      <Card>
        <div className="px-5 py-4">
          <div className="flex items-center gap-1.5">
            <Gauge className="w-4 h-4 text-slate-400" />
            <h3 className="text-[13px] font-bold text-slate-800">算出に使ったデータ</h3>
          </div>
          <dl className="mt-2.5 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-2 text-[12px]">
            <InputRow label="最終接点" value={data.inputs.lastContactDate ? `${data.inputs.lastContactDate}（${data.inputs.communicationBlankDays}日前）` : "記録なし"} />
            <InputRow label="直近90日の接点" value={`${data.inputs.touchpointCount90d}件`} />
            <InputRow label="オープンサポート" value={data.inputs.openSupportCount === null ? "不明" : `${data.inputs.openSupportCount}件`} />
            <InputRow label={`推移（${data.inputs.trendWindowDays}日）`} value={data.inputs.trendFrom && data.inputs.trendTo ? `${data.inputs.trendFrom} → ${data.inputs.trendTo}` : "比較不能"} />
          </dl>
          <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
            準備度は推定であり確定ではありません。根拠を確認のうえ判断してください。
            実行体制の推移は会社合計です（プロジェクト別の履歴は未保持）。
          </p>
        </div>
      </Card>
    </div>
  );
}

function InputRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10.5px] font-bold tracking-wide text-slate-400 uppercase">{label}</dt>
      <dd className="text-slate-700 tabular-nums mt-0.5">{value}</dd>
    </div>
  );
}

function ReadinessScore({ level, score }: { level: ReadinessLevel; score: number | null }) {
  const m = LEVEL_META[level];
  return (
    <div className="flex items-baseline gap-2">
      <span className={`text-3xl font-extrabold tabular-nums ${m.text}`}>{score ?? "—"}</span>
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${m.chip}`}>準備度 {m.label}</span>
    </div>
  );
}

function ProjectReadinessCard({ item }: { item: ReadinessProjectItem }) {
  const { readiness: r, play, project, signal } = item;
  const playMeta = PLAY_META[play.play];

  return (
    <Card className={`border-l-4 ${playMeta.ring}`}>
      <div className="px-5 py-4">
        {/* ヘッダー */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-bold text-slate-900 truncate">{project.name}</h3>
              {project.paidType && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{project.paidType}</span>}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${STATUS_META[project.status].cls}`}>{STATUS_META[project.status].label}</span>
            </div>
          </div>
          <ReadinessScore level={r.overall} score={r.overallScore} />
          <span className={`text-[11.5px] font-bold px-2.5 py-1 rounded-full ${playMeta.chip}`}>{play.label}</span>
        </div>

        {/* 指針 */}
        <p className="text-[12.5px] text-slate-700 leading-relaxed mt-2.5 bg-slate-50 rounded-[8px] px-3.5 py-2.5">
          {play.guidance}
        </p>

        {/* キャップ（判定を押し下げた理由） */}
        {r.caps.length > 0 && (
          <ul className="mt-2 space-y-1">
            {r.caps.map((c, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11.5px] text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{c}
              </li>
            ))}
          </ul>
        )}

        {/* 4要素 */}
        <div className="mt-3.5 space-y-2.5">
          {(["utilization", "execution", "relationship", "friction"] as const).map(key => (
            <FactorBar key={key} factorKey={key} factor={r.factors[key]} />
          ))}
        </div>

        {/* 利用実態の生値 */}
        {signal && (
          <div className="mt-3.5 pt-3 border-t border-slate-100 grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-2 text-[11.5px]">
            <SignalCell label="稼働キャンペーン" value={`${signal.runningCampaignWithGoalCount}本`} warn={signal.runningCampaignWithGoalCount <= 2} hint={usageHint("campaigns")} />
            <SignalCell label="ヒートマップ" value={`${signal.heatmapCount}件`} warn={signal.heatmapCount < 5} hint={usageHint("heatmaps")} />
            <SignalCell label="L30 活動" value={String(signal.l30Active)} hint={"過去30日のアクティブイベント数（ローリング）\n出所: Metabase project-signals の `L30 Active`"} />
            <SignalCell label="習慣化" value={project.habituationStatus === true ? "あり" : project.habituationStatus === false ? "なし" : "不明"} warn={project.habituationStatus === false} hint={usageHint("habituation")} />
            <SignalCell label="PV 消化" value={pvRatioLabel(signal.monthPvCount, signal.pvCeiling)} warn={isPvUnderused(signal.monthPvCount, signal.pvCeiling)} hint={usageHint("pvRate")} />
          </div>
        )}
      </div>
    </Card>
  );
}

function FactorBar({ factorKey, factor }: { factorKey: string; factor: ReadinessFactor }) {
  const m = LEVEL_META[factor.level];
  const meta = FACTOR_LABEL[factorKey];
  const width = factor.score ?? 0;

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11.5px] font-bold text-slate-600 w-[5.5rem] shrink-0">{meta.label}</span>
        <InfoTip text={meta.hint} />
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[3rem]">
          <div className={`h-full ${m.bar} rounded-full transition-all`} style={{ width: `${width}%` }} />
        </div>
        <span className={`text-[11.5px] font-extrabold tabular-nums w-8 text-right ${m.text}`}>{factor.score ?? "—"}</span>
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5 ml-[6.6rem]">
        {factor.reasons.join(" / ")}
      </p>
    </div>
  );
}

/** 利用実態の数字の説明。文言は USAGE_METRIC_META（proposal-readiness.ts）が正本 */
function usageHint(key: typeof USAGE_METRIC_META[number]["key"]): string {
  const m = USAGE_METRIC_META.find(x => x.key === key);
  if (!m) return "";
  return [m.label, m.meaning, `出所: ${m.source}`, m.caveat ? `注意: ${m.caveat}` : null]
    .filter(Boolean).join("\n");
}

function SignalCell({ label, value, warn = false, hint }: {
  label: string; value: string; warn?: boolean; hint?: string;
}) {
  return (
    <div title={hint} className={hint ? "cursor-help" : undefined}>
      <div className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">{label}</div>
      <div className={`tabular-nums font-semibold mt-0.5 ${warn ? "text-red-600" : "text-slate-700"}`}>{value}</div>
    </div>
  );
}

function pvRatioLabel(count: number | null, ceiling: number | null): string {
  if (!ceiling || ceiling <= 0 || count === null) return "—";
  return `${Math.round((count / ceiling) * 100)}%`;
}
function isPvUnderused(count: number | null, ceiling: number | null): boolean {
  if (!ceiling || ceiling <= 0 || count === null) return false;
  return count / ceiling < 0.40;
}

// ─── 外部機会（§11）────────────────────────────────────────────────────────────
//
// 「今提案する理由」を外部情報から自動判定する。
//
// 3層:
//   1. 確定シグナル … 登録済みの外部情報（IR/プレス/求人など）。判定に使う
//   2. 候補         … 議事録のキーワード一致。確信度が低いため判定に使わず、
//                     担当者が確認して「機会として登録」で確定に昇格させる
//   3. 手動上書き   … 自動判定を担当者が明示的に切り替える
//
// 外部機会は消耗品であり、準備度が低いときに使うと機会そのものを焼く（§15.2）。
// そのため「機会がある」と断定するハードルを高くしている。

const INTEL_SOURCE_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "hiring", label: "求人",       hint: "最速の先行指標。組織が動く前に出る" },
  { value: "press",  label: "プレス",     hint: "人事発表・組織改編のリリース" },
  { value: "ir",     label: "IR / 中計",  hint: "投資方針が明示される" },
  { value: "news",   label: "ニュース",   hint: "業界メディア・アナリスト" },
  { value: "manual", label: "その他",     hint: "商談メモ・伝聞など" },
];

interface ExtractedItem {
  signalId:   string;
  headline:   string;
  excerpt:    string;
  occurredAt: string | null;
  confidence: number;
  saved:      boolean;
  saveError?: string;
}

function ExternalOpportunityCard({ companyUid, data, loading, oppOverride, onSetOverride, onReload }: {
  companyUid: string;
  data: ReadinessResponse;
  loading: boolean;
  oppOverride: boolean | null;
  onSetOverride: (v: boolean | null) => void;
  onReload: () => void;
}) {
  const ext = data.externalOpportunity;
  const decided = data.hasExternalOpportunity;
  const [showCandidates, setShowCandidates] = useState(false);

  return (
    <Card className={`border-l-4 ${decided ? "border-l-blue-500" : "border-l-slate-300"}`}>
      <div className="px-5 py-4">
        {/* ── 判定結果 ── */}
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className={`w-4 h-4 ${decided ? "text-blue-600" : "text-slate-400"}`} />
              <h3 className="text-[13px] font-bold text-slate-800">外部機会（今提案する理由）</h3>
              <InfoTip text="IR の DX 投資・組織改編・求人・新サイトなど「今提案する理由」を外部情報から自動判定します。議事録のキーワード一致は確信度が低いため候補どまりで、担当者が確認して登録したものだけが判定に使われます。" />
            </div>
            <p className="text-[12.5px] mt-1">
              {decided
                ? <span className="text-blue-700 font-bold">機会あり — 提案の型が「拡張 / 接続」に切り替わります</span>
                : <span className="text-slate-500">機会は観測されていません（提案の型は「深化 / 立て直し」のまま）</span>}
              {data.opportunityOverridden && <span className="text-amber-700 font-semibold">（手動で上書き中）</span>}
            </p>
          </div>

          {/* 手動上書き */}
          <div className="flex items-center gap-1">
            {([["自動", null], ["あり", true], ["なし", false]] as const).map(([label, v]) => (
              <button key={label} onClick={() => onSetOverride(v)} disabled={loading}
                className={`px-2.5 py-1.5 rounded-[8px] text-[11.5px] font-bold border transition disabled:opacity-50
                  ${oppOverride === v
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-500 border-slate-300 hover:border-slate-400"}`}>
                {label}
              </button>
            ))}
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 ml-1" />}
          </div>
        </div>

        {/* ── 確定シグナル ── */}
        {ext.activeSignals.length > 0 && (
          <div className="mt-3 space-y-2">
            {ext.activeSignals.map((s, i) => <SignalRow key={i} signal={s} tone="active" />)}
          </div>
        )}

        {/* ── 候補（議事録由来）──
            **既定は畳む。** 候補は「判定に使っていないもの」なので、
            全件展開すると確定シグナルより目立ち、その下の顧客理解を押し下げていた（2026-08-24）。 */}
        {ext.candidateSignals.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setShowCandidates(v => !v)}
              className="flex items-center gap-1.5 text-left group">
              <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showCandidates ? "rotate-90" : ""}`} />
              <span className="text-[10.5px] font-bold tracking-wide text-slate-400 uppercase group-hover:text-slate-600">
                候補 {ext.candidateSignals.length}件（判定には使っていません）
              </span>
              <InfoTip text="議事録のキーワード一致で見つかった候補です。「交代」「新体制」などの語は機会でない文脈でも一致するため、そのままでは判定に使いません。内容を確認して、本当に機会であれば外部情報として登録してください。" />
            </button>
            {showCandidates && (
              <div className="mt-1.5 space-y-2">
                {ext.candidateSignals.slice(0, 6).map((s, i) => <SignalRow key={i} signal={s} tone="candidate" />)}
              </div>
            )}
          </div>
        )}

        {/* ── 摩擦シグナル ── */}
        {ext.frictionSignals.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <span className="text-[10.5px] font-bold tracking-wide text-red-500 uppercase">
              摩擦 {ext.frictionSignals.length}件
            </span>
            <div className="mt-1.5 space-y-2">
              {ext.frictionSignals.slice(0, 3).map((s, i) => <SignalRow key={i} signal={s} tone="friction" />)}
            </div>
          </div>
        )}

        {ext.allSignals.length === 0 && (
          <p className="text-[12px] text-slate-400 mt-3">
            外部情報がまだ登録されていません。IR・プレスリリース・求人票などを貼り付けて登録すると、提案の型に反映されます。
          </p>
        )}

        {/* ── AI 調査（human in the loop）── */}
        <div className="mt-3.5 pt-3 border-t border-slate-100">
          <ResearchPanel companyUid={companyUid} onSaved={onReload} />
        </div>

        {/* ── 手元の資料から取り込む（URL / ファイル / テキスト）── */}
        <div className="mt-2">
          <IngestPanel companyUid={companyUid} onSaved={onReload} />
        </div>
      </div>
    </Card>
  );
}

function SignalRow({ signal, tone }: {
  signal: ReadinessResponse["externalOpportunity"]["activeSignals"][number];
  tone: "active" | "candidate" | "friction";
}) {
  const cls =
    tone === "active"    ? "bg-blue-50 text-blue-700" :
    tone === "friction"  ? "bg-red-50 text-red-700" :
                           "bg-slate-100 text-slate-500";
  return (
    <div className="text-[11.5px]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${cls}`}>{signal.signalId}</span>
        <span className="font-semibold text-slate-800">{signal.headline}</span>
        <span className="text-slate-400 tabular-nums">{signal.occurredAt ?? "日付不明"}</span>
        {signal.sourceUrl
          ? <a href={signal.sourceUrl} target="_blank" rel="noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
              出典<ArrowUpRight className="w-3 h-3" />
            </a>
          : signal.sourceRef && <span className="text-slate-400 truncate max-w-[16rem]">{signal.sourceRef}</span>}
      </div>
      {signal.excerpt && (
        <p className="text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{signal.excerpt}</p>
      )}
    </div>
  );
}

// ─── AI 調査パネル（human in the loop）────────────────────────────────────────
//
// 自然言語で指示 → AI が Web 検索して候補を提示 → **担当者が選んだものだけ登録**。
//
// AI は提案までしか行わない。保存は必ず人の選択を経る:
//   - 候補は既定で全て未選択（うっかり全部入れられないようにする）
//   - 出典URL を必ず表示し、原文を確認できる
//   - 見出しと日付はその場で編集できる
//   - 出典が取れなかった候補は保存できない（§11 の原則）

const RESEARCH_PRESETS = [
  "2026年の組織変更・人事異動を調べて",
  "中期経営計画やIRでのDX・AI投資の方針を調べて",
  "データ・マーケティング・DX関連職種の求人が出ていないか調べて",
  "新しいサービスやサイトの立ち上げがないか調べて",
];

interface ResearchFindingUI {
  signalId:   string;
  headline:   string;
  excerpt:    string;
  occurredAt: string | null;
  confidence: number;
  sourceUrl:  string | null;
  sourceRef:  string | null;
  source:     string;
}

function ResearchPanel({ companyUid, onSaved }: { companyUid: string; onSaved: () => void }) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy]       = useState(false);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const [result, setResult]   = useState<{
    summary: string; findings: ResearchFindingUI[];
    sources: Array<{ url: string; title: string }>; costUsd: number | null; note: string;
  } | null>(null);
  const [picked, setPicked]   = useState<Set<number>>(new Set());
  const [edits, setEdits]     = useState<Record<number, { headline?: string; occurredAt?: string }>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const research = async () => {
    if (!instruction.trim()) return;
    setBusy(true); setErr(null); setResult(null); setPicked(new Set()); setEdits({}); setSavedMsg(null);
    try {
      const res = await fetch(`/api/company/${companyUid}/external-intel/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? `HTTP ${res.status}`); return; }
      setResult(json);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!result || picked.size === 0) return;
    setSaving(true); setErr(null);
    try {
      const items = [...picked].map(i => {
        const f = result.findings[i];
        return {
          ...f,
          headline:   edits[i]?.headline   ?? f.headline,
          occurredAt: edits[i]?.occurredAt ?? f.occurredAt,
        };
      });
      const res = await fetch(`/api/company/${companyUid}/external-intel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, createdBy: "AI調査（承認済み）" }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? `HTTP ${res.status}`); return; }
      const ok = (json.extracted ?? []).filter((e: { saved: boolean }) => e.saved).length;
      setSavedMsg(`${ok}件を登録しました`);
      setResult(null); setPicked(new Set()); setEdits({});
      onSaved();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (i: number) =>
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
        <span className="text-[12px] font-bold text-slate-800">AI に調べてもらう</span>
        <InfoTip text="自然言語で指示すると、AI が Web 検索して外部シグナルの候補を出します。AI は提案までで、登録するかどうかは担当者が選びます。出典URLが取れなかった候補は登録できません。" />
      </div>

      <div className="flex gap-2 mt-2">
        <input
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !busy) research(); }}
          placeholder="例: 2026年の組織変更とDX投資の方針を調べて"
          className="flex-1 h-[34px] rounded-[8px] border border-slate-300 px-3 text-[12.5px] placeholder:text-slate-400" />
        <button onClick={research} disabled={busy || !instruction.trim()}
          className="px-4 py-2 rounded-[8px] text-[12.5px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 flex items-center gap-1.5">
          {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />調査中…</> : "調べる"}
        </button>
      </div>

      {/* 指示のプリセット */}
      {!result && !busy && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {RESEARCH_PRESETS.map(p => (
            <button key={p} onClick={() => setInstruction(p)}
              className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
              {p}
            </button>
          ))}
        </div>
      )}

      {busy && (
        <p className="text-[11.5px] text-slate-400 mt-2">
          Web を検索して、提案判断に使える事象だけを抽出しています（30秒ほどかかります）
        </p>
      )}

      {savedMsg && (
        <div className="flex items-center gap-1.5 text-[11.5px] text-emerald-700 bg-emerald-50 rounded-[8px] px-3 py-2 mt-2">
          <Check className="w-3.5 h-3.5" />{savedMsg}
        </div>
      )}

      {err && (
        <div className="flex items-start gap-1.5 text-[11.5px] text-red-600 bg-red-50 rounded-[8px] px-3 py-2 mt-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />{err}
        </div>
      )}

      {/* ── 候補（未保存）── */}
      {result && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[11.5px] font-bold text-slate-700">
              候補 {result.findings.length}件（未登録）
            </span>
            <span className="text-[11px] text-slate-400">
              出典 {result.sources.length}件
              {result.costUsd !== null && ` ・ 約 $${result.costUsd.toFixed(3)}`}
            </span>
            {result.summary && (
              <button onClick={() => setShowSummary(v => !v)}
                className="text-[11px] text-blue-600 hover:underline">
                {showSummary ? "調査メモを閉じる" : "調査メモを見る"}
              </button>
            )}
          </div>

          {showSummary && (
            <div className="mt-2 rounded-[8px] bg-slate-50 px-3.5 py-3 text-[11.5px] text-slate-600 whitespace-pre-wrap leading-relaxed max-h-[20rem] overflow-y-auto">
              {result.summary}
            </div>
          )}

          {result.findings.length === 0 && (
            <p className="text-[11.5px] text-slate-500 mt-2">
              提案判断に使える事象は見つかりませんでした。{result.note && `（${result.note}）`}
            </p>
          )}

          <div className="mt-2 space-y-2">
            {result.findings.map((f, i) => {
              const on = picked.has(i);
              const noSource = !f.sourceUrl && !f.sourceRef;
              return (
                <div key={i}
                  className={`rounded-[8px] border px-3.5 py-3 transition
                    ${noSource ? "border-slate-200 bg-slate-50 opacity-70"
                      : on ? "border-blue-400 bg-blue-50/40" : "border-slate-200 hover:border-slate-300"}`}>
                  <div className="flex items-start gap-2.5">
                    <button onClick={() => !noSource && toggle(i)} disabled={noSource}
                      className={`mt-0.5 w-4 h-4 rounded border grid place-items-center shrink-0 transition
                        ${on ? "bg-blue-600 border-blue-600" : "bg-white border-slate-300"} disabled:opacity-40`}>
                      {on && <Check className="w-3 h-3 text-white" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{f.signalId}</span>
                        <span className="text-[10px] text-slate-400">確信度 {f.confidence}</span>
                        <span className="text-[10px] text-slate-400">{f.source}</span>
                        {f.sourceUrl
                          ? <a href={f.sourceUrl} target="_blank" rel="noreferrer"
                              className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-0.5">
                              出典を開く<ArrowUpRight className="w-3 h-3" />
                            </a>
                          : <span className="text-[11px] text-red-600">出典が特定できず登録できません</span>}
                      </div>

                      {/* 見出しと日付は編集できる */}
                      <input
                        value={edits[i]?.headline ?? f.headline}
                        onChange={e => setEdits(p => ({ ...p, [i]: { ...p[i], headline: e.target.value } }))}
                        disabled={noSource}
                        className="w-full mt-1.5 text-[12.5px] font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-400 focus:outline-none disabled:opacity-60" />

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400">日付</span>
                        <input
                          value={edits[i]?.occurredAt ?? f.occurredAt ?? ""}
                          onChange={e => setEdits(p => ({ ...p, [i]: { ...p[i], occurredAt: e.target.value } }))}
                          placeholder="YYYY-MM-DD"
                          disabled={noSource}
                          className="w-[7.5rem] text-[11.5px] tabular-nums bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-400 focus:outline-none disabled:opacity-60" />
                        {!f.occurredAt && (
                          <span className="text-[10px] text-amber-700">日付がないと機会として採用されません</span>
                        )}
                      </div>

                      <p className="text-[11.5px] text-slate-500 mt-1.5 leading-relaxed line-clamp-3">{f.excerpt}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {result.findings.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button onClick={save} disabled={saving || picked.size === 0}
                className="px-4 py-2 rounded-[8px] text-[12.5px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 flex items-center gap-1.5">
                {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />登録中…</> : `選択した ${picked.size}件を登録`}
              </button>
              <button onClick={() => { setResult(null); setPicked(new Set()); setEdits({}); }}
                className="px-3.5 py-2 rounded-[8px] text-[12px] font-semibold text-slate-500 hover:text-slate-700 transition">
                破棄
              </button>
              <span className="text-[11px] text-slate-400">
                登録すると提案の型に反映されます。内容は登録前に編集できます。
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 資料の取り込み（URL / ファイル / テキスト）────────────────────────────────
//
// 「URLを貼るだけ」「PDFを投げるだけ」で候補を出す。出典は自動で埋まる。
// 抽出結果は候補として提示するだけで、登録するかは担当者が選ぶ（human in the loop）。

type IngestMode = "url" | "file" | "text";

function IngestPanel({ companyUid, onSaved }: { companyUid: string; onSaved: () => void }) {
  const [open, setOpen]   = useState(false);
  const [mode, setMode]   = useState<IngestMode>("url");
  const [url, setUrl]     = useState("");
  const [text, setText]   = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [busy, setBusy]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [doc, setDoc]     = useState<{ kind: string; title: string | null; chars: number; truncated: boolean } | null>(null);
  const [findings, setFindings] = useState<ResearchFindingUI[] | null>(null);
  const [note, setNote]   = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const reset = () => { setFindings(null); setDoc(null); setPicked(new Set()); setErr(null); setSavedMsg(null); };

  const ingestUrl = async () => {
    if (!url.trim()) return;
    setBusy(true); reset();
    try {
      const res = await fetch(`/api/company/${companyUid}/external-intel/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? `HTTP ${res.status}`); return; }
      setDoc(json.document); setFindings(json.findings ?? []); setNote(json.note ?? "");
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  };

  const ingestFile = async (file: File) => {
    setBusy(true); reset();
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/company/${companyUid}/external-intel/ingest`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? `HTTP ${res.status}`); return; }
      setDoc(json.document); setFindings(json.findings ?? []); setNote(json.note ?? "");
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  };

  const ingestText = async () => {
    if (!text.trim()) return;
    setBusy(true); reset();
    try {
      const res = await fetch(`/api/company/${companyUid}/external-intel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          sourceLabel: sourceLabel.trim() || "手元の資料",
          source: "manual",
          dryRun: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? `HTTP ${res.status}`); return; }
      setDoc({ kind: "text", title: sourceLabel.trim() || "手元の資料", chars: text.length, truncated: false });
      setFindings((json.extracted ?? []).map((e: ExtractedItem) => ({
        signalId: e.signalId, headline: e.headline, excerpt: e.excerpt,
        occurredAt: e.occurredAt, confidence: e.confidence,
        sourceUrl: null, sourceRef: sourceLabel.trim() || "手元の資料", source: "manual",
      })));
      setNote(json.note ?? "");
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  };

  const save = async () => {
    if (!findings || picked.size === 0) return;
    setSaving(true); setErr(null);
    try {
      const items = [...picked].map(i => findings[i]);
      const res = await fetch(`/api/company/${companyUid}/external-intel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, createdBy: "資料取り込み（承認済み）" }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? `HTTP ${res.status}`); return; }
      const ok = (json.extracted ?? []).filter((e: { saved: boolean }) => e.saved).length;
      setSavedMsg(`${ok}件を登録しました`);
      setFindings(null); setDoc(null); setPicked(new Set());
      setUrl(""); setText("");
      onSaved();
    } catch (e) { setErr(String(e)); } finally { setSaving(false); }
  };

  const toggle = (i: number) =>
    setPicked(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-500 hover:text-slate-700 transition">
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
        手元の資料から取り込む（URL / PDF / テキスト）
      </button>

      {open && (
        <div className="mt-3">
          {/* 入力方法 */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            {([["url", "URLを貼る"], ["file", "ファイルを選ぶ"], ["text", "テキストを貼る"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => { setMode(k); reset(); }}
                className={`px-2.5 py-1 text-[11.5px] font-semibold rounded-md transition
                  ${mode === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="mt-2.5">
            {mode === "url" && (
              <div className="flex gap-2">
                <input value={url} onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !busy) ingestUrl(); }}
                  placeholder="IR資料・プレスリリース・求人ページのURL（PDFも可）"
                  className="flex-1 h-[34px] rounded-[8px] border border-slate-300 px-3 text-[12.5px] placeholder:text-slate-400" />
                <button onClick={ingestUrl} disabled={busy || !url.trim()}
                  className="px-4 py-2 rounded-[8px] text-[12.5px] font-bold bg-slate-900 text-white hover:bg-slate-700 transition disabled:opacity-40 flex items-center gap-1.5">
                  {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />読込中…</> : "読み込む"}
                </button>
              </div>
            )}

            {mode === "file" && (
              <label className={`flex items-center justify-center gap-2 h-[72px] rounded-[8px] border-2 border-dashed transition cursor-pointer
                ${busy ? "border-slate-200 opacity-60" : "border-slate-300 hover:border-blue-400 hover:bg-blue-50/30"}`}>
                <input type="file" accept=".pdf,.html,.htm,.txt,.md,.csv" className="hidden" disabled={busy}
                  onChange={e => { const f = e.target.files?.[0]; if (f) ingestFile(f); e.target.value = ""; }} />
                {busy
                  ? <><Loader2 className="w-4 h-4 animate-spin text-slate-400" /><span className="text-[12px] text-slate-500">読み込み中…</span></>
                  : <><FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-[12px] text-slate-500">PDF / HTML / テキストを選択（最大15MB）</span></>}
              </label>
            )}

            {mode === "text" && (
              <div className="space-y-2">
                <input value={sourceLabel} onChange={e => setSourceLabel(e.target.value)}
                  placeholder="出典の名称（任意。空欄なら「手元の資料」）"
                  className="w-full h-[32px] rounded-[8px] border border-slate-300 px-2.5 text-[12px] placeholder:text-slate-400" />
                <textarea value={text} onChange={e => setText(e.target.value)} rows={5}
                  placeholder="資料の本文をそのまま貼り付けてください。全文で構いません。"
                  className="w-full rounded-[8px] border border-slate-300 px-2.5 py-2 text-[12px] leading-relaxed placeholder:text-slate-400" />
                <button onClick={ingestText} disabled={busy || !text.trim()}
                  className="px-4 py-2 rounded-[8px] text-[12.5px] font-bold bg-slate-900 text-white hover:bg-slate-700 transition disabled:opacity-40 flex items-center gap-1.5">
                  {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />抽出中…</> : "抽出する"}
                </button>
              </div>
            )}
          </div>

          {savedMsg && (
            <div className="flex items-center gap-1.5 text-[11.5px] text-emerald-700 bg-emerald-50 rounded-[8px] px-3 py-2 mt-2">
              <Check className="w-3.5 h-3.5" />{savedMsg}
            </div>
          )}
          {err && (
            <div className="flex items-start gap-1.5 text-[11.5px] text-red-600 bg-red-50 rounded-[8px] px-3 py-2 mt-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />{err}
            </div>
          )}

          {/* 読み込んだ資料と候補 */}
          {doc && findings && (
            <div className="mt-3">
              <div className="text-[11px] text-slate-500">
                読み込み: <span className="font-semibold text-slate-700">{doc.title ?? "(タイトルなし)"}</span>
                <span className="text-slate-400"> ・ {doc.kind.toUpperCase()} ・ {doc.chars.toLocaleString("ja-JP")}字</span>
                {doc.truncated && <span className="text-amber-700"> ・ 長いため一部のみ解析</span>}
              </div>

              {findings.length === 0 ? (
                <p className="text-[11.5px] text-slate-500 mt-2">
                  提案判断に使える事象は見つかりませんでした。{note && `（${note}）`}
                </p>
              ) : (
                <>
                  <div className="mt-2 space-y-2">
                    {findings.map((f, i) => {
                      const on = picked.has(i);
                      return (
                        <div key={i}
                          className={`rounded-[8px] border px-3.5 py-2.5 transition
                            ${on ? "border-blue-400 bg-blue-50/40" : "border-slate-200 hover:border-slate-300"}`}>
                          <div className="flex items-start gap-2.5">
                            <button onClick={() => toggle(i)}
                              className={`mt-0.5 w-4 h-4 rounded border grid place-items-center shrink-0 transition
                                ${on ? "bg-blue-600 border-blue-600" : "bg-white border-slate-300"}`}>
                              {on && <Check className="w-3 h-3 text-white" />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{f.signalId}</span>
                                <span className="text-[12.5px] font-semibold text-slate-800">{f.headline}</span>
                                <span className="text-[10px] text-slate-400 tabular-nums">{f.occurredAt ?? "日付なし"}</span>
                              </div>
                              <p className="text-[11.5px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{f.excerpt}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <button onClick={save} disabled={saving || picked.size === 0}
                      className="px-4 py-2 rounded-[8px] text-[12.5px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 flex items-center gap-1.5">
                      {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />登録中…</> : `選択した ${picked.size}件を登録`}
                    </button>
                    <button onClick={reset}
                      className="px-3.5 py-2 rounded-[8px] text-[12px] font-semibold text-slate-500 hover:text-slate-700 transition">
                      破棄
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 顧客情報タブ ─────────────────────────────────────────────────────────────
//
// 商談・定例の前に読む「この顧客に何が起きているか」。
// 準備度スコア（計器）とは別に、**読める記述**として顧客理解を置く。
//
// 各記述には出典が紐づく。出典のない記述は生成側で作れない構造にしてある（§11 の原則）。
// 最後の「まだ分かっていないこと」は、次に何を聞くべきかを示すためのもので、
// 欠損を隠さないことが WHO 理解を進める前提になる（§9.4）。

const EVIDENCE_KIND_CLS: Record<string, string> = {
  "業界":     "bg-indigo-50 text-indigo-700",
  "外部情報": "bg-blue-50 text-blue-700",
  "議事録":   "bg-slate-100 text-slate-600",
  "利用実態": "bg-emerald-50 text-emerald-700",
  "サポート": "bg-amber-50 text-amber-700",
  "契約":     "bg-violet-50 text-violet-700",
  "人物":     "bg-slate-100 text-slate-600",
  "チャット": "bg-slate-100 text-slate-600",
};

/**
 * 出典の時点表示。
 *   date … 議事録の開催日・スナップショット日（社内データの日付）
 *   asOf … 外部記事の公開時期・データの集計時期（鮮度の判断に使う）
 * 古い情報は色を落として、鮮度が低いことが分かるようにする。
 */
function EvidenceWhen({ date, asOf, kind }: { date: string | null; asOf: string | null; kind?: string }) {
  if (date) return <span className="tabular-nums opacity-70">{date}</span>;
  // 手動登録した外部情報で時点が取れない場合は隠さず出す。
  // 業界トレンドは時点不明なら採用時点で除外されるため、ここには来ない。
  if (!asOf) {
    return kind === "外部情報"
      ? <span className="opacity-50" title="出典から情報の時点を読み取れませんでした">時点不明</span>
      : null;
  }

  // "YYYY" or "YYYY-MM" から経過月数を出して、古いものは弱く見せる
  const now = new Date();
  const [y, m] = asOf.split("-").map(Number);
  const months = Number.isFinite(y)
    ? (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - (m || 12))
    : 0;
  const stale = months >= 24;

  return (
    <span className={`tabular-nums ${stale ? "opacity-50" : "opacity-70"}`}
      title={stale ? `${asOf}時点の情報（2年以上前）` : `${asOf}時点の情報`}>
      {asOf}時点{stale ? " ⚠" : ""}
    </span>
  );
}

/**
 * 顧客情報タブ。
 * 顧客理解（LLM生成）に加えて、**提案準備度の内訳をここに置く**（2026-08-21 移設）。
 * 提案準備タブは骨子を作る作業だけにしたいため、判断材料はこちらに集める。
 * 顧客理解が未生成でも準備度は読めるようにする（生成に30秒かかるため）。
 */
function ProfileTab({
  data, loading, error, onRegenerate, onFetchIndustry,
  companyUid, readiness, readinessLoading, oppOverride, onSetOverride, onReloadReadiness,
}: {
  data: CompanyProfileResponse | null;
  loading: boolean;
  error: string | null;
  onRegenerate: () => void;
  onFetchIndustry: () => void;
  /** 提案準備度の内訳（提案準備タブから移設） */
  companyUid: string;
  readiness: ReadinessResponse | null;
  readinessLoading: boolean;
  oppOverride: boolean | null;
  onSetOverride: (v: boolean | null) => void;
  onReloadReadiness: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* ── 1. 判断の要約 ──
          顧客理解の生成は30秒かかる。その間ページの上半分が空白になっていたので、
          **待たずに出せる準備度・提案の型・更新時期を先頭に置く**（2026-08-24）。 */}
      <StatusStrip data={readiness} loading={readinessLoading} />

      {/* ── 2. 外部機会（今提案する理由）──
          提案の型を切り替える最上位の要因なので、詳細の折りたたみには入れない。 */}
      {readiness && (
        <ExternalOpportunityCard
          companyUid={companyUid}
          data={readiness}
          loading={readinessLoading}
          oppOverride={oppOverride}
          onSetOverride={onSetOverride}
          onReload={onReloadReadiness}
        />
      )}

      {/* ── 3. 顧客理解（LLM生成）── */}
      <ProfileUnderstanding
        data={data} loading={loading} error={error}
        onRegenerate={onRegenerate} onFetchIndustry={onFetchIndustry}
      />

      {/* ── 4. 判断の根拠（毎回は見ない）── */}
      <Collapsible icon={Gauge} title="提案準備度の詳細"
        note="部門（プロジェクト）別のスコア・会社全体の参考値・摩擦の根拠・算出に使ったデータ">
        <ReadinessDetailBody data={readiness} loading={readinessLoading} />
      </Collapsible>

      {/* ── 5. 施策から読む組織の動き（明細は押したときだけ取得する）── */}
      <CampaignOrgSection companyUid={companyUid} />
    </div>
  );
}

/**
 * 判断の要約。**顧客理解の生成（30秒）を待たずに出す。**
 * ここだけ読めば「今この顧客に提案を持ち込んでよいか」の結論が分かる。
 */
function StatusStrip({ data, loading }: { data: ReadinessResponse | null; loading: boolean }) {
  if (!data) {
    return (
      <Card className="px-5 py-3.5">
        <div className="flex items-center gap-2 text-[12.5px]">
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin text-slate-400" /><span className="text-slate-400">提案準備度を算出中…</span></>
          ) : (
            <><AlertCircle className="w-4 h-4 text-red-500" /><span className="text-red-600">提案準備度を取得できませんでした</span></>
          )}
        </div>
      </Card>
    );
  }

  const play = data.company.play;
  const meta = PLAY_META[play.play];

  return (
    <Card className={`border-l-4 ${meta.ring}`}>
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <ReadinessScore level={data.company.readiness.overall} score={data.company.readiness.overallScore} />
          <span className={`text-[11.5px] font-bold px-2.5 py-1 rounded-full ${meta.chip}`}>{play.label}</span>
          {data.renewalBucket && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full
              ${data.renewalBucket === "31-90" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
              更新 {data.renewalBucket}{data.renewalDate ? `（${data.renewalDate}）` : ""}
            </span>
          )}
          <span className="text-[11px] text-slate-400 ml-auto">
            有料 {data.inputs.paidProjectCount}プロジェクト
            {data.inputs.excludedFreeCount > 0 && `（FREE ${data.inputs.excludedFreeCount}件を除外）`}
          </span>
        </div>

        {/* 判断の指針。スコアだけでは何をすべきか分からない */}
        <p className="text-[12.5px] text-slate-700 leading-relaxed mt-2.5">{play.guidance}</p>

        {play.reasons.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {play.reasons.map((r, i) => (
              <li key={i} className="text-[11px] text-slate-400">・{r}</li>
            ))}
          </ul>
        )}

        {/* 4要素。会社全体は参考値だが、どこが欠けているかは先頭で見せる */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 mt-3 pt-3 border-t border-slate-100">
          {(Object.keys(FACTOR_META) as ReadinessFactorKey[]).map(k => (
            <FactorBar key={k} factorKey={k} factor={data.company.readiness.factors[k]} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function ProfileUnderstanding({ data, loading, error, onRegenerate, onFetchIndustry }: {
  data: CompanyProfileResponse | null;
  loading: boolean;
  error: string | null;
  onRegenerate: () => void;
  onFetchIndustry: () => void;
}) {
  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-slate-400 py-20">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">顧客理解をまとめています…</span>
        <span className="text-[11.5px] text-slate-400">議事録・利用実態・外部情報を読んでいます（30秒ほど）</span>
      </div>
    );
  }
  if (error && !data) {
    return (
      <Card className="px-5 py-4">
        <div className="flex items-start gap-2 text-red-600 text-[12.5px]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-px" />{error}
        </div>
        <button onClick={onRegenerate}
          className="mt-3 px-3.5 py-2 rounded-[8px] text-[12px] font-bold border border-slate-300 text-slate-700 hover:border-slate-400 transition">
          再実行
        </button>
      </Card>
    );
  }
  if (!data) return null;

  const hasAny = data.sections.some(s => s.bullets.length > 0);

  return (
    <div className="space-y-4">
      {/* ヘッドライン */}
      <Card className="border-l-4 border-l-slate-900">
        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10.5px] font-bold tracking-wide text-slate-400 uppercase">いま何が起きているか</span>
                <InfoTip text="議事録・利用実態・外部情報・契約状況・サポート状況から生成した要約です。各記述には出典が紐づいており、出典のない記述は生成できない構造になっています。" />
              </div>
              <p className="text-[13.5px] text-slate-800 leading-relaxed mt-1.5">{data.headline}</p>
            </div>
            <button onClick={onRegenerate} disabled={loading} title="材料を読み直して作り直す（30秒ほど）"
              className="shrink-0 p-2 rounded-[8px] border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 transition disabled:opacity-40">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* 材料の内訳 */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
            <span className="text-[10.5px] text-slate-400">材料</span>
            {Object.entries(data.evidenceCounts).map(([kind, n]) => (
              <span key={kind} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${EVIDENCE_KIND_CLS[kind] ?? "bg-slate-100 text-slate-500"}`}>
                {kind} {n}
              </span>
            ))}

            {/* 業界トレンドは Web 検索が要るので明示的に取りに行く */}
            {data.industry.trendCount === 0 ? (
              <button onClick={onFetchIndustry} disabled={loading}
                className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition disabled:opacity-40">
                <Sparkles className="w-3 h-3" />業界トレンドを調べる
              </button>
            ) : (
              <span className="ml-auto text-[10.5px] text-slate-400">
                業界{data.industry.name ? `: ${data.industry.name}` : "トレンド"}（{data.industry.trendCount}件）
                <button onClick={onFetchIndustry} disabled={loading}
                  className="ml-1.5 text-blue-600 hover:underline disabled:opacity-40">更新</button>
              </span>
            )}
          </div>

          {/* 出典の採用条件と除外件数（なぜ件数が少ないかを隠さない） */}
          {data.industry.trendCount > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[10.5px] text-slate-400">
              <span>
                外部情報は「出典が開ける・{Math.floor(data.industry.policy.maxAgeMonths / 12)}年以内・時点が特定できる」もののみ採用
              </span>
              {data.industry.excluded && (() => {
                const e = data.industry.excluded;
                const parts = [
                  e.deadLink    ? `リンク切れ ${e.deadLink}` : null,
                  e.tooOld      ? `${Math.floor(data.industry.policy.maxAgeMonths / 12)}年より古い ${e.tooOld}` : null,
                  e.unknownDate ? `時点不明 ${e.unknownDate}` : null,
                  e.noSource    ? `出典なし ${e.noSource}` : null,
                ].filter(Boolean);
                return parts.length > 0
                  ? <span className="text-amber-700">（除外 {parts.join(" / ")}）</span>
                  : <span className="text-emerald-700">（除外なし）</span>;
              })()}
            </div>
          )}
        </div>
      </Card>

      {data.industry.trendCount === 0 && (
        <Card className="border-l-4 border-l-blue-300">
          <div className="px-5 py-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="text-[12px] text-slate-600 flex-1 min-w-0">
              「市場・業界の動き」は業界レベルの情報が必要なため、まだ空です。
              <span className="text-slate-400">（個社の材料から業界トレンドを推測させない設計にしています）</span>
            </p>
            <button onClick={onFetchIndustry} disabled={loading}
              className="px-3.5 py-1.5 rounded-[8px] text-[12px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 flex items-center gap-1.5">
              {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />調査中…</> : <><Sparkles className="w-3.5 h-3.5" />業界トレンドを調べる</>}
            </button>
          </div>
        </Card>
      )}

      {!hasAny && (
        <Card className="px-5 py-6">
          <p className="text-[12.5px] text-slate-500 text-center">
            記述できる材料がまだ足りません。議事録・利用実態・外部情報のいずれかを増やしてください。
          </p>
        </Card>
      )}

      {/* セクション */}
      {data.sections.filter(s => s.bullets.length > 0).map(section => (
        <Card key={section.key}>
          <div className="px-5 py-4">
            <h2 className="text-[13.5px] font-bold text-slate-900 pb-2.5 border-b border-slate-200">
              {section.title}
            </h2>
            <ul className="mt-3 space-y-3">
              {section.bullets.map((b, i) => (
                <li key={i}>
                  <div className="flex items-start gap-2">
                    <span className="text-slate-300 mt-1 text-[10px]">●</span>
                    <p className="text-[12.5px] text-slate-700 leading-relaxed flex-1">{b.text}</p>
                  </div>
                  {b.evidence.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1 ml-4">
                      {b.evidence.map((e, j) => (
                        e.url ? (
                          <a key={j} href={e.url} target="_blank" rel="noreferrer"
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1 hover:underline ${EVIDENCE_KIND_CLS[e.kind] ?? "bg-slate-100 text-slate-500"}`}>
                            <EvidenceWhen date={e.date} asOf={e.asOf} kind={e.kind} />
                            {e.label.slice(0, 40)}
                            <ArrowUpRight className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span key={j} title={e.label}
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${EVIDENCE_KIND_CLS[e.kind] ?? "bg-slate-100 text-slate-500"}`}>
                            <EvidenceWhen date={e.date} asOf={e.asOf} kind={e.kind} />
                            {e.label.slice(0, 40)}
                          </span>
                        )
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ))}

      {/* まだ分かっていないこと */}
      {data.unknowns.length > 0 && (
        <Card className="border-l-4 border-l-amber-400">
          <div className="px-5 py-4">
            <div className="flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-amber-500" />
              <h2 className="text-[13.5px] font-bold text-slate-900">まだ分かっていないこと</h2>
              <InfoTip text="材料から読み取れなかった重要事項です。次の商談で確認すべきことを示しています。ここが埋まるほど提案の精度が上がります。" />
              <span className="text-[11px] text-slate-400 tabular-nums">{data.unknowns.length}件</span>
            </div>
            <ul className="mt-2.5 space-y-1.5">
              {data.unknowns.map((u, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px] text-slate-700 leading-relaxed">
                  <span className="text-amber-400 mt-0.5 text-[10px]">?</span>{u}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <p className="text-[11px] text-slate-400 px-1">
        生成 {new Date(data.generatedAt).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
        {data.fromCache && (
          <span className={data.ageDays != null && data.ageDays >= 14 ? "text-amber-600 font-semibold" : ""}>
            {" "}（保存済み{data.ageDays != null ? ` / ${data.ageDays}日前` : ""}）
          </span>
        )}
        ・ 記述は材料からの要約であり、判断は出典を確認のうえ行ってください。
        {data.fromCache && "材料が変わっている可能性があるときは右上の更新ボタンで作り直してください。"}
      </p>
    </div>
  );
}
