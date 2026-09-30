// ─── /apps — プロダクト選択 ───────────────────────────────────────────────────
//
// ログイン後の着地点。CXM と Ptengine AI パイプラインは入口（認証）だけを共有し、
// データは今のところ独立している。どちらからでも相互に行き来できる。

import Link from "next/link";
import { BarChart3, Target, ArrowRight } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const APPS = [
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
            return (
              <Link
                key={app.href}
                href={app.href}
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition
                           hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span
                  className={`mb-3.5 grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br ${app.accent} text-white`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-[15px] font-bold">{app.title}</h2>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-600" />
                </div>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">{app.tagline}</p>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-slate-600">{app.body}</p>
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
