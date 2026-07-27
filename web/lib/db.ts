import { Pool } from "pg";

// Pool unique par processus (DATABASE_URL fournie par deploy/docker-compose.yml).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let schemaReady: Promise<void> | null = null;

// Crée le schéma au premier accès ; idempotent, pas encore de vraie
// migration tant que le modèle reste aussi petit.
function ensureSchema(): Promise<void> {
  schemaReady ??= pool
    .query(
      `CREATE TABLE IF NOT EXISTS users (
         id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
         email         text NOT NULL UNIQUE,
         password_hash text NOT NULL,
         created_at    timestamptz NOT NULL DEFAULT now()
       );
       ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL
         DEFAULT 'collaborateur' CHECK (role IN ('dirigeant', 'collaborateur'));
       CREATE TABLE IF NOT EXISTS sessions (
         token_hash text PRIMARY KEY,
         user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         expires_at timestamptz NOT NULL,
         created_at timestamptz NOT NULL DEFAULT now()
       );
       CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
       CREATE TABLE IF NOT EXISTS projects (
         id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
         name        text NOT NULL,
         description text NOT NULL DEFAULT '',
         created_by  bigint REFERENCES users(id) ON DELETE SET NULL,
         created_at  timestamptz NOT NULL DEFAULT now()
       );
       CREATE TABLE IF NOT EXISTS project_members (
         project_id     bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
         user_id        bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         is_responsable boolean NOT NULL DEFAULT false,
         added_at       timestamptz NOT NULL DEFAULT now(),
         PRIMARY KEY (project_id, user_id)
       );`,
    )
    .then(() => undefined);
  return schemaReady;
}

export async function query<Row extends Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<Row[]> {
  await ensureSchema();
  const result = await pool.query(text, params);
  return result.rows as Row[];
}
