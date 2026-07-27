import { NextResponse } from "next/server";
import { getSessionUser, hashPassword } from "@/lib/auth";
import { query } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;

// Création de compte par un dirigeant (collaborateur ou autre dirigeant).
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (me.role !== "dirigeant") {
    return NextResponse.json(
      { error: "Réservé aux dirigeants." },
      { status: 403 },
    );
  }

  let body: { email?: string; password?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const role = body.role === "dirigeant" ? "dirigeant" : "collaborateur";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Adresse e-mail invalide." },
      { status: 400 },
    );
  }
  if (password.length < PASSWORD_MIN) {
    return NextResponse.json(
      { error: `Le mot de passe doit faire au moins ${PASSWORD_MIN} caractères.` },
      { status: 400 },
    );
  }

  const rows = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [email, await hashPassword(password), role],
  );

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec cette adresse." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, id: rows[0].id }, { status: 201 });
}
