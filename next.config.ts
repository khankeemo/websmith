import type { NextConfig } from "next";

/** Express API (wsd-server). Used by rewrites so the browser hits same-origin `/api/*`. */
const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5000";

const nextConfig: NextConfig = {
  async rewrites() {
    // On Vercel, call the real API via NEXT_PUBLIC_API_URL from the client — do not proxy.
    if (process.env.VERCEL) {
      return [];
    }
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
