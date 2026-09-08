import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getSessionUser } from "@/lib/auth";
import { apparenceClerk } from "@/lib/clerk-apparence";
import AccesRefuse from "./acces-refuse";

// Connexion déléguée à Clerk. L'habillage reprend la DA de la plateforme
// (voir lib/clerk-apparence.ts) pour que la page ne détonne pas.
export default async function LoginPage() {
  // Trois cas, et un seul écran pour les distinguer. C'est ici que la
  // boucle se casse : une session Clerk sans compte Jiska ne repart pas
  // vers /app, qui la renverrait aussitôt ici.
  const { userId } = await auth();
  let refuse: string | null | false = false;
  if (userId) {
    if (await getSessionUser()) redirect("/app");
    const compte = await (await clerkClient()).users.getUser(userId);
    refuse = compte.primaryEmailAddress?.emailAddress ?? null;
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-background px-5 py-10 sm:py-16">
      <header className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG local */}
        <img
          src="/logo.svg"
          alt=""
          aria-hidden="true"
          className="mx-auto mb-8 h-10 w-auto"
        />
        <h1 className="font-display text-[32px] font-medium leading-tight tracking-[-0.02em] text-ink">
          Connexion à Jiska
        </h1>
        <p className="mt-3 text-[15px] text-stone">
          Retrouvez votre espace en quelques secondes
        </p>
      </header>
      {refuse === false ? (
        <SignIn appearance={apparenceClerk} />
      ) : (
        <AccesRefuse email={refuse} />
      )}
    </main>
  );
}
