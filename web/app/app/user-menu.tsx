"use client";

import { useEffect, useRef, useState } from "react";

// Menu profil de la navbar : pastille cliquable, fermeture au clic
// extérieur et à Échap. Remplace l'ancien bouton de déconnexion nu.
export default function UserMenu({
  email,
  role,
}: {
  email: string;
  role: "dirigeant" | "collaborateur";
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

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu du compte"
        className="flex items-center gap-1.5 rounded-full p-1 transition hover:bg-surface"
      >
        <span
          aria-hidden="true"
          className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-semibold text-white"
        >
          {email[0]?.toUpperCase()}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={`h-4 w-4 text-mute transition-transform ${open ? "rotate-180" : ""}`}
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
        <div
          role="menu"
          className="absolute right-0 z-10 mt-2 w-60 rounded-2xl border border-hairline bg-white py-2"
        >
          <div className="px-4 py-2">
            <p className="text-xs text-stone">
              {role === "dirigeant" ? "Dirigeant" : "Collaborateur"}
            </p>
            <p className="truncate text-sm font-medium text-ink">{email}</p>
          </div>
          <div className="my-1 border-t border-hairline" />
          {role === "dirigeant" && (
            <a
              role="menuitem"
              href="/app/equipe"
              className="block px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface"
            >
              Gérer l&apos;équipe
            </a>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="w-full px-4 py-2 text-left text-sm font-medium text-danger transition hover:bg-surface"
          >
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
