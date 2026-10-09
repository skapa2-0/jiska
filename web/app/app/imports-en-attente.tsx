import type { ImportEnAttente } from "@/lib/imports";

// Rappel des analyses déjà payées mais pas encore vérifiées. Sans cet
// écran, un onglet fermé pendant l'analyse laisse le travail en base sans
// aucun moyen d'y revenir.
export default function ImportsEnAttente({
  imports,
  base,
}: {
  imports: ImportEnAttente[];
  base: string;
}) {
  if (imports.length === 0) return null;

  return (
    <section
      aria-label="Imports en attente de vérification"
      className="mt-4 rounded-lg bg-warn-soft px-4 py-3"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-warn">
        {imports.length} analyse{imports.length > 1 ? "s" : ""} en attente
      </h2>
      <ul className="mt-2 space-y-1.5">
        {imports.map((i) => (
          <li
            key={i.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white px-3 py-1.5 shadow-card"
          >
            <span className="text-sm font-medium text-ink">
              Réunion du {i.dateReunion.split("-").reverse().join("/")}
            </span>
            <span className="text-[11px] text-stone">
              {i.nbPropositions} prop.{i.auteur ? ` · ${i.auteur}` : ""} ·{" "}
              {i.creeLe}
            </span>
            <a
              href={`${base}?reprise=${i.id}`}
              className="ml-auto rounded-lg bg-ink px-3 py-1 text-xs font-semibold text-white transition hover:opacity-85"
            >
              Reprendre
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
