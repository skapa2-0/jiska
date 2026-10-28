import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { revoquerToken } from "@/lib/api-tokens";

// Révocation d'un jeton : on garde la ligne (pour qu'elle reste visible
// dans l'historique de la liste), on pose seulement revoked_at. Un jeton
// révoqué n'authentifie plus personne (voir utilisateurPourToken, filtre
// WHERE revoked_at IS NULL).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  const ok = await revoquerToken(me.id, id);
  if (!ok) {
    return NextResponse.json(
      { error: "Jeton introuvable ou déjà révoqué." },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
