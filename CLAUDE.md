# Jiska

Projet en démarrage — le contenu et le type de projet restent à définir avec Matthieu.

## Organisation

- Tout le code/contenu va dans `web/` (jamais à la racine).
- La config de déploiement vit dans `deploy/` : Caddyfile interne (`:80`) + docker-compose.yml sur le réseau Docker externe `web`.
- Le HTTPS public passe par le Caddy global (`/home/projet/caddy`), pas par ce projet.
- Le dossier appartient au groupe `devs` (matthieu + tao) : conserver le setgid et les droits d'écriture groupe sur tout nouveau fichier.

## Git

- Identité : Matthieu <evolytics.services@gmail.com> (configurée par dépôt).
- Git local seulement pour l'instant, pas de remote.
