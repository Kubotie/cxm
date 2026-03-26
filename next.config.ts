import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
