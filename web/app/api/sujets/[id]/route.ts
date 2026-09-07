import { NextResponse } from "next/server";
import { canManageSujets, getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  appliquerPatch,
  chargerSujet,
  estEchec,
  peutEditer,
} from "@/lib/sujets-write";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { id } = await params;
  const sujet = await chargerSujet(id);
  if (!sujet) {
    return NextResponse.json({ error: "Sujet introuvable." }, { status: 404 });
  }
  if (!(await peutEditer(me, sujet))) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const res = await appliquerPatch(me, sujet, body);
  if (estEchec(res)) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { id } = await params;
  const sujet = await chargerSujet(id);
  if (!sujet) {
    return NextResponse.json({ error: "Sujet introuvable." }, { status: 404 });
  }
  const peutSupprimer =
    sujet.project_id === null
      ? me.role === "dirigeant"
      : await canManageSujets(me, sujet.project_id);
  if (!peutSupprimer) {
    return NextResponse.json(
      {
        error: sujet.project_id === null
          ? "Seuls les dirigeants peuvent supprimer un sujet transverse."
          : "Seuls les dirigeants et le responsable du produit peuvent supprimer un sujet.",
      },
      { status: 403 },
    );
  }

  await query("DELETE FROM sujets WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
