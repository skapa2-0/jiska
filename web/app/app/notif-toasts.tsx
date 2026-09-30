"use client";

import { useEffect } from "react";
import { useNotifications } from "@/lib/notifications";
import type { Notification, NotifTon } from "@/lib/notifications";

// Toasts qui apparaissent en haut centre, sous la navbar. Un toast
// par notification autoClose=true. Les autres (erreurs importantes)
// restent dans la cloche seulement, pour éviter qu'un problème
// bloquant se perde en 4 secondes.

const DUREE: Record<NotifTon, number> = {
  success: 3500,
  info: 3500,
  error: 6000,
};

const TON: Record<NotifTon, { bg: string; texte: string; icone: string }> = {
  success: {
    bg: "bg-success-soft",
    texte: "text-success",
    icone: "m3 8 3.5 3.5L13 5",
  },
  error: {
    bg: "bg-danger-soft",
    texte: "text-danger",
    icone: "M12 4 2.5 20h19L12 4Zm0 6v5m0 3v.01",
  },
  info: {
    bg: "bg-info-soft",
    texte: "text-info",
    icone: "M12 8v5m0 3v.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  },
};

export default function NotifToasts() {
  const { liste, fermer } = useNotifications();
  // Seules les notifications autoClose défilent en toast. Les
  // notifications persistantes vivent dans la cloche.
  const flottants = liste.filter((n) => n.autoClose);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 top-[57px] z-40 flex flex-col items-center gap-2 px-4 pt-3"
    >
      {flottants.slice(0, 5).map((n) => (
        <Toast key={n.id} notif={n} onFermer={() => fermer(n.id)} />
      ))}
    </div>
  );
}

function Toast({
  notif,
  onFermer,
}: {
  notif: Notification;
  onFermer: () => void;
}) {
  useEffect(() => {
    const id = window.setTimeout(onFermer, DUREE[notif.ton]);
    return () => window.clearTimeout(id);
  }, [notif.id, notif.ton, onFermer]);

  const t = TON[notif.ton];
  return (
    <div
      role="status"
      className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border border-hairline bg-white px-4 py-3 shadow-card"
      style={{
        animation: "historique-in 300ms cubic-bezier(0.22, 1, 0.36, 1) both",
      }}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${t.bg}`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 ${t.texte}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={t.icone} />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{notif.texte}</p>
        {notif.detail && (
          <p className="mt-0.5 text-xs text-mute">{notif.detail}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onFermer}
        aria-label="Fermer la notification"
        className="-mr-1 -mt-1 rounded-md p-1 text-stone transition hover:bg-surface hover:text-ink"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
