# Jiska

Nouveau projet — contenu à définir.

## Structure

- `web/` — contenu / code du projet
- `deploy/` — configuration de déploiement (Caddyfile + docker-compose.yml)
- `.claude/` — configuration Claude Code du projet

## Déploiement

Le conteneur écoute en `:80` sur le réseau Docker `web`. Le HTTPS public
est géré par le Caddy global (`/home/projet/caddy`) — y ajouter le bloc
du domaine quand il sera choisi.

```bash
cd deploy
docker compose up -d
```
