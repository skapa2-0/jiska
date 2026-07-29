import { NextResponse } from "next/server";
import { getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";
import { query } from "@/lib/db";

const PASSWORD_MIN = 8;

// Changement de son propre mot de passe (mot de passe actuel exigé).
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  let body: { current?: string; next?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const current = body.current ?? "";
  const next = body.next ?? "";
  if (next.length < PASSWORD_MIN) {
    return NextResponse.json(
      { error: `Le nouveau mot de passe doit faire au moins ${PASSWORD_MIN} caractères.` },
      { status: 400 },
    );
  }

  const rows = await query<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = $1",
    [me.id],
  );
  if (!(await verifyPassword(current, rows[0].password_hash))) {
    return NextResponse.json(
      { error: "Mot de passe actuel incorrect." },
      { status: 400 },
    );
  }

  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [
    await hashPassword(next),
    me.id,
  ]);
  return NextResponse.json({ ok: true });
}
