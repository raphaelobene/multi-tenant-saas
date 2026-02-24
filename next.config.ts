import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Required for better-auth server actions
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        // Wildcard for local subdomain dev — *.localhost:3000
        "*.localhost:3000",
        // Your production domain
        process.env.NEXT_PUBLIC_ROOT_DOMAIN || "yourdomain.com",
        `*.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "yourdomain.com"}`,
      ],
    },
  },

  // Allow images from tenant-uploaded sources
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.yourdomain.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },

  // Headers to support subdomain routing on Vercel
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
