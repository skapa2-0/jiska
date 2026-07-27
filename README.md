# Jiska

Application web — front Next.js, base PostgreSQL.

## Structure

- `web/` — app Next.js 16 (App Router, TypeScript, Tailwind 4)
  - `app/login/` — portail de connexion
  - `app/api/auth/login/` — endpoint d'authentification (stub, PostgreSQL à brancher)
- `deploy/` — Dockerfile (build standalone) + docker-compose.yml (app + PostgreSQL 17)
- `.claude/` — configuration Claude Code du projet

## Développement

```bash
cd web
npm install
npm run dev   # http://localhost:3000 (redirige vers /login)
```

## Déploiement

L'app écoute en `:80` sur le réseau Docker `web` ; le HTTPS public sera géré
par le Caddy global (`/home/projet/caddy`) quand le domaine sera choisi.
PostgreSQL reste sur le réseau interne `back`, jamais exposé.

```bash
cd deploy
cp .env.example .env   # puis choisir un vrai mot de passe
docker compose up -d --build
```
