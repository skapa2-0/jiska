import { NextResponse } from "next/server";
import { canManageSujets, getSessionUser } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { CRITICITES, ETATS, isJalon } from "@/lib/sujets";

type SujetDb = {
  id: string;
  project_id: string;
  title: string;
  action: string;
  due_date: string | null;
  jalon_tech: number;
  jalon_business: number;
  criticite: string;
  etat: string;
  commentaire: string;
};

async function loadSujet(id: string): Promise<SujetDb | null> {
  if (!/^\d+$/.test(id)) return null;
  const rows = await query<SujetDb>(
    `SELECT id, project_id, title, action,
            due_date::text AS due_date, jalon_tech, jalon_business,
            criticite, etat, commentaire
       FROM sujets WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// Peut modifier : dirigeant, ou responsable du projet (le responsable
// et l'équipe sont portés par le projet, pas par le sujet).
function canEdit(me: SessionUser, sujet: SujetDb): Promise<boolean> {
  return canManageSujets(me, sujet.project_id);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { id } = await params;
  const sujet = await loadSujet(id);
  if (!sujet) {
    return NextResponse.json({ error: "Sujet introuvable." }, { status: 404 });
  }
  if (!(await canEdit(me, sujet))) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  // Champs modifiables -> valeur validée (undefined = non fourni/invalide).
  const patch: Record<string, string | number | null | undefined> = {
    title:
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : undefined,
    action: typeof body.action === "string" ? body.action.trim() : undefined,
    commentaire:
      typeof body.commentaire === "string" ? body.commentaire.trim() : undefined,
    due_date:
      body.dueDate === null
        ? null
        : /^\d{4}-\d{2}-\d{2}$/.test(String(body.dueDate ?? ""))
          ? String(body.dueDate)
          : undefined,
    jalon_tech: isJalon(body.jalonTech) ? body.jalonTech : undefined,
    jalon_business: isJalon(body.jalonBusiness) ? body.jalonBusiness : undefined,
    criticite:
      typeof body.criticite === "string" && body.criticite in CRITICITES
        ? body.criticite
        : undefined,
    etat:
      typeof body.etat === "string" && body.etat in ETATS
        ? body.etat
        : undefined,
  };

  const changes = Object.entries(patch).filter(
    ([field, value]) =>
      value !== undefined &&
      String(value ?? "") !== String(sujet[field as keyof SujetDb] ?? ""),
  );
  if (changes.length === 0) return NextResponse.json({ ok: true });

  const sets = changes.map(([field], i) => `${field} = $${i + 2}`).join(", ");
  await query(
    `UPDATE sujets SET ${sets}, updated_at = now() WHERE id = $1`,
    [id, ...changes.map(([, value]) => value)],
  );

  // Historique champ par champ (PRD §11 : conservé, non affiché).
  for (const [field, value] of changes) {
    await query(
      `INSERT INTO sujet_history (sujet_id, changed_by, field, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, me.id, field, String(sujet[field as keyof SujetDb] ?? ""), String(value ?? "")],
    );
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
  const sujet = await loadSujet(id);
  if (!sujet) {
    return NextResponse.json({ error: "Sujet introuvable." }, { status: 404 });
  }
  if (!(await canManageSujets(me, sujet.project_id))) {
    return NextResponse.json(
      { error: "Seuls les dirigeants et le responsable du projet peuvent supprimer un sujet." },
      { status: 403 },
    );
  }

  await query("DELETE FROM sujets WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
