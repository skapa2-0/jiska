import { NextResponse } from "next/server";
import { estAdmin, estMembre, getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { sqlLogoUrl } from "@/lib/media";

const LOGO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const LOGO_MAX = 300_000;

// Détail d'un produit : fiche + membres (avec responsable désigné).
// Visible par ses membres et par les admins.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  if (!(await estMembre(me, id))) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const rows = await query<{
    id: string;
    name: string;
    description: string;
    logo: string | null;
    logo_rounded: boolean;
    deployable: boolean;
    created_at: string;
    resume_ia: string | null;
    resume_ia_date: string | null;
  }>(
    `SELECT p.id, p.name, p.description, ${sqlLogoUrl("p")} AS logo,
            p.logo_rounded, p.deployable,
            p.created_at::text AS created_at,
            p.resume_ia, p.resume_ia_date::text AS resume_ia_date
       FROM projects p WHERE p.id = $1`,
    [id],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }

  const membres = await query<{
    user_id: string;
    is_responsable: boolean;
    email: string;
    first_name: string;
    last_name: string;
  }>(
    `SELECT m.user_id, m.is_responsable, u.email, u.first_name, u.last_name
       FROM project_members m JOIN users u ON u.id = m.user_id
      WHERE m.project_id = $1
      ORDER BY u.last_name, u.first_name`,
    [id],
  );

  return NextResponse.json({
    project: {
      ...rows[0],
      members: membres.map((m) => ({
        id: m.user_id,
        email: m.email,
        first_name: m.first_name,
        last_name: m.last_name,
        is_responsable: m.is_responsable,
      })),
    },
  });
}

async function dirigeantEtProjet(id: string) {
  const me = await getSessionUser();
  if (!me) return { erreur: NextResponse.json({ error: "Non connecté." }, { status: 401 }) };
  if (!estAdmin(me)) {
    return {
      erreur: NextResponse.json(
        { error: "Seuls les dirigeants peuvent gérer un produit." },
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
    return { erreur: NextResponse.json({ error: "Produit introuvable." }, { status: 404 }) };
  }
  return { me };
}

// Modification d'un projet (nom, description, logo, membres,
// responsable) : tout membre du projet, ou dirigeant / développeur.
// La suppression (DELETE) reste réservée aux admins : c'est destructif.
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
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }
  if (!(await estMembre(me, id))) {
    return NextResponse.json(
      { error: "Seuls les membres du produit peuvent le modifier." },
      { status: 403 },
    );
  }

  let body: {
    name?: string;
    description?: string;
    logo?: string | null;
    logoRounded?: boolean;
    memberIds?: unknown;
    responsableId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const sets: string[] = [];
  const paramsSql: (string | number | boolean | null)[] = [];

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json(
        { error: "Le nom du produit est requis." },
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
  if (typeof body.logoRounded === "boolean") {
    paramsSql.push(body.logoRounded);
    sets.push(`logo_rounded = $${paramsSql.length}`);
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
        { error: "Le produit doit garder au moins un membre." },
        { status: 400 },
      );
    }
    if (!memberIds.includes(responsableId)) {
      return NextResponse.json(
        { error: "Le responsable doit faire partie des membres du produit." },
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
