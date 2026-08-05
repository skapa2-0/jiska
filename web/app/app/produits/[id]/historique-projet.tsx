"use client";

import { useMemo, useState } from "react";
import Select from "../../select";

export type EntreeHistorique = {
  quand: string;
  auteur: string;
  sujetId: string;
  titre: string;
  champ: string;
  ancien: string;
  nouveau: string;
  creation: boolean;
};

const PAS = 25;

// Fil d'historique du projet : filtre par sujet, affichage par lots.
export default function HistoriqueProjet({
  entrees,
}: {
  entrees: EntreeHistorique[];
}) {
  const [sujetId, setSujetId] = useState("");
  const [limite, setLimite] = useState(PAS);

  const sujets = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of entrees) if (!seen.has(e.sujetId)) seen.set(e.sujetId, e.titre);
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [entrees]);

  const filtrees = sujetId
    ? entrees.filter((e) => e.sujetId === sujetId)
    : entrees;
  const visibles = filtrees.slice(0, limite);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone">
          Historique
        </h2>
        {sujets.length > 1 && (
          <Select
            ariaLabel="Filtrer l'historique par sujet"
            placeholder="Tous les sujets"
            value={sujetId}
            onChange={(v) => {
              setSujetId(v);
              setLimite(PAS);
            }}
            options={sujets}
          />
        )}
      </div>

      {visibles.length === 0 ? (
        <p className="text-sm text-stone">
          Aucune modification enregistrée pour l&apos;instant.
        </p>
      ) : (
        <ul className="space-y-3 border-l-2 border-hairline pl-4">
          {visibles.map((e, i) => (
            <li key={i} className="relative text-xs">
              <span
                aria-hidden="true"
                className={`absolute -left-[21.5px] top-1 h-2 w-2 rounded-full ${
                  e.creation ? "bg-brand" : "bg-hairline"
                }`}
              />
              <p className="text-stone">
                {e.quand}
                {e.auteur ? ` · ${e.auteur}` : ""}
              </p>
              <p className="mt-0.5 text-sm text-mute">
                <span className="font-medium text-ink">{e.titre}</span>{" "}
                {e.creation ? (
                  <span className="font-medium text-brand">Sujet créé</span>
                ) : (
                  <>
                    · {e.champ} : {e.ancien} →{" "}
                    <span className="font-medium text-ink">{e.nouveau}</span>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      {filtrees.length > limite && (
        <button
          type="button"
          onClick={() => setLimite((l) => l + PAS)}
          className="mt-4 rounded-lg border border-hairline px-4 py-2 text-sm font-medium text-mute transition hover:bg-surface hover:text-ink"
        >
          Voir plus ({filtrees.length - limite} restant
          {filtrees.length - limite > 1 ? "s" : ""})
        </button>
      )}
    </section>
  );
}
