"use client";

import { useEffect, useState } from "react";
import {
  avancementGlobal,
  CRITICITES,
  ETATS,
  JALONS_BUSINESS,
  JALONS_TECH,
} from "@/lib/sujets";
import type { SujetRow } from "@/lib/sujets";
import type { ProjectOption } from "./dashboard";

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

  const global = avancementGlobal(sujet.jalon_tech, sujet.jalon_business);
  const retard =
    sujet.due_date && sujet.due_date < today && sujet.etat !== "termine";
  const joursRetard = retard
    ? Math.round((Date.parse(today) - Date.parse(sujet.due_date!)) / 86400000)
    : 0;
  const equipe = [...(projet?.members ?? [])].sort((a, b) =>
    a.id === sujet.responsable_id ? -1 : b.id === sujet.responsable_id ? 1 : 0,
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
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg"
            style={{ backgroundColor: `${sujet.project_color}1a` }}
          >
            {sujet.project_icon}
          </span>
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

          <Bloc titre="Avancement">
            <div className="space-y-3">
              <Avancement
                nom="Technique"
                valeur={sujet.jalon_tech}
                jalon={JALONS_TECH[sujet.jalon_tech as 0]}
              />
              <Avancement
                nom="Business"
                valeur={sujet.jalon_business}
                jalon={JALONS_BUSINESS[sujet.jalon_business as 0]}
              />
              <p className="border-t border-hairline pt-3 text-sm text-mute">
                Global{" "}
                <span
                  className={`font-display text-lg font-semibold ${
                    global >= 75
                      ? "text-success"
                      : global >= 50
                        ? "text-warn"
                        : "text-danger"
                  }`}
                >
                  {global} %
                </span>{" "}
                <span className="text-xs text-stone">
                  (technique 60 % · business 40 %)
                </span>
              </p>
            </div>
          </Bloc>

          <Bloc titre="Équipe">
            <ul className="space-y-2">
              {equipe.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 text-sm">
                  <span
                    aria-hidden="true"
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white ${
                      m.id === sujet.responsable_id
                        ? "ring-2 ring-amber-400"
                        : ""
                    }`}
                    style={{ backgroundColor: avatarColor(m.id) }}
                  >
                    {m.email[0]?.toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {m.email}
                  </span>
                  {m.id === sujet.responsable_id && (
                    <span className="text-xs font-semibold text-amber-500">
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

const AVATAR_COLORS = ["#4b4ee9", "#7c3aed", "#0ea5e9", "#00a87e", "#e61e49"];
function avatarColor(id: string): string {
  return AVATAR_COLORS[Number(id) % AVATAR_COLORS.length];
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

function Avancement({
  nom,
  valeur,
  jalon,
}: {
  nom: string;
  valeur: number;
  jalon: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-ink">{nom}</span>
        <span className="text-xs text-mute">
          {jalon} · <span className="font-semibold text-ink">{valeur} %</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full rounded-full ${valeur >= 75 ? "bg-success" : "bg-warn"}`}
          style={{ width: `${valeur}%` }}
        />
      </div>
    </div>
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
