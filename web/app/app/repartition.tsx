import type { Repartition } from "@/lib/sujets";

// Visuel de répartition tech / business d'un produit. Deux tons de
// la DA (brand pour tech, encre pour business) plutôt qu'un couple
// bleu / violet qui tirait l'œil sans raison. Zéro sujet : la barre
// reste visible en surface pour ne pas se lire comme un bug d'affichage.

export function BarreRepartition({ r }: { r: Repartition }) {
  if (r.total === 0) {
    return (
      <div
        aria-label="Aucun sujet"
        className="h-1.5 rounded-full bg-surface"
      />
    );
  }
  return (
    <div
      aria-label={`Répartition : ${r.partTech} % technique, ${r.partBusiness} % business`}
      className="flex h-1.5 overflow-hidden rounded-full bg-surface"
    >
      <div className="bg-brand" style={{ width: `${r.partTech}%` }} />
      <div className="bg-ink" style={{ width: `${r.partBusiness}%` }} />
    </div>
  );
}

// Ligne compacte : deux pastilles côte à côte.
export function ChiffresRepartition({
  r,
  compact = false,
}: {
  r: Repartition;
  compact?: boolean;
}) {
  const taille = compact ? "text-[11px]" : "text-xs";
  return (
    <div className={`flex flex-wrap items-center gap-2 ${taille}`}>
      <span className="flex items-center gap-1.5 rounded-md bg-surface px-2 py-0.5 font-semibold text-brand">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand" />
        Tech {r.total ? `${r.partTech} %` : "-"} · {r.tech}
      </span>
      <span className="flex items-center gap-1.5 rounded-md bg-surface px-2 py-0.5 font-semibold text-ink">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ink" />
        Business {r.total ? `${r.partBusiness} %` : "-"} · {r.business}
      </span>
    </div>
  );
}
