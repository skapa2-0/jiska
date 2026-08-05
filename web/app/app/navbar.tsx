import UserMenu from "./user-menu";
import type { SessionUser } from "@/lib/auth";

// Barre du haut de l'espace : les actions dépendent des permissions.
// « Nouveau produit » : dirigeants seuls. « Nouveau sujet » : dirigeants
// et responsables de projet.
export type Onglet = "produits" | "actions";

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
    <header className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3 sm:gap-5">
        <a href="/app" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG local, pas d'optimisation utile */}
          <img src="/logo.svg" alt="Jiska" className="h-6 w-auto" />
        </a>
        {/* Sélecteur de vue : les produits (accueil) ou le tableau des
            actions. Sur téléphone, la navigation passe en barre basse. */}
        <nav
          aria-label="Vues"
          className="hidden items-center gap-1 rounded-lg bg-surface p-1 md:flex"
        >
          <OngletLien actif={onglet === "produits"} href="/app">
            Produits
          </OngletLien>
          <OngletLien actif={onglet === "actions"} href="/app/actions">
            Actions
          </OngletLien>
        </nav>
      </div>
      {/* Les créations restent ici sur desktop ; sur téléphone le
          « + » vit dans la barre basse. */}
      <div className="flex shrink-0 items-center gap-3">
        {canCreateSujet && (
          <a
            href="/app/actions?sujet=nouveau"
            className="hidden items-center gap-1.5 rounded-lg border border-hairline px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface md:flex"
          >
            <PlusIcon />
            Nouveau sujet
          </a>
        )}
        {user.role === "dirigeant" && (
          <a
            href="/app/produits/nouveau"
            className="hidden items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-85 md:flex"
          >
            <PlusIcon />
            Nouveau produit
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
      className={`rounded-md px-2.5 py-1.5 text-sm font-semibold transition sm:px-3.5 ${
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
