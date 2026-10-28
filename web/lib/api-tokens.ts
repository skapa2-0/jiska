import { createHash, randomBytes } from "node:crypto";
import { query } from "./db";

// Jetons d'API personnels. Un jeton = secret opaque, format
// `jska_<32 octets en base64url>`. On stocke seulement un hash sha256 (pas
// besoin de bcrypt : le secret a 256 bits d'entropie, sha256 suffit à
// empêcher la découverte à partir du hash et reste rapide pour vérifier
// à chaque requête API). Le préfixe en clair sert à aider l'utilisateur
// à reconnaître ses propres jetons dans la liste.

const PREFIXE = "jska_";
const PREFIXE_LISTE = 10; // caractères montrés dans la liste

export type TokenRow = {
  id: string;
  label: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Crée un jeton pour un utilisateur, insère le hash, et renvoie à la fois
// la ligne stockée et le secret en clair. Appelant responsable de ne
// montrer `secret` qu'une fois : il n'est plus récupérable ensuite.
export async function creerToken(
  userId: string,
  label: string,
): Promise<{ row: TokenRow; secret: string }> {
  const secret = PREFIXE + randomBytes(32).toString("base64url");
  const token_hash = hashToken(secret);
  const prefix = secret.slice(0, PREFIXE_LISTE);
  const rows = await query<TokenRow>(
    `INSERT INTO api_tokens (user_id, label, token_hash, prefix)
     VALUES ($1, $2, $3, $4)
     RETURNING id, label, prefix,
       created_at::text AS created_at,
       last_used_at::text AS last_used_at,
       revoked_at::text AS revoked_at`,
    [userId, label, token_hash, prefix],
  );
  return { row: rows[0], secret };
}

export async function listerTokens(userId: string): Promise<TokenRow[]> {
  return query<TokenRow>(
    `SELECT id, label, prefix,
            created_at::text AS created_at,
            last_used_at::text AS last_used_at,
            revoked_at::text AS revoked_at
       FROM api_tokens
      WHERE user_id = $1
      ORDER BY revoked_at NULLS FIRST, created_at DESC`,
    [userId],
  );
}

export async function revoquerToken(
  userId: string,
  tokenId: string,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE api_tokens SET revoked_at = now()
      WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
      RETURNING id`,
    [tokenId, userId],
  );
  return rows.length > 0;
}

// Résout un secret en identifiant d'utilisateur. Pose aussi last_used_at
// (en « fire-and-forget » si on veut, ici on attend pour rester simple :
// une requête API fait déjà d'autres allers-retours en base). Renvoie
// null si le jeton n'existe pas, est révoqué, ou si l'utilisateur a été
// supprimé entretemps.
export async function utilisateurPourToken(
  secret: string,
): Promise<string | null> {
  if (!secret.startsWith(PREFIXE)) return null;
  const token_hash = hashToken(secret);
  const rows = await query<{ user_id: string }>(
    `UPDATE api_tokens SET last_used_at = now()
      WHERE token_hash = $1 AND revoked_at IS NULL
      RETURNING user_id`,
    [token_hash],
  );
  return rows[0]?.user_id ?? null;
}
