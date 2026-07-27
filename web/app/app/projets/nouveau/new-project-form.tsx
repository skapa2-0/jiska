"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { PROJECT_COLORS, PROJECT_ICONS } from "@/lib/sujets";

type Person = { id: string; email: string; role: string };

export default function NewProjectForm({ people }: { people: Person[] }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>(PROJECT_COLORS[0]);
  const [icon, setIcon] = useState<string>(PROJECT_ICONS[0]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [responsableId, setResponsableId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function toggleMember(id: string) {
    setMemberIds((ids) => {
      const next = ids.includes(id)
        ? ids.filter((v) => v !== id)
        : [...ids, id];
      if (!next.includes(responsableId)) setResponsableId("");
      return next;
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          color,
          icon,
          memberIds,
          responsableId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Échec de la création du projet.");
        return;
      }
      window.location.href = "/app";
    } catch {
      setMessage("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  const selected = people.filter((p) => memberIds.includes(p.id));

  return (
    <form onSubmit={handleSubmit} className="mt-8" noValidate>
      <label htmlFor="name" className="mb-2 block text-sm font-medium text-ink">
        Nom du projet
      </label>
      <input
        id="name"
        type="text"
        placeholder="Refonte du site client"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        disabled={loading}
        className="w-full rounded-xl bg-surface px-4 py-3.5 text-[15px] text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60"
      />

      <label
        htmlFor="description"
        className="mb-2 mt-5 block text-sm font-medium text-ink"
      >
        Description <span className="font-normal text-stone">(facultatif)</span>
      </label>
      <textarea
        id="description"
        rows={3}
        placeholder="En quelques mots, l'objectif du projet…"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={loading}
        className="w-full resize-none rounded-xl bg-surface px-4 py-3.5 text-[15px] text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60"
      />

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Couleur</p>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Couleur ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                disabled={loading}
                className={`h-8 w-8 rounded-full transition ${
                  color === c ? "ring-2 ring-ink ring-offset-2" : ""
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Logo</p>
          <div className="flex flex-wrap gap-1.5">
            {PROJECT_ICONS.map((i) => (
              <button
                key={i}
                type="button"
                aria-label={`Logo ${i}`}
                aria-pressed={icon === i}
                onClick={() => setIcon(i)}
                disabled={loading}
                className={`grid h-9 w-9 place-items-center rounded-lg text-lg transition hover:bg-surface ${
                  icon === i ? "bg-surface ring-2 ring-ink" : ""
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="mb-2 mt-5 text-sm font-medium text-ink">Membres</p>
      <ul className="divide-y divide-hairline rounded-2xl border border-hairline bg-white">
        {people.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-3 px-5 py-3">
              <input
                type="checkbox"
                checked={memberIds.includes(p.id)}
                onChange={() => toggleMember(p.id)}
                disabled={loading}
                className="h-4 w-4 accent-brand"
              />
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                {p.email}
              </span>
              <span className="text-xs text-stone">
                {p.role === "dirigeant" ? "Dirigeant" : "Collaborateur"}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {selected.length > 0 && (
        <>
          <label
            htmlFor="responsable"
            className="mb-2 mt-5 block text-sm font-medium text-ink"
          >
            Responsable du projet
          </label>
          <select
            id="responsable"
            value={responsableId}
            onChange={(e) => setResponsableId(e.target.value)}
            required
            disabled={loading}
            className="w-full rounded-xl bg-surface px-4 py-3.5 text-[15px] text-ink outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60"
          >
            <option value="">Choisir parmi les membres…</option>
            {selected.map((p) => (
              <option key={p.id} value={p.id}>
                {p.email}
              </option>
            ))}
          </select>
        </>
      )}

      {message && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !name || memberIds.length === 0 || !responsableId}
        className="mt-6 w-full rounded-full bg-ink py-3.5 text-[15px] font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Création…" : "Créer le projet"}
      </button>
    </form>
  );
}
