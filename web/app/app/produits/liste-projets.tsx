"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Avatar, { displayName } from "../avatar";
import type { Personne } from "../avatar";
import ProjetLogo from "../projet-logo";
import BadgeDeployable from "../deployable";
import Roue, { tonAvancement } from "../roue";
import Select from "../select";

export type CarteProjet = {
  id: string;
  name: string;
  description: string;
  logo: string | null;
  deployable: boolean;
  avancement: number;
  jalonTech: number;
  jalonBusiness: number;
  attribTech: number;
  attribBusiness: number;
  echeance: string | null;
  actifs: number;
  bloques: number;
  retards: number;
  derniere: string | null;
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

// Jours d'inactivité au-delà desquels un produit est « en sommeil ».
const SOMMEIL_JOURS = 14;

function joursDepuis(iso: string | null, today: string): number | null {
  if (!iso) return null;
  return Math.round((Date.parse(today) - Date.parse(iso)) / 86400000);
}

// Grille des produits avec recherche libre et tri. Par défaut (tri
// « risque »), les cartes sont regroupées en sections : À risque,
// En cours, En sommeil.
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
        if (a.retards !== b.retards) return b.retards - a.retards;
        if (a.echeance !== b.echeance) {
          if (!a.echeance) return 1;
          if (!b.echeance) return -1;
          return a.echeance.localeCompare(b.echeance);
        }
        return a.name.localeCompare(b.name, "fr");
      }
    }
  });

  // Sections uniquement dans l'ordre risque : un tri explicite rend
  // une grille plate.
  const groupes = [
    { titre: "À risque", items: [] as CarteProjet[] },
    { titre: "En cours", items: [] as CarteProjet[] },
    { titre: "En sommeil", items: [] as CarteProjet[] },
  ];
  if (!tri) {
    for (const p of visibles) {
      const inactifs = joursDepuis(p.derniere, today);
      const i =
        p.bloques > 0 || p.retards > 0
          ? 0
          : inactifs === null || inactifs > SOMMEIL_JOURS
            ? 2
            : 1;
      groupes[i].items.push(p);
    }
  }

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
      ) : tri ? (
        <Grille projets={visibles} today={today} />
      ) : (
        groupes.map(
          (g) =>
            g.items.length > 0 && (
              <section key={g.titre} className="mb-7 last:mb-0">
                <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wide text-stone">
                  {g.titre}
                  <span className="font-medium normal-case tracking-normal">
                    {g.items.length}
                  </span>
                </h2>
                <Grille projets={g.items} today={today} />
              </section>
            ),
        )
      )}
    </>
  );
}

function Grille({
  projets,
  today,
}: {
  projets: CarteProjet[];
  today: string;
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {projets.map((p) => (
        <Carte key={p.id} p={p} today={today} />
      ))}
    </ul>
  );
}

function Carte({ p, today }: { p: CarteProjet; today: string }) {
  const router = useRouter();
  const retard = p.echeance !== null && p.echeance < today;
  const responsable = p.equipe.find((m) => m.id === p.responsableId);
  const inactifs = joursDepuis(p.derniere, today);
  const ouvrir = () => router.push(`/app/produits/${p.id}`);

  return (
    <li>
      {/* Toute la carte ouvre le détail ; le lien Actions, lui, mène
          au tableau filtré sans passer par le détail. */}
      <div
        role="link"
        tabIndex={0}
        onClick={ouvrir}
        onKeyDown={(e) => e.key === "Enter" && ouvrir()}
        className="flex h-full cursor-pointer flex-col rounded-lg bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgb(25_28_31/0.08),0_8px_20px_rgb(25_28_31/0.10)]"
      >
        <div className="flex items-center justify-between gap-3">
          <ProjetLogo name={p.name} logo={p.logo} taille="h-10 w-10 text-xl" />
          <Roue
            valeur={p.avancement}
            ton={tonAvancement(p.avancement)}
            taille="h-11 w-11"
          />
        </div>

        <h2 className="mt-3 line-clamp-1 font-display text-lg font-semibold text-ink">
          {p.name}
        </h2>
        <p className="mt-0.5 line-clamp-1 text-xs text-stone">
          {p.description || "Aucune description"}
        </p>
        <p className="mt-2.5">
          <BadgeDeployable deployable={p.deployable} />
        </p>

        <div className="mt-3 space-y-2">
          <Barre nom="Tech" valeur={p.jalonTech} />
          <Barre nom="Bus." valeur={p.jalonBusiness} />
          {/* Signal discret : l'orange plein est réservé aux vraies
              alertes (bloqués, retards). */}
          {(p.attribTech < 100 || p.attribBusiness < 100) && (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-stone">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn"
              />
              Pondération : Tech {p.attribTech} % · Bus. {p.attribBusiness} %
            </p>
          )}
        </div>

        <div className="mt-3.5 flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium">
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
              {p.bloques} bloqué{p.bloques > 1 ? "s" : ""}
            </span>
          )}
          {p.retards > 0 && (
            <span className="rounded-md bg-danger-soft px-2 py-0.5 font-semibold text-danger">
              {p.retards} retard{p.retards > 1 ? "s" : ""}
            </span>
          )}
          <span className="ml-auto text-stone">
            {inactifs === null
              ? "Aucune activité"
              : inactifs <= 0
                ? "MàJ aujourd'hui"
                : `MàJ il y a ${inactifs} j`}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-hairline pt-3">
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex shrink-0 items-center -space-x-1.5">
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
            {responsable && (
              <span className="min-w-0 truncate text-xs text-mute">
                {displayName(responsable)}
              </span>
            )}
          </span>
          <a
            href={`/app/actions?projet=${p.id}`}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-brand transition hover:bg-brand/5"
          >
            {p.actifs} action{p.actifs > 1 ? "s" : ""} ›
          </a>
        </div>
      </div>
    </li>
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
