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
       ALTER TABLE projects ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#4b4ee9';
       ALTER TABLE projects ADD COLUMN IF NOT EXISTS icon  text NOT NULL DEFAULT '📁';
       CREATE TABLE IF NOT EXISTS project_members (
         project_id     bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
         user_id        bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         is_responsable boolean NOT NULL DEFAULT false,
         added_at       timestamptz NOT NULL DEFAULT now(),
         PRIMARY KEY (project_id, user_id)
       );
       CREATE TABLE IF NOT EXISTS sujets (
         id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
         project_id     bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
         title          text NOT NULL,
         responsable_id bigint REFERENCES users(id) ON DELETE SET NULL,
         action         text NOT NULL DEFAULT '',
         due_date       date,
         jalon_tech     int NOT NULL DEFAULT 0
           CHECK (jalon_tech IN (0, 25, 50, 75, 100)),
         jalon_business int NOT NULL DEFAULT 0
           CHECK (jalon_business IN (0, 25, 50, 75, 100)),
         criticite      text NOT NULL DEFAULT 'normale'
           CHECK (criticite IN ('critique', 'haute', 'normale', 'faible')),
         etat           text NOT NULL DEFAULT 'a_faire'
           CHECK (etat IN ('a_faire', 'en_cours', 'bloque', 'en_validation', 'termine')),
         commentaire    text NOT NULL DEFAULT '',
         created_at     timestamptz NOT NULL DEFAULT now(),
         updated_at     timestamptz NOT NULL DEFAULT now()
       );
       CREATE INDEX IF NOT EXISTS sujets_project_idx ON sujets (project_id);
       -- Historique conservé mais jamais affiché dans le tableau (PRD §11) ;
       -- sert aussi à l'indicateur « actions clôturées depuis la réunion ».
       CREATE TABLE IF NOT EXISTS sujet_history (
         id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
         sujet_id   bigint NOT NULL REFERENCES sujets(id) ON DELETE CASCADE,
         changed_by bigint REFERENCES users(id) ON DELETE SET NULL,
         changed_at timestamptz NOT NULL DEFAULT now(),
         field      text NOT NULL,
         old_value  text,
         new_value  text
       );
       CREATE INDEX IF NOT EXISTS sujet_history_sujet_idx ON sujet_history (sujet_id);`,
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
