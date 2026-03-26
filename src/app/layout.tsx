import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
