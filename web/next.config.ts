import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autonome pour l'image Docker (deploy/Dockerfile).
  output: "standalone",
};

export default nextConfig;
