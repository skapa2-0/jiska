"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/lib/notifications";
import Avatar, { displayName } from "../avatar";

type Auteur = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
};

export type Ticket = {
  id: string;
  titre: string;
  description: string;
  priorite: string;
  statut: string;
  createdAt: string;
  auteur: Auteur | null;
};

const PRIORITES = [
  { value: "basse", label: "Basse", ton: "bg-surface text-mute" },
  { value: "normale", label: "Normale", ton: "bg-brand/10 text-brand" },
  { value: "haute", label: "Haute", ton: "bg-danger-soft text-danger" },
];

const STATUTS = [
  { value: "ouvert", label: "Ouvert", ton: "bg-warn-soft text-warn" },
  { value: "en_cours", label: "En cours", ton: "bg-brand/10 text-brand" },
  { value: "resolu", label: "Résolu", ton: "bg-success-soft text-success" },
  { value: "ferme", label: "Fermé", ton: "bg-surface text-stone" },
];

function pastille(
  liste: { value: string; label: string; ton: string }[],
  valeur: string,
) {
  const item = liste.find((v) => v.value === valeur);
  if (!item) return null;
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${item.ton}`}
    >
      {item.label}
    </span>
  );
}

function dateCourte(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function TicketsManager({
  tickets,
  developeur,
}: {
  tickets: Ticket[];
  developeur: boolean;
}) {
  const router = useRouter();
  const { notifier } = useNotifications();
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [priorite, setPriorite] = useState("normale");
  const [loading, setLoading] = useState(false);
  const [majId, setMajId] = useState<string | null>(null);

  async function creer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titre, description, priorite }),
      });
      const data = await res.json();
      if (!res.ok) {
        notifier({
          ton: "error",
          texte: data.error ?? "Échec de l'envoi.",
          autoClose: true,
        });
        return;
      }
      setTitre("");
      setDescription("");
      setPriorite("normale");
      notifier({ ton: "success", texte: "Ticket envoyé, merci.", autoClose: true });
      router.refresh();
    } catch {
      notifier({
        ton: "error",
        texte: "Impossible de joindre le serveur.",
        autoClose: true,
      });
    } finally {
      setLoading(false);
    }
  }

  async function changerStatut(id: string, statut: string) {
    setMajId(id);
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut }),
      });
      const data = await res.json();
      if (!res.ok) {
        notifier({
          ton: "error",
          texte: data.error ?? "Échec de la mise à jour.",
          autoClose: true,
        });
        return;
      }
      router.refresh();
    } catch {
      notifier({
        ton: "error",
        texte: "Impossible de joindre le serveur.",
        autoClose: true,
      });
    } finally {
      setMajId(null);
    }
  }

  return (
    <>
      <form
        onSubmit={creer}
        className="mt-6 rounded-lg bg-white shadow-card p-5"
      >
        <h2 className="text-sm font-semibold text-ink">Ouvrir un ticket</h2>
        <div className="mt-4 grid gap-3">
          <input
            type="text"
            aria-label="Titre du ticket"
            placeholder="Ex : le bouton d'export ne fonctionne pas"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            required
            maxLength={120}
            disabled={loading}
            className="w-full rounded-lg bg-surface px-4 py-3 text-sm text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand"
          />
          <textarea
            aria-label="Description"
            placeholder="Ce que vous faisiez, ce que vous attendiez, ce que vous avez obtenu."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={4000}
            rows={4}
            disabled={loading}
            className="w-full resize-none rounded-lg bg-surface px-4 py-3 text-sm text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone">
              Priorité
            </span>
            {/* Pastilles maison (règle : pas de radio natif) */}
            <div className="flex gap-1.5">
              {PRIORITES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={priorite === p.value}
                  onClick={() => setPriorite(p.value)}
                  disabled={loading}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    priorite === p.value
                      ? "border-brand bg-brand/5 text-ink ring-1 ring-brand"
                      : "border-hairline text-mute hover:bg-surface"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !titre.trim()}
            className="rounded-lg bg-ink px-5 py-2 text-sm font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Envoi…" : "Envoyer le ticket"}
          </button>
        </div>
      </form>


      <h2 className="mt-8 text-sm font-semibold text-ink">
        {developeur ? "Tous les tickets" : "Vos tickets"}
      </h2>
      {tickets.length === 0 ? (
        <p className="mt-3 rounded-lg bg-surface px-5 py-6 text-center text-sm text-stone">
          {developeur
            ? "Aucun ticket pour l'instant."
            : "Vous n'avez ouvert aucun ticket."}
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {tickets.map((t) => (
            <li
              key={t.id}
              className="rounded-lg bg-white p-4 shadow-card sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {pastille(STATUTS, t.statut)}
                    {pastille(PRIORITES, t.priorite)}
                    <span className="text-xs text-stone">
                      Ouvert le {dateCourte(t.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {t.titre}
                  </p>
                  {t.description && (
                    <p className="mt-1 whitespace-pre-line text-sm text-mute">
                      {t.description}
                    </p>
                  )}
                  {developeur && t.auteur && (
                    <div className="mt-3 flex items-center gap-2">
                      <Avatar personne={t.auteur} taille="h-6 w-6 text-xs" />
                      <span className="truncate text-xs text-stone">
                        {displayName(t.auteur)} · {t.auteur.email}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {developeur && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-hairline pt-3">
                  {STATUTS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      aria-pressed={t.statut === s.value}
                      onClick={() => changerStatut(t.id, s.value)}
                      disabled={majId === t.id || t.statut === s.value}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        t.statut === s.value
                          ? "border-brand bg-brand/5 text-ink ring-1 ring-brand"
                          : "border-hairline text-mute hover:bg-surface"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
