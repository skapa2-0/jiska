"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ETATS } from "@/lib/sujets";
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
  const [erreur, setErreur] = useState<string | null>(null);

  const actifs = sujets.filter(
    (s) => s.etat !== "termine" && !clotures.has(s.id),
  );
  const termines = sujets.length - actifs.length;

  function fermerModal(refresh: boolean) {
    setModal(null);
    if (refresh) router.refresh();
  }

  async function cloturer(s: SujetRow) {
    if (!s.can_edit) return;
    setErreur(null);
    setClotures((prev) => new Set(prev).add(s.id));
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
        <ul className="divide-y divide-hairline rounded-lg bg-white shadow-card">
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
        </ul>
      )}
      {termines > 0 && (
        <p className="mt-2 text-xs text-stone">
          {termines} sujet{termines > 1 ? "s" : ""} terminé
          {termines > 1 ? "s" : ""} (visible{termines > 1 ? "s" : ""} dans le
          tableau)
        </p>
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
  const bloque = sujet.etat === "bloque";

  return (
    <li className="group relative">
      {/* Zone cliquable qui ouvre la fiche. La case à cocher vit en
          absolu par-dessus la même zone : c'est un vrai sibling du
          bouton, donc son clic ne remonte pas jusqu'à onOuvrir. */}
      <button
        type="button"
        onClick={onOuvrir}
        className="flex w-full items-center gap-3 py-3 pl-12 pr-4 text-left transition hover:bg-surface"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
              {sujet.title}
            </span>
            {bloque && (
              <span className="shrink-0 rounded-md bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">
                Bloqué
              </span>
            )}
          </span>
          {sujet.action && (
            <span className="mt-0.5 block truncate text-[13px] text-mute">
              {sujet.action}
            </span>
          )}
        </span>
        <span
          className={`w-20 shrink-0 whitespace-nowrap text-right text-xs ${
            retard ? "font-semibold text-danger" : "text-mute"
          }`}
        >
          {sujet.due_date
            ? sujet.due_date.split("-").reverse().join("/")
            : "-"}
        </span>
        {porteur && (
          <span className="shrink-0" title={displayName(porteur)}>
            <Avatar personne={porteur} taille="h-7 w-7 text-[10px]" />
          </span>
        )}
      </button>

      <span className="absolute left-4 top-1/2 -translate-y-1/2">
        <CaseATerminer
          etat={sujet.etat}
          disabled={!sujet.can_edit}
          onClick={onCocher}
        />
      </span>
    </li>
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
      className={`grid h-5 w-5 place-items-center rounded-md border-2 border-hairline bg-white transition ${
        disabled
          ? "cursor-not-allowed opacity-40"
          : "cursor-pointer hover:border-brand hover:bg-brand/10"
      }`}
    >
      {/* Coche signalée en fantôme au survol de la ligne : on voit ce
          que le clic va faire sans coche fixe qui dirait « déjà fait ». */}
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="h-3 w-3 text-brand opacity-0 transition group-hover:opacity-100"
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
