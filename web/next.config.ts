import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autonome pour l'image Docker (deploy/Dockerfile).
  output: "standalone",
  // Routes OAuth « bien connues » (RFC 8414 et 9728). Next.js exclut
  // les dossiers commençant par « . » du routing, donc on les expose
  // via rewrite depuis des routes classiques.
  async rewrites() {
    return [
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/oauth/metadata/authorization-server",
      },
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/oauth/metadata/protected-resource",
      },
    ];
  },
};

export default nextConfig;
