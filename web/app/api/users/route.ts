import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Création de compte par un dirigeant. Deux écritures, dans cet ordre :
// la ligne locale (qui porte le rôle et ouvre le droit d'entrer), puis
// l'invitation Clerk (qui permettra à la personne de choisir son mot de
// passe). Le mot de passe n'est plus saisi par le dirigeant : c'est Clerk
// qui le gère, et personne d'autre que l'intéressé ne le connaît.
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (me.role !== "dirigeant") {
    return NextResponse.json(
      { error: "Réservé aux dirigeants." },
      { status: 403 },
    );
  }

  let body: { email?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const role = body.role === "dirigeant" ? "dirigeant" : "collaborateur";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Adresse e-mail invalide." },
      { status: 400 },
    );
  }

  const rows = await query<{ id: string }>(
    `INSERT INTO users (email, role) VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [email, role],
  );
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec cette adresse." },
      { status: 409 },
    );
  }

  // L'invitation part après coup : si elle échoue, le compte existe déjà
  // côté Jiska et le dirigeant peut relancer l'invitation, plutôt que de
  // se retrouver avec une invitation sans compte derrière.
  try {
    const client = await clerkClient();
    await client.invitations.createInvitation({
      emailAddress: email,
      ignoreExisting: true,
    });
  } catch {
    return NextResponse.json(
      {
        ok: true,
        id: rows[0].id,
        avertissement:
          "Compte créé, mais l'invitation n'a pas pu être envoyée. Relancez-la depuis la page Équipe.",
      },
      { status: 201 },
    );
  }

  return NextResponse.json({ ok: true, id: rows[0].id }, { status: 201 });
}
