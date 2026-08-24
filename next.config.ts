import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf（pdfjs ベース）はサーバー側でそのまま require させる。
  // バンドルすると pdfjs のワーカー解決に失敗するため外部化する。
  serverExternalPackages: ["unpdf"],

  async rewrites() {
    return [
      {
        source: "/nocodb-proxy/:path*",
        destination: `${process.env.NOCODB_BASE_URL ?? "https://odtable.ptmind.ai"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
