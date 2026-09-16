import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

// Suppression d'un compte par un dirigeant (jamais le sien). La ligne
// Jiska est l'autorité d'accès (un compte Clerk sans ligne locale est
// refusé au login), mais on propage la suppression à Clerk pour éviter
// de laisser un compte fantôme capable de se ré-authentifier ; on
// révoque aussi les invitations en attente pour la même adresse, sinon
// un vieux lien pourrait recréer un compte Clerk après coup.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  if (me.role !== "dirigeant") {
    return NextResponse.json(
      { error: "Réservé aux dirigeants." },
      { status: 403 },
    );
  }

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  if (id === me.id) {
    return NextResponse.json(
      { error: "Impossible de supprimer votre propre compte." },
      { status: 400 },
    );
  }

  const rows = await query<{ email: string; clerk_id: string | null }>(
    "SELECT email, clerk_id FROM users WHERE id = $1",
    [id],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  }
  const cible = rows[0];

  const clerk = await clerkClient();

  if (cible.clerk_id) {
    // Un « déjà supprimé côté Clerk » (404) ne doit pas faire échouer
    // l'opération : le but est un état final cohérent, atteint des
    // deux côtés.
    try {
      await clerk.users.deleteUser(cible.clerk_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/not found|404/i.test(message)) {
        return NextResponse.json(
          { error: "Le compte Clerk n'a pas pu être supprimé, rien n'a été fait." },
          { status: 502 },
        );
      }
    }
  }

  // Plusieurs invitations peuvent coexister pour une même adresse
  // (relances). On les révoque toutes : un lien encore actif pourrait
  // recréer un compte Clerk après la suppression et laisser croire à
  // l'utilisateur qu'il a de nouveau accès.
  try {
    const liste = await clerk.invitations.getInvitationList({
      query: cible.email,
      status: "pending",
    });
    const invitations = Array.isArray(liste) ? liste : liste.data;
    for (const inv of invitations) {
      if (inv.emailAddress.toLowerCase() === cible.email.toLowerCase()) {
        await clerk.invitations.revokeInvitation(inv.id).catch(() => null);
      }
    }
  } catch {
    // Best-effort : la présence éventuelle d'invitations orphelines
    // n'ouvre aucun accès sans ligne Jiska derrière, donc on n'échoue
    // pas la suppression pour ça.
  }

  await query("DELETE FROM users WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
