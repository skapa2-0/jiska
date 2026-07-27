import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import LogoutButton from "./logout-button";

// L'espace connecté : volontairement vide pour l'instant, il se
// construira petit à petit.
export default async function AppPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-hairline px-6 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG local, pas d'optimisation utile */}
        <img src="/logo.svg" alt="Jiska" className="h-6 w-auto" />
        <div className="flex items-center gap-4">
          <span className="text-sm text-mute">{user.email}</span>
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1" />
    </div>
  );
}
