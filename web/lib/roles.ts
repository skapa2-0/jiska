// Types et helpers de rôles purs, utilisables côté client comme côté
// serveur. `lib/auth.ts` importe côté serveur uniquement (pg, Clerk) :
// tout ce qui doit être utilisé aussi depuis un client component vit
// ici, sans dépendance runtime.

// `developeur` : rôle plateforme (équipe technique), pas rôle métier.
// Hérite de toutes les permissions de dirigeant, plus la gestion des
// tickets. Il n'apparaît pas dans le sélecteur de la page Équipe :
// l'attribution passe par une écriture directe en base.
export type Role = "dirigeant" | "collaborateur" | "developeur";

// « Administre » = a tous les droits dirigeants (créer / supprimer des
// produits, gérer l'équipe, importer une réunion générale, clôturer la
// semaine, etc.). Regroupe dirigeant et developeur pour ne pas
// dupliquer la liste des rôles à chaque check.
export function estAdmin(user: { role: Role }): boolean {
  return user.role === "dirigeant" || user.role === "developeur";
}

// Étiquette lisible d'un rôle, pour l'UI.
export function libelleRole(role: Role): string {
  if (role === "dirigeant") return "Dirigeant";
  if (role === "developeur") return "Développeur";
  return "Collaborateur";
}
