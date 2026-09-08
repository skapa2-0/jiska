# Jiska

Outil de **pilotage hebdomadaire** des produits (PRD de Matthieu). Accueil `/app` : la vue **Produits** (cartes, routes `/app/produits/*`). Page **Actions** (`/app/actions`) : bandeau d'indicateurs, filtres limités, tableau une-ligne-un-sujet, mise à jour en fiche/modale pendant la réunion. Stack : **Next.js** en front, **PostgreSQL** en back.

**Vocabulaire** : dans l'UI on dit **produit** (ex-« projet », renommé) ; le code et la base gardent `project`/`projet` (tables `projects`, `project_members`, composants `projet-*`). Ne pas « corriger » l'un vers l'autre.

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

- **Authentification : Clerk porte l'identité, Jiska garde l'autorisation.** Clerk gère connexion, mot de passe et sessions ; la table `users` (colonne `clerk_id`) reste l'autorité sur qui entre et avec quel rôle. Un compte Clerk sans ligne locale est refusé, et `/login` le dit au lieu de rediriger (sinon : boucle `/app` ↔ `/login`). Le lien se fait par e-mail à la première connexion. Création de compte = ligne locale + invitation Clerk (`/api/users`, dirigeants). Ne jamais dupliquer les rôles côté Clerk : pas d'Organizations.
- Rôles : `dirigeant` (voit tout, gère comptes et projets) / `collaborateur` ; un responsable par projet (crée des sujets de son projet, pas de projets).
- Sujets : typés `technique` ou `business`, avec un **poids en %** du projet et un **porteur d'action** optionnel (membre du projet, peut éditer son sujet). Avancement d'un axe = somme des poids crédités (terminé = 100 % du poids, en validation = 50 %), plafonnée à 100 ; global = technique × 60 % + business × 40 %. Objectif : 100 % attribués par axe (budget affiché à la saisie, alerte si dépassement). Historique conservé en base (`sujet_history`), non affiché.
- **Deux mesures distinctes, qui ne se remplacent pas** (`lib/semaine.ts`) : l'avancement produit ci-dessus répond « où en est ce produit », l'**avancement de la semaine** répond « a-t-on fait ce qu'on avait dit ». Périmètre de la semaine = les engagements **gelés** à la dernière clôture de réunion (`reunion_engagements`), avec l'état de départ auquel comparer ; à défaut de clôture, repli sur les sujets portant une action aujourd'hui (`action <> ''`). Clôturer se fait en fin de revue (`POST /api/reunions`, dirigeants) : ça pose la date et gèle le périmètre, ça n'efface aucune action. Échelle propre (à faire 0, en cours 33, bloqué 0 et signalé, en validation 66, terminé 100), volontairement différente de `CREDIT_ETAT`. Aucune saisie supplémentaire : la mesure se déduit des états. Zéro engagement ≠ 0 % : l'afficher comme tel est un contresens.
- **Sujets transverses** : `sujets.project_id` NULL = tâche ou mission ne relevant d'aucun produit. Visibles de tous, créés et supprimés par les dirigeants seuls, modifiables aussi par leur porteur. Ni poids ni axe : les requêtes d'avancement filtrent sur `project_id = p.id`, ils n'entrent donc dans aucun pourcentage produit. Listés sous la grille de `/app`, présents dans le tableau Actions sous le libellé `NOM_TRANSVERSE`, et revus en dernière étape du mode réunion (étape sans roue, sans axes ni poids). L'import de réunion peut en proposer (`project_id` null), seulement en portée portefeuille.
- **Déployable** : état affirmé d'un produit (annonce explicite en réunion validée à l'import, ou marquage sur la fiche). Jamais déduit de l'avancement. Marquage ouvert aux dirigeants et au responsable du produit.

## Git

- Identité : Matthieu <evolytics.services@gmail.com> (configurée par dépôt). Remote : `origin` = https://github.com/skapa2-0/jiska (branche `main`), pousser après chaque commit.
- Committer systématiquement après chaque ensemble cohérent de changements (demande de Matthieu), messages en français.
