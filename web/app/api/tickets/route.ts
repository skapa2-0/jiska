import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

const TITRE_MAX = 120;
const DESCRIPTION_MAX = 4000;
const PRIORITES = ["basse", "normale", "haute"] as const;
const STATUTS = ["ouvert", "en_cours", "resolu", "ferme"] as const;
type Priorite = (typeof PRIORITES)[number];

// Liste des tickets. Un développeur voit tout (c'est lui qui traite),
// les autres ne voient que les tickets qu'ils ont ouverts.
export async function GET(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const url = new URL(request.url);
  const statut = url.searchParams.get("statut");

  const where: string[] = [];
  const args: (string | number)[] = [];
  if (me.role !== "developeur") {
    args.push(me.id);
    where.push(`t.auteur_id = $${args.length}`);
  }
  if (statut && (STATUTS as readonly string[]).includes(statut)) {
    args.push(statut);
    where.push(`t.statut = $${args.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await query<{
    id: string;
    titre: string;
    description: string;
    priorite: string;
    statut: string;
    created_at: string;
    updated_at: string;
    auteur_id: string | null;
    auteur_email: string | null;
    auteur_first_name: string | null;
    auteur_last_name: string | null;
  }>(
    `SELECT t.id, t.titre, t.description, t.priorite, t.statut,
            t.created_at::text AS created_at,
            t.updated_at::text AS updated_at,
            u.id AS auteur_id, u.email AS auteur_email,
            u.first_name AS auteur_first_name,
            u.last_name AS auteur_last_name
       FROM tickets t LEFT JOIN users u ON u.id = t.auteur_id
       ${whereSql}
      ORDER BY t.statut, t.priorite, t.created_at DESC`,
    args,
  );

  const tickets = rows.map((r) => ({
    id: r.id,
    titre: r.titre,
    description: r.description,
    priorite: r.priorite,
    statut: r.statut,
    created_at: r.created_at,
    updated_at: r.updated_at,
    auteur: r.auteur_id
      ? {
          id: r.auteur_id,
          email: r.auteur_email,
          first_name: r.auteur_first_name,
          last_name: r.auteur_last_name,
        }
      : null,
  }));
  return NextResponse.json({ tickets });
}

// Création d'un ticket support : ouvert à toute personne connectée. Le
// suivi et le changement de statut sont réservés aux développeurs (voir
// /api/tickets/[id]).
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  let body: { titre?: unknown; description?: unknown; priorite?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const titre = typeof body.titre === "string" ? body.titre.trim() : "";
  if (!titre) {
    return NextResponse.json(
      { error: "Un titre est requis pour ouvrir un ticket." },
      { status: 400 },
    );
  }
  if (titre.length > TITRE_MAX) {
    return NextResponse.json(
      { error: `Titre trop long (${TITRE_MAX} caractères maximum).` },
      { status: 400 },
    );
  }

  const description =
    typeof body.description === "string"
      ? body.description.trim().slice(0, DESCRIPTION_MAX)
      : "";

  const priorite: Priorite =
    typeof body.priorite === "string" &&
    (PRIORITES as readonly string[]).includes(body.priorite)
      ? (body.priorite as Priorite)
      : "normale";

  const rows = await query<{ id: string }>(
    `INSERT INTO tickets (auteur_id, titre, description, priorite)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [me.id, titre, description, priorite],
  );
  return NextResponse.json({ ok: true, id: rows[0].id }, { status: 201 });
}
