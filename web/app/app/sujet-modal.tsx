"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  avancementGlobal,
  CRITICITES,
  ETATS,
  JALONS,
  JALONS_BUSINESS,
  JALONS_TECH,
} from "@/lib/sujets";
import type { SujetRow } from "@/lib/sujets";
import type { ProjectOption } from "./dashboard";

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
  const [responsableId, setResponsableId] = useState(
    sujet?.responsable_id ?? "",
  );
  const [action, setAction] = useState(sujet?.action ?? "");
  const [dueDate, setDueDate] = useState(sujet?.due_date ?? "");
  const [jalonTech, setJalonTech] = useState(sujet?.jalon_tech ?? 0);
  const [jalonBusiness, setJalonBusiness] = useState(
    sujet?.jalon_business ?? 0,
  );
  const [criticite, setCriticite] = useState<string>(
    sujet?.criticite ?? "normale",
  );
  const [etat, setEtat] = useState<string>(sujet?.etat ?? "a_faire");
  const [commentaire, setCommentaire] = useState(sujet?.commentaire ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const readOnly = mode === "edit" && !sujet?.can_edit;
  const members = projects.find((p) => p.id === projectId)?.members ?? [];

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
      responsableId,
      action,
      dueDate: dueDate || null,
      jalonTech,
      jalonBusiness,
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
    "w-full rounded-lg bg-surface px-3.5 py-2.5 text-sm text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60";
  const etiquette = "mb-1.5 block text-sm font-medium text-ink";

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 px-4 py-8"
      onClick={(e) => e.target === e.currentTarget && onClose(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Nouveau sujet" : "Modifier le sujet"}
        className="max-h-full w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-7 shadow-card"
      >
        <div className="mb-5 flex items-start justify-between">
          <h2 className="font-display text-xl font-medium tracking-[-0.01em] text-ink">
            {mode === "create" ? "Nouveau sujet" : "Modifier le sujet"}
          </h2>
          <button
            type="button"
            onClick={() => onClose(false)}
            aria-label="Fermer"
            className="rounded-full px-2 py-0.5 text-lg text-mute transition hover:bg-surface"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="s-projet" className={etiquette}>
                Projet
              </label>
              <select
                id="s-projet"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setResponsableId("");
                }}
                disabled={loading || readOnly || mode === "edit"}
                className={champ}
              >
                {(mode === "edit" ? projects : creatable).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="s-resp" className={etiquette}>
                Responsable
              </label>
              <select
                id="s-resp"
                value={responsableId}
                onChange={(e) => setResponsableId(e.target.value)}
                required
                disabled={loading || readOnly}
                className={champ}
              >
                <option value="">Choisir…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="s-titre" className={etiquette}>
              Sujet
            </label>
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

          <div className="mt-4">
            <label htmlFor="s-action" className={etiquette}>
              Action de la semaine
            </label>
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

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="s-date" className={etiquette}>
                Échéance
              </label>
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
              <label htmlFor="s-crit" className={etiquette}>
                Criticité
              </label>
              <select
                id="s-crit"
                value={criticite}
                onChange={(e) => setCriticite(e.target.value)}
                disabled={loading || readOnly}
                className={champ}
              >
                {Object.entries(CRITICITES).map(([k, c]) => (
                  <option key={k} value={k}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="s-etat" className={etiquette}>
                État
              </label>
              <select
                id="s-etat"
                value={etat}
                onChange={(e) => setEtat(e.target.value)}
                disabled={loading || readOnly}
                className={champ}
              >
                {Object.entries(ETATS).map(([k, e]) => (
                  <option key={k} value={k}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="s-tech" className={etiquette}>
                Jalon technique
              </label>
              <select
                id="s-tech"
                value={jalonTech}
                onChange={(e) => setJalonTech(Number(e.target.value))}
                disabled={loading || readOnly}
                className={champ}
              >
                {JALONS.map((j) => (
                  <option key={j} value={j}>
                    {JALONS_TECH[j]} — {j} %
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="s-business" className={etiquette}>
                Jalon business
              </label>
              <select
                id="s-business"
                value={jalonBusiness}
                onChange={(e) => setJalonBusiness(Number(e.target.value))}
                disabled={loading || readOnly}
                className={champ}
              >
                {JALONS.map((j) => (
                  <option key={j} value={j}>
                    {JALONS_BUSINESS[j]} — {j} %
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="mt-3 text-sm text-mute">
            Avancement global calculé :{" "}
            <span className="font-semibold text-ink">
              {avancementGlobal(jalonTech, jalonBusiness)} %
            </span>{" "}
            <span className="text-stone">(technique 60 % · business 40 %)</span>
          </p>

          <div className="mt-4">
            <label htmlFor="s-comm" className={etiquette}>
              Commentaire{" "}
              <span className="font-normal text-stone">
                (dernière information utile)
              </span>
            </label>
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
                disabled={loading || !title || !responsableId || !projectId}
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
