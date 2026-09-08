import { auth, clerkClient } from "@clerk/nextjs/server";
import { query } from "./db";
import { sqlAvatarUrl } from "./media";

// Partage des rôles entre Clerk et Jiska : Clerk répond « qui es-tu »
// (mot de passe, session, connexion), Jiska répond « à quoi as-tu droit »
// (rôle, produits, sujets). Les deux ne se mélangent pas : la table users
// reste l'autorité sur qui entre, et un compte Clerk sans ligne locale est
// refusé, même authentifié.

export type Role = "dirigeant" | "collaborateur";
export type SessionUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
  role: Role;
};

const CHAMPS = `id, email, first_name, last_name, role,
                ${sqlAvatarUrl()} AS avatar`;

export async function getSessionUser(): Promise<SessionUser | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const connus = await query<SessionUser>(
    `SELECT ${CHAMPS} FROM users WHERE clerk_id = $1`,
    [clerkId],
  );
  if (connus[0]) return connus[0];

  // Première connexion d'un compte créé avant la bascule, ou créé par un
  // dirigeant puis invité : on rapproche par e-mail et on lie une fois
  // pour toutes. Sans compte local correspondant, l'accès est refusé.
  const client = await clerkClient();
  const compte = await client.users.getUser(clerkId);
  const email = compte.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
  if (!email) return null;

  const lies = await query<SessionUser>(
    `UPDATE users SET clerk_id = $1
      WHERE lower(email) = $2 AND clerk_id IS NULL
      RETURNING ${CHAMPS}`,
    [clerkId, email],
  );
  return lies[0] ?? null;
}

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
