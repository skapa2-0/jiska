// Avancement de la semaine : « jusqu'où est-on allé sur ce qu'on s'était
// engagé à faire ? ». C'est la question de la réunion hebdomadaire, et
// elle est distincte de l'avancement du produit, qui demande « où en est
// ce produit ». Les deux cohabitent : une équipe peut tenir tous ses
// engagements hebdomadaires sans que le produit avance beaucoup, et
// inversement.
//
// Périmètre : les sujets qui portaient une action de la semaine au moment
// où la dernière réunion a été clôturée (table reunion_engagements). Gelé
// à la clôture, donc insensible aux actions oubliées sur de vieux sujets,
// et porteur de l'état de départ auquel comparer.
//
// Tant qu'aucune réunion n'a été clôturée, on retombe sur les sujets
// portant une action aujourd'hui, datés du dernier import appliqué : la
// mesure reste juste avant la première clôture.
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

const bareme = (colonne: string) => `CASE ${colonne}
  WHEN 'termine' THEN 100
  WHEN 'en_validation' THEN 66
  WHEN 'en_cours' THEN 33
  ELSE 0 END`;

// Dernière réunion clôturée. NULL tant qu'il n'y en a aucune, ce qui fait
// basculer le périmètre sur la solution de repli.
const DERNIERE = "(SELECT max(id) FROM reunions)";

export type Semaine = {
  // 0 engagement = pas de semaine à mesurer. Le distinguer d'un 0 % est
  // essentiel : « rien d'engagé » et « rien de fait » ne se disent pas
  // pareil en réunion.
  engages: number;
  avancement: number;
  termines: number;
  bloques: number;
  // Date de la dernière réunion clôturée, à défaut du dernier import
  // appliqué qui couvre le produit.
  depuis: string | null;
  // Avancement du même périmètre au moment de la clôture : le « avant »
  // auquel comparer. NULL tant qu'aucune réunion n'a été clôturée, faute
  // de point de départ enregistré.
  depart: number | null;
};

export type SemaineRow = {
  sem_engages: string;
  sem_avancement: string | null;
  sem_termines: string;
  sem_bloques: string;
  sem_depuis: string | null;
  sem_depart: string | null;
};

// Le périmètre, exprimé une seule fois : les engagements gelés de la
// dernière réunion, ou les actions du jour tant qu'il n'y a pas eu de
// clôture. `portee` compare le produit de l'engagement à celui voulu.
function perimetre(porteeGelee: string, porteeVive: string): string {
  return `FROM sujets s
      WHERE (${DERNIERE} IS NULL AND ${porteeVive} AND s.action <> '')
         OR s.id IN (SELECT e.sujet_id FROM reunion_engagements e
                      WHERE e.reunion_id = ${DERNIERE} AND ${porteeGelee})`;
}

function colonnes(porteeGelee: string, porteeVive: string, depuis: string) {
  const p = perimetre(porteeGelee, porteeVive);
  return `(SELECT count(*) ${p}) AS sem_engages,
          (SELECT round(avg(${bareme("s.etat")})) ${p}) AS sem_avancement,
          (SELECT count(*) ${p} AND s.etat = 'termine') AS sem_termines,
          (SELECT count(*) ${p} AND s.etat = 'bloque') AS sem_bloques,
          ${depuis} AS sem_depuis,
          (SELECT round(avg(${bareme("e.etat")}))
             FROM reunion_engagements e
            WHERE e.reunion_id = ${DERNIERE} AND ${porteeGelee}) AS sem_depart`;
}

// Colonnes à ajouter à une requête qui parcourt `projects` sous l'alias
// donné.
export function sqlSemaine(alias = "p"): string {
  return colonnes(
    `e.project_id = ${alias}.id`,
    `s.project_id = ${alias}.id`,
    `COALESCE((SELECT max(tenue_le)::text FROM reunions),
              (SELECT max(i.date_reunion)::text FROM reunion_imports i
                WHERE i.statut = 'applique'
                  AND (i.project_id = ${alias}.id OR i.project_id IS NULL)))`,
  );
}

// Même mesure pour les sujets transverses, qui ne se parcourent pas par
// produit. Seule une réunion de portée portefeuille les date.
export function sqlSemaineTransverse(): string {
  return colonnes(
    "e.project_id IS NULL",
    "s.project_id IS NULL",
    `COALESCE((SELECT max(tenue_le)::text FROM reunions),
              (SELECT max(i.date_reunion)::text FROM reunion_imports i
                WHERE i.statut = 'applique' AND i.project_id IS NULL))`,
  );
}

// Agrégat portefeuille : tous les produits visibles, transverses compris.
// `vis` est la sous-requête de visibilité de l'appelant.
export function sqlSemainePortefeuille(vis: string): string {
  const portee = (col: string) =>
    `(${col} IS NULL OR ${col} IN (${vis}))`;
  return colonnes(
    portee("e.project_id"),
    portee("s.project_id"),
    `COALESCE((SELECT max(tenue_le)::text FROM reunions),
              (SELECT max(date_reunion)::text FROM reunion_imports
                WHERE statut = 'applique'))`,
  );
}

export function lireSemaine(row: SemaineRow): Semaine {
  return {
    engages: Number(row.sem_engages),
    avancement: Number(row.sem_avancement ?? 0),
    termines: Number(row.sem_termines),
    bloques: Number(row.sem_bloques),
    depuis: row.sem_depuis,
    depart: row.sem_depart === null ? null : Number(row.sem_depart),
  };
}
