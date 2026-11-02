import type { NextConfig } from "next";
import path from "node:path";

const OLD_HOST = "lookup-iota.vercel.app";

const nextConfig: NextConfig = {
  // Pin the workspace root; there are stray lockfiles higher up the tree.
  turbopack: {
    root: path.join(__dirname),
  },
  // Make sure the OG card's fonts ship inside the serverless function on Vercel.
  outputFileTracingIncludes: {
    "/api/card": ["./src/app/api/card/*.woff"],
    "/api/card/shower": ["./src/app/api/card/*.woff"],
  },
  async redirects() {
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (!site || site.includes(OLD_HOST)) return [];
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: OLD_HOST }],
        destination: `${site}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
