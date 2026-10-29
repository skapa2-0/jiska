import { NextResponse } from "next/server";
import {
  chargerClient,
  consommerAuthCode,
  emettrePaire,
  revoquerChaineUserClient,
  utiliserRefresh,
  verifierPkce,
} from "@/lib/oauth";

// RFC 6749 §3.2 : le token endpoint accepte application/x-www-form-urlencoded.
// Grants supportés : authorization_code (avec PKCE S256), refresh_token.
// Aucun client_secret : seuls les clients publics PKCE sont supportés.

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    // Certains clients envoient en JSON ; on tolère pour être permissif.
    try {
      const brut = (await request.json()) as Record<string, string>;
      form = new FormData();
      for (const [k, v] of Object.entries(brut)) {
        if (typeof v === "string") form.set(k, v);
      }
    } catch {
      return erreur("invalid_request", "Corps attendu en form-urlencoded.");
    }
  }

  const grant = String(form.get("grant_type") ?? "");
  const client_id = String(form.get("client_id") ?? "");
  if (!client_id) return erreur("invalid_client", "client_id manquant.");

  const client = await chargerClient(client_id);
  if (!client) return erreur("invalid_client", "Client inconnu.");

  if (grant === "authorization_code") {
    return traiterAuthorizationCode(form, client_id);
  }
  if (grant === "refresh_token") {
    return traiterRefresh(form, client_id);
  }
  return erreur("unsupported_grant_type", `Grant inconnu : ${grant}`);
}

async function traiterAuthorizationCode(form: FormData, client_id: string) {
  const code = String(form.get("code") ?? "");
  const redirect_uri = String(form.get("redirect_uri") ?? "");
  const code_verifier = String(form.get("code_verifier") ?? "");
  if (!code || !redirect_uri || !code_verifier) {
    return erreur("invalid_request", "code, redirect_uri et code_verifier requis.");
  }

  const row = await consommerAuthCode(code);
  if (!row) return erreur("invalid_grant", "Code inconnu ou expiré.");
  // Replay sur un code déjà consommé : révoque toute la chaîne du
  // client/user et refuse.
  if ("replay" in row) {
    await revoquerChaineUserClient(row.client_id, row.user_id);
    return erreur("invalid_grant", "Code déjà utilisé.");
  }
  if (row.client_id !== client_id) {
    return erreur("invalid_grant", "Code émis pour un autre client.");
  }
  if (row.redirect_uri !== redirect_uri) {
    return erreur("invalid_grant", "redirect_uri ne correspond pas.");
  }
  if (!verifierPkce(code_verifier, row.code_challenge, row.code_challenge_method)) {
    return erreur("invalid_grant", "PKCE invalide.");
  }

  const paire = await emettrePaire(client_id, row.user_id, row.scope);
  return reponsePaire(paire, row.scope);
}

async function traiterRefresh(form: FormData, client_id: string) {
  const refresh_token = String(form.get("refresh_token") ?? "");
  if (!refresh_token) return erreur("invalid_request", "refresh_token requis.");

  const res = await utiliserRefresh(refresh_token, client_id);
  if ("erreur" in res) return erreur(res.erreur, "Refresh invalide ou expiré.");
  // Le scope reste celui de l'ancien refresh : utiliserRefresh le
  // conserve dans la nouvelle paire.
  return reponsePaire(res, "jiska:all");
}

function reponsePaire(
  paire: { access_token: string; refresh_token: string; expires_in: number },
  scope: string,
) {
  return NextResponse.json(
    {
      access_token: paire.access_token,
      refresh_token: paire.refresh_token,
      token_type: "Bearer",
      expires_in: paire.expires_in,
      scope,
    },
    {
      // RFC 6749 §5.1 : interdire le cache de ces réponses.
      headers: {
        "cache-control": "no-store",
        pragma: "no-cache",
      },
    },
  );
}

function erreur(code: string, description: string) {
  return NextResponse.json(
    { error: code, error_description: description },
    { status: code === "invalid_client" ? 401 : 400 },
  );
}
