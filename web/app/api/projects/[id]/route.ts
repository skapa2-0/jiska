import { NextResponse } from "next/server";
import { canManageSujets, getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { isJalon } from "@/lib/sujets";

const LOGO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const LOGO_MAX = 300_000;

async function dirigeantEtProjet(id: string) {
  const me = await getSessionUser();
  if (!me) return { erreur: NextResponse.json({ error: "Non connecté." }, { status: 401 }) };
  if (me.role !== "dirigeant") {
    return {
      erreur: NextResponse.json(
        { error: "Seuls les dirigeants peuvent gérer un projet." },
        { status: 403 },
      ),
    };
  }
  if (!/^\d+$/.test(id)) {
    return { erreur: NextResponse.json({ error: "Identifiant invalide." }, { status: 400 }) };
  }
  const rows = await query<{ id: string }>(
    "SELECT id FROM projects WHERE id = $1",
    [id],
  );
  if (rows.length === 0) {
    return { erreur: NextResponse.json({ error: "Projet introuvable." }, { status: 404 }) };
  }
  return { me };
}

// Modification d'un projet. Nom, description, logo, membres et
// responsable : dirigeants seuls. Jalons d'avancement : dirigeants et
// responsable du projet (mise à jour en réunion).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  const existe = await query("SELECT 1 FROM projects WHERE id = $1", [id]);
  if (existe.length === 0) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  }

  let body: {
    name?: string;
    description?: string;
    logo?: string | null;
    memberIds?: unknown;
    responsableId?: string;
    jalonTech?: number;
    jalonBusiness?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const changeAdmin =
    body.name !== undefined ||
    body.description !== undefined ||
    body.logo !== undefined ||
    body.memberIds !== undefined;
  const changeJalons =
    body.jalonTech !== undefined || body.jalonBusiness !== undefined;

  if (changeAdmin && me.role !== "dirigeant") {
    return NextResponse.json(
      { error: "Seuls les dirigeants peuvent gérer un projet." },
      { status: 403 },
    );
  }
  if (changeJalons && !(await canManageSujets(me, id))) {
    return NextResponse.json(
      { error: "Seuls les dirigeants et le responsable du projet peuvent mettre à jour l'avancement." },
      { status: 403 },
    );
  }

  const sets: string[] = [];
  const paramsSql: (string | number | null)[] = [];

  if (isJalon(body.jalonTech)) {
    paramsSql.push(body.jalonTech);
    sets.push(`jalon_tech = $${paramsSql.length}`);
  }
  if (isJalon(body.jalonBusiness)) {
    paramsSql.push(body.jalonBusiness);
    sets.push(`jalon_business = $${paramsSql.length}`);
  }

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json(
        { error: "Le nom du projet est requis." },
        { status: 400 },
      );
    }
    paramsSql.push(name);
    sets.push(`name = $${paramsSql.length}`);
  }
  if (typeof body.description === "string") {
    paramsSql.push(body.description.trim());
    sets.push(`description = $${paramsSql.length}`);
  }
  if (body.logo === null) {
    paramsSql.push(null);
    sets.push(`logo = $${paramsSql.length}`);
  } else if (typeof body.logo === "string") {
    if (!LOGO_RE.test(body.logo) || body.logo.length > LOGO_MAX) {
      return NextResponse.json(
        { error: "Logo invalide (jpeg/png/webp, 300 Ko max une fois réduit)." },
        { status: 400 },
      );
    }
    paramsSql.push(body.logo);
    sets.push(`logo = $${paramsSql.length}`);
  }

  if (sets.length > 0) {
    paramsSql.push(id);
    await query(
      `UPDATE projects SET ${sets.join(", ")} WHERE id = $${paramsSql.length}`,
      paramsSql,
    );
  }

  // Membres + responsable remplacés d'un bloc, s'ils sont fournis.
  if (body.memberIds !== undefined) {
    const memberIds = Array.isArray(body.memberIds)
      ? [...new Set(body.memberIds.map(String).filter((v) => /^\d+$/.test(v)))]
      : [];
    const responsableId = body.responsableId ? String(body.responsableId) : "";
    if (memberIds.length === 0) {
      return NextResponse.json(
        { error: "Le projet doit garder au moins un membre." },
        { status: 400 },
      );
    }
    if (!memberIds.includes(responsableId)) {
      return NextResponse.json(
        { error: "Le responsable doit faire partie des membres du projet." },
        { status: 400 },
      );
    }
    await query(
      "DELETE FROM project_members WHERE project_id = $1 AND user_id <> ALL($2::bigint[])",
      [id, memberIds],
    );
    await query(
      `INSERT INTO project_members (project_id, user_id, is_responsable)
       SELECT $1, u.id, u.id = $2 FROM users u WHERE u.id = ANY($3::bigint[])
       ON CONFLICT (project_id, user_id)
       DO UPDATE SET is_responsable = EXCLUDED.is_responsable`,
      [id, responsableId, memberIds],
    );
  }

  return NextResponse.json({ ok: true });
}

// Suppression d'un projet (et de ses sujets, membres, historique).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const acces = await dirigeantEtProjet(id);
  if ("erreur" in acces) return acces.erreur;

  await query("DELETE FROM projects WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
