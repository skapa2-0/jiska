import { NextResponse } from "next/server";
import { estAdmin, getSessionUser } from "@/lib/auth";
import { recupererTranscript } from "@/lib/fireflies";
import { lancerAnalyseImport } from "@/lib/imports";

// Récupère un transcript Fireflies par son id et lance l'analyse en
// portée portefeuille, comme le POST /api/imports de collage manuel.
// On ne gère pas la portée produit depuis Fireflies : les réunions
// Fireflies qu'on cible sont la réunion hebdo de l'équipe, par nature
// transverse à tous les produits.
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (!estAdmin(me)) {
    return NextResponse.json({ error: "Réservé aux dirigeants." }, { status: 403 });
  }

  let body: { firefliesId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const firefliesId = String(body.firefliesId ?? "").trim();
  if (!firefliesId) {
    return NextResponse.json(
      { error: "L'identifiant Fireflies est requis." },
      { status: 400 },
    );
  }

  try {
    const t = await recupererTranscript(firefliesId);
    const resultat = await lancerAnalyseImport(me.id, null, t.dateReunion, t.texte);
    return NextResponse.json(
      { ok: true, titre: t.titre, dateReunion: t.dateReunion, ...resultat },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Échec de l'import." },
      { status: 502 },
    );
  }
}
