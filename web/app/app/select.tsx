"use client";

import { useEffect, useRef, useState } from "react";

// Select maison (règle UI : aucun contrôle au style natif du navigateur).
// Liste déroulante stylée DA : bouton + panneau shadow-card, fermeture au
// clic extérieur et à Échap, coche sur l'option active, option vide en tête.

export type SelectOption = { value: string; label: string; icon?: string };

export default function Select({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  variante = "filtre",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  ariaLabel: string;
  // "filtre" : pilule compacte (barre de filtres) ; "champ" : pleine
  // largeur sur fond surface (formulaires).
  variante?: "filtre" | "champ";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-lg text-sm transition disabled:opacity-60 ${
          variante === "filtre"
            ? "border border-hairline bg-white px-4 py-2 hover:bg-surface"
            : "w-full justify-between bg-surface px-4 py-3 hover:bg-hairline/40 focus:outline-none focus:ring-2 focus:ring-brand"
        } ${current ? "font-medium text-ink" : "text-mute"}`}
      >
        {current?.icon && <span aria-hidden="true">{current.icon}</span>}
        <span
          className={
            variante === "filtre" ? "max-w-48 truncate" : "min-w-0 flex-1 truncate text-left"
          }
        >
          {current?.label ?? placeholder}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={`h-3.5 w-3.5 shrink-0 text-stone transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6.5 8 10.5 12 6.5" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 z-20 mt-1.5 max-h-72 w-max min-w-full overflow-y-auto rounded-lg border border-hairline bg-white py-1.5 shadow-card"
        >
          <Option
            actif={!current}
            label={placeholder}
            onClick={() => pick("")}
          />
          {options.map((o) => (
            <Option
              key={o.value}
              actif={o.value === value}
              label={o.label}
              icon={o.icon}
              onClick={() => pick(o.value)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Option({
  actif,
  label,
  icon,
  onClick,
}: {
  actif: boolean;
  label: string;
  icon?: string;
  onClick: () => void;
}) {
  return (
    <li role="option" aria-selected={actif}>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition hover:bg-surface ${
          actif ? "font-semibold text-ink" : "text-mute"
        }`}
      >
        {icon && <span aria-hidden="true">{icon}</span>}
        <span className="flex-1 truncate pr-4">{label}</span>
        {actif && (
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-4 w-4 shrink-0 text-brand"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 4.5 6.5 11 3 7.5" />
          </svg>
        )}
      </button>
    </li>
  );
}
