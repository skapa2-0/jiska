"use client";

import { useEffect, useRef, useState } from "react";

// Sélecteur de date maison (règle UI : pas de contrôle natif) :
// bouton champ + calendrier mensuel, semaine commençant le lundi.
// Valeur au format ISO (yyyy-mm-dd), chaîne vide = pas de date.

const JOURS = ["L", "M", "M", "J", "V", "S", "D"];

function iso(annee: number, mois: number, jour: number): string {
  return `${annee}-${String(mois + 1).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

export default function DatePicker({
  value,
  onChange,
  ariaLabel,
  disabled = false,
  placeholder = "Choisir une date",
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [vue, setVue] = useState(() => depuis(value));
  const rootRef = useRef<HTMLDivElement>(null);

  function depuis(v: string): { annee: number; mois: number } {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(v)
      ? new Date(`${v}T00:00:00`)
      : new Date();
    return { annee: d.getFullYear(), mois: d.getMonth() };
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const aujourdHui = new Date();
  const isoJour = iso(
    aujourdHui.getFullYear(),
    aujourdHui.getMonth(),
    aujourdHui.getDate(),
  );

  const premier = new Date(vue.annee, vue.mois, 1);
  const decalage = (premier.getDay() + 6) % 7; // lundi = 0
  const nbJours = new Date(vue.annee, vue.mois + 1, 0).getDate();
  const titreMois = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(premier);

  function naviguer(pas: number) {
    setVue((v) => {
      const d = new Date(v.annee, v.mois + pas, 1);
      return { annee: d.getFullYear(), mois: d.getMonth() };
    });
  }

  function choisir(jour: number) {
    onChange(iso(vue.annee, vue.mois, jour));
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          setVue(depuis(value));
          setOpen((v) => !v);
        }}
        className={`flex w-full items-center gap-2 rounded-lg bg-surface px-3.5 py-2.5 text-sm transition hover:bg-hairline/40 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-60 ${
          value ? "text-ink" : "text-stone"
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-stone"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3-3v4m8-4v4M4 11h16" />
        </svg>
        <span className="min-w-0 flex-1 truncate text-left font-medium">
          {value ? value.split("-").reverse().join("/") : placeholder}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`Calendrier : ${ariaLabel}`}
          className="absolute left-0 z-30 mt-1.5 w-72 rounded-lg border border-hairline bg-white p-3 shadow-card"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => naviguer(-1)}
              aria-label="Mois précédent"
              className="rounded-md px-2.5 py-1 text-mute transition hover:bg-surface"
            >
              ‹
            </button>
            <p className="text-sm font-semibold capitalize text-ink">
              {titreMois}
            </p>
            <button
              type="button"
              onClick={() => naviguer(1)}
              aria-label="Mois suivant"
              className="rounded-md px-2.5 py-1 text-mute transition hover:bg-surface"
            >
              ›
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-semibold text-stone">
            {JOURS.map((j, i) => (
              <span key={i} className="py-1">
                {j}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5 text-center text-sm">
            {Array.from({ length: decalage }, (_, i) => (
              <span key={`v${i}`} />
            ))}
            {Array.from({ length: nbJours }, (_, i) => {
              const jour = i + 1;
              const isoCase = iso(vue.annee, vue.mois, jour);
              const choisi = isoCase === value;
              const cestAujourdHui = isoCase === isoJour;
              return (
                <button
                  key={jour}
                  type="button"
                  onClick={() => choisir(jour)}
                  aria-pressed={choisi}
                  className={`mx-auto grid h-8 w-8 place-items-center rounded-full transition ${
                    choisi
                      ? "bg-brand font-semibold text-white"
                      : cestAujourdHui
                        ? "font-semibold text-brand hover:bg-surface"
                        : "text-ink hover:bg-surface"
                  }`}
                >
                  {jour}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-mute transition hover:bg-surface hover:text-ink"
            >
              Effacer
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(isoJour);
                setOpen(false);
              }}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-brand transition hover:bg-surface"
            >
              Aujourd&apos;hui
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
