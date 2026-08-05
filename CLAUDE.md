# Jiska

Outil de **pilotage hebdomadaire** des projets (PRD de Matthieu). Accueil `/app` : la vue **Projets** (cartes). Page **Actions** (`/app/actions`) : bandeau d'indicateurs, filtres limités, tableau une-ligne-un-sujet, mise à jour en fiche/modale pendant la réunion. Stack : **Next.js** en front, **PostgreSQL** en back.

## Organisation

- Tout le code vit dans `web/` (Next.js 16, App Router, TypeScript, Tailwind 4) — jamais à la racine.
- `deploy/` : Dockerfile (build `output: "standalone"`, `HOSTNAME=0.0.0.0` obligatoire) + docker-compose.yml — `jiska-app` (`:80`, réseaux `web` + `back`) et `jiska-db` (PostgreSQL 17, réseau `back` uniquement).
- Secrets dans `deploy/.env` (jamais commité). HTTPS public via le Caddy global (`/home/projet/caddy`), domaine `jiska.duckdns.org`.
- Le dossier appartient au groupe `devs` (matthieu + tao) : conserver le setgid et les droits d'écriture groupe.

## Règles UI

- **Aucun contrôle au style natif du navigateur** : selects, menus, pickers… sont des composants maison stylés selon la DA (réf. : `web/app/app/select.tsx`, `user-menu.tsx`). Tout `<select>` natif restant est à remplacer au fil de l'eau.
- **Tiret cadratin (—) strictement interdit sur la plateforme** : zéro occurrence, dans les textes UI comme dans le code de `web/`. Utiliser « : », « · », des parenthèses, ou « - » comme valeur vide.
- DA inspirée de Revolut en thème clair : blanc pur, texte encre, ombres légères (`shadow-card`) plutôt que contours appuyés, angles peu arrondis (`rounded-lg`/`md`), bleu du logo (`brand`) en accent, couleurs sémantiques définies dans `globals.css`. Jetons centralisés dans `globals.css`, vocabulaire métier dans `web/lib/sujets.ts`.
- Le dashboard `/app` doit tenir dans le viewport : seul le tableau scrolle (en interne).

## Métier (PRD)

- Rôles : `dirigeant` (voit tout, gère comptes et projets) / `collaborateur` ; un responsable par projet (crée des sujets de son projet, pas de projets).
- Sujets : typés `technique` ou `business`, avec un **poids en %** du projet et un **porteur d'action** optionnel (membre du projet, peut éditer son sujet). Avancement d'un axe = somme des poids crédités (terminé = 100 % du poids, en validation = 50 %), plafonnée à 100 ; global = technique × 60 % + business × 40 %. Objectif : 100 % attribués par axe (budget affiché à la saisie, alerte si dépassement). Historique conservé en base (`sujet_history`), non affiché.

## Git

- Identité : Matthieu <evolytics.services@gmail.com> (configurée par dépôt). Remote : `origin` = https://github.com/skapa2-0/jiska (branche `main`), pousser après chaque commit.
- Committer systématiquement après chaque ensemble cohérent de changements (demande de Matthieu), messages en français.
