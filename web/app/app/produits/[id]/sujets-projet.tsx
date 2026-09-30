"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CRITICITES, ETATS, TYPES_SUJET } from "@/lib/sujets";
import type { SujetRow } from "@/lib/sujets";
import Avatar, { displayName } from "../../avatar";
import type { ProjectOption } from "../../dashboard";
import FicheSujet from "../../fiche-sujet";
import SujetModal from "../../sujet-modal";

// Sujets du produit : une ligne par sujet, une case à cocher qui clôt
// la tâche d'un clic, l'essentiel visible (titre + action + échéance +
// porteur). Type, criticité et émetteur restent accessibles dans la
// fiche (clic sur la ligne). Un sujet bloqué porte une pastille rouge
// discrète : le signal reste lisible sans encombrer la ligne.
export default function SujetsProjet({
  sujets,
  projet,
  today,
}: {
  sujets: SujetRow[];
  projet: ProjectOption;
  // Prop conservée pour compat (page produit la passe encore), l'info
  // « émis par » migre vers la fiche.
  emetteurs?: Record<string, string>;
  today: string;
}) {
  const router = useRouter();
  const [fiche, setFiche] = useState<SujetRow | null>(null);
  const [modal, setModal] = useState<
    { mode: "create" } | { mode: "edit"; sujet: SujetRow } | null
  >(null);
  // Optimistic : id des sujets qu'on vient de clôturer et qui n'ont pas
  // encore été effacés par router.refresh(). Sinon la ligne resterait
  // jusqu'à ce que le rendu serveur revienne, ce qui donne l'impression
  // que le clic n'a rien fait.
  const [clotures, setClotures] = useState<Set<string>>(new Set());
  // Sujets rouverts en optimistic (id → nouvel état pour rester
  // hors des « terminés » le temps que le rendu serveur revienne).
  const [rouvertsOpt, setRouvertsOpt] = useState<Set<string>>(new Set());
  const [erreur, setErreur] = useState<string | null>(null);
  const [voirTermines, setVoirTermines] = useState(false);

  const estTermineOpt = (s: SujetRow) =>
    (s.etat === "termine" || clotures.has(s.id)) && !rouvertsOpt.has(s.id);
  const actifs = sujets.filter((s) => !estTermineOpt(s));
  const termines = sujets.filter((s) => estTermineOpt(s));

  function fermerModal(refresh: boolean) {
    setModal(null);
    if (refresh) router.refresh();
  }

  async function cloturer(s: SujetRow) {
    if (!s.can_edit) return;
    setErreur(null);
    setClotures((prev) => new Set(prev).add(s.id));
    setRouvertsOpt((prev) => {
      const suivant = new Set(prev);
      suivant.delete(s.id);
      return suivant;
    });
    try {
      const res = await fetch(`/api/sujets/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etat: "termine" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Échec de la clôture.");
      }
      router.refresh();
    } catch (e) {
      // On remet la ligne : le clic est resté sans suite.
      setClotures((prev) => {
        const suivant = new Set(prev);
        suivant.delete(s.id);
        return suivant;
      });
      setErreur(e instanceof Error ? e.message : "Échec de la clôture.");
    }
  }

  async function rouvrir(s: SujetRow) {
    if (!s.can_edit) return;
    setErreur(null);
    setRouvertsOpt((prev) => new Set(prev).add(s.id));
    setClotures((prev) => {
      const suivant = new Set(prev);
      suivant.delete(s.id);
      return suivant;
    });
    try {
      const res = await fetch(`/api/sujets/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etat: "a_faire" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Échec de la réouverture.");
      }
      router.refresh();
    } catch (e) {
      setRouvertsOpt((prev) => {
        const suivant = new Set(prev);
        suivant.delete(s.id);
        return suivant;
      });
      setErreur(e instanceof Error ? e.message : "Échec de la réouverture.");
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone">
          Sujets actifs
        </h2>
        {projet.canManage && (
          <button
            type="button"
            onClick={() => setModal({ mode: "create" })}
            className="flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-1.5 text-sm font-semibold text-white transition hover:opacity-85"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
            Nouveau sujet
          </button>
        )}
      </div>

      {erreur && (
        <p
          role="alert"
          className="mb-2 rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger"
        >
          {erreur}
        </p>
      )}

      {actifs.length === 0 ? (
        <p className="text-sm text-stone">Aucun sujet actif sur ce produit.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow-card">
          {/* table-fixed : les largeurs de colonnes déclarées dans le
              thead s'imposent, sinon un titre long refuse de tronquer.
              min-w assure un scroll horizontal en dessous d'un seuil
              plutôt qu'un tassement illisible. */}
          <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-[11px] font-semibold uppercase tracking-wide text-stone">
                <th scope="col" className="w-12 py-2.5 pl-4 text-left">
                  <span className="sr-only">Terminé</span>
                </th>
                <th scope="col" className="py-2.5 pr-3 text-left font-semibold">
                  Sujet
                </th>
                <th scope="col" className="w-24 py-2.5 pr-3 text-center font-semibold">
                  Type
                </th>
                <th scope="col" className="w-28 py-2.5 pr-3 text-center font-semibold">
                  Criticité
                </th>
                <th scope="col" className="w-28 py-2.5 pr-3 text-center font-semibold">
                  État
                </th>
                <th scope="col" className="w-24 py-2.5 pr-3 text-center font-semibold">
                  Échéance
                </th>
                <th scope="col" className="w-20 py-2.5 pr-4 text-center font-semibold">
                  Porteur
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {actifs.map((s) => (
                <LigneSujet
                  key={s.id}
                  sujet={s}
                  projet={projet}
                  today={today}
                  onCocher={() => cloturer(s)}
                  onOuvrir={() => setFiche(s)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {termines.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setVoirTermines((v) => !v)}
            aria-expanded={voirTermines}
            className="flex items-center gap-1.5 text-xs font-medium text-stone transition hover:text-ink"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className={`h-3.5 w-3.5 transition-transform ${voirTermines ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 4 4 4-4 4" />
            </svg>
            {termines.length} sujet{termines.length > 1 ? "s" : ""} terminé
            {termines.length > 1 ? "s" : ""}
          </button>
          {voirTermines && (
            <ul className="mt-2 divide-y divide-hairline rounded-lg bg-surface/60">
              {termines.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5 shrink-0 text-success"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m3 8 3.5 3.5L13 5" />
                  </svg>
                  <span className="min-w-0 flex-1 truncate text-sm text-mute line-through">
                    {s.title}
                  </span>
                  {s.can_edit && (
                    <button
                      type="button"
                      onClick={() => rouvrir(s)}
                      className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-brand transition hover:bg-brand/10"
                    >
                      Rouvrir
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {fiche && (
        <FicheSujet
          sujet={fiche}
          projet={projet}
          today={today}
          onClose={() => setFiche(null)}
        />
      )}

      {modal && (
        <SujetModal
          peutTransverse={false}
          mode={modal.mode}
          sujet={modal.mode === "edit" ? modal.sujet : undefined}
          projects={[projet]}
          onClose={fermerModal}
        />
      )}
    </section>
  );
}

function LigneSujet({
  sujet,
  projet,
  today,
  onCocher,
  onOuvrir,
}: {
  sujet: SujetRow;
  projet: ProjectOption;
  today: string;
  onCocher: () => void;
  onOuvrir: () => void;
}) {
  const retard = !!sujet.due_date && sujet.due_date < today;
  const porteur = projet.members.find((m) => m.id === sujet.porteur_id);
  const etatMeta = ETATS[sujet.etat as keyof typeof ETATS];

  return (
    <tr
      className="cursor-pointer transition hover:bg-surface"
      // Clic sur la ligne = ouvre la fiche. La case à cocher fait
      // stopPropagation pour ne pas déclencher cette ouverture.
      onClick={onOuvrir}
    >
      <td className="py-3 pl-4 align-middle" onClick={(e) => e.stopPropagation()}>
        <CaseATerminer
          etat={sujet.etat}
          disabled={!sujet.can_edit}
          onClick={onCocher}
        />
      </td>
      <td className="py-3 pr-3 align-middle">
        {/* Sujet : collé à gauche, tronqué avec « … » si trop long. */}
        <span className="block truncate font-semibold text-ink">
          {sujet.title}
        </span>
      </td>
      <td className="py-3 pr-3 text-center align-middle">
        <span
          className={`inline-block max-w-full truncate rounded-md px-2 py-0.5 text-[11px] font-semibold ${TYPES_SUJET[sujet.type].chip}`}
        >
          {TYPES_SUJET[sujet.type].court}
        </span>
      </td>
      <td className="py-3 pr-3 text-center align-middle">
        {sujet.criticite === "critique" || sujet.criticite === "haute" ? (
          <span
            className={`inline-block max-w-full truncate rounded-md px-2 py-0.5 text-[11px] font-semibold ${CRITICITES[sujet.criticite].chip}`}
          >
            {CRITICITES[sujet.criticite].label}
          </span>
        ) : (
          <span className="text-xs text-stone">
            {CRITICITES[sujet.criticite].label}
          </span>
        )}
      </td>
      <td className="py-3 pr-3 text-center align-middle">
        <span
          className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-md px-2 py-0.5 text-[11px] font-semibold ${etatMeta.chip}`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${etatMeta.dot}`}
          />
          {etatMeta.label}
        </span>
      </td>
      <td
        className={`whitespace-nowrap py-3 pr-3 text-center align-middle text-xs ${
          retard ? "font-semibold text-danger" : "text-mute"
        }`}
      >
        {sujet.due_date ? sujet.due_date.split("-").reverse().join("/") : "-"}
      </td>
      <td className="py-3 pr-4 text-center align-middle">
        {porteur ? (
          <span
            className="inline-flex"
            title={displayName(porteur)}
            aria-label={displayName(porteur)}
          >
            <Avatar personne={porteur} taille="h-7 w-7 text-[10px]" />
          </span>
        ) : (
          <span className="text-xs text-stone">-</span>
        )}
      </td>
    </tr>
  );
}

// Case à cocher maison (règle DA : pas de contrôle natif). Cochée =
// tâche terminée. Sur ce composant elle reste toujours décochée à
// l'affichage (les terminés sont filtrés), sa vraie fonction est de
// clore la tâche en un clic.
function CaseATerminer({
  etat,
  disabled,
  onClick,
}: {
  etat: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const label = ETATS[etat as keyof typeof ETATS]?.label ?? etat;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={false}
      aria-label={`Marquer terminé (actuellement ${label})`}
      onClick={onClick}
      disabled={disabled}
      className={`group/case grid h-5 w-5 place-items-center rounded-md border-2 border-hairline bg-white transition ${
        disabled
          ? "cursor-not-allowed opacity-40"
          : "cursor-pointer hover:border-brand hover:bg-brand/10"
      }`}
    >
      {/* Coche fantôme au survol de la case seulement (pas de la ligne) :
          survoler la ligne ne doit pas suggérer que le clic va valider,
          c'est un clic dans la case qui fait ça. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="h-3 w-3 text-brand opacity-0 transition group-hover/case:opacity-100"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m3 8 3.5 3.5L13 5" />
      </svg>
    </button>
  );
}
