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
       CREATE TABLE IF NOT EXISTS sessions (
         token_hash text PRIMARY KEY,
         user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         expires_at timestamptz NOT NULL,
         created_at timestamptz NOT NULL DEFAULT now()
       );
       CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);`,
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
