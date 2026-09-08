import { SignUp } from "@clerk/nextjs";
import { apparenceClerk } from "@/lib/clerk-apparence";

// Inscription sur invitation seulement : c'est un dirigeant qui crée le
// compte depuis la page Équipe, Clerk envoie le lien. Cette page reçoit
// ce lien et sert à choisir son mot de passe.
export default function RegisterPage() {
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
          Activer votre accès
        </h1>
        <p className="mt-3 text-[15px] text-stone">
          Choisissez votre mot de passe pour entrer dans Jiska
        </p>
      </header>
      <SignUp appearance={apparenceClerk} />
    </main>
  );
}
