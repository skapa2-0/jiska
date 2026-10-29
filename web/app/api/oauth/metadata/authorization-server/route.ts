import { NextResponse } from "next/server";
import { origineRequete } from "@/lib/http";

// RFC 8414 : Authorization Server Metadata. Un client (Claude.ai,
// Claude Desktop...) commence par lire ce document pour savoir où
// faire son authorize et son token, et quels grant types / méthodes
// d'auth sont supportés. Doit être servi à /.well-known/
// oauth-authorization-server (le rewrite dans next.config.ts s'en
// charge).
export async function GET(request: Request) {
  const base = origineRequete(request);
  return NextResponse.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    scopes_supported: ["jiska:all"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    service_documentation: `${base}/app/profil/api`,
  });
}
