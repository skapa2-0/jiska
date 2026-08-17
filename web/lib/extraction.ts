// Extraction de propositions de mise à jour depuis un compte rendu de réunion.
//
// Garantie structurelle : le schéma de sortie est construit à partir du
// catalogue réel. Le modèle choisit un identifiant dans une liste fermée, il
// ne peut donc pas viser un produit hors portée ni inventer un sujet. Sur un
// import scopé produit, l'enum ne contient que ce produit.

import Anthropic from "@anthropic-ai/sdk";
import { query } from "./db";
import { CRITICITES, ETATS, TYPES_SUJET } from "./sujets";

export type ChampsProposes = {
  etat?: string;
  criticite?: string;
  type?: string;
  action?: string;
  commentaire?: string;
  dueDate?: string | null;
  porteurId?: string | null;
};

export type Proposition = {
  ref: string;
  nature: "maj" | "creation";
  projectId: string;
  sujetId: string | null;
  titre: string;
  champs: ChampsProposes;
  avant: ChampsProposes;
  // Nom du porteur tel qu'entendu : sert à enregistrer la correspondance
  // de locuteur quand l'utilisateur corrige le porteur proposé.
  porteurNom: string | null;
  citation: string;
  horodatage: string;
  confiance: "haute" | "moyenne" | "faible";
};

export type Resultat = { propositions: Proposition[]; ecartes: string[] };

export type Membre = { id: string; nom: string };
export type ProduitCat = { id: string; name: string; description: string; membres: Membre[] };
export type SujetCat = {
  id: string;
  projectId: string;
  titre: string;
  etat: string;
  criticite: string;
  type: string;
  action: string;
  commentaire: string;
  dueDate: string | null;
  porteurId: string | null;
};
export type Catalogue = {
  produits: ProduitCat[];
  sujets: SujetCat[];
  lexique: { terme: string; cible: string }[];
  locuteurs: { nom: string; userId: string }[];
};

const nomDe = (p: { first_name: string; last_name: string; email: string }) =>
  `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email.split("@")[0];

// projectId non nul = portée produit : le catalogue est réduit à ce produit.
export async function chargerCatalogue(
  projectId: string | null,
): Promise<Catalogue> {
  const filtre = projectId ? "WHERE p.id = $1" : "";
  const args = projectId ? [projectId] : [];

  const [produits, membres, sujets, lexique, locuteurs] = await Promise.all([
    query<{ id: string; name: string; description: string }>(
      `SELECT p.id, p.name, p.description FROM projects p ${filtre} ORDER BY p.name`,
      args,
    ),
    query<{
      project_id: string;
      id: string;
      email: string;
      first_name: string;
      last_name: string;
    }>(
      `SELECT m.project_id, u.id, u.email, u.first_name, u.last_name
         FROM project_members m
         JOIN users u ON u.id = m.user_id
         JOIN projects p ON p.id = m.project_id ${filtre}`,
      args,
    ),
    query<{
      id: string;
      project_id: string;
      title: string;
      etat: string;
      criticite: string;
      type: string;
      action: string;
      commentaire: string;
      due_date: string | null;
      porteur_id: string | null;
    }>(
      `SELECT s.id, s.project_id, s.title, s.etat, s.criticite, s.type,
              s.action, s.commentaire, s.due_date::text AS due_date, s.porteur_id
         FROM sujets s JOIN projects p ON p.id = s.project_id ${filtre}
        ORDER BY s.project_id, s.id`,
      args,
    ),
    query<{ terme: string; cible: string }>(
      `SELECT l.terme,
              COALESCE(p.name, s.title, '') AS cible
         FROM lexique l
         LEFT JOIN projects p ON l.cible_type = 'projet' AND p.id = l.cible_id
         LEFT JOIN sujets   s ON l.cible_type = 'sujet'  AND s.id = l.cible_id`,
    ),
    query<{ nom: string; user_id: string }>("SELECT nom, user_id FROM locuteurs"),
  ]);

  return {
    produits: produits.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      membres: membres
        .filter((m) => m.project_id === p.id)
        .map((m) => ({ id: m.id, nom: nomDe(m) })),
    })),
    sujets: sujets.map((s) => ({
      id: s.id,
      projectId: s.project_id,
      titre: s.title,
      etat: s.etat,
      criticite: s.criticite,
      type: s.type,
      action: s.action,
      commentaire: s.commentaire,
      dueDate: s.due_date,
      porteurId: s.porteur_id,
    })),
    lexique: lexique.filter((l) => l.cible),
    locuteurs: locuteurs.map((l) => ({ nom: l.nom, userId: l.user_id })),
  };
}

// Un enum vide est un schéma invalide : on retombe sur « null seulement ».
function enumOuNull(valeurs: string[]) {
  return valeurs.length > 0
    ? { anyOf: [{ type: "string", enum: valeurs }, { type: "null" }] }
    : { type: "null" };
}
const texteOuNull = { anyOf: [{ type: "string" }, { type: "null" }] };

function construireSchema(cat: Catalogue) {
  const champ = {
    nature: { type: "string", enum: ["maj", "creation"] },
    project_id: { type: "string", enum: cat.produits.map((p) => p.id) },
    sujet_id: enumOuNull(cat.sujets.map((s) => s.id)),
    titre: { type: "string" },
    etat: enumOuNull(Object.keys(ETATS)),
    criticite: enumOuNull(Object.keys(CRITICITES)),
    type_sujet: enumOuNull(Object.keys(TYPES_SUJET)),
    action: texteOuNull,
    commentaire: texteOuNull,
    due_date: texteOuNull,
    porteur_id: enumOuNull([
      ...new Set(cat.produits.flatMap((p) => p.membres.map((m) => m.id))),
    ]),
    porteur_nom: texteOuNull,
    citation: { type: "string" },
    horodatage: { type: "string" },
    confiance: { type: "string", enum: ["haute", "moyenne", "faible"] },
  };

  return {
    type: "object",
    additionalProperties: false,
    required: ["propositions", "ecartes"],
    properties: {
      propositions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: Object.keys(champ),
          properties: champ,
        },
      },
      ecartes: { type: "array", items: { type: "string" } },
    },
  };
}

const SYSTEME = `Tu extrais des mises à jour de suivi produit depuis le compte rendu d'une réunion d'équipe, pour un outil de pilotage hebdomadaire.

Règles absolues :
- Tu ne proposes que ce qui est explicitement dit dans le document. Aucune déduction, aucune extrapolation, aucun comblement de trou.
- Chaque proposition porte une citation littérale du document et l'horodatage le plus proche. Sans citation possible, pas de proposition.
- Tu ne décides jamais du poids d'un sujet : c'est une décision de pilotage humaine, elle ne s'extrait pas d'une conversation.
- Un passage qui ne se rattache à aucun produit du catalogue part dans « ecartes », avec une phrase décrivant ce qui a été laissé de côté. Ne force jamais un rattachement approximatif.
- Tu vises un sujet existant par son identifiant. Si le sujet évoqué n'existe pas au catalogue, nature vaut "creation" et sujet_id vaut null.
- Pour une mise à jour, ne renseigne un champ que si sa valeur diffère réellement de celle du catalogue. Tous les autres champs valent null.
- Le lexique donne des correspondances entre termes entendus et vraies cibles : les transcriptions comportent des erreurs sur les noms propres et les noms de produits. Applique-le.
- Attribue un porteur uniquement si la personne est identifiable parmi les membres du produit visé. Renseigne aussi porteur_nom avec le nom tel qu'il apparaît dans le document, même si tu n'as pas su l'associer à un membre.
- Les dates relatives ("cette semaine", "lundi prochain") se résolvent depuis la date de réunion fournie, au format AAAA-MM-JJ.

Niveau de confiance : "haute" quand la citation énonce le changement sans ambiguïté, "moyenne" quand il faut interpréter, "faible" quand le rattachement au sujet est incertain.`;

function contexte(cat: Catalogue, dateReunion: string, transcript: string) {
  const produits = cat.produits.map((p) => ({
    id: p.id,
    nom: p.name,
    description: p.description,
    membres: p.membres,
  }));
  return [
    `Date de la réunion : ${dateReunion}`,
    ``,
    `# Catalogue des produits`,
    JSON.stringify(produits, null, 1),
    ``,
    `# Catalogue des sujets (état actuel)`,
    JSON.stringify(cat.sujets, null, 1),
    ``,
    `# Lexique des termes`,
    cat.lexique.length
      ? cat.lexique.map((l) => `"${l.terme}" désigne ${l.cible}`).join("\n")
      : "(vide pour l'instant)",
    ``,
    `# Locuteurs connus`,
    cat.locuteurs.length
      ? cat.locuteurs.map((l) => `"${l.nom}" = utilisateur ${l.userId}`).join("\n")
      : "(vide pour l'instant)",
    ``,
    `# Compte rendu de la réunion`,
    transcript,
  ].join("\n");
}

type Brut = {
  nature: "maj" | "creation";
  project_id: string;
  sujet_id: string | null;
  titre: string;
  etat: string | null;
  criticite: string | null;
  type_sujet: string | null;
  action: string | null;
  commentaire: string | null;
  due_date: string | null;
  porteur_id: string | null;
  porteur_nom: string | null;
  citation: string;
  horodatage: string;
  confiance: "haute" | "moyenne" | "faible";
};

export async function extraire(
  cat: Catalogue,
  dateReunion: string,
  transcript: string,
): Promise<Resultat> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY absente : ajoutez-la dans deploy/.env puis redémarrez le conteneur.",
    );
  }
  const client = new Anthropic();

  const stream = client.messages.stream({
    model: "claude-opus-5",
    max_tokens: 32000,
    system: SYSTEME,
    output_config: {
      format: { type: "json_schema", schema: construireSchema(cat) },
    },
    messages: [
      { role: "user", content: contexte(cat, dateReunion, transcript) },
    ],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("L'analyse a été refusée pour ce contenu.");
  }
  const bloc = message.content.find((b) => b.type === "text");
  if (!bloc || bloc.type !== "text") {
    throw new Error("Réponse du modèle illisible.");
  }

  const donnees = JSON.parse(bloc.text) as {
    propositions: Brut[];
    ecartes: string[];
  };
  const parId = new Map(cat.sujets.map((s) => [s.id, s]));

  const propositions = donnees.propositions.flatMap<Proposition>((b, i) => {
    const sujet = b.sujet_id ? parId.get(b.sujet_id) : undefined;
    // Un sujet ciblé doit appartenir au produit visé : le modèle a le droit
    // de se tromper, la structure a le devoir de ne pas le suivre.
    if (b.sujet_id && (!sujet || sujet.projectId !== b.project_id)) return [];

    const champs: ChampsProposes = {};
    const avant: ChampsProposes = {};
    const poser = <K extends keyof ChampsProposes>(
      cle: K,
      valeur: ChampsProposes[K],
      actuel: ChampsProposes[K],
    ) => {
      if (valeur === null || valeur === undefined) return;
      if (sujet && valeur === actuel) return;
      champs[cle] = valeur;
      avant[cle] = actuel;
    };

    poser("etat", b.etat ?? undefined, sujet?.etat);
    poser("criticite", b.criticite ?? undefined, sujet?.criticite);
    poser("action", b.action ?? undefined, sujet?.action);
    poser("commentaire", b.commentaire ?? undefined, sujet?.commentaire);
    poser("dueDate", b.due_date ?? undefined, sujet?.dueDate ?? undefined);
    poser("porteurId", b.porteur_id ?? undefined, sujet?.porteurId ?? undefined);
    if (b.nature === "creation" && b.type_sujet) champs.type = b.type_sujet;

    if (b.nature === "maj" && Object.keys(champs).length === 0) return [];

    return [
      {
        ref: `p${i}`,
        nature: sujet ? "maj" : "creation",
        projectId: b.project_id,
        sujetId: sujet?.id ?? null,
        titre: sujet?.titre ?? b.titre,
        champs,
        avant,
        porteurNom: b.porteur_nom ?? null,
        citation: b.citation,
        horodatage: b.horodatage,
        confiance: b.confiance,
      },
    ];
  });

  return { propositions, ecartes: donnees.ecartes ?? [] };
}
