"use client";

import { useEffect, useMemo, useState } from "react";
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

// Nombre d'entrées visibles dans la colonne latérale ; au-delà on
// ouvre le tiroir latéral qui montre tout.
const APERCU = 5;

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

// Fil d'historique du projet : aperçu compact (5 dernières entrées)
// visible en colonne latérale ; « Voir tout » ouvre un panneau latéral
// à droite avec la liste complète et un filtre par sujet.
export default function HistoriqueProjet({
  entrees,
}: {
  entrees: EntreeHistorique[];
}) {
  const [tiroir, setTiroir] = useState(false);
  const apercu = entrees.slice(0, APERCU);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone">
          Historique
        </h2>
        {entrees.length > 0 && (
          <button
            type="button"
            onClick={() => setTiroir(true)}
            className="flex items-center gap-1.5 rounded-lg border border-hairline px-3.5 py-1.5 text-sm font-semibold text-ink transition hover:bg-surface"
          >
            Voir tout
          </button>
        )}
      </div>

      {apercu.length === 0 ? (
        <p className="text-sm text-stone">
          Aucune modification enregistrée pour l&apos;instant.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {apercu.map((e, i) => (
            <EntreeCarte key={i} entree={e} />
          ))}
        </ul>
      )}

      {tiroir && (
        <TiroirHistorique
          entrees={entrees}
          onFermer={() => setTiroir(false)}
        />
      )}
    </section>
  );
}

function grouperParJour(entrees: EntreeHistorique[]) {
  const acc: { jour: string; items: EntreeHistorique[] }[] = [];
  for (const e of entrees) {
    const dernier = acc[acc.length - 1];
    if (dernier && dernier.jour === e.dateIso) dernier.items.push(e);
    else acc.push({ jour: e.dateIso, items: [e] });
  }
  return acc;
}

// Tiroir latéral droit : mêmes cartes que l'aperçu, tout l'historique,
// filtre par sujet. Ouverture avec fond assombri, fermeture Échap ou
// clic hors panneau. Structure calquée sur FicheSujet pour cohérence.
function TiroirHistorique({
  entrees,
  onFermer,
}: {
  entrees: EntreeHistorique[];
  onFermer: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [sujetId, setSujetId] = useState("");

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") fermer();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fermer() {
    setVisible(false);
    // Laisser jouer la sortie avant de démonter.
    window.setTimeout(onFermer, 300);
  }

  const sujets = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of entrees) if (!seen.has(e.sujetId)) seen.set(e.sujetId, e.titre);
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [entrees]);

  const filtrees = sujetId
    ? entrees.filter((e) => e.sujetId === sujetId)
    : entrees;
  const today = new Date().toISOString().slice(0, 10);
  const groupes = grouperParJour(filtrees);

  return (
    <div className="fixed inset-0 z-40">
      <div
        aria-hidden="true"
        onClick={fermer}
        className={`absolute inset-0 bg-ink/30 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Historique complet du produit"
        className={`absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white shadow-[-12px_0_32px_rgb(25_28_31/0.18)] transition-transform duration-300 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-medium tracking-[-0.01em] text-ink">
              Historique du produit
            </h2>
            <p className="mt-0.5 text-xs text-stone">
              {entrees.length} événement{entrees.length > 1 ? "s" : ""}{" "}
              enregistré{entrees.length > 1 ? "s" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={fermer}
            aria-label="Fermer l'historique"
            className="rounded-md p-1.5 text-stone transition hover:bg-surface hover:text-ink"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        {sujets.length > 1 && (
          <div className="border-b border-hairline px-5 py-3">
            <Select
              ariaLabel="Filtrer l'historique par sujet"
              placeholder="Tous les sujets"
              value={sujetId}
              onChange={setSujetId}
              options={sujets}
              variante="champ"
            />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {filtrees.length === 0 ? (
            <p className="text-sm text-stone">
              Aucune modification pour ce filtre.
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
                      <EntreeCarte
                        key={`${g.jour}-${i}`}
                        entree={e}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
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
