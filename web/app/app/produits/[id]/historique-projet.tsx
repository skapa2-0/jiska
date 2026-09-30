"use client";

import { useMemo, useState } from "react";
import { CRITICITES, ETATS, TYPES_SUJET } from "@/lib/sujets";
import Avatar, { displayName } from "../../avatar";
import type { Personne } from "../../avatar";
import Select from "../../select";

// Une entrée d'historique porte la valeur lisible (déjà traduite côté
// serveur : « Terminé » plutôt que « termine ») ET la valeur brute
// (« termine ») qui sert à choisir la pastille colorée à afficher.
export type EntreeHistorique = {
  dateIso: string; // 2026-10-07, sert au regroupement par jour
  heure: string; // 14:32
  auteur: Personne | null;
  sujetId: string;
  titre: string;
  champRaw: string; // "etat", "criticite", "porteur_id"…
  champLibelle: string; // "l'état", "la criticité"…
  ancien: string; // valeur lisible ou nom
  nouveau: string;
  ancienBrut: string | null; // "termine", "haute"… pour choisir un chip
  nouveauBrut: string | null;
  creation: boolean;
};

const PAS = 25;

// Icône dépendant du champ modifié : donne un signal visuel avant même
// de lire. Trois familles : contenu textuel (crayon), état / criticité /
// type (pastille), échéance (calendrier), porteur (personne), création
// (étoile).
const ICONES: Record<
  string,
  { chemin: string; ton: string; fond: string }
> = {
  creation: {
    chemin: "M12 3v18M3 12h18",
    ton: "text-brand",
    fond: "bg-brand/10",
  },
  etat: {
    chemin: "M12 2 4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4Z",
    ton: "text-info",
    fond: "bg-info-soft",
  },
  criticite: {
    chemin: "M12 3 2 20h20L12 3Zm0 6v5m0 3v.01",
    ton: "text-warn",
    fond: "bg-warn-soft",
  },
  type: {
    chemin: "M20 12H4m0 0 6-6m-6 6 6 6",
    ton: "text-mute",
    fond: "bg-surface",
  },
  due_date: {
    chemin:
      "M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3-3v4m8-4v4M4 11h16",
    ton: "text-mute",
    fond: "bg-surface",
  },
  porteur_id: {
    chemin: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
    ton: "text-mute",
    fond: "bg-surface",
  },
  action: {
    chemin: "m4 20 4-1 12-12-3-3L5 16l-1 4Z",
    ton: "text-mute",
    fond: "bg-surface",
  },
  commentaire: {
    chemin: "M4 5h16v10a2 2 0 0 1-2 2H8l-4 4V5Z",
    ton: "text-mute",
    fond: "bg-surface",
  },
  title: {
    chemin: "m4 20 4-1 12-12-3-3L5 16l-1 4Z",
    ton: "text-mute",
    fond: "bg-surface",
  },
};
const ICONE_DEFAUT = ICONES.title;

function iconePour(champ: string, creation: boolean) {
  if (creation) return ICONES.creation;
  return ICONES[champ] ?? ICONE_DEFAUT;
}

// Libellé du jour pour l'en-tête de section : aujourd'hui, hier, ou
// une date longue en français. Compare des chaînes ISO (YYYY-MM-DD),
// pas des Dates, pour éviter les glissements de fuseau horaire.
function libelleJour(iso: string, today: string): string {
  if (iso === today) return "Aujourd'hui";
  const hier = new Date(today);
  hier.setDate(hier.getDate() - 1);
  const hierIso = hier.toISOString().slice(0, 10);
  if (iso === hierIso) return "Hier";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year:
      date.getFullYear() === new Date(today).getFullYear()
        ? undefined
        : "numeric",
  });
}

// Rendu d'une valeur (avant ou après) selon le champ : chip coloré
// pour les états typés, texte pour le reste. Une valeur vide se lit
// « - » en gris, jamais un blanc.
function ValeurBadge({
  champ,
  valeur,
  brut,
}: {
  champ: string;
  valeur: string;
  brut: string | null;
}) {
  if (!brut || valeur === "-") {
    return <span className="text-stone">-</span>;
  }
  if (champ === "etat" && brut in ETATS) {
    const meta = ETATS[brut as keyof typeof ETATS];
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold leading-none ${meta.chip}`}
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
        />
        {meta.label}
      </span>
    );
  }
  if (champ === "criticite" && brut in CRITICITES) {
    const meta = CRITICITES[brut as keyof typeof CRITICITES];
    return (
      <span
        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold leading-none ${meta.chip}`}
      >
        {meta.label}
      </span>
    );
  }
  if (champ === "type" && brut in TYPES_SUJET) {
    const meta = TYPES_SUJET[brut as keyof typeof TYPES_SUJET];
    return (
      <span
        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold leading-none ${meta.chip}`}
      >
        {meta.court}
      </span>
    );
  }
  return (
    <span className="rounded-md bg-surface px-2 py-0.5 text-xs text-ink">
      {valeur}
    </span>
  );
}

// Fil d'historique du projet : filtre par sujet, regroupement par jour,
// une carte par événement avec avatar, icône, avant → après.
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
  const today = new Date().toISOString().slice(0, 10);

  // Regroupement par jour. On garde l'ordre d'origine (déjà DESC côté SQL).
  const groupes = useMemo(() => {
    const acc: { jour: string; items: EntreeHistorique[] }[] = [];
    for (const e of visibles) {
      const dernier = acc[acc.length - 1];
      if (dernier && dernier.jour === e.dateIso) dernier.items.push(e);
      else acc.push({ jour: e.dateIso, items: [e] });
    }
    return acc;
  }, [visibles]);

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
        <div className="space-y-6">
          {groupes.map((g) => (
            <div key={g.jour}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone">
                {libelleJour(g.jour, today)}
              </h3>
              <ul className="space-y-1.5">
                {g.items.map((e, i) => (
                  <EntreeCarte key={`${g.jour}-${i}`} entree={e} />
                ))}
              </ul>
            </div>
          ))}
        </div>
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

function EntreeCarte({ entree: e }: { entree: EntreeHistorique }) {
  const icone = iconePour(e.champRaw, e.creation);
  return (
    <li className="flex gap-3 rounded-lg bg-white p-3 shadow-card">
      <span
        aria-hidden="true"
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${icone.fond}`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 ${icone.ton}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={icone.chemin} />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[11px] text-stone">
          {e.auteur ? (
            <span className="flex items-center gap-1.5">
              <Avatar personne={e.auteur} taille="h-4 w-4 text-[8px]" />
              <span>{displayName(e.auteur)}</span>
            </span>
          ) : (
            <span>Système</span>
          )}
          <span aria-hidden="true">·</span>
          <span>{e.heure}</span>
        </p>
        <p className="mt-1 truncate text-sm font-semibold leading-tight text-ink">
          {e.titre}
        </p>
        {e.creation ? (
          <p className="mt-1 text-xs font-medium text-brand">Sujet créé</p>
        ) : (
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-mute">
            <span>{e.champLibelle}</span>
            <ValeurBadge
              champ={e.champRaw}
              valeur={e.ancien}
              brut={e.ancienBrut}
            />
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="h-3 w-3 shrink-0 text-stone"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 4 10 8l-4 4" />
            </svg>
            <ValeurBadge
              champ={e.champRaw}
              valeur={e.nouveau}
              brut={e.nouveauBrut}
            />
          </p>
        )}
      </div>
    </li>
  );
}
