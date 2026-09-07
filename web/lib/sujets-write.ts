// Écriture d'un sujet : validation, permissions et historique.
// Partagé entre la saisie manuelle (app/api/sujets) et l'application d'un
// import de réunion, pour qu'un transcript n'ouvre aucun chemin d'écriture
// que la saisie à la main n'aurait pas.

import { canManageSujets } from "./auth";
import type { SessionUser } from "./auth";
import { query } from "./db";
import { CRITICITES, ETATS, TYPES_SUJET } from "./sujets";

export type SujetDb = {
  id: string;
  // NULL = sujet transverse (voir lib/db.ts).
  project_id: string | null;
  title: string;
  action: string;
  due_date: string | null;
  type: string;
  poids: number;
  porteur_id: string | null;
  criticite: string;
  etat: string;
  commentaire: string;
};

// Corps non fiable : tout arrive du réseau, rien n'est supposé typé.
export type CorpsSujet = Record<string, unknown>;

export type Echec = { error: string; status: number };
export const estEchec = (r: unknown): r is Echec =>
  typeof r === "object" && r !== null && "error" in r;

const CHAMPS_DB = [
  "title",
  "action",
  "commentaire",
  "due_date",
  "type",
  "poids",
  "criticite",
  "etat",
  "porteur_id",
] as const;

export async function chargerSujet(id: string): Promise<SujetDb | null> {
  if (!/^\d+$/.test(id)) return null;
  const rows = await query<SujetDb>(
    `SELECT id, project_id, title, action,
            due_date::text AS due_date,
            type, poids, porteur_id, criticite, etat, commentaire
       FROM sujets WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// Peut modifier : dirigeant, responsable du projet, ou porteur du sujet.
// Un sujet transverse n'a pas de responsable : dirigeant ou porteur.
export async function peutEditer(
  me: SessionUser,
  sujet: SujetDb,
): Promise<boolean> {
  if (sujet.porteur_id === me.id) return true;
  if (sujet.project_id === null) return me.role === "dirigeant";
  return canManageSujets(me, sujet.project_id);
}

// Chaque champ modifiable vers sa valeur validée ; undefined = non fourni
// ou invalide, donc ignoré plutôt que d'écrire une valeur douteuse.
function champsValides(body: CorpsSujet) {
  const texte = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);
  return {
    title: typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : undefined,
    action: texte(body.action),
    commentaire: texte(body.commentaire),
    due_date:
      body.dueDate === null
        ? null
        : /^\d{4}-\d{2}-\d{2}$/.test(String(body.dueDate ?? ""))
          ? String(body.dueDate)
          : undefined,
    type:
      typeof body.type === "string" && body.type in TYPES_SUJET
        ? body.type
        : undefined,
    poids:
      typeof body.poids === "number" && Number.isFinite(body.poids)
        ? Math.min(100, Math.max(0, Math.round(body.poids)))
        : undefined,
    criticite:
      typeof body.criticite === "string" && body.criticite in CRITICITES
        ? body.criticite
        : undefined,
    etat:
      typeof body.etat === "string" && body.etat in ETATS
        ? body.etat
        : undefined,
    porteur_id:
      body.porteurId === null
        ? null
        : /^\d+$/.test(String(body.porteurId ?? ""))
          ? String(body.porteurId)
          : undefined,
  } satisfies Record<string, string | number | null | undefined>;
}

// Le porteur doit être membre du produit : sinon un sujet pourrait être
// attribué à quelqu'un qui n'y a pas accès en lecture.
async function porteurHorsProduit(
  projectId: string,
  porteurId: string,
): Promise<boolean> {
  const rows = await query(
    "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2",
    [projectId, porteurId],
  );
  return rows.length === 0;
}

async function tracer(
  sujetId: string,
  auteur: string,
  champ: string,
  avant: string | null,
  apres: string | null,
  source: string,
): Promise<void> {
  await query(
    `INSERT INTO sujet_history (sujet_id, changed_by, field, old_value, new_value, source)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sujetId, auteur, champ, avant, apres, source],
  );
}

export async function appliquerPatch(
  me: SessionUser,
  sujet: SujetDb,
  body: CorpsSujet,
  source = "manuel",
): Promise<Echec | { ok: true }> {
  const patch = champsValides(body);

  // Sujet transverse : aucun produit, donc aucune appartenance à vérifier.
  // Le porteur peut être n'importe quel compte.
  if (typeof patch.porteur_id === "string" && sujet.project_id !== null) {
    if (await porteurHorsProduit(sujet.project_id, patch.porteur_id)) {
      return { error: "Le porteur doit être membre du produit.", status: 400 };
    }
  }

  const changes = CHAMPS_DB.map((f) => [f, patch[f]] as const).filter(
    ([field, value]) =>
      value !== undefined &&
      String(value ?? "") !== String(sujet[field as keyof SujetDb] ?? ""),
  );
  if (changes.length === 0) return { ok: true };

  const sets = changes.map(([field], i) => `${field} = $${i + 2}`).join(", ");
  await query(`UPDATE sujets SET ${sets}, updated_at = now() WHERE id = $1`, [
    sujet.id,
    ...changes.map(([, value]) => value),
  ]);

  for (const [field, value] of changes) {
    await tracer(
      sujet.id,
      me.id,
      field,
      String(sujet[field as keyof SujetDb] ?? ""),
      String(value ?? ""),
      source,
    );
  }
  return { ok: true };
}

// projectId null = sujet transverse : réservé aux dirigeants, personne
// d'autre n'a de titre à créer une tâche hors produit.
export async function creerSujet(
  me: SessionUser,
  projectId: string | null,
  body: CorpsSujet,
  source = "manuel",
): Promise<Echec | { ok: true; id: string }> {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return { error: "L'intitulé du sujet est requis.", status: 400 };
  }
  if (projectId !== null && !/^\d+$/.test(projectId)) {
    return { error: "Produit invalide.", status: 400 };
  }
  if (projectId === null) {
    if (me.role !== "dirigeant") {
      return {
        error: "Seuls les dirigeants peuvent créer un sujet transverse.",
        status: 403,
      };
    }
  } else if (!(await canManageSujets(me, projectId))) {
    return {
      error:
        "Seuls les dirigeants et le responsable du produit peuvent créer un sujet.",
      status: 403,
    };
  }

  const patch = champsValides(body);
  if (
    typeof patch.porteur_id === "string" &&
    projectId !== null &&
    (await porteurHorsProduit(projectId, patch.porteur_id))
  ) {
    return { error: "Le porteur doit être membre du produit.", status: 400 };
  }

  const rows = await query<{ id: string }>(
    `INSERT INTO sujets (project_id, title, action, due_date,
                         type, poids, porteur_id, criticite, etat, commentaire)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      projectId,
      title,
      patch.action ?? "",
      patch.due_date ?? null,
      patch.type ?? "technique",
      // Le poids est une décision de pilotage : il n'est jamais deviné.
      // Un sujet créé depuis une réunion arrive à 0 et reste à signaler.
      patch.poids ?? 0,
      patch.porteur_id ?? null,
      patch.criticite ?? "normale",
      patch.etat ?? "a_faire",
      patch.commentaire ?? "",
    ],
  );

  await tracer(rows[0].id, me.id, "creation", null, title, source);
  return { ok: true, id: rows[0].id };
}
