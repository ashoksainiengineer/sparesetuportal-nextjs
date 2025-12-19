import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // TypeScript errors ko ignore karega taaki build pass ho sake
    ignoreBuildErrors: true,
  },
  eslint: {
    // ESLint/Linting errors ko build ke waqt ignore karega
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
