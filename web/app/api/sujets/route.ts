import { NextResponse } from "next/server";
import { canManageSujets, getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { CRITICITES, ETATS, TYPES_SUJET } from "@/lib/sujets";

// Création d'un sujet : dirigeant, ou responsable du projet concerné.
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  let body: {
    projectId?: string;
    title?: string;
    action?: string;
    dueDate?: string;
    type?: string;
    poids?: number;
    porteurId?: string | null;
    criticite?: string;
    etat?: string;
    commentaire?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const projectId = String(body.projectId ?? "");
  const title = body.title?.trim() ?? "";

  if (!/^\d+$/.test(projectId) || !title) {
    return NextResponse.json(
      { error: "Projet et sujet sont requis." },
      { status: 400 },
    );
  }
  if (!(await canManageSujets(me, projectId))) {
    return NextResponse.json(
      { error: "Seuls les dirigeants et le responsable du projet peuvent créer un sujet." },
      { status: 403 },
    );
  }

  const porteurId = /^\d+$/.test(String(body.porteurId ?? ""))
    ? String(body.porteurId)
    : null;
  if (porteurId) {
    const membre = await query(
      "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2",
      [projectId, porteurId],
    );
    if (membre.length === 0) {
      return NextResponse.json(
        { error: "Le porteur doit être membre du projet." },
        { status: 400 },
      );
    }
  }

  const type =
    body.type && body.type in TYPES_SUJET ? body.type : "technique";
  const poids =
    typeof body.poids === "number" && Number.isFinite(body.poids)
      ? Math.min(100, Math.max(0, Math.round(body.poids)))
      : 0;
  const criticite =
    body.criticite && body.criticite in CRITICITES ? body.criticite : "normale";
  const etat = body.etat && body.etat in ETATS ? body.etat : "a_faire";
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate ?? "")
    ? body.dueDate
    : null;

  const rows = await query<{ id: string }>(
    `INSERT INTO sujets (project_id, title, action, due_date,
                         type, poids, porteur_id, criticite, etat, commentaire)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      projectId,
      title,
      body.action?.trim() ?? "",
      dueDate,
      type,
      poids,
      porteurId,
      criticite,
      etat,
      body.commentaire?.trim() ?? "",
    ],
  );

  // Trace de création dans l'historique du projet.
  await query(
    `INSERT INTO sujet_history (sujet_id, changed_by, field, new_value)
     VALUES ($1, $2, 'creation', $3)`,
    [rows[0].id, me.id, title],
  );

  return NextResponse.json({ ok: true, id: rows[0].id }, { status: 201 });
}
