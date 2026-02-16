import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingRoot: process.cwd(),
  async redirects() {
    return [
      {
        source: "/index.html",
        destination: "/",
        permanent: false
      }
    ];
  }
};

export default nextConfig;
