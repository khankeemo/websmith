import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    root: __dirname,
  },
  
  async rewrites() {
    const rewrites = [];
    
    // Main Website API Routes → Local/Dev Backend (only if NOT on Vercel)
    if (!process.env.VERCEL) {
      rewrites.push({
        source: "/api/:path*",
        destination: `${backendUrl.replace(/\/$/, "")}/api/:path*`,
      });
    }
    
    return rewrites;
  },
};

export default nextConfig;