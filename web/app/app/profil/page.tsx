import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import BottomNav from "../bottom-nav";
import Navbar from "../navbar";
import ProfilForm from "./profil-form";

// Paramètres du compte : profil (photo, identité, adresse) et sécurité
// (mot de passe). Deux volets, tout en Jiska ; aucune interface tierce
// encastrée, la donnée ne vit qu'à un seul endroit.
export default async function ProfilPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} canCreateSujet={false} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="font-display text-2xl font-medium tracking-[-0.02em] text-ink">
          Paramètres
        </h1>
        <p className="mt-2 text-sm text-stone">
          Votre profil et la sécurité de votre accès.
        </p>
        <ProfilForm user={user} />
      </main>
      <BottomNav onglet="profil" canCreate={user.role === "dirigeant"} />
    </div>
  );
}
