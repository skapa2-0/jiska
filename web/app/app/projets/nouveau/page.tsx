import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import Navbar from "../../navbar";
import NewProjectForm from "./new-project-form";

// Création de projet : réservée aux dirigeants.
export default async function NouveauProjetPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "dirigeant") redirect("/app");

  const people = await query<{ id: string; email: string; role: string }>(
    "SELECT id, email, role FROM users ORDER BY email",
  );

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} canCreateSujet onglet="projets" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="font-display text-2xl font-medium tracking-[-0.02em] text-ink">
          Nouveau projet
        </h1>
        <p className="mt-2 text-sm text-stone">
          Choisissez les membres du projet et désignez son responsable : il
          pourra créer des sujets dans le projet.
        </p>
        <NewProjectForm people={people} />
      </main>
    </div>
  );
}
