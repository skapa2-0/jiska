import OublieForm from "./oublie-form";

// Réinitialisation du mot de passe, entièrement en Jiska. Clerk fait le
// travail (envoi du code, vérification, changement) sans que son interface
// apparaisse : même règle que les paramètres du compte.
export default function MotDePasseOubliePage() {
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
          Mot de passe oublié
        </h1>
        <p className="mt-3 text-[15px] text-stone">
          Nous vous envoyons un code pour en choisir un nouveau
        </p>
      </header>
      <OublieForm />
    </main>
  );
}
