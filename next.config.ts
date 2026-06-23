import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ⬅️ این خط رو اضافه کنید
  dir: './src',
  
  images: {
    remotePatterns: [
      {
        // Public bucket objects
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        // Signed URLs for private buckets (payment-receipts, etc.)
        // Shape: /storage/v1/object/sign/{bucket}/{path}?token=...
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
