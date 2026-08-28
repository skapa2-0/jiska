import { NextResponse } from "next/server";
import { canManageSujets, getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

// Marquage manuel de la déployabilité d'un produit. Séparé du PATCH du
// produit, réservé aux dirigeants : c'est un état de pilotage courant, pas
// une modification de la fiche. Mêmes droits que les sujets, donc le
// responsable du produit peut le poser sans passer par un dirigeant.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  let body: { deployable?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (typeof body.deployable !== "boolean") {
    return NextResponse.json(
      { error: "La valeur attendue est vrai ou faux." },
      { status: 400 },
    );
  }

  if (!(await canManageSujets(me, id))) {
    return NextResponse.json(
      { error: "Seuls les dirigeants et le responsable du produit peuvent le marquer." },
      { status: 403 },
    );
  }

  const rows = await query<{ deployable: boolean }>(
    "UPDATE projects SET deployable = $1 WHERE id = $2 RETURNING deployable",
    [body.deployable, id],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, deployable: rows[0].deployable });
}
