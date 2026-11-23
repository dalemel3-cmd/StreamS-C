import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
