import { NextResponse } from "next/server";
import { origineRequete } from "@/lib/http";

// RFC 9728 : Protected Resource Metadata. Déclare Jiska comme
// ressource protégée et pointe les clients vers son serveur
// d'autorisation (ici elle-même). Référencée par l'en-tête
// WWW-Authenticate renvoyé par le MCP sur un 401, afin qu'un client
// MCP découvre le flow sans configuration manuelle.
export async function GET(request: Request) {
  const base = origineRequete(request);
  return NextResponse.json({
    resource: base,
    authorization_servers: [base],
    scopes_supported: ["jiska:all"],
    bearer_methods_supported: ["header"],
    resource_documentation: `${base}/app/profil/api`,
  });
}
