import { NextResponse } from "next/server";
import { estAdmin, getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { creerSujet, estEchec } from "@/lib/sujets-write";
import { CRITICITES, ETATS, TYPES_SUJET } from "@/lib/sujets";

// Liste des sujets visibles. Dirigeant / developeur voient tout ;
// collaborateur voit les sujets de ses produits et tous les transverses
// (règle PRD : « Visibles de tous »). Filtres optionnels par query :
// `projectId` (ou `transverse` pour project_id null), `etat`, `type`,
// `criticite`, `porteurId`, `dueBefore`, `dueAfter`, `search`.
export async function GET(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const transverse = url.searchParams.get("transverse") === "1";
  const etat = url.searchParams.get("etat");
  const type = url.searchParams.get("type");
  const criticite = url.searchParams.get("criticite");
  const porteurId = url.searchParams.get("porteurId");
  const dueBefore = url.searchParams.get("dueBefore");
  const dueAfter = url.searchParams.get("dueAfter");
  const search = url.searchParams.get("search");

  const where: string[] = [];
  const args: (string | number | null)[] = [];
  const pose = (sql: string, v: string | number | null) => {
    args.push(v);
    where.push(sql.replace("?", `$${args.length}`));
  };

  if (!estAdmin(me)) {
    pose(
      "(s.project_id IS NULL OR s.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?))",
      me.id,
    );
  }
  if (transverse) {
    where.push("s.project_id IS NULL");
  } else if (projectId && /^\d+$/.test(projectId)) {
    pose("s.project_id = ?", projectId);
  }
  if (etat && etat in ETATS) pose("s.etat = ?", etat);
  if (type && type in TYPES_SUJET) pose("s.type = ?", type);
  if (criticite && criticite in CRITICITES) pose("s.criticite = ?", criticite);
  if (porteurId && /^\d+$/.test(porteurId)) pose("s.porteur_id = ?", porteurId);
  if (dueBefore && /^\d{4}-\d{2}-\d{2}$/.test(dueBefore)) {
    pose("s.due_date <= ?::date", dueBefore);
  }
  if (dueAfter && /^\d{4}-\d{2}-\d{2}$/.test(dueAfter)) {
    pose("s.due_date >= ?::date", dueAfter);
  }
  if (search && search.trim()) {
    const motif = `%${search.trim()}%`;
    args.push(motif);
    const i = args.length;
    where.push(`(s.title ILIKE $${i} OR s.action ILIKE $${i})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await query<{
    id: string;
    project_id: string | null;
    project_name: string | null;
    title: string;
    action: string;
    due_date: string | null;
    type: string;
    porteur_id: string | null;
    criticite: string;
    etat: string;
    commentaire: string;
    updated_at: string;
  }>(
    `SELECT s.id, s.project_id, p.name AS project_name,
            s.title, s.action,
            s.due_date::text AS due_date, s.type, s.porteur_id,
            s.criticite, s.etat, s.commentaire,
            s.updated_at::text AS updated_at
       FROM sujets s LEFT JOIN projects p ON p.id = s.project_id
       ${whereSql}
      ORDER BY s.due_date NULLS LAST, s.id`,
    args,
  );

  return NextResponse.json({ sujets: rows });
}

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
