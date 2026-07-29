import UserMenu from "./user-menu";
import type { SessionUser } from "@/lib/auth";

// Barre du haut de l'espace : les actions dépendent des permissions.
// « Nouveau projet » : dirigeants seuls. « Nouveau sujet » : dirigeants
// et responsables de projet.
export default function Navbar({
  user,
  canCreateSujet,
}: {
  user: SessionUser;
  canCreateSujet: boolean;
}) {
  return (
    <header className="flex items-center justify-between border-b border-hairline px-6 py-3">
      <a href="/app">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG local, pas d'optimisation utile */}
        <img src="/logo.svg" alt="Jiska" className="h-6 w-auto" />
      </a>
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
