"use client";

// ─── CXM v2 レイアウト ────────────────────────────────────────────────────────
//
// ナビには「実際に機能している画面」だけを置く。
// 未実装（ComingSoon）や旧 UI はルートもコンポーネントも残したまま、
// 動線からは外して下部の「アーカイブ」に畳んでおく。
// 参照: docs-src/cxm_v2/17_WHO_WHAT_Matching_Plan.md §10（動線に乗らないものは運用されない）
//
// 主動線:
//   ホーム（今日どこから手をつけるか）
//     → 提案準備ボード（誰に提案できるか）→ 個社ページ（その顧客をどう進めるか）

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Target, Layers, ChevronRight, Archive, ArrowLeftRight, Settings,
  Building2, ArrowLeft,
  BarChart3, House,
} from "lucide-react";

interface NavItem { title: string; icon: React.ElementType; href: string; note?: string; }

/** 主動線（実データで動く画面のみ） */
const NAV: NavItem[] = [
  { title: "ホーム",         icon: House,       href: "/v2" },
  { title: "提案準備ボード", icon: Target,      href: "/v2/readiness", note: "Tier 1–3" },
  { title: "プロジェクト分析", icon: BarChart3, href: "/v2/projects",  note: "30日" },
  { title: "Tier 3 管理",   icon: Layers,      href: "/v2/tier3" },
];

/**
 * アーカイブ。旧 UI と未実装画面。
 * 画面もコンポーネントも消していないので、必要になったらここから開ける。
 */
const ARCHIVE: { title: string; href: string }[] = [
  { title: "Home（旧）",        href: "/legacy" },
  { title: "Companies（旧）",   href: "/companies" },
  { title: "解約分析",          href: "/console/churn-analysis" },
  { title: "Actions",           href: "/actions" },
  { title: "Assets",            href: "/assets" },
  { title: "Documents",         href: "/documents" },
  { title: "Outbound",          href: "/outbound" },
  { title: "Support",           href: "/support" },
  { title: "AI Control",        href: "/ops/ai" },
  { title: "Summary Ops",       href: "/ops/company-summary" },
  { title: "Mutation Logs",     href: "/ops/company-mutation-logs" },
  { title: "SF Ops",            href: "/ops/salesforce" },
  { title: "SF DataPrep",       href: "/ops/sf-data-prep" },
  { title: "設定（旧）",         href: "/settings" },
];

export default function V2Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [archiveOpen, setArchiveOpen] = useState(false);

  // 個社ページは提案準備ボードの子として扱う。
  // 個社ページを開いている間は親（提案準備ボード）も active にして、現在地を見失わせない。
  const onCompanyPage = pathname.startsWith("/v2/companies/");

  const isActive = (href: string) => {
    // ホームは完全一致のみ。前方一致にすると /v2 配下の全画面で光る
    if (href === "/v2") return pathname === "/v2";
    if (href === "/v2/readiness") {
      return pathname === href || pathname.startsWith(href + "/") || onCompanyPage;
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="min-h-screen grid grid-cols-[204px_1fr] bg-[#f1f5f9] text-[#0f172a]">
      {/* ── サイドバー ─────────────────────────────────────────────────────── */}
      <aside className="bg-[#0b1220] text-slate-400 flex flex-col sticky top-0 h-screen px-2.5 py-3.5">
        {/* ブランド */}
        <div className="flex items-center gap-2 px-2 pb-4 text-white font-bold">
          <span className="w-[22px] h-[22px] rounded-md bg-gradient-to-br from-blue-500 to-blue-600 grid place-items-center text-white text-xs font-extrabold">C</span>
          <span className="leading-tight">
            CXM
            <small className="block text-slate-400 font-medium text-[10px] tracking-wide">顧客前進 OS</small>
          </span>
        </div>

        {/* 主動線 */}
        <nav className="flex flex-col gap-0.5">
          {NAV.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const isBoard = item.href === "/v2/readiness";
            return (
              <div key={item.href}>
                <Link href={item.href}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] transition
                    ${active ? "bg-[#1d283a] text-white font-semibold" : "text-slate-300 hover:bg-[#1d283a] hover:text-white"}`}>
                  <Icon className="w-[15px] h-[15px] opacity-90 flex-none" />
                  {/* タイトルは折り返させない。note が伸びるとラベルが2〜3行に割れる */}
                  <span className="flex-1 whitespace-nowrap">{item.title}</span>
                  {item.note && (
                    <span className="text-[9.5px] text-slate-500 font-medium whitespace-nowrap flex-none">
                      {item.note}
                    </span>
                  )}
                </Link>

                {/* 個社ページは提案準備ボードの子。開いている間だけ出す */}
                {isBoard && onCompanyPage && (
                  <div className="mt-0.5 ml-4 pl-3 border-l border-slate-700/70 flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11.5px] text-white font-semibold bg-[#1d283a]">
                      <Building2 className="w-3.5 h-3.5 opacity-90 flex-none" />
                      個社ページ
                    </span>
                    <Link href="/v2/readiness"
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-slate-400 hover:text-slate-200 hover:bg-[#151f30] transition">
                      <ArrowLeft className="w-3 h-3 flex-none" />
                      ボードに戻る
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── アーカイブ（下部・折りたたみ）───────────────────────────────── */}
        <div className="mt-auto pt-3">
          <button onClick={() => setArchiveOpen(v => !v)}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11.5px] text-slate-500 hover:text-slate-300 hover:bg-[#151f30] transition">
            <Archive className="w-3.5 h-3.5 flex-none" />
            <span className="flex-1 text-left">アーカイブ</span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${archiveOpen ? "rotate-90" : ""}`} />
          </button>

          {archiveOpen && (
            <div className="mt-1 max-h-[42vh] overflow-y-auto">
              <p className="text-[10px] text-slate-600 px-2.5 pb-1.5 leading-relaxed">
                旧 UI / 未整備の画面。動線からは外しているが、必要なときはここから開ける。
              </p>
              <div className="flex flex-col">
                {ARCHIVE.map(item => (
                  <Link key={item.href} href={item.href}
                    className="flex items-center gap-2 px-2.5 py-[5px] rounded text-[11.5px] text-slate-500 hover:text-slate-200 hover:bg-[#151f30] transition">
                    <ArrowLeftRight className="w-3 h-3 flex-none opacity-60" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <Link href="/v2/settings"
            className={`flex items-center gap-2 px-2.5 py-2 mt-0.5 rounded-lg text-[11.5px] transition
              ${isActive("/v2/settings")
                ? "bg-[#1d283a] text-white font-semibold"
                : "text-slate-500 hover:text-slate-300 hover:bg-[#151f30]"}`}>
            <Settings className="w-3.5 h-3.5 flex-none" />
            設定
          </Link>
        </div>
      </aside>

      {/* ── メイン ─────────────────────────────────────────────────────────── */}
      <main className="min-w-0 flex flex-col">{children}</main>
    </div>
  );
}
