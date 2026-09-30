import type { Repartition } from "@/lib/sujets";

// Visuel de répartition tech / business d'un produit. Une barre
// horizontale bicolore et deux compteurs. Zéro sujet : la barre reste
// visible en gris pour ne pas se lire comme un bug d'affichage.

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
      <div
        className="bg-info"
        style={{ width: `${r.partTech}%` }}
      />
      <div
        className="bg-purple-500"
        style={{ width: `${r.partBusiness}%` }}
      />
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
      <span className="flex items-center gap-1.5 rounded-md bg-info-soft px-2 py-0.5 font-semibold text-info">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-info" />
        Tech {r.total ? `${r.partTech} %` : "-"} · {r.tech}
      </span>
      <span className="flex items-center gap-1.5 rounded-md bg-purple-50 px-2 py-0.5 font-semibold text-purple-700">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-purple-500"
        />
        Business {r.total ? `${r.partBusiness} %` : "-"} · {r.business}
      </span>
    </div>
  );
}
