import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root; there are stray lockfiles higher up the tree.
  turbopack: {
    root: path.join(__dirname),
  },
  // Make sure the OG card's fonts ship inside the serverless function on Vercel.
  outputFileTracingIncludes: {
    "/api/card": ["./src/app/api/card/*.woff"],
  },
};

export default nextConfig;
