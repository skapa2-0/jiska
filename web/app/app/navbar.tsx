import UserMenu from "./user-menu";
import type { SessionUser } from "@/lib/auth";

// Barre du haut de l'espace : les actions dépendent des permissions.
// « Nouveau projet » : dirigeants seuls. « Nouveau sujet » : dirigeants
// et responsables de projet.
export type Onglet = "sujets" | "projets";

export default function Navbar({
  user,
  canCreateSujet,
  onglet,
}: {
  user: SessionUser;
  canCreateSujet: boolean;
  onglet?: Onglet;
}) {
  return (
    <header className="flex items-center justify-between border-b border-hairline px-6 py-3">
      <div className="flex items-center gap-5">
        <a href="/app">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG local, pas d'optimisation utile */}
          <img src="/logo.svg" alt="Jiska" className="h-6 w-auto" />
        </a>
        {/* Sélecteur de vue : focus sujets (tableau) ou vue par projet. */}
        <nav
          aria-label="Vues"
          className="flex items-center gap-1 rounded-lg bg-surface p-1"
        >
          <OngletLien actif={onglet === "sujets"} href="/app">
            Sujets
          </OngletLien>
          <OngletLien actif={onglet === "projets"} href="/app/projets">
            Projets
          </OngletLien>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        {canCreateSujet && (
          <a
            href="/app?sujet=nouveau"
            className="flex items-center gap-1.5 rounded-lg border border-hairline px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
          >
            <PlusIcon />
            Nouveau sujet
          </a>
        )}
        {user.role === "dirigeant" && (
          <a
            href="/app/projets/nouveau"
            className="flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-85"
          >
            <PlusIcon />
            Nouveau projet
          </a>
        )}
        <UserMenu user={user} />
      </div>
    </header>
  );
}

function OngletLien({
  actif,
  href,
  children,
}: {
  actif: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-current={actif ? "page" : undefined}
      className={`rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${
        actif ? "bg-white text-ink shadow-card" : "text-mute hover:text-ink"
      }`}
    >
      {children}
    </a>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}
