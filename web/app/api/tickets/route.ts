import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

const TITRE_MAX = 120;
const DESCRIPTION_MAX = 4000;
const PRIORITES = ["basse", "normale", "haute"] as const;
type Priorite = (typeof PRIORITES)[number];

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
