"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Avatar, { displayName } from "../avatar";
import Confirmation from "../confirmer";

type Member = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
  role: string;
  created_at: string;
};

export default function TeamManager({
  members,
  selfId,
}: {
  members: Member[];
  selfId: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("collaborateur");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [aSupprimer, setASupprimer] = useState<Member | null>(null);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Échec de la création du compte.");
        return;
      }
      window.location.reload();
    } catch {
      setMessage("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(member: Member) {
    setASupprimer(null);
    const res = await fetch(`/api/users/${member.id}`, { method: "DELETE" });
    if (res.ok) window.location.reload();
    else {
      const data = await res.json().catch(() => null);
      setMessage(data?.error ?? "Échec de la suppression.");
    }
  }

  return (
    <>
      <ul className="mt-8 divide-y divide-hairline rounded-lg bg-white shadow-card">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-5 py-3.5">
            <Avatar personne={m} taille="h-8 w-8 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {displayName(m)}
              </p>
              <p className="truncate text-xs text-mute">{m.email}</p>
              <p className="truncate text-xs text-stone">
                {m.role === "dirigeant" ? "Dirigeant" : "Collaborateur"} ·
                depuis le {m.created_at.split("-").reverse().join("/")}
              </p>
            </div>
            {m.id !== selfId && (
              <button
                type="button"
                onClick={() => setASupprimer(m)}
                className="rounded-md px-3 py-1 text-xs font-medium text-danger transition hover:bg-surface"
              >
                Supprimer
              </button>
            )}
          </li>
        ))}
      </ul>

      <form
        onSubmit={handleCreate}
        className="mt-8 rounded-lg bg-white shadow-card p-5"
      >
        <h2 className="text-sm font-semibold text-ink">Ajouter un compte</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            type="email"
            aria-label="Adresse e-mail"
            placeholder="prenom@entreprise.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="w-full rounded-lg bg-surface px-4 py-3 text-sm text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand"
          />
          <input
            type="password"
            aria-label="Mot de passe provisoire"
            placeholder="Mot de passe provisoire (8 min.)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={loading}
            className="w-full rounded-lg bg-surface px-4 py-3 text-sm text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {/* Choix du rôle en pastilles maison (règle : pas de radio
              au style natif). */}
          <div className="flex gap-1.5">
            {(
              [
                ["collaborateur", "Collaborateur"],
                ["dirigeant", "Dirigeant"],
              ] as const
            ).map(([valeur, label]) => (
              <button
                key={valeur}
                type="button"
                aria-pressed={role === valeur}
                onClick={() => setRole(valeur)}
                disabled={loading}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  role === valeur
                    ? "border-brand bg-brand/5 text-ink ring-1 ring-brand"
                    : "border-hairline text-mute hover:bg-surface"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="rounded-lg bg-ink px-5 py-2 text-sm font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Création…" : "Créer le compte"}
          </button>
        </div>
        {message && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {message}
          </p>
        )}
      </form>

      {aSupprimer && (
        <Confirmation
          titre="Supprimer le compte ?"
          message={`${aSupprimer.email} sera retiré de tous les produits.`}
          onConfirm={() => handleDelete(aSupprimer)}
          onCancel={() => setASupprimer(null)}
        />
      )}
    </>
  );
}
