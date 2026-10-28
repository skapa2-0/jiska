import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import { toolsPourRole } from "@/lib/mcp-tools";
import type { ToolContext } from "@/lib/mcp-tools";

// Serveur MCP (Model Context Protocol) de Jiska. Transport Streamable
// HTTP (spec 2025-03) en mode stateless : une requête POST = une réponse
// JSON-RPC. Pas de session, pas de SSE : les tools sont des CRUD rapides,
// aucune valeur ajoutée à ouvrir un flux. Toute la logique métier reste
// dans les routes /api/... ; le MCP n'est qu'un pur proxy qui expose ces
// endpoints à une IA.

const PROTO_VERSION = "2025-03-26";
const INFO_SERVEUR = { name: "jiska", version: "1.0.0" };

// Codes JSON-RPC 2.0.
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

type Id = number | string | null;
type RpcRequete = {
  jsonrpc?: string;
  id?: Id;
  method?: string;
  params?: unknown;
};
type RpcReponse = {
  jsonrpc: "2.0";
  id: Id;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export async function POST(request: Request) {
  const entetes = await headers();
  const brutAuth =
    entetes.get("authorization") ?? entetes.get("Authorization") ?? "";
  const match = brutAuth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return reponse401("Authentification requise. Posez l'en-tête Authorization: Bearer <jeton>.");
  }
  const bearer = match[1].trim();

  // getSessionUser lit le même Bearer via headers() et le résout.
  const me = await getSessionUser();
  if (!me) return reponse401("Jeton invalide ou révoqué.");

  let corps: RpcRequete | RpcRequete[];
  try {
    corps = (await request.json()) as RpcRequete | RpcRequete[];
  } catch {
    return NextResponse.json(
      erreur(null, PARSE_ERROR, "Corps JSON invalide."),
      { status: 400 },
    );
  }

  const batch = Array.isArray(corps);
  const requetes: RpcRequete[] = batch ? (corps as RpcRequete[]) : [corps as RpcRequete];
  // Appels internes vers nos propres routes /api/... Passer par le
  // domaine public ferait traverser Caddy et TLS pour rien, et peut
  // échouer en isolation réseau Docker. On parle à notre propre
  // process via localhost : le port Next est fourni par l'env PORT.
  const origin = `http://127.0.0.1:${process.env.PORT ?? "80"}`;
  const ctx: ToolContext = { bearer, origin };

  const reponses: RpcReponse[] = [];
  for (const r of requetes) {
    const rep = await traiter(r, me, ctx);
    if (rep !== null) reponses.push(rep);
  }

  // Notifications uniquement : rien à renvoyer (202 Accepted).
  if (reponses.length === 0) return new Response(null, { status: 202 });

  return NextResponse.json(batch ? reponses : reponses[0]);
}

// Streamable HTTP permet aussi GET (ouvrir un flux SSE) et DELETE
// (fermer une session). Mode stateless : on refuse les deux proprement.
export function GET() {
  return new Response("Flux SSE non supporté : utilisez POST en JSON-RPC.", {
    status: 405,
    headers: { allow: "POST" },
  });
}
export function DELETE() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}

function reponse401(message: string): NextResponse {
  return NextResponse.json(erreur(null, -32001, message), {
    status: 401,
    headers: { "www-authenticate": 'Bearer realm="jiska"' },
  });
}

function erreur(id: Id, code: number, message: string): RpcReponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function traiter(
  r: RpcRequete,
  me: SessionUser,
  ctx: ToolContext,
): Promise<RpcReponse | null> {
  // Notification (JSON-RPC 2.0) : pas d'id => pas de réponse attendue.
  const estNotification = r.id === undefined || r.id === null;
  const id: Id = estNotification ? null : (r.id as Id);

  if (r.jsonrpc !== "2.0" || typeof r.method !== "string") {
    return estNotification ? null : erreur(id, INVALID_REQUEST, "Requête JSON-RPC invalide.");
  }

  const { method, params } = r;

  // Notifications gérées silencieusement (notifications/initialized, etc.)
  if (estNotification) return null;

  try {
    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: PROTO_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: INFO_SERVEUR,
            instructions:
              "Pilotage hebdomadaire de produits (Jiska). Utilisez `profil_courant` pour connaître l'utilisateur, `produits_lister` et `sujets_lister` pour inventorier, puis les tools de création / modification. Les écritures sont imputables au porteur du jeton.",
          },
        };

      case "ping":
        return { jsonrpc: "2.0", id, result: {} };

      case "tools/list": {
        const tools = toolsPourRole(me.role).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        }));
        return { jsonrpc: "2.0", id, result: { tools } };
      }

      case "tools/call": {
        const p = params as
          | { name?: string; arguments?: Record<string, unknown> }
          | undefined;
        if (!p || typeof p.name !== "string") {
          return erreur(id, INVALID_PARAMS, "Nom de tool manquant.");
        }
        const tool = toolsPourRole(me.role).find((t) => t.name === p.name);
        if (!tool) {
          return erreur(
            id,
            METHOD_NOT_FOUND,
            `Tool inconnu ou non autorisé pour ce rôle : ${p.name}`,
          );
        }
        try {
          const texte = await tool.handler(p.arguments ?? {}, ctx);
          return {
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: texte }] },
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // Erreur « métier » : on renvoie un résultat avec isError plutôt
          // qu'une erreur JSON-RPC : l'IA peut lire le message et adapter
          // son prochain appel (ex. ajuster un payload refusé en 400).
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: msg }],
              isError: true,
            },
          };
        }
      }

      default:
        return erreur(id, METHOD_NOT_FOUND, `Méthode inconnue : ${method}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return erreur(id, INTERNAL_ERROR, msg);
  }
}
