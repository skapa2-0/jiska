import { NextResponse } from "next/server";
import { estAdmin, getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { sqlLogoUrl } from "@/lib/media";

// Liste des produits visibles. Dirigeant / developeur voient tout ;
// collaborateur voit seulement ceux dont il est membre. On renvoie
// chaque produit avec ses membres (y compris la mention du responsable),
// pour qu'un client puisse l'afficher sans deuxième requête.
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  type Produit = {
    id: string;
    name: string;
    description: string;
    logo: string | null;
    logo_rounded: boolean;
    deployable: boolean;
    created_at: string;
  };
  const filtre = estAdmin(me)
    ? ""
    : "WHERE p.id IN (SELECT project_id FROM project_members WHERE user_id = $1)";
  const args = estAdmin(me) ? [] : [me.id];
  const produits = await query<Produit>(
    `SELECT p.id, p.name, p.description, ${sqlLogoUrl("p")} AS logo,
            p.logo_rounded, p.deployable,
            p.created_at::text AS created_at
       FROM projects p ${filtre}
       ORDER BY p.name`,
    args,
  );

  if (produits.length === 0) return NextResponse.json({ projects: [] });

  const ids = produits.map((p) => p.id);
  const membres = await query<{
    project_id: string;
    user_id: string;
    is_responsable: boolean;
    email: string;
    first_name: string;
    last_name: string;
  }>(
    `SELECT m.project_id, m.user_id, m.is_responsable,
            u.email, u.first_name, u.last_name
       FROM project_members m JOIN users u ON u.id = m.user_id
      WHERE m.project_id = ANY($1::bigint[])
      ORDER BY u.last_name, u.first_name`,
    [ids],
  );

  const projects = produits.map((p) => ({
    ...p,
    members: membres
      .filter((m) => m.project_id === p.id)
      .map((m) => ({
        id: m.user_id,
        email: m.email,
        first_name: m.first_name,
        last_name: m.last_name,
        is_responsable: m.is_responsable,
      })),
  }));
  return NextResponse.json({ projects });
}

// Création de projet : ouvert à toute personne authentifiée. Les
// membres sont ajoutés d'un coup, avec un responsable désigné parmi
// eux. (La suppression reste admin-only : destructif.)
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  let body: {
    name?: string;
    description?: string;
    memberIds?: unknown;
    responsableId?: string;
    logo?: string | null;
    logoRounded?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const description = body.description?.trim() ?? "";
  const memberIds = Array.isArray(body.memberIds)
    ? [...new Set(body.memberIds.map(String).filter((v) => /^\d+$/.test(v)))]
    : [];
  const responsableId = body.responsableId ? String(body.responsableId) : "";

  if (!name) {
    return NextResponse.json(
      { error: "Le nom du produit est requis." },
      { status: 400 },
    );
  }
  if (memberIds.length === 0) {
    return NextResponse.json(
      { error: "Ajoutez au moins un membre au produit." },
      { status: 400 },
    );
  }
  if (!memberIds.includes(responsableId)) {
    return NextResponse.json(
      { error: "Le responsable doit faire partie des membres du produit." },
      { status: 400 },
    );
  }

  // Logo facultatif : data URL d'image réduite côté client.
  const logo =
    typeof body.logo === "string" &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(body.logo) &&
    body.logo.length <= 300_000
      ? body.logo
      : null;
  const logoRounded = body.logoRounded !== false;

  const project = await query<{ id: string }>(
    `INSERT INTO projects (name, description, created_by, logo, logo_rounded)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [name, description, me.id, logo, logoRounded],
  );
  const projectId = project[0].id;

  await query(
    `INSERT INTO project_members (project_id, user_id, is_responsable)
     SELECT $1, u.id, u.id = $2 FROM users u WHERE u.id = ANY($3::bigint[])`,
    [projectId, responsableId, memberIds],
  );

  return NextResponse.json({ ok: true, id: projectId }, { status: 201 });
}
