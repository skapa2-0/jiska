// Catalogue des tools exposés par le serveur MCP de Jiska. Un tool =
// un verbe que l'IA peut appeler, avec un schéma de ses arguments et un
// handler qui fait un simple relai HTTP vers l'API Jiska. Garder cette
// couche en « pur proxy » maintient l'API publique comme source unique
// de vérité : si une permission ou une validation change dans une route
// `/api/...`, elle s'applique automatiquement via le MCP.

import type { Role } from "./roles";

export type ToolContext = {
  // Jeton personnel de l'utilisateur appelant, propagé tel quel aux
  // routes de l'API : l'auth, les droits et les audits restent côté API.
  bearer: string;
  // Base URL de l'app (ex. https://jiska.skapa.design), utilisée pour
  // les fetches internes vers /api/...
  origin: string;
};

type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type Tool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  acces: "connecte" | "admin" | "developeur";
  handler: (
    args: Record<string, unknown>,
    ctx: ToolContext,
  ) => Promise<string>;
};

async function appeler(
  ctx: ToolContext,
  method: string,
  chemin: string,
  corps?: unknown,
): Promise<unknown> {
  const res = await fetch(`${ctx.origin}${chemin}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.bearer}`,
    },
    body: corps !== undefined ? JSON.stringify(corps) : undefined,
    cache: "no-store",
  });
  const texte = await res.text();
  let donnees: unknown = null;
  if (texte) {
    try {
      donnees = JSON.parse(texte);
    } catch {
      donnees = texte;
    }
  }
  if (!res.ok) {
    const msg =
      (donnees as { error?: string } | null)?.error ??
      (typeof donnees === "string" ? donnees : `HTTP ${res.status}`);
    const err = new Error(msg);
    (err as { status?: number }).status = res.status;
    throw err;
  }
  return donnees;
}

function joli(v: unknown): string {
  return typeof v === "string" ? v : JSON.stringify(v, null, 2);
}

function queryString(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

function exigerId(args: Record<string, unknown>, cle: string): string {
  const v = args[cle];
  if (typeof v !== "string" && typeof v !== "number") {
    throw new Error(`Argument « ${cle} » requis.`);
  }
  const s = String(v);
  if (!/^\d+$/.test(s)) {
    throw new Error(`Argument « ${cle} » doit être un identifiant numérique.`);
  }
  return s;
}

// Schémas réutilisés.
const ETATS_SUJET = [
  "a_faire",
  "en_cours",
  "bloque",
  "en_validation",
  "termine",
] as const;
const CRITICITES_SUJET = ["critique", "haute", "normale", "faible"] as const;
const TYPES_SUJET = ["technique", "business"] as const;
const PRIORITES_TICKET = ["basse", "normale", "haute"] as const;
const STATUTS_TICKET = ["ouvert", "en_cours", "resolu", "ferme"] as const;

export const TOOLS: Tool[] = [
  // ----- Profil courant -----
  {
    name: "profil_courant",
    description:
      "Renvoie le profil (identifiant, nom, e-mail, rôle) de l'utilisateur dont le jeton est utilisé. À appeler en premier pour savoir à qui l'on parle.",
    acces: "connecte",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async (_, ctx) => joli(await appeler(ctx, "GET", "/api/me")),
  },

  // ----- Équipe -----
  {
    name: "equipe_lister",
    description:
      "Liste tous les comptes de l'organisation (prénom, nom, e-mail, rôle, actif). Utile pour retrouver l'identifiant d'un porteur ou d'un membre de produit.",
    acces: "connecte",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async (_, ctx) => joli(await appeler(ctx, "GET", "/api/users")),
  },
  {
    name: "utilisateur_creer",
    description:
      "Crée un compte local et envoie une invitation Clerk à l'adresse donnée. Réservé aux dirigeants.",
    acces: "admin",
    inputSchema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Adresse e-mail du nouveau compte." },
        role: {
          type: "string",
          enum: ["dirigeant", "collaborateur"],
          description: "Rôle à attribuer (défaut : collaborateur).",
        },
      },
      required: ["email"],
      additionalProperties: false,
    },
    handler: async (args, ctx) =>
      joli(
        await appeler(ctx, "POST", "/api/users", {
          email: args.email,
          role: args.role ?? "collaborateur",
        }),
      ),
  },
  {
    name: "utilisateur_supprimer",
    description:
      "Supprime un compte (local + Clerk + invitations). Réservé aux dirigeants ; impossible de supprimer son propre compte.",
    acces: "admin",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Identifiant du compte à supprimer." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, ctx) =>
      joli(await appeler(ctx, "DELETE", `/api/users/${exigerId(args, "id")}`)),
  },
  {
    name: "utilisateur_inviter",
    description:
      "Relance l'invitation Clerk d'un compte (utile si la précédente a expiré).",
    acces: "admin",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Identifiant du compte à inviter." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, ctx) =>
      joli(
        await appeler(ctx, "POST", `/api/users/${exigerId(args, "id")}/inviter`),
      ),
  },

  // ----- Produits -----
  {
    name: "produits_lister",
    description:
      "Liste les produits accessibles à l'utilisateur avec leurs membres (dirigeant : tous ; collaborateur : ses produits).",
    acces: "connecte",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async (_, ctx) => joli(await appeler(ctx, "GET", "/api/projects")),
  },
  {
    name: "produit_detail",
    description:
      "Récupère la fiche d'un produit avec ses membres, son logo, son état déployable et son résumé IA.",
    acces: "connecte",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Identifiant du produit." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, ctx) =>
      joli(await appeler(ctx, "GET", `/api/projects/${exigerId(args, "id")}`)),
  },
  {
    name: "produit_creer",
    description:
      "Crée un produit avec ses membres et un responsable désigné parmi eux. Toute personne connectée peut créer un produit.",
    acces: "connecte",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom du produit." },
        description: { type: "string", description: "Courte description." },
        memberIds: {
          type: "array",
          items: { type: "string" },
          description: "Identifiants des membres (au moins un).",
        },
        responsableId: {
          type: "string",
          description: "Identifiant du responsable (doit figurer dans memberIds).",
        },
      },
      required: ["name", "memberIds", "responsableId"],
      additionalProperties: false,
    },
    handler: async (args, ctx) =>
      joli(await appeler(ctx, "POST", "/api/projects", args)),
  },
  {
    name: "produit_modifier",
    description:
      "Met à jour un produit (nom, description, membres, responsable). Réservé aux membres du produit.",
    acces: "connecte",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        memberIds: { type: "array", items: { type: "string" } },
        responsableId: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, ctx) => {
      const id = exigerId(args, "id");
      const { id: _ignore, ...body } = args;
      return joli(await appeler(ctx, "PATCH", `/api/projects/${id}`, body));
    },
  },
  {
    name: "produit_supprimer",
    description:
      "Supprime un produit et tout ce qu'il porte (sujets, membres, historique). Destructif, réservé aux dirigeants.",
    acces: "admin",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Identifiant du produit." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, ctx) =>
      joli(await appeler(ctx, "DELETE", `/api/projects/${exigerId(args, "id")}`)),
  },
  {
    name: "produit_marquer_deployable",
    description:
      "Marque un produit comme déployable ou non. Réservé aux membres du produit.",
    acces: "connecte",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        deployable: { type: "boolean" },
      },
      required: ["id", "deployable"],
      additionalProperties: false,
    },
    handler: async (args, ctx) =>
      joli(
        await appeler(ctx, "PATCH", `/api/projects/${exigerId(args, "id")}/deployable`, {
          deployable: args.deployable,
        }),
      ),
  },

  // ----- Sujets -----
  {
    name: "sujets_lister",
    description:
      "Liste les sujets visibles par l'utilisateur. Filtres optionnels : produit, état, type, criticité, porteur, dates, recherche texte.",
    acces: "connecte",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Limiter à un produit." },
        transverse: {
          type: "boolean",
          description: "Si vrai, ne renvoie que les sujets transverses (sans produit).",
        },
        etat: { type: "string", enum: [...ETATS_SUJET] },
        type: { type: "string", enum: [...TYPES_SUJET] },
        criticite: { type: "string", enum: [...CRITICITES_SUJET] },
        porteurId: { type: "string" },
        dueBefore: { type: "string", description: "AAAA-MM-JJ." },
        dueAfter: { type: "string", description: "AAAA-MM-JJ." },
        search: {
          type: "string",
          description: "Recherche partielle dans titre ou action.",
        },
      },
      additionalProperties: false,
    },
    handler: async (args, ctx) => {
      const qs = queryString({
        ...args,
        transverse: args.transverse ? "1" : undefined,
      });
      return joli(await appeler(ctx, "GET", `/api/sujets${qs}`));
    },
  },
  {
    name: "sujet_detail",
    description: "Récupère le détail d'un sujet par identifiant.",
    acces: "connecte",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Identifiant du sujet." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, ctx) =>
      joli(await appeler(ctx, "GET", `/api/sujets/${exigerId(args, "id")}`)),
  },
  {
    name: "sujet_creer",
    description:
      "Crée un sujet dans un produit (membre du produit) ou un sujet transverse (dirigeant, projectId à null).",
    acces: "connecte",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: ["string", "null"],
          description: "Identifiant du produit, ou null pour un sujet transverse.",
        },
        title: { type: "string" },
        action: { type: "string" },
        type: { type: "string", enum: [...TYPES_SUJET] },
        criticite: { type: "string", enum: [...CRITICITES_SUJET] },
        etat: { type: "string", enum: [...ETATS_SUJET] },
        porteurId: { type: ["string", "null"] },
        dueDate: {
          type: ["string", "null"],
          description: "AAAA-MM-JJ ou null pour effacer.",
        },
        commentaire: { type: "string" },
      },
      required: ["projectId", "title"],
      additionalProperties: false,
    },
    handler: async (args, ctx) =>
      joli(await appeler(ctx, "POST", "/api/sujets", args)),
  },
  {
    name: "sujet_modifier",
    description:
      "Modifie un sujet (champs partiels). Autorisé pour les membres du produit et le porteur du sujet.",
    acces: "connecte",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        action: { type: "string" },
        type: { type: "string", enum: [...TYPES_SUJET] },
        criticite: { type: "string", enum: [...CRITICITES_SUJET] },
        etat: { type: "string", enum: [...ETATS_SUJET] },
        porteurId: { type: ["string", "null"] },
        dueDate: { type: ["string", "null"] },
        commentaire: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, ctx) => {
      const id = exigerId(args, "id");
      const { id: _ignore, ...body } = args;
      return joli(await appeler(ctx, "PATCH", `/api/sujets/${id}`, body));
    },
  },
  {
    name: "sujet_supprimer",
    description:
      "Supprime un sujet. Les membres du produit peuvent supprimer les sujets produit ; seul un dirigeant peut supprimer un transverse.",
    acces: "connecte",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args, ctx) =>
      joli(await appeler(ctx, "DELETE", `/api/sujets/${exigerId(args, "id")}`)),
  },

  // ----- Réunions -----
  {
    name: "reunion_cloturer",
    description:
      "Clôture la réunion de la semaine : gèle les sujets portant une action comme engagements de la semaine qui commence. Réservé aux dirigeants.",
    acces: "admin",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async (_, ctx) => joli(await appeler(ctx, "POST", "/api/reunions")),
  },

  // ----- Tickets -----
  {
    name: "tickets_lister",
    description:
      "Liste les tickets. Un collaborateur voit les siens ; un développeur voit tous les tickets.",
    acces: "connecte",
    inputSchema: {
      type: "object",
      properties: {
        statut: { type: "string", enum: [...STATUTS_TICKET] },
      },
      additionalProperties: false,
    },
    handler: async (args, ctx) =>
      joli(await appeler(ctx, "GET", `/api/tickets${queryString(args)}`)),
  },
  {
    name: "ticket_ouvrir",
    description: "Ouvre un ticket support (bogue, demande, suggestion).",
    acces: "connecte",
    inputSchema: {
      type: "object",
      properties: {
        titre: { type: "string" },
        description: { type: "string" },
        priorite: { type: "string", enum: [...PRIORITES_TICKET] },
      },
      required: ["titre"],
      additionalProperties: false,
    },
    handler: async (args, ctx) =>
      joli(await appeler(ctx, "POST", "/api/tickets", args)),
  },
  {
    name: "ticket_changer_statut",
    description:
      "Déplace un ticket dans son cycle de vie. Réservé aux développeurs plateforme.",
    acces: "developeur",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        statut: { type: "string", enum: [...STATUTS_TICKET] },
      },
      required: ["id", "statut"],
      additionalProperties: false,
    },
    handler: async (args, ctx) =>
      joli(
        await appeler(ctx, "PATCH", `/api/tickets/${exigerId(args, "id")}`, {
          statut: args.statut,
        }),
      ),
  },
];

export function toolsPourRole(role: Role): Tool[] {
  return TOOLS.filter((t) => {
    if (t.acces === "connecte") return true;
    if (t.acces === "admin") return role === "dirigeant" || role === "developeur";
    if (t.acces === "developeur") return role === "developeur";
    return false;
  });
}
