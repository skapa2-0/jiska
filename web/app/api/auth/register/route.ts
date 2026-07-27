import { NextResponse } from "next/server";
import { createSession, hashPassword } from "@/lib/auth";
import { query } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

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

  const passwordHash = await hashPassword(password);
  const rows = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [email, passwordHash],
  );

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec cette adresse." },
      { status: 409 },
    );
  }

  await createSession(rows[0].id, false);
  return NextResponse.json({ ok: true }, { status: 201 });
}
