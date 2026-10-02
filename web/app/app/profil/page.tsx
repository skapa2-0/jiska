import { redirect } from "next/navigation";
import { estAdmin, estDansUnProjet, getSessionUser } from "@/lib/auth";
import BottomNav from "../bottom-nav";
import Navbar from "../navbar";
import ProfilForm from "./profil-form";

// Paramètres du compte : profil (photo, identité, adresse) et sécurité
// (mot de passe). Deux volets, tout en Jiska ; aucune interface tierce
// encastrée, la donnée ne vit qu'à un seul endroit.
export default async function ProfilPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const canCreateSujet = estAdmin(user) || (await estDansUnProjet(user.id));

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} canCreateSujet={canCreateSujet} />
      <main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <ProfilForm user={user} />
      </main>
      <BottomNav onglet="profil" canCreate={canCreateSujet} />
    </div>
  );
}
