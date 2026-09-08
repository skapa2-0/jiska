"use client";

import { useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import Avatar, { displayName } from "./avatar";
import type { SessionUser } from "@/lib/auth";

// Menu profil de la navbar : pastille cliquable (photo si renseignée),
// fermeture au clic extérieur et à Échap.
export default function UserMenu({ user }: { user: SessionUser }) {
  const { signOut } = useClerk();
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

  // La session appartient à Clerk : c'est lui qui la termine, ici et sur
  // ses autres onglets ouverts.
  async function handleLogout() {
    await signOut({ redirectUrl: "/login" });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu du compte"
        className="flex items-center gap-1.5 rounded-lg p-1 transition hover:bg-surface"
      >
        <Avatar personne={user} taille="h-8 w-8 text-sm" />
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
          className="absolute right-0 z-50 mt-2 w-60 rounded-lg bg-white py-2 shadow-card"
        >
          <div className="px-4 py-2">
            <p className="truncate text-sm font-semibold text-ink">
              {displayName(user)}
            </p>
            <p className="truncate text-xs text-stone">
              {user.role === "dirigeant" ? "Dirigeant" : "Collaborateur"} ·{" "}
              {user.email}
            </p>
          </div>
          <div className="my-1 border-t border-hairline" />
          <a
            role="menuitem"
            href="/app/profil"
            className="block px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface"
          >
            Mon profil
          </a>
          {user.role === "dirigeant" && (
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
