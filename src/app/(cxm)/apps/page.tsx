// ─── /apps — プロダクト選択 ───────────────────────────────────────────────────
//
// ログイン後の着地点。CXM と Ptengine AI パイプラインは入口（認証）だけを共有し、
// データは今のところ独立している。どちらからでも相互に行き来できる。
//
// Ptengine AI パイプラインは移植直後で整備中。開けるが業務では使わない状態なので、
// カードに「整備中・使用不可」を明示する（status: 'wip'）。
// 使えるようになったら status を外すだけでよい。

import Link from "next/link";
import { BarChart3, Target, ArrowRight, Wrench } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

interface AppCard {
  href: string;
  title: string;
  tagline: string;
  body: string;
  icon: React.ElementType;
  accent: string;
  /** 'wip' = 整備中。業務では使わない */
  status?: "wip";
  /** 整備中のときに出す補足 */
  note?: string;
}

const APPS: AppCard[] = [
  {
    href: "/v2",
    title: "CXM",
    tagline: "顧客前進 OS",
    body: "既存顧客の健全性・提案準備・解約レーダー。CSM の日々の動線。",
    icon: BarChart3,
    accent: "from-blue-500 to-blue-600",
  },
  {
    href: "/ptai-pipeline",
    title: "Ptengine AI パイプライン",
    tagline: "PGA 拡販ボード",
    body: "Ptengine AI 追加販売の商談パイプラインとアカウントサクセス計画。",
    icon: Target,
    accent: "from-orange-500 to-orange-600",
    status: "wip",
    note: "移植したばかりで整備中です。データは 2026-09-28 時点の固定スナップショットで、Twenty CRM とは未接続です。入力しても業務データには反映されません。",
  },
];

export default async function AppsPage() {
  const profile = await getCurrentUserProfile();

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-[#0f172a] grid place-items-center px-5 py-12">
      <div className="w-full max-w-3xl">
        <header className="mb-7">
          <p className="text-[12px] text-slate-500">
            {profile ? `${profile.name || profile.name2} さん` : "ようこそ"}
          </p>
          <h1 className="text-[22px] font-bold tracking-tight">どちらを開きますか</h1>
        </header>

        <div className="grid gap-3.5 sm:grid-cols-2">
          {APPS.map((app) => {
            const Icon = app.icon;
            const wip = app.status === "wip";
            return (
              <Link
                key={app.href}
                href={app.href}
                className={`group rounded-xl border p-5 shadow-sm transition
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                            ${wip
                              ? "border-dashed border-amber-300 bg-amber-50/40 hover:border-amber-400 hover:bg-amber-50"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"}`}
              >
                <div className="mb-3.5 flex items-start justify-between gap-2">
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br ${app.accent} text-white
                                ${wip ? "opacity-55 grayscale-[.35]" : ""}`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  {wip && (
                    <span className="inline-flex flex-none items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-800">
                      <Wrench className="h-3 w-3" />
                      整備中・使用不可
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <h2 className={`text-[15px] font-bold ${wip ? "text-slate-600" : ""}`}>{app.title}</h2>
                  <ArrowRight
                    className={`h-3.5 w-3.5 transition group-hover:translate-x-0.5
                                ${wip ? "text-slate-300 group-hover:text-slate-500" : "text-slate-400 group-hover:text-slate-600"}`}
                  />
                </div>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">{app.tagline}</p>
                <p className={`mt-2.5 text-[12.5px] leading-relaxed ${wip ? "text-slate-500" : "text-slate-600"}`}>
                  {app.body}
                </p>

                {wip && app.note && (
                  <p className="mt-3 rounded-md border border-amber-200 bg-white/70 px-2.5 py-2 text-[11.5px] leading-relaxed text-amber-900">
                    {app.note}
                  </p>
                )}
              </Link>
            );
          })}
        </div>

        <p className="mt-6 text-[11.5px] leading-relaxed text-slate-500">
          ログインは共通です。どちらのプロダクトからでも、画面上部のリンクでもう一方へ移動できます。
        </p>
      </div>
    </div>
  );
}
