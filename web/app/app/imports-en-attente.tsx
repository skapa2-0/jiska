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
      className="mt-6 rounded-lg bg-warn-soft p-4"
    >
      <h2 className="text-sm font-semibold text-warn">
        {imports.length} analyse{imports.length > 1 ? "s" : ""} en attente de
        vérification
      </h2>
      <ul className="mt-3 space-y-2">
        {imports.map((i) => (
          <li
            key={i.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-white px-4 py-2.5 shadow-card"
          >
            <span className="text-sm font-semibold text-ink">
              Réunion du {i.dateReunion.split("-").reverse().join("/")}
            </span>
            <span className="text-xs text-stone">
              {i.nbPropositions} proposition{i.nbPropositions > 1 ? "s" : ""}
              {i.auteur ? ` · déposée par ${i.auteur}` : ""} · le {i.creeLe}
            </span>
            <a
              href={`${base}?reprise=${i.id}`}
              className="ml-auto rounded-lg bg-ink px-3.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-85"
            >
              Reprendre
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
