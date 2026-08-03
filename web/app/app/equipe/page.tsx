import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";
import BottomNav from "../bottom-nav";
import Navbar from "../navbar";
import TeamManager from "./team-manager";

// Gestion de l'équipe : réservée aux dirigeants.
export default async function EquipePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "dirigeant") redirect("/app");

  const members = await query<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    avatar: string | null;
    role: string;
    created_at: string;
  }>(
    "SELECT id, email, first_name, last_name, avatar, role, created_at::date::text AS created_at FROM users ORDER BY created_at, id",
  );

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} canCreateSujet />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="font-display text-2xl font-medium tracking-[-0.02em] text-ink">
          Équipe
        </h1>
        <p className="mt-2 text-sm text-stone">
          Les comptes de la plateforme sont créés et gérés ici, par les
          dirigeants uniquement.
        </p>
        <TeamManager members={members} selfId={user.id} />
      </main>
      <BottomNav canCreate />
    </div>
  );
}
