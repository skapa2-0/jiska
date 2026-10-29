// Documentation des endpoints de l'API Jiska, destinée à la page
// /app/profil/api. Pensée pour être exacte : chaque entrée reflète ce que
// la route accepte réellement (voir web/app/api/**). Le niveau d'accès
// (`acces`) sert à filtrer ce que chaque utilisateur voit : on ne lui
// montre que ce qu'il peut appeler avec son propre jeton.
//
// Si une route change, mettre à jour cette liste en même temps : c'est
// la source d'onboarding pour les clients de l'API.

import type { Role } from "@/lib/roles";

export type NiveauAcces =
  | "connecte" // tout utilisateur avec un jeton valide
  | "membre-produit" // doit être membre du produit visé (ou admin)
  | "admin" // dirigeant ou developeur
  | "developeur"; // developeur uniquement (tickets)

export type Endpoint = {
  methode: "GET" | "POST" | "PATCH" | "DELETE";
  chemin: string;
  titre: string;
  description: string;
  acces: NiveauAcces;
  // Rôle minimum pour voir l'endpoint dans la doc. « null » = tout le monde.
  // Pour « membre-produit », un collaborateur voit l'endpoint (il peut
  // être membre), c'est à l'exécution que la vérification tombe.
  payload?: string; // JSON exemple (chaîne lisible)
  reponse?: string; // JSON exemple
  curl?: string; // exemple curl prêt à copier (le token sera substitué dans le composant)
  notes?: string[];
};

// Catégories utilisées pour grouper visuellement la doc.
export type Categorie = {
  cle: string;
  titre: string;
  description: string;
  endpoints: Endpoint[];
};

export const CATEGORIES: Categorie[] = [
  {
    cle: "profil",
    titre: "Profil courant",
    description: "Ce que l'identité derrière le jeton peut voir ou modifier d'elle-même.",
    endpoints: [
      {
        methode: "GET",
        chemin: "/api/me",
        titre: "Lire son profil",
        description:
          "Renvoie l'utilisateur dont le jeton est utilisé (identifiant, nom, e-mail, rôle, avatar).",
        acces: "connecte",
        reponse: `{
  "user": {
    "id": "3",
    "email": "camille@exemple.fr",
    "first_name": "Camille",
    "last_name": "Durand",
    "role": "collaborateur",
    "avatar": null
  }
}`,
        curl: `curl https://jiska.skapa.design/api/me \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`,
      },
      {
        methode: "PATCH",
        chemin: "/api/me",
        titre: "Mettre à jour son profil",
        description:
          "Modifie prénom, nom, adresse e-mail ou photo de profil. Tous les champs sont optionnels : seuls ceux fournis sont écrits.",
        acces: "connecte",
        payload: `{
  "firstName": "Camille",
  "lastName": "Durand",
  "email": "camille@exemple.fr",
  "avatar": "data:image/webp;base64,...."
}`,
        reponse: `{ "ok": true }`,
        curl: `curl -X PATCH https://jiska.skapa.design/api/me \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"firstName":"Camille","lastName":"Durand"}'`,
        notes: [
          "`avatar` : data URL JPEG, PNG ou WebP, 300 Ko maximum une fois réduite ; envoyer `null` pour la retirer.",
          "`email` doit être unique (sinon 409).",
        ],
      },
      {
        methode: "DELETE",
        chemin: "/api/me/sessions/{client_id}",
        titre: "Révoquer une application autorisée",
        description:
          "Coupe tous les access tokens et refresh tokens actifs d'un client OAuth pour la personne connectée. L'application devra redemander un consentement.",
        acces: "connecte",
        reponse: `{ "ok": true }`,
        curl: `curl -X DELETE https://jiska.skapa.design/api/me/sessions/jska_cl_xxxxxxxx \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`,
      },
    ],
  },
  {
    cle: "produits",
    titre: "Produits",
    description: "Fiche produit (ex-« projet » en interne), ses membres et son état déployable.",
    endpoints: [
      {
        methode: "GET",
        chemin: "/api/projects",
        titre: "Lister les produits",
        description:
          "Renvoie les produits visibles par l'utilisateur avec leurs membres (dirigeant/developeur : tous ; collaborateur : ceux dont il est membre).",
        acces: "connecte",
        reponse: `{
  "projects": [
    {
      "id": "42",
      "name": "Jiska",
      "description": "Pilotage hebdo",
      "logo": "/api/logos/42?v=a1b2c3d4",
      "logo_rounded": true,
      "deployable": false,
      "created_at": "2026-09-01 10:00:00+00",
      "members": [
        { "id": "3", "email": "camille@exemple.fr", "first_name": "Camille", "last_name": "Durand", "is_responsable": true }
      ]
    }
  ]
}`,
        curl: `curl https://jiska.skapa.design/api/projects \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`,
      },
      {
        methode: "GET",
        chemin: "/api/projects/{id}",
        titre: "Détail d'un produit",
        description:
          "Fiche complète avec membres, résumé IA et date de dernier résumé. Réservé aux membres du produit (admin inclus).",
        acces: "membre-produit",
        reponse: `{
  "project": {
    "id": "42",
    "name": "Jiska",
    "description": "...",
    "logo": "/api/logos/42?v=...",
    "logo_rounded": true,
    "deployable": false,
    "created_at": "...",
    "resume_ia": "...",
    "resume_ia_date": "2026-10-21",
    "members": [ ... ]
  }
}`,
        curl: `curl https://jiska.skapa.design/api/projects/42 \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`,
      },
      {
        methode: "POST",
        chemin: "/api/projects",
        titre: "Créer un produit",
        description:
          "Crée un produit avec ses membres et un responsable désigné parmi eux. Ouvert à toute personne connectée.",
        acces: "connecte",
        payload: `{
  "name": "Jiska",
  "description": "Pilotage hebdo",
  "memberIds": ["3", "7"],
  "responsableId": "3",
  "logo": "data:image/png;base64,...",
  "logoRounded": true
}`,
        reponse: `{ "ok": true, "id": "42" }`,
        curl: `curl -X POST https://jiska.skapa.design/api/projects \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Jiska","memberIds":["3","7"],"responsableId":"3"}'`,
        notes: [
          "`memberIds` doit contenir au moins un identifiant.",
          "`responsableId` doit figurer dans `memberIds`.",
          "`logo` facultatif : data URL JPEG, PNG ou WebP, 300 Ko max.",
        ],
      },
      {
        methode: "PATCH",
        chemin: "/api/projects/{id}",
        titre: "Modifier un produit",
        description:
          "Met à jour nom, description, logo, membres ou responsable. Réservé aux membres du produit (ou dirigeant/developeur).",
        acces: "membre-produit",
        payload: `{
  "name": "Jiska 2",
  "description": "Nouvelle description",
  "logo": null,
  "logoRounded": false,
  "memberIds": ["3", "7", "9"],
  "responsableId": "7"
}`,
        reponse: `{ "ok": true }`,
        curl: `curl -X PATCH https://jiska.skapa.design/api/projects/42 \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Jiska 2"}'`,
      },
      {
        methode: "DELETE",
        chemin: "/api/projects/{id}",
        titre: "Supprimer un produit",
        description:
          "Supprime un produit et tout ce qu'il porte (sujets, membres, historique). Destructif, réservé aux admins.",
        acces: "admin",
        reponse: `{ "ok": true }`,
        curl: `curl -X DELETE https://jiska.skapa.design/api/projects/42 \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`,
      },
      {
        methode: "PATCH",
        chemin: "/api/projects/{id}/deployable",
        titre: "Marquer un produit déployable",
        description:
          "Pose ou retire l'état « déployable » du produit. Réservé aux membres du produit (ou admin).",
        acces: "membre-produit",
        payload: `{ "deployable": true }`,
        reponse: `{ "ok": true, "deployable": true }`,
        curl: `curl -X PATCH https://jiska.skapa.design/api/projects/42/deployable \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"deployable":true}'`,
      },
    ],
  },
  {
    cle: "sujets",
    titre: "Sujets",
    description:
      "Sujets d'un produit (ou transverses, `project_id` à null). Un sujet porte une action, un état, une criticité, un porteur.",
    endpoints: [
      {
        methode: "GET",
        chemin: "/api/sujets",
        titre: "Lister les sujets",
        description:
          "Liste les sujets visibles. Filtres optionnels en query : `projectId`, `transverse=1`, `etat`, `type`, `criticite`, `porteurId`, `dueBefore`, `dueAfter`, `search`.",
        acces: "connecte",
        reponse: `{
  "sujets": [
    {
      "id": "128",
      "project_id": "42",
      "project_name": "Jiska",
      "title": "Migrer la base",
      "action": "Lancer le dump de prod",
      "due_date": "2026-11-10",
      "type": "technique",
      "porteur_id": "3",
      "criticite": "haute",
      "etat": "a_faire",
      "commentaire": "",
      "updated_at": "..."
    }
  ]
}`,
        curl: `curl "https://jiska.skapa.design/api/sujets?etat=en_cours&porteurId=3" \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`,
        notes: [
          "`etat` : a_faire, en_cours, bloque, en_validation, termine.",
          "`type` : technique, business. `criticite` : critique, haute, normale, faible.",
          "Dates : AAAA-MM-JJ. `search` cherche en partiel dans le titre et l'action.",
        ],
      },
      {
        methode: "GET",
        chemin: "/api/sujets/{id}",
        titre: "Détail d'un sujet",
        description:
          "Récupère un sujet par identifiant. Visible par les membres du produit ou tous pour un sujet transverse.",
        acces: "connecte",
        reponse: `{
  "sujet": {
    "id": "128",
    "project_id": "42",
    "title": "Migrer la base",
    "action": "Lancer le dump de prod",
    "due_date": "2026-11-10",
    "type": "technique",
    "porteur_id": "3",
    "criticite": "haute",
    "etat": "a_faire",
    "commentaire": ""
  }
}`,
        curl: `curl https://jiska.skapa.design/api/sujets/128 \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`,
      },
      {
        methode: "POST",
        chemin: "/api/sujets",
        titre: "Créer un sujet",
        description:
          "Crée un sujet rattaché à un produit (membre) ou transverse (admin). `projectId` à `null` pour un sujet transverse.",
        acces: "membre-produit",
        payload: `{
  "projectId": "42",
  "title": "Migrer la base",
  "action": "Lancer le dump de prod",
  "type": "technique",
  "criticite": "haute",
  "etat": "a_faire",
  "porteurId": "3",
  "dueDate": "2026-11-10",
  "commentaire": ""
}`,
        reponse: `{ "ok": true, "id": "128" }`,
        curl: `curl -X POST https://jiska.skapa.design/api/sujets \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"projectId":"42","title":"Migrer la base","type":"technique"}'`,
        notes: [
          "`type` : `technique` ou `business`.",
          "`criticite` : `critique`, `haute`, `normale`, `faible`.",
          "`etat` : `a_faire`, `en_cours`, `bloque`, `en_validation`, `termine`.",
          "`projectId: null` crée un sujet transverse (admin uniquement).",
        ],
      },
      {
        methode: "PATCH",
        chemin: "/api/sujets/{id}",
        titre: "Modifier un sujet",
        description:
          "Mise à jour partielle d'un sujet (titre, action, état, criticité, porteur, date, commentaire). Autorisé pour les membres du produit et le porteur du sujet.",
        acces: "membre-produit",
        payload: `{
  "action": "Dump lancé, en attente de restore",
  "etat": "en_cours",
  "porteurId": "7"
}`,
        reponse: `{ "ok": true }`,
        curl: `curl -X PATCH https://jiska.skapa.design/api/sujets/128 \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"etat":"en_cours"}'`,
      },
      {
        methode: "DELETE",
        chemin: "/api/sujets/{id}",
        titre: "Supprimer un sujet",
        description:
          "Supprime un sujet. Les membres du produit peuvent supprimer un sujet produit ; seul un admin peut supprimer un sujet transverse.",
        acces: "membre-produit",
        reponse: `{ "ok": true }`,
        curl: `curl -X DELETE https://jiska.skapa.design/api/sujets/128 \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`,
      },
    ],
  },
  {
    cle: "reunions",
    titre: "Réunions",
    description:
      "Clôture d'une réunion hebdomadaire : pose la date de départ de la semaine et gèle le périmètre des engagements. Réservé aux admins.",
    endpoints: [
      {
        methode: "POST",
        chemin: "/api/reunions",
        titre: "Clôturer la réunion de la semaine",
        description:
          "Enregistre la réunion du jour et gèle les sujets portant une action. Reclôturer le même jour écrase (volontairement) la précédente.",
        acces: "admin",
        reponse: `{ "ok": true, "id": "7", "tenueLe": "2026-10-28", "engagements": 12 }`,
        curl: `curl -X POST https://jiska.skapa.design/api/reunions \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`,
      },
    ],
  },
  {
    cle: "imports",
    titre: "Imports de réunion",
    description:
      "Dépôt et traitement d'un compte rendu Fireflies : propositions de sujets à valider. Réservé aux admins.",
    endpoints: [
      {
        methode: "POST",
        chemin: "/api/imports",
        titre: "Déposer un transcript",
        description:
          "Soumet un transcript brut et lance l'analyse IA. Portée produit (`projectId` renseigné) ou portefeuille (`projectId` à null).",
        acces: "admin",
        payload: `{
  "projectId": "42",
  "dateReunion": "2026-10-28",
  "transcript": "..."
}`,
        reponse: `{ "ok": true, "id": "17" }`,
        curl: `curl -X POST https://jiska.skapa.design/api/imports \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"projectId":"42","dateReunion":"2026-10-28","transcript":"..."}'`,
      },
      {
        methode: "POST",
        chemin: "/api/imports/{id}/appliquer",
        titre: "Appliquer un import",
        description:
          "Confirme les propositions validées : crée/modifie les sujets, pose les déploiements, archive l'import.",
        acces: "admin",
        payload: `{
  "propositions": [ { "id": "p1", "action": "creer", "...": "..." } ],
  "deploiements": [ { "projectId": "42", "deployable": true } ]
}`,
        reponse: `{ "ok": true }`,
        curl: `curl -X POST https://jiska.skapa.design/api/imports/17/appliquer \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"propositions":[],"deploiements":[]}'`,
      },
      {
        methode: "POST",
        chemin: "/api/imports/{id}/abandonner",
        titre: "Abandonner un import",
        description:
          "Marque un import comme abandonné sans rien appliquer. L'import reste consultable mais ne reviendra pas dans les en-attente.",
        acces: "admin",
        reponse: `{ "ok": true }`,
        curl: `curl -X POST https://jiska.skapa.design/api/imports/17/abandonner \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`,
      },
      {
        methode: "GET",
        chemin: "/api/fireflies/reunions-lundi",
        titre: "Lister les réunions Fireflies récentes",
        description:
          "Renvoie les transcripts Fireflies disponibles sur la fenêtre courante, utilisée pour l'import automatique du lundi.",
        acces: "admin",
        reponse: `{ "reunions": [ { "id": "...", "title": "...", "date": "..." } ] }`,
        curl: `curl https://jiska.skapa.design/api/fireflies/reunions-lundi \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`,
      },
      {
        methode: "POST",
        chemin: "/api/fireflies/importer",
        titre: "Importer un transcript Fireflies",
        description:
          "Récupère le transcript d'une réunion Fireflies par identifiant et l'enregistre comme import à vérifier.",
        acces: "admin",
        payload: `{ "firefliesId": "..." }`,
        reponse: `{ "ok": true, "id": "18" }`,
        curl: `curl -X POST https://jiska.skapa.design/api/fireflies/importer \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"firefliesId":"..."}'`,
      },
    ],
  },
  {
    cle: "equipe",
    titre: "Équipe",
    description: "Lecture ouverte à tous les utilisateurs ; création et suppression réservées aux dirigeants.",
    endpoints: [
      {
        methode: "GET",
        chemin: "/api/users",
        titre: "Lister les comptes",
        description:
          "Renvoie tous les comptes (prénom, nom, e-mail, rôle, actif). Ouvert à tout utilisateur connecté : utile pour retrouver un porteur par son nom.",
        acces: "connecte",
        reponse: `{
  "users": [
    {
      "id": "3",
      "email": "camille@exemple.fr",
      "first_name": "Camille",
      "last_name": "Durand",
      "role": "collaborateur",
      "avatar": null,
      "active": true,
      "created_at": "..."
    }
  ]
}`,
        curl: `curl https://jiska.skapa.design/api/users \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`,
      },
      {
        methode: "POST",
        chemin: "/api/users",
        titre: "Créer un compte",
        description:
          "Crée la ligne locale et envoie une invitation Clerk pour que la personne choisisse son mot de passe. Rôle : `dirigeant` ou `collaborateur`.",
        acces: "admin",
        payload: `{ "email": "camille@exemple.fr", "role": "collaborateur" }`,
        reponse: `{ "ok": true, "id": "19" }`,
        curl: `curl -X POST https://jiska.skapa.design/api/users \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"camille@exemple.fr","role":"collaborateur"}'`,
      },
      {
        methode: "PATCH",
        chemin: "/api/users/{id}",
        titre: "Changer le rôle d'un compte",
        description:
          "Bascule le rôle entre dirigeant et collaborateur. Impossible de modifier son propre rôle ou celui d'un développeur.",
        acces: "admin",
        payload: `{ "role": "dirigeant" }`,
        reponse: `{ "ok": true }`,
        curl: `curl -X PATCH https://jiska.skapa.design/api/users/19 \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"role":"dirigeant"}'`,
        notes: ["`role` : `dirigeant` ou `collaborateur` uniquement."],
      },
      {
        methode: "DELETE",
        chemin: "/api/users/{id}",
        titre: "Supprimer un compte",
        description:
          "Supprime la ligne locale, le compte Clerk associé et toutes les invitations en attente. Impossible de supprimer son propre compte.",
        acces: "admin",
        reponse: `{ "ok": true }`,
        curl: `curl -X DELETE https://jiska.skapa.design/api/users/19 \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`,
      },
      {
        methode: "POST",
        chemin: "/api/users/{id}/inviter",
        titre: "Relancer une invitation",
        description:
          "Renvoie l'invitation Clerk à la personne (utile si l'invitation initiale a expiré ou a été perdue).",
        acces: "admin",
        reponse: `{ "ok": true }`,
        curl: `curl -X POST https://jiska.skapa.design/api/users/19/inviter \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`,
      },
    ],
  },
  {
    cle: "tickets",
    titre: "Tickets support",
    description:
      "Ouverture par toute personne connectée, traitement réservé aux développeurs plateforme.",
    endpoints: [
      {
        methode: "GET",
        chemin: "/api/tickets",
        titre: "Lister les tickets",
        description:
          "Renvoie les tickets visibles. Un collaborateur voit uniquement les siens ; un développeur voit tout. Filtre optionnel `?statut=`.",
        acces: "connecte",
        reponse: `{
  "tickets": [
    {
      "id": "33",
      "titre": "Export CSV cassé",
      "description": "...",
      "priorite": "haute",
      "statut": "ouvert",
      "created_at": "...",
      "updated_at": "...",
      "auteur": { "id": "3", "email": "...", "first_name": "...", "last_name": "..." }
    }
  ]
}`,
        curl: `curl "https://jiska.skapa.design/api/tickets?statut=ouvert" \\
  -H "Authorization: Bearer <ACCESS_TOKEN>"`,
      },
      {
        methode: "POST",
        chemin: "/api/tickets",
        titre: "Ouvrir un ticket",
        description:
          "Crée un ticket (bogue, demande d'aide, suggestion). Priorité par défaut : `normale`.",
        acces: "connecte",
        payload: `{
  "titre": "Export CSV cassé",
  "description": "Le bouton renvoie une erreur 500.",
  "priorite": "haute"
}`,
        reponse: `{ "ok": true, "id": "33" }`,
        curl: `curl -X POST https://jiska.skapa.design/api/tickets \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"titre":"Export CSV cassé"}'`,
        notes: [
          "`priorite` : `basse`, `normale` ou `haute`.",
          "`titre` : 120 caractères max ; `description` : 4000 caractères max.",
        ],
      },
      {
        methode: "PATCH",
        chemin: "/api/tickets/{id}",
        titre: "Changer le statut d'un ticket",
        description: "Déplace le ticket dans son cycle de vie. Réservé aux développeurs plateforme.",
        acces: "developeur",
        payload: `{ "statut": "en_cours" }`,
        reponse: `{ "ok": true }`,
        curl: `curl -X PATCH https://jiska.skapa.design/api/tickets/33 \\
  -H "Authorization: Bearer <ACCESS_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"statut":"en_cours"}'`,
        notes: ["`statut` : `ouvert`, `en_cours`, `resolu` ou `ferme`."],
      },
    ],
  },
];

// Filtre : ne garde que les endpoints appelables par le rôle donné.
// « membre-produit » reste visible pour un collaborateur (il peut l'être
// pour certains produits). « admin » et « developeur » restent cachés
// aux rôles qui n'y correspondent pas.
export function endpointsPourRole(role: Role): Categorie[] {
  const estAdmin = role === "dirigeant" || role === "developeur";
  const estDev = role === "developeur";
  return CATEGORIES.map((cat) => ({
    ...cat,
    endpoints: cat.endpoints.filter((ep) => {
      if (ep.acces === "connecte") return true;
      if (ep.acces === "membre-produit") return true;
      if (ep.acces === "admin") return estAdmin;
      if (ep.acces === "developeur") return estDev;
      return false;
    }),
  })).filter((cat) => cat.endpoints.length > 0);
}
