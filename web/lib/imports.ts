// Reprise d'un import analysé mais pas encore appliqué.
//
// L'analyse coûte une minute et un appel au modèle : un onglet fermé ne
// doit pas la faire perdre. Les propositions vivent en base dès l'analyse,
// ces fonctions permettent de les retrouver.

import { query } from "./db";
import type { Proposition } from "./extraction";

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
            jsonb_array_length(i.propositions) AS nb
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
  }>(
    `SELECT id, date_reunion::text AS date_reunion, propositions, ecartes
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
      }
    : null;
}
