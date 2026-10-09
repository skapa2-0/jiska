// Reprise d'un import analysé mais pas encore appliqué.
//
// L'analyse coûte une minute et un appel au modèle : un onglet fermé ne
// doit pas la faire perdre. Les propositions vivent en base dès l'analyse,
// ces fonctions permettent de les retrouver.

import { query } from "./db";
import { chargerCatalogue, extraire } from "./extraction";
import type { Proposition, PropositionDeploiement, Resultat } from "./extraction";

export type ImportEnAttente = {
  id: string;
  dateReunion: string;
  creeLe: string;
  auteur: string;
  nbPropositions: number;
};

export type ImportRepris = {
  id: string;
  dateReunion: string;
  propositions: Proposition[];
  ecartes: string[];
  deploiements: PropositionDeploiement[];
};

// project_id NULL et une valeur ne se comparent pas avec « = » : le
// IS NOT DISTINCT FROM traite les deux portées de la même façon.
const PORTEE = "project_id IS NOT DISTINCT FROM $1";

export async function chargerImportsEnAttente(
  projectId: string | null,
): Promise<ImportEnAttente[]> {
  const rows = await query<{
    id: string;
    date_reunion: string;
    cree_le: string;
    auteur: string | null;
    nb: number;
  }>(
    `SELECT i.id,
            i.date_reunion::text AS date_reunion,
            to_char(i.created_at, 'DD/MM à HH24:MI') AS cree_le,
            COALESCE(NULLIF(trim(u.first_name || ' ' || u.last_name), ''),
                     split_part(u.email, '@', 1)) AS auteur,
            jsonb_array_length(i.propositions)
              + jsonb_array_length(i.deploiements) AS nb
       FROM reunion_imports i
       LEFT JOIN users u ON u.id = i.created_by
      WHERE i.statut = 'a_verifier' AND i.${PORTEE}
      ORDER BY i.created_at DESC`,
    [projectId],
  );
  return rows.map((r) => ({
    id: r.id,
    dateReunion: r.date_reunion,
    creeLe: r.cree_le,
    auteur: r.auteur ?? "",
    nbPropositions: Number(r.nb),
  }));
}

export async function chargerImport(
  id: string,
  projectId: string | null,
): Promise<ImportRepris | null> {
  if (!/^\d+$/.test(id)) return null;
  const rows = await query<{
    id: string;
    date_reunion: string;
    propositions: Proposition[];
    ecartes: string[];
    deploiements: PropositionDeploiement[];
  }>(
    `SELECT id, date_reunion::text AS date_reunion, propositions, ecartes,
            deploiements
       FROM reunion_imports
      WHERE id = $2 AND statut = 'a_verifier' AND ${PORTEE}`,
    [projectId, id],
  );
  const r = rows[0];
  return r
    ? {
        id: r.id,
        dateReunion: r.date_reunion,
        propositions: r.propositions ?? [],
        ecartes: r.ecartes ?? [],
        deploiements: r.deploiements ?? [],
      }
    : null;
}

// Analyse d'un transcript et insertion d'un import en attente de revue.
// Factorisé pour que la saisie par collage (/api/imports) et la
// récupération automatique Fireflies (/api/fireflies/importer) suivent
// exactement le même chemin : mêmes garanties, même format en sortie.
// L'auteur et l'autorisation sont vérifiés par la route appelante.
export async function lancerAnalyseImport(
  auteurId: string,
  projectId: string | null,
  dateReunion: string,
  transcript: string,
): Promise<{ id: string } & Resultat> {
  const catalogue = await chargerCatalogue(projectId);
  if (catalogue.produits.length === 0) {
    throw new Error("Aucun produit à analyser.");
  }
  const resultat = await extraire(catalogue, dateReunion, transcript);
  // Un import sans proposition ni annonce de déployabilité n'a rien à
  // valider : on le classe tout de suite en « abandonne » pour qu'il
  // n'encombre pas la liste des imports en attente. L'écran de résultat
  // reste utile (il montre les ecartes et explique pourquoi rien n'a
  // été relevé), mais la revue ne sera plus relancée depuis la liste.
  const vide = resultat.propositions.length === 0 && resultat.deploiements.length === 0;
  const statut = vide ? "abandonne" : "a_verifier";
  const rows = await query<{ id: string }>(
    `INSERT INTO reunion_imports
       (project_id, date_reunion, transcript, propositions, ecartes,
        deploiements, created_by, statut)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8) RETURNING id`,
    [
      projectId,
      dateReunion,
      transcript,
      JSON.stringify(resultat.propositions),
      JSON.stringify(resultat.ecartes),
      JSON.stringify(resultat.deploiements),
      auteurId,
      statut,
    ],
  );
  return { id: rows[0].id, ...resultat };
}
