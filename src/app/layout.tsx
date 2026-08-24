import type { Metadata } from "next";
import "./globals.css";
import { AiAssistantShell } from "@/components/ai";

export const metadata: Metadata = {
  title: "CXM Platform",
  description: "Customer Experience Management Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        {/* 全ページ共通の AI サイドパネル。各画面は useRegisterAiPageContext で
            自分が表示しているデータを申告する（未申告でもパネル自体は動く） */}
        <AiAssistantShell>{children}</AiAssistantShell>
      </body>
    </html>
  );
}
