import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

const STATUTS = ["ouvert", "en_cours", "resolu", "ferme"] as const;

// Suivi d'un ticket : changer son statut. Réservé aux développeurs, la
// personne qui a ouvert le ticket ne peut pas se le clore elle-même
// (elle peut en revanche l'abandonner en le supprimant depuis /tickets,
// route non implémentée pour l'instant : les tickets restent en base).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (me.role !== "developeur") {
    return NextResponse.json(
      { error: "Réservé à l'équipe technique." },
      { status: 403 },
    );
  }

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  let body: { statut?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (
    typeof body.statut !== "string" ||
    !(STATUTS as readonly string[]).includes(body.statut)
  ) {
    return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  }

  const rows = await query<{ id: string }>(
    `UPDATE tickets SET statut = $1, updated_at = now()
      WHERE id = $2 RETURNING id`,
    [body.statut, id],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Ticket introuvable." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
