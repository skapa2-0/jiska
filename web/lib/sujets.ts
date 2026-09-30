// Vocabulaire métier du PRD : types, états, criticités. Partagé entre
// le serveur (validation) et le client (affichage).

export const ETATS = {
  a_faire: { label: "À faire", dot: "bg-stone", chip: "bg-surface text-mute" },
  en_cours: {
    label: "En cours",
    dot: "bg-warn",
    chip: "bg-warn-soft text-warn",
  },
  bloque: {
    label: "Bloqué",
    dot: "bg-danger",
    chip: "bg-danger-soft text-danger",
  },
  en_validation: {
    label: "En validation",
    dot: "bg-info",
    chip: "bg-info-soft text-info",
  },
  termine: {
    label: "Terminé",
    dot: "bg-success",
    chip: "bg-success-soft text-success",
  },
} as const;
export type Etat = keyof typeof ETATS;

export const CRITICITES = {
  critique: { label: "Critique", chip: "bg-danger-soft text-danger" },
  haute: { label: "Haute", chip: "bg-warn-soft text-warn" },
  // Neutre : la criticité courante ne doit pas ressembler à une alerte.
  normale: { label: "Normale", chip: "bg-surface text-mute" },
  faible: { label: "Faible", chip: "bg-success-soft text-success" },
} as const;
export type Criticite = keyof typeof CRITICITES;

// Type d'un sujet : technique ou business. Servi uniquement en pastille
// et pour la répartition d'un produit (part de tech vs business dans ses
// sujets). Aucun poids, aucun axe pondéré, aucun avancement produit
// dérivé : un sujet compte pour un.
export const TYPES_SUJET = {
  technique: {
    label: "Technique",
    court: "Tech",
    chip: "bg-info-soft text-info",
  },
  business: {
    label: "Business",
    court: "Business",
    chip: "bg-purple-50 text-purple-700",
  },
} as const;
export type TypeSujet = keyof typeof TYPES_SUJET;

// Sujet transverse : project_id null, project_name porte le libellé de
// la section pour que tri, recherche et regroupement fonctionnent sans
// cas particulier (voir NOM_TRANSVERSE).
export const NOM_TRANSVERSE = "Sujet transverse";
export const NOM_TRANSVERSES = "Sujets transverses";

export type SujetRow = {
  id: string;
  project_id: string | null;
  project_name: string;
  project_logo: string | null;
  title: string;
  action: string;
  due_date: string | null;
  type: TypeSujet;
  porteur_id: string | null;
  updated_at: string;
  criticite: Criticite;
  etat: Etat;
  commentaire: string;
  can_edit: boolean;
  can_manage: boolean;
};

// Répartition tech / business d'un ensemble de sujets, par comptage.
// Total 0 : les deux parts sont à 0, la lecture reste correcte.
export type Repartition = {
  tech: number;
  business: number;
  total: number;
  partTech: number;
  partBusiness: number;
};

export function repartitionSujets(
  sujets: readonly { type: TypeSujet }[],
): Repartition {
  const tech = sujets.filter((s) => s.type === "technique").length;
  const business = sujets.filter((s) => s.type === "business").length;
  const total = tech + business;
  return {
    tech,
    business,
    total,
    partTech: total ? Math.round((tech / total) * 100) : 0,
    partBusiness: total ? 100 - Math.round((tech / total) * 100) : 0,
  };
}
