"use client";

import { useState } from "react";
import Avatar from "../avatar";
import type { Personne } from "../avatar";
import ProjetLogo from "../projet-logo";
import Roue, { tonAvancement } from "../roue";
import Select from "../select";

export type CarteProjet = {
  id: string;
  name: string;
  description: string;
  logo: string | null;
  avancement: number;
  actifs: number;
  bloques: number;
  responsableId: string | null;
  equipe: Personne[];
};

const TRIS = [
  { value: "avancement-bas", label: "Avancement croissant" },
  { value: "avancement-haut", label: "Avancement décroissant" },
  { value: "bloques", label: "Bloqués d'abord" },
  { value: "actifs", label: "Sujets actifs" },
];

// Grille des projets avec recherche libre et tri.
export default function ListeProjets({ projets }: { projets: CarteProjet[] }) {
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState("");

  let visibles = projets.filter((p) => {
    if (!recherche) return true;
    return `${p.name} ${p.description}`
      .toLowerCase()
      .includes(recherche.toLowerCase());
  });

  if (tri) {
    visibles = [...visibles].sort((a, b) => {
      switch (tri) {
        case "avancement-bas":
          return a.avancement - b.avancement;
        case "avancement-haut":
          return b.avancement - a.avancement;
        case "bloques":
          return b.bloques - a.bloques;
        case "actifs":
          return b.actifs - a.actifs;
        default:
          return 0;
      }
    });
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Select
          ariaLabel="Trier les projets"
          placeholder="Par nom"
          value={tri}
          onChange={setTri}
          options={TRIS}
        />
        <input
          type="search"
          placeholder="Rechercher un projet…"
          aria-label="Rechercher un projet"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="ml-auto w-full rounded-lg border border-hairline bg-white px-4 py-2 text-sm text-ink placeholder-stone outline-none transition focus:ring-2 focus:ring-brand sm:w-72"
        />
      </div>

      {visibles.length === 0 ? (
        <p className="mt-20 text-center text-[15px] text-stone">
          Aucun projet ne correspond à la recherche.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibles.map((p) => (
            <li key={p.id}>
              <a
                href={`/app/projets/${p.id}`}
                className="block rounded-lg bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgb(25_28_31/0.08),0_8px_20px_rgb(25_28_31/0.10)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <ProjetLogo
                    name={p.name}
                    logo={p.logo}
                    taille="h-10 w-10 text-xl"
                  />
                  <Roue
                    valeur={p.avancement}
                    ton={tonAvancement(p.avancement)}
                    taille="h-11 w-11"
                  />
                </div>
                <h2 className="mt-3 line-clamp-1 font-display text-lg font-semibold text-ink">
                  {p.name}
                </h2>
                <p className="mt-1 line-clamp-2 min-h-10 text-sm text-mute">
                  {p.description || "Aucune description."}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="flex items-center -space-x-1.5">
                    {p.equipe.slice(0, 4).map((m) => (
                      <Avatar
                        key={m.id}
                        personne={m}
                        taille="h-7 w-7 text-[11px]"
                        dore={m.id === p.responsableId}
                        classe={
                          m.id === p.responsableId ? "" : "border-2 border-white"
                        }
                      />
                    ))}
                    {p.equipe.length > 4 && (
                      <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-surface text-[11px] font-semibold text-mute">
                        +{p.equipe.length - 4}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 text-xs font-medium">
                    <span className="text-mute">
                      {p.actifs} actif{p.actifs > 1 ? "s" : ""}
                    </span>
                    {p.bloques > 0 && (
                      <span className="rounded-md bg-danger-soft px-2 py-0.5 font-semibold text-danger">
                        {p.bloques} bloqué{p.bloques > 1 ? "s" : ""}
                      </span>
                    )}
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
