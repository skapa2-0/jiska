// Avancement de la semaine : « jusqu'où est-on allé sur ce qu'on s'était
// engagé à faire ? ». C'est la question de la réunion hebdomadaire, et
// elle est distincte de l'avancement du produit, qui demande « où en est
// ce produit ». Les deux cohabitent : une équipe peut tenir tous ses
// engagements hebdomadaires sans que le produit avance beaucoup, et
// inversement.
//
// Périmètre : les sujets portant une action de la semaine. C'est le champ
// qui porte l'engagement dans les faits, et il est nommé pour ça.
//
// Rien à saisir en plus : la mesure se déduit des états que la réunion
// fait bouger de toute façon.

// L'échelle diffère volontairement de CREDIT_ETAT (lib/sujets.ts). Le
// crédit d'avancement produit demande ce qui est livré : « en cours » ne
// livre rien, donc zéro. La semaine demande si on a avancé : « en cours »
// est un vrai pas depuis « à faire », et le nier rendrait la mesure
// binaire et sans intérêt en séance.
export const AVANCEMENT_ETAT: Record<string, number> = {
  a_faire: 0,
  // Un sujet arrêté n'a pas avancé cette semaine, quel que soit le travail
  // déjà accompli : compté à zéro, mais signalé à part pour que la raison
  // du zéro se voie.
  bloque: 0,
  en_cours: 33,
  en_validation: 66,
  termine: 100,
};

const SQL_ETAT = `CASE s.etat
  WHEN 'termine' THEN 100
  WHEN 'en_validation' THEN 66
  WHEN 'en_cours' THEN 33
  ELSE 0 END`;

export type Semaine = {
  // 0 engagement = pas de semaine à mesurer. Le distinguer d'un 0 % est
  // essentiel : « rien d'engagé » et « rien de fait » ne se disent pas
  // pareil en réunion.
  engages: number;
  avancement: number;
  termines: number;
  bloques: number;
  // Date de la dernière réunion importée qui couvre le produit, quand il
  // y en a une : sert à dater la mesure, pas à la calculer.
  depuis: string | null;
};

export type SemaineRow = {
  sem_engages: string;
  sem_avancement: string | null;
  sem_termines: string;
  sem_bloques: string;
  sem_depuis: string | null;
};

// Colonnes à ajouter à une requête qui parcourt `projects` sous l'alias
// donné. La portée portefeuille (project_id NULL) couvre tous les
// produits : une réunion générale date la semaine de chacun.
export function sqlSemaine(alias = "p"): string {
  const perimetre = `FROM sujets s
      WHERE s.project_id = ${alias}.id AND s.action <> ''`;
  return `(SELECT count(*) ${perimetre}) AS sem_engages,
          (SELECT round(avg(${SQL_ETAT})) ${perimetre}) AS sem_avancement,
          (SELECT count(*) ${perimetre} AND s.etat = 'termine') AS sem_termines,
          (SELECT count(*) ${perimetre} AND s.etat = 'bloque') AS sem_bloques,
          (SELECT max(i.date_reunion)::text FROM reunion_imports i
            WHERE i.statut = 'applique'
              AND (i.project_id = ${alias}.id OR i.project_id IS NULL))
            AS sem_depuis`;
}

// Même mesure, calculée sur une liste déjà chargée plutôt qu'en SQL :
// les sujets transverses ne se parcourent pas par produit.
export function semaineDeSujets(
  sujets: { etat: string; action: string }[],
  depuis: string | null,
): Semaine {
  const engages = sujets.filter((s) => s.action !== "");
  return {
    engages: engages.length,
    avancement: engages.length
      ? Math.round(
          engages.reduce((t, s) => t + (AVANCEMENT_ETAT[s.etat] ?? 0), 0) /
            engages.length,
        )
      : 0,
    termines: engages.filter((s) => s.etat === "termine").length,
    bloques: engages.filter((s) => s.etat === "bloque").length,
    depuis,
  };
}

export function lireSemaine(row: SemaineRow): Semaine {
  return {
    engages: Number(row.sem_engages),
    avancement: Number(row.sem_avancement ?? 0),
    termines: Number(row.sem_termines),
    bloques: Number(row.sem_bloques),
    depuis: row.sem_depuis,
  };
}
