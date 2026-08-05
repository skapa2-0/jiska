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
  jalonTech: number;
  jalonBusiness: number;
  attribTech: number;
  attribBusiness: number;
  echeance: string | null;
  actifs: number;
  bloques: number;
  responsableId: string | null;
  equipe: Personne[];
};

const TRIS = [
  { value: "nom", label: "Par nom" },
  { value: "avancement-bas", label: "Avancement croissant" },
  { value: "avancement-haut", label: "Avancement décroissant" },
  { value: "bloques", label: "Bloqués d'abord" },
  { value: "actifs", label: "Sujets actifs" },
  { value: "echeance", label: "Prochaine échéance" },
];

// Grille des projets avec recherche libre et tri. Cartes enrichies :
// barres tech/business, prochaine échéance, alerte bloqués.
export default function ListeProjets({
  projets,
  today,
}: {
  projets: CarteProjet[];
  today: string;
}) {
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState("");

  let visibles = projets.filter((p) => {
    if (!recherche) return true;
    return `${p.name} ${p.description}`
      .toLowerCase()
      .includes(recherche.toLowerCase());
  });

  visibles = [...visibles].sort((a, b) => {
    switch (tri) {
      case "nom":
        return a.name.localeCompare(b.name, "fr");
      case "avancement-bas":
        return a.avancement - b.avancement;
      case "avancement-haut":
        return b.avancement - a.avancement;
      case "bloques":
        return b.bloques - a.bloques;
      case "actifs":
        return b.actifs - a.actifs;
      case "echeance":
        if (!a.echeance) return 1;
        if (!b.echeance) return -1;
        return a.echeance.localeCompare(b.echeance);
      default: {
        // Tri par risque : bloqués, puis retards, puis échéance proche.
        if (a.bloques !== b.bloques) return b.bloques - a.bloques;
        const ra = a.echeance !== null && a.echeance < today;
        const rb = b.echeance !== null && b.echeance < today;
        if (ra !== rb) return ra ? -1 : 1;
        if (a.echeance !== b.echeance) {
          if (!a.echeance) return 1;
          if (!b.echeance) return -1;
          return a.echeance.localeCompare(b.echeance);
        }
        return a.name.localeCompare(b.name, "fr");
      }
    }
  });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Select
          ariaLabel="Trier les produits"
          placeholder="Risque d'abord"
          value={tri}
          onChange={setTri}
          options={TRIS}
        />
        <input
          type="search"
          placeholder="Rechercher un produit…"
          aria-label="Rechercher un produit"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="ml-auto w-full rounded-lg border border-hairline bg-white px-4 py-2 text-sm text-ink placeholder-stone outline-none transition focus:ring-2 focus:ring-brand sm:w-72"
        />
      </div>

      {visibles.length === 0 ? (
        <p className="mt-20 text-center text-[15px] text-stone">
          Aucun produit ne correspond à la recherche.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibles.map((p) => {
            const retard = p.echeance !== null && p.echeance < today;
            return (
              <li key={p.id}>
                <a
                  href={`/app/produits/${p.id}`}
                  className="block rounded-lg bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgb(25_28_31/0.08),0_8px_20px_rgb(25_28_31/0.10)]"
                >
                  <div className="flex items-center justify-between gap-3">
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

                  <div className="mt-3 space-y-2">
                    <Barre nom="Tech" valeur={p.jalonTech} />
                    <Barre nom="Bus." valeur={p.jalonBusiness} />
                    {/* Signal discret : l'orange plein est réservé aux
                        vraies alertes (bloqués, retards). */}
                    {(p.attribTech < 100 || p.attribBusiness < 100) && (
                      <p className="flex items-center gap-1.5 text-[11px] font-medium text-stone">
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn"
                        />
                        Pondération : Tech {p.attribTech} % · Bus.{" "}
                        {p.attribBusiness} %
                      </p>
                    )}
                  </div>

                  <div className="mt-3.5 flex min-h-6 items-center gap-2 text-xs font-medium">
                    {p.echeance ? (
                      <span
                        className={`flex items-center gap-1 ${retard ? "text-danger" : "text-mute"}`}
                        title="Prochaine échéance"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-3.5 w-3.5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3-3v4m8-4v4M4 11h16" />
                        </svg>
                        {p.echeance.split("-").reverse().join("/")}
                      </span>
                    ) : (
                      <span className="text-stone">Aucune échéance</span>
                    )}
                    {p.bloques > 0 && (
                      <span className="rounded-md bg-danger-soft px-2 py-0.5 font-semibold text-danger">
                        ⚠ {p.bloques} bloqué{p.bloques > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3">
                    <span className="flex items-center -space-x-1.5">
                      {p.equipe.slice(0, 4).map((m) => (
                        <Avatar
                          key={m.id}
                          personne={m}
                          taille="h-7 w-7 text-[11px]"
                          dore={m.id === p.responsableId}
                          classe={
                            m.id === p.responsableId
                              ? ""
                              : "border-2 border-white"
                          }
                        />
                      ))}
                      {p.equipe.length > 4 && (
                        <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-surface text-[11px] font-semibold text-mute">
                          +{p.equipe.length - 4}
                        </span>
                      )}
                    </span>
                    <span className="text-xs font-medium text-mute">
                      {p.actifs} sujet{p.actifs > 1 ? "s" : ""} actif
                      {p.actifs > 1 ? "s" : ""}
                    </span>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Barre({ nom, valeur }: { nom: string; valeur: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-[11px] font-medium text-stone">
        {nom}
      </span>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full rounded-full ${valeur >= 75 ? "bg-success" : "bg-warn"}`}
          style={{ width: `${valeur}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-[11px] font-semibold text-ink">
        {valeur} %
      </span>
    </div>
  );
}
