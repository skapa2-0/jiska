import type { Semaine } from "@/lib/semaine";

// Avancement de la semaine : ce qu'on s'était engagé à faire, et jusqu'où
// on est allé. Distinct de l'avancement du produit, affiché à côté sans
// s'y substituer (voir lib/semaine.ts).

const jolieDate = (v: string) => v.split("-").reverse().join("/");

// « Rien d'engagé » et « rien de fait » ne se disent pas pareil en
// réunion : le premier n'est pas un zéro, c'est une absence de mesure.
export function sansEngagement(s: Semaine): boolean {
  return s.engages === 0;
}

function ton(valeur: number): string {
  if (valeur >= 75) return "bg-success";
  if (valeur >= 40) return "bg-warn";
  return "bg-stone";
}

// Version compacte, pour une carte de produit déjà dense.
export function SemaineLigne({ semaine }: { semaine: Semaine }) {
  if (sansEngagement(semaine)) {
    return (
      <p className="text-[11px] font-medium text-stone">
        Aucune action engagée cette semaine
      </p>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[11px] font-medium text-stone">
        Semaine
      </span>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full rounded-full ${ton(semaine.avancement)}`}
          style={{ width: `${semaine.avancement}%` }}
        />
      </div>
      <span className="shrink-0 text-[11px] font-semibold text-ink">
        {semaine.avancement} %
      </span>
      <span className="shrink-0 text-[11px] text-stone">
        {semaine.termines}/{semaine.engages} faites
      </span>
    </div>
  );
}

// Version détaillée, pour une fiche produit ou l'écran de réunion.
export default function BlocSemaine({ semaine }: { semaine: Semaine }) {
  const vide = sansEngagement(semaine);
  return (
    <div className="rounded-lg bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold text-ink">Avancement de la semaine</p>
        {semaine.depuis && (
          <p className="text-xs text-stone">
            depuis la réunion du {jolieDate(semaine.depuis)}
          </p>
        )}
      </div>

      {vide ? (
        <p className="mt-2 text-sm text-stone">
          Aucune action de la semaine n&apos;est engagée sur ce produit : il
          n&apos;y a rien à mesurer, ce n&apos;est pas un avancement nul.
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3">
            <span className="font-display text-2xl font-medium text-ink">
              {semaine.avancement} %
            </span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface">
              <div
                className={`h-full rounded-full ${ton(semaine.avancement)}`}
                style={{ width: `${semaine.avancement}%` }}
              />
            </div>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium">
            <span className="text-mute">
              {semaine.termines} terminée{semaine.termines > 1 ? "s" : ""} sur{" "}
              {semaine.engages} engagée{semaine.engages > 1 ? "s" : ""}
            </span>
            {semaine.bloques > 0 && (
              <span className="rounded-md bg-danger-soft px-2 py-0.5 text-danger">
                {semaine.bloques} bloquée{semaine.bloques > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </>
      )}
    </div>
  );
}
