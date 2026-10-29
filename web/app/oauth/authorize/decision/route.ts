import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  chargerClient,
  creerAuthCode,
  SCOPE_PAR_DEFAUT,
} from "@/lib/oauth";

// Handler POST du formulaire de consentement. On revalide tout (le
// client peut bricoler les champs cachés), on crée un code d'auth si
// l'utilisateur a accepté, puis on redirige vers sa redirect_uri avec
// soit `?code=` soit `?error=access_denied`. On passe toujours le
// `state` tel quel (anti-CSRF du client).

export async function POST(request: Request) {
  const form = await request.formData();
  const decision = String(form.get("decision") ?? "");
  const client_id = String(form.get("client_id") ?? "");
  const redirect_uri = String(form.get("redirect_uri") ?? "");
  const code_challenge = String(form.get("code_challenge") ?? "");
  const code_challenge_method = String(form.get("code_challenge_method") ?? "");
  const scope = String(form.get("scope") ?? SCOPE_PAR_DEFAUT);
  const state = String(form.get("state") ?? "");

  if (!client_id || !redirect_uri) {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 400 },
    );
  }

  const client = await chargerClient(client_id);
  if (!client) {
    return NextResponse.json({ error: "invalid_client" }, { status: 400 });
  }
  if (!client.redirect_uris.includes(redirect_uri)) {
    return NextResponse.json(
      { error: "invalid_redirect_uri" },
      { status: 400 },
    );
  }

  const me = await getSessionUser();
  if (!me) {
    // Session Clerk perdue entre temps : on redirige vers login.
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  if (decision === "refuser") {
    return redirectVers(redirect_uri, { error: "access_denied", state });
  }
  if (decision !== "accepter") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!code_challenge || code_challenge_method !== "S256") {
    return redirectVers(redirect_uri, { error: "invalid_request", state });
  }

  const code = await creerAuthCode(
    client_id,
    me.id,
    redirect_uri,
    code_challenge,
    code_challenge_method,
    scope,
  );
  return redirectVers(redirect_uri, { code, state });
}

function redirectVers(
  base: string,
  params: Record<string, string>,
): NextResponse {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  // 303 : convertit le POST en GET sur la cible, conforme à OAuth 2.1.
  return NextResponse.redirect(url.toString(), 303);
}
