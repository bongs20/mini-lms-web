import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    const gatewayUrl = process.env.API_GATEWAY_URL || "http://localhost:8101";
    return [
      {
        source: "/api/:path*",
        destination: `${gatewayUrl}/api/:path*`,
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
