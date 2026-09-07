import { CRITICITES, ETATS } from "@/lib/sujets";
import Avatar from "./avatar";
import type { Personne } from "./avatar";

// Sujets transverses : tâches et missions qui ne relèvent d'aucun produit.
// Elles vivent sous la grille des produits, dans leur propre section, et
// ne pèsent sur l'avancement d'aucun axe (lib/db.ts).

export type SujetTransverse = {
  id: string;
  titre: string;
  action: string;
  echeance: string | null;
  etat: string;
  criticite: string;
  porteur: Personne | null;
};

const jolieDate = (v: string) => v.split("-").reverse().join("/");

export default function SujetsTransverses({
  sujets,
  peutCreer,
  today,
}: {
  sujets: SujetTransverse[];
  peutCreer: boolean;
  today: string;
}) {
  // Section toujours présente quand on peut en créer : une section vide
  // qui explique ce qu'elle attend vaut mieux qu'une section absente
  // qu'on ne découvre jamais.
  if (sujets.length === 0 && !peutCreer) return null;

  return (
    <section className="mb-7 last:mb-0">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wide text-stone">
          Sujets transverses
          {sujets.length > 0 && (
            <span className="font-medium normal-case tracking-normal">
              {sujets.length}
            </span>
          )}
        </h2>
        <p className="text-xs text-stone">
          Tâches et missions qui ne relèvent d&apos;aucun produit
        </p>
        {peutCreer && (
          <a
            href="/app/actions?sujet=nouveau&transverse=1"
            className="ml-auto rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-surface"
          >
            Nouveau sujet transverse
          </a>
        )}
      </div>

      {sujets.length === 0 ? (
        <p className="rounded-lg bg-surface px-5 py-4 text-sm text-stone">
          Aucun sujet transverse pour l&apos;instant. Les tâches qui ne se
          rattachent à aucun produit se rangent ici, à la main ou depuis une
          réunion.
        </p>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-lg bg-white shadow-card">
          {sujets.map((s) => {
            const etat = ETATS[s.etat as keyof typeof ETATS];
            const criticite = CRITICITES[s.criticite as keyof typeof CRITICITES];
            const retard =
              !!s.echeance && s.echeance < today && s.etat !== "termine";
            return (
              <li key={s.id}>
                <a
                  href={`/app/actions?sujet=${s.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 transition hover:bg-surface"
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full ${etat?.dot ?? "bg-stone"}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                    {s.titre}
                  </span>
                  {s.action && (
                    <span className="min-w-0 max-w-xs truncate text-xs text-mute">
                      {s.action}
                    </span>
                  )}
                  {criticite && s.criticite !== "normale" && (
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${criticite.chip}`}
                    >
                      {criticite.label}
                    </span>
                  )}
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${etat?.chip ?? "bg-surface text-mute"}`}
                  >
                    {etat?.label ?? s.etat}
                  </span>
                  <span
                    className={`w-20 shrink-0 text-right text-xs font-medium ${
                      retard ? "text-danger" : "text-stone"
                    }`}
                  >
                    {s.echeance ? jolieDate(s.echeance) : "-"}
                  </span>
                  <span className="w-7 shrink-0">
                    {s.porteur && (
                      <Avatar
                        personne={s.porteur}
                        taille="h-7 w-7 text-[11px]"
                      />
                    )}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
