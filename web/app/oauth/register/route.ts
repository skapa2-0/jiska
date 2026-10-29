import { NextResponse } from "next/server";
import { enregistrerClient } from "@/lib/oauth";

// RFC 7591 : Dynamic Client Registration. Un client (Claude Desktop,
// Claude Code, un script d'intégration) poste ici son nom et ses
// redirect_uris, reçoit un client_id en retour, et peut tout de suite
// démarrer le flow d'authorization. Pas d'authentification requise sur
// cet endpoint : c'est volontairement ouvert (clients publics PKCE
// seulement, pas de secret émis).

const SCHEMES_AUTORISES = /^(https?:|.+:[/]{0,2}(localhost|127\.0\.0\.1)|[a-z]+:)/i;

type RequeteDCR = {
  client_name?: unknown;
  redirect_uris?: unknown;
};

export async function POST(request: Request) {
  let body: RequeteDCR;
  try {
    body = (await request.json()) as RequeteDCR;
  } catch {
    return erreurInvalide("Corps JSON invalide.");
  }

  const uris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter(
        (u): u is string => typeof u === "string" && u.length > 0,
      )
    : [];
  if (uris.length === 0) {
    return erreurInvalide("Au moins une redirect_uri est requise.");
  }
  // Un redirect doit être soit https, soit un loopback (localhost /
  // 127.0.0.1), soit un scheme custom (ex. claude://), conformément
  // à l'OAuth 2.1 BCP pour clients publics. On refuse http sur un
  // host public.
  for (const u of uris) {
    if (!SCHEMES_AUTORISES.test(u)) {
      return erreurInvalide(`redirect_uri non supportée : ${u}`);
    }
    try {
      const parsed = new URL(u);
      if (
        parsed.protocol === "http:" &&
        parsed.hostname !== "localhost" &&
        parsed.hostname !== "127.0.0.1" &&
        parsed.hostname !== "[::1]"
      ) {
        return erreurInvalide(
          `redirect_uri non supportée (http en public) : ${u}`,
        );
      }
    } catch {
      // Scheme custom non-URL standard (ex. claude-ai://callback) : on
      // accepte si le pattern SCHEMES_AUTORISES était satisfait.
    }
  }

  const clientName =
    typeof body.client_name === "string" && body.client_name.trim()
      ? body.client_name.trim().slice(0, 120)
      : "Client sans nom";

  const client = await enregistrerClient(clientName, uris);
  return NextResponse.json(
    {
      client_id: client.client_id,
      client_name: client.client_name,
      redirect_uris: client.redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_id_issued_at: Math.floor(new Date(client.created_at).getTime() / 1000),
    },
    { status: 201 },
  );
}

function erreurInvalide(description: string): NextResponse {
  return NextResponse.json(
    { error: "invalid_client_metadata", error_description: description },
    { status: 400 },
  );
}
