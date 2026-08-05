import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import BottomNav from "../../bottom-nav";
import Navbar from "../../navbar";
import ProjetForm from "../projet-form";

// Création de projet : réservée aux dirigeants.
export default async function NouveauProjetPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "dirigeant") redirect("/app");

  const people = await query<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    avatar: string | null;
    role: string;
  }>(
    "SELECT id, email, first_name, last_name, avatar, role FROM users ORDER BY last_name, first_name, email",
  );

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} canCreateSujet onglet="produits" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="font-display text-2xl font-medium tracking-[-0.02em] text-ink">
          Nouveau produit
        </h1>
        <p className="mt-2 text-sm text-stone">
          Choisissez les membres du produit et désignez son responsable : il
          pourra créer des sujets dans le produit.
        </p>
        <ProjetForm people={people} />
      </main>
      <BottomNav onglet="produits" canCreate />
    </div>
  );
}
