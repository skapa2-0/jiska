"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CRITICITES, ETATS, TYPES_SUJET } from "@/lib/sujets";
import type { SujetRow } from "@/lib/sujets";
import type { ProjectOption } from "../../dashboard";
import FicheSujet from "../../fiche-sujet";
import SujetModal from "../../sujet-modal";

// Sujets du projet : lignes cliquables (fiche latérale + édition) et
// création d'un sujet directement scopée au projet.
export default function SujetsProjet({
  sujets,
  projet,
  today,
}: {
  sujets: SujetRow[];
  projet: ProjectOption;
  today: string;
}) {
  const router = useRouter();
  const [fiche, setFiche] = useState<SujetRow | null>(null);
  const [modal, setModal] = useState<
    { mode: "create" } | { mode: "edit"; sujet: SujetRow } | null
  >(null);

  const actifs = sujets.filter((s) => s.etat !== "termine");
  const termines = sujets.length - actifs.length;

  function fermerModal(refresh: boolean) {
    setModal(null);
    if (refresh) router.refresh();
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

      {actifs.length === 0 ? (
        <p className="text-sm text-stone">Aucun sujet actif sur ce projet.</p>
      ) : (
        <ul className="divide-y divide-hairline rounded-lg bg-white shadow-card">
          {actifs.map((s) => {
            const retard =
              s.due_date && s.due_date < today && s.etat !== "termine";
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setFiche(s)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface"
                >
                  <span
                    title={ETATS[s.etat].label}
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${ETATS[s.etat].dot}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                    {s.title}
                  </span>
                  <span
                    className={`hidden rounded-md px-2 py-0.5 text-xs font-semibold sm:inline ${TYPES_SUJET[s.type].chip}`}
                  >
                    {TYPES_SUJET[s.type].court} · {s.poids} %
                  </span>
                  <span
                    className={`hidden rounded-md px-2 py-0.5 text-xs font-semibold sm:inline ${CRITICITES[s.criticite].chip}`}
                  >
                    {CRITICITES[s.criticite].label}
                  </span>
                  <span
                    className={`w-20 whitespace-nowrap text-right text-xs ${
                      retard ? "font-semibold text-danger" : "text-mute"
                    }`}
                  >
                    {s.due_date
                      ? s.due_date.split("-").reverse().join("/")
                      : "-"}
                  </span>
                </button>
              </li>
            );
          })}
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
          mode={modal.mode}
          sujet={modal.mode === "edit" ? modal.sujet : undefined}
          projects={[projet]}
          onClose={fermerModal}
        />
      )}
    </section>
  );
}
