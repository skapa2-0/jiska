import { redirect } from "next/navigation";
import { UserProfile } from "@clerk/nextjs";
import { getSessionUser, isResponsable } from "@/lib/auth";
import { apparenceClerk } from "@/lib/clerk-apparence";
import BottomNav from "../../bottom-nav";
import Navbar from "../../navbar";

// Mot de passe, adresse de connexion, appareils : tout cela appartient à
// Clerk. La page reste dans Jiska (même navbar, même DA), seul le contenu
// est délégué.
export default async function ComptePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const canCreateSujet =
    user.role === "dirigeant" || (await isResponsable(user.id));

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} canCreateSujet={canCreateSujet} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <a
          href="/app/profil"
          className="text-sm font-medium text-mute transition hover:text-ink"
        >
          ← Mon profil
        </a>
        <h1 className="mt-4 font-display text-2xl font-medium tracking-[-0.02em] text-ink">
          Mot de passe et connexion
        </h1>
        <div className="mt-6">
          <UserProfile appearance={apparenceClerk} routing="path" path="/app/compte" />
        </div>
      </main>
      <BottomNav canCreate={canCreateSujet} />
    </div>
  );
}
