import { NextResponse } from "next/server";
import { canManageSujets, getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { chargerCatalogue, extraire } from "@/lib/extraction";

// Une réunion d'une heure fait rarement plus de 200 000 caractères ;
// au-delà c'est un fichier qui n'a rien à faire ici.
const TAILLE_MAX = 200_000;

// Dépôt d'un transcript et analyse. Rien n'est écrit sur les sujets à ce
// stade : le résultat est une liste de propositions à vérifier.
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  let body: {
    projectId?: string | null;
    dateReunion?: string;
    transcript?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const projectId = /^\d+$/.test(String(body.projectId ?? ""))
    ? String(body.projectId)
    : null;
  const transcript = (body.transcript ?? "").trim();
  const dateReunion = body.dateReunion ?? "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateReunion)) {
    return NextResponse.json(
      { error: "La date de la réunion est requise : elle sert à résoudre les échéances relatives." },
      { status: 400 },
    );
  }
  if (transcript.length < 200) {
    return NextResponse.json(
      { error: "Le transcript est vide ou trop court pour être analysé." },
      { status: 400 },
    );
  }
  if (transcript.length > TAILLE_MAX) {
    return NextResponse.json(
      { error: "Transcript trop volumineux (200 000 caractères maximum)." },
      { status: 413 },
    );
  }

  // Portée portefeuille : dirigeants, comme la création de produit.
  // Portée produit : celui qui a déjà le droit d'écrire dans ce produit.
  if (projectId === null) {
    if (me.role !== "dirigeant") {
      return NextResponse.json(
        { error: "Seuls les dirigeants peuvent importer une réunion générale." },
        { status: 403 },
      );
    }
  } else if (!(await canManageSujets(me, projectId))) {
    return NextResponse.json(
      { error: "Seuls les dirigeants et le responsable du produit peuvent importer." },
      { status: 403 },
    );
  }

  const catalogue = await chargerCatalogue(projectId);
  if (catalogue.produits.length === 0) {
    return NextResponse.json(
      { error: "Aucun produit à analyser." },
      { status: 400 },
    );
  }

  let resultat;
  try {
    resultat = await extraire(catalogue, dateReunion, transcript);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Échec de l'analyse." },
      { status: 502 },
    );
  }

  const rows = await query<{ id: string }>(
    `INSERT INTO reunion_imports
       (project_id, date_reunion, transcript, propositions, ecartes,
        deploiements, created_by)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7) RETURNING id`,
    [
      projectId,
      dateReunion,
      transcript,
      JSON.stringify(resultat.propositions),
      JSON.stringify(resultat.ecartes),
      JSON.stringify(resultat.deploiements),
      me.id,
    ],
  );

  return NextResponse.json({ ok: true, id: rows[0].id, ...resultat }, { status: 201 });
}
