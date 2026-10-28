import { redirect } from "next/navigation";
import { listerTokens } from "@/lib/api-tokens";
import { estAdmin, estDansUnProjet, getSessionUser } from "@/lib/auth";
import BottomNav from "../../bottom-nav";
import Navbar from "../../navbar";
import ApiManager from "./api-manager";
import { endpointsPourRole } from "./endpoints";

// Paramètres > API : gestion des jetons personnels (création,
// révocation) et documentation précise des endpoints appelables. La
// doc est filtrée selon le rôle : on ne montre que ce que la personne
// peut appeler avec son propre jeton.
export default async function ProfilApiPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const canCreateSujet = estAdmin(user) || (await estDansUnProjet(user.id));
  const tokens = await listerTokens(user.id);
  const categories = endpointsPourRole(user.role);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} canCreateSujet={canCreateSujet} />
      <main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <ApiManager
          role={user.role}
          tokensInitiaux={tokens}
          categories={categories}
        />
      </main>
      <BottomNav onglet="profil" canCreate={canCreateSujet} />
    </div>
  );
}
