"use client";

import { useClerk } from "@clerk/nextjs";

// Compte authentifié chez Clerk, mais inconnu de Jiska. Sans cet écran, la
// page renverrait vers /app, qui renverrait vers /login, indéfiniment : la
// personne verrait un clignotement sans jamais comprendre pourquoi.
export default function AccesRefuse({ email }: { email: string | null }) {
  const { signOut } = useClerk();

  return (
    <section className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-card">
      <h2 className="font-display text-xl font-medium text-ink">
        Cet accès n&apos;est pas encore ouvert
      </h2>
      <p className="mt-3 text-[15px] text-mute">
        Vous êtes bien identifié{email ? ` avec ${email}` : ""}, mais aucun
        compte Jiska ne correspond à cette adresse. Un dirigeant doit vous
        créer un accès, ou vous inviter avec l&apos;adresse de votre compte
        existant.
      </p>
      <button
        type="button"
        onClick={() => signOut({ redirectUrl: "/login" })}
        className="mt-6 rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-85"
      >
        Se déconnecter
      </button>
    </section>
  );
}
