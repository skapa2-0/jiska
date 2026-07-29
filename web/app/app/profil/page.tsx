import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import Navbar from "../navbar";
import ProfilForm from "./profil-form";

// Page profil : chacun modifie ses informations et sa photo.
export default async function ProfilPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} canCreateSujet={false} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <h1 className="font-display text-2xl font-medium tracking-[-0.02em] text-ink">
          Mon profil
        </h1>
        <p className="mt-2 text-sm text-stone">
          {user.role === "dirigeant" ? "Dirigeant" : "Collaborateur"} de la
          plateforme.
        </p>
        <ProfilForm user={user} />
      </main>
    </div>
  );
}
