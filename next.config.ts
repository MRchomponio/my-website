import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  dir: './src', // این خط رو نگه دارید
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co", // این رو به حالت اول برگردونید
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co", // این رو هم به حالت اول برگردونید
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
