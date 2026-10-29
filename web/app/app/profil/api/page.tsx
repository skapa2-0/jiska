import { redirect } from "next/navigation";
import { estAdmin, estDansUnProjet, getSessionUser } from "@/lib/auth";
import { toolsPourRole } from "@/lib/mcp-tools";
import { sessionsPourUser } from "@/lib/oauth";
import BottomNav from "../../bottom-nav";
import Navbar from "../../navbar";
import ApiManager from "./api-manager";
import { endpointsPourRole } from "./endpoints";

// Paramètres > API : plus de jetons à copier-coller. Les clients
// (Claude Desktop, Claude Code, intégrations personnalisées) se
// connectent via OAuth 2.1 et apparaissent ici comme sessions
// autorisées, révocables à l'unité.
export default async function ProfilApiPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const canCreateSujet = estAdmin(user) || (await estDansUnProjet(user.id));
  const sessions = await sessionsPourUser(user.id);
  const categories = endpointsPourRole(user.role);
  const tools = toolsPourRole(user.role).map((t) => ({
    name: t.name,
    description: t.description,
  }));

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} canCreateSujet={canCreateSujet} />
      <main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <ApiManager
          role={user.role}
          sessions={sessions}
          categories={categories}
          tools={tools}
        />
      </main>
      <BottomNav onglet="profil" canCreate={canCreateSujet} />
    </div>
  );
}
