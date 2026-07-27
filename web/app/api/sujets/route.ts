import { NextResponse } from "next/server";
import { canManageSujets, getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { CRITICITES, ETATS, isJalon } from "@/lib/sujets";

// Création d'un sujet : dirigeant, ou responsable du projet concerné.
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  let body: {
    projectId?: string;
    title?: string;
    responsableId?: string;
    action?: string;
    dueDate?: string;
    jalonTech?: number;
    jalonBusiness?: number;
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
  const responsableId = String(body.responsableId ?? "");

  if (!/^\d+$/.test(projectId) || !title || !/^\d+$/.test(responsableId)) {
    return NextResponse.json(
      { error: "Projet, sujet et responsable sont requis." },
      { status: 400 },
    );
  }
  if (!(await canManageSujets(me, projectId))) {
    return NextResponse.json(
      { error: "Seuls les dirigeants et le responsable du projet peuvent créer un sujet." },
      { status: 403 },
    );
  }

  // Le responsable d'un sujet doit être membre du projet.
  const member = await query(
    "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2",
    [projectId, responsableId],
  );
  if (member.length === 0) {
    return NextResponse.json(
      { error: "Le responsable du sujet doit être membre du projet." },
      { status: 400 },
    );
  }

  const jalonTech = isJalon(body.jalonTech) ? body.jalonTech : 0;
  const jalonBusiness = isJalon(body.jalonBusiness) ? body.jalonBusiness : 0;
  const criticite =
    body.criticite && body.criticite in CRITICITES ? body.criticite : "normale";
  const etat = body.etat && body.etat in ETATS ? body.etat : "a_faire";
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate ?? "")
    ? body.dueDate
    : null;

  const rows = await query<{ id: string }>(
    `INSERT INTO sujets (project_id, title, responsable_id, action, due_date,
                         jalon_tech, jalon_business, criticite, etat, commentaire)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      projectId,
      title,
      responsableId,
      body.action?.trim() ?? "",
      dueDate,
      jalonTech,
      jalonBusiness,
      criticite,
      etat,
      body.commentaire?.trim() ?? "",
    ],
  );

  return NextResponse.json({ ok: true, id: rows[0].id }, { status: 201 });
}
