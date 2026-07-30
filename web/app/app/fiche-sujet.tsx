"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CRITICITES, ETATS } from "@/lib/sujets";
import type { SujetRow } from "@/lib/sujets";
import Avatar, { displayName } from "./avatar";
import type { ProjectOption } from "./dashboard";
import ProjetLogo from "./projet-logo";

// Fiche détaillée d'un sujet : panneau qui glisse depuis la droite.
// Édition directe sur la fiche (selon permissions) : les chips
// s'enregistrent au clic, les textes en quittant le champ.
export default function FicheSujet({
  sujet,
  projet,
  today,
  onClose,
}: {
  sujet: SujetRow;
  projet?: ProjectOption;
  today: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState(sujet.title);
  const [action, setAction] = useState(sujet.action);
  const [dueDate, setDueDate] = useState(sujet.due_date ?? "");
  const [etat, setEtat] = useState<string>(sujet.etat);
  const [criticite, setCriticite] = useState<string>(sujet.criticite);
  const [commentaire, setCommentaire] = useState(sujet.commentaire);
  const [sauve, setSauve] = useState({
    title: sujet.title,
    action: sujet.action,
    commentaire: sujet.commentaire,
  });
  const [statut, setStatut] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const editable = sujet.can_edit;

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

  async function patch(donnees: Record<string, unknown>): Promise<boolean> {
    setStatut(null);
    try {
      const res = await fetch(`/api/sujets/${sujet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(donnees),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStatut({
          ok: false,
          text: data?.error ?? "Échec de l'enregistrement.",
        });
        return false;
      }
      setStatut({ ok: true, text: "Enregistré" });
      router.refresh();
      return true;
    } catch {
      setStatut({ ok: false, text: "Impossible de joindre le serveur." });
      return false;
    }
  }

  function blurTexte(
    cle: "title" | "action" | "commentaire",
    valeur: string,
    remettre: (v: string) => void,
  ) {
    const propre = cle === "title" ? valeur.trim() : valeur;
    if (cle === "title" && !propre) {
      remettre(sauve.title);
      return;
    }
    if (propre === sauve[cle]) return;
    patch({ [cle]: propre }).then((ok) => {
      if (ok) setSauve((s) => ({ ...s, [cle]: propre }));
      else remettre(sauve[cle]);
    });
  }

  function changerDate(v: string) {
    const avant = dueDate;
    setDueDate(v);
    patch({ dueDate: v || null }).then((ok) => {
      if (!ok) setDueDate(avant);
    });
  }

  function changerChip(cle: "etat" | "criticite", v: string) {
    const avant = cle === "etat" ? etat : criticite;
    const poser = cle === "etat" ? setEtat : setCriticite;
    if (v === avant) return;
    poser(v);
    patch({ [cle]: v }).then((ok) => {
      if (!ok) poser(avant);
    });
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer le sujet « ${title} » ?`)) return;
    const res = await fetch(`/api/sujets/${sujet.id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
      fermer();
    } else {
      const data = await res.json().catch(() => null);
      setStatut({ ok: false, text: data?.error ?? "Échec de la suppression." });
    }
  }

  const retard = dueDate && dueDate < today && etat !== "termine";
  const joursRetard = retard
    ? Math.round((Date.parse(today) - Date.parse(dueDate)) / 86400000)
    : 0;
  const respId = projet?.responsableId ?? null;
  const equipe = [...(projet?.members ?? [])].sort((a, b) =>
    a.id === respId ? -1 : b.id === respId ? 1 : 0,
  );

  const champ =
    "w-full rounded-lg bg-surface px-3.5 py-2.5 text-sm text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand";

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
            {editable ? (
              <input
                type="text"
                aria-label="Titre du sujet"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => blurTexte("title", title, setTitle)}
                className="-mx-2 w-full rounded-lg px-2 py-1 font-display text-2xl font-medium leading-tight tracking-[-0.01em] text-ink outline-none transition hover:bg-surface focus:bg-surface"
              />
            ) : (
              <h2 className="font-display text-2xl font-medium leading-tight tracking-[-0.01em] text-ink">
                {title}
              </h2>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {editable ? (
                Object.entries(ETATS).map(([k, e]) => (
                  <Pastille
                    key={k}
                    actif={etat === k}
                    classe={e.chip}
                    onClick={() => changerChip("etat", k)}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 rounded-full ${e.dot}`}
                    />
                    {e.label}
                  </Pastille>
                ))
              ) : (
                <Chip classe={ETATS[etat as keyof typeof ETATS].chip}>
                  {ETATS[etat as keyof typeof ETATS].label}
                </Chip>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {editable ? (
                Object.entries(CRITICITES).map(([k, c]) => (
                  <Pastille
                    key={k}
                    actif={criticite === k}
                    classe={c.chip}
                    onClick={() => changerChip("criticite", k)}
                  >
                    {c.label}
                  </Pastille>
                ))
              ) : (
                <Chip
                  classe={CRITICITES[criticite as keyof typeof CRITICITES].chip}
                >
                  Criticité{" "}
                  {CRITICITES[
                    criticite as keyof typeof CRITICITES
                  ].label.toLowerCase()}
                </Chip>
              )}
            </div>
          </div>

          <Bloc titre="Action de la semaine">
            {editable ? (
              <input
                type="text"
                aria-label="Action de la semaine"
                placeholder="Décidée lors du dernier comité"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                onBlur={() => blurTexte("action", action, setAction)}
                className={champ}
              />
            ) : (
              <p className="text-sm text-ink">
                {action || (
                  <span className="text-stone">Aucune action définie</span>
                )}
              </p>
            )}
          </Bloc>

          <Bloc titre="Échéance">
            {editable ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label="Échéance"
                  value={dueDate}
                  onChange={(e) => changerDate(e.target.value)}
                  className={champ}
                />
                {retard && (
                  <span className="shrink-0 rounded-md bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
                    ⚠ {joursRetard} j
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm font-medium text-ink">
                {dueDate
                  ? dueDate.split("-").reverse().join("/")
                  : "Aucune échéance"}
                {retard && (
                  <span className="ml-2 rounded-md bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
                    ⚠ {joursRetard} jour{joursRetard > 1 ? "s" : ""} de retard
                  </span>
                )}
              </p>
            )}
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

          {(editable || commentaire) && (
            <Bloc titre="Commentaire">
              {editable ? (
                <textarea
                  aria-label="Commentaire"
                  rows={3}
                  placeholder="Dernière information utile…"
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  onBlur={() =>
                    blurTexte("commentaire", commentaire, setCommentaire)
                  }
                  className={`${champ} resize-none`}
                />
              ) : (
                <div className="flex gap-2.5 rounded-lg bg-surface p-4">
                  <IconeCommentaire className="mt-0.5 h-4 w-4 shrink-0 text-stone" />
                  <p className="whitespace-pre-wrap text-sm text-ink">
                    {commentaire}
                  </p>
                </div>
              )}
            </Bloc>
          )}
        </div>

        <footer className="flex min-h-[57px] items-center gap-3 border-t border-hairline px-6 py-3">
          <p
            role={statut && !statut.ok ? "alert" : undefined}
            className={`min-w-0 flex-1 truncate text-sm ${
              statut
                ? statut.ok
                  ? "text-success"
                  : "text-danger"
                : "text-stone"
            }`}
          >
            {statut
              ? statut.text
              : editable
                ? "Modifications enregistrées automatiquement"
                : "Lecture seule"}
          </p>
          {sujet.can_manage && (
            <button
              type="button"
              onClick={supprimer}
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger-soft"
            >
              Supprimer
            </button>
          )}
        </footer>
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

function Pastille({
  actif,
  classe,
  onClick,
  children,
}: {
  actif: boolean;
  classe: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
        actif
          ? `${classe} ring-1 ring-current`
          : "border border-hairline text-mute hover:bg-surface"
      }`}
    >
      {children}
    </button>
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
