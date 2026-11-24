import type { NextConfig } from "next";

// Same id the server reports at /api/version, baked into the page bundle at build time.
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.VERCEL_DEPLOYMENT_ID ??
  "dev";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  poweredByHeader: false,
  async headers() {
    return [
      {
        // The APK fetches this on launch; keep it fresh.
        source: "/screens.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=60" }],
      },
    ];
  },
};

export default nextConfig;
