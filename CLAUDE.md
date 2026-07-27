# Jiska

Application web en démarrage. Stack décidée par Matthieu : **Next.js** en front, **PostgreSQL** en back. Le périmètre fonctionnel reste à définir — pour l'instant seul le portail de login existe.

## Organisation

- Tout le code vit dans `web/` (Next.js 16, App Router, TypeScript, Tailwind 4) — jamais à la racine.
- `deploy/` : Dockerfile (build `output: "standalone"`) + docker-compose.yml — service `jiska-app` (`:80`, réseaux `web` + `back`) et `jiska-db` (PostgreSQL 17, réseau interne `back` uniquement, volume `jiska-db-data`).
- Secrets dans `deploy/.env` (jamais commité, modèle dans `.env.example`).
- Le HTTPS public passe par le Caddy global (`/home/projet/caddy`), pas par ce projet.
- Le dossier appartient au groupe `devs` (matthieu + tao) : conserver le setgid et les droits d'écriture groupe.

## État actuel / à faire

- `/login` : portail de connexion (client component), POST vers `/api/auth/login`.
- `/api/auth/login` : stub qui répond 501 — à brancher sur PostgreSQL (table `users`, hachage argon2/bcrypt, session cookie httpOnly). `DATABASE_URL` est déjà injectée par docker-compose.
- Node sur le VPS : via nvm (utilisateur matthieu), Node 24 LTS — charger avec `. ~/.nvm/nvm.sh` dans les scripts non interactifs.

## Git

- Identité : Matthieu <evolytics.services@gmail.com> (configurée par dépôt).
- Git local seulement pour l'instant, pas de remote.
