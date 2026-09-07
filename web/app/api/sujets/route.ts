import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { creerSujet, estEchec } from "@/lib/sujets-write";

// Création d'un sujet : dirigeant, ou responsable du projet concerné.
// La validation vit dans lib/sujets-write, partagée avec l'application
// d'un import de réunion.
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  // null explicite = sujet transverse. Une valeur absente ou vide reste
  // une erreur : on ne crée pas hors produit par accident.
  const projectId =
    body.projectId === null ? null : String(body.projectId ?? "");
  const res = await creerSujet(me, projectId, body);
  if (estEchec(res)) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true, id: res.id }, { status: 201 });
}
