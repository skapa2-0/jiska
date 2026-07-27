import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import UserMenu from "./user-menu";

// L'espace connecté : volontairement vide pour l'instant, il se
// construira petit à petit.
export default async function AppPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-hairline px-6 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG local, pas d'optimisation utile */}
        <img src="/logo.svg" alt="Jiska" className="h-6 w-auto" />
        <div className="flex items-center gap-3">
          {/* Pas encore d'action : la création de projet viendra ensuite. */}
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-85"
          >
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
            Nouveau projet
          </button>
          <UserMenu email={user.email} />
        </div>
      </header>

      <main className="flex-1" />
    </div>
  );
}
