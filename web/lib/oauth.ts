import { createHash, randomBytes } from "node:crypto";
import { query } from "./db";

// Mécanique OAuth 2.1 de Jiska : génération et vérification des codes
// d'autorisation, des access tokens et des refresh tokens. Toute la
// crypto vit ici (sha256 pour les hashes stockés, S256 PKCE pour les
// challenges). Les endpoints OAuth consomment ces helpers ; aucun autre
// endroit ne touche aux tables oauth_*.

const PREFIXE_ACCES = "jska_at_";
const PREFIXE_REFRESH = "jska_rt_";
const PREFIXE_CLIENT = "jska_cl_";
export const DUREE_CODE_SEC = 60; // RFC 6749 recommande < 10 min, on reste court
export const DUREE_ACCES_SEC = 3600; // 1 h
export const DUREE_REFRESH_SEC = 60 * 60 * 24 * 90; // 90 j
export const SCOPE_PAR_DEFAUT = "jiska:all";

function hash(valeur: string): string {
  return createHash("sha256").update(valeur).digest("hex");
}

function randomUrl(octets = 32): string {
  return randomBytes(octets).toString("base64url");
}

// -------- Clients enregistrés --------

export type OAuthClient = {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  created_at: string;
};

export async function enregistrerClient(
  clientName: string,
  redirectUris: string[],
): Promise<OAuthClient> {
  const client_id = PREFIXE_CLIENT + randomUrl(16);
  const rows = await query<OAuthClient>(
    `INSERT INTO oauth_clients (client_id, client_name, redirect_uris)
     VALUES ($1, $2, $3::jsonb)
     RETURNING client_id, client_name, redirect_uris,
       created_at::text AS created_at`,
    [client_id, clientName.slice(0, 120), JSON.stringify(redirectUris)],
  );
  return rows[0];
}

export async function chargerClient(
  client_id: string,
): Promise<OAuthClient | null> {
  const rows = await query<OAuthClient>(
    `SELECT client_id, client_name, redirect_uris,
            created_at::text AS created_at
       FROM oauth_clients WHERE client_id = $1`,
    [client_id],
  );
  return rows[0] ?? null;
}

// -------- Authorization codes (PKCE) --------

export async function creerAuthCode(
  client_id: string,
  user_id: string,
  redirect_uri: string,
  code_challenge: string,
  code_challenge_method: string,
  scope: string,
): Promise<string> {
  const code = randomUrl(32);
  await query(
    `INSERT INTO oauth_auth_codes
       (code, client_id, user_id, redirect_uri,
        code_challenge, code_challenge_method, scope, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now() + ($8 || ' seconds')::interval)`,
    [
      code,
      client_id,
      user_id,
      redirect_uri,
      code_challenge,
      code_challenge_method,
      scope,
      String(DUREE_CODE_SEC),
    ],
  );
  return code;
}

type AuthCode = {
  client_id: string;
  user_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string;
};

// Consomme un code OAuth (UPDATE conditionnel sur consumed_at IS NULL
// pour que le replay soit détectable : si l'UPDATE n'écrit rien, le
// code n'existe pas, est déjà consommé, ou est expiré). En cas de
// replay sur un code consommé, on révoque toute la chaîne de tokens
// issus de la même authorization (RFC 6749 §10.5).
export async function consommerAuthCode(
  code: string,
): Promise<AuthCode | { replay: true; client_id: string; user_id: string } | null> {
  const rows = await query<AuthCode>(
    `UPDATE oauth_auth_codes SET consumed_at = now()
      WHERE code = $1 AND consumed_at IS NULL AND expires_at > now()
      RETURNING client_id, user_id, redirect_uri,
                code_challenge, code_challenge_method, scope`,
    [code],
  );
  if (rows[0]) return rows[0];

  const etat = await query<{
    consumed_at: string | null;
    client_id: string;
    user_id: string;
  }>(
    `SELECT consumed_at::text AS consumed_at, client_id, user_id
       FROM oauth_auth_codes WHERE code = $1`,
    [code],
  );
  if (etat[0]?.consumed_at) {
    return {
      replay: true,
      client_id: etat[0].client_id,
      user_id: etat[0].user_id,
    };
  }
  return null;
}

// Révoque toute la chaîne de tokens d'un client pour un user. Appelée
// sur détection d'un replay (code ou refresh) : les tokens vivants
// deviennent inopérants et l'application devra redemander un
// consentement.
export async function revoquerChaineUserClient(
  client_id: string,
  user_id: string,
): Promise<void> {
  await revoquerChaine(client_id, user_id);
}

export function verifierPkce(
  verifier: string,
  challenge: string,
  method: string,
): boolean {
  if (method !== "S256") return false;
  const attendu = createHash("sha256").update(verifier).digest("base64url");
  return attendu === challenge;
}

// -------- Access + refresh tokens --------

export type TokenPaire = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export async function emettrePaire(
  client_id: string,
  user_id: string,
  scope: string,
): Promise<TokenPaire> {
  const access = PREFIXE_ACCES + randomUrl(32);
  const refresh = PREFIXE_REFRESH + randomUrl(32);
  await query(
    `INSERT INTO oauth_access_tokens
       (token_hash, client_id, user_id, scope, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' seconds')::interval)`,
    [hash(access), client_id, user_id, scope, String(DUREE_ACCES_SEC)],
  );
  await query(
    `INSERT INTO oauth_refresh_tokens
       (token_hash, client_id, user_id, scope, expires_at)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' seconds')::interval)`,
    [hash(refresh), client_id, user_id, scope, String(DUREE_REFRESH_SEC)],
  );
  return {
    access_token: access,
    refresh_token: refresh,
    expires_in: DUREE_ACCES_SEC,
  };
}

type RefreshRow = {
  client_id: string;
  user_id: string;
  scope: string;
};

// Rotation : UPDATE conditionnel sur consumed_at IS NULL (idempotent et
// atomique). Si l'UPDATE n'écrit rien, on regarde ce que la ligne contient
// pour distinguer trois cas :
// - inconnue : invalid_grant (silencieux)
// - déjà consommée : REPLAY détecté, on révoque toute la chaîne (RFC 6749
//   §10.5) et on refuse ;
// - révoquée ou expirée : invalid_grant.
export async function utiliserRefresh(
  refresh: string,
  client_id: string,
): Promise<TokenPaire | { erreur: string }> {
  const token_hash = hash(refresh);
  const rows = await query<RefreshRow>(
    `UPDATE oauth_refresh_tokens SET consumed_at = now()
      WHERE token_hash = $1 AND client_id = $2
        AND consumed_at IS NULL
        AND revoked_at IS NULL
        AND expires_at > now()
      RETURNING client_id, user_id, scope`,
    [token_hash, client_id],
  );
  if (rows[0]) {
    return emettrePaire(rows[0].client_id, rows[0].user_id, rows[0].scope);
  }

  // Pas d'écriture : on inspecte la cause pour détecter un replay.
  const etat = await query<{
    consumed_at: string | null;
    revoked_at: string | null;
    expired: boolean;
    user_id: string;
  }>(
    `SELECT consumed_at::text AS consumed_at,
            revoked_at::text AS revoked_at,
            (expires_at < now()) AS expired,
            user_id
       FROM oauth_refresh_tokens
      WHERE token_hash = $1 AND client_id = $2`,
    [token_hash, client_id],
  );
  if (etat[0] && etat[0].consumed_at && !etat[0].revoked_at) {
    await revoquerChaine(client_id, etat[0].user_id);
  }
  return { erreur: "invalid_grant" };
}

async function revoquerChaine(client_id: string, user_id: string): Promise<void> {
  await query(
    `UPDATE oauth_access_tokens SET revoked_at = now()
      WHERE client_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [client_id, user_id],
  );
  await query(
    `UPDATE oauth_refresh_tokens SET revoked_at = now()
      WHERE client_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [client_id, user_id],
  );
}

// Résout un access token en user_id (côté lib/auth.ts). Pose aussi
// last_used_at pour aider à repérer les clients orphelins.
export async function utilisateurPourAcces(
  access_token: string,
): Promise<string | null> {
  if (!access_token.startsWith(PREFIXE_ACCES)) return null;
  const rows = await query<{ user_id: string }>(
    `UPDATE oauth_access_tokens SET last_used_at = now()
      WHERE token_hash = $1
        AND revoked_at IS NULL
        AND expires_at > now()
      RETURNING user_id`,
    [hash(access_token)],
  );
  return rows[0]?.user_id ?? null;
}

// -------- Sessions utilisateur (pour /app/profil/api) --------

export type SessionOAuth = {
  client_id: string;
  client_name: string;
  derniere_utilisation: string | null;
  depuis: string;
};

export async function sessionsPourUser(user_id: string): Promise<SessionOAuth[]> {
  return query<SessionOAuth>(
    `SELECT c.client_id, c.client_name,
            max(a.last_used_at)::text AS derniere_utilisation,
            min(a.created_at)::text AS depuis
       FROM oauth_access_tokens a
       JOIN oauth_clients c ON c.client_id = a.client_id
      WHERE a.user_id = $1 AND a.revoked_at IS NULL
      GROUP BY c.client_id, c.client_name
      ORDER BY max(a.last_used_at) DESC NULLS LAST`,
    [user_id],
  );
}

export async function revoquerSession(
  user_id: string,
  client_id: string,
): Promise<void> {
  await revoquerChaine(client_id, user_id);
}
