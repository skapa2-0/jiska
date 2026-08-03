"use client";

import { useEffect } from "react";

// Boîte de confirmation maison (règle UI : pas de window.confirm).
// Action destructrice mise en rouge, Échap ou clic sur le fond = annuler.
export default function Confirmation({
  titre,
  message,
  action = "Supprimer",
  onConfirm,
  onCancel,
}: {
  titre: string;
  message?: string;
  action?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    }
    // En capture : passe avant les Échap des panneaux en dessous.
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-5"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={titre}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-card"
      >
        <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">
          {titre}
        </h2>
        {message && <p className="mt-2 text-sm text-mute">{message}</p>}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="flex-1 rounded-lg border border-hairline py-2.5 text-sm font-semibold text-ink transition hover:bg-surface"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-danger py-2.5 text-sm font-semibold text-white transition hover:opacity-85"
          >
            {action}
          </button>
        </div>
      </div>
    </div>
  );
}
