import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { query } from "./db";

const SESSION_COOKIE = "jiska_session";
const SESSION_DAYS = 1;
const SESSION_DAYS_REMEMBER = 30;

export type Role = "dirigeant" | "collaborateur";
export type SessionUser = { id: string; email: string; role: Role };

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

// Seule l'empreinte du jeton est stockée : un dump de la table ne
// permet pas de rejouer les sessions.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
  remember: boolean,
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const days = remember ? SESSION_DAYS_REMEMBER : SESSION_DAYS;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [hashToken(token), userId, expiresAt],
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Sans « rester connecté », cookie de session navigateur (pas de maxAge).
    ...(remember ? { maxAge: days * 24 * 60 * 60 } : {}),
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await query<{ id: string; email: string; role: Role }>(
    `SELECT u.id, u.email, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
}

// Vrai si l'utilisateur est responsable d'au moins un projet (les
// responsables peuvent créer des sujets, pas des projets).
export async function isResponsable(userId: string): Promise<boolean> {
  const rows = await query(
    "SELECT 1 FROM project_members WHERE user_id = $1 AND is_responsable LIMIT 1",
    [userId],
  );
  return rows.length > 0;
}

// Peut gérer les sujets d'un projet (créer, tout modifier, supprimer) :
// dirigeant, ou responsable de ce projet.
export async function canManageSujets(
  user: SessionUser,
  projectId: string,
): Promise<boolean> {
  if (user.role === "dirigeant") return true;
  const rows = await query(
    "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2 AND is_responsable",
    [projectId, user.id],
  );
  return rows.length > 0;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await query("DELETE FROM sessions WHERE token_hash = $1", [
      hashToken(token),
    ]);
  }
  cookieStore.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
}
