// Vocabulaire métier du PRD : jalons, états, criticités. Partagé entre
// le serveur (validation) et le client (affichage). Aucun pourcentage
// n'est saisi à la main : tout passe par les jalons.

export const JALONS = [0, 25, 50, 75, 100] as const;
export type Jalon = (typeof JALONS)[number];

export const JALONS_TECH: Record<Jalon, string> = {
  0: "Analyse du besoin",
  25: "Développement lancé",
  50: "Architecture validée",
  75: "Développement terminé",
  100: "Livré / Déployé",
};

export const JALONS_BUSINESS: Record<Jalon, string> = {
  0: "Besoin identifié",
  25: "PRD validé",
  50: "Bêta-test",
  75: "Validation client",
  100: "Livré",
};

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
  normale: { label: "Normale", chip: "bg-yellow-50 text-yellow-700" },
  faible: { label: "Faible", chip: "bg-success-soft text-success" },
} as const;
export type Criticite = keyof typeof CRITICITES;

// PRD §9 : global = technique × 60 % + business × 40 %, jamais saisi.
export function avancementGlobal(tech: number, business: number): number {
  return Math.round(tech * 0.6 + business * 0.4);
}

export function isJalon(v: unknown): v is Jalon {
  return typeof v === "number" && (JALONS as readonly number[]).includes(v);
}

export type SujetRow = {
  id: string;
  project_id: string;
  project_name: string;
  project_logo: string | null;
  title: string;
  responsable_id: string | null;
  responsable_email: string | null;
  action: string;
  due_date: string | null;
  jalon_tech: number;
  jalon_business: number;
  criticite: Criticite;
  etat: Etat;
  commentaire: string;
  can_edit: boolean;
  can_manage: boolean;
};
