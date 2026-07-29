import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Data URL d'image réduite côté client (256 px) ; garde-fou serveur.
const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const AVATAR_MAX = 300_000;

// Mise à jour de son propre profil (nom, e-mail, photo).
export async function PATCH(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  let body: {
    firstName?: unknown;
    lastName?: unknown;
    email?: unknown;
    avatar?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const sets: string[] = [];
  const params: (string | null)[] = [];

  if (typeof body.firstName === "string") {
    params.push(body.firstName.trim().slice(0, 60));
    sets.push(`first_name = $${params.length}`);
  }
  if (typeof body.lastName === "string") {
    params.push(body.lastName.trim().slice(0, 60));
    sets.push(`last_name = $${params.length}`);
  }
  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "Adresse e-mail invalide." },
        { status: 400 },
      );
    }
    params.push(email);
    sets.push(`email = $${params.length}`);
  }
  if (body.avatar === null) {
    params.push(null);
    sets.push(`avatar = $${params.length}`);
  } else if (typeof body.avatar === "string") {
    if (!AVATAR_RE.test(body.avatar) || body.avatar.length > AVATAR_MAX) {
      return NextResponse.json(
        { error: "Photo invalide (jpeg/png/webp, 300 Ko max une fois réduite)." },
        { status: 400 },
      );
    }
    params.push(body.avatar);
    sets.push(`avatar = $${params.length}`);
  }

  if (sets.length === 0) return NextResponse.json({ ok: true });

  try {
    params.push(me.id);
    await query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${params.length}`,
      params,
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cette adresse." },
        { status: 409 },
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
