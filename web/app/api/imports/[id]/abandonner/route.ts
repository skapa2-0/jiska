import { NextResponse } from "next/server";
import { canManageSujets, getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

// Abandon d'un import : le transcript et les propositions restent en base
// pour la trace, mais l'import sort de la liste des vérifications en
// attente. C'est ce qui évite les analyses orphelines.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  const rows = await query<{ project_id: string | null; statut: string }>(
    "SELECT project_id, statut FROM reunion_imports WHERE id = $1",
    [id],
  );
  const imp = rows[0];
  if (!imp) {
    return NextResponse.json({ error: "Import introuvable." }, { status: 404 });
  }
  if (imp.statut === "applique") {
    return NextResponse.json(
      { error: "Cet import a déjà été appliqué." },
      { status: 409 },
    );
  }

  if (imp.project_id === null) {
    if (me.role !== "dirigeant") {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }
  } else if (!(await canManageSujets(me, imp.project_id))) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  await query(
    "UPDATE reunion_imports SET statut = 'abandonne' WHERE id = $1",
    [id],
  );
  return NextResponse.json({ ok: true });
}
