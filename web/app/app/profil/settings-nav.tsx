"use client";

import Link from "next/link";
import type { ReactNode } from "react";

// Barre latérale commune aux pages /app/profil et /app/profil/api. Les
// deux premiers onglets sont pilotés par state (switch interne de la
// page Profil) ; « API » est une route dédiée (doc + jetons), donc un
// lien. Quand on est sur la page API, les deux premiers deviennent eux
// aussi des liens vers /app/profil.

export type OngletCle = "profil" | "securite" | "api";

const SVG_PROFIL = (
  <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.6 0-6.5 2-6.5 4.5V20h13v-1.5C18.5 16 15.6 14 12 14Z" />
);
const SVG_SECURITE = (
  <path d="M12 3 5 6v5.5c0 4 3 7.7 7 8.5 4-.8 7-4.5 7-8.5V6l-7-3Zm0 6a1.6 1.6 0 0 1 .8 3v2.2a.8.8 0 0 1-1.6 0V12A1.6 1.6 0 0 1 12 9Z" />
);
const SVG_API = (
  <path d="M4 6h16v3H4V6Zm0 4.5h10v3H4v-3ZM4 15h16v3H4v-3Z" />
);

const ITEMS: { cle: OngletCle; label: string; icone: ReactNode }[] = [
  { cle: "profil", label: "Profil", icone: SVG_PROFIL },
  { cle: "securite", label: "Sécurité", icone: SVG_SECURITE },
  { cle: "api", label: "API", icone: SVG_API },
];

function boutonClasses(actif: boolean): string {
  return `flex flex-1 items-center justify-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition lg:flex-none lg:justify-start ${
    actif
      ? "bg-white text-brand shadow-sm"
      : "text-mute hover:bg-white/60 hover:text-ink"
  }`;
}

// Mode « page Profil » : on reçoit l'onglet courant et un setter pour
// basculer entre profil/sécurité sans quitter la page. L'item API reste
// un lien vers /app/profil/api.
export function SettingsNavProfil({
  onglet,
  setOnglet,
}: {
  onglet: "profil" | "securite";
  setOnglet: (cle: "profil" | "securite") => void;
}) {
  return (
    <aside className="rounded-lg bg-surface p-3 lg:w-60 lg:shrink-0 lg:self-start">
      <Titre />
      <nav
        aria-label="Sections des paramètres"
        className="flex gap-1 lg:flex-col lg:gap-1"
      >
        {ITEMS.map((o) => {
          if (o.cle === "api") {
            return (
              <Link
                key={o.cle}
                href="/app/profil/api"
                className={boutonClasses(false)}
              >
                <IconeSvg>{o.icone}</IconeSvg>
                {o.label}
              </Link>
            );
          }
          const cle = o.cle; // narrow pour le callback onClick
          const actif = cle === onglet;
          return (
            <button
              key={cle}
              type="button"
              aria-current={actif ? "page" : undefined}
              onClick={() => setOnglet(cle)}
              className={boutonClasses(actif)}
            >
              <IconeSvg>{o.icone}</IconeSvg>
              {o.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

// Mode « page API » : les trois items sont des liens, « api » est actif,
// les autres renvoient vers /app/profil (option ?onglet= pour atterrir
// directement sur sécurité si on venait de là).
export function SettingsNavApi() {
  return (
    <aside className="rounded-lg bg-surface p-3 lg:w-60 lg:shrink-0 lg:self-start">
      <Titre />
      <nav
        aria-label="Sections des paramètres"
        className="flex gap-1 lg:flex-col lg:gap-1"
      >
        {ITEMS.map((o) => {
          const actif = o.cle === "api";
          const href =
            o.cle === "api"
              ? "/app/profil/api"
              : o.cle === "securite"
                ? "/app/profil?onglet=securite"
                : "/app/profil";
          return (
            <Link
              key={o.cle}
              href={href}
              aria-current={actif ? "page" : undefined}
              className={boutonClasses(actif)}
            >
              <IconeSvg>{o.icone}</IconeSvg>
              {o.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function Titre() {
  return (
    <div className="mb-3 px-1">
      <h1 className="font-display text-lg font-medium tracking-[-0.02em] text-ink">
        Paramètres
      </h1>
      <p className="mt-0.5 text-xs text-stone">
        Votre profil et la sécurité de votre accès.
      </p>
    </div>
  );
}

function IconeSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="currentColor"
    >
      {children}
    </svg>
  );
}
