"use client";

import { useEffect, useState } from "react";
import { CRITICITES, ETATS } from "@/lib/sujets";
import type { SujetRow } from "@/lib/sujets";
import Avatar, { displayName } from "./avatar";
import type { ProjectOption } from "./dashboard";
import ProjetLogo from "./projet-logo";

// Fiche détaillée d'un sujet : panneau qui glisse depuis la droite,
// par-dessus tout. C'est ici que vit le commentaire complet.
export default function FicheSujet({
  sujet,
  projet,
  today,
  onClose,
  onEdit,
}: {
  sujet: SujetRow;
  projet?: ProjectOption;
  today: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") fermer();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fermer() {
    setVisible(false);
    window.setTimeout(onClose, 250);
  }

  const retard =
    sujet.due_date && sujet.due_date < today && sujet.etat !== "termine";
  const joursRetard = retard
    ? Math.round((Date.parse(today) - Date.parse(sujet.due_date!)) / 86400000)
    : 0;
  const respId = projet?.responsableId ?? null;
  const equipe = [...(projet?.members ?? [])].sort((a, b) =>
    a.id === respId ? -1 : b.id === respId ? 1 : 0,
  );

  return (
    <div className="fixed inset-0 z-30">
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
        aria-label={`Fiche du sujet ${sujet.title}`}
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-[-12px_0_32px_rgb(25_28_31/0.18)] transition-transform duration-300 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center gap-3 border-b border-hairline px-6 py-4">
          <ProjetLogo
            name={sujet.project_name}
            logo={sujet.project_logo}
            taille="h-9 w-9 text-lg"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-stone">
              {sujet.project_name}
            </span>
            <span className="block truncate font-semibold text-ink">
              Fiche sujet
            </span>
          </span>
          <button
            type="button"
            onClick={fermer}
            aria-label="Fermer la fiche"
            className="rounded-lg px-2.5 py-1 text-lg text-mute transition hover:bg-surface"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div>
            <h2 className="font-display text-2xl font-medium leading-tight tracking-[-0.01em] text-ink">
              {sujet.title}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Chip classe={ETATS[sujet.etat].chip}>
                {ETATS[sujet.etat].label}
              </Chip>
              <Chip classe={CRITICITES[sujet.criticite].chip}>
                Criticité {CRITICITES[sujet.criticite].label.toLowerCase()}
              </Chip>
            </div>
          </div>

          <Bloc titre="Action de la semaine">
            <p className="text-sm text-ink">
              {sujet.action || <span className="text-stone">Aucune action définie</span>}
            </p>
          </Bloc>

          <Bloc titre="Échéance">
            <p className="text-sm font-medium text-ink">
              {sujet.due_date
                ? sujet.due_date.split("-").reverse().join("/")
                : "Aucune échéance"}
              {retard && (
                <span className="ml-2 rounded-md bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
                  ⚠ {joursRetard} jour{joursRetard > 1 ? "s" : ""} de retard
                </span>
              )}
            </p>
          </Bloc>


          <Bloc titre="Équipe">
            <ul className="space-y-2">
              {equipe.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 text-sm">
                  <Avatar
                    personne={m}
                    taille="h-7 w-7 text-[11px]"
                    dore={m.id === respId}
                  />
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {displayName(m)}
                  </span>
                  {m.id === respId && (
                    <span className="text-xs font-semibold text-brand">
                      Responsable
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Bloc>

          {sujet.commentaire && (
            <Bloc titre="Commentaire">
              <div className="flex gap-2.5 rounded-lg bg-surface p-4">
                <IconeCommentaire className="mt-0.5 h-4 w-4 shrink-0 text-stone" />
                <p className="whitespace-pre-wrap text-sm text-ink">
                  {sujet.commentaire}
                </p>
              </div>
            </Bloc>
          )}
        </div>

        {sujet.can_edit && (
          <footer className="border-t border-hairline px-6 py-4">
            <button
              type="button"
              onClick={onEdit}
              className="w-full rounded-lg bg-ink py-3 text-sm font-semibold text-white transition hover:opacity-85"
            >
              Modifier le sujet
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}

function Bloc({
  titre,
  children,
}: {
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone">
        {titre}
      </h3>
      {children}
    </section>
  );
}

function Chip({
  classe,
  children,
}: {
  classe: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${classe}`}
    >
      {children}
    </span>
  );
}


export function IconeCommentaire({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a8 8 0 0 1-8 8H4l2.4-2.4A8 8 0 1 1 21 12Z" />
    </svg>
  );
}
