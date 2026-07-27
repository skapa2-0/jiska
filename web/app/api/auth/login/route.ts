import { NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  let body: { email?: string; password?: string; remember?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "E-mail et mot de passe requis." },
      { status: 400 },
    );
  }

  const rows = await query<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = $1",
    [email],
  );

  // Réponse identique que l'e-mail existe ou non.
  const valid =
    rows.length > 0 && (await verifyPassword(password, rows[0].password_hash));
  if (!valid) {
    return NextResponse.json(
      { error: "Identifiants incorrects." },
      { status: 401 },
    );
  }

  await createSession(rows[0].id, body.remember === true);
  return NextResponse.json({ ok: true });
}
