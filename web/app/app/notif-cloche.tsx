"use client";

import { useEffect, useRef, useState } from "react";
import { useNotifications } from "@/lib/notifications";
import type { Notification, NotifTon } from "@/lib/notifications";

// Cloche des notifications dans la navbar : icône avec badge du
// nombre de non-vus, ouvre un panneau qui liste l'historique récent.
// Rester dans la cloche est le comportement par défaut d'une
// notification autoClose=false (erreur critique par exemple).

const TON: Record<NotifTon, { fond: string; texte: string; icone: string }> = {
  success: {
    fond: "bg-success-soft",
    texte: "text-success",
    icone: "m3 8 3.5 3.5L13 5",
  },
  error: {
    fond: "bg-danger-soft",
    texte: "text-danger",
    icone: "M12 4 2.5 20h19L12 4Zm0 6v5m0 3v.01",
  },
  info: {
    fond: "bg-info-soft",
    texte: "text-info",
    icone: "M12 8v5m0 3v.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  },
};

export default function NotifCloche() {
  const { liste, fermer, toutFermer, marquerToutVu, nonVus } =
    useNotifications();
  const [ouvert, setOuvert] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOuvert(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOuvert(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ouvert]);

  useEffect(() => {
    if (ouvert && nonVus > 0) {
      // On les marque vus dès qu'on ouvre le panneau : le badge
      // disparaît sans qu'il faille les fermer une par une.
      marquerToutVu();
    }
  }, [ouvert, nonVus, marquerToutVu]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-label={
          nonVus > 0
            ? `Notifications, ${nonVus} non lue${nonVus > 1 ? "s" : ""}`
            : "Notifications"
        }
        aria-haspopup="menu"
        aria-expanded={ouvert}
        className="relative rounded-lg p-2 text-mute transition hover:bg-surface hover:text-ink"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0" />
        </svg>
        {nonVus > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white"
          >
            {nonVus > 9 ? "9+" : nonVus}
          </span>
        )}
      </button>

      {ouvert && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg bg-white shadow-card"
        >
          <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {liste.length > 0 && (
              <button
                type="button"
                onClick={toutFermer}
                className="text-xs font-medium text-stone transition hover:text-ink"
              >
                Tout effacer
              </button>
            )}
          </div>
          {liste.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-stone">
              Aucune notification pour l&apos;instant.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-hairline overflow-y-auto">
              {liste.slice(0, 30).map((n) => (
                <LigneNotif key={n.id} notif={n} onFermer={() => fermer(n.id)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function LigneNotif({
  notif,
  onFermer,
}: {
  notif: Notification;
  onFermer: () => void;
}) {
  const t = TON[notif.ton];
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span
        aria-hidden="true"
        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${t.fond}`}
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
        <p className="text-sm text-ink">{notif.texte}</p>
        {notif.detail && (
          <p className="mt-0.5 text-xs text-mute">{notif.detail}</p>
        )}
        <p className="mt-1 text-[11px] text-stone">
          {notif.quand.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
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
    </li>
  );
}
