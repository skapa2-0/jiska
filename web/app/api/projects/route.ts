import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

// Création de projet : dirigeants uniquement. Les membres sont ajoutés
// d'un coup, avec un responsable désigné parmi eux.
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (me.role !== "dirigeant") {
    return NextResponse.json(
      { error: "Seuls les dirigeants peuvent créer un produit." },
      { status: 403 },
    );
  }

  let body: {
    name?: string;
    description?: string;
    memberIds?: unknown;
    responsableId?: string;
    logo?: string | null;
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

  const project = await query<{ id: string }>(
    `INSERT INTO projects (name, description, created_by, logo)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, description, me.id, logo],
  );
  const projectId = project[0].id;

  await query(
    `INSERT INTO project_members (project_id, user_id, is_responsable)
     SELECT $1, u.id, u.id = $2 FROM users u WHERE u.id = ANY($3::bigint[])`,
    [projectId, responsableId, memberIds],
  );

  return NextResponse.json({ ok: true, id: projectId }, { status: 201 });
}
