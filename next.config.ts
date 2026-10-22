import type { NextConfig } from "next";

// Every page in Clipzy belongs to a signed-in user and reads the session
// cookie, so the app renders on request. Cache Components stays off.
const nextConfig: NextConfig = {
  // The ad knowledge base is read from disk at runtime; ship it with every route.
  outputFileTracingIncludes: {
    "/**": ["./knowledge/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      // Brand/product forms send the whole profile as JSON.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
