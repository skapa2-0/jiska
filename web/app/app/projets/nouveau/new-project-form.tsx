"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { FORMATS_IMAGE, reduireImage } from "@/lib/image";
import Avatar, { displayName } from "../../avatar";
import ProjetLogo from "../../projet-logo";

type Person = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
  role: string;
};

export default function NewProjectForm({ people }: { people: Person[] }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [responsableId, setResponsableId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function toggleMember(id: string) {
    setMemberIds((ids) => {
      const next = ids.includes(id)
        ? ids.filter((v) => v !== id)
        : [...ids, id];
      if (!next.includes(responsableId)) setResponsableId("");
      return next;
    });
  }

  async function choisirLogo(file: File | undefined) {
    if (!file) return;
    if (!FORMATS_IMAGE.test(file.type)) {
      setMessage("Formats acceptés pour le logo : JPEG, PNG ou WebP.");
      return;
    }
    try {
      setLogo(await reduireImage(file, "contain"));
      setMessage("");
    } catch {
      setMessage("Impossible de lire cette image.");
    }
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
          logo,
          memberIds,
          responsableId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Échec de la création du projet.");
        return;
      }
      window.location.href = "/app/projets";
    } catch {
      setMessage("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8" noValidate>
      {/* Logo importé, sinon première lettre du nom. */}
      <div className="flex items-center gap-5">
        <ProjetLogo
          name={name || "?"}
          logo={logo}
          taille="h-16 w-16 text-2xl"
        />
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="rounded-lg border border-hairline px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
            >
              {logo ? "Changer le logo" : "Importer un logo"}
            </button>
            {logo && (
              <button
                type="button"
                onClick={() => setLogo(null)}
                disabled={loading}
                className="rounded-lg px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger-soft"
              >
                Retirer
              </button>
            )}
          </div>
          <p className="text-xs text-stone">
            Facultatif — sans logo, la première lettre du nom du projet sera
            affichée.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => choisirLogo(e.target.files?.[0])}
        />
      </div>

      <label
        htmlFor="name"
        className="mb-2 mt-6 block text-sm font-medium text-ink"
      >
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
        className="w-full rounded-lg bg-surface px-4 py-3.5 text-[15px] text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60"
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
        className="w-full resize-none rounded-lg bg-surface px-4 py-3.5 text-[15px] text-ink placeholder-stone outline-none transition focus:bg-white focus:ring-2 focus:ring-brand disabled:opacity-60"
      />

      <div className="mb-2 mt-6 flex items-baseline justify-between">
        <p className="text-sm font-medium text-ink">Membres du projet</p>
        <p className="text-xs text-stone">
          Cochez les membres, puis désignez le responsable
        </p>
      </div>
      <ul className="divide-y divide-hairline rounded-lg bg-white shadow-card">
        {people.map((p) => {
          const coche = memberIds.includes(p.id);
          return (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                aria-label={`Membre : ${displayName(p)}`}
                checked={coche}
                onChange={() => toggleMember(p.id)}
                disabled={loading}
                className="h-4 w-4 accent-brand"
              />
              <Avatar personne={p} taille="h-9 w-9 text-sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {displayName(p)}
                  {p.role === "dirigeant" && (
                    <span className="ml-2 text-xs font-normal text-stone">
                      Dirigeant
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-stone">
                  {p.email}
                </span>
              </span>
              {coche && (
                <label
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    responsableId === p.id
                      ? "bg-brand text-white"
                      : "border border-hairline text-mute hover:bg-surface"
                  }`}
                >
                  <input
                    type="radio"
                    name="responsable"
                    value={p.id}
                    checked={responsableId === p.id}
                    onChange={() => setResponsableId(p.id)}
                    disabled={loading}
                    className="sr-only"
                  />
                  Responsable
                </label>
              )}
            </li>
          );
        })}
      </ul>

      {message && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !name || memberIds.length === 0 || !responsableId}
        className="mt-6 w-full rounded-lg bg-ink py-3.5 text-[15px] font-semibold text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Création…" : "Créer le projet"}
      </button>
    </form>
  );
}
