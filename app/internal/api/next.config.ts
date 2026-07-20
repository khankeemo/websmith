// ============================================
// API CENTER NEXT.JS CONFIGURATION
// ============================================
// PURPOSE: Isolated config for API Center
// LOCATION: /internal/api/ - only affects API Center routes
// ============================================

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API Center specific headers only
  // NO rewrites - pages serve locally from /internal/api/* page.tsx files
  async headers() {
    return [
      {
        source: "/internal/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;