"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { CRITICITES, ETATS, TYPES_SUJET } from "@/lib/sujets";
import type { SujetRow } from "@/lib/sujets";
import type { ProjectOption } from "./dashboard";
import ProjetLogo from "./projet-logo";
import Select from "./select";

// Création / mise à jour d'un sujet, sans quitter la page (PRD : une
// seule page, la réunion met à jour l'application en direct).
export default function SujetModal({
  mode,
  sujet,
  projects,
  onClose,
}: {
  mode: "create" | "edit";
  sujet?: SujetRow;
  projects: ProjectOption[];
  onClose: (refresh: boolean) => void;
}) {
  const creatable = projects.filter((p) => p.canManage);
  const [projectId, setProjectId] = useState(
    sujet?.project_id ?? creatable[0]?.id ?? "",
  );
  const [title, setTitle] = useState(sujet?.title ?? "");
  const [action, setAction] = useState(sujet?.action ?? "");
  const [dueDate, setDueDate] = useState(sujet?.due_date ?? "");
  const [criticite, setCriticite] = useState<string>(
    sujet?.criticite ?? "normale",
  );
  const [etat, setEtat] = useState<string>(sujet?.etat ?? "a_faire");
  const [commentaire, setCommentaire] = useState(sujet?.commentaire ?? "");
  const [type, setType] = useState<string>(sujet?.type ?? "technique");
  const [poids, setPoids] = useState(String(sujet?.poids ?? 5));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const readOnly = mode === "edit" && !sujet?.can_edit;
  const projet = projects.find((p) => p.id === projectId);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const payload = {
      projectId,
      title,
      action,
      dueDate: dueDate || null,
      type,
      poids: Math.min(100, Math.max(0, Math.round(Number(poids) || 0))),
      criticite,
      etat,
      commentaire,
    };
    try {
      const res = await fetch(
        mode === "create" ? "/api/sujets" : `/api/sujets/${sujet!.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Échec de l'enregistrement.");
        return;
      }
      onClose(true);
    } catch {
      setMessage("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!sujet || !window.confirm(`Supprimer le sujet « ${sujet.title} » ?`))
      return;
    setLoading(true);
    const res = await fetch(`/api/sujets/${sujet.id}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) onClose(true);
    else {
      const data = await res.json().catch(() => null);
      setMessage(data?.error ?? "Échec de la suppression.");
    }
  }

  const champ =
    "w-full rounded-lg bg-surface px-4 py-3 text-sm text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60";

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 px-4 py-8"
      onClick={(e) => e.target === e.currentTarget && onClose(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Nouveau sujet" : "Modifier le sujet"}
        className="max-h-full w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-card"
      >
        {/* En-tête */}
        <div className="flex items-center gap-3 border-b border-hairline px-7 py-4">
          {mode === "edit" && projet && (
            <ProjetLogo
              name={projet.name}
              logo={projet.logo}
              taille="h-9 w-9 text-base"
            />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">
              {mode === "create" ? "Nouveau sujet" : "Modifier le sujet"}
            </h2>
            {mode === "edit" && projet && (
              <p className="truncate text-xs text-stone">{projet.name}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            aria-label="Fermer"
            className="rounded-lg px-2.5 py-1 text-lg text-mute transition hover:bg-surface"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="px-7 py-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {mode === "create" && (
              <div className={creatable.length > 1 ? "" : "hidden"}>
                <Etiquette>Projet</Etiquette>
                <Select
                  ariaLabel="Projet du sujet"
                  placeholder="Choisir un projet"
                  variante="champ"
                  value={projectId}
                  disabled={loading}
                  onChange={setProjectId}
                  options={creatable.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                />
              </div>
            )}
            <div className={mode === "create" && creatable.length > 1 ? "" : "sm:col-span-2"}>
              <Etiquette libelle="s-titre">Sujet</Etiquette>
              <input
                id="s-titre"
                type="text"
                placeholder="Algorithme de scoring"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                disabled={loading || readOnly}
                className={champ}
              />
            </div>
          </div>


          <div className="mt-5">
            <Etiquette libelle="s-action">Action de la semaine</Etiquette>
            <input
              id="s-action"
              type="text"
              placeholder="Décidée lors du dernier comité"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              disabled={loading || readOnly}
              className={champ}
            />
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <Etiquette libelle="s-date">Échéance</Etiquette>
              <input
                id="s-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={loading || readOnly}
                className={champ}
              />
            </div>
            <div>
              <Etiquette>Criticité</Etiquette>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(CRITICITES).map(([k, c]) => (
                  <Pastille
                    key={k}
                    actif={criticite === k}
                    classe={c.chip}
                    onClick={() => !readOnly && setCriticite(k)}
                    disabled={loading || readOnly}
                  >
                    {c.label}
                  </Pastille>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <Etiquette>État</Etiquette>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(ETATS).map(([k, e]) => (
                <Pastille
                  key={k}
                  actif={etat === k}
                  classe={e.chip}
                  onClick={() => !readOnly && setEtat(k)}
                  disabled={loading || readOnly}
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${e.dot}`}
                  />
                  {e.label}
                </Pastille>
              ))}
            </div>
          </div>


          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <Etiquette>Type de sujet</Etiquette>
              <div className="flex gap-1.5">
                {Object.entries(TYPES_SUJET).map(([k, t]) => (
                  <Pastille
                    key={k}
                    actif={type === k}
                    classe={t.chip}
                    onClick={() => !readOnly && setType(k)}
                    disabled={loading || readOnly}
                  >
                    {t.label}
                  </Pastille>
                ))}
              </div>
            </div>
            <div>
              <Etiquette libelle="s-poids">
                Poids dans le projet{" "}
                <span className="font-normal text-stone">(%)</span>
              </Etiquette>
              <input
                id="s-poids"
                type="number"
                min={0}
                max={100}
                step={5}
                value={poids}
                onChange={(e) => setPoids(e.target.value)}
                disabled={loading || readOnly}
                className={champ}
              />
            </div>
          </div>

          <div className="mt-5">
            <Etiquette libelle="s-comm">
              Commentaire{" "}
              <span className="font-normal text-stone">
                (dernière information utile)
              </span>
            </Etiquette>
            <textarea
              id="s-comm"
              rows={2}
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              disabled={loading || readOnly}
              className={`${champ} resize-none`}
            />
          </div>

          {message && (
            <p role="alert" className="mt-4 text-sm text-danger">
              {message}
            </p>
          )}

          {!readOnly && (
            <div className="mt-6 flex items-center gap-3">
              <button
                type="submit"
                disabled={loading || !title || !projectId}
                className="flex-1 rounded-lg bg-ink py-3 text-sm font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading
                  ? "Enregistrement…"
                  : mode === "create"
                    ? "Créer le sujet"
                    : "Enregistrer"}
              </button>
              {mode === "edit" && sujet?.can_manage && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="rounded-lg px-4 py-3 text-sm font-medium text-danger transition hover:bg-danger-soft"
                >
                  Supprimer
                </button>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function Etiquette({
  libelle,
  children,
}: {
  libelle?: string;
  children: React.ReactNode;
}) {
  const classe = "mb-1.5 block text-sm font-medium text-ink";
  if (libelle)
    return (
      <label htmlFor={libelle} className={classe}>
        {children}
      </label>
    );
  return <p className={classe}>{children}</p>;
}

function Pastille({
  actif,
  classe,
  onClick,
  disabled,
  children,
}: {
  actif: boolean;
  classe: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={actif}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
        actif
          ? `${classe} ring-1 ring-current`
          : "border border-hairline text-mute hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}

