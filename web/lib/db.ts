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
       ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name text NOT NULL DEFAULT '';
       ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name  text NOT NULL DEFAULT '';
       -- Migration de l'ancien champ unique "name" (prénom + nom collés).
       DO $$ BEGIN
         IF EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name = 'users' AND column_name = 'name') THEN
           UPDATE users SET
             first_name = split_part(name, ' ', 1),
             last_name  = ltrim(substring(name FROM length(split_part(name, ' ', 1)) + 1))
           WHERE name <> '' AND first_name = '' AND last_name = '';
           ALTER TABLE users DROP COLUMN name;
         END IF;
       END $$;
       -- Photo de profil : data URL (image réduite côté client), NULL sinon.
       ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar text;
       -- Identifiant du compte chez Clerk, qui porte désormais l'identité
       -- (mot de passe, session, connexion). La table users reste l'autorité
       -- sur QUI a le droit d'entrer et avec quel rôle : un compte Clerk sans
       -- ligne ici est refusé. Le lien se fait par e-mail à la première
       -- connexion, pour que les comptes existants soient repris sans perdre
       -- leurs produits, leurs sujets ni leur historique.
       ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id text;
       CREATE UNIQUE INDEX IF NOT EXISTS users_clerk_id_idx ON users (clerk_id);
       -- Le mot de passe n'est plus stocké ici : Clerk s'en charge. La
       -- colonne reste le temps de la bascule, sans plus être alimentée.
       ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
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
       -- Logo de projet : data URL (image réduite côté client), NULL =
       -- première lettre du nom. Les anciens couleur/emoji sont retirés.
       ALTER TABLE projects ADD COLUMN IF NOT EXISTS logo text;
       ALTER TABLE projects DROP COLUMN IF EXISTS color;
       ALTER TABLE projects DROP COLUMN IF EXISTS icon;
       -- L'avancement du projet se calcule depuis les poids des sujets
       -- terminés : plus de jalons stockés sur le projet.
       ALTER TABLE projects DROP COLUMN IF EXISTS jalon_tech;
       ALTER TABLE projects DROP COLUMN IF EXISTS jalon_business;
       -- Déployable : information affirmée, jamais devinée. Ni l'analyse de
       -- réunion ni l'avancement ne la déduisent ; elle vient d'une annonce
       -- explicite en réunion (validée à l'import) ou d'un clic sur la fiche.
       ALTER TABLE projects ADD COLUMN IF NOT EXISTS deployable boolean NOT NULL
         DEFAULT false;
       CREATE TABLE IF NOT EXISTS project_members (
         project_id     bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
         user_id        bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         is_responsable boolean NOT NULL DEFAULT false,
         added_at       timestamptz NOT NULL DEFAULT now(),
         PRIMARY KEY (project_id, user_id)
       );
       CREATE TABLE IF NOT EXISTS sujets (
         id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
         -- NULL = sujet transverse : une tâche ou une mission qui ne relève
         -- d'aucun produit. Elle ne pèse sur aucun axe (les requêtes
         -- d'avancement filtrent sur project_id = p.id) et se lit dans sa
         -- propre section.
         project_id     bigint REFERENCES projects(id) ON DELETE CASCADE,
         title          text NOT NULL,
         action         text NOT NULL DEFAULT '',
         due_date       date,
         type           text NOT NULL DEFAULT 'technique'
           CHECK (type IN ('technique', 'business')),
         poids          int NOT NULL DEFAULT 0
           CHECK (poids BETWEEN 0 AND 100),
         criticite      text NOT NULL DEFAULT 'normale'
           CHECK (criticite IN ('critique', 'haute', 'normale', 'faible')),
         etat           text NOT NULL DEFAULT 'a_faire'
           CHECK (etat IN ('a_faire', 'en_cours', 'bloque', 'en_validation', 'termine')),
         commentaire    text NOT NULL DEFAULT '',
         created_at     timestamptz NOT NULL DEFAULT now(),
         updated_at     timestamptz NOT NULL DEFAULT now()
       );
       CREATE INDEX IF NOT EXISTS sujets_project_idx ON sujets (project_id);
       -- Bases existantes : la colonne était obligatoire avant les sujets
       -- transverses.
       ALTER TABLE sujets ALTER COLUMN project_id DROP NOT NULL;
       -- Le responsable est porté par le projet, pas par le sujet.
       ALTER TABLE sujets DROP COLUMN IF EXISTS responsable_id;
       -- Chaque sujet est typé et pèse un pourcentage du projet.
       ALTER TABLE sujets ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'technique'
         CHECK (type IN ('technique', 'business'));
       ALTER TABLE sujets ADD COLUMN IF NOT EXISTS poids int NOT NULL DEFAULT 0
         CHECK (poids BETWEEN 0 AND 100);
       -- Porteur de l'action de la semaine (membre du projet, optionnel).
       ALTER TABLE sujets ADD COLUMN IF NOT EXISTS porteur_id bigint
         REFERENCES users(id) ON DELETE SET NULL;
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
       CREATE INDEX IF NOT EXISTS sujet_history_sujet_idx ON sujet_history (sujet_id);
       -- Provenance d'une écriture : saisie manuelle ou import de réunion.
       ALTER TABLE sujet_history ADD COLUMN IF NOT EXISTS source text NOT NULL
         DEFAULT 'manuel';
       -- Dépôt d'un transcript. project_id NULL = portée portefeuille ;
       -- renseigné = portée produit, les propositions ne peuvent pas en sortir.
       CREATE TABLE IF NOT EXISTS reunion_imports (
         id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
         project_id   bigint REFERENCES projects(id) ON DELETE CASCADE,
         date_reunion date NOT NULL,
         transcript   text NOT NULL,
         propositions jsonb NOT NULL DEFAULT '[]'::jsonb,
         ecartes      jsonb NOT NULL DEFAULT '[]'::jsonb,
         deploiements jsonb NOT NULL DEFAULT '[]'::jsonb,
         statut       text NOT NULL DEFAULT 'a_verifier'
           CHECK (statut IN ('a_verifier', 'applique', 'abandonne')),
         created_by   bigint REFERENCES users(id) ON DELETE SET NULL,
         created_at   timestamptz NOT NULL DEFAULT now(),
         applied_at   timestamptz
       );
       CREATE INDEX IF NOT EXISTS reunion_imports_statut_idx
         ON reunion_imports (statut, project_id);
       -- Annonces de déployabilité relevées dans un compte rendu, en attente
       -- de validation humaine (table créée avant l'ajout de la colonne).
       ALTER TABLE reunion_imports ADD COLUMN IF NOT EXISTS deploiements jsonb
         NOT NULL DEFAULT '[]'::jsonb;
       -- Lexique : un terme entendu en réunion vers un produit ou un sujet.
       -- Alimenté quand l'utilisateur corrige la cible d'une proposition.
       CREATE TABLE IF NOT EXISTS lexique (
         id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
         terme      text NOT NULL,
         cible_type text NOT NULL CHECK (cible_type IN ('projet', 'sujet')),
         cible_id   bigint NOT NULL,
         created_by bigint REFERENCES users(id) ON DELETE SET NULL,
         created_at timestamptz NOT NULL DEFAULT now()
       );
       CREATE UNIQUE INDEX IF NOT EXISTS lexique_terme_idx
         ON lexique (lower(terme), cible_type);
       -- Correspondance entre un nom de locuteur Fireflies et un compte.
       CREATE TABLE IF NOT EXISTS locuteurs (
         id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
         nom        text NOT NULL,
         user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         created_at timestamptz NOT NULL DEFAULT now()
       );
       CREATE UNIQUE INDEX IF NOT EXISTS locuteurs_nom_idx ON locuteurs (lower(nom));
       -- Réunion hebdomadaire clôturée. Une réunion se tient souvent sans
       -- import de transcript : sans cette table, l'avancement de la
       -- semaine se datait du dernier import, pas de la dernière réunion.
       CREATE TABLE IF NOT EXISTS reunions (
         id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
         tenue_le     date NOT NULL DEFAULT current_date,
         cloturee_par bigint REFERENCES users(id) ON DELETE SET NULL,
         created_at   timestamptz NOT NULL DEFAULT now()
       );
       -- Une seule réunion par jour : reclôturer le même jour corrige la
       -- précédente au lieu d'en empiler une deuxième.
       CREATE UNIQUE INDEX IF NOT EXISTS reunions_jour_idx ON reunions (tenue_le);
       -- Périmètre GELÉ de la semaine : les sujets qui portaient une action
       -- au moment de la clôture, avec leur état à cet instant. Gelé et non
       -- recalculé, pour deux raisons : une action oubliée sur un vieux
       -- sujet n'entre pas dans la semaine, et l'état enregistré donne le
       -- point de départ auquel comparer la semaine suivante.
       CREATE TABLE IF NOT EXISTS reunion_engagements (
         reunion_id bigint NOT NULL REFERENCES reunions(id) ON DELETE CASCADE,
         sujet_id   bigint NOT NULL REFERENCES sujets(id) ON DELETE CASCADE,
         project_id bigint REFERENCES projects(id) ON DELETE CASCADE,
         action     text NOT NULL,
         etat       text NOT NULL,
         PRIMARY KEY (reunion_id, sujet_id)
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
