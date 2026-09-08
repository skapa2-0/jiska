import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Invitation d'un compte Jiska existant à activer son accès. L'adresse est
// modifiable : quelqu'un peut très bien vouloir se connecter avec une autre
// boîte que celle enregistrée à sa création. C'est cette adresse qui part
// dans l'invitation, et c'est la seule avec laquelle la personne pourra
// entrer, puisque le rapprochement se fait par e-mail exact.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (me.role !== "dirigeant") {
    return NextResponse.json({ error: "Réservé aux dirigeants." }, { status: 403 });
  }

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  }

  const cibles = await query<{ email: string; clerk_id: string | null }>(
    "SELECT email, clerk_id FROM users WHERE id = $1",
    [id],
  );
  const cible = cibles[0];
  if (!cible) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  }
  // Un compte déjà rattaché a son identité chez Clerk : changer son adresse
  // ici la désynchroniserait et lui fermerait la porte.
  if (cible.clerk_id) {
    return NextResponse.json(
      { error: "Ce compte est déjà activé : l'adresse se change depuis « Gérer mon compte »." },
      { status: 409 },
    );
  }

  // L'adresse doit rester unique : deux comptes Jiska ne peuvent pas viser
  // la même personne.
  if (email !== cible.email.toLowerCase()) {
    const pris = await query("SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2", [
      email,
      id,
    ]);
    if (pris.length > 0) {
      return NextResponse.json(
        { error: "Un autre compte utilise déjà cette adresse." },
        { status: 409 },
      );
    }
    await query("UPDATE users SET email = $1 WHERE id = $2", [email, id]);
  }

  try {
    const client = await clerkClient();
    await client.invitations.createInvitation({
      emailAddress: email,
      ignoreExisting: true,
    });
  } catch {
    return NextResponse.json(
      { error: "L'adresse a été enregistrée, mais l'invitation n'est pas partie. Réessayez." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, email });
}
