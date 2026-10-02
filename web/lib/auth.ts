import { auth, clerkClient } from "@clerk/nextjs/server";
import { query } from "./db";
import { sqlAvatarUrl } from "./media";
import { estAdmin } from "./roles";
import type { Role } from "./roles";

// Partage des rôles entre Clerk et Jiska : Clerk répond « qui es-tu »
// (mot de passe, session, connexion), Jiska répond « à quoi as-tu droit »
// (rôle, produits, sujets). Les deux ne se mélangent pas : la table users
// reste l'autorité sur qui entre, et un compte Clerk sans ligne locale est
// refusé, même authentifié.

export type { Role };
export { estAdmin, libelleRole } from "./roles";

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

// Vrai dès que l'utilisateur fait partie d'au moins un produit, tous
// rôles confondus. Sert à décider si on affiche « Nouveau sujet »
// dans la navbar : tout membre d'un produit peut créer un sujet dans
// ce produit (plus seulement le responsable).
export async function estDansUnProjet(userId: string): Promise<boolean> {
  const rows = await query(
    "SELECT 1 FROM project_members WHERE user_id = $1 LIMIT 1",
    [userId],
  );
  return rows.length > 0;
}

// Vrai si l'utilisateur fait partie du projet (membre ou responsable).
// Sert à ouvrir aux collaborateurs les actions auparavant réservées au
// responsable : édition du produit, création / clôture de sujets,
// import de réunion, bascule du déployable. Un dirigeant garde tous
// les droits même sans être membre explicitement.
export async function estMembre(
  user: SessionUser,
  projectId: string,
): Promise<boolean> {
  if (estAdmin(user)) return true;
  const rows = await query(
    "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2 LIMIT 1",
    [projectId, user.id],
  );
  return rows.length > 0;
}

// Alias historique conservé pour les appels existants : « peut gérer les
// sujets d'un projet » = être membre de ce projet (ou admin). La notion
// de « seul responsable gérant » a été ouverte à tous les membres.
export async function canManageSujets(
  user: SessionUser,
  projectId: string,
): Promise<boolean> {
  return estMembre(user, projectId);
}
