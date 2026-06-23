import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true, // غیرفعال کردن ESLint
  },
  typescript: {
    ignoreBuildErrors: true, // غیرفعال کردن TypeScript
  },
};

export default nextConfig;
